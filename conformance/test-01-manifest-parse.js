/**
 * L0 Test 01 — Manifest Parse
 *
 * Goal: Every example manifest in fai-protocol/examples/ parses as valid JSON.
 *
 * Fails: file not found, JSON.parse error, file empty.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const EXAMPLES_DIR = path.join(__dirname, '..', 'fai-protocol', 'examples');

function discoverExamples() {
  return fs.readdirSync(EXAMPLES_DIR)
    .filter((f) => f.endsWith('.fai-manifest.json'))
    .sort();
}

const examples = discoverExamples();
if (examples.length === 0) {
  console.error('❌ FAIL  No example manifests found in', EXAMPLES_DIR);
  process.exit(1);
}

let passed = 0;
let failed = 0;

for (const file of examples) {
  const fullPath = path.join(EXAMPLES_DIR, file);
  try {
    const raw = fs.readFileSync(fullPath, 'utf8');
    if (!raw.trim()) {
      console.error(`❌ FAIL  ${file} — file is empty`);
      failed++;
      continue;
    }
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      console.error(`❌ FAIL  ${file} — parsed root is not an object`);
      failed++;
      continue;
    }
    console.log(`✅ PASS  ${file}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL  ${file} — ${err.message}`);
    failed++;
  }
}

console.log(`   ${passed} passed, ${failed} failed of ${examples.length}`);

if (failed > 0) process.exitCode = 1;
