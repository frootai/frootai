/**
 * FAI Engine — Manifest Reader
 * Reads and validates fai-manifest.json files against the FAI Protocol schema.
 *
 * The manifest is the heart of the FAI Protocol: a single JSON file that declares
 * how primitives wire together for a solution play.
 */

import { readFileSync, existsSync } from 'fs';
import { join, resolve, dirname, basename } from 'path';

const WAF_PILLARS = [
  'security', 'reliability', 'cost-optimization',
  'operational-excellence', 'performance-efficiency', 'responsible-ai'
];

const INFRASTRUCTURE_PATH_FIELDS = new Set([
  'bicep', 'template', 'parameters', 'terraform'
]);

/**
 * Load and validate a fai-manifest.json file.
 * @param {string} manifestPath - Absolute or relative path to fai-manifest.json
 * @returns {{ manifest: object, playDir: string, errors: string[] }}
 */
function loadManifest(manifestPath) {
  const absPath = resolve(manifestPath);
  const errors = [];

  if (!existsSync(absPath)) {
    return { manifest: null, playDir: null, errors: [`Manifest not found: ${absPath}`] };
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(absPath, 'utf8'));
  } catch (err) {
    return { manifest: null, playDir: null, errors: [`Invalid JSON: ${err.message}`] };
  }

  // playDir is the play root — if manifest is in spec/, go up one level
  const playDir = playDirFor(absPath);

  errors.push(...validateManifest(manifest));

  return { manifest, playDir, errors };
}

/**
 * Play root for a manifest path (manifests may live in the play root or in spec/).
 * @param {string} manifestPath
 * @returns {string}
 */
function playDirFor(manifestPath) {
  const dir = dirname(resolve(manifestPath));
  return basename(dir) === 'spec' ? dirname(dir) : dir;
}

const HARNESS_REFERENCE = /^[a-z][a-z0-9-]*@[1-9][0-9]*$/;
const WAIVABLE_RULES = new Set([
  'guardrails.groundedness', 'guardrails.coherence', 'guardrails.relevance', 'guardrails.costPerQuery'
]);

/**
 * Validate the required fields and quality gates of a parsed manifest.
 * @param {object} manifest - Parsed (or harness-compiled) fai-manifest.json
 * @returns {string[]} Validation errors
 */
function validateManifest(manifest) {
  const errors = [];

  // Validate required fields
  if (!manifest.play || !/^[0-9]{2,3}-[a-z0-9-]+$/.test(manifest.play)) {
    errors.push(`play must match "NN-or-NNN-kebab-case" (got "${manifest.play}")`);
  }

  if (!manifest.version || !/^[0-9]+\.[0-9]+\.[0-9]+/.test(manifest.version)) {
    errors.push(`version must be semver (got "${manifest.version}")`);
  }

  if (manifest.extends !== undefined && (typeof manifest.extends !== 'string' || !HARNESS_REFERENCE.test(manifest.extends))) {
    errors.push(`extends must be "profile-name@major" (got "${manifest.extends}")`);
  }

  if (manifest.waivers !== undefined) {
    if (manifest.extends === undefined) {
      errors.push('waivers require extends');
    } else if (!Array.isArray(manifest.waivers)) {
      errors.push('waivers must be an array');
    } else {
      const rules = new Set();
      for (const waiver of manifest.waivers) {
        const keys = waiver && typeof waiver === 'object' ? Object.keys(waiver) : [];
        if (keys.some(k => !['rule', 'reason', 'expires'].includes(k))) {
          errors.push(`waiver has unknown fields: ${keys.join(', ')}`);
          continue;
        }
        if (!WAIVABLE_RULES.has(waiver.rule)) errors.push(`waiver rule is not waivable (got "${waiver.rule}")`);
        if (rules.has(waiver.rule)) errors.push(`duplicate waiver for ${waiver.rule}`);
        rules.add(waiver.rule);
        if (typeof waiver.reason !== 'string' || waiver.reason.trim().length < 10) {
          errors.push(`waiver ${waiver.rule} needs a reason of at least 10 characters`);
        }
        if (typeof waiver.expires !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(waiver.expires)
          || Number.isNaN(Date.parse(`${waiver.expires}T00:00:00Z`))) {
          errors.push(`waiver ${waiver.rule} expires must be a YYYY-MM-DD date (got "${waiver.expires}")`);
        }
      }
    }
  }

  // Context validation
  if (!manifest.context) {
    errors.push('missing context object');
  } else {
    if (!manifest.context.knowledge || !Array.isArray(manifest.context.knowledge) || manifest.context.knowledge.length === 0) {
      errors.push('context.knowledge must have at least one module');
    }
    if (!manifest.context.waf || !Array.isArray(manifest.context.waf) || manifest.context.waf.length === 0) {
      errors.push('context.waf must have at least one pillar');
    } else {
      const invalid = manifest.context.waf.filter(w => !WAF_PILLARS.includes(w));
      if (invalid.length > 0) errors.push(`invalid WAF pillars: ${invalid.join(', ')}`);
    }
  }

  // Primitives validation
  if (!manifest.primitives) {
    errors.push('missing primitives object');
  } else if (manifest.primitives.guardrails) {
    const g = manifest.primitives.guardrails;
    if (g.groundedness !== undefined && (g.groundedness < 0 || g.groundedness > 1)) {
      errors.push(`guardrails.groundedness must be 0-1 (got ${g.groundedness})`);
    }
    if (g.coherence !== undefined && (g.coherence < 0 || g.coherence > 1)) {
      errors.push(`guardrails.coherence must be 0-1 (got ${g.coherence})`);
    }
    if (g.safety !== undefined && g.safety !== 0) {
      errors.push(`guardrails.safety must be 0 for production (got ${g.safety})`);
    }
  }

  return errors;
}

/**
 * Resolve all file paths in a manifest relative to the play directory.
 * @param {object} manifest - Parsed fai-manifest.json
 * @param {string} playDir - Absolute path to the play directory
 * @returns {{ resolved: object, missing: string[] }}
 */
function resolvePaths(manifest, playDir) {
  const missing = [];
  const resolved = {
    agents: [],
    instructions: [],
    skills: [],
    hooks: [],
    workflows: [],
    infrastructure: {
      paths: {},
      metadata: {}
    }
  };

  const resolveList = (list, category) => {
    if (!Array.isArray(list)) return [];
    return list.map(relPath => {
      const abs = resolve(playDir, relPath);
      if (!existsSync(abs)) {
        missing.push(`${category}: ${relPath} (resolved: ${abs})`);
      }
      return { relative: relPath, absolute: abs, exists: existsSync(abs) };
    });
  };

  if (manifest.primitives) {
    resolved.agents = resolveList(manifest.primitives.agents, 'agents');
    resolved.instructions = resolveList(manifest.primitives.instructions, 'instructions');
    resolved.skills = resolveList(manifest.primitives.skills, 'skills');
    resolved.hooks = resolveList(manifest.primitives.hooks, 'hooks');
    resolved.workflows = resolveList(manifest.primitives.workflows, 'workflows');
  }

  if (manifest.infrastructure) {
    for (const [key, value] of Object.entries(manifest.infrastructure)) {
      if (!INFRASTRUCTURE_PATH_FIELDS.has(key)) {
        resolved.infrastructure.metadata[key] = value;
        continue;
      }
      if (typeof value !== 'string' || value.length === 0) continue;
      const abs = resolve(playDir, value);
      const exists = existsSync(abs);
      resolved.infrastructure.paths[key] = { relative: value, absolute: abs, exists };
      if (!exists) {
        missing.push(`infrastructure.${key}: ${value}`);
      }
    }
  }

  return { resolved, missing };
}

export { loadManifest, validateManifest, resolvePaths, playDirFor, WAF_PILLARS };
