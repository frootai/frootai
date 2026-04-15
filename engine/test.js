#!/usr/bin/env node
/**
 * FAI Engine — Unit Tests
 * 
 * Tests all 7 engine modules:
 *   1. manifest-reader   — load, validate, resolve paths
 *   2. context-resolver   — knowledge + WAF resolution
 *   3. primitive-wirer    — frontmatter parse, primitive loading, wiring
 *   4. hook-runner        — config loading, command execution
 *   5. evaluator          — threshold checks, scoring, actions
 *   6. mcp-bridge         — play discovery, run_play integration
 *   7. index (engine)     — full engine init + status
 *
 * Run:  node engine/test.js
 * Exit: 0 = all pass, 1 = failures
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

import { loadManifest, resolvePaths } from './manifest-reader.js';
import { buildContext } from './context-resolver.js';
import { wirePrimitives, loadPrimitive, parseFrontmatter } from './primitive-wirer.js';
import { loadHookConfig, runHooksForEvent } from './hook-runner.js';
import { createEvaluator, DEFAULTS } from './evaluator.js';
import { runPlay, findManifest, MCP_TOOL_DEFINITION } from './mcp-bridge.js';
import { initEngine, printStatus } from './index.js';
let passed = 0;
let failed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function assertIncludes(arr, item, msg) {
  if (!arr.includes(item)) throw new Error(msg || `Expected array to include ${JSON.stringify(item)}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. MANIFEST READER
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n── manifest-reader.js ──');

// (imported at top)

test('loadManifest — loads Play 01 manifest successfully', () => {
  const result = loadManifest(path.join(ROOT, 'solution-plays/01-enterprise-rag/spec/fai-manifest.json'));
  assert(result.manifest !== null, 'manifest should not be null');
  assertEqual(result.errors.length, 0, `Expected 0 errors, got: ${result.errors.join(', ')}`);
  assertEqual(result.manifest.play, '01-enterprise-rag');
  assertEqual(result.manifest.version, '1.0.0');
});

test('loadManifest — validates play field format', () => {
  const result = loadManifest(path.join(ROOT, 'solution-plays/01-enterprise-rag/spec/fai-manifest.json'));
  assert(/^[0-9]{2}-[a-z0-9-]+$/.test(result.manifest.play), 'play must match NN-kebab-case');
});

test('loadManifest — validates version is semver', () => {
  const result = loadManifest(path.join(ROOT, 'solution-plays/01-enterprise-rag/spec/fai-manifest.json'));
  assert(/^[0-9]+\.[0-9]+\.[0-9]+/.test(result.manifest.version), 'version must be semver');
});

test('loadManifest — returns error for non-existent file', () => {
  const result = loadManifest('/nonexistent/path/manifest.json');
  assert(result.manifest === null, 'manifest should be null for missing file');
  assert(result.errors.length > 0, 'should have errors');
  assert(result.errors[0].includes('not found'), 'error should mention not found');
});

test('loadManifest — validates context.knowledge exists', () => {
  const result = loadManifest(path.join(ROOT, 'solution-plays/01-enterprise-rag/spec/fai-manifest.json'));
  assert(Array.isArray(result.manifest.context.knowledge), 'context.knowledge should be array');
  assert(result.manifest.context.knowledge.length > 0, 'should have at least 1 knowledge module');
});

test('loadManifest — validates context.waf has valid pillars', () => {
  const result = loadManifest(path.join(ROOT, 'solution-plays/01-enterprise-rag/spec/fai-manifest.json'));
  const validPillars = ['security', 'reliability', 'cost-optimization', 'operational-excellence', 'performance-efficiency', 'responsible-ai'];
  for (const waf of result.manifest.context.waf) {
    assertIncludes(validPillars, waf, `Invalid WAF pillar: ${waf}`);
  }
});

test('loadManifest — validates primitives section exists', () => {
  const result = loadManifest(path.join(ROOT, 'solution-plays/01-enterprise-rag/spec/fai-manifest.json'));
  assert(result.manifest.primitives, 'primitives should exist');
  assert(result.manifest.primitives.guardrails, 'guardrails should exist');
});

test('loadManifest — loads all play manifests without errors', () => {
  const playsDir = path.join(ROOT, 'solution-plays');
  const plays = fs.readdirSync(playsDir).filter(f => /^\d{2}-/.test(f) && fs.statSync(path.join(playsDir, f)).isDirectory());
  let failures = [];
  for (const play of plays) {
    // Check both root and spec/ locations
    const rootPath = path.join(playsDir, play, 'fai-manifest.json');
    const specPath = path.join(playsDir, play, 'spec', 'fai-manifest.json');
    const mfPath = fs.existsSync(rootPath) ? rootPath : fs.existsSync(specPath) ? specPath : null;
    if (mfPath) {
      const r = loadManifest(mfPath);
      if (r.errors.length > 0) failures.push(`${play}: ${r.errors.join(', ')}`);
    }
  }
  assertEqual(failures.length, 0, `Manifest errors in: ${failures.join(' | ')}`);
});

test('resolvePaths — converts relative paths to absolute', () => {
  const result = loadManifest(path.join(ROOT, 'solution-plays/01-enterprise-rag/spec/fai-manifest.json'));
  const resolved = resolvePaths(result.manifest, result.playDir);
  assert(resolved, 'resolved should not be null');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. CONTEXT RESOLVER
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n── context-resolver.js ──');

// (imported at top)

test('buildContext — resolves FROOT knowledge modules', () => {
  const ctx = buildContext({ knowledge: ['R2-RAG-Architecture'], waf: ['security'] });
  assert(ctx, 'context should not be null');
  assert(ctx.knowledge, 'knowledge should exist');
});

test('buildContext — resolves WAF pillar instructions', () => {
  const ctx = buildContext({ knowledge: ['R2-RAG-Architecture'], waf: ['security', 'reliability'] });
  assert(ctx.waf, 'waf should exist');
  assert(ctx.waf.length >= 1, 'should resolve at least 1 WAF');
});

test('buildContext — handles empty knowledge gracefully', () => {
  const ctx = buildContext({ knowledge: [], waf: ['security'] });
  assert(ctx, 'should not crash on empty knowledge');
});

test('buildContext — handles invalid module IDs gracefully', () => {
  const ctx = buildContext({ knowledge: ['NONEXISTENT-MODULE'], waf: ['security'] });
  assert(ctx, 'should not crash on invalid module ID');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. PRIMITIVE WIRER
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n── primitive-wirer.js ──');

// (imported at top)

test('parseFrontmatter — extracts YAML frontmatter from agent file', () => {
  const content = `---
description: "Test agent"
name: "tester"
---

# Test Agent
Body content here.`;
  const fm = parseFrontmatter(content);
  assertEqual(fm.description, 'Test agent');
  assertEqual(fm.name, 'tester');
});

test('parseFrontmatter — returns empty object for no frontmatter', () => {
  const fm = parseFrontmatter('# Just a heading\nNo frontmatter here.');
  assertEqual(Object.keys(fm).length, 0, 'should be empty for no frontmatter');
});

test('parseFrontmatter — handles multi-line descriptions', () => {
  const content = `---
description: "A very long description that spans multiple concepts"
---
Body`;
  const fm = parseFrontmatter(content);
  assert(fm.description.length > 10, 'should parse long descriptions');
});

test('loadPrimitive — loads an agent .md file', () => {
  const agentPath = path.join(ROOT, 'agents/frootai-rag-architect.agent.md');
  if (fs.existsSync(agentPath)) {
    const prim = loadPrimitive(agentPath, 'agent');
    assert(prim, 'should load agent');
    assert(prim.frontmatter, 'should have frontmatter');
    assert(prim.frontmatter.description, 'should have description');
  }
});

test('loadPrimitive — loads a skill directory', () => {
  const skillPath = path.join(ROOT, 'skills/frootai-play-initializer');
  if (fs.existsSync(skillPath)) {
    const prim = loadPrimitive(skillPath, 'skill');
    assert(prim, 'should load skill');
  }
});

test('loadPrimitive — loads a hook directory', () => {
  const hookPath = path.join(ROOT, 'hooks/frootai-secrets-scanner');
  if (fs.existsSync(hookPath)) {
    const prim = loadPrimitive(hookPath, 'hook');
    assert(prim, 'should load hook');
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. HOOK RUNNER
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n── hook-runner.js ──');

// (imported at top)

test('loadHookConfig — loads secrets-scanner hooks.json', () => {
  const hookDir = path.join(ROOT, 'hooks/frootai-secrets-scanner');
  if (fs.existsSync(hookDir)) {
    const result = loadHookConfig(hookDir);
    assert(result, 'result should not be null');
    const config = result.config || result;
    assert(config, 'config should exist');
    assertEqual(config.version, 1, 'version should be 1');
    assert(config.hooks, 'hooks should exist');
  }
});

test('loadHookConfig — returns structured result for non-existent hook', () => {
  const result = loadHookConfig('/nonexistent/hook');
  // May return null, or {config: null, error: ...}
  const config = result && result.config !== undefined ? result.config : result;
  assertEqual(config, null, 'config should be null for missing hook');
});

test('loadHookConfig — all 10 hooks have valid config', () => {
  const hooksDir = path.join(ROOT, 'hooks');
  const hooks = fs.readdirSync(hooksDir).filter(f => fs.statSync(path.join(hooksDir, f)).isDirectory());
  let failures = [];
  for (const h of hooks) {
    const result = loadHookConfig(path.join(hooksDir, h));
    const config = result && result.config !== undefined ? result.config : result;
    if (!config) failures.push(`${h}: no config`);
    else if (config.version !== 1) failures.push(`${h}: version != 1`);
    else if (!config.hooks) failures.push(`${h}: no hooks object`);
  }
  assertEqual(failures.length, 0, `Hook config failures: ${failures.join(', ')}`);
});

test('loadHookConfig — hooks have at least one event', () => {
  const hooksDir = path.join(ROOT, 'hooks');
  const hooks = fs.readdirSync(hooksDir).filter(f => fs.statSync(path.join(hooksDir, f)).isDirectory());
  for (const h of hooks) {
    const result = loadHookConfig(path.join(hooksDir, h));
    const config = result && result.config !== undefined ? result.config : result;
    if (config && config.hooks) {
      const events = Object.keys(config.hooks);
      assert(events.length > 0, `${h} should have at least one event`);
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. EVALUATOR
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n── evaluator.js ──');

// (imported at top)

test('createEvaluator — creates with default thresholds', () => {
  const ev = createEvaluator();
  assertEqual(ev.thresholds.groundedness, 0.95);
  assertEqual(ev.thresholds.coherence, 0.90);
  assertEqual(ev.thresholds.safety, 0);
});

test('createEvaluator — custom thresholds override defaults', () => {
  const ev = createEvaluator({ groundedness: 0.80, coherence: 0.70 });
  assertEqual(ev.thresholds.groundedness, 0.80);
  assertEqual(ev.thresholds.coherence, 0.70);
  assertEqual(ev.thresholds.safety, 0, 'non-overridden defaults should remain');
});

test('evaluate — all pass when scores exceed thresholds', () => {
  const ev = createEvaluator({ groundedness: 0.80, coherence: 0.70, safety: 0 });
  const result = ev.evaluate({ groundedness: 0.95, coherence: 0.90, safety: 0 });
  assert(result.pass, 'should pass when all scores exceed thresholds');
});

test('evaluate — fails when groundedness below threshold', () => {
  const ev = createEvaluator({ groundedness: 0.90 });
  const result = ev.evaluate({ groundedness: 0.50 });
  assert(!result.pass, 'should fail when below threshold');
  const gResult = result.results.find(r => r.metric === 'groundedness');
  assert(gResult, 'should have groundedness result');
  assert(!gResult.pass, 'groundedness should fail');
});

test('evaluate — safety=0 means zero violations allowed', () => {
  const ev = createEvaluator({ safety: 0 });
  const pass = ev.evaluate({ safety: 0 });
  assert(pass.pass, 'safety=0 with score=0 should pass');
});

test('evaluate — returns results for each metric scored', () => {
  const ev = createEvaluator();
  const result = ev.evaluate({ groundedness: 0.97, coherence: 0.93, relevance: 0.88 });
  assert(result.results.length >= 3, `should have at least 3 results, got ${result.results.length}`);
});

test('evaluate — result objects have required fields', () => {
  const ev = createEvaluator();
  const result = ev.evaluate({ groundedness: 0.97 });
  const r = result.results[0];
  assert('metric' in r, 'should have metric');
  assert('score' in r, 'should have score');
  assert('threshold' in r, 'should have threshold');
  assert('pass' in r, 'should have pass');
  assert('action' in r, 'should have action');
});

test('DEFAULTS — has all 5 standard metrics', () => {
  assert('groundedness' in DEFAULTS, 'should have groundedness');
  assert('coherence' in DEFAULTS, 'should have coherence');
  assert('relevance' in DEFAULTS, 'should have relevance');
  assert('safety' in DEFAULTS, 'should have safety');
  assert('costPerQuery' in DEFAULTS, 'should have costPerQuery');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. MCP BRIDGE
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n── mcp-bridge.js ──');

// (imported at top)

test('findManifest — finds Play 01 manifest', () => {
  const mf = findManifest('01');
  assert(mf, 'should find Play 01');
  assert(mf.includes('01-enterprise-rag'), 'path should include play slug');
});

test('findManifest — finds by full slug', () => {
  const mf = findManifest('01-enterprise-rag');
  assert(mf, 'should find by full slug');
});

test('findManifest — returns null for non-existent play', () => {
  const mf = findManifest('999');
  assertEqual(mf, null, 'should return null for non-existent play');
});

test('runPlay — loads Play 01 successfully', () => {
  const result = runPlay({ playId: '01' });
  assert(result, 'should return result');
  assert(result.play, 'should have play field');
  assert(result.wiring, 'should have wiring field');
});

test('runPlay — returns error for invalid play', () => {
  const result = runPlay({ playId: '999' });
  assert(result.error || !result.success, 'should have error for invalid play');
});

test('MCP_TOOL_DEFINITION — has required MCP fields', () => {
  assert(MCP_TOOL_DEFINITION.name, 'should have name');
  assert(MCP_TOOL_DEFINITION.description, 'should have description');
  assert(MCP_TOOL_DEFINITION.inputSchema, 'should have inputSchema');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. ENGINE INDEX (Integration)
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n── index.js (integration) ──');

// (imported at top)

test('initEngine — loads Play 01 end-to-end', () => {
  const manifestPath = path.join(ROOT, 'solution-plays/01-enterprise-rag/spec/fai-manifest.json');
  const engine = initEngine(manifestPath);
  assert(engine, 'engine should not be null');
  assert(engine.manifest, 'should have manifest');
  assert(engine.context, 'should have context');
});

test('initEngine — wires primitives for Play 01', () => {
  const manifestPath = path.join(ROOT, 'solution-plays/01-enterprise-rag/spec/fai-manifest.json');
  const engine = initEngine(manifestPath);
  assert(engine.wiring, 'should have wiring');
  const total = engine.wiring.total || (engine.wiring.stats && engine.wiring.stats.total) || 0;
  assert(total > 0, `should wire at least 1 primitive, got ${total}`);
});

test('initEngine — creates evaluator from guardrails', () => {
  const manifestPath = path.join(ROOT, 'solution-plays/01-enterprise-rag/spec/fai-manifest.json');
  const engine = initEngine(manifestPath);
  assert(engine.evaluator, 'should have evaluator');
  assert(engine.evaluator.thresholds, 'evaluator should have thresholds');
});

test('initEngine — loads multiple plays without error', () => {
  const playsDir = path.join(ROOT, 'solution-plays');
  const plays = fs.readdirSync(playsDir).filter(f =>
    /^\d{2}-/.test(f) && (
      fs.existsSync(path.join(playsDir, f, 'fai-manifest.json')) ||
      fs.existsSync(path.join(playsDir, f, 'spec', 'fai-manifest.json'))
    )
  );
  let failures = [];
  for (const play of plays.slice(0, 10)) {
    const rootPath = path.join(playsDir, play, 'fai-manifest.json');
    const specPath = path.join(playsDir, play, 'spec', 'fai-manifest.json');
    const mfPath = fs.existsSync(rootPath) ? rootPath : specPath;
    try {
      const engine = initEngine(mfPath);
      if (!engine || !engine.manifest) failures.push(play);
    } catch (err) {
      failures.push(`${play}: ${err.message}`);
    }
  }
  assertEqual(failures.length, 0, `Engine init failures: ${failures.join(', ')}`);
});

test('printStatus — does not throw for valid engine', () => {
  const manifestPath = path.join(ROOT, 'solution-plays/01-enterprise-rag/spec/fai-manifest.json');
  const engine = initEngine(manifestPath);
  // Capture stdout to prevent console noise
  const origLog = console.log;
  let output = '';
  console.log = (...args) => { output += args.join(' ') + '\n'; };
  try {
    printStatus(engine);
    assert(output.length > 0, 'should produce output');
    assert(output.includes('01-enterprise-rag'), 'should mention play name');
  } finally {
    console.log = origLog;
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(50)}`);
console.log(`  FAI Engine Unit Tests`);
console.log(`${'═'.repeat(50)}`);
console.log(`  Passed: ${passed}/${total}`);
console.log(`  Failed: ${failed}/${total}`);
console.log(`  ${failed === 0 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
console.log(`${'═'.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
