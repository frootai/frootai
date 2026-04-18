/**
 * FAI Engine — Specialties Index
 * ================================
 * Central registry for all 12 FAI Specialties. Each specialty is a first-class
 * protocol contract that extends fai-manifest.json v2.0.
 *
 * Usage:
 *   import { createSpecialties } from './specialties/index.js';
 *   const specs = createSpecialties(manifest);
 *   specs.context.cache.get('key');
 *   specs.reasoning.detectAntiPatterns(response);
 *   specs.sessions.create('session-1');
 *
 * @module engine/specialties
 */

import { createContextManager, CONTEXT_SCHEMA } from './context.js';
import { createReasoningEngine, REASONING_SCHEMA } from './reasoning.js';
import { createMemorySystem, MEMORY_SCHEMA } from './memory.js';
import { createSessionManager, SESSION_SCHEMA } from './sessions.js';
import { createPlanningEngine, PLANNING_SCHEMA } from './planning.js';
import { createHITLSystem, HITL_SCHEMA } from './hitl.js';
import { createReplaySystem, REPLAY_SCHEMA } from './replay.js';
import { createGraphSystem, GRAPH_SCHEMA } from './graphs.js';
import { createCodingPipeline, CODING_SCHEMA } from './coding.js';
import { createVoicePipeline, VOICE_SCHEMA } from './voice.js';
import { createTrustSystem, TRUST_SCHEMA } from './trust.js';
import { createFederationSystem, FEDERATION_SCHEMA } from './federation.js';

/**
 * All 12 specialty schemas for manifest extension.
 */
const SPECIALTY_SCHEMAS = {
  context: CONTEXT_SCHEMA,
  reasoning: REASONING_SCHEMA,
  memory: MEMORY_SCHEMA,
  session: SESSION_SCHEMA,
  planning: PLANNING_SCHEMA,
  humanInTheLoop: HITL_SCHEMA,
  replay: REPLAY_SCHEMA,
  knowledgeGraph: GRAPH_SCHEMA,
  agenticCoding: CODING_SCHEMA,
  voice: VOICE_SCHEMA,
  trust: TRUST_SCHEMA,
  federation: FEDERATION_SCHEMA
};

/**
 * Specialty metadata for discovery.
 */
const SPECIALTY_CATALOG = [
  { id: 'S-1', key: 'memory',          name: 'FAI Memory',        priority: 'P1', description: 'Agent Memory Federation — 3-tier memory with cross-agent sharing' },
  { id: 'S-2', key: 'context',         name: 'FAI Context',       priority: 'P0', description: 'Intelligent Context Management — compression, caching, inheritance' },
  { id: 'S-3', key: 'session',         name: 'FAI Sessions',      priority: 'P1', description: 'Stateful Agent Sessions — checkpoints, recovery, handoff' },
  { id: 'S-4', key: 'reasoning',       name: 'FAI Reasoning',     priority: 'P0', description: 'Deterministic Reasoning Chains — strategy presets, anti-pattern detection' },
  { id: 'S-5', key: 'planning',        name: 'FAI Planning',      priority: 'P2', description: 'Task Decomposition & Execution — graph-based planning with loop prevention' },
  { id: 'S-6', key: 'humanInTheLoop',  name: 'FAI Human-in-the-Loop', priority: 'P1', description: 'Approval Workflows — conditional gates, escalation, audit trails' },
  { id: 'S-7', key: 'replay',          name: 'FAI Replay',        priority: 'P2', description: 'Agent Decision Replay & Debugging — deterministic replay, diff comparison' },
  { id: 'S-8', key: 'knowledgeGraph',  name: 'FAI Knowledge Graphs', priority: 'P2', description: 'Graph-Enhanced RAG — entity extraction, traversal, hybrid search' },
  { id: 'S-9', key: 'agenticCoding',   name: 'FAI Agentic Coding', priority: 'P3', description: 'Issue-to-PR Pipeline — self-healing, scope guards, cost caps' },
  { id: 'S-10', key: 'voice',          name: 'FAI Voice',         priority: 'P3', description: 'Real-Time Voice Agent Pipeline — STT→LLM→TTS with latency targets' },
  { id: 'S-11', key: 'trust',          name: 'FAI Trust',         priority: 'P3', description: 'Agent Identity & Capability Attestation — DID, merkle audit chains' },
  { id: 'S-12', key: 'federation',     name: 'FAI Federation',    priority: 'P3', description: 'Multi-Organization Agent Collaboration — A2A discovery, trust boundaries' }
];

/**
 * Create all specialties from a manifest.
 * Only initializes specialties that have configuration in the manifest.
 *
 * @param {object} manifest - The full fai-manifest.json
 * @returns {object} Initialized specialties
 */
function createSpecialties(manifest = {}) {
  const specs = {};

  // Always initialize P0 specialties (they have sensible defaults)
  specs.context = createContextManager(manifest.context);
  specs.reasoning = createReasoningEngine(manifest.reasoning);

  // Initialize P1 specialties if configured or if there's relevant context
  if (manifest.memory) specs.memory = createMemorySystem(manifest.memory);
  if (manifest.session) specs.sessions = createSessionManager(manifest.session);
  if (manifest.humanInTheLoop) specs.hitl = createHITLSystem(manifest.humanInTheLoop);

  // Initialize P2 specialties if configured
  if (manifest.planning) specs.planning = createPlanningEngine(manifest.planning);
  if (manifest.replay) specs.replay = createReplaySystem(manifest.replay);
  if (manifest.knowledgeGraph) specs.graph = createGraphSystem(manifest.knowledgeGraph);

  // Initialize P3 specialties if configured
  if (manifest.agenticCoding) specs.coding = createCodingPipeline(manifest.agenticCoding);
  if (manifest.voice) specs.voice = createVoicePipeline(manifest.voice);
  if (manifest.trust) specs.trust = createTrustSystem(manifest.trust);
  if (manifest.federation) specs.federation = createFederationSystem(manifest.federation);

  return specs;
}

/**
 * Validate all specialty configs in a manifest.
 * @param {object} manifest - The full fai-manifest.json
 * @returns {{ valid: boolean, errors: string[], specialtiesFound: string[] }}
 */
function validateSpecialties(manifest = {}) {
  const allErrors = [];
  const found = [];

  const validators = {
    context:         { key: 'context',         fn: () => createContextManager(manifest.context).validate(manifest.context?.advanced) },
    reasoning:       { key: 'reasoning',       fn: () => createReasoningEngine(manifest.reasoning).validate(manifest.reasoning) },
    memory:          { key: 'memory',          fn: () => createMemorySystem(manifest.memory).validate(manifest.memory) },
    session:         { key: 'session',         fn: () => createSessionManager(manifest.session).validate(manifest.session) },
    planning:        { key: 'planning',        fn: () => createPlanningEngine(manifest.planning).validate(manifest.planning) },
    humanInTheLoop:  { key: 'humanInTheLoop',  fn: () => createHITLSystem(manifest.humanInTheLoop).validate(manifest.humanInTheLoop) },
    replay:          { key: 'replay',          fn: () => createReplaySystem(manifest.replay).validate(manifest.replay) },
    knowledgeGraph:  { key: 'knowledgeGraph',  fn: () => createGraphSystem(manifest.knowledgeGraph).validate(manifest.knowledgeGraph) },
    agenticCoding:   { key: 'agenticCoding',   fn: () => createCodingPipeline(manifest.agenticCoding).validate(manifest.agenticCoding) },
    voice:           { key: 'voice',           fn: () => createVoicePipeline(manifest.voice).validate(manifest.voice) },
    trust:           { key: 'trust',           fn: () => createTrustSystem(manifest.trust).validate(manifest.trust) },
    federation:      { key: 'federation',      fn: () => createFederationSystem(manifest.federation).validate(manifest.federation) }
  };

  for (const [name, { key, fn }] of Object.entries(validators)) {
    if (manifest[key]) {
      found.push(name);
      try {
        const result = fn();
        if (!result.valid) {
          allErrors.push(...result.errors.map(e => `[${name}] ${e}`));
        }
      } catch (err) {
        allErrors.push(`[${name}] Validation error: ${err.message}`);
      }
    }
  }

  return { valid: allErrors.length === 0, errors: allErrors, specialtiesFound: found };
}

/**
 * Get the combined manifest schema extension for all specialties.
 * @returns {object} JSON Schema properties for all specialty sections
 */
function getManifestExtension() {
  return {
    type: 'object',
    properties: { ...SPECIALTY_SCHEMAS },
    description: 'FAI Specialties — advanced capabilities declared at the protocol level.'
  };
}

export {
  createSpecialties,
  validateSpecialties,
  getManifestExtension,
  SPECIALTY_SCHEMAS,
  SPECIALTY_CATALOG
};
