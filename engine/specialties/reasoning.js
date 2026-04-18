/**
 * FAI Specialty S-4: FAI Reasoning — Deterministic Reasoning Chains
 * ==================================================================
 * Declarative reasoning strategy contracts. Instead of hardcoding temperature=0,
 * declare intent: "I want deterministic output" and the engine enforces it.
 *
 * What competitors offer:
 *   - OpenAI o3/o4: Extended thinking tokens (proprietary)
 *   - Anthropic: Extended thinking mode (proprietary)
 *   - Microsoft Guidance: Constrained generation templates
 *   - DSPy: Compiled prompt optimization
 *
 * What FAI adds:
 *   - Standard for declaring reasoning strategy in a manifest
 *   - Audit trails for every reasoning step
 *   - Anti-pattern detection (sycophancy, hallucination)
 *   - Confidence thresholds with abstention policy
 *
 * @module engine/specialties/reasoning
 */

// ─── Schema Contract ──────────────────────────────────

const REASONING_SCHEMA = {
  type: 'object',
  properties: {
    strategy: {
      type: 'string',
      enum: ['creative', 'deterministic', 'chain-of-thought', 'tree-of-thought', 'react', 'reflection'],
      default: 'deterministic',
      description: 'Reasoning strategy. Each maps to specific model parameters and prompt patterns.'
    },
    temperature: {
      type: 'number',
      minimum: 0,
      maximum: 2,
      description: 'LLM temperature. Automatically set by strategy if not specified.'
    },
    seed: {
      type: 'integer',
      description: 'Deterministic seed for reproducible outputs. Only used with deterministic strategy.'
    },
    topP: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Nucleus sampling parameter. Set to 1.0 for deterministic.'
    },
    outputFormat: {
      type: 'string',
      enum: ['text', 'structured-json', 'json-schema', 'markdown', 'code'],
      default: 'text',
      description: 'Expected output format. structured-json enables JSON mode.'
    },
    jsonSchema: {
      type: 'object',
      description: 'JSON Schema for structured output validation (when outputFormat is json-schema).'
    },
    confidenceThreshold: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      default: 0.7,
      description: 'Abstain from answering if confidence falls below this threshold.'
    },
    abstentionPolicy: {
      type: 'string',
      enum: ['decline', 'escalate', 'fallback', 'retry'],
      default: 'decline',
      description: 'What to do when confidence is below threshold.'
    },
    maxReasoningSteps: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 10,
      description: 'Maximum reasoning steps before forcing a conclusion.'
    },
    auditTrail: {
      type: 'boolean',
      default: true,
      description: 'Log every reasoning step for debugging and replay.'
    },
    antiPatterns: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['sycophancy', 'hallucination', 'repetition', 'contradiction', 'verbosity', 'refusal-to-answer']
      },
      default: ['sycophancy', 'hallucination'],
      description: 'Anti-patterns to detect and flag in reasoning output.'
    },
    thinkingBudget: {
      type: 'integer',
      minimum: 0,
      description: 'Max thinking/reasoning tokens (for models that support extended thinking).'
    }
  },
  additionalProperties: false
};

// ─── Strategy Presets ─────────────────────────────────

const STRATEGY_PRESETS = {
  deterministic: {
    temperature: 0.0,
    topP: 1.0,
    seed: 42,
    outputFormat: 'structured-json',
    auditTrail: true,
    antiPatterns: ['sycophancy', 'hallucination', 'contradiction'],
    systemPromptSuffix: 'You MUST provide consistent, reproducible answers. Never guess. If uncertain, say "I don\'t know" rather than fabricating information.'
  },
  creative: {
    temperature: 0.9,
    topP: 0.95,
    seed: undefined,
    outputFormat: 'text',
    auditTrail: false,
    antiPatterns: ['repetition'],
    systemPromptSuffix: 'Be creative and exploratory in your responses. Generate diverse, novel ideas.'
  },
  'chain-of-thought': {
    temperature: 0.3,
    topP: 0.9,
    outputFormat: 'markdown',
    auditTrail: true,
    antiPatterns: ['hallucination', 'contradiction'],
    systemPromptSuffix: 'Think step by step. Show your reasoning process explicitly. Number each step. Verify your logic before concluding.'
  },
  'tree-of-thought': {
    temperature: 0.5,
    topP: 0.9,
    outputFormat: 'structured-json',
    auditTrail: true,
    antiPatterns: ['hallucination'],
    systemPromptSuffix: 'Explore multiple reasoning paths. For each decision point, consider at least 2-3 alternatives. Evaluate each path before choosing the best one. Show your decision tree.'
  },
  react: {
    temperature: 0.2,
    topP: 0.9,
    outputFormat: 'structured-json',
    auditTrail: true,
    antiPatterns: ['hallucination', 'repetition'],
    systemPromptSuffix: 'Use the ReAct pattern: Thought → Action → Observation → repeat. Think about what you need to do, take an action, observe the result, then decide the next step.'
  },
  reflection: {
    temperature: 0.4,
    topP: 0.9,
    outputFormat: 'text',
    auditTrail: true,
    antiPatterns: ['sycophancy', 'hallucination', 'contradiction'],
    systemPromptSuffix: 'After generating your initial response, reflect on it critically. Check for errors, biases, and missing perspectives. Revise if needed. Show both your initial response and your reflection.'
  }
};

// ─── Anti-Pattern Detectors ───────────────────────────

const ANTI_PATTERN_DETECTORS = {
  sycophancy: {
    name: 'Sycophancy',
    description: 'Agreeing with the user even when they are wrong',
    detect(response, context) {
      const indicators = [
        /you('re| are) (absolutely|completely|totally) (right|correct)/i,
        /great (question|point|observation)/i,
        /I (completely|totally|fully) agree/i,
        /that's (exactly|precisely) (right|correct)/i
      ];
      const matches = indicators.filter(p => p.test(response));
      return {
        detected: matches.length >= 2,
        confidence: Math.min(matches.length / indicators.length, 1),
        evidence: matches.map(m => m.source)
      };
    }
  },
  hallucination: {
    name: 'Hallucination',
    description: 'Generating unsourced or fabricated claims',
    detect(response, context) {
      const indicators = [];
      // Check for specific date/version claims without sources
      if (/(?:version|v)\s*\d+\.\d+/i.test(response) && !context?.sources?.length) {
        indicators.push('version-claim-without-source');
      }
      // Check for URL fabrication patterns
      if (/https?:\/\/[^\s]+(?:example|fake|test)\.[^\s]+/i.test(response)) {
        indicators.push('suspicious-url');
      }
      // Check for confident claims about future events
      if (/will (definitely|certainly|surely)/i.test(response)) {
        indicators.push('overconfident-prediction');
      }
      return {
        detected: indicators.length > 0,
        confidence: Math.min(indicators.length * 0.3, 1),
        evidence: indicators
      };
    }
  },
  repetition: {
    name: 'Repetition',
    description: 'Repeating the same phrases or ideas',
    detect(response) {
      const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 10);
      const seen = new Map();
      let repeats = 0;

      for (const sentence of sentences) {
        const normalized = sentence.trim().toLowerCase().replace(/\s+/g, ' ');
        if (seen.has(normalized)) {
          repeats++;
        }
        seen.set(normalized, (seen.get(normalized) || 0) + 1);
      }

      return {
        detected: repeats > 1,
        confidence: Math.min(repeats / Math.max(sentences.length, 1), 1),
        evidence: repeats > 0 ? [`${repeats} repeated sentences out of ${sentences.length}`] : []
      };
    }
  },
  contradiction: {
    name: 'Contradiction',
    description: 'Making contradictory claims within the same response',
    detect(response) {
      const contradictionPairs = [
        [/\bis\b/i, /\bis not\b/i],
        [/\bshould\b/i, /\bshould not\b/i],
        [/\bcan\b/i, /\bcannot\b/i],
        [/\balways\b/i, /\bnever\b/i],
        [/\ball\b/i, /\bnone\b/i]
      ];

      const contradictions = [];
      for (const [pos, neg] of contradictionPairs) {
        if (pos.test(response) && neg.test(response)) {
          contradictions.push(`${pos.source} vs ${neg.source}`);
        }
      }

      // Heuristic: simple contradiction detection isn't reliable in long text
      return {
        detected: contradictions.length >= 3,
        confidence: Math.min(contradictions.length * 0.15, 1),
        evidence: contradictions
      };
    }
  },
  verbosity: {
    name: 'Verbosity',
    description: 'Unnecessarily long or wordy responses',
    detect(response, context) {
      const wordCount = response.split(/\s+/).length;
      const maxExpected = context?.maxExpectedWords || 500;

      return {
        detected: wordCount > maxExpected * 2,
        confidence: Math.min((wordCount - maxExpected) / maxExpected, 1),
        evidence: [`${wordCount} words (expected ≤ ${maxExpected})`]
      };
    }
  },
  'refusal-to-answer': {
    name: 'Refusal to Answer',
    description: 'Declining to answer when it should be able to',
    detect(response) {
      const refusals = [
        /I (can't|cannot|am unable to) (help|assist|answer|provide)/i,
        /I('m| am) not (able|qualified|authorized)/i,
        /I don't have (access|information|data) (to|about|on)/i,
        /as an AI,? I/i
      ];
      const matches = refusals.filter(p => p.test(response));
      return {
        detected: matches.length >= 2,
        confidence: Math.min(matches.length / refusals.length, 1),
        evidence: matches.map(m => m.source)
      };
    }
  }
};

// ─── Reasoning Chain Tracker ──────────────────────────

class ReasoningChain {
  constructor() {
    /** @type {Array<{ step: number, type: string, content: string, timestamp: number, metadata?: object }>} */
    this.steps = [];
    this.startTime = Date.now();
  }

  /** Add a reasoning step. */
  addStep(type, content, metadata) {
    this.steps.push({
      step: this.steps.length + 1,
      type,
      content,
      timestamp: Date.now(),
      metadata
    });
    return this;
  }

  /** Get the full chain as a structured audit log. */
  toAuditLog() {
    return {
      totalSteps: this.steps.length,
      durationMs: Date.now() - this.startTime,
      steps: this.steps,
      summary: this.steps.map(s => `[${s.step}] ${s.type}: ${s.content.substring(0, 100)}`).join('\n')
    };
  }
}

// ─── Reasoning Engine ─────────────────────────────────

/**
 * Create a FAI Reasoning engine from manifest config.
 * @param {object} reasoningConfig - manifest.reasoning section
 * @returns {object} Reasoning engine instance
 */
function createReasoningEngine(reasoningConfig = {}) {
  const strategy = reasoningConfig.strategy || 'deterministic';
  const preset = STRATEGY_PRESETS[strategy] || STRATEGY_PRESETS.deterministic;

  // Merge preset with explicit config (explicit wins)
  const config = {
    ...preset,
    ...reasoningConfig,
    temperature: reasoningConfig.temperature ?? preset.temperature,
    topP: reasoningConfig.topP ?? preset.topP,
    seed: reasoningConfig.seed ?? preset.seed,
    outputFormat: reasoningConfig.outputFormat || preset.outputFormat,
    auditTrail: reasoningConfig.auditTrail ?? preset.auditTrail,
    antiPatterns: reasoningConfig.antiPatterns || preset.antiPatterns
  };

  return {
    config,
    schema: REASONING_SCHEMA,

    /**
     * Get LLM parameters derived from the reasoning strategy.
     * @returns {object} Parameters to pass to the LLM API
     */
    getLLMParams() {
      const params = {
        temperature: config.temperature,
        top_p: config.topP
      };

      if (config.seed !== undefined) params.seed = config.seed;
      if (config.outputFormat === 'structured-json' || config.outputFormat === 'json-schema') {
        params.response_format = { type: 'json_object' };
      }
      if (config.jsonSchema && config.outputFormat === 'json-schema') {
        params.response_format = { type: 'json_schema', json_schema: config.jsonSchema };
      }
      if (config.thinkingBudget) {
        params.max_completion_tokens = config.thinkingBudget;
      }

      return params;
    },

    /**
     * Get the system prompt suffix for the configured strategy.
     * @returns {string}
     */
    getSystemPromptSuffix() {
      return config.systemPromptSuffix || '';
    },

    /**
     * Create a new reasoning chain for audit tracking.
     * @returns {ReasoningChain}
     */
    createChain() {
      return new ReasoningChain();
    },

    /**
     * Run anti-pattern detection on a response.
     * @param {string} response - The LLM response text
     * @param {object} [context] - Optional context (sources, maxExpectedWords, etc.)
     * @returns {{ clean: boolean, detections: object[], summary: string }}
     */
    detectAntiPatterns(response, context) {
      const detections = [];
      const activePatterns = config.antiPatterns || [];

      for (const patternName of activePatterns) {
        const detector = ANTI_PATTERN_DETECTORS[patternName];
        if (!detector) continue;

        const result = detector.detect(response, context);
        if (result.detected) {
          detections.push({
            pattern: patternName,
            name: detector.name,
            description: detector.description,
            confidence: result.confidence,
            evidence: result.evidence
          });
        }
      }

      const clean = detections.length === 0;
      const summary = clean
        ? `✅ No anti-patterns detected (checked ${activePatterns.length} patterns)`
        : `⚠️ ${detections.length} anti-pattern(s) detected: ${detections.map(d => d.name).join(', ')}`;

      return { clean, detections, summary };
    },

    /**
     * Check if a response meets the confidence threshold.
     * @param {number} confidence - Estimated confidence (0-1)
     * @returns {{ meetsThreshold: boolean, action: string, threshold: number }}
     */
    checkConfidence(confidence) {
      const threshold = config.confidenceThreshold ?? 0.7;
      const meetsThreshold = confidence >= threshold;
      const action = meetsThreshold ? 'proceed' : (config.abstentionPolicy || 'decline');

      return { meetsThreshold, action, threshold };
    },

    /**
     * Validate reasoning config against the schema contract.
     * @param {object} cfg - Reasoning config to validate
     * @returns {{ valid: boolean, errors: string[] }}
     */
    validate(cfg) {
      const errors = [];
      if (!cfg || typeof cfg !== 'object') return { valid: true, errors };

      const validStrategies = ['creative', 'deterministic', 'chain-of-thought', 'tree-of-thought', 'react', 'reflection'];
      if (cfg.strategy && !validStrategies.includes(cfg.strategy)) {
        errors.push(`Invalid reasoning strategy "${cfg.strategy}". Valid: ${validStrategies.join(', ')}`);
      }
      if (cfg.temperature !== undefined && (cfg.temperature < 0 || cfg.temperature > 2)) {
        errors.push(`Temperature must be 0-2, got: ${cfg.temperature}`);
      }
      if (cfg.strategy === 'deterministic' && cfg.temperature > 0) {
        errors.push(`Deterministic strategy requires temperature=0, got: ${cfg.temperature}`);
      }
      if (cfg.confidenceThreshold !== undefined && (cfg.confidenceThreshold < 0 || cfg.confidenceThreshold > 1)) {
        errors.push(`confidenceThreshold must be 0-1, got: ${cfg.confidenceThreshold}`);
      }
      if (cfg.maxReasoningSteps !== undefined && (cfg.maxReasoningSteps < 1 || cfg.maxReasoningSteps > 100)) {
        errors.push(`maxReasoningSteps must be 1-100, got: ${cfg.maxReasoningSteps}`);
      }

      return { valid: errors.length === 0, errors };
    }
  };
}

export {
  createReasoningEngine,
  ReasoningChain,
  REASONING_SCHEMA,
  STRATEGY_PRESETS,
  ANTI_PATTERN_DETECTORS
};
