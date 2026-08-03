#!/usr/bin/env node
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boundMcpResult, compileMcpSchema, loadDefaultMcpUtilitiesPolicy } from '../solution-play-mcp-utilities.mjs';
import { loadDefaultMcpTransportValidationPolicy } from '../solution-play-mcp-transport-validation.mjs';

const currentProtocol = '2026-07-28';
const compatibilityProtocols = new Set(['2025-11-25']);
const utilityPolicy = loadDefaultMcpUtilitiesPolicy();
const transportPolicy = loadDefaultMcpTransportValidationPolicy();
const echoValidator = compileMcpSchema(utilityPolicy, { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string', minLength: 1, maxLength: 1024 } } });
const emptyValidator = compileMcpSchema(utilityPolicy, { type: 'object', additionalProperties: false, properties: {} });
const tools = Object.freeze([
  Object.freeze({ name: 'test_simple_text', description: 'Return deterministic conformance text.', inputSchema: { type: 'object', additionalProperties: false, properties: {} } }),
  Object.freeze({ name: 'frootai_echo', description: 'Echo one bounded text value.', inputSchema: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string', minLength: 1, maxLength: 1024 } } } }),
  Object.freeze({ name: 'frootai_stream', description: 'Return one request-scoped SSE result.', inputSchema: { type: 'object', additionalProperties: false, properties: {} } }),
]);

function response(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function errorResponse(id, code, message) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function currentMetadata(message) {
  const meta = message?.params?._meta;
  return meta && meta['io.modelcontextprotocol/protocolVersion'] === currentProtocol && meta['io.modelcontextprotocol/clientCapabilities'] && typeof meta['io.modelcontextprotocol/clientCapabilities'] === 'object' && !Array.isArray(meta['io.modelcontextprotocol/clientCapabilities']);
}

function discoveryResult() {
  return {
    resultType: 'complete',
    supportedVersions: [currentProtocol, '2025-11-25'],
    capabilities: { tools: { listChanged: false } },
    ttlMs: 300000,
    cacheScope: 'public',
    _meta: { 'io.modelcontextprotocol/serverInfo': { name: 'frootai-t226-fixture', version: '1.0.0' } },
  };
}

function toolResult(params) {
  const name = params?.name;
  const args = params?.arguments ?? {};
  const validation = ['test_simple_text', 'frootai_stream'].includes(name) ? emptyValidator(args) : name === 'frootai_echo' ? echoValidator(args) : null;
  if (!validation) return { error: errorResponse(null, -32602, 'Unknown tool') };
  if (!validation.valid) return { error: errorResponse(null, -32602, 'Tool arguments do not satisfy the declared schema') };
  const text = name === 'test_simple_text' ? 'Hello from the MCP conformance test server!' : name === 'frootai_stream' ? 'request-scoped-stream' : args.text;
  return { result: boundMcpResult(utilityPolicy, { resultType: 'complete', content: [{ type: 'text', text }] }) };
}

export function dispatchMcpFixtureMessage(message, state = { compatibilityInitialized: false }) {
  if (!message || typeof message !== 'object' || Array.isArray(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') return { body: errorResponse(message?.id, -32600, 'Invalid Request') };
  if (message.method === 'initialize') {
    const requested = message.params?.protocolVersion;
    if (!compatibilityProtocols.has(requested)) return { body: errorResponse(message.id, -32602, 'Unsupported compatibility protocol') };
    state.compatibilityInitialized = true;
    return { body: response(message.id, { protocolVersion: requested, capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'frootai-t226-fixture', version: '1.0.0' } }), compatibility: true };
  }
  if (message.method === 'notifications/initialized') {
    return state.compatibilityInitialized ? { notification: true, compatibility: true } : { body: errorResponse(null, -32002, 'Compatibility session was not initialized') };
  }
  const current = currentMetadata(message);
  if (!current && !state.compatibilityInitialized) return { body: errorResponse(message.id, -32602, 'Current request metadata is required') };
  if (message.method === 'server/discover') return current ? { body: response(message.id, discoveryResult()) } : { body: errorResponse(message.id, -32601, 'Method not available in compatibility mode') };
  if (message.method === 'ping') return { body: response(message.id, current ? { resultType: 'complete' } : {}) };
  if (message.method === 'tools/list') return { body: response(message.id, current ? { resultType: 'complete', tools } : { tools }) };
  if (message.method === 'tools/call') {
    const called = toolResult(message.params);
    if (called.error) return { body: { ...called.error, id: message.id } };
    return { body: response(message.id, called.result) };
  }
  return { body: errorResponse(message.id, -32601, 'Method not found') };
}

function secureEqual(left, right) {
  const leftBytes = Buffer.from(left ?? '', 'utf8');
  const rightBytes = Buffer.from(right ?? '', 'utf8');
  return leftBytes.length === rightBytes.length && crypto.timingSafeEqual(leftBytes, rightBytes);
}

function writeJson(res, status, body, headers = {}) {
  const payload = Buffer.from(JSON.stringify(body), 'utf8');
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': payload.length, ...headers });
  res.end(payload);
}

function writeSse(res, body) {
  const payload = `data: ${JSON.stringify(body)}\n\n`;
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', 'x-accel-buffering': 'no' });
  res.end(payload);
}

function mediaTypes(value) {
  return String(value ?? '').split(',').map((entry) => {
    const [essence, ...parameters] = entry.split(';').map((part) => part.trim().toLowerCase());
    const quality = parameters.find((part) => part.startsWith('q='));
    const weight = quality === undefined ? 1 : Number(quality.slice(2));
    return { essence, acceptable: Number.isFinite(weight) && weight > 0 && weight <= 1 };
  }).filter((item) => item.essence);
}

function decodeMirror(value) {
  if (typeof value !== 'string') return undefined;
  if (!value.startsWith('=?base64?') || !value.endsWith('?=')) return value;
  const encoded = value.slice(9, -2);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return undefined;
  return Buffer.from(encoded, 'base64').toString('utf8');
}

function headerError(message, detail) {
  return { status: 400, body: errorResponse(message?.id, -32020, `Header mismatch: ${detail}`) };
}

function validateModernHeaders(req, message) {
  const bodyVersion = message?.params?._meta?.['io.modelcontextprotocol/protocolVersion'];
  const headerVersion = req.headers['mcp-protocol-version'];
  if (typeof bodyVersion !== 'string' || !message?.params?._meta?.['io.modelcontextprotocol/clientCapabilities']) return { status: 400, body: errorResponse(message?.id, -32602, 'Current request metadata is required') };
  if (typeof headerVersion !== 'string' || headerVersion !== bodyVersion) return headerError(message, 'MCP-Protocol-Version does not match the request body');
  if (bodyVersion !== currentProtocol) return { status: 400, body: { ...errorResponse(message.id, -32022, 'Unsupported protocol version'), error: { code: -32022, message: 'Unsupported protocol version', data: { supported: [currentProtocol, '2025-11-25'], requested: bodyVersion } } } };
  if (req.headers['mcp-method'] !== message.method) return headerError(message, 'Mcp-Method does not match the request body');
  const mirroredName = ['tools/call', 'resources/read', 'prompts/get'].includes(message.method) ? message.params?.name ?? message.params?.uri : undefined;
  if (mirroredName !== undefined && decodeMirror(req.headers['mcp-name']) !== mirroredName) return headerError(message, 'Mcp-Name does not match the request body');
  return undefined;
}

async function readBody(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > transportPolicy.security.maximum_request_bytes) throw new Error('request-too-large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function startMcpHttpFixture({ authorizationToken, allowedOrigins = [] } = {}) {
  const sessions = new Map();
  const sockets = new Set();
  let allowedHosts = new Set();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/mcp') return writeJson(res, 404, { error: 'not-found' });
    if (url.searchParams.has('access_token') || url.searchParams.has('token')) return writeJson(res, 400, { error: 'query-tokens-prohibited' });
    if (!allowedHosts.has((req.headers.host ?? '').toLowerCase())) return writeJson(res, 421, { error: 'invalid-host' });
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) return writeJson(res, 403, { error: 'invalid-origin' });
    if (authorizationToken !== undefined && !secureEqual(req.headers.authorization, `Bearer ${authorizationToken}`)) return writeJson(res, 401, { error: 'unauthorized' }, { 'www-authenticate': 'Bearer' });
    if (['GET', 'DELETE'].includes(req.method)) return writeJson(res, 405, { error: 'method-not-allowed' }, { allow: 'POST' });
    if (req.method !== 'POST') return writeJson(res, 405, { error: 'method-not-allowed' }, { allow: 'POST' });
    const contentTypes = mediaTypes(req.headers['content-type']);
    if (contentTypes.length !== 1 || contentTypes[0].essence !== 'application/json') return writeJson(res, 415, { error: 'application-json-required' });
    let message;
    try {
      message = JSON.parse(await readBody(req));
    } catch (error) {
      if (error.message === 'request-too-large') return writeJson(res, 413, { error: 'request-too-large' });
      return writeJson(res, 400, errorResponse(null, -32700, 'Parse error'));
    }
    const requestedSession = req.headers['mcp-session-id'];
    const legacyInitialize = message?.method === 'initialize' && compatibilityProtocols.has(message?.params?.protocolVersion);
    if (!legacyInitialize && typeof requestedSession === 'string') {
      if (!sessions.has(requestedSession)) return writeJson(res, 404, { error: 'unknown-session' });
      if (req.headers['mcp-protocol-version'] !== sessions.get(requestedSession)) return writeJson(res, 400, { error: 'session-version-mismatch' });
      const bodyVersion = message?.params?._meta?.['io.modelcontextprotocol/protocolVersion'];
      if (bodyVersion !== undefined) return writeJson(res, 400, { error: 'modern-metadata-prohibited-in-legacy-session' });
    }
    const state = { compatibilityInitialized: typeof requestedSession === 'string' && sessions.has(requestedSession) };
    if (!legacyInitialize && !state.compatibilityInitialized) {
      const accepted = mediaTypes(req.headers.accept);
      if (!accepted.some((item) => item.essence === 'application/json' && item.acceptable) || !accepted.some((item) => item.essence === 'text/event-stream' && item.acceptable)) return writeJson(res, 406, { error: 'required-response-types-not-accepted' });
      const validation = validateModernHeaders(req, message);
      if (validation) return writeJson(res, validation.status, validation.body);
    }
    const outcome = dispatchMcpFixtureMessage(message, state);
    if (outcome.notification) {
      res.writeHead(202);
      return res.end();
    }
    const headers = {};
    if (message.method === 'initialize' && outcome.compatibility && !outcome.body.error) {
      const sessionId = crypto.randomUUID();
      sessions.set(sessionId, message.params.protocolVersion);
      headers['mcp-session-id'] = sessionId;
    }
    if (outcome.body?.error?.code === -32601 && !state.compatibilityInitialized) return writeJson(res, 404, outcome.body);
    if (!state.compatibilityInitialized && message.method === 'tools/call' && message.params?.name === 'frootai_stream') return writeSse(res, outcome.body);
    return writeJson(res, outcome.body?.error?.code === -32602 && !state.compatibilityInitialized ? 400 : 200, outcome.body, headers);
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  allowedHosts = new Set([`127.0.0.1:${address.port}`, `localhost:${address.port}`]);
  return {
    url: `http://127.0.0.1:${address.port}/mcp`,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}

async function runStdioFixture() {
  const state = { compatibilityInitialized: false };
  let frame = [];
  let frameBytes = 0;
  let discarding = false;
  const processFrame = (bytes) => {
    const payload = bytes.at(-1) === 13 ? bytes.subarray(0, -1) : bytes;
    let message;
    try { message = JSON.parse(payload.toString('utf8')); }
    catch { process.stdout.write(`${JSON.stringify(errorResponse(null, -32700, 'Parse error'))}\n`); return; }
    const outcome = dispatchMcpFixtureMessage(message, state);
    if (!outcome.notification) process.stdout.write(`${JSON.stringify(outcome.body)}\n`);
  };
  for await (const chunk of process.stdin) {
    let offset = 0;
    while (offset < chunk.length) {
      const newline = chunk.indexOf(10, offset);
      const end = newline === -1 ? chunk.length : newline;
      const segmentEnd = newline !== -1 && end > offset && chunk[end - 1] === 13 ? end - 1 : end;
      const segment = chunk.subarray(offset, segmentEnd);
      const nextFrameBytes = frameBytes + segment.length;
      const splitCrLfBoundary = newline === -1 && nextFrameBytes === transportPolicy.security.maximum_request_bytes + 1 && segment.at(-1) === 13;
      if (!discarding && nextFrameBytes > transportPolicy.security.maximum_request_bytes && !splitCrLfBoundary) {
        process.stdout.write(`${JSON.stringify(errorResponse(null, -32600, 'Request exceeds byte limit'))}\n`);
        frame = [];
        frameBytes = 0;
        discarding = newline === -1;
      } else if (!discarding) {
        if (segment.length > 0) frame.push(segment);
        frameBytes += segment.length;
      }
      if (newline !== -1) {
        if (!discarding && frameBytes > 0) processFrame(Buffer.concat(frame, frameBytes));
        frame = [];
        frameBytes = 0;
        discarding = false;
        offset = newline + 1;
      } else {
        offset = chunk.length;
      }
    }
  }
  if (!discarding && frameBytes > 0) process.stdout.write(`${JSON.stringify(errorResponse(null, -32600, 'Message is not newline-delimited'))}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 || process.argv[2] !== '--stdio') {
    process.stderr.write('The T226 fixture may only be launched with --stdio.\n');
    process.exitCode = 2;
  } else {
    runStdioFixture().catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
  }
}