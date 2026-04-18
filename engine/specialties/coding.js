/**
 * FAI Specialty S-9: FAI Agentic Coding — Issue-to-PR Pipeline
 * ==============================================================
 * Reusable contract for agentic coding workflows: issue ingestion,
 * plan→code→test→review pipeline, self-healing, scope guards, cost caps.
 *
 * @module engine/specialties/coding
 */

const CODING_SCHEMA = {
  type: 'object',
  properties: {
    source: {
      type: 'string',
      enum: ['github-issues', 'jira', 'azure-devops', 'linear', 'manual'],
      default: 'github-issues'
    },
    pipeline: {
      type: 'array',
      items: { type: 'string', enum: ['plan', 'code', 'test', 'review', 'lint', 'security-scan', 'deploy'] },
      default: ['plan', 'code', 'test', 'review']
    },
    selfHealing: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', default: true },
        maxRetries: { type: 'integer', minimum: 0, default: 3 },
        strategies: {
          type: 'array',
          items: { type: 'string', enum: ['fix-lint', 'fix-tests', 'simplify-approach', 'ask-human'] },
          default: ['fix-lint', 'fix-tests']
        }
      },
      additionalProperties: false
    },
    scopeGuards: {
      type: 'object',
      properties: {
        maxFiles: { type: 'integer', minimum: 1, default: 10 },
        maxLinesChanged: { type: 'integer', minimum: 1, default: 500 },
        allowedPaths: { type: 'array', items: { type: 'string' }, description: 'Glob patterns of allowed file paths.' },
        blockedPaths: { type: 'array', items: { type: 'string' }, default: ['**/*.env', '**/secrets/**'] }
      },
      additionalProperties: false
    },
    approval: {
      type: 'string',
      enum: ['human-required', 'auto-merge-if-green', 'auto-merge-minor'],
      default: 'human-required'
    },
    costPerPR: {
      type: 'object',
      properties: {
        max: { type: 'number', minimum: 0, default: 1.00, description: 'Max cost per PR in USD.' },
        alertThreshold: { type: 'number', minimum: 0, default: 0.50 }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

// ─── Pipeline Stage Tracker ───────────────────────────

class CodingPipeline {
  constructor(config = {}) {
    this.stages = config.pipeline || ['plan', 'code', 'test', 'review'];
    this.selfHealing = config.selfHealing || { enabled: true, maxRetries: 3 };
    this.scopeGuards = config.scopeGuards || {};
    this.costCap = config.costPerPR?.max || 1.00;

    /** @type {Array<{ stage: string, status: string, startTime: number, endTime?: number, result?: any, error?: string, cost: number }>} */
    this._runs = [];
    this._totalCost = 0;
    this._currentStageIndex = 0;
    this._retries = 0;
  }

  getCurrentStage() {
    return this.stages[this._currentStageIndex] || null;
  }

  startStage() {
    const stage = this.getCurrentStage();
    if (!stage) return null;

    const run = { stage, status: 'running', startTime: Date.now(), cost: 0 };
    this._runs.push(run);
    return run;
  }

  completeStage(result, cost = 0) {
    const run = this._runs[this._runs.length - 1];
    if (!run || run.status !== 'running') return null;

    run.status = 'completed';
    run.endTime = Date.now();
    run.result = result;
    run.cost = cost;
    this._totalCost += cost;
    this._currentStageIndex++;
    this._retries = 0;

    return run;
  }

  failStage(error) {
    const run = this._runs[this._runs.length - 1];
    if (!run) return { action: 'abort', reason: 'no active stage' };

    run.status = 'failed';
    run.endTime = Date.now();
    run.error = error;

    if (!this.selfHealing.enabled) return { action: 'abort', reason: 'self-healing disabled' };

    this._retries++;
    if (this._retries > this.selfHealing.maxRetries) {
      return { action: 'abort', reason: `Max retries (${this.selfHealing.maxRetries}) exceeded` };
    }

    return { action: 'retry', retryCount: this._retries, strategies: this.selfHealing.strategies || [] };
  }

  checkScopeGuards(filesChanged, linesChanged) {
    const violations = [];
    const maxFiles = this.scopeGuards.maxFiles || 10;
    const maxLines = this.scopeGuards.maxLinesChanged || 500;
    const blocked = this.scopeGuards.blockedPaths || [];

    if (filesChanged.length > maxFiles) {
      violations.push(`Too many files changed: ${filesChanged.length} > ${maxFiles}`);
    }
    if (linesChanged > maxLines) {
      violations.push(`Too many lines changed: ${linesChanged} > ${maxLines}`);
    }
    for (const file of filesChanged) {
      for (const pattern of blocked) {
        if (this._matchGlob(file, pattern)) {
          violations.push(`Blocked file modified: ${file} (matches ${pattern})`);
        }
      }
    }

    return { pass: violations.length === 0, violations };
  }

  checkCostGuard() {
    if (this._totalCost > this.costCap) {
      return { pass: false, reason: `Cost cap exceeded: $${this._totalCost.toFixed(4)} > $${this.costCap}` };
    }
    return { pass: true, remaining: this.costCap - this._totalCost };
  }

  isComplete() {
    return this._currentStageIndex >= this.stages.length;
  }

  stats() {
    return {
      stages: this.stages,
      currentStage: this.getCurrentStage(),
      completed: this._currentStageIndex,
      total: this.stages.length,
      totalCost: this._totalCost,
      runs: this._runs.map(r => ({ stage: r.stage, status: r.status, durationMs: r.endTime ? r.endTime - r.startTime : null, cost: r.cost }))
    };
  }

  _matchGlob(file, pattern) {
    const regex = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
    return new RegExp(`^${regex}$`).test(file);
  }
}

// ─── Public Factory ───────────────────────────────────

function createCodingPipeline(codingConfig = {}) {
  return {
    pipeline: new CodingPipeline(codingConfig),
    schema: CODING_SCHEMA,

    validate(config) {
      const errors = [];
      if (!config || typeof config !== 'object') return { valid: true, errors };

      const validSources = ['github-issues', 'jira', 'azure-devops', 'linear', 'manual'];
      if (config.source && !validSources.includes(config.source)) {
        errors.push(`Invalid source "${config.source}". Valid: ${validSources.join(', ')}`);
      }
      const validApprovals = ['human-required', 'auto-merge-if-green', 'auto-merge-minor'];
      if (config.approval && !validApprovals.includes(config.approval)) {
        errors.push(`Invalid approval policy "${config.approval}". Valid: ${validApprovals.join(', ')}`);
      }

      return { valid: errors.length === 0, errors };
    }
  };
}

export { createCodingPipeline, CodingPipeline, CODING_SCHEMA };
