import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaNames = [
  'solution-play-spec.vNext.schema.json',
  'solution-play-claude-foundation.v1.schema.json',
  'solution-play-claude-marketplace.v1.schema.json',
  'solution-play-claude-plugin.v1.schema.json',
  'solution-play-developer-profile.v1.schema.json',
  'solution-play-delivery-profile.v1.schema.json',
  'solution-play-telemetry-profile.v1.schema.json',
  'solution-play-evaluation-profile.v1.schema.json',
  'solution-play-identity-profile.v1.schema.json',
  'solution-play-operations-profile.v1.schema.json',
  'solution-play-mcp-conformance.v1.schema.json',
  'solution-play-mcp-utilities.v1.schema.json',
  'agent-context-envelope.v1.schema.json',
  'agent-handoff.v1.schema.json',
  'agent-loop-policy.v1.schema.json',
  'agent-memory-policy.v1.schema.json',
  'solution-play-certification-evidence.v2.schema.json',
];
const schemas = schemaNames.map((name) => JSON.parse(fs.readFileSync(path.join(root, 'schemas', name), 'utf8')));

function validatorMap() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  for (const schema of schemas) ajv.addSchema(schema);
  return new Map(schemas.map((schema) => [schema.title, ajv.getSchema(schema.$id)]));
}

test('all vNext schemas compile in strict mode', () => {
  const validators = validatorMap();
  assert.equal(validators.size, schemaNames.length);
  for (const validate of validators.values()) assert.equal(typeof validate, 'function');
});

test('optional developer and agent contracts require an explicit not-applicable reason', () => {
  const validators = validatorMap();
  const titles = ['Solution Play Developer Profile v1', 'Agent Context Envelope v1', 'Agent Handoff v1', 'Agent Loop Policy v1', 'Agent Memory Policy v1'];
  for (const title of titles) {
    const validate = validators.get(title);
    const developerProfile = title === 'Solution Play Developer Profile v1';
    const play = developerProfile ? { play: '01-enterprise-rag' } : {};
    const schemaVersion = developerProfile ? '1.1.0' : '1.0.0';
    assert.equal(validate({ schema_version: schemaVersion, ...play, applicability: 'not_applicable', reason: 'This play uses deterministic code only.' }), true, title);
    assert.equal(validate({ schema_version: schemaVersion, applicability: 'not_applicable' }), false, title);
    assert.equal(validate({ schema_version: schemaVersion, applicability: 'applicable' }), false, title);
  }
});

test('delivery profile rejects architecture-only applicable plays', () => {
  const validate = validatorMap().get('Solution Play Delivery Profile v1');
  assert.equal(validate({ schema_version: '1.2.0', play: '01-enterprise-rag', applicability: 'applicable' }), false);
  assert.equal(validate({ schema_version: '1.2.0', play: '01-enterprise-rag', applicability: 'not_applicable', reason: 'Delivery is intentionally outside this package.' }), true);
});

test('vNext specification requires telemetry and evaluation contract references', () => {
  const validate = validatorMap().get('Solution Play Specification vNext');
  const spec = {
    schema_version: '2.3.0',
    play: '01-enterprise-rag',
    version: '1.0.0',
    title: 'Enterprise RAG',
    description: 'A secure enterprise retrieval augmented generation reference implementation.',
    architecture: {
      runtime: { pattern: 'workflow', description: 'A typed retrieval and generation workflow with explicit security boundaries.' },
      developer_agents: { topology: 'none', rationale: 'Developer agents are intentionally outside this runtime fixture.' },
    },
    contracts: {
      delivery_profile: 'contracts/delivery-profile.v1.json',
      developer_profile: 'contracts/developer-profile.v1.json',
      telemetry: 'contracts/telemetry-profile.v1.json',
      evaluation: 'contracts/evaluation-profile.v1.json',
      identity: 'contracts/identity-profile.v1.json',
      operations: 'contracts/operations-profile.v1.json',
      context: 'contracts/context.v1.json',
      handoff: 'contracts/handoff.v1.json',
      loop: 'contracts/loop.v1.json',
      memory: 'contracts/memory.v1.json',
      evidence: 'contracts/evidence.v2.json'
    },
    official_sources: [{ url: 'https://example.com/reference', retrieved_at: '2026-08-02T00:00:00Z', status: 'ga', tested_version: '1.0.0', claim: 'Fixture source' }]
  };
  assert.equal(validate(spec), true, JSON.stringify(validate.errors));
  delete spec.contracts.telemetry;
  assert.equal(validate(spec), false);
});

test('vNext specification requires developer, identity, and operations contract references', () => {
  const validate = validatorMap().get('Solution Play Specification vNext');
  const spec = {
    schema_version: '2.3.0', play: '01-enterprise-rag', version: '1.0.0', title: 'Enterprise RAG',
    description: 'A secure enterprise retrieval augmented generation reference implementation.',
    architecture: { runtime: { pattern: 'workflow', description: 'A typed runtime workflow with explicit operational controls.' }, developer_agents: { topology: 'none', rationale: 'Developer agents are intentionally outside this runtime fixture.' } },
    contracts: { delivery_profile: 'contracts/delivery-profile.v1.json', developer_profile: 'contracts/developer-profile.v1.json', telemetry: 'contracts/telemetry-profile.v1.json', evaluation: 'contracts/evaluation-profile.v1.json', identity: 'contracts/identity-profile.v1.json', operations: 'contracts/operations-profile.v1.json', context: 'contracts/context.v1.json', handoff: 'contracts/handoff.v1.json', loop: 'contracts/loop.v1.json', memory: 'contracts/memory.v1.json', evidence: 'contracts/evidence.v2.json' },
    official_sources: [{ url: 'https://example.com/reference', retrieved_at: '2026-08-02T00:00:00Z', status: 'ga', tested_version: '1.0.0', claim: 'Fixture source' }]
  };
  assert.equal(validate(spec), true, JSON.stringify(validate.errors));
  delete spec.contracts.developer_profile;
  assert.equal(validate(spec), false);
  spec.contracts.developer_profile = 'contracts/developer-profile.v1.json';
  delete spec.contracts.identity;
  assert.equal(validate(spec), false);
  spec.contracts.identity = 'contracts/identity-profile.v1.json';
  delete spec.contracts.operations;
  assert.equal(validate(spec), false);
});