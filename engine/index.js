#!/usr/bin/env node
/**
 * FAI Engine v0.1
 * ===============
 * The runtime that reads fai-manifest.json and orchestrates the FAI Protocol.
 *
 * This is the engine that makes the FAI Layer real — it resolves context,
 * wires primitives, runs hooks, and evaluates quality. Any implementation
 * that reads the FAI Protocol manifest is a FAI Engine.
 *
 * Usage:
 *   node engine/index.js <path-to-fai-manifest.json>           # Load + validate
 *   node engine/index.js <path-to-fai-manifest.json> --status  # Show wiring status
 *   node engine/index.js <path-to-fai-manifest.json> --eval    # Run evaluation check
 *
 * This v0.1 focuses on: manifest loading, context resolution, primitive wiring,
 * and evaluation. Full runtime execution (hook running, agent dispatch) comes in v0.2.
 */

import { loadManifest, resolvePaths } from './manifest-reader.js';
import { buildContext } from './context-resolver.js';
import { wirePrimitives } from './primitive-wirer.js';
import { createEvaluator } from './evaluator.js';
import { runHooksForEvent } from './hook-runner.js';
import { createRequire } from 'module';

// Moonshot uses CommonJS — bridge via createRequire
const _require = createRequire(import.meta.url);
const moonshot = _require('./moonshot/index.js');

/**
 * Initialize the FAI Engine with a manifest file.
 * @param {string} manifestPath - Path to fai-manifest.json
 * @returns {object} Engine instance with all components loaded
 */
function initEngine(manifestPath) {
  const startTime = Date.now();
  const allErrors = [];

  // Step 1: Load and validate manifest
  const { manifest, playDir, errors: loadErrors } = loadManifest(manifestPath);
  allErrors.push(...loadErrors);

  if (!manifest) {
    return {
      success: false,
      errors: allErrors,
      duration: Date.now() - startTime
    };
  }

  // Step 2: Resolve file paths
  const { resolved, missing } = resolvePaths(manifest, playDir);
  if (missing.length > 0) {
    allErrors.push(...missing.map(m => `Missing: ${m}`));
  }

  // Step 3: Build shared context
  const context = buildContext(manifest.context);
  allErrors.push(...context.errors);

  // Step 4: Wire primitives
  const wiring = wirePrimitives(resolved, context);
  allErrors.push(...wiring.errors);

  // Step 5: Create evaluator
  const guardrails = manifest.primitives?.guardrails || {};
  const evaluator = createEvaluator(guardrails);

  // Step 6: Initialize moonshot contracts (v2.0 — optional, backwards-compatible)
  let moonshotSuite = null;
  const moonshotContracts = ['memory','observability','cost','identity','compliance','providers','modalities','prompts','evaluation','privacy'];
  const hasAnyContract = moonshotContracts.some(k => manifest[k]);
  if (hasAnyContract) {
    try {
      moonshotSuite = moonshot.createMoonshotSuite(manifest, { playId: manifest.play });
    } catch (err) {
      allErrors.push(`Moonshot suite error: ${err.message}`);
    }
  }

  return {
    success: allErrors.length === 0,
    manifest,
    playDir,
    context: {
      scope: context.scope,
      knowledgeCount: context.knowledge.length,
      wafCount: context.waf.length,
      modules: context.knowledge.map(m => m.id)
    },
    wiring: {
      stats: wiring.stats,
      primitives: wiring.primitives
    },
    evaluator,
    moonshot: moonshotSuite,
    hookPaths: resolved.hooks,
    errors: allErrors,
    duration: Date.now() - startTime
  };
}

/**
 * Print engine status to console.
 */
function printStatus(engine) {
  console.log('');
  console.log('🍊 FAI Engine v0.1');
  console.log('═'.repeat(50));

  if (!engine.manifest) {
    console.log('❌ Failed to load manifest');
    engine.errors.forEach(e => console.log(`  • ${e}`));
    return;
  }

  console.log(`  Play:      ${engine.manifest.play} v${engine.manifest.version}`);
  console.log(`  Scope:     ${engine.context.scope}`);
  console.log(`  Knowledge: ${engine.context.knowledgeCount} FROOT modules`);
  console.log(`  WAF:       ${engine.context.wafCount} pillars enforced`);
  console.log('');

  // Wiring stats
  const s = engine.wiring.stats;
  console.log('  Primitives Wired:');
  console.log(`    Agents:       ${s.agents}`);
  console.log(`    Instructions: ${s.instructions}`);
  console.log(`    Skills:       ${s.skills}`);
  console.log(`    Hooks:        ${s.hooks}`);
  console.log(`    Workflows:    ${s.workflows}`);
  console.log(`    Total:        ${s.total}`);
  console.log('');

  // Guardrails
  const t = engine.evaluator.thresholds;
  console.log('  Quality Gates:');
  console.log(`    Groundedness: ≥ ${(t.groundedness * 100).toFixed(0)}%`);
  console.log(`    Coherence:    ≥ ${(t.coherence * 100).toFixed(0)}%`);
  console.log(`    Relevance:    ≥ ${(t.relevance * 100).toFixed(0)}%`);
  console.log(`    Safety:       ${t.safety} violations max`);
  console.log(`    Cost:         ≤ $${t.costPerQuery}/query`);
  console.log('');

  // Status
  if (engine.errors.length > 0) {
    console.log(`  ⚠️  ${engine.errors.length} issue(s):`);
    engine.errors.forEach(e => console.log(`    • ${e}`));
  } else {
    console.log('  ✅ All primitives wired, context resolved, guardrails set');
  }

  // Moonshot contracts (v2.0)
  if (engine.moonshot) {
    const active = engine.moonshot._initialized || [];
    console.log('');
    console.log(`  🚀 Moonshot Contracts (v2.0): ${active.length} active`);
    active.forEach(m => console.log(`    ✓ ${m}`));
    const preCheck = engine.moonshot.preDeploymentCheck();
    const checkCount = Object.keys(preCheck.checks).length;
    if (checkCount > 0) {
      const passed = Object.values(preCheck.checks).filter(c => c.ok !== false).length;
      console.log(`    Pre-deployment: ${passed}/${checkCount} checks passed`);
    }
  }

  console.log('');
  console.log(`  Engine loaded in ${engine.duration}ms`);
  console.log('═'.repeat(50));
}

// ─── CLI Entry Point ──────────────────────────────────

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\\\/g, '/'))) {
  const args = process.argv.slice(2);
  const manifestPath = args.find(a => !a.startsWith('-'));
  const showStatus = args.includes('--status') || !args.find(a => a.startsWith('--'));
  const runEval = args.includes('--eval');

  if (!manifestPath) {
    console.log('🍊 FAI Engine v0.1');
    console.log('');
    console.log('Usage:');
    console.log('  node engine/index.js <path-to-fai-manifest.json>');
    console.log('  node engine/index.js <path> --status   Show wiring status');
    console.log('  node engine/index.js <path> --eval     Run evaluation check');
    console.log('');
    console.log('The FAI Engine reads fai-manifest.json and orchestrates the FAI Protocol.');
    console.log('It resolves context, wires primitives, runs hooks, and evaluates quality.');
    process.exit(0);
  }

  const engine = initEngine(manifestPath);

  if (showStatus) {
    printStatus(engine);
  }

  if (runEval) {
    // Demo evaluation with sample scores
    console.log('');
    const sampleScores = {
      groundedness: 0.97,
      coherence: 0.93,
      relevance: 0.88,
      safety: 0,
      cost: 0.008
    };
    const evalResult = engine.evaluator.evaluate(sampleScores);
    console.log(engine.evaluator.formatReport(evalResult));
  }

  process.exit(engine.success ? 0 : 1);
}

export { initEngine, printStatus, moonshot };
