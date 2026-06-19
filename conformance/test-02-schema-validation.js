/**
 * L0 Test 02 — Schema Validation
 *
 * Goal: Every example manifest validates against schemas/fai-manifest.schema.json.
 *
 * Strategy: structural validation only (no ajv dependency assumed at this layer).
 * We check the contract documented in the spec §3.1 — required fields present,
 * types correct, patterns match. A full JSON-Schema validator (ajv) is used in
 * the CI workflow validate-marketplace-schema.yml; this conformance test stays
 * dependency-free so any implementation can run it.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const EXAMPLES_DIR = path.join(__dirname, '..', 'fai-protocol', 'examples');

// Patterns from fai-manifest.schema.json
const PLAY_PATTERN = /^[0-9]{2}-[a-z0-9-]+$/;
const SEMVER_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+(-[a-z0-9.]+)?$/;
const VALID_WAF = new Set([
  'security',
  'reliability',
  'cost-optimization',
  'operational-excellence',
  'performance-efficiency',
  'responsible-ai',
]);

function validateManifest(file, m) {
  const errors = [];

  if (typeof m !== 'object' || m === null) return ['root must be an object'];

  // Required top-level fields
  for (const field of ['play', 'version', 'context', 'primitives']) {
    if (!(field in m)) errors.push(`missing required field: ${field}`);
  }

  if (typeof m.play === 'string' && !PLAY_PATTERN.test(m.play)) {
    errors.push(`play "${m.play}" does not match ^[0-9]{2}-[a-z0-9-]+$`);
  }

  if (typeof m.version === 'string' && !SEMVER_PATTERN.test(m.version)) {
    errors.push(`version "${m.version}" is not semver`);
  }

  if (typeof m.context === 'object' && m.context !== null) {
    if (!Array.isArray(m.context.knowledge) || m.context.knowledge.length < 1) {
      errors.push('context.knowledge must be a non-empty array');
    }
    if (!Array.isArray(m.context.waf) || m.context.waf.length < 1) {
      errors.push('context.waf must be a non-empty array');
    } else {
      for (const w of m.context.waf) {
        if (!VALID_WAF.has(w)) errors.push(`context.waf contains invalid pillar: "${w}"`);
      }
    }
  }

  if (typeof m.primitives === 'object' && m.primitives !== null) {
    const hasAny = ['agents', 'instructions', 'skills', 'hooks', 'workflows', 'guardrails']
      .some((k) => k in m.primitives);
    if (!hasAny) errors.push('primitives must declare at least one primitive type');
  }

  return errors;
}

const files = fs.readdirSync(EXAMPLES_DIR)
  .filter((f) => f.endsWith('.fai-manifest.json'))
  .sort();

let passed = 0, failed = 0;

for (const file of files) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(EXAMPLES_DIR, file), 'utf8'));
  } catch (err) {
    console.error(`❌ FAIL  ${file} — parse error: ${err.message}`);
    failed++;
    continue;
  }
  const errors = validateManifest(file, manifest);
  if (errors.length === 0) {
    console.log(`✅ PASS  ${file}`);
    passed++;
  } else {
    console.error(`❌ FAIL  ${file}`);
    errors.forEach((e) => console.error(`         - ${e}`));
    failed++;
  }
}

console.log(`   ${passed} passed, ${failed} failed of ${files.length}`);

if (failed > 0) process.exitCode = 1;
