/**
 * L0 Test 05 — Guardrail Ranges
 *
 * Goal: When `primitives.guardrails` is declared, all values fall in their
 * declared ranges per spec §3.4:
 *   - groundedness, coherence, relevance: number in [0, 1]
 *   - safety: integer == 0 (MUST be 0 for production)
 *   - costPerQuery: number >= 0 (USD)
 *
 * Examples WITHOUT guardrails pass trivially — guardrails are optional.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const EXAMPLES_DIR = path.join(__dirname, '..', 'fai-protocol', 'examples');

function inRange(n, min, max) {
  return typeof n === 'number' && n >= min && n <= max;
}

function validateGuardrails(g) {
  const errors = [];
  if (typeof g !== 'object' || g === null) return ['guardrails must be an object'];
  if ('groundedness' in g && !inRange(g.groundedness, 0, 1)) {
    errors.push(`groundedness ${g.groundedness} is not in [0, 1]`);
  }
  if ('coherence' in g && !inRange(g.coherence, 0, 1)) {
    errors.push(`coherence ${g.coherence} is not in [0, 1]`);
  }
  if ('relevance' in g && !inRange(g.relevance, 0, 1)) {
    errors.push(`relevance ${g.relevance} is not in [0, 1]`);
  }
  if ('safety' in g && !(Number.isInteger(g.safety) && g.safety === 0)) {
    errors.push(`safety ${g.safety} must be integer 0 (production requirement)`);
  }
  if ('costPerQuery' in g && !(typeof g.costPerQuery === 'number' && g.costPerQuery >= 0)) {
    errors.push(`costPerQuery ${g.costPerQuery} must be a non-negative number (USD)`);
  }
  return errors;
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
  const guardrails = m.primitives && m.primitives.guardrails;
  if (!guardrails) {
    console.log(`✅ PASS  ${file} (no guardrails declared — optional)`);
    passed++;
    continue;
  }
  const errors = validateGuardrails(guardrails);
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
