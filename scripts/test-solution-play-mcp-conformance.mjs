import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildMcpConformanceMatrix, loadDefaultMcpConformanceProfile, resolveMcpSdkAdapter, validateMcpConformanceProfile } from './solution-play-mcp-conformance.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(root, 'scripts', 'solution-play-mcp-conformance.mjs');

function profile() {
  return structuredClone(loadDefaultMcpConformanceProfile());
}

test('current 2026-07-28 profile produces a deterministic 19-row, four-adapter matrix', () => {
  const document = profile();
  assert.deepEqual(validateMcpConformanceProfile(document), { valid: true, errors: [] });
  const first = buildMcpConformanceMatrix(document);
  const second = buildMcpConformanceMatrix(document);
  assert.deepEqual(first, second);
  assert.equal(first.protocol_version, '2026-07-28');
  assert.equal(Object.keys(first.rows).length, 19);
  assert.equal(Object.keys(first.adapters).length, 4);
  assert.equal(first.rows.tasks.status, 'extension');
  assert.equal(first.rows.sampling.status, 'deprecated');
  assert.deepEqual(first.boundaries.new_implementation_adapters, ['python-v2']);
  assert.deepEqual(first.boundaries.blocked_adapters, ['typescript-v2']);
});

test('version-specific SDK behavior resolves only through exact adapter descriptors', () => {
  const document = profile();
  const typescript = resolveMcpSdkAdapter(document, 'typescript-v2', { usage: 'inspect' });
  const python = resolveMcpSdkAdapter(document, 'python-v2');
  const legacy = resolveMcpSdkAdapter(document, 'typescript-v1-maintenance', { usage: 'legacy' });
  assert.deepEqual(typescript.packages, { '@modelcontextprotocol/client': '2.0.0', '@modelcontextprotocol/core': '2.0.0', '@modelcontextprotocol/node': '2.0.0', '@modelcontextprotocol/server': '2.0.0' });
  assert.deepEqual(python.packages, { mcp: '2.0.0', 'mcp-types': '2.0.0' });
  assert.equal(typescript.discovery_strategy, 'discover-then-initialize-fallback');
  assert.equal(typescript.status, 'blocked');
  assert.equal(typescript.availability, 'release-tag-only');
  assert.equal(typescript.optional_features.subscriptions, 'supported');
  assert.equal(python.server_identity_location, 'result-meta');
  assert.equal(legacy.allowed_for_new_implementation, false);
  assert.equal(legacy.request_model, 'stateful-session');
  assert.throws(() => resolveMcpSdkAdapter(document, 'typescript-v3'), /not declared/);
  assert.throws(() => resolveMcpSdkAdapter(document, 'typescript-v2'), /not available for new implementation/);
  assert.throws(() => resolveMcpSdkAdapter(document, 'python-v1-maintenance'), /not available for new implementation/);
  assert.throws(() => resolveMcpSdkAdapter(document, 'python-v2', { usage: 'legacy' }), /not a legacy fallback/);
});

test('rejects legacy transports and deprecated primitives in the current core', () => {
  const transport = profile();
  transport.matrix.find((row) => row.id === 'streamable-http').methods = ['http-sse'];
  assert.match(validateMcpConformanceProfile(transport).errors.join('; '), /legacy or deprecated behavior: http-sse/);

  const sampling = profile();
  sampling.matrix.find((row) => row.id === 'elicitation').methods = ['sampling/createMessage'];
  assert.match(validateMcpConformanceProfile(sampling).errors.join('; '), /legacy or deprecated behavior: sampling\/createMessage/);
});

test('rejects duplicate, missing, unknown, and status-drifted matrix rows', () => {
  const duplicate = profile();
  duplicate.matrix[1].id = duplicate.matrix[0].id;
  assert.match(validateMcpConformanceProfile(duplicate).errors.join('; '), /duplicate MCP matrix row|required MCP matrix row is missing/);

  const drift = profile();
  drift.matrix.find((row) => row.id === 'tasks').status = 'required';
  assert.match(validateMcpConformanceProfile(drift).errors.join('; '), /matrix status drifted/);
});

test('rejects unpinned packages, v1 enablement, Tasks claims, and adapter drift', () => {
  const packagePin = profile();
  packagePin.adapters[0].packages[0].version = '^2.0.0';
  assert.equal(validateMcpConformanceProfile(packagePin).valid, false);

  const legacy = profile();
  legacy.adapters.find((adapter) => adapter.id === 'python-v1-maintenance').allowed_for_new_implementation = true;
  assert.match(validateMcpConformanceProfile(legacy).errors.join('; '), /SDK behavior drifted/);

  const tasks = profile();
  tasks.adapters.find((adapter) => adapter.id === 'python-v2').tasks_support = 'deprecated-experimental-removed';
  assert.match(validateMcpConformanceProfile(tasks).errors.join('; '), /SDK behavior drifted/);
});

test('planning and validation do not mutate the source profile', () => {
  const document = profile();
  const before = JSON.stringify(document);
  buildMcpConformanceMatrix(document);
  resolveMcpSdkAdapter(document, 'python-v2');
  assert.equal(JSON.stringify(document), before);
});

test('CLI emits bounded truthful matrix evidence without publication or writes', () => {
  const result = spawnSync(process.execPath, [cliPath], { cwd: root, encoding: 'utf8', shell: false });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, 'valid');
  assert.equal(output.protocol_version, '2026-07-28');
  assert.equal(output.rows, 19);
  assert.equal(output.adapters, 4);
  assert.deepEqual(output.new_implementation_adapters, ['python-v2']);
  assert.deepEqual(output.blocked_adapters, ['typescript-v2']);
  assert.equal(output.canonical_writes_allowed, false);
  assert.equal(output.publication_allowed, false);
  assert.equal(fs.existsSync(path.join(root, 'mcp-conformance-output.json')), false);
});