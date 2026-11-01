/**
 * FAI Engine — Harness Resolver
 * Compiles a fai-manifest.json that declares `extends` into its effective harness:
 * profile WAF pillars, instructions and hooks are a minimum, profile guardrails are
 * defaults a play may only tighten unless an unexpired waiver applies.
 *
 * Manifests without `extends` are returned exactly as loadManifest produced them.
 */

import { createHash } from 'crypto';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'path';
import { fileURLToPath } from 'url';
import { loadManifest, playDirFor, validateManifest, WAF_PILLARS } from './manifest-reader.js';

const DEFAULT_PROFILES_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'harness', 'profiles');
const REFERENCE = /^([a-z][a-z0-9-]*)@([1-9][0-9]*)$/;
const MAX_CHAIN = 4;
const LIST_CATEGORIES = ['instructions', 'hooks'];
const HIGHER_IS_STRICTER = new Set(['groundedness', 'coherence', 'relevance']);
const GUARDRAIL_KEYS = ['groundedness', 'coherence', 'relevance', 'safety', 'costPerQuery'];
const PROFILE_KEYS = new Set(['profile', 'version', 'description', 'extends', 'context', 'primitives', 'files', 'requires', 'evaluation']);
const PROFILE_PRIMITIVE_KEYS = new Set([...LIST_CATEGORIES, 'guardrails']);
const FILE_TARGET = /^\.github\/[A-Za-z0-9._/-]+\.md$/;
const REQUIRED_PATH = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*\/?$/;
const EVALUATION_METRICS = new Set(GUARDRAIL_KEYS);
const WAIVER_WARNING_DAYS = 14;
const TOP_LEVEL_GUARDRAILS = 'top-level guardrails are ignored by the engine; declare them in primitives.guardrails';

function isLooser(key, candidate, baseline) {
  if (key === 'safety') return candidate > baseline;
  if (key === 'costPerQuery') return candidate > baseline;
  return HIGHER_IS_STRICTER.has(key) && candidate < baseline;
}

function within(root, target) {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function validateGuardrails(guardrails, label) {
  const errors = [];
  if (!guardrails || typeof guardrails !== 'object' || Array.isArray(guardrails)) return [`${label} must be an object`];
  for (const [key, value] of Object.entries(guardrails)) {
    if (!GUARDRAIL_KEYS.includes(key)) errors.push(`${label}.${key} is not a known guardrail`);
    else if (typeof value !== 'number' || !Number.isFinite(value)) errors.push(`${label}.${key} must be a number`);
    else if (key === 'safety' && value !== 0) errors.push(`${label}.safety must be 0`);
    else if (key === 'costPerQuery' && value < 0) errors.push(`${label}.costPerQuery must be >= 0`);
    else if (HIGHER_IS_STRICTER.has(key) && (value < 0 || value > 1)) errors.push(`${label}.${key} must be 0-1`);
  }
  return errors;
}

function validateProfile(profile, name, major, label) {
  const errors = [];
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return [`${label} must be a JSON object`];
  for (const key of Object.keys(profile)) if (!PROFILE_KEYS.has(key)) errors.push(`${label} has unknown field "${key}"`);
  if (profile.profile !== name) errors.push(`${label} declares profile "${profile.profile}", expected "${name}"`);
  if (typeof profile.version !== 'string' || !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(profile.version)) {
    errors.push(`${label} version must be semver`);
  } else if (profile.version.split('.')[0] !== major) {
    errors.push(`${label} version ${profile.version} does not match major ${major}`);
  }
  if (profile.extends !== undefined && (typeof profile.extends !== 'string' || !REFERENCE.test(profile.extends))) {
    errors.push(`${label} extends must be "profile-name@major"`);
  }
  if (profile.context !== undefined) {
    const keys = Object.keys(profile.context || {});
    if (keys.some(k => k !== 'waf')) errors.push(`${label} context may only declare waf`);
    const waf = profile.context?.waf;
    if (waf !== undefined && (!Array.isArray(waf) || waf.some(p => !WAF_PILLARS.includes(p)))) {
      errors.push(`${label} context.waf must list valid WAF pillars`);
    }
  }
  if (profile.primitives !== undefined) {
    for (const key of Object.keys(profile.primitives || {})) {
      if (!PROFILE_PRIMITIVE_KEYS.has(key)) errors.push(`${label} primitives.${key} is not inheritable`);
    }
    for (const category of LIST_CATEGORIES) {
      const list = profile.primitives?.[category];
      if (list !== undefined && (!Array.isArray(list) || list.some(p => typeof p !== 'string' || !p || isAbsolute(p)))) {
        errors.push(`${label} primitives.${category} must list repository-relative paths`);
      }
    }
    if (profile.primitives?.guardrails !== undefined) {
      errors.push(...validateGuardrails(profile.primitives.guardrails, `${label} guardrails`));
    }
  }
  if (profile.files !== undefined) {
    if (!Array.isArray(profile.files)) {
      errors.push(`${label} files must be an array`);
    } else {
      for (const target of profile.files) {
        if (typeof target !== 'string' || !FILE_TARGET.test(target) || target.split('/').includes('..')) {
          errors.push(`${label} file target must be a .github/**/*.md path (got "${target}")`);
        }
      }
      if (new Set(profile.files).size !== profile.files.length) errors.push(`${label} lists a file target twice`);
    }
  }
  if (profile.requires !== undefined) {
    const keys = Object.keys(profile.requires || {});
    const paths = profile.requires?.paths;
    if (keys.some(k => k !== 'paths') || !Array.isArray(paths)
      || paths.some(p => typeof p !== 'string' || !REQUIRED_PATH.test(p) || p.split('/').includes('..'))) {
      errors.push(`${label} requires.paths must list play-relative paths`);
    }
  }
  if (profile.evaluation !== undefined) {
    const keys = Object.keys(profile.evaluation || {});
    const required = profile.evaluation?.required;
    if (keys.some(k => k !== 'required') || !Array.isArray(required) || required.some(m => !EVALUATION_METRICS.has(m))) {
      errors.push(`${label} evaluation.required must list known guardrail metrics`);
    }
  }
  return errors;
}

/**
 * Load the extends chain for a profile reference, base profile first.
 * @returns {{ chain: Array<{ reference: string, profile: object, sha256: string }>, errors: string[] }}
 */
function loadProfileChain(reference, profilesRoot = DEFAULT_PROFILES_ROOT) {
  const chain = [];
  const seen = new Set();
  let current = reference;

  while (current) {
    const label = `profile ${current}`;
    if (seen.has(current)) return { chain: [], errors: [`${label} creates an extends cycle`] };
    if (chain.length >= MAX_CHAIN) return { chain: [], errors: [`profile chain exceeds ${MAX_CHAIN} levels at ${current}`] };
    seen.add(current);

    const match = REFERENCE.exec(current);
    if (!match) return { chain: [], errors: [`${label} must be "profile-name@major"`] };
    const [, name, major] = match;
    const file = resolve(profilesRoot, name, `v${major}.json`);
    if (!within(resolve(profilesRoot), file) || !existsSync(file)) return { chain: [], errors: [`${label} not found`] };

    const raw = readFileSync(file);
    let profile;
    try {
      profile = JSON.parse(raw.toString('utf8'));
    } catch (err) {
      return { chain: [], errors: [`${label} is not valid JSON: ${err.message}`] };
    }
    const errors = validateProfile(profile, name, major, label);
    if (errors.length > 0) return { chain: [], errors };

    const files = [];
    for (const target of profile.files || []) {
      const template = resolve(profilesRoot, name, 'files', target);
      if (!within(resolve(profilesRoot, name, 'files'), template) || !existsSync(template)) {
        return { chain: [], errors: [`${label} file template not found: ${target}`] };
      }
      const bytes = readFileSync(template);
      files.push({ target, template, sha256: createHash('sha256').update(bytes).digest('hex') });
    }

    chain.unshift({ reference: current, profile, files, sha256: createHash('sha256').update(raw).digest('hex') });
    current = profile.extends;
  }

  return { chain, errors: [] };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function toPosix(value) {
  return value.split(sep).join('/');
}

/**
 * Compile a manifest into its effective harness.
 * @param {string} manifestPath - Path to fai-manifest.json
 * @param {{ now?: Date, profilesRoot?: string }} [options]
 * @returns {{ manifest: object|null, playDir: string|null, errors: string[], warnings: string[], harness: object|null }}
 */
function compileManifest(manifestPath, options = {}) {
  return compileLoaded(loadManifest(manifestPath), options);
}

/**
 * Compile an in-memory manifest as if it were stored at manifestPath (nothing is written).
 * @param {object} manifest - Parsed manifest
 * @param {string} manifestPath - Intended location, used to resolve the play directory
 * @param {{ now?: Date, profilesRoot?: string }} [options]
 */
function compileManifestData(manifest, manifestPath, options = {}) {
  return compileLoaded({ manifest, playDir: playDirFor(manifestPath), errors: validateManifest(manifest) }, options);
}

function compileLoaded(loaded, { now = new Date(), profilesRoot = DEFAULT_PROFILES_ROOT } = {}) {
  const warnings = [];
  if (!loaded.manifest || loaded.manifest.extends === undefined) {
    if (loaded.manifest?.guardrails !== undefined) warnings.push(TOP_LEVEL_GUARDRAILS);
    return { ...loaded, warnings, harness: null };
  }

  const { manifest, playDir } = loaded;
  const errors = [...loaded.errors];
  if (typeof manifest.extends !== 'string') return { ...loaded, warnings, harness: null };

  if (manifest.guardrails !== undefined) {
    errors.push(TOP_LEVEL_GUARDRAILS);
  }

  const { chain, errors: chainErrors } = loadProfileChain(manifest.extends, profilesRoot);
  errors.push(...chainErrors);
  if (chain.length === 0) return { manifest, playDir, errors, warnings, harness: null };

  const repoRoot = resolve(profilesRoot, '..', '..');
  const effective = structuredClone(manifest);
  effective.context ||= {};
  effective.primitives ||= {};
  const provenance = { 'context.waf': {}, 'primitives.guardrails': {} };

  // WAF pillars: play order first, then profile-required pillars the play omitted.
  const required = new Map();
  for (const { reference, profile } of chain) {
    for (const pillar of profile.context?.waf || []) if (!required.has(pillar)) required.set(pillar, `profile:${reference}`);
  }
  const playPillars = Array.isArray(manifest.context?.waf) ? manifest.context.waf : [];
  effective.context.waf = [...new Set([...playPillars, ...required.keys()])];
  for (const pillar of effective.context.waf) provenance['context.waf'][pillar] = required.get(pillar) || 'play';

  // Instructions and hooks: profile entries first, play entries appended, deduplicated by target.
  for (const category of LIST_CATEGORIES) {
    const key = `primitives.${category}`;
    provenance[key] = {};
    const seenTargets = new Set();
    const merged = [];
    const add = (playRelative, source) => {
      const target = resolve(playDir, playRelative).replace(/[\\/]+$/, '');
      if (seenTargets.has(target)) return;
      seenTargets.add(target);
      merged.push(playRelative);
      provenance[key][playRelative] = source;
    };
    for (const { reference, profile } of chain) {
      for (const entry of profile.primitives?.[category] || []) {
        const absolute = resolve(repoRoot, entry);
        if (!within(repoRoot, absolute)) {
          errors.push(`profile ${reference} ${category} entry escapes the repository: ${entry}`);
          continue;
        }
        const playRelative = toPosix(relative(playDir, absolute)) + (entry.endsWith('/') ? '/' : '');
        add(playRelative, `profile:${reference}`);
      }
    }
    for (const entry of Array.isArray(manifest.primitives?.[category]) ? manifest.primitives[category] : []) add(entry, 'play');
    if (merged.length > 0) effective.primitives[category] = merged;
  }

  // Guardrails: profile defaults; deeper profiles and the play may only tighten them.
  const baseline = {};
  const baselineSource = {};
  for (const { reference, profile } of chain) {
    for (const [name, value] of Object.entries(profile.primitives?.guardrails || {})) {
      if (name in baseline && isLooser(name, value, baseline[name])) {
        errors.push(`profile ${reference} loosens guardrails.${name} inherited from ${baselineSource[name]}`);
        continue;
      }
      baseline[name] = value;
      baselineSource[name] = `profile:${reference}`;
    }
  }

  const waivers = new Map((Array.isArray(manifest.waivers) ? manifest.waivers : []).map(w => [w?.rule, w]));
  const usedWaivers = new Set();
  const guardrails = { ...baseline };
  Object.assign(provenance['primitives.guardrails'], baselineSource);
  for (const [name, value] of Object.entries(manifest.primitives?.guardrails || {})) {
    const rule = `guardrails.${name}`;
    if (name in baseline && isLooser(name, value, baseline[name])) {
      const waiver = waivers.get(rule);
      if (!waiver) {
        errors.push(`${rule} ${value} is looser than ${baselineSource[name]} (${baseline[name]}) and has no waiver`);
        continue;
      }
      if (Date.parse(`${waiver.expires}T23:59:59.999Z`) < now.getTime()) {
        errors.push(`waiver for ${rule} expired on ${waiver.expires}`);
        continue;
      }
      usedWaivers.add(rule);
      guardrails[name] = value;
      provenance['primitives.guardrails'][name] = `waiver:${waiver.expires}`;
      const daysLeft = Math.floor((Date.parse(`${waiver.expires}T23:59:59.999Z`) - now.getTime()) / 86400000);
      if (daysLeft < WAIVER_WARNING_DAYS) warnings.push(`waiver for ${rule} expires on ${waiver.expires} (${daysLeft} day(s) left)`);
      continue;
    }
    guardrails[name] = value;
    provenance['primitives.guardrails'][name] = 'play';
  }
  for (const rule of waivers.keys()) {
    if (rule && !usedWaivers.has(rule) && !errors.some(e => e.startsWith(`waiver for ${rule}`))) {
      errors.push(`waiver for ${rule} is not needed; remove it`);
    }
  }
  if (Object.keys(guardrails).length > 0) effective.primitives.guardrails = guardrails;

  for (const error of validateManifest(effective)) if (!errors.includes(error)) errors.push(error);

  // Required play artifacts: every profile in the chain adds to the list.
  const requires = [];
  for (const { reference, profile } of chain) {
    for (const entry of profile.requires?.paths || []) {
      if (requires.some(item => item.path === entry)) continue;
      requires.push({ path: entry, profile: reference });
      const absolute = resolve(playDir, entry);
      if (!within(playDir, absolute) || !existsSync(absolute)) errors.push(`harness ${reference} requires ${entry} in the play`);
    }
  }

  const evaluationRequired = [];
  for (const { profile } of chain) {
    for (const metric of profile.evaluation?.required || []) if (!evaluationRequired.includes(metric)) evaluationRequired.push(metric);
  }

  // Generated play files: a deeper profile replaces a parent's template for the same target.
  const fileMap = new Map();
  for (const { reference, files } of chain) {
    for (const file of files) fileMap.set(file.target, { ...file, profile: reference });
  }
  const files = [...fileMap.values()]
    .sort((a, b) => (a.target < b.target ? -1 : a.target > b.target ? 1 : 0))
    .map(({ target, template, sha256, profile }) => ({
      target,
      profile,
      template: toPosix(relative(repoRoot, template)),
      sha256
    }));

  const profiles = chain.map(({ reference, profile, sha256 }) => ({ reference, version: profile.version, sha256 }));
  const sha256 = createHash('sha256')
    .update(canonicalJson({ manifest: effective, profiles, files, requires, evaluationRequired }))
    .digest('hex');

  return {
    manifest: effective,
    playDir,
    errors,
    warnings,
    harness: {
      extends: manifest.extends,
      profiles,
      waivers: [...usedWaivers].map(rule => waivers.get(rule)),
      files,
      requires,
      evaluation: { required: evaluationRequired },
      provenance,
      sha256
    }
  };
}

/**
 * List every available harness profile version.
 * @param {string} [profilesRoot]
 * @returns {Array<{ reference: string, version: string|null, description: string|null, extends: string|null, errors: string[] }>}
 */
function listProfiles(profilesRoot = DEFAULT_PROFILES_ROOT) {
  if (!existsSync(profilesRoot)) return [];
  const entries = [];
  for (const name of readdirSync(profilesRoot).sort()) {
    const dir = resolve(profilesRoot, name);
    if (!existsSync(dir) || !/^[a-z][a-z0-9-]*$/.test(name)) continue;
    let files;
    try {
      files = readdirSync(dir).filter(file => /^v[1-9][0-9]*\.json$/.test(file)).sort();
    } catch {
      continue;
    }
    for (const file of files) {
      const reference = `${name}@${file.slice(1, -5)}`;
      const { chain, errors } = loadProfileChain(reference, profilesRoot);
      const own = chain[chain.length - 1]?.profile;
      entries.push({
        reference,
        version: own?.version ?? null,
        description: own?.description ?? null,
        extends: own?.extends ?? null,
        errors
      });
    }
  }
  return entries;
}

export { compileManifest, compileManifestData, isLooser, listProfiles, loadProfileChain, DEFAULT_PROFILES_ROOT };
