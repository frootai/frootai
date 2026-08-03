import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createMcpRequestMeta, loadDefaultMcpUtilitiesPolicy } from './solution-play-mcp-utilities.mjs';
import { buildMcpTransportValidationPlan, loadDefaultMcpTransportValidationPolicy, validateMcpTransportValidationPolicy } from './solution-play-mcp-transport-validation.mjs';
import { startMcpHttpFixture } from './fixtures/solution-play-mcp-transport-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = path.join(root, 'scripts', 'fixtures', 'solution-play-mcp-transport-fixture.mjs');
const inspectorPath = path.join(root, 'node_modules', '@modelcontextprotocol', 'inspector-cli', 'build', 'index.js');
const conformancePath = path.join(root, 'node_modules', '@modelcontextprotocol', 'conformance', 'dist', 'index.js');
const cliPath = path.join(root, 'scripts', 'solution-play-mcp-transport-validation.mjs');
const policy = loadDefaultMcpTransportValidationPolicy();
const utilities = loadDefaultMcpUtilitiesPolicy();
const meta = createMcpRequestMeta(utilities, { clientCapabilities: { elicitation: {} }, clientInfo: { name: 'frootai-t226-test', version: '1.0.0' } });

function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return Promise.race([new Promise((resolve) => child.once('close', resolve)), new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
}

async function terminateProcessTree(child) {
  child.stdin.destroy();
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { shell: false, windowsHide: true, stdio: 'ignore' });
    await waitForExit(killer, 2000);
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch {}
    await waitForExit(child, 500);
    if (child.exitCode === null && child.signalCode === null) try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }
  await waitForExit(child, 2000);
}

function runProcess(args, { input, inputChunks, env = {}, label = 'bounded Node process', timeoutMs = policy.execution.timeout_ms, cwd = root } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env }, detached: process.platform !== 'win32', shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    let outputBytes = 0;
    let terminating = false;
    const fail = async (error) => {
      if (terminating) return;
      terminating = true;
      clearTimeout(timer);
      await terminateProcessTree(child);
      reject(error);
    };
    const timer = setTimeout(() => void fail(new Error(`${label} exceeded ${timeoutMs}ms`)), timeoutMs);
    const capture = (target) => (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > policy.execution.maximum_output_bytes) {
        void fail(new Error(`${label} output exceeded the byte limit`));
        return;
      }
      target.push(chunk);
    };
    child.stdout.on('data', capture(stdout));
    child.stderr.on('data', capture(stderr));
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('close', (code, signal) => {
      if (terminating) return;
      clearTimeout(timer);
      resolve({ code, signal, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') });
    });
    if (inputChunks !== undefined) {
      const writeNext = (index) => {
        if (index === inputChunks.length) return child.stdin.end();
        child.stdin.write(inputChunks[index], () => setImmediate(() => writeNext(index + 1)));
      };
      writeNext(0);
    } else if (input !== undefined) child.stdin.end(input); else child.stdin.end();
  });
}

async function postJson(url, message, { token, origin, contentType = 'application/json', headerOverrides = {} } = {}) {
  const headers = {
    accept: 'application/json, text/event-stream',
    'content-type': contentType,
    'mcp-protocol-version': message?.params?._meta?.['io.modelcontextprotocol/protocolVersion'],
    'mcp-method': message?.method,
  };
  if (['tools/call', 'resources/read', 'prompts/get'].includes(message?.method)) headers['mcp-name'] = message.params?.name ?? message.params?.uri;
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  if (origin !== undefined) headers.origin = origin;
  Object.assign(headers, headerOverrides);
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(message) });
  const contentTypeHeader = response.headers.get('content-type') ?? '';
  return { status: response.status, headers: response.headers, body: contentTypeHeader.startsWith('application/json') ? await response.json() : await response.text() };
}

function stdioRequest(message) {
  return runProcess([fixturePath, '--stdio'], { input: `${JSON.stringify(message)}\n` });
}

test('strict policy binds T225 and exact official tool versions without widening claims', () => {
  assert.deepEqual(validateMcpTransportValidationPolicy(policy), { valid: true, errors: [] });
  const plan = buildMcpTransportValidationPlan(policy);
  assert.equal(plan.current.protocol_version, '2026-07-28');
  assert.deepEqual(plan.current.transports, ['stdio', 'streamable-http']);
  assert.equal(plan.compatibility.protocol_version, '2025-11-25');
  assert.equal(plan.boundaries.full_conformance_claimed, false);
  assert.equal(plan.boundaries.production_server_claimed, false);
  const drift = structuredClone(policy);
  drift.utilities_policy_sha256 = '0'.repeat(64);
  assert.equal(validateMcpTransportValidationPolicy(drift).valid, false);
  const substitution = structuredClone(policy);
  substitution.tooling.inspector.package = '@modelcontextprotocol/conformance';
  assert.equal(validateMcpTransportValidationPolicy(substitution).valid, false);
});

test('current stateless discovery and tools execute over newline-delimited stdio', async () => {
  const discovery = await stdioRequest({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: meta } });
  assert.equal(discovery.code, 0, discovery.stderr);
  const discovered = JSON.parse(discovery.stdout);
  assert.deepEqual(discovered.result.supportedVersions, ['2026-07-28', '2025-11-25']);
  const list = await stdioRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: { _meta: meta } });
  assert.deepEqual(JSON.parse(list.stdout).result.tools.map((tool) => tool.name), ['test_simple_text', 'frootai_echo', 'frootai_stream']);
  const call = await stdioRequest({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { _meta: meta, name: 'frootai_echo', arguments: { text: 'bounded' } } });
  assert.equal(JSON.parse(call.stdout).result.content[0].text, 'bounded');
});

test('stdio fails closed on missing metadata, malformed JSON, and oversized lines without leaking input', async () => {
  const secret = 'T226_SECRET_MUST_NOT_APPEAR';
  const missing = await stdioRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { secret } });
  assert.equal(JSON.parse(missing.stdout).error.code, -32602);
  assert.equal(`${missing.stdout}${missing.stderr}`.includes(secret), false);
  const malformed = await runProcess([fixturePath, '--stdio'], { input: '{bad-json\n' });
  assert.equal(JSON.parse(malformed.stdout).error.code, -32700);
  const oversized = await runProcess([fixturePath, '--stdio'], { input: `${'x'.repeat(policy.security.maximum_request_bytes + 1)}\n` });
  assert.equal(JSON.parse(oversized.stdout).error.code, -32600);
  const unterminated = await runProcess([fixturePath, '--stdio'], { input: 'x'.repeat(policy.security.maximum_request_bytes + 1) });
  assert.equal(JSON.parse(unterminated.stdout).error.code, -32600);
  const multiple = await runProcess([fixturePath, '--stdio'], { input: `${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: { _meta: meta } })}\n${JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: { _meta: meta } })}\n` });
  assert.equal(multiple.stdout.trim().split(/\r?\n/).length, 2);
  const boundary = { jsonrpc: '2.0', id: 4, method: 'unknown/method', params: { _meta: meta, padding: '' } };
  const boundaryBase = JSON.stringify(boundary);
  boundary.params.padding = 'x'.repeat(policy.security.maximum_request_bytes - Buffer.byteLength(boundaryBase, 'utf8'));
  const boundaryMessage = JSON.stringify(boundary);
  assert.equal(Buffer.byteLength(boundaryMessage, 'utf8'), policy.security.maximum_request_bytes);
  for (const ending of ['\n', '\r\n']) {
    const result = await runProcess([fixturePath, '--stdio'], { input: `${boundaryMessage}${ending}` });
    assert.equal(JSON.parse(result.stdout).error.code, -32601);
  }
  const splitCrLf = await runProcess([fixturePath, '--stdio'], { inputChunks: [boundaryMessage, '\r', '\n'] });
  assert.equal(JSON.parse(splitCrLf.stdout).error.code, -32601);
});

test('current stateless discovery and tools execute over protected Streamable HTTP', async (context) => {
  const token = 't226-test-token';
  const origin = 'https://trusted.example';
  const server = await startMcpHttpFixture({ authorizationToken: token, allowedOrigins: [origin] });
  context.after(() => server.close());
  const discovery = await postJson(server.url, { jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: meta } }, { token, origin });
  assert.equal(discovery.status, 200);
  assert.equal(discovery.body.result.resultType, 'complete');
  const call = await postJson(server.url, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { _meta: meta, name: 'frootai_echo', arguments: { text: 'http-bounded' } } }, { token, origin });
  assert.equal(call.body.result.content[0].text, 'http-bounded');
  const stream = await postJson(server.url, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { _meta: meta, name: 'frootai_stream', arguments: {} } }, { token, origin });
  assert.equal(stream.status, 200);
  assert.match(stream.headers.get('content-type'), /^text\/event-stream/);
  assert.match(stream.body, /request-scoped-stream/);
});

test('Streamable HTTP rejects credential, origin, host, media-type, query-token, and body-limit attacks', async (context) => {
  const token = 't226-security-token';
  const origin = 'https://trusted.example';
  const server = await startMcpHttpFixture({ authorizationToken: token, allowedOrigins: [origin] });
  context.after(() => server.close());
  const request = { jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: meta } };
  assert.equal((await postJson(server.url, request, { origin })).status, 401);
  assert.equal((await postJson(server.url, request, { token, origin: 'https://evil.example' })).status, 403);
  assert.equal((await postJson(`${server.url}?access_token=${token}`, request, { token, origin })).status, 400);
  assert.equal((await postJson(server.url, request, { token, origin, contentType: 'text/plain' })).status, 415);
  assert.equal((await postJson(server.url, request, { token, origin, contentType: 'application/json-evil' })).status, 415);
  assert.equal((await postJson(server.url, request, { token, origin, contentType: 'application/json, text/plain' })).status, 415);
  assert.equal((await postJson(server.url, request, { token, origin, headerOverrides: { accept: 'application/json;q=0, text/event-stream;q=0' } })).status, 406);
  const missingMethod = await postJson(server.url, request, { token, origin, headerOverrides: { 'mcp-method': '' } });
  assert.equal(missingMethod.status, 400);
  assert.equal(missingMethod.body.error.code, -32020);
  const mismatchedName = await postJson(server.url, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { _meta: meta, name: 'frootai_echo', arguments: { text: 'safe' } } }, { token, origin, headerOverrides: { 'mcp-name': 'different-tool' } });
  assert.equal(mismatchedName.status, 400);
  assert.equal(mismatchedName.body.error.code, -32020);
  const unsupportedMessage = structuredClone(request);
  unsupportedMessage.params._meta['io.modelcontextprotocol/protocolVersion'] = '2099-01-01';
  const unsupported = await postJson(server.url, unsupportedMessage, { token, origin });
  assert.equal(unsupported.status, 400);
  assert.equal(unsupported.body.error.code, -32022);
  const unknown = await postJson(server.url, { jsonrpc: '2.0', id: 2, method: 'unknown/method', params: { _meta: meta } }, { token, origin });
  assert.equal(unknown.status, 404);
  assert.equal(unknown.body.error.code, -32601);
  assert.equal((await fetch(server.url, { method: 'GET', headers: { authorization: `Bearer ${token}`, origin } })).status, 405);
  assert.equal((await fetch(server.url, { method: 'DELETE', headers: { authorization: `Bearer ${token}`, origin } })).status, 405);
  const oversized = await fetch(server.url, { method: 'POST', headers: { authorization: `Bearer ${token}`, origin, 'content-type': 'application/json' }, body: JSON.stringify({ value: 'x'.repeat(policy.security.maximum_request_bytes) }) });
  assert.equal(oversized.status, 413);
  const target = new URL(server.url);
  const invalidHost = await new Promise((resolve, reject) => {
    const requestWithHost = http.request({ hostname: target.hostname, port: target.port, path: target.pathname, method: 'POST', headers: { host: 'evil.example', authorization: `Bearer ${token}`, origin, 'content-type': 'application/json' } }, (response) => { response.resume(); response.once('end', () => resolve(response.statusCode)); });
    requestWithHost.once('error', reject);
    requestWithHost.end(JSON.stringify(request));
  });
  assert.equal(invalidHost, 421);
});

test('legacy HTTP compatibility sessions bind negotiated version and reject unknown handles', async (context) => {
  const server = await startMcpHttpFixture();
  context.after(() => server.close());
  const initialized = await fetch(server.url, { method: 'POST', headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'legacy-test', version: '1.0.0' } } }) });
  assert.equal(initialized.status, 200);
  const sessionId = initialized.headers.get('mcp-session-id');
  assert.equal(typeof sessionId, 'string');
  const legacyHeaders = { accept: 'application/json, text/event-stream', 'content-type': 'application/json', 'mcp-protocol-version': '2025-11-25', 'mcp-session-id': sessionId };
  const listed = await fetch(server.url, { method: 'POST', headers: legacyHeaders, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) });
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).result.tools.length, 3);
  const mismatch = await fetch(server.url, { method: 'POST', headers: { ...legacyHeaders, 'mcp-protocol-version': '2025-06-18' }, body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} }) });
  assert.equal(mismatch.status, 400);
  const modernBody = await fetch(server.url, { method: 'POST', headers: legacyHeaders, body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/list', params: { _meta: meta } }) });
  assert.equal(modernBody.status, 400);
  const disguisedModernMeta = structuredClone(meta);
  disguisedModernMeta['io.modelcontextprotocol/protocolVersion'] = '2025-11-25';
  const disguisedModernBody = await fetch(server.url, { method: 'POST', headers: legacyHeaders, body: JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'tools/list', params: { _meta: disguisedModernMeta } }) });
  assert.equal(disguisedModernBody.status, 400);
  const unknown = await fetch(server.url, { method: 'POST', headers: { ...legacyHeaders, 'mcp-session-id': 'unknown-session' }, body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} }) });
  assert.equal(unknown.status, 404);
  const unsupportedInitialize = await fetch(server.url, { method: 'POST', headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'old-test', version: '1.0.0' } } }) });
  assert.notEqual(unsupportedInitialize.status, 200);
});

test('pinned Inspector executes tools/list over stdio and protected Streamable HTTP', async (context) => {
  const inspectorCwd = path.dirname(inspectorPath);
  const stdio = await runProcess([inspectorPath, process.execPath, fixturePath, '--stdio', '--method', 'tools/list', '--transport', 'stdio'], { label: 'Inspector stdio probe', cwd: inspectorCwd });
  assert.equal(stdio.code, 0, stdio.stderr);
  assert.match(stdio.stdout, /test_simple_text/);
  const token = 't226-inspector-token';
  const server = await startMcpHttpFixture({ authorizationToken: token });
  context.after(() => server.close());
  const httpResult = await runProcess([inspectorPath, server.url, '--method', 'tools/list', '--transport', 'http', '--header', `Authorization: Bearer ${token}`], { label: 'Inspector HTTP probe', cwd: inspectorCwd });
  assert.equal(httpResult.code, 0, httpResult.stderr);
  assert.match(httpResult.stdout, /frootai_echo/);
});

test('pinned official conformance runner passes the selected 2025-11-25 HTTP subset', async (context) => {
  const server = await startMcpHttpFixture();
  context.after(() => server.close());
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frootai-t226-conformance-'));
  context.after(() => fs.rmSync(outputRoot, { recursive: true, force: true }));
  for (const scenario of policy.execution.official_conformance_scenarios) {
    const output = path.join(outputRoot, scenario);
    const result = await runProcess([conformancePath, 'server', '--url', server.url.replace('127.0.0.1', 'localhost'), '--scenario', scenario, '--spec-version', '2025-11-25', '--output-dir', output]);
    assert.equal(result.code, 0, `${scenario}\n${result.stdout}\n${result.stderr}`);
    assert.equal(result.stdout.includes('FAILURE'), false, scenario);
  }
});

test('CLI reports bounded wire evidence and compatibility limits without readiness claims', async () => {
  const result = await runProcess([cliPath]);
  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, 'valid');
  assert.equal(output.current_protocol_version, '2026-07-28');
  assert.equal(output.compatibility_protocol_version, '2025-11-25');
  assert.equal(output.full_conformance_claimed, false);
  assert.equal(output.production_server_claimed, false);
  assert.equal(output.canonical_writes_allowed, false);
  assert.equal(output.publication_allowed, false);
});

test('process timeout diagnostics redact secret-bearing arguments and terminate the child', async () => {
  const plantedSecret = 'T226_TIMEOUT_SECRET';
  await assert.rejects(runProcess(['-e', 'setInterval(() => {}, 1000)', plantedSecret], { label: 'redacted timeout probe', timeoutMs: 100 }), (error) => {
    assert.equal(error.message.includes(plantedSecret), false);
    assert.match(error.message, /redacted timeout probe exceeded/);
    return true;
  });
});

test('process timeouts terminate spawned grandchildren', async (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frootai-t226-process-tree-'));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const pidPath = path.join(directory, 'grandchild.pid');
  const program = `const{spawn}=require('node:child_process');const fs=require('node:fs');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(${JSON.stringify(pidPath)},String(child.pid));setInterval(()=>{},1000)`;
  await assert.rejects(runProcess(['-e', program], { label: 'process-tree probe', timeoutMs: 500 }), /process-tree probe exceeded/);
  const grandchildPid = Number(fs.readFileSync(pidPath, 'utf8'));
  assert.throws(() => process.kill(grandchildPid, 0));
});