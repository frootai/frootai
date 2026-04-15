import type { FaiEngine, EngineResult, EvaluationResult, MetricResult, Guardrails } from '../types/index.js';

/**
 * Wire a play through the FAI Protocol — resolve context, bind primitives,
 * activate guardrails. Delegates to the FAI Engine's runPlay function.
 *
 * @param engine - The FAI Engine instance (must be available)
 * @param playId - Play ID (e.g., '01', '01-enterprise-rag')
 * @returns EngineResult with wiring status, context, guardrails, and errors
 */
export function wirePlay(engine: FaiEngine, playId: string): EngineResult {
  if (!engine.available || !engine.runPlay) {
    return {
      success: false,
      errors: ['FAI Engine not available. Run from the repository root to enable engine tools.'],
      duration: 0,
      error: 'Engine not available',
    };
  }

  return engine.runPlay({ playId });
}

/**
 * Inspect wiring status of a play.
 * Initializes the engine for the play and returns the primitive graph,
 * shared context, evaluator thresholds, and any issues.
 */
export function inspectWiring(
  engine: FaiEngine,
  playId: string
): { play: string; wiring: any; health: string } {
  if (!engine.available || !engine.findManifest || !engine.initEngine) {
    return { play: playId, wiring: null, health: 'Engine not available' };
  }

  const mfPath = engine.findManifest(playId);
  if (!mfPath) {
    return { play: playId, wiring: null, health: `Play "${playId}" not found` };
  }

  const initialized = engine.initEngine(mfPath);

  const stats = initialized.wiring?.stats ?? {};
  const totalPrimitives = (stats.agents ?? 0) + (stats.instructions ?? 0) +
    (stats.skills ?? 0) + (stats.hooks ?? 0) + (stats.workflows ?? 0);

  const hasErrors = (initialized.errors?.length ?? 0) > 0;
  const health = hasErrors
    ? `⚠️ Wired with ${initialized.errors.length} issue(s)`
    : `✅ All ${totalPrimitives} primitives wired`;

  return {
    play: initialized.manifest?.play ?? playId,
    wiring: {
      context: initialized.context ?? null,
      primitives: initialized.wiring?.primitives ?? null,
      stats,
      evaluator: initialized.evaluator?.thresholds ?? null,
      errors: initialized.errors ?? [],
    },
    health,
  };
}

/**
 * Validate a fai-manifest.json file against the FAI Protocol specification.
 * Checks play ID format, semver, knowledge refs, WAF names, guardrail ranges,
 * and primitive path existence.
 */
export function validateManifest(
  engine: FaiEngine,
  playId: string
): { valid: boolean; errors: string[]; warnings: string[] } {
  if (!engine.available || !engine.findManifest || !engine.loadManifest || !engine.resolvePaths) {
    return { valid: false, errors: ['FAI Engine not available'], warnings: [] };
  }

  const mfPath = engine.findManifest(playId);
  if (!mfPath) {
    return { valid: false, errors: [`Play "${playId}" not found in solution-plays/`], warnings: [] };
  }

  const { manifest, playDir, errors: loadErrors } = engine.loadManifest(mfPath);
  if (!manifest) {
    return { valid: false, errors: loadErrors, warnings: [] };
  }

  const { missing } = engine.resolvePaths(manifest, playDir);
  const errors = [...loadErrors, ...missing.map(m => `Missing file: ${m}`)];

  const warnings: string[] = [];

  // Check optional fields
  if (!manifest.context?.knowledge?.length) {
    warnings.push('No knowledge modules referenced in context');
  }
  if (!manifest.context?.waf?.length) {
    warnings.push('No WAF pillars specified in context');
  }
  if (!manifest.primitives?.agents?.length) {
    warnings.push('No agents declared in primitives');
  }
  if (!manifest.primitives?.guardrails) {
    warnings.push('No guardrails defined in primitives');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Run quality evaluation with thresholds.
 * Checks each metric score against its threshold and returns pass/fail
 * with action recommendations per metric.
 */
export function evaluateQuality(
  scores: Record<string, number>,
  thresholds?: Record<string, number>
): EvaluationResult {
  const defaultThresholds: Record<string, number> = {
    groundedness: 4.0,
    relevance: 4.0,
    coherence: 4.0,
    fluency: 4.0,
    safety: 4.0,
  };
  const t = { ...defaultThresholds, ...thresholds };

  const results: MetricResult[] = [];
  let passCount = 0;
  let totalCount = 0;

  for (const [metric, score] of Object.entries(scores)) {
    const threshold = t[metric] ?? 4.0;
    const pass = score >= threshold;
    if (pass) passCount++;
    totalCount++;

    let action: MetricResult['action'];
    if (pass) {
      action = 'ok';
    } else {
      const deficit = threshold - score;
      if (deficit > 1.5) action = 'block';
      else if (deficit > 1.0) action = 'alert';
      else if (deficit > 0.5) action = 'retry';
      else action = 'warn';
    }

    results.push({ metric, score, threshold, pass, action });
  }

  const allPassed = passCount === totalCount;
  const summary = allPassed
    ? `All ${passCount}/${totalCount} metrics meet thresholds. Ready for production.`
    : `${totalCount - passCount} check(s) failed — ${passCount}/${totalCount} passed. Review failing metrics before deploying.`;

  return { pass: allPassed, results, summary };
}
