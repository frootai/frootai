/**
 * FAI Engine - Generic Harness Subjects
 * Attaches the shared harness profile engine to an agent, product, or platform
 * root without treating that subject as a Solution Play.
 */

import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { compileManifestData, DEFAULT_PROFILES_ROOT } from './harness-resolver.js';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const subjectSchema = JSON.parse(readFileSync(resolve(repositoryRoot, 'schemas', 'fai-harness-subject.schema.json'), 'utf8'));
let subjectValidator;

function within(root, target) {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function validator() {
  if (subjectValidator) return subjectValidator;
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  subjectValidator = ajv.compile(subjectSchema);
  return subjectValidator;
}

function schemaErrors(validate) {
  return (validate.errors || []).map((error) => {
    const at = error.instancePath || '/';
    return `subject descriptor ${at} ${error.message}`;
  });
}

function loadHarnessSubject(descriptorPath) {
  const absolute = resolve(descriptorPath);
  if (!existsSync(absolute)) return { descriptor: null, descriptorPath: absolute, errors: [`subject descriptor not found: ${absolute}`] };
  let descriptor;
  try {
    descriptor = JSON.parse(readFileSync(absolute, 'utf8'));
  } catch (error) {
    return { descriptor: null, descriptorPath: absolute, errors: [`subject descriptor is not valid JSON: ${error.message}`] };
  }
  const validate = validator();
  return { descriptor, descriptorPath: absolute, errors: validate(descriptor) ? [] : schemaErrors(validate) };
}

/**
 * Compile one generic harness subject through the shared profile engine.
 * @param {string} descriptorPath
 * @param {{ repoRoot?: string, defaultProfile?: string, profilesRoot?: string, now?: Date }} [options]
 */
function compileHarnessSubject(descriptorPath, options = {}) {
  const loaded = loadHarnessSubject(descriptorPath);
  if (!loaded.descriptor) return { ...loaded, subjectDir: null, effective: null, harness: null, warnings: [] };

  const repoRoot = resolve(options.repoRoot ?? resolve(options.profilesRoot ?? DEFAULT_PROFILES_ROOT, '..', '..'));
  const profilesRoot = resolve(options.profilesRoot ?? DEFAULT_PROFILES_ROOT);
  const { descriptor } = loaded;
  const errors = [...loaded.errors];
  const profile = descriptor.extends ?? options.defaultProfile;
  if (!profile) errors.push(`subject ${descriptor.subject} has no extends profile and no ${descriptor.kind} platform default`);

  const subjectDir = resolve(repoRoot, descriptor.root);
  if (!within(repoRoot, subjectDir)) errors.push(`subject ${descriptor.subject} root escapes the repository`);
  else if (!existsSync(subjectDir)) errors.push(`subject ${descriptor.subject} root does not exist: ${descriptor.root}`);
  else if (lstatSync(subjectDir).isSymbolicLink()) errors.push(`subject ${descriptor.subject} root is a symbolic link`);

  if (errors.length > 0 || !profile) {
    return { descriptor, descriptorPath: loaded.descriptorPath, subjectDir, effective: null, harness: null, errors, warnings: [] };
  }

  // compileManifestData is the compatibility adapter into the proven profile,
  // guardrail, waiver, provenance, and required-artifact engine. The synthetic
  // play identity never escapes this function.
  const compatibilityManifest = {
    play: `999-${descriptor.subject}`,
    version: descriptor.version,
    extends: profile,
    ...(descriptor.waivers && { waivers: descriptor.waivers }),
    context: descriptor.context,
    primitives: descriptor.primitives ?? {}
  };
  const compiled = compileManifestData(
    compatibilityManifest,
    resolve(subjectDir, 'fai-harness-subject.json'),
    { profilesRoot, ...(options.now && { now: options.now }) }
  );
  errors.push(...compiled.errors.map((error) => error.replace(' in the play', ` in subject ${descriptor.subject}`)));

  const descriptorRequires = [];
  for (const requiredPath of descriptor.requires?.paths || []) {
    const absolute = resolve(subjectDir, requiredPath);
    descriptorRequires.push({ path: requiredPath, profile: `subject:${descriptor.subject}` });
    if (!within(subjectDir, absolute) || !existsSync(absolute)) {
      errors.push(`subject ${descriptor.subject} requires ${requiredPath}`);
    }
  }

  const effective = compiled.manifest ? {
    ...descriptor,
    extends: profile,
    context: compiled.manifest.context,
    primitives: compiled.manifest.primitives
  } : null;
  const harness = compiled.harness ? {
    ...compiled.harness,
    requires: [...compiled.harness.requires, ...descriptorRequires.filter((candidate) => !compiled.harness.requires.some((item) => item.path === candidate.path))]
  } : null;
  if (harness) {
    const { sha256: compatibilityHash, ...harnessForHash } = harness;
    harness.sha256 = createHash('sha256').update(canonicalJson({ subject: effective, harness: harnessForHash })).digest('hex');
  }

  return {
    descriptor,
    descriptorPath: loaded.descriptorPath,
    subjectDir,
    effective,
    harness,
    errors: [...new Set(errors)],
    warnings: compiled.warnings
  };
}

export { compileHarnessSubject, loadHarnessSubject };
