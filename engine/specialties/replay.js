/**
 * FAI Specialty S-7: FAI Replay — Agent Decision Replay & Debugging
 * ==================================================================
 * Deterministic replay with diff comparison, OpenTelemetry integration,
 * and token/cost capture for every agent decision.
 *
 * @module engine/specialties/replay
 */

const REPLAY_SCHEMA = {
  type: 'object',
  properties: {
    enabled: { type: 'boolean', default: true },
    storage: {
      type: 'string',
      enum: ['application-insights', 'file-system', 'cosmos-db', 'in-memory'],
      default: 'in-memory'
    },
    retention: { type: 'string', pattern: '^[0-9]+(s|m|h|d)$', default: '30d' },
    capabilities: {
      type: 'object',
      properties: {
        replayExact: { type: 'boolean', default: true, description: 'Replay with same seed/temp.' },
        replayModified: { type: 'boolean', default: true, description: 'Replay with different prompt.' },
        diffComparison: { type: 'boolean', default: true, description: 'Compare two replay runs.' }
      },
      additionalProperties: false
    },
    tracing: {
      type: 'object',
      properties: {
        provider: { type: 'string', enum: ['opentelemetry', 'application-insights', 'console', 'none'], default: 'opentelemetry' },
        correlationHeader: { type: 'string', default: 'x-fai-trace-id' },
        captureTokens: { type: 'boolean', default: true },
        captureCost: { type: 'boolean', default: true },
        capturePrompt: { type: 'boolean', default: false, description: 'Capture full prompts (PII risk).' },
        captureResponse: { type: 'boolean', default: false, description: 'Capture full responses (PII risk).' },
        sampleRate: { type: 'number', minimum: 0, maximum: 1, default: 1.0 }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

// ─── Trace Span ───────────────────────────────────────

class TraceSpan {
  constructor(name, traceId, parentSpanId) {
    this.spanId = `span_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.traceId = traceId;
    this.parentSpanId = parentSpanId || null;
    this.name = name;
    this.startTime = Date.now();
    this.endTime = null;
    this.status = 'running'; // running|completed|error
    this.attributes = {};
    this.events = [];
    this.children = [];
  }

  setAttribute(key, value) {
    this.attributes[key] = value;
    return this;
  }

  setAttributes(attrs) {
    Object.assign(this.attributes, attrs);
    return this;
  }

  addEvent(name, attributes) {
    this.events.push({ name, timestamp: Date.now(), attributes });
    return this;
  }

  createChild(name) {
    const child = new TraceSpan(name, this.traceId, this.spanId);
    this.children.push(child);
    return child;
  }

  end(status = 'completed') {
    this.endTime = Date.now();
    this.status = status;
    return this;
  }

  durationMs() {
    return this.endTime ? this.endTime - this.startTime : Date.now() - this.startTime;
  }

  serialize() {
    return {
      spanId: this.spanId,
      traceId: this.traceId,
      parentSpanId: this.parentSpanId,
      name: this.name,
      startTime: this.startTime,
      endTime: this.endTime,
      durationMs: this.durationMs(),
      status: this.status,
      attributes: this.attributes,
      events: this.events,
      children: this.children.map(c => c.serialize())
    };
  }
}

// ─── Decision Recorder ────────────────────────────────

class DecisionRecorder {
  constructor(config = {}) {
    this.captureTokens = config.tracing?.captureTokens !== false;
    this.captureCost = config.tracing?.captureCost !== false;
    this.capturePrompt = config.tracing?.capturePrompt || false;
    this.captureResponse = config.tracing?.captureResponse || false;
    this.sampleRate = config.tracing?.sampleRate ?? 1.0;

    /** @type {Array<{id: string, traceId: string, agentId: string, input: object, output: object, params: object, metrics: object, timestamp: number}>} */
    this._decisions = [];
  }

  /**
   * Record an agent decision.
   * @param {object} decision
   * @param {string} decision.traceId
   * @param {string} decision.agentId
   * @param {object} decision.input - { prompt, systemPrompt, context }
   * @param {object} decision.output - { response, confidence }
   * @param {object} decision.params - { model, temperature, seed, topP }
   * @param {object} decision.metrics - { promptTokens, completionTokens, totalTokens, cost, latencyMs }
   * @returns {string} Decision ID
   */
  record(decision) {
    // Respect sampling rate
    if (Math.random() > this.sampleRate) return null;

    const entry = {
      id: `dec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      traceId: decision.traceId,
      agentId: decision.agentId,
      timestamp: Date.now(),
      input: this.capturePrompt ? decision.input : { promptLength: JSON.stringify(decision.input || '').length },
      output: this.captureResponse ? decision.output : { responseLength: JSON.stringify(decision.output || '').length },
      params: decision.params || {},
      metrics: {}
    };

    if (this.captureTokens) {
      entry.metrics.promptTokens = decision.metrics?.promptTokens || 0;
      entry.metrics.completionTokens = decision.metrics?.completionTokens || 0;
      entry.metrics.totalTokens = decision.metrics?.totalTokens || 0;
    }
    if (this.captureCost) {
      entry.metrics.cost = decision.metrics?.cost || 0;
    }
    entry.metrics.latencyMs = decision.metrics?.latencyMs || 0;

    this._decisions.push(entry);
    return entry.id;
  }

  /**
   * Get decisions for a specific trace.
   * @param {string} traceId
   * @returns {object[]}
   */
  getByTrace(traceId) {
    return this._decisions.filter(d => d.traceId === traceId);
  }

  /**
   * Get decisions for a specific agent.
   * @param {string} agentId
   * @returns {object[]}
   */
  getByAgent(agentId) {
    return this._decisions.filter(d => d.agentId === agentId);
  }

  stats() {
    let totalTokens = 0, totalCost = 0, totalLatency = 0;
    for (const d of this._decisions) {
      totalTokens += d.metrics.totalTokens || 0;
      totalCost += d.metrics.cost || 0;
      totalLatency += d.metrics.latencyMs || 0;
    }
    return {
      totalDecisions: this._decisions.length,
      totalTokens,
      totalCost,
      avgLatencyMs: this._decisions.length > 0 ? totalLatency / this._decisions.length : 0
    };
  }
}

// ─── Replay Engine ────────────────────────────────────

class ReplayEngine {
  constructor(config = {}) {
    this.replayExact = config.capabilities?.replayExact !== false;
    this.replayModified = config.capabilities?.replayModified !== false;
    this.diffComparison = config.capabilities?.diffComparison !== false;
    this.recorder = new DecisionRecorder(config);
  }

  /**
   * Prepare an exact replay — same params, same seed.
   * @param {string} decisionId
   * @returns {{ replayRequest: object, found: boolean }}
   */
  prepareExactReplay(decisionId) {
    const decision = this.recorder._decisions.find(d => d.id === decisionId);
    if (!decision) return { replayRequest: null, found: false };

    return {
      replayRequest: {
        type: 'exact',
        originalDecisionId: decisionId,
        input: decision.input,
        params: { ...decision.params },
        metadata: { replayOf: decisionId, replayType: 'exact', timestamp: Date.now() }
      },
      found: true
    };
  }

  /**
   * Prepare a modified replay — different prompt or params.
   * @param {string} decisionId
   * @param {object} modifications - { prompt?: string, temperature?: number, model?: string }
   * @returns {{ replayRequest: object, found: boolean }}
   */
  prepareModifiedReplay(decisionId, modifications = {}) {
    const decision = this.recorder._decisions.find(d => d.id === decisionId);
    if (!decision) return { replayRequest: null, found: false };

    return {
      replayRequest: {
        type: 'modified',
        originalDecisionId: decisionId,
        input: modifications.prompt ? { ...decision.input, prompt: modifications.prompt } : decision.input,
        params: { ...decision.params, ...modifications },
        metadata: { replayOf: decisionId, replayType: 'modified', modifications: Object.keys(modifications), timestamp: Date.now() }
      },
      found: true
    };
  }

  /**
   * Compare two decision results (diff).
   * @param {string} decisionIdA
   * @param {string} decisionIdB
   * @returns {{ diff: object, found: boolean }}
   */
  diff(decisionIdA, decisionIdB) {
    const a = this.recorder._decisions.find(d => d.id === decisionIdA);
    const b = this.recorder._decisions.find(d => d.id === decisionIdB);
    if (!a || !b) return { diff: null, found: false };

    const paramDiffs = {};
    const allKeys = new Set([...Object.keys(a.params), ...Object.keys(b.params)]);
    for (const key of allKeys) {
      if (JSON.stringify(a.params[key]) !== JSON.stringify(b.params[key])) {
        paramDiffs[key] = { a: a.params[key], b: b.params[key] };
      }
    }

    const metricDiffs = {};
    const metricKeys = new Set([...Object.keys(a.metrics), ...Object.keys(b.metrics)]);
    for (const key of metricKeys) {
      if (a.metrics[key] !== b.metrics[key]) {
        metricDiffs[key] = { a: a.metrics[key], b: b.metrics[key], delta: (b.metrics[key] || 0) - (a.metrics[key] || 0) };
      }
    }

    return {
      diff: {
        decisionA: decisionIdA,
        decisionB: decisionIdB,
        sameAgent: a.agentId === b.agentId,
        paramDiffs,
        metricDiffs,
        latencyDelta: (b.metrics.latencyMs || 0) - (a.metrics.latencyMs || 0),
        costDelta: (b.metrics.cost || 0) - (a.metrics.cost || 0),
        tokenDelta: (b.metrics.totalTokens || 0) - (a.metrics.totalTokens || 0)
      },
      found: true
    };
  }
}

// ─── Public Factory ───────────────────────────────────

function createReplaySystem(replayConfig = {}) {
  const engine = new ReplayEngine(replayConfig);

  return {
    engine,
    recorder: engine.recorder,
    schema: REPLAY_SCHEMA,

    /**
     * Start a new trace.
     * @param {string} name
     * @returns {{ traceId: string, rootSpan: TraceSpan }}
     */
    startTrace(name) {
      const traceId = `trace_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const rootSpan = new TraceSpan(name, traceId);
      return { traceId, rootSpan };
    },

    validate(config) {
      const errors = [];
      if (!config || typeof config !== 'object') return { valid: true, errors };

      const validStorage = ['application-insights', 'file-system', 'cosmos-db', 'in-memory'];
      if (config.storage && !validStorage.includes(config.storage)) {
        errors.push(`Invalid replay storage "${config.storage}". Valid: ${validStorage.join(', ')}`);
      }
      if (config.tracing?.sampleRate !== undefined) {
        if (config.tracing.sampleRate < 0 || config.tracing.sampleRate > 1) {
          errors.push(`Tracing sampleRate must be 0-1, got: ${config.tracing.sampleRate}`);
        }
      }

      return { valid: errors.length === 0, errors };
    }
  };
}

export { createReplaySystem, ReplayEngine, DecisionRecorder, TraceSpan, REPLAY_SCHEMA };
