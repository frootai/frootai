#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { sha256, stableJson } from './solution-play-claude-plugin.mjs';
import { loadDefaultMcpConformanceProfile, resolveMcpSdkAdapter } from './solution-play-mcp-conformance.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policyPath = path.join(repositoryRoot, 'data', 'mcp', 'utilities-policy.v1.json');
const traceparentPattern = /^00-[a-f0-9]{32}-[a-f0-9]{16}-[a-f0-9]{2}$/;
const terminalTaskStatuses = new Set(['completed', 'failed', 'cancelled']);
let policyValidator;

function readJson(filePath) {
  const descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    if (!fs.fstatSync(descriptor).isFile()) throw new Error(`MCP utility source must be a regular file: ${path.basename(filePath)}`);
    return JSON.parse(fs.readFileSync(descriptor, 'utf8'));
  } finally {
    fs.closeSync(descriptor);
  }
}

function compilePolicyValidator() {
  if (policyValidator) return policyValidator;
  const schema = readJson(path.join(repositoryRoot, 'schemas', 'solution-play-mcp-utilities.v1.schema.json'));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  policyValidator = ajv.compile(schema);
  return policyValidator;
}

function byteLength(value) {
  return Buffer.byteLength(typeof value === 'string' ? value : safeStableJson(value), 'utf8');
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
}

function assertHex(value, length, label) {
  if (typeof value !== 'string' || !new RegExp(`^[a-f0-9]{${length}}$`).test(value)) throw new Error(`${label} must be ${length} lowercase hexadecimal characters`);
}

function assertJsonTree(value, { maximumDepth = 64, label = 'JSON value' } = {}, depth = 0, ancestors = new WeakSet()) {
  if (depth > maximumDepth) throw new Error(`${label} exceeds the maximum nesting depth`);
  if (value === null || ['string', 'boolean'].includes(typeof value)) return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${label} contains a non-finite number`);
    return;
  }
  if (typeof value !== 'object') throw new Error(`${label} contains a non-JSON value`);
  if (ancestors.has(value)) throw new Error(`${label} contains a cycle`);
  ancestors.add(value);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) throw new Error(`${label} contains a non-plain object`);
  for (const item of Array.isArray(value) ? value : Object.values(value)) assertJsonTree(item, { maximumDepth, label }, depth + 1, ancestors);
  ancestors.delete(value);
}

function safeStableJson(value, options) {
  assertJsonTree(value, options);
  return stableJson(value);
}

async function callExternal(policy, label, operation) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`${label} exceeded the external operation timeout`));
    }, policy.security.external_operation_timeout_ms);
  });
  try { return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), timeout]); }
  finally { clearTimeout(timer); }
}

function externalReference(value) {
  if (Array.isArray(value)) return value.some(externalReference);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, item]) => key === '$ref' ? typeof item !== 'string' || !item.startsWith('#') : externalReference(item));
}

export function validateMcpUtilitiesPolicy(document) {
  const validate = compilePolicyValidator();
  const errors = validate(document) ? [] : validate.errors.map((error) => `${error.instancePath || '/'} ${error.message}`);
  if (errors.length === 0) {
    const conformance = loadDefaultMcpConformanceProfile();
    const digest = sha256(stableJson(conformance));
    if (digest !== document.conformance_profile_sha256) errors.push('MCP utility policy does not bind the canonical conformance profile');
    try { resolveMcpSdkAdapter(conformance, document.boundaries.sdk_adapter); }
    catch (error) { errors.push(`MCP utility SDK adapter is unavailable: ${error.message}`); }
    if (document.tasks.default_ttl_ms > document.tasks.maximum_ttl_ms) errors.push('default task TTL exceeds maximum task TTL');
  }
  return { valid: errors.length === 0, errors };
}

function requirePolicy(policy) {
  const validation = validateMcpUtilitiesPolicy(policy);
  if (!validation.valid) throw new Error(`MCP utilities policy invalid: ${validation.errors.join('; ')}`);
}

export function createMcpRequestMeta(policy, { clientCapabilities, clientInfo, traceparent, tracestate } = {}) {
  requirePolicy(policy);
  assertPlainObject(clientCapabilities, 'client capabilities');
  assertJsonTree(clientCapabilities, { maximumDepth: policy.limits.maximum_schema_depth, label: 'client capabilities' });
  if (byteLength(clientCapabilities) > policy.limits.maximum_schema_bytes) throw new Error('client capabilities exceed the byte limit');
  const meta = {
    'io.modelcontextprotocol/protocolVersion': policy.protocol_version,
    'io.modelcontextprotocol/clientCapabilities': structuredClone(clientCapabilities),
  };
  if (clientInfo !== undefined) {
    assertPlainObject(clientInfo, 'client info');
    if (typeof clientInfo.name !== 'string' || !clientInfo.name || typeof clientInfo.version !== 'string' || !clientInfo.version) throw new Error('client info requires name and version');
    meta['io.modelcontextprotocol/clientInfo'] = { name: clientInfo.name, version: clientInfo.version };
  }
  if (traceparent !== undefined) Object.assign(meta, createMcpTraceMeta({ traceparent, tracestate }));
  return meta;
}

export function createMcpDiscoveryRequest(policy, options) {
  if (!options || !(typeof options.id === 'string' && options.id.length > 0) && !(Number.isSafeInteger(options.id) && options.id >= 0)) throw new Error('discovery request id is invalid');
  return { jsonrpc: '2.0', id: options.id, method: 'server/discover', params: { _meta: createMcpRequestMeta(policy, options) } };
}

export function validateMcpDiscoveryResult(policy, result) {
  requirePolicy(policy);
  assertPlainObject(result, 'discovery result');
  if (result.resultType !== 'complete' || !Array.isArray(result.supportedVersions) || !result.supportedVersions.includes(policy.protocol_version)) throw new Error('discovery result does not support the current protocol');
  assertPlainObject(result.capabilities, 'server capabilities');
  assertJsonTree(result.capabilities, { maximumDepth: policy.limits.maximum_schema_depth, label: 'server capabilities' });
  if (result.ttlMs !== undefined && (!Number.isInteger(result.ttlMs) || result.ttlMs < 0 || result.ttlMs > policy.limits.maximum_discovery_ttl_ms)) throw new Error('discovery TTL is invalid');
  if (result.cacheScope !== undefined && !['public', 'private', 'no-store'].includes(result.cacheScope)) throw new Error('discovery cache scope is invalid');
  return Object.freeze({ supportedVersions: Object.freeze([...result.supportedVersions]), capabilities: Object.freeze(structuredClone(result.capabilities)), ttlMs: result.ttlMs ?? 0, cacheScope: result.cacheScope ?? 'no-store' });
}

export function compileMcpSchema(policy, schema) {
  requirePolicy(policy);
  assertPlainObject(schema, 'MCP JSON Schema');
  assertJsonTree(schema, { maximumDepth: policy.limits.maximum_schema_depth, label: 'MCP JSON Schema' });
  if (byteLength(schema) > policy.limits.maximum_schema_bytes) throw new Error('MCP JSON Schema exceeds the byte limit');
  if (!policy.security.external_schema_references_allowed && externalReference(schema)) throw new Error('external MCP JSON Schema references are prohibited');
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(structuredClone(schema));
  return (value) => ({ valid: validate(value), errors: validate.errors ? validate.errors.map((error) => `${error.instancePath || '/'} ${error.message}`) : [] });
}

function requireCursorSecret(policy, secret) {
  const value = Buffer.isBuffer(secret) ? secret : Buffer.from(secret ?? '', 'utf8');
  if (value.length < policy.security.minimum_cursor_secret_bytes) throw new Error('cursor secret is too short');
  return value;
}

function signCursor(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function encodeMcpCursor(policy, { offset, scope, bindingSha256, now = Date.now() }, secret) {
  requirePolicy(policy);
  if (!Number.isSafeInteger(offset) || offset < 0 || typeof scope !== 'string' || scope.length < 1) throw new Error('cursor offset or scope is invalid');
  assertHex(bindingSha256, 64, 'cursor binding digest');
  const key = requireCursorSecret(policy, secret);
  const payload = Buffer.from(stableJson({ v: 1, offset, scope, binding_sha256: bindingSha256, issued_at: now, expires_at: now + policy.limits.cursor_ttl_ms }), 'utf8').toString('base64url');
  return `${payload}.${signCursor(payload, key)}`;
}

export function decodeMcpCursor(policy, cursor, { scope, bindingSha256, now = Date.now() }, secret) {
  requirePolicy(policy);
  assertHex(bindingSha256, 64, 'cursor binding digest');
  if (typeof cursor !== 'string' || cursor.length > 2048) throw new Error('cursor is invalid');
  const [payload, signature, extra] = cursor.split('.');
  if (!payload || !signature || extra) throw new Error('cursor is malformed');
  const expected = signCursor(payload, requireCursorSecret(policy, secret));
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(actualBytes, expectedBytes)) throw new Error('cursor signature is invalid');
  let document;
  try { document = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); }
  catch { throw new Error('cursor payload is invalid'); }
  if (document.v !== 1 || document.scope !== scope || document.binding_sha256 !== bindingSha256 || !Number.isSafeInteger(document.offset) || document.offset < 0 || !Number.isFinite(document.issued_at) || document.issued_at > now + policy.security.clock_skew_seconds * 1000 || !Number.isFinite(document.expires_at) || document.expires_at - document.issued_at !== policy.limits.cursor_ttl_ms || now >= document.expires_at) throw new Error('cursor binding, scope, offset, version, issue time, or expiry is invalid');
  return document.offset;
}

export function paginateMcpItems(policy, items, { cursor, limit = policy.limits.maximum_page_size, scope, bindingSha256, secret, now = Date.now() }) {
  requirePolicy(policy);
  if (!Array.isArray(items) || !Number.isInteger(limit) || limit < 1 || limit > policy.limits.maximum_page_size) throw new Error('pagination items or limit is invalid');
  const offset = cursor ? decodeMcpCursor(policy, cursor, { scope, bindingSha256, now }, secret) : 0;
  if (offset > items.length) throw new Error('cursor offset exceeds the collection');
  const page = items.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  return { items: structuredClone(page), nextCursor: nextOffset < items.length ? encodeMcpCursor(policy, { offset: nextOffset, scope, bindingSha256, now }, secret) : undefined };
}

export function boundMcpResult(policy, result) {
  requirePolicy(policy);
  assertPlainObject(result, 'MCP result');
  assertJsonTree(result, { maximumDepth: policy.limits.maximum_schema_depth, label: 'MCP result' });
  const contentItems = Array.isArray(result.content) ? result.content.length : 0;
  if (contentItems <= policy.limits.maximum_content_items && byteLength(result) <= policy.limits.maximum_result_bytes) return structuredClone(result);
  const bounded = { resultType: 'complete', isError: true, content: [{ type: 'text', text: 'Result exceeded configured MCP output limits.' }], _meta: { 'frootai/bounded': true } };
  if (byteLength(bounded) > policy.limits.maximum_result_bytes) throw new Error('configured MCP result limit cannot hold the bounded error');
  return bounded;
}

export function createMcpTraceMeta({ traceparent, tracestate } = {}) {
  if (!traceparentPattern.test(traceparent ?? '')) throw new Error('traceparent is invalid');
  const [, traceId, spanId] = traceparent.match(/^00-([a-f0-9]{32})-([a-f0-9]{16})-[a-f0-9]{2}$/) ?? [];
  if (traceId === '0'.repeat(32) || spanId === '0'.repeat(16)) throw new Error('traceparent is invalid');
  const meta = { traceparent };
  if (tracestate !== undefined) {
    if (typeof tracestate !== 'string' || Buffer.byteLength(tracestate) > 512 || /[\r\n]/.test(tracestate)) throw new Error('tracestate is invalid');
    meta.tracestate = tracestate;
  }
  return meta;
}

export async function authorizeMcpRequest(policy, { token, verify, audience, requiredScopes = [], now = Date.now() }) {
  requirePolicy(policy);
  if (typeof token !== 'string' || !token || typeof verify !== 'function' || typeof audience !== 'string' || !audience) throw new Error('authorization requires a token, verifier, and audience');
  const claims = await callExternal(policy, 'authorization verifier', (signal) => verify(token, { signal }));
  assertPlainObject(claims, 'verified authorization claims');
  if (!(typeof claims.aud === 'string' || Array.isArray(claims.aud) && claims.aud.every((item) => typeof item === 'string')) || !Number.isFinite(claims.exp) || requiredScopes.some((scope) => typeof scope !== 'string' || !scope)) throw new Error('verified authorization claim types are invalid');
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const scopes = new Set(Array.isArray(claims.scopes) ? claims.scopes : typeof claims.scope === 'string' ? claims.scope.split(/\s+/).filter(Boolean) : []);
  const skew = policy.security.clock_skew_seconds * 1000;
  if (typeof claims.sub !== 'string' || !claims.sub || !audiences.includes(audience) || !Number.isFinite(claims.exp) || now >= claims.exp * 1000 + skew || requiredScopes.some((scope) => !scopes.has(scope))) throw new Error('verified authorization claims do not satisfy subject, audience, expiry, or scopes');
  return Object.freeze({ subject: claims.sub, audience, scopes: Object.freeze([...scopes].sort()), expires_at: claims.exp });
}

export async function verifyMcpApproval(policy, receipt, { action, requestSha256, bindingSha256, verify, consume, now = Date.now() }) {
  requirePolicy(policy);
  assertPlainObject(receipt, 'approval receipt');
  if (typeof verify !== 'function') throw new Error('approval verifier is required');
  if (typeof consume !== 'function') throw new Error('approval consumption callback is required');
  assertHex(requestSha256, 64, 'approval request digest');
  assertHex(bindingSha256, 64, 'approval binding digest');
  const validSignature = await callExternal(policy, 'approval verifier', (signal) => verify(receipt, { signal }));
  const expiresAt = Date.parse(receipt.expires_at);
  if (validSignature !== true || typeof receipt.approval_id !== 'string' || !receipt.approval_id || typeof receipt.nonce !== 'string' || !receipt.nonce || receipt.status !== 'approved' || receipt.action !== action || receipt.request_sha256 !== requestSha256 || receipt.binding_sha256 !== bindingSha256 || !Number.isFinite(expiresAt) || now >= expiresAt || !Array.isArray(receipt.approvers) || receipt.approvers.length < 1) throw new Error('approval receipt is invalid, expired, mismatched, or unverified');
  if (await callExternal(policy, 'approval consumption', (signal) => consume({ approval_id: receipt.approval_id, nonce: receipt.nonce, request_sha256: requestSha256, binding_sha256: bindingSha256 }, { signal })) !== true) throw new Error('approval receipt was already consumed or could not be consumed atomically');
  return Object.freeze({ approval_id: receipt.approval_id, action, request_sha256: requestSha256, approvers: Object.freeze([...receipt.approvers]) });
}

export function createMcpElicitation(policy, { elicitationId, message, requestedSchema, mode = 'form', url } = {}) {
  requirePolicy(policy);
  if (typeof elicitationId !== 'string' || !elicitationId || typeof message !== 'string' || message.length < 10 || !['form', 'url'].includes(mode)) throw new Error('elicitation identity, message, or mode is invalid');
  assertPlainObject(requestedSchema, 'elicitation schema');
  if (byteLength(requestedSchema) > policy.limits.maximum_elicitation_schema_bytes || externalReference(requestedSchema)) throw new Error('elicitation schema is oversized or external');
  compileMcpSchema(policy, requestedSchema);
  if (/[\u0000-\u001f\u007f]/.test(message)) throw new Error('elicitation message contains control characters');
  if (mode === 'url' && (typeof url !== 'string' || !url.startsWith('https://'))) throw new Error('URL elicitation requires HTTPS');
  if (mode === 'form' && url !== undefined) throw new Error('form elicitation cannot include a URL');
  return { resultType: 'input_required', inputRequests: { [elicitationId]: { mode, message, requestedSchema: structuredClone(requestedSchema), ...(url ? { url } : {}) } } };
}

export function createMcpSubscription(policy, { notifications, resourceUris = [] }) {
  requirePolicy(policy);
  assertPlainObject(notifications, 'subscription notifications');
  if (!Object.values(notifications).every((value) => typeof value === 'boolean')) throw new Error('subscription notification values must be booleans');
  const enabled = Object.values(notifications).filter((value) => value === true).length + resourceUris.length;
  if (enabled < 1 || enabled > policy.limits.maximum_subscriptions || resourceUris.some((uri) => { try { const parsed = new URL(uri); return !parsed.protocol || parsed.username || parsed.password; } catch { return true; } })) throw new Error('subscription filter is empty, oversized, or invalid');
  return { notifications: structuredClone(notifications), ...(resourceUris.length ? { resourceUris: [...new Set(resourceUris)].sort() } : {}) };
}

export function validateMcpSubscriptionAcknowledgement(requestId, requested, acknowledgement) {
  assertPlainObject(acknowledgement, 'subscription acknowledgement');
  if (acknowledgement.method !== 'notifications/subscriptions/acknowledged' || acknowledgement.params?._meta?.['io.modelcontextprotocol/subscriptionId'] !== requestId) throw new Error('subscription acknowledgement is uncorrelated');
  const honored = acknowledgement.params.notifications ?? {};
  for (const [name, value] of Object.entries(honored)) if (value !== true || requested.notifications[name] !== true) throw new Error('subscription acknowledgement widened the requested filter');
  return Object.freeze(structuredClone(honored));
}

function validateTaskStore(store) {
  if (!store || store.durable !== true || store.atomic !== true || typeof store.get !== 'function' || typeof store.create !== 'function' || typeof store.transact !== 'function') throw new Error('Tasks require a durable atomic store with get, exclusive create, and transact methods');
}

function validateTask(task, now) {
  if (!task) throw new Error('task does not exist');
  if (now >= task.expires_at) throw new Error('task has expired');
  return task;
}

export function createMcpTaskCoordinator(policy, { store, clock = () => Date.now(), idFactory = () => crypto.randomUUID() }) {
  requirePolicy(policy);
  validateTaskStore(store);
  const storeCall = (label, operation) => callExternal(policy, `task store ${label}`, operation);
  const transition = async (taskId, update) => storeCall('transaction', (signal) => store.transact(taskId, (current) => {
    const now = clock();
    const task = validateTask(current, now);
    return update(task, now);
  }, { signal }));
  return Object.freeze({
    async create({ method, requestSha256, ttlMs = policy.tasks.default_ttl_ms, pollIntervalMs = policy.tasks.minimum_poll_interval_ms }) {
      if (typeof method !== 'string' || !method || !Number.isInteger(ttlMs) || ttlMs < 1000 || ttlMs > policy.tasks.maximum_ttl_ms || !Number.isInteger(pollIntervalMs) || pollIntervalMs < policy.tasks.minimum_poll_interval_ms) throw new Error('task method, TTL, or polling interval is invalid');
      assertHex(requestSha256, 64, 'task request digest');
      const now = clock();
      const task = { taskId: idFactory(), method, request_sha256: requestSha256, status: 'working', created_at: now, updated_at: now, expires_at: now + ttlMs, ttlMs, pollIntervalMs };
      if (typeof task.taskId !== 'string' || !task.taskId || await storeCall('create', (signal) => store.create(task.taskId, structuredClone(task), { signal })) !== true) throw new Error('task ID is invalid or collided with an existing task');
      return { resultType: 'task', ...structuredClone(task) };
    },
    async get(taskId) { return structuredClone(validateTask(await storeCall('get', (signal) => store.get(taskId, { signal })), clock())); },
    async requireInput(taskId, inputRequests) {
      return structuredClone(await transition(taskId, (task, now) => {
        if (terminalTaskStatuses.has(task.status) || !inputRequests || typeof inputRequests !== 'object' || Array.isArray(inputRequests) || Object.keys(inputRequests).length < 1 || Object.keys(inputRequests).length > policy.tasks.maximum_input_requests) throw new Error('task cannot request this input');
        for (const [key, request] of Object.entries(inputRequests)) {
          if (typeof key !== 'string' || !key || !request || typeof request !== 'object' || Array.isArray(request)) throw new Error('task input request is invalid');
          compileMcpSchema(policy, request.requestedSchema);
        }
        return { ...task, status: 'input_required', inputRequests: structuredClone(inputRequests), updated_at: now };
      }));
    },
    async update(taskId, inputResponses) {
      return structuredClone(await transition(taskId, (task, now) => {
        if (task.status !== 'input_required' || !inputResponses || typeof inputResponses !== 'object' || Array.isArray(inputResponses)) throw new Error('task is not awaiting valid input');
        const expected = Object.keys(task.inputRequests).sort();
        if (stableJson(Object.keys(inputResponses).sort()) !== stableJson(expected)) throw new Error('task input responses do not match outstanding requests');
        for (const key of expected) {
          const validation = compileMcpSchema(policy, task.inputRequests[key].requestedSchema)(inputResponses[key]);
          if (!validation.valid) throw new Error(`task input response does not satisfy its schema: ${key}`);
        }
        const updated = { ...task, status: 'working', input_responses_sha256: sha256(safeStableJson(inputResponses, { maximumDepth: policy.limits.maximum_schema_depth, label: 'task input responses' })), updated_at: now };
        delete updated.inputRequests;
        return updated;
      }));
    },
    async complete(taskId, result) {
      const bounded = boundMcpResult(policy, result);
      return structuredClone(await transition(taskId, (task, now) => {
        if (terminalTaskStatuses.has(task.status) || task.status === 'input_required') throw new Error('task cannot complete from its current state');
        return { ...task, status: 'completed', result: bounded, updated_at: now };
      }));
    },
    async fail(taskId, error) {
      return structuredClone(await transition(taskId, (task, now) => {
        if (terminalTaskStatuses.has(task.status) || !Number.isInteger(error?.code) || typeof error?.message !== 'string' || error.message.length > 1000 || /[\r\n]/.test(error.message)) throw new Error('task cannot fail with this error');
        return { ...task, status: 'failed', error: { code: error.code, message: error.message }, updated_at: now };
      }));
    },
    async cancel(taskId) {
      return structuredClone(await transition(taskId, (task, now) => terminalTaskStatuses.has(task.status) ? task : { ...task, status: 'cancelled', updated_at: now }));
    },
  });
}

export function loadDefaultMcpUtilitiesPolicy() {
  return readJson(policyPath);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const policy = loadDefaultMcpUtilitiesPolicy();
    requirePolicy(policy);
    process.stdout.write(stableJson({ status: 'valid', task: policy.task, protocol_version: policy.protocol_version, sdk_adapter: policy.boundaries.sdk_adapter, utility_contracts: ['approval-verification', 'authorization-verification', 'discovery', 'elicitation', 'output-limits', 'pagination', 'schemas', 'subscription-validation', 'tasks-coordination', 'trace-context'], external_store_required: true, external_verifiers_required: true, tasks_extension_commit: policy.tasks.extension_commit, canonical_writes_allowed: false, publication_allowed: false }));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}