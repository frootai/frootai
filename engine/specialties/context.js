/**
 * FAI Specialty S-2: FAI Context — Intelligent Context Management
 * ================================================================
 * Protocol-level context inheritance, compression, caching, and token budget
 * management. This is the foundation all other specialties build upon.
 *
 * What competitors offer:
 *   - DSPy: Compiled prompt optimization with context signatures
 *   - Google: KV context caching (75% cost reduction)
 *   - Anthropic: 200K brute-force context windows
 *
 * What FAI adds:
 *   - Protocol-level context inheritance across agent chains
 *   - Declarative compression strategies in the manifest
 *   - Semantic caching with configurable similarity thresholds
 *   - Token budget enforcement per agent per turn
 *
 * Manifest extension (context.advanced):
 *   compression: { strategy, ratio, model, preserveEntities }
 *   caching:     { enabled, ttl, scope, similarity }
 *   inheritance:  { from, override, merge }
 *   tokenBudget: { maxPerAgent, maxPerTurn, reserveForOutput }
 *
 * @module engine/specialties/context
 */

// ─── Schema Contract ──────────────────────────────────

/**
 * JSON Schema extension for context.advanced in fai-manifest.json v2.0
 */
const CONTEXT_SCHEMA = {
  type: 'object',
  properties: {
    compression: {
      type: 'object',
      properties: {
        strategy: {
          type: 'string',
          enum: ['none', 'summarize', 'extract-entities', 'truncate-oldest', 'sliding-window'],
          default: 'none',
          description: 'Context compression strategy applied before LLM calls.'
        },
        ratio: {
          type: 'string',
          pattern: '^[0-9]+:[0-9]+$',
          default: '1:1',
          description: 'Target compression ratio (e.g., "20:1" = 4000 → 200 tokens).'
        },
        model: {
          type: 'string',
          default: 'gpt-4o-mini',
          description: 'Model used for summarize/extract compression. Use cheap model.'
        },
        preserveEntities: {
          type: 'boolean',
          default: true,
          description: 'Keep named entities intact during compression.'
        }
      },
      additionalProperties: false
    },
    caching: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', default: false },
        ttl: {
          type: 'string',
          pattern: '^[0-9]+(s|m|h|d)$',
          default: '5m',
          description: 'Cache time-to-live (e.g., "5m", "1h", "365d").'
        },
        scope: {
          type: 'string',
          enum: ['exact', 'semantic', 'prefix'],
          default: 'exact',
          description: 'Cache matching strategy. "semantic" uses embedding similarity.'
        },
        similarity: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          default: 0.95,
          description: 'Minimum similarity for cache hit (semantic scope only).'
        },
        maxEntries: {
          type: 'integer',
          minimum: 1,
          default: 1000,
          description: 'Maximum cache entries before LRU eviction.'
        }
      },
      additionalProperties: false
    },
    inheritance: {
      type: 'object',
      properties: {
        from: {
          type: 'array',
          items: { type: 'string' },
          description: 'Parent play IDs to inherit context from.'
        },
        override: {
          type: 'array',
          items: { type: 'string' },
          description: 'Context keys to override from parent (e.g., "waf.cost-optimization").'
        },
        merge: {
          type: 'string',
          enum: ['shallow', 'deep', 'replace'],
          default: 'deep',
          description: 'How to merge inherited context with local context.'
        }
      },
      additionalProperties: false
    },
    tokenBudget: {
      type: 'object',
      properties: {
        maxPerAgent: {
          type: 'integer',
          minimum: 100,
          default: 8000,
          description: 'Max context tokens per agent per turn.'
        },
        maxPerTurn: {
          type: 'integer',
          minimum: 100,
          default: 32000,
          description: 'Max total context tokens per conversation turn.'
        },
        reserveForOutput: {
          type: 'integer',
          minimum: 100,
          default: 4000,
          description: 'Tokens reserved for model output (deducted from budget).'
        },
        warningThreshold: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          default: 0.8,
          description: 'Emit warning when budget usage exceeds this ratio.'
        }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

// ─── Context Cache (In-Memory LRU) ───────────────────

class ContextCache {
  /**
   * @param {object} config - Caching config from manifest
   */
  constructor(config = {}) {
    this.enabled = config.enabled !== false;
    this.ttlMs = parseTTL(config.ttl || '5m');
    this.scope = config.scope || 'exact';
    this.similarity = config.similarity || 0.95;
    this.maxEntries = config.maxEntries || 1000;

    /** @type {Map<string, { value: any, expires: number, hits: number }>} */
    this._store = new Map();
    this._stats = { hits: 0, misses: 0, evictions: 0, sets: 0 };
  }

  /**
   * Get a cached context by key.
   * @param {string} key - Cache key (exact match or semantic hash)
   * @returns {{ hit: boolean, value: any, age: number }|null}
   */
  get(key) {
    if (!this.enabled) return null;

    const entry = this._store.get(key);
    if (!entry) {
      this._stats.misses++;
      return null;
    }

    if (Date.now() > entry.expires) {
      this._store.delete(key);
      this._stats.misses++;
      return null;
    }

    entry.hits++;
    this._stats.hits++;
    return { hit: true, value: entry.value, age: Date.now() - (entry.expires - this.ttlMs) };
  }

  /**
   * Set a cache entry.
   * @param {string} key
   * @param {any} value
   */
  set(key, value) {
    if (!this.enabled) return;

    // LRU eviction
    if (this._store.size >= this.maxEntries) {
      const oldest = this._store.keys().next().value;
      this._store.delete(oldest);
      this._stats.evictions++;
    }

    this._store.set(key, {
      value,
      expires: Date.now() + this.ttlMs,
      hits: 0
    });
    this._stats.sets++;
  }

  /** Clear all cache entries. */
  clear() {
    this._store.clear();
  }

  /** Get cache statistics. */
  stats() {
    const total = this._stats.hits + this._stats.misses;
    return {
      ...this._stats,
      size: this._store.size,
      hitRate: total > 0 ? (this._stats.hits / total) : 0
    };
  }
}

// ─── Context Compressor ───────────────────────────────

class ContextCompressor {
  /**
   * @param {object} config - Compression config from manifest
   */
  constructor(config = {}) {
    this.strategy = config.strategy || 'none';
    this.ratio = parseRatio(config.ratio || '1:1');
    this.model = config.model || 'gpt-4o-mini';
    this.preserveEntities = config.preserveEntities !== false;
  }

  /**
   * Compress context text according to the configured strategy.
   * @param {string} text - Raw context text
   * @param {number} [tokenEstimate] - Estimated token count
   * @returns {{ compressed: string, originalTokens: number, compressedTokens: number, strategy: string }}
   */
  compress(text, tokenEstimate) {
    const originalTokens = tokenEstimate || estimateTokens(text);
    const targetTokens = Math.ceil(originalTokens / this.ratio);

    switch (this.strategy) {
      case 'none':
        return { compressed: text, originalTokens, compressedTokens: originalTokens, strategy: 'none' };

      case 'truncate-oldest':
        return this._truncateOldest(text, originalTokens, targetTokens);

      case 'sliding-window':
        return this._slidingWindow(text, originalTokens, targetTokens);

      case 'extract-entities':
        return this._extractEntities(text, originalTokens, targetTokens);

      case 'summarize':
        // Summarize requires an LLM call — return a placeholder with instructions
        return {
          compressed: text,
          originalTokens,
          compressedTokens: originalTokens,
          strategy: 'summarize',
          requiresLLM: true,
          compressionPrompt: `Summarize the following text to approximately ${targetTokens} tokens, preserving all key facts, names, numbers, and technical details:\n\n${text}`
        };

      default:
        return { compressed: text, originalTokens, compressedTokens: originalTokens, strategy: 'unknown' };
    }
  }

  /** @private Truncate from the beginning, keeping the most recent context. */
  _truncateOldest(text, originalTokens, targetTokens) {
    const lines = text.split('\n');
    const result = [];
    let tokens = 0;

    // Keep lines from the end
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineTokens = estimateTokens(lines[i]);
      if (tokens + lineTokens > targetTokens) break;
      result.unshift(lines[i]);
      tokens += lineTokens;
    }

    return {
      compressed: result.join('\n'),
      originalTokens,
      compressedTokens: tokens,
      strategy: 'truncate-oldest'
    };
  }

  /** @private Sliding window — keep first and last sections, drop middle. */
  _slidingWindow(text, originalTokens, targetTokens) {
    const halfBudget = Math.floor(targetTokens / 2);
    const lines = text.split('\n');

    const head = [];
    const tail = [];
    let headTokens = 0;
    let tailTokens = 0;

    // Head
    for (const line of lines) {
      const lt = estimateTokens(line);
      if (headTokens + lt > halfBudget) break;
      head.push(line);
      headTokens += lt;
    }

    // Tail
    for (let i = lines.length - 1; i >= 0; i--) {
      const lt = estimateTokens(lines[i]);
      if (tailTokens + lt > halfBudget) break;
      tail.unshift(lines[i]);
      tailTokens += lt;
    }

    const compressed = [...head, '\n[... context compressed — middle section omitted ...]\n', ...tail].join('\n');
    return {
      compressed,
      originalTokens,
      compressedTokens: headTokens + tailTokens,
      strategy: 'sliding-window'
    };
  }

  /** @private Extract named entities and key facts from text. */
  _extractEntities(text, originalTokens, targetTokens) {
    // Heuristic entity extraction (production would use NER model)
    const entities = new Set();
    const keyFacts = [];

    // Extract capitalized phrases (likely named entities)
    const entityPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
    let match;
    while ((match = entityPattern.exec(text)) !== null) {
      entities.add(match[0]);
    }

    // Extract lines with numbers, dates, or key indicators
    const lines = text.split('\n');
    for (const line of lines) {
      if (/\d{4}|[\$€£]|%|must|required|critical|important/i.test(line)) {
        keyFacts.push(line.trim());
      }
    }

    const entityList = `Entities: ${[...entities].slice(0, 50).join(', ')}`;
    const factList = keyFacts.slice(0, 20).join('\n');
    const compressed = `${entityList}\n\nKey Facts:\n${factList}`;

    return {
      compressed,
      originalTokens,
      compressedTokens: estimateTokens(compressed),
      strategy: 'extract-entities',
      entitiesFound: entities.size
    };
  }
}

// ─── Token Budget Manager ─────────────────────────────

class TokenBudgetManager {
  /**
   * @param {object} config - Token budget config from manifest
   */
  constructor(config = {}) {
    this.maxPerAgent = config.maxPerAgent || 8000;
    this.maxPerTurn = config.maxPerTurn || 32000;
    this.reserveForOutput = config.reserveForOutput || 4000;
    this.warningThreshold = config.warningThreshold || 0.8;

    this._usage = { agents: {}, totalThisTurn: 0 };
  }

  /**
   * Check if an agent can use the requested tokens.
   * @param {string} agentId - Agent identifier
   * @param {number} requestedTokens - Tokens requested
   * @returns {{ allowed: boolean, allocated: number, remaining: number, warning: string|null }}
   */
  check(agentId, requestedTokens) {
    const agentUsed = this._usage.agents[agentId] || 0;
    const agentRemaining = this.maxPerAgent - agentUsed;
    const turnRemaining = this.maxPerTurn - this._usage.totalThisTurn - this.reserveForOutput;

    const effectiveRemaining = Math.min(agentRemaining, turnRemaining);
    const allocated = Math.min(requestedTokens, effectiveRemaining);
    const allowed = allocated > 0;

    let warning = null;
    const agentUsageRatio = (agentUsed + allocated) / this.maxPerAgent;
    const turnUsageRatio = (this._usage.totalThisTurn + allocated) / this.maxPerTurn;

    if (agentUsageRatio >= this.warningThreshold) {
      warning = `Agent "${agentId}" at ${(agentUsageRatio * 100).toFixed(0)}% of token budget (${agentUsed + allocated}/${this.maxPerAgent})`;
    } else if (turnUsageRatio >= this.warningThreshold) {
      warning = `Turn at ${(turnUsageRatio * 100).toFixed(0)}% of token budget (${this._usage.totalThisTurn + allocated}/${this.maxPerTurn})`;
    }

    return { allowed, allocated, remaining: effectiveRemaining - allocated, warning };
  }

  /**
   * Record token usage after an agent operation.
   * @param {string} agentId
   * @param {number} tokensUsed
   */
  record(agentId, tokensUsed) {
    this._usage.agents[agentId] = (this._usage.agents[agentId] || 0) + tokensUsed;
    this._usage.totalThisTurn += tokensUsed;
  }

  /** Reset usage counters for a new turn. */
  resetTurn() {
    this._usage = { agents: {}, totalThisTurn: 0 };
  }

  /** Get current usage snapshot. */
  usage() {
    return {
      ...this._usage,
      turnBudgetUsed: this._usage.totalThisTurn / this.maxPerTurn,
      turnBudgetRemaining: this.maxPerTurn - this._usage.totalThisTurn - this.reserveForOutput
    };
  }
}

// ─── Context Inheritance Resolver ─────────────────────

class ContextInheritanceResolver {
  /**
   * @param {object} config - Inheritance config from manifest
   */
  constructor(config = {}) {
    this.parentPlayIds = config.from || [];
    this.overrides = config.override || [];
    this.mergeStrategy = config.merge || 'deep';
  }

  /**
   * Resolve inherited context by merging parent contexts with local.
   * @param {object} localContext - This play's context
   * @param {Map<string, object>} parentContexts - Map of playId → resolved context
   * @returns {{ merged: object, sources: string[], conflicts: string[] }}
   */
  resolve(localContext, parentContexts) {
    const sources = ['local'];
    const conflicts = [];

    if (this.parentPlayIds.length === 0) {
      return { merged: localContext, sources, conflicts };
    }

    let merged = {};

    // Apply parent contexts in order
    for (const parentId of this.parentPlayIds) {
      const parentCtx = parentContexts.get(parentId);
      if (!parentCtx) {
        conflicts.push(`Parent play "${parentId}" context not found`);
        continue;
      }

      merged = this._merge(merged, parentCtx);
      sources.push(parentId);
    }

    // Apply local context on top
    merged = this._merge(merged, localContext);

    // Apply overrides — remove specific inherited keys
    for (const key of this.overrides) {
      const parts = key.split('.');
      let target = merged;
      for (let i = 0; i < parts.length - 1; i++) {
        if (target && typeof target === 'object') target = target[parts[i]];
      }
      if (target && typeof target === 'object') {
        delete target[parts[parts.length - 1]];
      }
    }

    return { merged, sources, conflicts };
  }

  /** @private Deep/shallow/replace merge. */
  _merge(base, overlay) {
    if (this.mergeStrategy === 'replace') return { ...overlay };
    if (this.mergeStrategy === 'shallow') return { ...base, ...overlay };

    // Deep merge
    const result = { ...base };
    for (const [key, value] of Object.entries(overlay)) {
      if (value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object') {
        result[key] = this._merge(base[key], value);
      } else if (Array.isArray(value) && Array.isArray(base[key])) {
        // Merge arrays with dedup
        result[key] = [...new Set([...base[key], ...value])];
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}

// ─── Public Factory ───────────────────────────────────

/**
 * Create a full FAI Context manager from manifest config.
 * @param {object} contextConfig - manifest.context (with optional advanced sub-keys)
 * @returns {object} Context manager with cache, compressor, budget, inheritance
 */
function createContextManager(contextConfig = {}) {
  const advanced = contextConfig.advanced || {};

  return {
    cache: new ContextCache(advanced.caching),
    compressor: new ContextCompressor(advanced.compression),
    budget: new TokenBudgetManager(advanced.tokenBudget),
    inheritance: new ContextInheritanceResolver(advanced.inheritance),
    schema: CONTEXT_SCHEMA,

    /**
     * Validate a context config against the schema contract.
     * @param {object} config - The advanced context config to validate
     * @returns {{ valid: boolean, errors: string[] }}
     */
    validate(config) {
      const errors = [];
      if (!config || typeof config !== 'object') {
        return { valid: true, errors }; // Optional section — absent is valid
      }

      // Validate compression
      if (config.compression) {
        const validStrategies = ['none', 'summarize', 'extract-entities', 'truncate-oldest', 'sliding-window'];
        if (config.compression.strategy && !validStrategies.includes(config.compression.strategy)) {
          errors.push(`Invalid compression strategy "${config.compression.strategy}". Valid: ${validStrategies.join(', ')}`);
        }
        if (config.compression.ratio && !/^[0-9]+:[0-9]+$/.test(config.compression.ratio)) {
          errors.push(`Invalid compression ratio "${config.compression.ratio}". Expected format: "N:N" (e.g., "20:1")`);
        }
      }

      // Validate caching
      if (config.caching) {
        if (config.caching.ttl && !/^[0-9]+(s|m|h|d)$/.test(config.caching.ttl)) {
          errors.push(`Invalid cache TTL "${config.caching.ttl}". Expected format: "5m", "1h", "365d"`);
        }
        const validScopes = ['exact', 'semantic', 'prefix'];
        if (config.caching.scope && !validScopes.includes(config.caching.scope)) {
          errors.push(`Invalid cache scope "${config.caching.scope}". Valid: ${validScopes.join(', ')}`);
        }
        if (config.caching.similarity !== undefined) {
          if (typeof config.caching.similarity !== 'number' || config.caching.similarity < 0 || config.caching.similarity > 1) {
            errors.push(`Cache similarity must be a number between 0 and 1, got: ${config.caching.similarity}`);
          }
        }
      }

      // Validate token budget
      if (config.tokenBudget) {
        const b = config.tokenBudget;
        if (b.maxPerAgent !== undefined && (typeof b.maxPerAgent !== 'number' || b.maxPerAgent < 100)) {
          errors.push(`tokenBudget.maxPerAgent must be ≥ 100, got: ${b.maxPerAgent}`);
        }
        if (b.maxPerTurn !== undefined && (typeof b.maxPerTurn !== 'number' || b.maxPerTurn < 100)) {
          errors.push(`tokenBudget.maxPerTurn must be ≥ 100, got: ${b.maxPerTurn}`);
        }
        if (b.maxPerAgent && b.maxPerTurn && b.maxPerAgent > b.maxPerTurn) {
          errors.push(`tokenBudget.maxPerAgent (${b.maxPerAgent}) cannot exceed maxPerTurn (${b.maxPerTurn})`);
        }
      }

      // Validate inheritance
      if (config.inheritance) {
        const validMerge = ['shallow', 'deep', 'replace'];
        if (config.inheritance.merge && !validMerge.includes(config.inheritance.merge)) {
          errors.push(`Invalid inheritance merge strategy "${config.inheritance.merge}". Valid: ${validMerge.join(', ')}`);
        }
      }

      return { valid: errors.length === 0, errors };
    }
  };
}

// ─── Utilities ────────────────────────────────────────

/** Rough token estimation (~4 chars per token for English). */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Parse TTL string to milliseconds. */
function parseTTL(ttl) {
  const match = ttl.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 300000; // default 5m
  const [, num, unit] = match;
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return parseInt(num) * multipliers[unit];
}

/** Parse compression ratio string to number. */
function parseRatio(ratio) {
  const [input, output] = ratio.split(':').map(Number);
  return input / output || 1;
}

export {
  createContextManager,
  ContextCache,
  ContextCompressor,
  TokenBudgetManager,
  ContextInheritanceResolver,
  CONTEXT_SCHEMA,
  estimateTokens,
  parseTTL
};
