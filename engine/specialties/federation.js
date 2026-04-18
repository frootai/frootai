/**
 * FAI Specialty S-12: FAI Federation — Multi-Organization Agent Collaboration
 * =============================================================================
 * The future of AI: agents from different organizations working together
 * securely, with trust boundaries, data sharing policies, and A2A discovery.
 *
 * @module engine/specialties/federation
 */

const FEDERATION_SCHEMA = {
  type: 'object',
  properties: {
    discovery: {
      type: 'object',
      properties: {
        protocol: {
          type: 'string',
          enum: ['a2a', 'well-known', 'dns-sd', 'manual'],
          default: 'a2a',
          description: 'Agent discovery protocol. "a2a" uses Google Agent-to-Agent standard.'
        },
        agentCard: {
          type: 'string',
          default: '/.well-known/agent.json',
          description: 'Path to the agent card (A2A standard).'
        },
        registryUrl: {
          type: 'string',
          description: 'Central registry URL for federated agent discovery.'
        },
        refreshInterval: {
          type: 'string',
          pattern: '^[0-9]+(s|m|h)$',
          default: '1h',
          description: 'How often to refresh the agent registry.'
        }
      },
      additionalProperties: false
    },
    trust: {
      type: 'object',
      properties: {
        method: {
          type: 'string',
          enum: ['mutual-tls', 'oauth2', 'api-key', 'did-verification', 'none'],
          default: 'mutual-tls'
        },
        allowList: {
          type: 'array',
          items: { type: 'string' },
          description: 'Allowed partner domains (e.g., ["partner-org.dev", "acme.com"]).'
        },
        denyList: {
          type: 'array',
          items: { type: 'string' },
          description: 'Explicitly denied domains.'
        },
        requireAttestation: {
          type: 'boolean',
          default: true,
          description: 'Require FAI Trust attestation before accepting delegation.'
        }
      },
      additionalProperties: false
    },
    dataSharing: {
      type: 'object',
      properties: {
        policy: {
          type: 'string',
          enum: ['none', 'aggregated-only', 'anonymized', 'full-with-consent'],
          default: 'aggregated-only',
          description: 'Data sharing policy across federation boundaries.'
        },
        pii: {
          type: 'string',
          enum: ['never-cross-boundary', 'encrypted-only', 'with-consent'],
          default: 'never-cross-boundary'
        },
        maxPayloadSize: {
          type: 'integer',
          default: 1048576,
          description: 'Max request/response payload in bytes (1MB default).'
        },
        auditRequired: {
          type: 'boolean',
          default: true,
          description: 'All cross-boundary data exchanges must be audited.'
        }
      },
      additionalProperties: false
    },
    routing: {
      type: 'object',
      properties: {
        strategy: {
          type: 'string',
          enum: ['direct', 'gateway', 'mesh', 'hierarchical'],
          default: 'gateway',
          description: 'How agents communicate across organizations.'
        },
        timeout: { type: 'string', pattern: '^[0-9]+(s|m)$', default: '30s' },
        retries: { type: 'integer', minimum: 0, default: 2 },
        circuitBreaker: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', default: true },
            failureThreshold: { type: 'integer', default: 5 },
            resetTimeout: { type: 'string', pattern: '^[0-9]+(s|m)$', default: '60s' }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

// ─── Agent Card (A2A Standard) ────────────────────────

class AgentCard {
  /**
   * @param {object} config
   * @param {string} config.name - Agent name
   * @param {string} config.url - Agent endpoint URL
   * @param {string} config.description - Agent description
   * @param {string[]} config.capabilities - What the agent can do
   * @param {string} config.organization - Owning organization
   */
  constructor(config = {}) {
    this.name = config.name || 'unknown-agent';
    this.url = config.url || '';
    this.description = config.description || '';
    this.capabilities = config.capabilities || [];
    this.organization = config.organization || '';
    this.version = config.version || '1.0.0';
    this.protocols = config.protocols || ['a2a', 'fai'];
    this.lastSeen = Date.now();
    this.healthy = true;
  }

  /**
   * Generate A2A-compliant agent card JSON.
   * @returns {object} Agent card following Google A2A spec
   */
  toA2A() {
    return {
      name: this.name,
      url: this.url,
      description: this.description,
      capabilities: this.capabilities.map(c => ({ name: c })),
      organization: this.organization,
      version: this.version,
      protocols: this.protocols
    };
  }

  /**
   * Generate well-known agent.json.
   * @returns {object}
   */
  toWellKnown() {
    return {
      ...this.toA2A(),
      'fai-protocol': {
        version: '0.1',
        trust: { attestation: true },
        capabilities: this.capabilities
      }
    };
  }
}

// ─── Federation Registry ──────────────────────────────

class FederationRegistry {
  constructor(config = {}) {
    this.trustConfig = config.trust || {};
    this.dataPolicy = config.dataSharing || {};
    this.allowList = new Set(config.trust?.allowList || []);
    this.denyList = new Set(config.trust?.denyList || []);

    /** @type {Map<string, AgentCard>} */
    this._agents = new Map();
    /** @type {Array<{ timestamp: number, event: string, from: string, to: string, details: object }>} */
    this._auditLog = [];
  }

  /**
   * Register a remote agent.
   * @param {AgentCard} agentCard
   * @returns {{ registered: boolean, reason: string }}
   */
  register(agentCard) {
    // Trust check
    const trustResult = this._checkTrust(agentCard.organization);
    if (!trustResult.trusted) {
      return { registered: false, reason: trustResult.reason };
    }

    this._agents.set(agentCard.name, agentCard);
    this._audit('agent-registered', 'registry', agentCard.name, { organization: agentCard.organization });
    return { registered: true, reason: 'Trust verified' };
  }

  /**
   * Discover agents by capability.
   * @param {string} capability
   * @returns {AgentCard[]}
   */
  discover(capability) {
    const results = [];
    for (const agent of this._agents.values()) {
      if (agent.capabilities.includes(capability) && agent.healthy) {
        results.push(agent);
      }
    }
    return results;
  }

  /**
   * Check if a delegation request is allowed.
   * @param {string} fromOrg - Source organization
   * @param {string} toAgentName - Target agent name
   * @param {string} capability - Requested capability
   * @param {object} payload - Request payload (for data policy check)
   * @returns {{ allowed: boolean, checks: object }}
   */
  checkDelegation(fromOrg, toAgentName, capability, payload = {}) {
    const checks = {};

    // Trust check
    const trust = this._checkTrust(fromOrg);
    checks.trust = trust;

    // Agent exists and has capability
    const agent = this._agents.get(toAgentName);
    checks.agentFound = { found: !!agent, name: toAgentName };
    if (agent) {
      checks.hasCapability = { has: agent.capabilities.includes(capability), capability };
    }

    // Data policy check
    const payloadSize = JSON.stringify(payload).length;
    const maxSize = this.dataPolicy.maxPayloadSize || 1048576;
    checks.payloadSize = { size: payloadSize, maxSize, pass: payloadSize <= maxSize };

    // PII check
    if (this.dataPolicy.pii === 'never-cross-boundary') {
      const hasPII = this._detectPII(JSON.stringify(payload));
      checks.pii = { detected: hasPII, policy: 'never-cross-boundary', pass: !hasPII };
    }

    const allowed = trust.trusted &&
      agent &&
      agent.capabilities.includes(capability) &&
      checks.payloadSize.pass &&
      (!checks.pii || checks.pii.pass);

    if (this.dataPolicy.auditRequired) {
      this._audit('delegation-check', fromOrg, toAgentName, { capability, allowed, checks });
    }

    return { allowed, checks };
  }

  /**
   * Get the audit log.
   * @param {number} [lastN]
   * @returns {object[]}
   */
  getAuditLog(lastN) {
    return lastN ? this._auditLog.slice(-lastN) : [...this._auditLog];
  }

  stats() {
    let healthy = 0;
    const orgs = new Set();
    for (const agent of this._agents.values()) {
      if (agent.healthy) healthy++;
      orgs.add(agent.organization);
    }
    return {
      totalAgents: this._agents.size,
      healthyAgents: healthy,
      organizations: orgs.size,
      auditEntries: this._auditLog.length,
      trustMethod: this.trustConfig.method || 'mutual-tls'
    };
  }

  /** @private */
  _checkTrust(organization) {
    if (this.denyList.has(organization)) {
      return { trusted: false, reason: `Organization "${organization}" is on deny list` };
    }
    if (this.allowList.size > 0 && !this.allowList.has(organization)) {
      return { trusted: false, reason: `Organization "${organization}" not on allow list` };
    }
    return { trusted: true, reason: 'Trust verified' };
  }

  /** @private */
  _detectPII(text) {
    return /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(text) ||
           /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(text) ||
           /\b\d{3}-\d{2}-\d{4}\b/.test(text);
  }

  /** @private */
  _audit(event, from, to, details) {
    this._auditLog.push({ timestamp: Date.now(), event, from, to, details });
  }
}

// ─── Circuit Breaker ──────────────────────────────────

class CircuitBreaker {
  constructor(config = {}) {
    this.failureThreshold = config.failureThreshold || 5;
    this.resetTimeoutMs = parseDuration(config.resetTimeout || '60s');
    this.state = 'closed'; // closed|open|half-open
    this._failures = 0;
    this._lastFailure = 0;
    this._successesSinceHalfOpen = 0;
  }

  /**
   * Check if a call is allowed.
   * @returns {{ allowed: boolean, state: string }}
   */
  canCall() {
    if (this.state === 'closed') return { allowed: true, state: 'closed' };

    if (this.state === 'open') {
      if (Date.now() - this._lastFailure > this.resetTimeoutMs) {
        this.state = 'half-open';
        return { allowed: true, state: 'half-open' };
      }
      return { allowed: false, state: 'open' };
    }

    // half-open: allow one test call
    return { allowed: true, state: 'half-open' };
  }

  recordSuccess() {
    if (this.state === 'half-open') {
      this._successesSinceHalfOpen++;
      if (this._successesSinceHalfOpen >= 2) {
        this.state = 'closed';
        this._failures = 0;
      }
    }
    if (this.state === 'closed') this._failures = 0;
  }

  recordFailure() {
    this._failures++;
    this._lastFailure = Date.now();
    if (this._failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }
}

// ─── Public Factory ───────────────────────────────────

function createFederationSystem(federationConfig = {}) {
  const registry = new FederationRegistry(federationConfig);
  const circuitBreakers = new Map();

  return {
    registry,
    schema: FEDERATION_SCHEMA,

    /**
     * Create an agent card for a local agent.
     * @param {object} config
     * @returns {AgentCard}
     */
    createAgentCard(config) {
      return new AgentCard(config);
    },

    /**
     * Get or create a circuit breaker for a remote agent.
     * @param {string} agentName
     * @returns {CircuitBreaker}
     */
    getCircuitBreaker(agentName) {
      if (!circuitBreakers.has(agentName)) {
        circuitBreakers.set(agentName, new CircuitBreaker(federationConfig.routing?.circuitBreaker));
      }
      return circuitBreakers.get(agentName);
    },

    validate(config) {
      const errors = [];
      if (!config || typeof config !== 'object') return { valid: true, errors };

      const validProtocols = ['a2a', 'well-known', 'dns-sd', 'manual'];
      if (config.discovery?.protocol && !validProtocols.includes(config.discovery.protocol)) {
        errors.push(`Invalid discovery protocol "${config.discovery.protocol}". Valid: ${validProtocols.join(', ')}`);
      }
      const validTrust = ['mutual-tls', 'oauth2', 'api-key', 'did-verification', 'none'];
      if (config.trust?.method && !validTrust.includes(config.trust.method)) {
        errors.push(`Invalid trust method "${config.trust.method}". Valid: ${validTrust.join(', ')}`);
      }
      const validPolicies = ['none', 'aggregated-only', 'anonymized', 'full-with-consent'];
      if (config.dataSharing?.policy && !validPolicies.includes(config.dataSharing.policy)) {
        errors.push(`Invalid data sharing policy "${config.dataSharing.policy}". Valid: ${validPolicies.join(', ')}`);
      }
      const validRouting = ['direct', 'gateway', 'mesh', 'hierarchical'];
      if (config.routing?.strategy && !validRouting.includes(config.routing.strategy)) {
        errors.push(`Invalid routing strategy "${config.routing.strategy}". Valid: ${validRouting.join(', ')}`);
      }

      return { valid: errors.length === 0, errors };
    }
  };
}

function parseDuration(dur) {
  const match = dur.match(/^(\d+)(s|m|h)$/);
  if (!match) return 60000;
  const multipliers = { s: 1000, m: 60000, h: 3600000 };
  return parseInt(match[1]) * multipliers[match[2]];
}

export { createFederationSystem, FederationRegistry, AgentCard, CircuitBreaker, FEDERATION_SCHEMA };
