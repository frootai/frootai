/**
 * L0 Test 04 — Knowledge IDs
 *
 * Goal: Every entry in `context.knowledge` matches a known FROOT module ID
 * from spec §4.1, or uses the `X*` custom-prefix escape hatch.
 *
 * Why: the engine resolves these IDs to actual knowledge content. Unknown IDs
 * surface as silent gaps in agent context — they're harmless until they're not.
 * This test catches typos and stale references early.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const EXAMPLES_DIR = path.join(__dirname, '..', 'fai-protocol', 'examples');

// FROOT modules from spec §4.1
const FROOT_MODULES = new Set([
  // Foundations
  'F1-GenAI-Foundations', 'F2-LLMs', 'F3-Glossary', 'F4-Agentic-OS',
  // Reasoning
  'R1-Prompts', 'R2-RAG-Architecture', 'R3-Deterministic-AI',
  // Orchestration
  'O1-Semantic-Kernel', 'O2-Agents', 'O3-MCP-Tools',
  'O4-Azure-AI-Services', 'O5-Infrastructure', 'O6-Copilot',
  // Transformation
  'T1-Fine-Tuning', 'T2-Responsible-AI', 'T3-Production-Patterns',
]);

const CUSTOM_PREFIX = /^X[0-9]+-/;

function checkId(id) {
  if (typeof id !== 'string') return `not a string: ${JSON.stringify(id)}`;
  if (FROOT_MODULES.has(id)) return null;
  if (CUSTOM_PREFIX.test(id)) return null; // custom X-prefix allowed
  return `unknown knowledge module ID: "${id}" (not in FROOT taxonomy and not X-prefixed)`;
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
  const knowledge = (m.context && Array.isArray(m.context.knowledge)) ? m.context.knowledge : [];
  if (knowledge.length === 0) {
    console.error(`❌ FAIL  ${file} — context.knowledge missing or empty`);
    failed++;
    continue;
  }
  const errors = knowledge.map((id, idx) => {
    const e = checkId(id);
    return e ? `context.knowledge[${idx}]: ${e}` : null;
  }).filter(Boolean);
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
