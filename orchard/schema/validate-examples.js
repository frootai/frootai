#!/usr/bin/env node
/**
 * fai-accelerator.example.json — schema validation smoke test
 *
 * Validates every example in fai-accelerator.example.json against
 * fai-accelerator.schema.json (JSON Schema 2020-12).
 *
 * Phase: [A0.3] scaffold. The proper Python + TypeScript reference validators
 *        with full test suites land in [A0.5] and [A0.6]. This script remains
 *        as the lightweight contract check the README points to.
 *
 * Run from frootai/ directory:
 *   node orchard/schema/validate-examples.js
 *
 * Exit code: 0 if all examples pass, 1 if any fail.
 *
 * Requires: ajv (already a dependency of frootai/).
 *           ajv-formats (optional; enables 'uri' + 'date-time' format checks).
 */

const Ajv = require('ajv/dist/2020').default;
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const SCHEMA_PATH = path.join(HERE, 'fai-accelerator.schema.json');
const EXAMPLES_PATH = path.join(HERE, 'fai-accelerator.example.json');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const schema = loadJson(SCHEMA_PATH);
const examples = loadJson(EXAMPLES_PATH);

if (!Array.isArray(examples)) {
  console.error('FAIL: fai-accelerator.example.json must be a JSON array of example manifests.');
  process.exit(1);
}

const ajv = new Ajv({ strict: false, allErrors: true });
let hasFormats = false;
try {
  const addFormats = require('ajv-formats');
  addFormats(ajv);
  hasFormats = true;
} catch (e) {
  // ajv-formats is optional; uri/date-time become no-ops when absent.
}

let validate;
try {
  validate = ajv.compile(schema);
} catch (e) {
  console.error('FAIL: schema did not compile:', e.message);
  process.exit(1);
}

console.log('=== fai-accelerator examples — schema smoke test ===');
console.log(`Schema  : ${SCHEMA_PATH}`);
console.log(`Examples: ${EXAMPLES_PATH}`);
console.log(`Formats : ${hasFormats ? 'ajv-formats loaded (uri + date-time enforced)' : 'no ajv-formats (format keywords are no-ops)'}`);
console.log(`Count   : ${examples.length}`);
console.log('---');

let pass = 0;
let fail = 0;

examples.forEach((ex, i) => {
  const ok = validate(ex);
  const label = `[${i + 1}/${examples.length}] ${ex.id || '(missing id)'} — origin=${ex.origin || 'MISSING'} variety=${ex.variety || 'MISSING'}`;
  if (ok) {
    console.log(`PASS ${label}`);
    pass++;
  } else {
    console.log(`FAIL ${label}`);
    for (const err of validate.errors || []) {
      console.log(`     ${err.instancePath || '<root>'}  ${err.keyword}  ${err.message}`);
      if (err.params) console.log(`         params: ${JSON.stringify(err.params)}`);
    }
    fail++;
  }
});

console.log('---');
console.log(`Summary: ${pass} pass, ${fail} fail`);

process.exit(fail === 0 ? 0 : 1);
