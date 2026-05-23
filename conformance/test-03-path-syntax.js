/**
 * L0 Test 03 — Path Syntax
 *
 * Goal: All primitive paths in declared manifests use the resolution rules
 * from spec §5.1 — paths start with `./` (play-local) or `../../` (catalog).
 *
 * What this test does NOT check:
 *  - whether the target file actually exists (that's L2 — resolver)
 *  - whether the path traverses outside the repo (that's a security check, L1+)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const EXAMPLES_DIR = path.join(__dirname, '..', 'fai-protocol', 'examples');

const VALID_PREFIXES = ['./', '../../'];
const PRIMITIVE_KEYS = ['agents', 'instructions', 'skills', 'hooks', 'workflows'];

function checkPath(p) {
  if (typeof p !== 'string') return `not a string: ${JSON.stringify(p)}`;
  if (p.length === 0) return 'empty path';
  if (!VALID_PREFIXES.some((prefix) => p.startsWith(prefix))) {
    return `path "${p}" does not start with "./" or "../../"`;
  }
  return null;
}

const files = fs.readdirSync(EXAMPLES_DIR)
  .filter((f) => f.endsWith('.fai-manifest.json'))
  .sort();

let passed = 0, failed = 0;

for (const file of files) {
  let m;
  try {
    m = JSON.parse(fs.readFileSync(path.join(EXAMPLES_DIR, file), 'utf8'));
  } catch (err) {
    console.error(`❌ FAIL  ${file} — parse error`);
    failed++;
    continue;
  }
  const errors = [];
  if (m.primitives) {
    for (const key of PRIMITIVE_KEYS) {
      const arr = m.primitives[key];
      if (!Array.isArray(arr)) continue;
      arr.forEach((p, idx) => {
        const err = checkPath(p);
        if (err) errors.push(`primitives.${key}[${idx}]: ${err}`);
      });
    }
  }
  if (m.infrastructure) {
    for (const [key, val] of Object.entries(m.infrastructure)) {
      const err = checkPath(val);
      if (err) errors.push(`infrastructure.${key}: ${err}`);
    }
  }
  if (m.toolkit) {
    for (const [key, val] of Object.entries(m.toolkit)) {
      const err = checkPath(val);
      if (err) errors.push(`toolkit.${key}: ${err}`);
    }
  }
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
