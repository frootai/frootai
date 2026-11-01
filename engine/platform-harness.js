/**
 * FAI Engine - Platform Harness Registry
 * Produces one health report for Solution Plays plus generic agent, product,
 * and platform subjects discovered from the repository registry.
 */

import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { compileManifest, DEFAULT_PROFILES_ROOT } from './harness-resolver.js';
import { compileHarnessSubject } from './harness-subject.js';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const registrySchema = JSON.parse(readFileSync(resolve(repositoryRoot, 'schemas', 'fai-platform-harness.schema.json'), 'utf8'));
let registryValidator;

function within(root, target) {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function validator() {
  if (registryValidator) return registryValidator;
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  registryValidator = ajv.compile(registrySchema);
  return registryValidator;
}

function readJson(filePath, label, errors) {
  if (!existsSync(filePath)) {
    errors.push(`${label} not found: ${filePath}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`${label} is not valid JSON: ${error.message}`);
    return null;
  }
}

function loadPlatformRegistry(registryPath) {
  const absolute = resolve(registryPath);
  const errors = [];
  const registry = readJson(absolute, 'platform harness registry', errors);
  if (!registry) return { registry: null, registryPath: absolute, errors };
  const validate = validator();
  if (!validate(registry)) {
    for (const error of validate.errors || []) errors.push(`platform registry ${error.instancePath || '/'} ${error.message}`);
  }
  return { registry, registryPath: absolute, errors };
}

function emptyKind() {
  return { total: 0, harnessed: 0, exempt: 0, failed: 0 };
}

function buildPlatformHarnessReport(repoRoot, options = {}) {
  const absoluteRoot = resolve(repoRoot);
  const registryPath = resolve(options.registryPath ?? resolve(absoluteRoot, 'harness', 'platform.json'));
  const profilesRoot = resolve(options.profilesRoot ?? DEFAULT_PROFILES_ROOT);
  const now = options.now ?? new Date();
  const loaded = loadPlatformRegistry(registryPath);
  const entries = [];
  const errors = [...loaded.errors];
  const warnings = [];
  const byKind = {
    'solution-play': emptyKind(),
    agent: emptyKind(),
    product: emptyKind(),
    platform: emptyKind()
  };

  if (!loaded.registry) {
    return {
      healthy: false,
      entries,
      errors,
      warnings,
      byKind,
      total: 0,
      harnessed: 0,
      exempt: 0,
      failed: 0,
      systemErrors: errors.length,
      coverage: 0
    };
  }
  const { registry } = loaded;

  const subjectsDirectory = resolve(absoluteRoot, registry.subjects_directory);
  if (!within(absoluteRoot, subjectsDirectory) || !existsSync(subjectsDirectory) || lstatSync(subjectsDirectory).isSymbolicLink()) {
    errors.push('subjects_directory is missing, outside the repository, or symbolic');
  } else {
    const seen = new Set();
    for (const file of readdirSync(subjectsDirectory).filter((name) => name.endsWith('.json')).sort()) {
      const descriptorPath = resolve(subjectsDirectory, file);
      const descriptor = readJson(descriptorPath, `subject ${file}`, errors);
      if (!descriptor) continue;
      const id = descriptor.subject ?? file.replace(/\.json$/, '');
      if (seen.has(id)) {
        errors.push(`duplicate platform subject: ${id}`);
        continue;
      }
      seen.add(id);
      const kind = descriptor.kind;
      const compiled = compileHarnessSubject(descriptorPath, {
        repoRoot: absoluteRoot,
        profilesRoot,
        defaultProfile: registry.defaults[kind],
        now
      });
      const failed = compiled.errors.length > 0;
      const entry = {
        id,
        kind: kind ?? 'product',
        root: descriptor.root ?? null,
        status: failed ? 'failed' : 'harnessed',
        profile: compiled.effective?.extends ?? null,
        sha256: compiled.harness?.sha256 ?? null,
        errors: compiled.errors,
        warnings: compiled.warnings
      };
      entries.push(entry);
      if (byKind[entry.kind]) {
        byKind[entry.kind].total += 1;
        byKind[entry.kind][failed ? 'failed' : 'harnessed'] += 1;
      }
      warnings.push(...compiled.warnings.map((warning) => ({ id, warning })));
    }
  }

  const playsRoot = resolve(absoluteRoot, registry.solution_plays.root);
  const exemptionsPath = resolve(absoluteRoot, registry.solution_plays.exemptions);
  const exemptionsDocument = readJson(exemptionsPath, 'solution play exemptions', errors) ?? { plays: {} };
  const exemptions = exemptionsDocument.plays ?? {};
  const today = now.toISOString().slice(0, 10);
  if (!within(absoluteRoot, playsRoot) || !existsSync(playsRoot)) {
    errors.push('solution_plays.root is missing or outside the repository');
  } else {
    for (const play of readdirSync(playsRoot).filter((name) => /^\d{2,3}-/.test(name)).sort()) {
      const manifestPath = resolve(playsRoot, play, registry.solution_plays.manifest);
      if (!existsSync(manifestPath)) continue;
      const compiled = compileManifest(manifestPath, { profilesRoot, now });
      const exemption = exemptions[play];
      const overdue = Boolean(exemption?.review_by && exemption.review_by < today);
      let status = 'unharnessed';
      if (compiled.errors.length > 0) status = 'failed';
      else if (compiled.harness) status = 'harnessed';
      else if (exemption) status = overdue ? 'failed' : 'exempt';
      const entryErrors = [...compiled.errors];
      if (overdue) entryErrors.push(`exemption review overdue since ${exemption.review_by}`);
      entries.push({
        id: play,
        kind: 'solution-play',
        root: relative(absoluteRoot, resolve(playsRoot, play)).replaceAll('\\', '/'),
        status,
        profile: compiled.harness?.extends ?? null,
        sha256: compiled.harness?.sha256 ?? null,
        exemption: exemption ? { ...exemption, overdue } : null,
        errors: entryErrors,
        warnings: compiled.warnings
      });
      byKind['solution-play'].total += 1;
      if (status === 'harnessed') byKind['solution-play'].harnessed += 1;
      else if (status === 'exempt') byKind['solution-play'].exempt += 1;
      else byKind['solution-play'].failed += 1;
      warnings.push(...compiled.warnings.map((warning) => ({ id: play, warning })));
    }
  }

  const total = entries.length;
  const harnessed = entries.filter((entry) => entry.status === 'harnessed').length;
  const exempt = entries.filter((entry) => entry.status === 'exempt').length;
  const failed = entries.filter((entry) => !['harnessed', 'exempt'].includes(entry.status)).length;
  const systemErrors = errors.length;
  return {
    generatedAt: now.toISOString(),
    registry: relative(absoluteRoot, registryPath).replaceAll('\\', '/'),
    healthy: failed === 0 && systemErrors === 0,
    total,
    harnessed,
    exempt,
    failed,
    systemErrors,
    coverage: total === 0 ? 0 : Math.round((harnessed / total) * 1000) / 10,
    byKind,
    entries,
    errors,
    warnings
  };
}

export { buildPlatformHarnessReport, loadPlatformRegistry };
