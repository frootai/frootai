import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { authorizeMcpRequest, boundMcpResult, compileMcpSchema, createMcpDiscoveryRequest, createMcpElicitation, createMcpRequestMeta, createMcpSubscription, createMcpTaskCoordinator, createMcpTraceMeta, decodeMcpCursor, encodeMcpCursor, loadDefaultMcpUtilitiesPolicy, paginateMcpItems, validateMcpDiscoveryResult, validateMcpSubscriptionAcknowledgement, validateMcpUtilitiesPolicy, verifyMcpApproval } from './solution-play-mcp-utilities.mjs';
import { sha256 } from './solution-play-claude-plugin.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(root, 'scripts', 'solution-play-mcp-utilities.mjs');

function policy() { return structuredClone(loadDefaultMcpUtilitiesPolicy()); }

test('strict policy binds T224 and selects only registry-verified Python v2', () => {
  const document = policy();
  assert.deepEqual(validateMcpUtilitiesPolicy(document), { valid: true, errors: [] });
  assert.equal(document.protocol_version, '2026-07-28');
  assert.equal(document.boundaries.sdk_adapter, 'python-v2');
  const drift = policy();
  drift.conformance_profile_sha256 = '0'.repeat(64);
  assert.equal(validateMcpUtilitiesPolicy(drift).valid, false);
});

test('request metadata and discovery use current stateless protocol shapes', () => {
  const document = policy();
  const options = { id: 1, clientCapabilities: { elicitation: {} }, clientInfo: { name: 'frootai-test', version: '1.0.0' }, traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' };
  const request = createMcpDiscoveryRequest(document, options);
  assert.equal(request.method, 'server/discover');
  assert.equal(request.params._meta['io.modelcontextprotocol/protocolVersion'], '2026-07-28');
  assert.deepEqual(request.params._meta['io.modelcontextprotocol/clientCapabilities'], { elicitation: {} });
  const result = validateMcpDiscoveryResult(document, { resultType: 'complete', supportedVersions: ['2026-07-28'], capabilities: { tools: { listChanged: true } }, ttlMs: 300000, cacheScope: 'public' });
  assert.equal(result.capabilities.tools.listChanged, true);
  assert.throws(() => validateMcpDiscoveryResult(document, { resultType: 'complete', supportedVersions: ['2025-11-25'], capabilities: {} }), /does not support/);
});

test('JSON Schema utility rejects external refs and validates tool arguments', () => {
  const document = policy();
  const validate = compileMcpSchema(document, { type: 'object', additionalProperties: false, required: ['query'], properties: { query: { type: 'string', minLength: 1 } } });
  assert.deepEqual(validate({ query: 'bounded' }), { valid: true, errors: [] });
  assert.equal(validate({ query: '', extra: true }).valid, false);
  assert.throws(() => compileMcpSchema(document, { $ref: 'https://untrusted.example/schema.json' }), /external/);
  let deep = { type: 'string' };
  for (let index = 0; index < document.limits.maximum_schema_depth + 1; index += 1) deep = { type: 'object', properties: { nested: deep } };
  assert.throws(() => compileMcpSchema(document, deep), /nesting depth/);
});

test('opaque pagination cursors are scoped, expiring, signed, and bounded', () => {
  const document = policy();
  const secret = crypto.randomBytes(32);
  const bindingSha256 = sha256('agent-1');
  const first = paginateMcpItems(document, [1, 2, 3, 4], { limit: 2, scope: 'tools', bindingSha256, secret, now: 1000 });
  assert.deepEqual(first.items, [1, 2]);
  assert.equal(typeof first.nextCursor, 'string');
  const second = paginateMcpItems(document, [1, 2, 3, 4], { cursor: first.nextCursor, limit: 2, scope: 'tools', bindingSha256, secret, now: 2000 });
  assert.deepEqual(second, { items: [3, 4], nextCursor: undefined });
  assert.throws(() => decodeMcpCursor(document, first.nextCursor, { scope: 'resources', bindingSha256, now: 2000 }, secret), /scope/);
  assert.throws(() => decodeMcpCursor(document, first.nextCursor, { scope: 'tools', bindingSha256: sha256('agent-2'), now: 2000 }, secret), /binding/);
  assert.throws(() => decodeMcpCursor(document, `${first.nextCursor}x`, { scope: 'tools', bindingSha256, now: 2000 }, secret), /signature/);
  assert.throws(() => decodeMcpCursor(document, first.nextCursor, { scope: 'tools', bindingSha256, now: 301000 }, secret), /expiry/);
  assert.throws(() => encodeMcpCursor(document, { offset: 1, scope: 'tools', bindingSha256, now: 0 }, 'short'), /too short/);
});

test('oversized tool output becomes a bounded deterministic error', () => {
  const document = policy();
  const safe = { resultType: 'complete', content: [{ type: 'text', text: 'ok' }] };
  assert.deepEqual(boundMcpResult(document, safe), safe);
  const bounded = boundMcpResult(document, { resultType: 'complete', content: [{ type: 'text', text: 'x'.repeat(70000) }] });
  assert.equal(bounded.isError, true);
  assert.equal(bounded._meta['frootai/bounded'], true);
  assert.equal('frootai/originalSha256' in bounded._meta, false);
  const circular = { resultType: 'complete' };
  circular.content = [circular];
  assert.throws(() => boundMcpResult(document, circular), /cycle/);
});

test('trace context rejects malformed or all-zero identifiers', () => {
  assert.deepEqual(createMcpTraceMeta({ traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01', tracestate: 'vendor=value' }), { traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01', tracestate: 'vendor=value' });
  assert.throws(() => createMcpTraceMeta({ traceparent: '00-00000000000000000000000000000000-00f067aa0ba902b7-01' }), /invalid/);
  assert.throws(() => createMcpTraceMeta({ traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01' }), /invalid/);
  assert.throws(() => createMcpTraceMeta({ traceparent: 'bad' }), /invalid/);
});

test('authorization delegates token verification and enforces audience, expiry, and scopes', async () => {
  const document = policy();
  const now = 100000;
  const verify = async (token) => token === 'valid' ? { sub: 'agent-1', aud: ['mcp://frootai'], exp: 200, scope: 'tools.read tools.call' } : null;
  const result = await authorizeMcpRequest(document, { token: 'valid', verify, audience: 'mcp://frootai', requiredScopes: ['tools.call'], now });
  assert.equal(result.subject, 'agent-1');
  await assert.rejects(authorizeMcpRequest(document, { token: 'valid', verify, audience: 'wrong', requiredScopes: [], now }), /do not satisfy/);
  await assert.rejects(authorizeMcpRequest(document, { token: 'valid', verify, audience: 'mcp:\/\/frootai', requiredScopes: ['admin'], now }), /do not satisfy/);
  await assert.rejects(authorizeMcpRequest(document, { token: 'invalid', verify, audience: 'mcp://frootai', requiredScopes: [], now }), /must be an object/);
  await assert.rejects(authorizeMcpRequest(document, { token: 'valid', verify, audience: 'mcp://frootai', requiredScopes: [], now: 260000 }), /do not satisfy/);
  const boundedPolicy = policy();
  boundedPolicy.security.external_operation_timeout_ms = 100;
  await assert.rejects(authorizeMcpRequest(boundedPolicy, { token: 'stalled', verify: async () => new Promise(() => {}), audience: 'mcp://frootai', now }), /exceeded the external operation timeout/);
});

test('approval verification binds action, request digest, expiry, and external verifier', async () => {
  const document = policy();
  const requestSha256 = sha256('request');
  const bindingSha256 = sha256('agent-1/session-1');
  const receipt = { approval_id: 'approval-1', nonce: 'nonce-1', status: 'approved', action: 'tools/call:deploy', request_sha256: requestSha256, binding_sha256: bindingSha256, expires_at: '2026-08-03T01:00:00Z', approvers: ['operator@example.invalid'], signature: 'external' };
  const consumed = new Set();
  const consume = async ({ approval_id, nonce }) => !consumed.has(`${approval_id}/${nonce}`) && (consumed.add(`${approval_id}/${nonce}`), true);
  const result = await verifyMcpApproval(document, receipt, { action: receipt.action, requestSha256, bindingSha256, verify: async () => true, consume, now: Date.parse('2026-08-03T00:00:00Z') });
  assert.equal(result.approval_id, 'approval-1');
  await assert.rejects(verifyMcpApproval(document, receipt, { action: receipt.action, requestSha256, bindingSha256, verify: async () => true, consume, now: Date.parse('2026-08-03T00:00:00Z') }), /already consumed/);
  await assert.rejects(verifyMcpApproval(document, receipt, { action: 'different', requestSha256, bindingSha256, verify: async () => true, consume, now: Date.parse('2026-08-03T00:00:00Z') }), /mismatched/);
});

test('elicitation and subscriptions are bounded and capability-correlated', () => {
  const document = policy();
  const elicitation = createMcpElicitation(document, { elicitationId: 'confirm', message: 'Confirm this bounded operation.', requestedSchema: { type: 'object', properties: { approved: { type: 'boolean' } }, required: ['approved'] } });
  assert.equal(elicitation.resultType, 'input_required');
  assert.throws(() => createMcpElicitation(document, { elicitationId: 'url', message: 'Authenticate through this endpoint.', requestedSchema: { type: 'object' }, mode: 'url', url: 'http://insecure.example' }), /HTTPS/);
  const requested = createMcpSubscription(document, { notifications: { toolsListChanged: true }, resourceUris: ['note://two', 'note://one'] });
  assert.deepEqual(requested.resourceUris, ['note://one', 'note://two']);
  const honored = validateMcpSubscriptionAcknowledgement(7, requested, { method: 'notifications/subscriptions/acknowledged', params: { _meta: { 'io.modelcontextprotocol/subscriptionId': 7 }, notifications: { toolsListChanged: true } } });
  assert.deepEqual(honored, { toolsListChanged: true });
  assert.throws(() => validateMcpSubscriptionAcknowledgement(7, requested, { method: 'notifications/subscriptions/acknowledged', params: { _meta: { 'io.modelcontextprotocol/subscriptionId': 8 }, notifications: {} } }), /uncorrelated/);
  assert.throws(() => createMcpSubscription(document, { notifications: { toolsListChanged: 'yes' } }), /must be booleans/);
});

test('Tasks require durable storage and enforce input, terminal, and cancellation transitions', async () => {
  const document = policy();
  assert.throws(() => createMcpTaskCoordinator(document, { store: { durable: false } }), /durable atomic store/);
  const records = new Map();
  const store = { durable: true, atomic: true, async get(id) { return structuredClone(records.get(id)); }, async create(id, value) { if (records.has(id)) return false; records.set(id, structuredClone(value)); return true; }, async transact(id, update) { const next = update(structuredClone(records.get(id))); records.set(id, structuredClone(next)); return structuredClone(next); } };
  let now = 1000;
  const tasks = createMcpTaskCoordinator(document, { store, clock: () => now, idFactory: () => 'task-1' });
  const created = await tasks.create({ method: 'tools/call', requestSha256: sha256('call') });
  assert.equal(created.status, 'working');
  await assert.rejects(tasks.create({ method: 'tools/call', requestSha256: sha256('other') }), /collided/);
  await tasks.requireInput('task-1', { approval: { mode: 'form', requestedSchema: { type: 'object', additionalProperties: false, required: ['approved'], properties: { approved: { type: 'boolean' } } } } });
  await assert.rejects(tasks.complete('task-1', { resultType: 'complete', content: [] }), /current state/);
  await assert.rejects(tasks.update('task-1', { approval: { approved: 'yes' } }), /does not satisfy/);
  const resumed = await tasks.update('task-1', { approval: { approved: true } });
  assert.equal(resumed.status, 'working');
  const completed = await tasks.complete('task-1', { resultType: 'complete', content: [{ type: 'text', text: 'done' }] });
  assert.equal(completed.status, 'completed');
  assert.equal((await tasks.cancel('task-1')).status, 'completed');
  now = completed.expires_at;
  await assert.rejects(tasks.get('task-1'), /expired/);
});

test('atomic task transactions reject concurrent duplicate input updates', async () => {
  const document = policy();
  const records = new Map();
  let queue = Promise.resolve();
  const store = {
    durable: true,
    atomic: true,
    async get(id) { return structuredClone(records.get(id)); },
    async create(id, value) { if (records.has(id)) return false; records.set(id, structuredClone(value)); return true; },
    async transact(id, update) {
      const operation = queue.then(() => {
        const next = update(structuredClone(records.get(id)));
        records.set(id, structuredClone(next));
        return structuredClone(next);
      });
      queue = operation.catch(() => {});
      return operation;
    },
  };
  const tasks = createMcpTaskCoordinator(document, { store, clock: () => 1000, idFactory: () => 'task-concurrent' });
  await tasks.create({ method: 'tools/call', requestSha256: sha256('concurrent') });
  await tasks.requireInput('task-concurrent', { approval: { mode: 'form', requestedSchema: { type: 'object', required: ['approved'], properties: { approved: { type: 'boolean' } } } } });
  const results = await Promise.allSettled([
    tasks.update('task-concurrent', { approval: { approved: true } }),
    tasks.update('task-concurrent', { approval: { approved: true } }),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
});

test('CLI reports the full neutral utility surface without runtime or publication claims', () => {
  const result = spawnSync(process.execPath, [cliPath], { cwd: root, encoding: 'utf8', shell: false });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, 'valid');
  assert.equal(output.protocol_version, '2026-07-28');
  assert.equal(output.sdk_adapter, 'python-v2');
  assert.equal(output.utility_contracts.length, 10);
  assert.equal(output.external_store_required, true);
  assert.equal(output.external_verifiers_required, true);
  assert.equal(output.canonical_writes_allowed, false);
  assert.equal(output.publication_allowed, false);
});