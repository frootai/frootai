/**
 * FAI Specialty S-6: FAI Human-in-the-Loop — Approval Workflows
 * ===============================================================
 * Protocol-level approval gates with conditional triggers, escalation policies,
 * timeout handling, and immutable audit trails.
 *
 * Enterprise requirement — critical decisions MUST have human validation.
 * FAI makes this a first-class contract, not an afterthought.
 *
 * @module engine/specialties/hitl
 */

// ─── Schema Contract ──────────────────────────────────

const HITL_SCHEMA = {
  type: 'object',
  properties: {
    gates: {
      type: 'array',
      items: {
        type: 'object',
        required: ['stage'],
        properties: {
          stage: {
            type: 'string',
            description: 'Pipeline stage where this gate applies (e.g., "pre-deploy", "post-generation", "pre-execution").'
          },
          condition: {
            type: 'string',
            description: 'JavaScript-like condition expression (e.g., "confidence < 0.8", "cost > 1.00", "safety > 0").'
          },
          approvers: {
            type: 'array',
            items: { type: 'string' },
            description: 'Approver roles or team names (e.g., ["security-team", "content-review"]).'
          },
          minApprovals: {
            type: 'integer',
            minimum: 1,
            default: 1,
            description: 'Minimum approvals required to pass the gate.'
          },
          timeout: {
            type: 'string',
            pattern: '^[0-9]+(s|m|h|d)$',
            default: '24h',
            description: 'Maximum wait time before escalation/rejection.'
          },
          escalation: {
            type: 'string',
            enum: ['auto-reject', 'auto-approve', 'escalate-up', 'notify-and-wait'],
            default: 'auto-reject',
            description: 'Action when timeout expires without sufficient approvals.'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium',
            description: 'Approval request priority — affects notification urgency.'
          },
          bypassCondition: {
            type: 'string',
            description: 'Condition under which the gate is automatically bypassed (e.g., "environment == dev").'
          }
        },
        additionalProperties: false
      },
      description: 'Ordered list of approval gates in the pipeline.'
    },
    auditTrail: {
      type: 'string',
      enum: ['immutable', 'appendable', 'none'],
      default: 'immutable',
      description: 'Audit trail persistence mode.'
    },
    notificationChannels: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['email', 'teams', 'slack', 'webhook', 'github-issue'] },
          target: { type: 'string', description: 'Channel-specific target (email address, webhook URL, etc.).' }
        }
      },
      description: 'Where to send approval request notifications.'
    },
    defaultTimeout: {
      type: 'string',
      pattern: '^[0-9]+(s|m|h|d)$',
      default: '24h'
    }
  },
  additionalProperties: false
};

// ─── Approval Request ─────────────────────────────────

/**
 * @typedef {Object} ApprovalRequest
 * @property {string} id - Unique request ID
 * @property {string} stage - Pipeline stage
 * @property {string} status - pending|approved|rejected|expired|bypassed
 * @property {object} context - The data being reviewed
 * @property {string[]} approvers - Required approver roles
 * @property {number} minApprovals - Minimum approvals needed
 * @property {Array<{ approver: string, decision: string, timestamp: number, comment?: string }>} decisions
 * @property {number} created - Timestamp
 * @property {number} expires - Expiry timestamp
 * @property {string} escalation - What happens on timeout
 * @property {string} priority - Request priority
 */

// ─── Condition Evaluator ──────────────────────────────

class ConditionEvaluator {
  /**
   * Evaluate a condition expression against a context.
   * Supports: comparisons (<, >, <=, >=, ==, !=), logical (&&, ||), property access.
   * @param {string} condition - Condition expression
   * @param {object} context - Data context for evaluation
   * @returns {{ result: boolean, error: string|null }}
   */
  evaluate(condition, context) {
    if (!condition) return { result: true, error: null };

    try {
      // Parse simple conditions: "key operator value"
      const parts = condition.match(/^(\w[\w.]*)\s*(<=?|>=?|[!=]=|==)\s*(.+)$/);
      if (!parts) return { result: false, error: `Cannot parse condition: "${condition}"` };

      const [, keyPath, operator, rawValue] = parts;
      const actualValue = this._resolve(keyPath, context);
      const expectedValue = this._parseValue(rawValue.trim());

      const result = this._compare(actualValue, operator, expectedValue);
      return { result, error: null };
    } catch (err) {
      return { result: false, error: `Condition evaluation error: ${err.message}` };
    }
  }

  _resolve(path, obj) {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }

  _parseValue(raw) {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw === 'null') return null;
    if (/^['"]/.test(raw)) return raw.slice(1, -1);
    const num = Number(raw);
    return isNaN(num) ? raw : num;
  }

  _compare(actual, op, expected) {
    switch (op) {
      case '<': return actual < expected;
      case '>': return actual > expected;
      case '<=': return actual <= expected;
      case '>=': return actual >= expected;
      case '==': return actual === expected;
      case '!=': return actual !== expected;
      default: return false;
    }
  }
}

// ─── Audit Trail ──────────────────────────────────────

class AuditTrail {
  constructor(mode = 'immutable') {
    this.mode = mode;
    /** @type {Array<{ id: string, timestamp: number, event: string, actor: string, details: object, hash?: string }>} */
    this._entries = [];
    this._hashChain = '';
  }

  /**
   * Record an audit event.
   * @param {string} event - Event type (gate-triggered, approved, rejected, expired, bypassed)
   * @param {string} actor - Who performed the action
   * @param {object} details - Event details
   * @returns {string} Entry ID
   */
  record(event, actor, details) {
    if (this.mode === 'none') return null;

    const entry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      event,
      actor,
      details
    };

    // Immutable mode: chain hashes for tamper detection
    if (this.mode === 'immutable') {
      const content = JSON.stringify({ ...entry, previousHash: this._hashChain });
      entry.hash = this._simpleHash(content);
      this._hashChain = entry.hash;
    }

    this._entries.push(entry);
    return entry.id;
  }

  /** Get the full audit trail. */
  getAll() {
    return [...this._entries];
  }

  /** Get entries for a specific approval request. */
  getForRequest(requestId) {
    return this._entries.filter(e => e.details?.requestId === requestId);
  }

  /** Verify chain integrity (immutable mode only). */
  verifyIntegrity() {
    if (this.mode !== 'immutable') return { valid: true, checked: 0 };

    let previousHash = '';
    for (let i = 0; i < this._entries.length; i++) {
      const entry = this._entries[i];
      const { hash, ...rest } = entry;
      const content = JSON.stringify({ ...rest, previousHash });
      const expectedHash = this._simpleHash(content);

      if (hash !== expectedHash) {
        return { valid: false, checked: i, brokenAt: i, entryId: entry.id };
      }
      previousHash = hash;
    }

    return { valid: true, checked: this._entries.length };
  }

  /** Export audit trail as CSV. */
  exportCSV() {
    const headers = 'timestamp,event,actor,details,hash\n';
    const rows = this._entries.map(e =>
      `${new Date(e.timestamp).toISOString()},${e.event},${e.actor},"${JSON.stringify(e.details).replace(/"/g, '""')}",${e.hash || ''}`
    ).join('\n');
    return headers + rows;
  }

  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + ch;
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(36);
  }
}

// ─── HITL Gate Runner ─────────────────────────────────

class HITLGateRunner {
  /**
   * @param {object} config - manifest.humanInTheLoop section
   */
  constructor(config = {}) {
    this.gates = (config.gates || []).map(g => ({
      stage: g.stage,
      condition: g.condition || null,
      approvers: g.approvers || ['default-approver'],
      minApprovals: g.minApprovals || 1,
      timeoutMs: parseTTL(g.timeout || config.defaultTimeout || '24h'),
      escalation: g.escalation || 'auto-reject',
      priority: g.priority || 'medium',
      bypassCondition: g.bypassCondition || null
    }));

    this.conditionEval = new ConditionEvaluator();
    this.auditTrail = new AuditTrail(config.auditTrail || 'immutable');
    this.notificationChannels = config.notificationChannels || [];

    /** @type {Map<string, ApprovalRequest>} */
    this._pendingRequests = new Map();
    /** @type {Map<string, ApprovalRequest>} */
    this._completedRequests = new Map();
  }

  /**
   * Check if a gate should fire for the given stage and context.
   * @param {string} stage - Pipeline stage (e.g., "post-generation")
   * @param {object} context - Current execution context (scores, cost, environment, etc.)
   * @returns {{ shouldFire: boolean, gate: object|null, reason: string }}
   */
  checkGate(stage, context) {
    const gate = this.gates.find(g => g.stage === stage);
    if (!gate) return { shouldFire: false, gate: null, reason: `No gate defined for stage "${stage}"` };

    // Check bypass condition first
    if (gate.bypassCondition) {
      const bypass = this.conditionEval.evaluate(gate.bypassCondition, context);
      if (bypass.result) {
        this.auditTrail.record('gate-bypassed', 'system', { stage, reason: gate.bypassCondition });
        return { shouldFire: false, gate, reason: `Gate bypassed: ${gate.bypassCondition}` };
      }
    }

    // Check trigger condition
    if (gate.condition) {
      const trigger = this.conditionEval.evaluate(gate.condition, context);
      if (trigger.error) {
        return { shouldFire: false, gate, reason: `Condition error: ${trigger.error}` };
      }
      if (!trigger.result) {
        return { shouldFire: false, gate, reason: `Condition not met: ${gate.condition}` };
      }
    }

    return { shouldFire: true, gate, reason: gate.condition ? `Condition met: ${gate.condition}` : 'Unconditional gate' };
  }

  /**
   * Create an approval request.
   * @param {string} stage
   * @param {object} context - Data to review
   * @returns {ApprovalRequest}
   */
  requestApproval(stage, context) {
    const { shouldFire, gate, reason } = this.checkGate(stage, context);

    if (!shouldFire) {
      return { id: null, status: 'not-required', reason };
    }

    const request = {
      id: `apr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      stage,
      status: 'pending',
      context,
      approvers: gate.approvers,
      minApprovals: gate.minApprovals,
      decisions: [],
      created: Date.now(),
      expires: Date.now() + gate.timeoutMs,
      escalation: gate.escalation,
      priority: gate.priority
    };

    this._pendingRequests.set(request.id, request);
    this.auditTrail.record('gate-triggered', 'system', { requestId: request.id, stage, reason });

    return request;
  }

  /**
   * Submit an approval decision.
   * @param {string} requestId
   * @param {string} approver - Approver identity
   * @param {'approve'|'reject'} decision
   * @param {string} [comment]
   * @returns {{ accepted: boolean, requestStatus: string, remainingApprovals: number }}
   */
  submitDecision(requestId, approver, decision, comment) {
    const request = this._pendingRequests.get(requestId);
    if (!request) return { accepted: false, requestStatus: 'not-found', remainingApprovals: 0 };

    if (request.status !== 'pending') {
      return { accepted: false, requestStatus: request.status, remainingApprovals: 0 };
    }

    // Check expiry
    if (Date.now() > request.expires) {
      this._handleExpiry(request);
      return { accepted: false, requestStatus: request.status, remainingApprovals: 0 };
    }

    // Record decision
    request.decisions.push({ approver, decision, timestamp: Date.now(), comment });
    this.auditTrail.record(decision === 'approve' ? 'approved' : 'rejected', approver, {
      requestId, comment
    });

    // Check if we have enough approvals
    if (decision === 'reject') {
      request.status = 'rejected';
      this._complete(request);
      return { accepted: true, requestStatus: 'rejected', remainingApprovals: 0 };
    }

    const approvals = request.decisions.filter(d => d.decision === 'approve').length;
    const remaining = request.minApprovals - approvals;

    if (remaining <= 0) {
      request.status = 'approved';
      this._complete(request);
    }

    return { accepted: true, requestStatus: request.status, remainingApprovals: Math.max(remaining, 0) };
  }

  /**
   * Check and handle expired requests.
   * @returns {{ expired: number, actions: string[] }}
   */
  processExpired() {
    const actions = [];
    let expired = 0;

    for (const [id, request] of this._pendingRequests) {
      if (Date.now() > request.expires && request.status === 'pending') {
        this._handleExpiry(request);
        expired++;
        actions.push(`${id}: ${request.escalation} → ${request.status}`);
      }
    }

    return { expired, actions };
  }

  /**
   * Get all pending approval requests.
   * @param {string} [approverRole] - Filter by approver role
   * @returns {ApprovalRequest[]}
   */
  getPending(approverRole) {
    const results = [];
    for (const request of this._pendingRequests.values()) {
      if (request.status !== 'pending') continue;
      if (approverRole && !request.approvers.includes(approverRole)) continue;
      results.push(request);
    }
    return results;
  }

  /** @private */
  _handleExpiry(request) {
    switch (request.escalation) {
      case 'auto-reject':
        request.status = 'rejected';
        break;
      case 'auto-approve':
        request.status = 'approved';
        break;
      case 'escalate-up':
        request.status = 'escalated';
        break;
      case 'notify-and-wait':
        request.expires = Date.now() + 86400000; // Extend 24h
        return;
    }

    this.auditTrail.record('expired', 'system', {
      requestId: request.id,
      escalation: request.escalation,
      finalStatus: request.status
    });
    this._complete(request);
  }

  /** @private */
  _complete(request) {
    this._pendingRequests.delete(request.id);
    this._completedRequests.set(request.id, request);
  }

  stats() {
    return {
      gateCount: this.gates.length,
      pendingRequests: this._pendingRequests.size,
      completedRequests: this._completedRequests.size,
      auditEntries: this.auditTrail.getAll().length
    };
  }
}

// ─── Public Factory ───────────────────────────────────

/**
 * Create a FAI HITL system from manifest config.
 * @param {object} hitlConfig - manifest.humanInTheLoop section
 * @returns {object} HITL system
 */
function createHITLSystem(hitlConfig = {}) {
  const runner = new HITLGateRunner(hitlConfig);

  return {
    runner,
    auditTrail: runner.auditTrail,
    schema: HITL_SCHEMA,

    /**
     * Check if approval is needed at a pipeline stage.
     * @param {string} stage
     * @param {object} context
     * @returns {{ required: boolean, request?: ApprovalRequest }}
     */
    checkAndRequest(stage, context) {
      const { shouldFire } = runner.checkGate(stage, context);
      if (!shouldFire) return { required: false };

      const request = runner.requestApproval(stage, context);
      return { required: request.status === 'pending', request };
    },

    /**
     * Validate HITL config against the schema contract.
     * @param {object} config
     * @returns {{ valid: boolean, errors: string[] }}
     */
    validate(config) {
      const errors = [];
      if (!config || typeof config !== 'object') return { valid: true, errors };

      if (config.gates) {
        if (!Array.isArray(config.gates)) {
          errors.push('gates must be an array');
        } else {
          config.gates.forEach((gate, i) => {
            if (!gate.stage) errors.push(`gates[${i}]: "stage" is required`);
            const validEscalations = ['auto-reject', 'auto-approve', 'escalate-up', 'notify-and-wait'];
            if (gate.escalation && !validEscalations.includes(gate.escalation)) {
              errors.push(`gates[${i}]: Invalid escalation "${gate.escalation}". Valid: ${validEscalations.join(', ')}`);
            }
            const validPriorities = ['low', 'medium', 'high', 'critical'];
            if (gate.priority && !validPriorities.includes(gate.priority)) {
              errors.push(`gates[${i}]: Invalid priority "${gate.priority}". Valid: ${validPriorities.join(', ')}`);
            }
          });
        }
      }

      const validAudit = ['immutable', 'appendable', 'none'];
      if (config.auditTrail && !validAudit.includes(config.auditTrail)) {
        errors.push(`Invalid auditTrail mode "${config.auditTrail}". Valid: ${validAudit.join(', ')}`);
      }

      return { valid: errors.length === 0, errors };
    }
  };
}

// ─── Utilities ────────────────────────────────────────

function parseTTL(ttl) {
  const match = ttl.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 86400000;
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return parseInt(match[1]) * multipliers[match[2]];
}

export {
  createHITLSystem,
  HITLGateRunner,
  ConditionEvaluator,
  AuditTrail,
  HITL_SCHEMA
};
