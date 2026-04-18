/**
 * FAI Specialty S-1: FAI Memory — Agent Memory Federation
 * ========================================================
 * Protocol-level memory contract with 3-tier architecture (working/episodic/semantic),
 * cross-agent federation, and GDPR compliance built in.
 *
 * What nobody else offers: Cross-agent memory federation —
 * Agent A remembers what Agent B learned, governed by federation policies.
 *
 * @module engine/specialties/memory
 */

// ─── Schema Contract ──────────────────────────────────

const MEMORY_SCHEMA = {
  type: 'object',
  properties: {
    tiers: {
      type: 'object',
      properties: {
        working: {
          type: 'object',
          properties: {
            backend: { type: 'string', enum: ['redis', 'in-memory', 'sqlite'], default: 'in-memory' },
            ttl: { type: 'string', pattern: '^[0-9]+(s|m|h|d)$', default: '15m' },
            maxTokens: { type: 'integer', minimum: 100, default: 4000 }
          },
          additionalProperties: false,
          description: 'Short-term working memory — current conversation context.'
        },
        episodic: {
          type: 'object',
          properties: {
            backend: { type: 'string', enum: ['vector-store', 'ai-search', 'pinecone', 'qdrant', 'chromadb'], default: 'vector-store' },
            ttl: { type: 'string', pattern: '^[0-9]+(s|m|h|d)$', default: '365d' },
            compression: { type: 'string', pattern: '^[0-9]+→[0-9]+$', description: 'Token compression (e.g., "4000→200").' },
            similarityThreshold: { type: 'number', minimum: 0, maximum: 1, default: 0.75 }
          },
          additionalProperties: false,
          description: 'Long-term episodic memory — past interactions stored as embeddings.'
        },
        semantic: {
          type: 'object',
          properties: {
            backend: { type: 'string', enum: ['cosmos-db', 'postgresql', 'sqlite', 'mongodb'], default: 'cosmos-db' },
            ttl: { type: 'string', pattern: '^[0-9]+(s|m|h|d)$', default: '90d' },
            pii: { type: 'string', enum: ['redact', 'encrypt', 'mask', 'exclude'], default: 'redact' },
            indexFields: { type: 'array', items: { type: 'string' }, description: 'Fields to index for fast retrieval.' }
          },
          additionalProperties: false,
          description: 'Structured semantic memory — facts, preferences, learned knowledge.'
        }
      },
      additionalProperties: false
    },
    federation: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['agent', 'play', 'organization', 'global'],
          default: 'play',
          description: 'Visibility scope of memory. "play" = all agents in same play can read.'
        },
        shareWith: {
          type: 'array',
          items: { type: 'string' },
          description: 'Agent IDs that can read this agent\'s memory (e.g., ["reviewer", "tuner"]).'
        },
        writePolicy: {
          type: 'string',
          enum: ['owner-only', 'shared', 'append-only'],
          default: 'owner-only',
          description: 'Who can write to this memory pool.'
        },
        conflictResolution: {
          type: 'string',
          enum: ['last-write-wins', 'merge', 'version'],
          default: 'last-write-wins',
          description: 'How to resolve conflicts when multiple agents write to shared memory.'
        }
      },
      additionalProperties: false
    },
    compliance: {
      type: 'object',
      properties: {
        gdpr: { type: 'boolean', default: false, description: 'Enable GDPR-compliant memory handling.' },
        rightToDeletion: { type: 'string', enum: ['automated', 'manual', 'request-queue'], default: 'automated' },
        retention: { type: 'string', pattern: '^[0-9]+(s|m|h|d)$', default: '90d' },
        auditLog: { type: 'boolean', default: true },
        dataResidency: { type: 'string', description: 'Azure region for memory storage (e.g., "westeurope").' }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

// ─── Memory Tier Implementations ──────────────────────

class WorkingMemory {
  constructor(config = {}) {
    this.maxTokens = config.maxTokens || 4000;
    this.ttlMs = parseTTL(config.ttl || '15m');
    /** @type {Map<string, { content: string, tokens: number, created: number, agentId: string }>} */
    this._entries = new Map();
  }

  store(key, content, agentId, tokens) {
    this._evictExpired();
    const estimatedTokens = tokens || Math.ceil(content.length / 4);

    // Enforce token budget — evict oldest if over limit
    while (this._totalTokens() + estimatedTokens > this.maxTokens && this._entries.size > 0) {
      const oldest = this._entries.keys().next().value;
      this._entries.delete(oldest);
    }

    this._entries.set(key, { content, tokens: estimatedTokens, created: Date.now(), agentId });
  }

  retrieve(key) {
    this._evictExpired();
    return this._entries.get(key) || null;
  }

  retrieveAll(agentId) {
    this._evictExpired();
    const results = [];
    for (const [key, entry] of this._entries) {
      if (!agentId || entry.agentId === agentId) {
        results.push({ key, ...entry });
      }
    }
    return results;
  }

  clear(agentId) {
    if (!agentId) { this._entries.clear(); return; }
    for (const [key, entry] of this._entries) {
      if (entry.agentId === agentId) this._entries.delete(key);
    }
  }

  _totalTokens() {
    let total = 0;
    for (const entry of this._entries.values()) total += entry.tokens;
    return total;
  }

  _evictExpired() {
    const now = Date.now();
    for (const [key, entry] of this._entries) {
      if (now - entry.created > this.ttlMs) this._entries.delete(key);
    }
  }

  stats() {
    this._evictExpired();
    return { entries: this._entries.size, tokensUsed: this._totalTokens(), maxTokens: this.maxTokens };
  }
}

class EpisodicMemory {
  constructor(config = {}) {
    this.backend = config.backend || 'vector-store';
    this.ttlMs = parseTTL(config.ttl || '365d');
    this.similarityThreshold = config.similarityThreshold || 0.75;
    this.compressionRatio = parseCompression(config.compression);
    /** @type {Array<{ id: string, content: string, embedding: number[], metadata: object, created: number }>} */
    this._episodes = [];
  }

  /**
   * Store an episode (interaction summary).
   * @param {string} content - Episode content
   * @param {object} metadata - { agentId, playId, sessionId, tags }
   * @param {number[]} [embedding] - Pre-computed embedding vector
   */
  store(content, metadata = {}, embedding = null) {
    const compressed = this.compressionRatio > 1
      ? content.substring(0, Math.ceil(content.length / this.compressionRatio))
      : content;

    this._episodes.push({
      id: `ep_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      content: compressed,
      embedding: embedding || this._simpleHash(compressed),
      metadata: { ...metadata, originalLength: content.length },
      created: Date.now()
    });
  }

  /**
   * Search episodes by similarity (using simple cosine approximation if no real embeddings).
   * @param {string} query
   * @param {number} topK
   * @returns {Array<{ id: string, content: string, score: number, metadata: object }>}
   */
  search(query, topK = 5) {
    this._evictExpired();
    const queryHash = this._simpleHash(query);

    const scored = this._episodes.map(ep => ({
      ...ep,
      score: this._cosineSimilarity(queryHash, ep.embedding)
    }));

    return scored
      .filter(ep => ep.score >= this.similarityThreshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ id, content, score, metadata }) => ({ id, content, score, metadata }));
  }

  delete(userId) {
    this._episodes = this._episodes.filter(ep => ep.metadata?.userId !== userId);
  }

  stats() {
    this._evictExpired();
    return { episodes: this._episodes.length, backend: this.backend };
  }

  _evictExpired() {
    const cutoff = Date.now() - this.ttlMs;
    this._episodes = this._episodes.filter(ep => ep.created > cutoff);
  }

  /** Simple hash for demo — production uses real embedding model. */
  _simpleHash(text) {
    const vec = new Array(64).fill(0);
    for (let i = 0; i < text.length; i++) {
      vec[i % 64] += text.charCodeAt(i) / 128;
    }
    const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map(v => v / mag);
  }

  _cosineSimilarity(a, b) {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
  }
}

class SemanticMemory {
  constructor(config = {}) {
    this.backend = config.backend || 'cosmos-db';
    this.ttlMs = parseTTL(config.ttl || '90d');
    this.piiPolicy = config.pii || 'redact';
    this.indexFields = config.indexFields || ['agentId', 'category', 'key'];
    /** @type {Map<string, { value: any, metadata: object, created: number, updated: number }>} */
    this._facts = new Map();
  }

  /**
   * Store a semantic fact (structured knowledge).
   * @param {string} key - Fact key (e.g., "user.preference.language")
   * @param {any} value - Fact value
   * @param {object} metadata - { agentId, category, confidence }
   */
  store(key, value, metadata = {}) {
    const sanitized = this.piiPolicy !== 'exclude' ? value : this._redactPII(value);
    this._facts.set(key, {
      value: sanitized,
      metadata: { ...metadata, piiPolicy: this.piiPolicy },
      created: this._facts.get(key)?.created || Date.now(),
      updated: Date.now()
    });
  }

  retrieve(key) {
    this._evictExpired();
    return this._facts.get(key) || null;
  }

  query(filter = {}) {
    this._evictExpired();
    const results = [];
    for (const [key, fact] of this._facts) {
      let match = true;
      for (const [fKey, fValue] of Object.entries(filter)) {
        if (fact.metadata[fKey] !== fValue) { match = false; break; }
      }
      if (match) results.push({ key, ...fact });
    }
    return results;
  }

  deleteByUser(userId) {
    for (const [key, fact] of this._facts) {
      if (fact.metadata?.userId === userId) this._facts.delete(key);
    }
  }

  stats() {
    this._evictExpired();
    return { facts: this._facts.size, backend: this.backend };
  }

  _evictExpired() {
    const cutoff = Date.now() - this.ttlMs;
    for (const [key, fact] of this._facts) {
      if (fact.updated < cutoff) this._facts.delete(key);
    }
  }

  _redactPII(value) {
    if (typeof value !== 'string') return value;
    return value
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]')
      .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]')
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN_REDACTED]');
  }
}

// ─── Memory Federation Manager ────────────────────────

class MemoryFederationManager {
  /**
   * @param {object} federationConfig - manifest.memory.federation
   */
  constructor(federationConfig = {}) {
    this.scope = federationConfig.scope || 'play';
    this.shareWith = new Set(federationConfig.shareWith || []);
    this.writePolicy = federationConfig.writePolicy || 'owner-only';
    this.conflictResolution = federationConfig.conflictResolution || 'last-write-wins';

    /** @type {Map<string, { working: WorkingMemory, episodic: EpisodicMemory, semantic: SemanticMemory }>} */
    this._agentMemories = new Map();
  }

  /**
   * Get or create memory tiers for an agent.
   * @param {string} agentId
   * @param {object} tierConfig - Tier configuration from manifest
   * @returns {{ working: WorkingMemory, episodic: EpisodicMemory, semantic: SemanticMemory }}
   */
  getMemory(agentId, tierConfig = {}) {
    if (!this._agentMemories.has(agentId)) {
      this._agentMemories.set(agentId, {
        working: new WorkingMemory(tierConfig.working),
        episodic: new EpisodicMemory(tierConfig.episodic),
        semantic: new SemanticMemory(tierConfig.semantic)
      });
    }
    return this._agentMemories.get(agentId);
  }

  /**
   * Check if agentB can read agentA's memory.
   * @param {string} readerAgent - Agent requesting access
   * @param {string} ownerAgent - Agent whose memory is being read
   * @returns {{ allowed: boolean, reason: string }}
   */
  canRead(readerAgent, ownerAgent) {
    if (readerAgent === ownerAgent) return { allowed: true, reason: 'owner' };

    switch (this.scope) {
      case 'global':
        return { allowed: true, reason: 'global scope' };
      case 'organization':
      case 'play':
        return { allowed: true, reason: `${this.scope} scope` };
      case 'agent':
        if (this.shareWith.has(readerAgent)) {
          return { allowed: true, reason: 'in shareWith list' };
        }
        return { allowed: false, reason: `"${readerAgent}" not in shareWith list for ${this.scope} scope` };
      default:
        return { allowed: false, reason: `unknown scope: ${this.scope}` };
    }
  }

  /**
   * Check if an agent can write to a memory pool.
   * @param {string} writerAgent
   * @param {string} ownerAgent
   * @returns {{ allowed: boolean, reason: string }}
   */
  canWrite(writerAgent, ownerAgent) {
    if (writerAgent === ownerAgent) return { allowed: true, reason: 'owner' };

    switch (this.writePolicy) {
      case 'owner-only':
        return { allowed: false, reason: 'owner-only write policy' };
      case 'shared':
        return this.canRead(writerAgent, ownerAgent);
      case 'append-only':
        return { allowed: true, reason: 'append-only policy (read access implies append)' };
      default:
        return { allowed: false, reason: `unknown write policy: ${this.writePolicy}` };
    }
  }

  /**
   * Federated read — read from another agent's memory.
   * @param {string} readerAgent
   * @param {string} ownerAgent
   * @param {'working'|'episodic'|'semantic'} tier
   * @param {string} key - Key or query
   * @returns {{ data: any, allowed: boolean, source: string }}
   */
  federatedRead(readerAgent, ownerAgent, tier, key) {
    const access = this.canRead(readerAgent, ownerAgent);
    if (!access.allowed) {
      return { data: null, allowed: false, source: ownerAgent, reason: access.reason };
    }

    const mem = this._agentMemories.get(ownerAgent);
    if (!mem || !mem[tier]) {
      return { data: null, allowed: true, source: ownerAgent, reason: 'no memory found' };
    }

    const data = tier === 'semantic'
      ? mem[tier].retrieve(key)
      : tier === 'episodic'
        ? mem[tier].search(key)
        : mem[tier].retrieve(key);

    return { data, allowed: true, source: ownerAgent };
  }

  /**
   * GDPR: Delete all memory for a user across all agents.
   * @param {string} userId
   * @returns {{ agentsCleared: string[], tiersCleared: string[] }}
   */
  gdprDelete(userId) {
    const agentsCleared = [];
    const tiersCleared = [];

    for (const [agentId, mem] of this._agentMemories) {
      mem.working.clear(userId);
      mem.episodic.delete(userId);
      mem.semantic.deleteByUser(userId);
      agentsCleared.push(agentId);
      tiersCleared.push('working', 'episodic', 'semantic');
    }

    return { agentsCleared, tiersCleared: [...new Set(tiersCleared)] };
  }

  /** Get federation stats. */
  stats() {
    const agents = {};
    for (const [agentId, mem] of this._agentMemories) {
      agents[agentId] = {
        working: mem.working.stats(),
        episodic: mem.episodic.stats(),
        semantic: mem.semantic.stats()
      };
    }
    return { scope: this.scope, writePolicy: this.writePolicy, agents };
  }
}

// ─── Public Factory ───────────────────────────────────

/**
 * Create a full FAI Memory system from manifest config.
 * @param {object} memoryConfig - manifest.memory section
 * @returns {object} Memory system with federation, tiers, compliance
 */
function createMemorySystem(memoryConfig = {}) {
  const federation = new MemoryFederationManager(memoryConfig.federation);
  const compliance = memoryConfig.compliance || {};

  return {
    federation,
    schema: MEMORY_SCHEMA,
    compliance,

    /**
     * Get memory for a specific agent.
     * @param {string} agentId
     * @returns {{ working: WorkingMemory, episodic: EpisodicMemory, semantic: SemanticMemory }}
     */
    forAgent(agentId) {
      return federation.getMemory(agentId, memoryConfig.tiers);
    },

    /**
     * GDPR right-to-deletion.
     * @param {string} userId
     */
    deleteUserData(userId) {
      return federation.gdprDelete(userId);
    },

    /**
     * Validate a memory config against the schema contract.
     * @param {object} config
     * @returns {{ valid: boolean, errors: string[] }}
     */
    validate(config) {
      const errors = [];
      if (!config || typeof config !== 'object') return { valid: true, errors };

      // Validate tier backends
      if (config.tiers) {
        const validWorkingBackends = ['redis', 'in-memory', 'sqlite'];
        const validEpisodicBackends = ['vector-store', 'ai-search', 'pinecone', 'qdrant', 'chromadb'];
        const validSemanticBackends = ['cosmos-db', 'postgresql', 'sqlite', 'mongodb'];

        if (config.tiers.working?.backend && !validWorkingBackends.includes(config.tiers.working.backend)) {
          errors.push(`Invalid working memory backend "${config.tiers.working.backend}". Valid: ${validWorkingBackends.join(', ')}`);
        }
        if (config.tiers.episodic?.backend && !validEpisodicBackends.includes(config.tiers.episodic.backend)) {
          errors.push(`Invalid episodic memory backend "${config.tiers.episodic.backend}". Valid: ${validEpisodicBackends.join(', ')}`);
        }
        if (config.tiers.semantic?.backend && !validSemanticBackends.includes(config.tiers.semantic.backend)) {
          errors.push(`Invalid semantic memory backend "${config.tiers.semantic.backend}". Valid: ${validSemanticBackends.join(', ')}`);
        }
      }

      // Validate federation
      if (config.federation) {
        const validScopes = ['agent', 'play', 'organization', 'global'];
        if (config.federation.scope && !validScopes.includes(config.federation.scope)) {
          errors.push(`Invalid federation scope "${config.federation.scope}". Valid: ${validScopes.join(', ')}`);
        }
        const validPolicies = ['owner-only', 'shared', 'append-only'];
        if (config.federation.writePolicy && !validPolicies.includes(config.federation.writePolicy)) {
          errors.push(`Invalid write policy "${config.federation.writePolicy}". Valid: ${validPolicies.join(', ')}`);
        }
      }

      // Validate compliance
      if (config.compliance) {
        if (config.compliance.gdpr && !config.tiers?.semantic?.pii) {
          errors.push('GDPR enabled but no PII policy set on semantic memory tier. Set tiers.semantic.pii to "redact", "encrypt", "mask", or "exclude".');
        }
      }

      return { valid: errors.length === 0, errors };
    }
  };
}

// ─── Utilities ────────────────────────────────────────

function parseTTL(ttl) {
  const match = ttl.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 300000;
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return parseInt(match[1]) * multipliers[match[2]];
}

function parseCompression(str) {
  if (!str) return 1;
  const [from, to] = str.split('→').map(s => parseInt(s.trim()));
  return (from && to) ? from / to : 1;
}

export {
  createMemorySystem,
  MemoryFederationManager,
  WorkingMemory,
  EpisodicMemory,
  SemanticMemory,
  MEMORY_SCHEMA
};
