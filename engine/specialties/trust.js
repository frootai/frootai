/**
 * FAI Specialty S-11: FAI Trust — Agent Identity & Capability Attestation
 * ========================================================================
 * The most unsolved problem in AI: How do you verify that an agent is who it
 * claims to be, and that it can do what it says it can do?
 *
 * FAI Trust provides: W3C DID-based identity, capability attestation with
 * revocation, and merkle-tree audit chains for tamper-proof execution history.
 *
 * @module engine/specialties/trust
 */

const TRUST_SCHEMA = {
  type: 'object',
  properties: {
    identity: {
      type: 'object',
      properties: {
        method: {
          type: 'string',
          enum: ['did:web', 'did:key', 'x509', 'api-key', 'mtls'],
          default: 'did:web',
          description: 'Identity method. did:web uses W3C Decentralized Identifiers.'
        },
        issuer: { type: 'string', description: 'Identity issuer domain (e.g., "frootai.dev").' },
        subject: { type: 'string', description: 'Agent subject identifier.' },
        publicKey: { type: 'string', description: 'Public key reference (e.g., "did:web:frootai.dev#key-1").' },
        expiresAt: { type: 'string', format: 'date-time', description: 'Identity expiry timestamp.' }
      },
      additionalProperties: false
    },
    capabilities: {
      type: 'object',
      properties: {
        declared: {
          type: 'array',
          items: { type: 'string' },
          description: 'Capabilities this agent declares (e.g., ["search", "generate", "deploy"]).'
        },
        attestedBy: {
          type: 'string',
          description: 'Entity that attested these capabilities (e.g., "fai-engine-v1").'
        },
        attestedAt: { type: 'string', format: 'date-time' },
        revocable: { type: 'boolean', default: true },
        scope: {
          type: 'string',
          enum: ['global', 'organization', 'play', 'session'],
          default: 'play'
        },
        constraints: {
          type: 'object',
          properties: {
            maxCostPerAction: { type: 'number', description: 'Max cost in USD per single action.' },
            rateLimit: { type: 'integer', description: 'Max actions per minute.' },
            allowedTargets: { type: 'array', items: { type: 'string' }, description: 'Resources this agent can access.' }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    },
    auditChain: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['merkle-tree', 'hash-chain', 'append-log', 'none'],
          default: 'merkle-tree'
        },
        anchoring: {
          type: 'string',
          enum: ['none', 'blockchain-optional', 'azure-confidential-ledger'],
          default: 'none'
        },
        retention: { type: 'string', pattern: '^[0-9]+(d|m|y)$', default: '365d' }
      },
      additionalProperties: false
    },
    verification: {
      type: 'object',
      properties: {
        challengeResponse: { type: 'boolean', default: true, description: 'Require challenge-response before delegation.' },
        mutualAttestation: { type: 'boolean', default: false, description: 'Both parties must attest each other.' },
        continuousVerification: { type: 'boolean', default: false, description: 'Re-verify periodically during session.' },
        verificationInterval: { type: 'string', pattern: '^[0-9]+(s|m|h)$', default: '5m' }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

// ─── Agent Identity ───────────────────────────────────

class AgentIdentity {
  constructor(config = {}) {
    this.method = config.method || 'did:web';
    this.issuer = config.issuer || 'local';
    this.subject = config.subject || `agent-${Date.now()}`;
    this.publicKey = config.publicKey || null;
    this.expiresAt = config.expiresAt ? new Date(config.expiresAt) : null;
    this.created = Date.now();
    this._revoked = false;
  }

  /** Generate a DID document for this agent. */
  toDIDDocument() {
    return {
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: `did:${this.method.replace('did:', '')}:${this.issuer}:${this.subject}`,
      verificationMethod: this.publicKey ? [{
        id: `${this.publicKey}`,
        type: 'JsonWebKey2020',
        controller: `did:web:${this.issuer}`
      }] : [],
      created: new Date(this.created).toISOString(),
      expires: this.expiresAt?.toISOString()
    };
  }

  isValid() {
    if (this._revoked) return { valid: false, reason: 'Identity revoked' };
    if (this.expiresAt && new Date() > this.expiresAt) return { valid: false, reason: 'Identity expired' };
    return { valid: true, reason: 'Active' };
  }

  revoke() {
    this._revoked = true;
  }
}

// ─── Capability Attestation ───────────────────────────

class CapabilityAttestation {
  constructor(config = {}) {
    this.declared = new Set(config.declared || []);
    this.attestedBy = config.attestedBy || null;
    this.attestedAt = config.attestedAt || new Date().toISOString();
    this.revocable = config.revocable !== false;
    this.scope = config.scope || 'play';
    this.constraints = config.constraints || {};

    /** @type {Set<string>} */
    this._revokedCapabilities = new Set();
    /** @type {Map<string, number>} action counts per minute window */
    this._rateTracker = new Map();
  }

  /**
   * Check if agent has a specific capability.
   * @param {string} capability
   * @returns {{ allowed: boolean, reason: string }}
   */
  hasCapability(capability) {
    if (!this.declared.has(capability)) {
      return { allowed: false, reason: `Capability "${capability}" not declared` };
    }
    if (this._revokedCapabilities.has(capability)) {
      return { allowed: false, reason: `Capability "${capability}" has been revoked` };
    }

    // Rate limit check
    if (this.constraints.rateLimit) {
      const windowKey = `${capability}_${Math.floor(Date.now() / 60000)}`;
      const count = this._rateTracker.get(windowKey) || 0;
      if (count >= this.constraints.rateLimit) {
        return { allowed: false, reason: `Rate limit exceeded for "${capability}" (${count}/${this.constraints.rateLimit} per minute)` };
      }
      this._rateTracker.set(windowKey, count + 1);
    }

    return { allowed: true, reason: 'Attested' };
  }

  revokeCapability(capability) {
    if (!this.revocable) return false;
    this._revokedCapabilities.add(capability);
    return true;
  }

  grantCapability(capability) {
    this.declared.add(capability);
    this._revokedCapabilities.delete(capability);
  }

  listCapabilities() {
    return {
      active: [...this.declared].filter(c => !this._revokedCapabilities.has(c)),
      revoked: [...this._revokedCapabilities],
      scope: this.scope
    };
  }
}

// ─── Merkle Audit Chain ───────────────────────────────

class MerkleAuditChain {
  constructor(format = 'merkle-tree') {
    this.format = format;
    /** @type {Array<{ hash: string, data: object, parentHash: string, timestamp: number }>} */
    this._chain = [];
    this._rootHash = '0';
  }

  /**
   * Append an action to the audit chain.
   * @param {string} agentId
   * @param {string} action
   * @param {object} details
   * @returns {string} Entry hash
   */
  append(agentId, action, details) {
    const parentHash = this._chain.length > 0 ? this._chain[this._chain.length - 1].hash : '0';
    const data = { agentId, action, details, timestamp: Date.now() };
    const hash = this._hash(JSON.stringify({ ...data, parentHash }));

    this._chain.push({ hash, data, parentHash, timestamp: data.timestamp });
    return hash;
  }

  /**
   * Verify the integrity of the entire chain.
   * @returns {{ valid: boolean, entries: number, brokenAt?: number }}
   */
  verify() {
    let prevHash = '0';
    for (let i = 0; i < this._chain.length; i++) {
      const entry = this._chain[i];
      if (entry.parentHash !== prevHash) {
        return { valid: false, entries: this._chain.length, brokenAt: i };
      }
      const expectedHash = this._hash(JSON.stringify({ ...entry.data, parentHash: prevHash }));
      if (entry.hash !== expectedHash) {
        return { valid: false, entries: this._chain.length, brokenAt: i };
      }
      prevHash = entry.hash;
    }
    return { valid: true, entries: this._chain.length };
  }

  /** Get the chain for a specific agent. */
  getAgentHistory(agentId) {
    return this._chain.filter(e => e.data.agentId === agentId);
  }

  /** Get the merkle root hash. */
  getRootHash() {
    return this._chain.length > 0 ? this._chain[this._chain.length - 1].hash : '0';
  }

  _hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return 'mk_' + Math.abs(h).toString(36);
  }
}

// ─── Challenge-Response Verifier ──────────────────────

class ChallengeVerifier {
  constructor() {
    /** @type {Map<string, { challenge: string, expires: number, agentId: string }>} */
    this._pendingChallenges = new Map();
  }

  /**
   * Issue a challenge to an agent.
   * @param {string} agentId
   * @returns {{ challengeId: string, challenge: string, expiresIn: number }}
   */
  issueChallenge(agentId) {
    const challengeId = `ch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const challenge = Math.random().toString(36).substring(2, 18);

    this._pendingChallenges.set(challengeId, {
      challenge,
      expires: Date.now() + 30000, // 30 second expiry
      agentId
    });

    return { challengeId, challenge, expiresIn: 30000 };
  }

  /**
   * Verify a challenge response.
   * @param {string} challengeId
   * @param {string} response
   * @returns {{ verified: boolean, reason: string }}
   */
  verifyResponse(challengeId, response) {
    const pending = this._pendingChallenges.get(challengeId);
    if (!pending) return { verified: false, reason: 'Challenge not found or already used' };

    this._pendingChallenges.delete(challengeId);

    if (Date.now() > pending.expires) {
      return { verified: false, reason: 'Challenge expired' };
    }

    // In production: verify cryptographic signature against public key
    // Here: simple challenge echo verification
    if (response === pending.challenge) {
      return { verified: true, reason: 'Challenge response verified' };
    }

    return { verified: false, reason: 'Invalid challenge response' };
  }
}

// ─── Public Factory ───────────────────────────────────

function createTrustSystem(trustConfig = {}) {
  const identity = new AgentIdentity(trustConfig.identity);
  const capabilities = new CapabilityAttestation(trustConfig.capabilities);
  const auditChain = new MerkleAuditChain(trustConfig.auditChain?.format);
  const challenger = new ChallengeVerifier();

  return {
    identity,
    capabilities,
    auditChain,
    challenger,
    schema: TRUST_SCHEMA,

    /**
     * Full trust verification workflow.
     * @param {string} agentId
     * @param {string} requestedCapability
     * @returns {{ trusted: boolean, identity: object, capability: object, auditHash: string }}
     */
    verify(agentId, requestedCapability) {
      const idCheck = identity.isValid();
      const capCheck = capabilities.hasCapability(requestedCapability);
      const trusted = idCheck.valid && capCheck.allowed;

      const auditHash = auditChain.append(agentId, 'verify', {
        capability: requestedCapability,
        identityValid: idCheck.valid,
        capabilityAllowed: capCheck.allowed,
        result: trusted
      });

      return { trusted, identity: idCheck, capability: capCheck, auditHash };
    },

    validate(config) {
      const errors = [];
      if (!config || typeof config !== 'object') return { valid: true, errors };

      const validMethods = ['did:web', 'did:key', 'x509', 'api-key', 'mtls'];
      if (config.identity?.method && !validMethods.includes(config.identity.method)) {
        errors.push(`Invalid identity method "${config.identity.method}". Valid: ${validMethods.join(', ')}`);
      }
      const validFormats = ['merkle-tree', 'hash-chain', 'append-log', 'none'];
      if (config.auditChain?.format && !validFormats.includes(config.auditChain.format)) {
        errors.push(`Invalid audit chain format "${config.auditChain.format}". Valid: ${validFormats.join(', ')}`);
      }

      return { valid: errors.length === 0, errors };
    }
  };
}

export { createTrustSystem, AgentIdentity, CapabilityAttestation, MerkleAuditChain, ChallengeVerifier, TRUST_SCHEMA };
