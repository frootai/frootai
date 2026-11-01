/**
 * FAI Engine — Evaluator
 * Checks output quality against guardrail thresholds defined in fai-manifest.json.
 *
 * Evaluates: groundedness, coherence, relevance, safety, cost.
 * This is what makes FrootAI evaluated — quality gates are protocol-level, not afterthoughts.
 */

/**
 * Default guardrail thresholds (used when manifest doesn't specify).
 */
const DEFAULTS = {
  groundedness: 0.95,
  coherence: 0.90,
  relevance: 0.85,
  safety: 0,
  costPerQuery: 0.01
};

/**
 * Create an evaluator with guardrail thresholds from a manifest.
 * @param {object} guardrails - manifest.primitives.guardrails
 * @param {{ required?: string[] }} [options] - metrics that must be scored for a pass
 * @returns {object} Evaluator instance
 */
function createEvaluator(guardrails = {}, { required = [] } = {}) {
  const thresholds = { ...DEFAULTS, ...guardrails };
  const requiredMetrics = [...new Set(required)];

  return {
    thresholds,
    required: requiredMetrics,

    /**
     * Evaluate a response against guardrail thresholds.
     * A pass needs at least one scored gate, numeric scores, and every required metric.
     * @param {object} scores - { groundedness, coherence, relevance, safety, cost }
     * @returns {{ pass: boolean, results: object[], summary: string }}
     */
    evaluate(scores = {}) {
      const results = [];
      let allPass = true;

      for (const [metric, value] of Object.entries(scores || {})) {
        if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
          results.push({ metric: metric === 'cost' ? 'costPerQuery' : metric, score: value, threshold: null, pass: false, action: 'invalid' });
          allPass = false;
        }
      }
      const numeric = (metric) => typeof scores?.[metric] === 'number' && Number.isFinite(scores[metric]);

      // Groundedness check
      if (numeric('groundedness')) {
        const pass = scores.groundedness >= thresholds.groundedness;
        results.push({
          metric: 'groundedness',
          score: scores.groundedness,
          threshold: thresholds.groundedness,
          pass,
          action: pass ? 'ok' : 'retry'
        });
        if (!pass) allPass = false;
      }

      // Coherence check
      if (numeric('coherence')) {
        const pass = scores.coherence >= thresholds.coherence;
        results.push({
          metric: 'coherence',
          score: scores.coherence,
          threshold: thresholds.coherence,
          pass,
          action: pass ? 'ok' : 'retry'
        });
        if (!pass) allPass = false;
      }

      // Relevance check
      if (numeric('relevance')) {
        const pass = scores.relevance >= thresholds.relevance;
        results.push({
          metric: 'relevance',
          score: scores.relevance,
          threshold: thresholds.relevance,
          pass,
          action: pass ? 'ok' : 'warn'
        });
        if (!pass) allPass = false;
      }

      // Safety check (must be exactly 0 violations)
      if (numeric('safety')) {
        const pass = scores.safety <= thresholds.safety;
        results.push({
          metric: 'safety',
          score: scores.safety,
          threshold: thresholds.safety,
          pass,
          action: pass ? 'ok' : 'block'
        });
        if (!pass) allPass = false;
      }

      // Cost check
      if (numeric('cost') && thresholds.costPerQuery) {
        const pass = scores.cost <= thresholds.costPerQuery;
        results.push({
          metric: 'costPerQuery',
          score: scores.cost,
          threshold: thresholds.costPerQuery,
          pass,
          action: pass ? 'ok' : 'alert'
        });
        if (!pass) allPass = false;
      }

      for (const metric of requiredMetrics) {
        const key = metric === 'costPerQuery' ? 'cost' : metric;
        if (!(key in (scores || {})) || scores[key] === undefined) {
          results.push({ metric, score: null, threshold: thresholds[metric] ?? null, pass: false, action: 'not-evaluated' });
          allPass = false;
        }
      }

      if (results.length === 0) {
        return { pass: false, results, summary: '❌ No quality gates were evaluated' };
      }

      const failed = results.filter(r => !r.pass);
      const summary = allPass
        ? `✅ All ${results.length} quality gates passed`
        : `❌ ${failed.length}/${results.length} quality gates failed: ${failed.map(f => f.action === 'not-evaluated' ? `${f.metric} (not evaluated)` : f.action === 'invalid' ? `${f.metric} (invalid score)` : `${f.metric} (${f.score} vs ${f.threshold})`).join(', ')}`;

      return { pass: allPass, results, summary };
    },

    /**
     * Format evaluation results as a human-readable report.
     */
    formatReport(evalResult) {
      const lines = ['📊 FAI Quality Evaluation Report', '─'.repeat(40)];
      for (const r of evalResult.results) {
        const icon = r.pass ? '✅' : '❌';
        const pct = r.score === null ? 'n/a' : typeof r.score === 'number' && r.score <= 1 ? `${(r.score * 100).toFixed(1)}%` : r.score;
        lines.push(`  ${icon} ${r.metric}: ${pct} (threshold: ${r.threshold}, action: ${r.action})`);
      }
      lines.push('─'.repeat(40));
      lines.push(`  ${evalResult.summary}`);
      return lines.join('\n');
    }
  };
}

export { createEvaluator, DEFAULTS };
