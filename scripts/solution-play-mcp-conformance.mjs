#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { sha256, stableJson } from './solution-play-claude-plugin.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profilePath = path.join(repositoryRoot, 'data', 'mcp', 'conformance-profile.v1.json');
let profileValidator;

const expectedMatrix = new Map([
  ['request-metadata', 'required'], ['server-discovery', 'required'], ['stdio', 'required'], ['streamable-http', 'required'],
  ['tools', 'required'], ['resources', 'optional'], ['prompts', 'optional'], ['elicitation', 'optional'],
  ['pagination', 'required'], ['completion', 'optional'], ['caching', 'optional'], ['progress', 'optional'],
  ['cancellation', 'required'], ['subscriptions', 'optional'], ['authorization', 'optional'],
  ['roots', 'deprecated'], ['sampling', 'deprecated'], ['logging', 'deprecated'], ['tasks', 'extension'],
]);

const expectedAdapters = {
  'typescript-v2': { language: 'typescript', generation: 'v2', status: 'blocked', availability: 'release-tag-only', allowed: false, discovery: 'discover-then-initialize-fallback', request: 'stateless-per-request', identity: 'result-meta', clientInfo: 'recommended', optional: { completion: 'supported', caching: 'supported', subscriptions: 'supported', authorization: 'supported', elicitation: 'supported' }, tasks: 'extension-adapter-required', versions: ['2026-07-28', '2025-11-25'], packages: { '@modelcontextprotocol/client': '2.0.0', '@modelcontextprotocol/core': '2.0.0', '@modelcontextprotocol/node': '2.0.0', '@modelcontextprotocol/server': '2.0.0' } },
  'python-v2': { language: 'python', generation: 'v2', status: 'current', availability: 'registry', allowed: true, discovery: 'discover-then-initialize-fallback', request: 'stateless-per-request', identity: 'result-meta', clientInfo: 'recommended', optional: { completion: 'supported', caching: 'supported', subscriptions: 'supported', authorization: 'supported', elicitation: 'supported' }, tasks: 'extension-adapter-required', versions: ['2026-07-28', '2025-11-25'], packages: { mcp: '2.0.0', 'mcp-types': '2.0.0' } },
  'typescript-v1-maintenance': { language: 'typescript', generation: 'v1-maintenance', status: 'maintenance', availability: 'registry', allowed: false, discovery: 'initialize-only', request: 'stateful-session', identity: 'initialize-result', clientInfo: 'initialize-required', optional: { completion: 'legacy-session', caching: 'host-owned', subscriptions: 'legacy-session', authorization: 'legacy-session', elicitation: 'legacy-session' }, tasks: 'deprecated-experimental-removed', versions: ['2025-11-25'], packages: { '@modelcontextprotocol/sdk': '1.29.0' } },
  'python-v1-maintenance': { language: 'python', generation: 'v1-maintenance', status: 'maintenance', availability: 'registry', allowed: false, discovery: 'initialize-only', request: 'stateful-session', identity: 'initialize-result', clientInfo: 'initialize-required', optional: { completion: 'legacy-session', caching: 'host-owned', subscriptions: 'legacy-session', authorization: 'legacy-session', elicitation: 'legacy-session' }, tasks: 'deprecated-experimental-removed', versions: ['2025-11-25'], packages: { mcp: '1.29.0' } },
};

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function readJson(filePath) {
  const descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    if (!fs.fstatSync(descriptor).isFile()) throw new Error(`MCP conformance source must be a regular file: ${path.basename(filePath)}`);
    return JSON.parse(fs.readFileSync(descriptor, 'utf8'));
  } finally {
    fs.closeSync(descriptor);
  }
}

function compileProfileValidator() {
  if (profileValidator) return profileValidator;
  const schema = readJson(path.join(repositoryRoot, 'schemas', 'solution-play-mcp-conformance.v1.schema.json'));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  profileValidator = ajv.compile(schema);
  return profileValidator;
}

function packageMap(adapter) {
  return Object.fromEntries([...adapter.packages].sort((left, right) => compareText(left.name, right.name)).map((item) => [item.name, item.version]));
}

export function validateMcpConformanceProfile(document) {
  const validate = compileProfileValidator();
  const errors = [];
  if (!validate(document)) errors.push(...validate.errors.map((error) => `${error.instancePath || '/'} ${error.message}`));
  if (errors.length > 0) return { valid: false, errors };

  const sourceIds = new Set(document.sources.map((source) => source.id));
  if (sourceIds.size !== document.sources.length) errors.push('MCP source ids must be unique');
  for (const required of ['mcp-specification', 'mcp-architecture', 'mcp-sdk-tiers', 'typescript-sdk-v2', 'python-sdk-v2', 'typescript-sdk-v1', 'python-sdk-v1', 'mcp-tasks-extension']) if (!sourceIds.has(required)) errors.push(`required MCP source is missing: ${required}`);

  const matrixIds = new Set();
  for (const row of document.matrix) {
    if (matrixIds.has(row.id)) errors.push(`duplicate MCP matrix row: ${row.id}`);
    matrixIds.add(row.id);
    if (expectedMatrix.get(row.id) !== row.status) errors.push(`MCP matrix status drifted: ${row.id}`);
  }
  for (const id of expectedMatrix.keys()) if (!matrixIds.has(id)) errors.push(`required MCP matrix row is missing: ${id}`);
  const currentCore = stableJson({ specification: document.specification, matrix: document.matrix.filter((row) => !['deprecated', 'extension'].includes(row.status)) });
  for (const prohibited of ['http-sse', 'http-stream', 'websocket', 'sampling/createMessage', 'roots/list', 'logging/setLevel']) if (currentCore.toLowerCase().includes(prohibited.toLowerCase())) errors.push(`current MCP core contains legacy or deprecated behavior: ${prohibited}`);

  const adapterIds = new Set();
  for (const adapter of document.adapters) {
    if (adapterIds.has(adapter.id)) errors.push(`duplicate MCP SDK adapter: ${adapter.id}`);
    adapterIds.add(adapter.id);
    const expected = expectedAdapters[adapter.id];
    if (!expected) { errors.push(`unknown MCP SDK adapter: ${adapter.id}`); continue; }
    if (adapter.language !== expected.language || adapter.generation !== expected.generation || adapter.status !== expected.status || adapter.availability !== expected.availability || adapter.allowed_for_new_implementation !== expected.allowed || adapter.discovery_strategy !== expected.discovery || adapter.request_model !== expected.request || adapter.server_identity_location !== expected.identity || adapter.client_info_requirement !== expected.clientInfo || stableJson(adapter.optional_features) !== stableJson(expected.optional) || adapter.tasks_support !== expected.tasks) errors.push(`MCP SDK behavior drifted: ${adapter.id}`);
    if (stableJson(adapter.protocol_versions) !== stableJson(expected.versions)) errors.push(`MCP SDK protocol versions drifted: ${adapter.id}`);
    if (stableJson(packageMap(adapter)) !== stableJson(expected.packages)) errors.push(`MCP SDK package pins drifted: ${adapter.id}`);
    if (!sourceIds.has(adapter.source_id)) errors.push(`MCP SDK adapter source is unresolved: ${adapter.id}`);
  }
  for (const id of Object.keys(expectedAdapters)) if (!adapterIds.has(id)) errors.push(`required MCP SDK adapter is missing: ${id}`);
  return { valid: errors.length === 0, errors };
}

export function resolveMcpSdkAdapter(document, adapterId, { usage = 'new' } = {}) {
  const validation = validateMcpConformanceProfile(document);
  if (!validation.valid) throw new Error(`MCP conformance profile invalid: ${validation.errors.join('; ')}`);
  const adapter = document.adapters.find((candidate) => candidate.id === adapterId);
  if (!adapter) throw new Error(`MCP SDK adapter is not declared: ${adapterId}`);
  if (!['new', 'legacy', 'inspect'].includes(usage)) throw new Error(`MCP SDK adapter usage is invalid: ${usage}`);
  if (usage === 'new' && !adapter.allowed_for_new_implementation) throw new Error(`MCP SDK adapter is not available for new implementation: ${adapterId}`);
  if (usage === 'legacy' && adapter.generation !== 'v1-maintenance') throw new Error(`MCP SDK adapter is not a legacy fallback: ${adapterId}`);
  return Object.freeze({
    id: adapter.id,
    language: adapter.language,
    current_protocol: document.specification.version,
    protocol_versions: Object.freeze([...adapter.protocol_versions]),
    packages: Object.freeze(packageMap(adapter)),
    status: adapter.status,
    availability: adapter.availability,
    allowed_for_new_implementation: adapter.allowed_for_new_implementation,
    discovery_strategy: adapter.discovery_strategy,
    request_model: adapter.request_model,
    server_identity_location: adapter.server_identity_location,
    client_info_requirement: adapter.client_info_requirement,
    optional_features: Object.freeze({ ...adapter.optional_features }),
    tasks_support: adapter.tasks_support,
  });
}

export function buildMcpConformanceMatrix(document) {
  const validation = validateMcpConformanceProfile(document);
  if (!validation.valid) throw new Error(`MCP conformance profile invalid: ${validation.errors.join('; ')}`);
  const matrix = {
    schema_version: document.schema_version,
    task: document.task,
    protocol_version: document.specification.version,
    rows: Object.fromEntries([...document.matrix].sort((left, right) => compareText(left.id, right.id)).map((row) => [row.id, { layer: row.layer, status: row.status, methods: [...row.methods] }])),
    adapters: Object.fromEntries([...document.adapters].sort((left, right) => compareText(left.id, right.id)).map((adapter) => [adapter.id, resolveMcpSdkAdapter(document, adapter.id, { usage: 'inspect' })])),
    boundaries: document.boundaries,
  };
  return { ...matrix, profile_sha256: sha256(stableJson(document)), matrix_sha256: sha256(stableJson(matrix)) };
}

export function loadDefaultMcpConformanceProfile() {
  return readJson(profilePath);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const profile = loadDefaultMcpConformanceProfile();
    const matrix = buildMcpConformanceMatrix(profile);
    process.stdout.write(stableJson({ status: 'valid', task: matrix.task, protocol_version: matrix.protocol_version, rows: Object.keys(matrix.rows).length, adapters: Object.keys(matrix.adapters).length, new_implementation_adapters: matrix.boundaries.new_implementation_adapters, blocked_adapters: matrix.boundaries.blocked_adapters, tasks_owner: matrix.boundaries.tasks_owner, profile_sha256: matrix.profile_sha256, matrix_sha256: matrix.matrix_sha256, canonical_writes_allowed: false, publication_allowed: false }));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}