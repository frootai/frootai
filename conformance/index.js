#!/usr/bin/env node
/**
 * FAI Conformance — L0 runner
 *
 * Executes the 5 L0 tests in order. Exits non-zero on any failure.
 * Used by `npm run test:conformance` from the repo root.
 *
 * Suite version: conformance-v0.9-rc1
 * Tracker: P0.2.010
 */

'use strict';

const path = require('path');
const fs = require('fs');

const SUITE_VERSION = 'conformance-v0.9-rc1';

const tests = [
  'test-01-manifest-parse.js',
  'test-02-schema-validation.js',
  'test-03-path-syntax.js',
  'test-04-knowledge-ids.js',
  'test-05-guardrail-ranges.js',
];

console.log(`\n┌──────────────────────────────────────────────────────────┐`);
console.log(`│   FAI Protocol Conformance Suite — Level 0               │`);
console.log(`│   Version: ${SUITE_VERSION.padEnd(46)}│`);
console.log(`└──────────────────────────────────────────────────────────┘\n`);

let failed = 0;
const start = Date.now();

for (const testFile of tests) {
  const testPath = path.join(__dirname, testFile);
  if (!fs.existsSync(testPath)) {
    console.error(`❌ MISSING TEST FILE: ${testFile}`);
    failed++;
    continue;
  }
  console.log(`── Running ${testFile} ${'─'.repeat(Math.max(0, 50 - testFile.length))}`);
  try {
    require(testPath);
    console.log('');
  } catch (err) {
    console.error(`\n❌ ${testFile} threw:`, err.message);
    failed++;
  }
}

const elapsed = ((Date.now() - start) / 1000).toFixed(2);

console.log(`\n────────────────────────────────────────────────────────────`);
if (failed === 0) {
  console.log(`✅ All ${tests.length} L0 conformance tests passed (${elapsed}s).`);
  console.log(`   This runtime conforms to FAI Protocol v0.9-rc1, L0.`);
  process.exit(0);
} else {
  console.log(`❌ ${failed} of ${tests.length} L0 tests failed (${elapsed}s).`);
  console.log(`   This runtime does NOT conform to FAI Protocol v0.9-rc1, L0.`);
  process.exit(1);
}
