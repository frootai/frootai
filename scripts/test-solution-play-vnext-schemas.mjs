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
  'solution-play-delivery-profile.v1.schema.json',
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

test('optional agent contracts require an explicit not-applicable reason', () => {
  const validators = validatorMap();
  const titles = ['Agent Context Envelope v1', 'Agent Handoff v1', 'Agent Loop Policy v1', 'Agent Memory Policy v1'];
  for (const title of titles) {
    const validate = validators.get(title);
    assert.equal(validate({ schema_version: '1.0.0', applicability: 'not_applicable', reason: 'This play uses deterministic code only.' }), true, title);
    assert.equal(validate({ schema_version: '1.0.0', applicability: 'not_applicable' }), false, title);
    assert.equal(validate({ schema_version: '1.0.0', applicability: 'applicable' }), false, title);
  }
});

test('delivery profile rejects architecture-only applicable plays', () => {
  const validate = validatorMap().get('Solution Play Delivery Profile v1');
  assert.equal(validate({ schema_version: '1.0.0', play: '01-enterprise-rag', applicability: 'applicable' }), false);
  assert.equal(validate({ schema_version: '1.0.0', play: '01-enterprise-rag', applicability: 'not_applicable', reason: 'Delivery is intentionally outside this package.' }), true);
});