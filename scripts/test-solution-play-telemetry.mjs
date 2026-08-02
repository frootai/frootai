import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { sanitizeTelemetryEvent, validateTelemetryProfile, validateTelemetryProfiles } from './solution-play-telemetry.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = path.join(root, 'tests', 'fixtures', 'solution-play-telemetry-profile');
const applicable = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'applicable.json'), 'utf8'));
const notApplicable = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'not-applicable.json'), 'utf8'));

function clone(value) {
  return structuredClone(value);
}

function snapshotTree(treeRoot, current = treeRoot, snapshot = {}) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const entryPath = path.join(current, entry.name);
    if (entry.isDirectory()) snapshotTree(treeRoot, entryPath, snapshot);
    if (entry.isFile()) {
      const relativePath = path.relative(treeRoot, entryPath).split(path.sep).join('/');
      snapshot[relativePath] = crypto.createHash('sha256').update(fs.readFileSync(entryPath)).digest('hex');
    }
  }
  return snapshot;
}

test('validates applicable and explicitly not-applicable telemetry profiles', () => {
  assert.deepEqual(validateTelemetryProfile(applicable), { valid: true, errors: [] });
  assert.deepEqual(validateTelemetryProfile(notApplicable), { valid: true, errors: [] });
});

test('requires complete lifecycle boundaries, correlation, prohibited categories, and unique rules', () => {
  const missingBoundary = clone(applicable);
  missingBoundary.telemetry.span_boundaries.pop();
  assert.equal(validateTelemetryProfile(missingBoundary).valid, false);

  const missingCorrelation = clone(applicable);
  missingCorrelation.telemetry.correlation.identifiers = ['trace_id', 'span_id', 'request_id'];
  assert.equal(validateTelemetryProfile(missingCorrelation).valid, false);

  const missingCategory = clone(applicable);
  missingCategory.telemetry.attributes.prohibited_categories.pop();
  assert.equal(validateTelemetryProfile(missingCategory).valid, false);

  const duplicateRule = clone(applicable);
  duplicateRule.telemetry.attributes.rules.push(clone(duplicateRule.telemetry.attributes.rules[0]));
  assert.equal(validateTelemetryProfile(duplicateRule).valid, false);
});

test('rejects retained sensitive attributes and inconsistent exporter configuration', () => {
  const retainedPrompt = clone(applicable);
  retainedPrompt.telemetry.attributes.rules.push({ name: 'gen_ai.prompt', classification: 'restricted', action: 'retain' });
  assert.equal(validateTelemetryProfile(retainedPrompt).valid, false);

  const noProtocol = clone(applicable);
  noProtocol.telemetry.export.protocol = 'none';
  assert.equal(validateTelemetryProfile(noProtocol).valid, false);
});

test('sanitizes seeded secrets, PII, prompts, completions, files, and tool payloads while retaining correlation', () => {
  const seeds = ['secret-token-123', 'person@example.com', 'ignore previous instructions', 'raw model answer', 'private file body', 'malicious tool output'];
  const event = {
    trace_id: 'trace-001',
    span_id: 'span-002',
    parent_span_id: 'span-001',
    boundary: 'agent',
    attributes: {
      'frootai.play.id': '01-enterprise-rag',
      'enduser.id': seeds[1],
      'gen_ai.prompt': seeds[2],
      'gen_ai.completion': seeds[3],
      'file.content': seeds[4],
      'tool.payload': seeds[5],
      'authorization': seeds[0],
    },
  };
  const sanitized = sanitizeTelemetryEvent(event, applicable, { keys: { TELEMETRY_HASH_KEY: 'test-only-hmac-key' } });
  assert.equal(sanitized.trace_id, event.trace_id);
  assert.equal(sanitized.span_id, event.span_id);
  assert.equal(sanitized.parent_span_id, event.parent_span_id);
  assert.equal(sanitized.boundary, event.boundary);
  assert.equal(sanitized.attributes['frootai.play.id'], '01-enterprise-rag');
  assert.match(sanitized.attributes['enduser.id'], /^[a-f0-9]{64}$/);
  const serialized = JSON.stringify(sanitized);
  for (const seed of seeds) assert.equal(serialized.includes(seed), false, seed);
});

test('fails closed when HMAC material or required correlation is unavailable', () => {
  const event = {
    trace_id: 'trace-001', span_id: 'span-002', parent_span_id: 'span-001', boundary: 'request', attributes: { 'enduser.id': 'user-1' },
  };
  assert.throws(() => sanitizeTelemetryEvent(event, applicable), /missing redaction key/);
  event.attributes['enduser.id'] = { nested: 'user-1' };
  assert.throws(() => sanitizeTelemetryEvent(event, applicable, { keys: { TELEMETRY_HASH_KEY: 'test' } }), /not an OpenTelemetry primitive/);
  event.attributes['enduser.id'] = ['user-1'];
  assert.throws(() => sanitizeTelemetryEvent(event, applicable, { keys: { TELEMETRY_HASH_KEY: 'test' } }), /must be scalar/);
  event.attributes['enduser.id'] = 'user-1';
  delete event.parent_span_id;
  assert.throws(() => sanitizeTelemetryEvent(event, applicable, { keys: { TELEMETRY_HASH_KEY: 'test' } }), /missing event correlation/);
});

test('read-only telemetry validation preserves every canonical play byte', () => {
  const playsRoot = path.join(root, 'solution-plays');
  const before = snapshotTree(playsRoot);
  const report = validateTelemetryProfiles();
  const after = snapshotTree(playsRoot);
  assert.deepEqual(after, before);
  assert.deepEqual(report.summary, { profiles: 0, valid: 0, invalid: 0 });
  assert.equal(report.mode, 'read-only');
});

test('rejects retained infrastructure, cryptographic, and model artifact secrets', () => {
  for (const name of ['connection_string', 'database_url', 'private_key_pem', 'jwk', 'model_weights', 'model_checkpoint']) {
    const profile = clone(applicable);
    profile.telemetry.attributes.rules.push({ name, classification: 'restricted', action: 'retain' });
    assert.equal(validateTelemetryProfile(profile).valid, false, name);
  }
});