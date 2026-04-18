/**
 * FAI Specialty S-3: FAI Sessions — Stateful Agent Sessions
 * ===========================================================
 * Portable session protocol across frameworks and providers.
 * Multi-agent session state, checkpointing, recovery, and handoff.
 *
 * What competitors offer:
 *   - OpenAI Assistants: Threads API (proprietary)
 *   - AutoGen: ConversableAgent chat history
 *   - LangGraph: State checkpointing for graph nodes
 *
 * What FAI adds:
 *   - Standard session protocol across ALL frameworks/providers
 *   - Multi-agent session sharing with context transfer
 *   - Checkpoint-based recovery with configurable strategies
 *   - Portable JSON state format
 *
 * @module engine/specialties/sessions
 */

// ─── Schema Contract ──────────────────────────────────

const SESSION_SCHEMA = {
  type: 'object',
  properties: {
    persistence: {
      type: 'string',
      enum: ['in-memory', 'cosmos-db', 'redis', 'sqlite', 'postgresql', 'file-system'],
      default: 'in-memory',
      description: 'Session state backend.'
    },
    scope: {
      type: 'string',
      enum: ['single-agent', 'multi-agent', 'multi-play'],
      default: 'multi-agent',
      description: 'Session visibility scope.'
    },
    checkpointing: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', default: true },
        interval: {
          type: 'string',
          enum: ['per-turn', 'per-agent', 'timed', 'manual'],
          default: 'per-turn',
          description: 'When to create checkpoints.'
        },
        timedIntervalMs: { type: 'integer', minimum: 1000, default: 30000 },
        maxSnapshots: { type: 'integer', minimum: 1, default: 50 },
        compressionEnabled: { type: 'boolean', default: false }
      },
      additionalProperties: false
    },
    recovery: {
      type: 'object',
      properties: {
        strategy: {
          type: 'string',
          enum: ['last-checkpoint', 'best-checkpoint', 'replay-from-start', 'none'],
          default: 'last-checkpoint'
        },
        timeout: { type: 'string', pattern: '^[0-9]+(s|m|h)$', default: '30m' },
        maxRetries: { type: 'integer', minimum: 0, default: 3 }
      },
      additionalProperties: false
    },
    handoff: {
      type: 'object',
      properties: {
        contextTransfer: {
          type: 'string',
          enum: ['full', 'summary', 'selective', 'none'],
          default: 'full',
          description: 'How much context to transfer between agents.'
        },
        stateFormat: {
          type: 'string',
          enum: ['json', 'protobuf', 'msgpack'],
          default: 'json'
        },
        preserveHistory: { type: 'boolean', default: true },
        maxTransferTokens: { type: 'integer', minimum: 100, default: 8000 }
      },
      additionalProperties: false
    },
    lifecycle: {
      type: 'object',
      properties: {
        maxTurns: { type: 'integer', minimum: 1, default: 100 },
        maxDuration: { type: 'string', pattern: '^[0-9]+(s|m|h)$', default: '4h' },
        idleTimeout: { type: 'string', pattern: '^[0-9]+(s|m|h)$', default: '30m' },
        onExpiry: { type: 'string', enum: ['archive', 'delete', 'summarize-and-archive'], default: 'archive' }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

// ─── Session State ────────────────────────────────────

class SessionState {
  constructor(sessionId, config = {}) {
    this.id = sessionId;
    this.created = Date.now();
    this.lastActivity = Date.now();
    this.turnCount = 0;
    this.status = 'active'; // active, paused, expired, archived

    /** @type {Map<string, any>} Shared state accessible by all agents */
    this._state = new Map();
    /** @type {Array<{ role: string, agentId: string, content: string, timestamp: number, metadata?: object }>} */
    this._history = [];
    /** @type {Map<string, object>} Per-agent private state */
    this._agentState = new Map();

    this._config = config;
    this._maxTurns = config.lifecycle?.maxTurns || 100;
    this._maxDurationMs = parseDuration(config.lifecycle?.maxDuration || '4h');
    this._idleTimeoutMs = parseDuration(config.lifecycle?.idleTimeout || '30m');
  }

  /** Set a shared state value. */
  set(key, value) {
    this._checkActive();
    this._state.set(key, value);
    this.lastActivity = Date.now();
  }

  /** Get a shared state value. */
  get(key) {
    return this._state.get(key);
  }

  /** Get all shared state as plain object. */
  getAll() {
    return Object.fromEntries(this._state);
  }

  /** Set per-agent private state. */
  setAgentState(agentId, key, value) {
    this._checkActive();
    if (!this._agentState.has(agentId)) this._agentState.set(agentId, {});
    this._agentState.get(agentId)[key] = value;
    this.lastActivity = Date.now();
  }

  /** Get per-agent private state. */
  getAgentState(agentId) {
    return this._agentState.get(agentId) || {};
  }

  /** Add a history entry (conversation turn). */
  addTurn(role, agentId, content, metadata) {
    this._checkActive();
    this._history.push({ role, agentId, content, timestamp: Date.now(), metadata });
    this.turnCount++;
    this.lastActivity = Date.now();

    if (this.turnCount >= this._maxTurns) {
      this.status = 'expired';
    }
  }

  /** Get conversation history, optionally filtered by agent. */
  getHistory(agentId, lastN) {
    let history = agentId
      ? this._history.filter(h => h.agentId === agentId)
      : [...this._history];

    if (lastN) history = history.slice(-lastN);
    return history;
  }

  /** Check if session is still active. */
  isActive() {
    if (this.status !== 'active') return false;
    if (Date.now() - this.created > this._maxDurationMs) {
      this.status = 'expired';
      return false;
    }
    if (Date.now() - this.lastActivity > this._idleTimeoutMs) {
      this.status = 'expired';
      return false;
    }
    return true;
  }

  /** Serialize session to portable JSON. */
  serialize() {
    return {
      id: this.id,
      created: this.created,
      lastActivity: this.lastActivity,
      turnCount: this.turnCount,
      status: this.status,
      state: Object.fromEntries(this._state),
      history: this._history,
      agentState: Object.fromEntries(this._agentState)
    };
  }

  /** Restore session from serialized JSON. */
  static deserialize(data, config) {
    const session = new SessionState(data.id, config);
    session.created = data.created;
    session.lastActivity = data.lastActivity;
    session.turnCount = data.turnCount;
    session.status = data.status;
    session._state = new Map(Object.entries(data.state || {}));
    session._history = data.history || [];
    session._agentState = new Map(Object.entries(data.agentState || {}));
    return session;
  }

  _checkActive() {
    if (!this.isActive()) {
      throw new Error(`Session "${this.id}" is not active (status: ${this.status})`);
    }
  }
}

// ─── Checkpoint Manager ───────────────────────────────

class CheckpointManager {
  constructor(config = {}) {
    this.enabled = config.enabled !== false;
    this.interval = config.interval || 'per-turn';
    this.maxSnapshots = config.maxSnapshots || 50;
    this.compressionEnabled = config.compressionEnabled || false;

    /** @type {Map<string, Array<{ id: string, timestamp: number, data: object, size: number }>>} */
    this._checkpoints = new Map();
  }

  /**
   * Create a checkpoint for a session.
   * @param {SessionState} session
   * @returns {{ checkpointId: string, size: number }}
   */
  checkpoint(session) {
    if (!this.enabled) return null;

    const data = session.serialize();
    const serialized = JSON.stringify(data);
    const checkpointId = `cp_${Date.now()}_${session.turnCount}`;

    if (!this._checkpoints.has(session.id)) {
      this._checkpoints.set(session.id, []);
    }

    const checkpoints = this._checkpoints.get(session.id);

    // Enforce max snapshots — remove oldest
    while (checkpoints.length >= this.maxSnapshots) {
      checkpoints.shift();
    }

    checkpoints.push({
      id: checkpointId,
      timestamp: Date.now(),
      data,
      size: serialized.length
    });

    return { checkpointId, size: serialized.length };
  }

  /**
   * Restore session from a checkpoint.
   * @param {string} sessionId
   * @param {string} [checkpointId] - Specific checkpoint or 'latest'
   * @param {object} [sessionConfig] - Session config for restoration
   * @returns {SessionState|null}
   */
  restore(sessionId, checkpointId, sessionConfig) {
    const checkpoints = this._checkpoints.get(sessionId);
    if (!checkpoints || checkpoints.length === 0) return null;

    let checkpoint;
    if (!checkpointId || checkpointId === 'latest') {
      checkpoint = checkpoints[checkpoints.length - 1];
    } else {
      checkpoint = checkpoints.find(cp => cp.id === checkpointId);
    }

    if (!checkpoint) return null;
    return SessionState.deserialize(checkpoint.data, sessionConfig);
  }

  /**
   * List checkpoints for a session.
   * @param {string} sessionId
   * @returns {Array<{ id: string, timestamp: number, turnCount: number, size: number }>}
   */
  list(sessionId) {
    const checkpoints = this._checkpoints.get(sessionId) || [];
    return checkpoints.map(cp => ({
      id: cp.id,
      timestamp: cp.timestamp,
      turnCount: cp.data.turnCount,
      size: cp.size
    }));
  }

  /** Get the diff between two checkpoints. */
  diff(sessionId, cpIdA, cpIdB) {
    const checkpoints = this._checkpoints.get(sessionId) || [];
    const a = checkpoints.find(cp => cp.id === cpIdA);
    const b = checkpoints.find(cp => cp.id === cpIdB);

    if (!a || !b) return null;

    const diffs = [];
    const keysA = new Set(Object.keys(a.data.state));
    const keysB = new Set(Object.keys(b.data.state));

    for (const key of keysB) {
      if (!keysA.has(key)) {
        diffs.push({ key, type: 'added', value: b.data.state[key] });
      } else if (JSON.stringify(a.data.state[key]) !== JSON.stringify(b.data.state[key])) {
        diffs.push({ key, type: 'changed', from: a.data.state[key], to: b.data.state[key] });
      }
    }
    for (const key of keysA) {
      if (!keysB.has(key)) {
        diffs.push({ key, type: 'removed', value: a.data.state[key] });
      }
    }

    return {
      from: cpIdA,
      to: cpIdB,
      turnDelta: b.data.turnCount - a.data.turnCount,
      historyDelta: b.data.history.length - a.data.history.length,
      stateDiffs: diffs
    };
  }

  stats() {
    let totalCheckpoints = 0;
    let totalSize = 0;
    for (const cps of this._checkpoints.values()) {
      totalCheckpoints += cps.length;
      totalSize += cps.reduce((s, cp) => s + cp.size, 0);
    }
    return { sessions: this._checkpoints.size, totalCheckpoints, totalSizeBytes: totalSize };
  }
}

// ─── Agent Handoff Manager ────────────────────────────

class HandoffManager {
  constructor(config = {}) {
    this.contextTransfer = config.contextTransfer || 'full';
    this.stateFormat = config.stateFormat || 'json';
    this.preserveHistory = config.preserveHistory !== false;
    this.maxTransferTokens = config.maxTransferTokens || 8000;
  }

  /**
   * Prepare handoff context for agent-to-agent transfer.
   * @param {SessionState} session
   * @param {string} fromAgent
   * @param {string} toAgent
   * @returns {{ context: object, tokens: number, truncated: boolean }}
   */
  prepareHandoff(session, fromAgent, toAgent) {
    const context = {
      sessionId: session.id,
      fromAgent,
      toAgent,
      turnCount: session.turnCount,
      timestamp: Date.now()
    };

    switch (this.contextTransfer) {
      case 'full':
        context.sharedState = session.getAll();
        context.fromAgentState = session.getAgentState(fromAgent);
        if (this.preserveHistory) {
          context.history = session.getHistory();
        }
        break;

      case 'summary':
        context.sharedState = session.getAll();
        // Include only last 5 turns as summary
        context.history = session.getHistory(null, 5);
        break;

      case 'selective':
        context.sharedState = session.getAll();
        context.fromAgentState = session.getAgentState(fromAgent);
        // No history transferred
        break;

      case 'none':
        // Only session ID and metadata
        break;
    }

    // Estimate tokens and truncate if needed
    const serialized = JSON.stringify(context);
    const tokens = Math.ceil(serialized.length / 4);
    let truncated = false;

    if (tokens > this.maxTransferTokens && context.history) {
      // Progressively reduce history until under budget
      while (context.history.length > 0 && Math.ceil(JSON.stringify(context).length / 4) > this.maxTransferTokens) {
        context.history.shift();
        truncated = true;
      }
    }

    return { context, tokens: Math.ceil(JSON.stringify(context).length / 4), truncated };
  }

  /**
   * Execute a handoff — transfer context from one agent to another.
   * @param {SessionState} session
   * @param {string} fromAgent
   * @param {string} toAgent
   * @param {object} [additionalContext] - Extra context to include
   * @returns {{ success: boolean, handoffId: string, context: object }}
   */
  executeHandoff(session, fromAgent, toAgent, additionalContext) {
    const { context, tokens, truncated } = this.prepareHandoff(session, fromAgent, toAgent);

    if (additionalContext) {
      context.additional = additionalContext;
    }

    // Record handoff in session history
    session.addTurn('system', 'handoff-manager', `Handoff: ${fromAgent} → ${toAgent} (${tokens} tokens${truncated ? ', truncated' : ''})`, {
      type: 'handoff',
      fromAgent,
      toAgent,
      tokens,
      truncated
    });

    return {
      success: true,
      handoffId: `hoff_${Date.now()}_${fromAgent}_${toAgent}`,
      context,
      tokens,
      truncated
    };
  }
}

// ─── Session Manager (Public Factory) ─────────────────

/**
 * Create a FAI Session manager from manifest config.
 * @param {object} sessionConfig - manifest.session section
 * @returns {object} Session manager with sessions, checkpoints, handoffs
 */
function createSessionManager(sessionConfig = {}) {
  const checkpointMgr = new CheckpointManager(sessionConfig.checkpointing);
  const handoffMgr = new HandoffManager(sessionConfig.handoff);

  /** @type {Map<string, SessionState>} */
  const sessions = new Map();

  return {
    schema: SESSION_SCHEMA,
    checkpoints: checkpointMgr,
    handoffs: handoffMgr,

    /**
     * Create a new session.
     * @param {string} [sessionId] - Custom session ID (auto-generated if not provided)
     * @returns {SessionState}
     */
    create(sessionId) {
      const id = sessionId || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const session = new SessionState(id, sessionConfig);
      sessions.set(id, session);
      return session;
    },

    /**
     * Get an existing session by ID.
     * @param {string} sessionId
     * @returns {SessionState|null}
     */
    get(sessionId) {
      return sessions.get(sessionId) || null;
    },

    /**
     * List all active sessions.
     * @returns {Array<{ id: string, turnCount: number, status: string, lastActivity: number }>}
     */
    listActive() {
      const result = [];
      for (const [id, session] of sessions) {
        if (session.isActive()) {
          result.push({ id, turnCount: session.turnCount, status: session.status, lastActivity: session.lastActivity });
        }
      }
      return result;
    },

    /**
     * Checkpoint a session.
     * @param {string} sessionId
     * @returns {{ checkpointId: string, size: number }|null}
     */
    checkpoint(sessionId) {
      const session = sessions.get(sessionId);
      if (!session) return null;
      return checkpointMgr.checkpoint(session);
    },

    /**
     * Restore a session from checkpoint.
     * @param {string} sessionId
     * @param {string} [checkpointId]
     * @returns {SessionState|null}
     */
    restore(sessionId, checkpointId) {
      const restored = checkpointMgr.restore(sessionId, checkpointId, sessionConfig);
      if (restored) {
        restored.status = 'active';
        sessions.set(sessionId, restored);
      }
      return restored;
    },

    /**
     * Execute agent handoff within a session.
     * @param {string} sessionId
     * @param {string} fromAgent
     * @param {string} toAgent
     * @returns {{ success: boolean, handoffId: string, context: object }|null}
     */
    handoff(sessionId, fromAgent, toAgent, additionalContext) {
      const session = sessions.get(sessionId);
      if (!session) return null;
      return handoffMgr.executeHandoff(session, fromAgent, toAgent, additionalContext);
    },

    /**
     * Archive expired sessions.
     * @returns {{ archived: number }}
     */
    archiveExpired() {
      let archived = 0;
      for (const [id, session] of sessions) {
        if (!session.isActive() && session.status !== 'archived') {
          // Final checkpoint before archiving
          checkpointMgr.checkpoint(session);
          session.status = 'archived';
          archived++;
        }
      }
      return { archived };
    },

    /**
     * Validate a session config against the schema contract.
     * @param {object} config
     * @returns {{ valid: boolean, errors: string[] }}
     */
    validate(config) {
      const errors = [];
      if (!config || typeof config !== 'object') return { valid: true, errors };

      const validBackends = ['in-memory', 'cosmos-db', 'redis', 'sqlite', 'postgresql', 'file-system'];
      if (config.persistence && !validBackends.includes(config.persistence)) {
        errors.push(`Invalid session persistence backend "${config.persistence}". Valid: ${validBackends.join(', ')}`);
      }

      const validScopes = ['single-agent', 'multi-agent', 'multi-play'];
      if (config.scope && !validScopes.includes(config.scope)) {
        errors.push(`Invalid session scope "${config.scope}". Valid: ${validScopes.join(', ')}`);
      }

      if (config.checkpointing) {
        const validIntervals = ['per-turn', 'per-agent', 'timed', 'manual'];
        if (config.checkpointing.interval && !validIntervals.includes(config.checkpointing.interval)) {
          errors.push(`Invalid checkpoint interval "${config.checkpointing.interval}". Valid: ${validIntervals.join(', ')}`);
        }
      }

      if (config.recovery) {
        const validStrategies = ['last-checkpoint', 'best-checkpoint', 'replay-from-start', 'none'];
        if (config.recovery.strategy && !validStrategies.includes(config.recovery.strategy)) {
          errors.push(`Invalid recovery strategy "${config.recovery.strategy}". Valid: ${validStrategies.join(', ')}`);
        }
      }

      if (config.handoff) {
        const validTransfers = ['full', 'summary', 'selective', 'none'];
        if (config.handoff.contextTransfer && !validTransfers.includes(config.handoff.contextTransfer)) {
          errors.push(`Invalid handoff contextTransfer "${config.handoff.contextTransfer}". Valid: ${validTransfers.join(', ')}`);
        }
      }

      return { valid: errors.length === 0, errors };
    },

    stats() {
      let active = 0, expired = 0, archived = 0;
      for (const session of sessions.values()) {
        if (session.isActive()) active++;
        else if (session.status === 'archived') archived++;
        else expired++;
      }
      return { total: sessions.size, active, expired, archived, checkpoints: checkpointMgr.stats() };
    }
  };
}

// ─── Utilities ────────────────────────────────────────

function parseDuration(dur) {
  const match = dur.match(/^(\d+)(s|m|h)$/);
  if (!match) return 1800000;
  const multipliers = { s: 1000, m: 60000, h: 3600000 };
  return parseInt(match[1]) * multipliers[match[2]];
}

export {
  createSessionManager,
  SessionState,
  CheckpointManager,
  HandoffManager,
  SESSION_SCHEMA
};
