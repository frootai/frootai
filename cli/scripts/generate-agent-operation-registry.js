#!/usr/bin/env node
// @ts-check
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { parseStrictJson } = require("../lib/agent/strict-json.js");

const CLI_ROOT = path.resolve(__dirname, "..");
const SOURCE_PATH = path.join(CLI_ROOT, "commands", "agent", "agent-fai-v1.openapi.json");
const OUTPUT_PATH = path.join(CLI_ROOT, "lib", "agent", "operation-registry.generated.js");
const EXPECTED_SOURCE_SHA256 = "ed31d1dbd9a70770bf1cbdcc85d2ee10d25c8dabf8fffdd3b3cebed860fe4c2f";
const EXPECTED_SEMANTIC_SHA256 = "7effcdd53f3f776b8d331a7a0bdc63e37127c9fd2ac105304e1b3181a8e6c503";
const FRIENDLY_NAMES = Object.freeze({
  negotiateAgentFaiCompatibility: "negotiateCompatibility",
  listAgentFaiSessions: "listSessions",
  createAgentFaiSession: "createSession",
  getAgentFaiSession: "getSession",
  resumeAgentFaiSession: "resumeSession",
  exportAgentFaiSession: "exportSession",
  createAgentFaiTurn: "createTurn",
  getAgentFaiTurn: "getTurn",
  listAgentFaiTurnEvents: "listTurnEvents",
  cancelAgentFaiTurn: "cancelTurn",
  listAgentFaiJobs: "listJobs",
  createAgentFaiJob: "createJob",
  getAgentFaiJob: "getJob",
  listAgentFaiJobEvents: "listJobEvents",
  cancelAgentFaiJob: "cancelJob",
  listAgentFaiArtifacts: "listArtifacts",
  getAgentFaiArtifact: "getArtifact",
  verifyAgentFaiArtifact: "verifyArtifact",
  getAgentFaiContextManifest: "getContextManifest",
  getAgentFaiUsageReceipt: "getUsageReceipt",
});
const EXPECTED_OPERATIONS = Object.freeze({
  negotiateAgentFaiCompatibility: ["GET", "/v1/agent-fai/compatibility"],
  listAgentFaiSessions: ["GET", "/v1/agent-fai/sessions"],
  createAgentFaiSession: ["POST", "/v1/agent-fai/sessions"],
  getAgentFaiSession: ["GET", "/v1/agent-fai/sessions/{sessionId}"],
  resumeAgentFaiSession: ["POST", "/v1/agent-fai/sessions/{sessionId}/resume"],
  exportAgentFaiSession: ["POST", "/v1/agent-fai/sessions/{sessionId}/export"],
  createAgentFaiTurn: ["POST", "/v1/agent-fai/sessions/{sessionId}/turns"],
  getAgentFaiTurn: ["GET", "/v1/agent-fai/sessions/{sessionId}/turns/{turnId}"],
  listAgentFaiTurnEvents: ["GET", "/v1/agent-fai/sessions/{sessionId}/turns/{turnId}/events"],
  cancelAgentFaiTurn: ["POST", "/v1/agent-fai/sessions/{sessionId}/turns/{turnId}/cancel"],
  listAgentFaiJobs: ["GET", "/v1/agent-fai/jobs"],
  createAgentFaiJob: ["POST", "/v1/agent-fai/jobs"],
  getAgentFaiJob: ["GET", "/v1/agent-fai/jobs/{jobId}"],
  listAgentFaiJobEvents: ["GET", "/v1/agent-fai/jobs/{jobId}/events"],
  cancelAgentFaiJob: ["POST", "/v1/agent-fai/jobs/{jobId}/cancel"],
  listAgentFaiArtifacts: ["GET", "/v1/agent-fai/artifacts"],
  getAgentFaiArtifact: ["GET", "/v1/agent-fai/artifacts/{artifactId}"],
  verifyAgentFaiArtifact: ["POST", "/v1/agent-fai/artifacts/{artifactId}/verify"],
  getAgentFaiContextManifest: ["GET", "/v1/agent-fai/context-manifests/{manifestId}"],
  getAgentFaiUsageReceipt: ["GET", "/v1/agent-fai/usage-receipts/{receiptId}"],
});
const EXPECTED_STATUSES = Object.freeze({
  negotiateAgentFaiCompatibility: "200,400,503", listAgentFaiSessions: "200,400,401,403,503", createAgentFaiSession: "201,400,401,403,409,422,429,503",
  getAgentFaiSession: "200,400,401,403,404,410,503", resumeAgentFaiSession: "200,400,401,403,404,409,410,422,503", exportAgentFaiSession: "202,400,401,403,404,409,410,422,503",
  createAgentFaiTurn: "202,400,401,403,404,409,413,422,429,503,504", getAgentFaiTurn: "200,400,401,403,404,410,503", listAgentFaiTurnEvents: "200,400,401,403,404,409,410,503",
  cancelAgentFaiTurn: "202,400,401,403,404,409,410,499,503", listAgentFaiJobs: "200,400,401,403,503", createAgentFaiJob: "202,400,401,403,409,413,422,429,503,504",
  getAgentFaiJob: "200,400,401,403,404,410,503", listAgentFaiJobEvents: "200,400,401,403,404,409,410,503", cancelAgentFaiJob: "202,400,401,403,404,409,410,499,503",
  listAgentFaiArtifacts: "200,400,401,403,503", getAgentFaiArtifact: "200,400,401,403,404,410,503", verifyAgentFaiArtifact: "200,400,401,403,404,409,410,422,503",
  getAgentFaiContextManifest: "200,400,401,403,404,410,503", getAgentFaiUsageReceipt: "200,400,401,403,404,410,503",
});
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const UNSAFE_TEXT = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u;
const EXPECTED_EXTERNAL_REFS = new Set([
  "https://frootai.dev/schemas/agent-fai-session.v1.json",
  "https://frootai.dev/schemas/agent-fai-turn.v1.json",
  "https://frootai.dev/schemas/agent-fai-event.v1.json",
  "https://frootai.dev/schemas/agent-fai-context-manifest.v1.json",
  "https://frootai.dev/schemas/agent-fai-usage-receipt.v1.json",
  "https://frootai.dev/schemas/agent-fai-problem.v1.json",
]);

function dataKeys(value, label = "OpenAPI source") {
  const keys = Reflect.ownKeys(value);
  const result = [];
  for (const key of keys) {
    if (Array.isArray(value) && key === "length") continue;
    if (typeof key === "symbol") throw new Error(`${label} contains a symbol key`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable) throw new Error(`${label} contains a non-enumerable property`);
    if (!("value" in descriptor)) throw new Error(`${label} contains an accessor property`);
    result.push(key);
  }
  return result;
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${dataKeys(value).map((key) => canonicalJson(Object.getOwnPropertyDescriptor(value, key).value)).join(",")}]`;
  return `{${dataKeys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(Object.getOwnPropertyDescriptor(value, key).value)}`).join(",")}}`;
}

function assertSafeTree(value, label = "OpenAPI source", seen = new WeakSet()) {
  if (typeof value === "string") {
    if (UNSAFE_TEXT.test(value)) throw new Error(`${label} contains unsafe text`);
    return;
  }
  if (value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return;
  if (!value || typeof value !== "object" || seen.has(value)) throw new Error(`${label} contains a non-plain or cyclic value`);
  const expectedPrototype = Array.isArray(value) ? Array.prototype : Object.prototype;
  if (Object.getPrototypeOf(value) !== expectedPrototype) throw new Error(`${label} contains a non-plain object`);
  seen.add(value);
  for (const key of dataKeys(value, label)) {
    if (FORBIDDEN_KEYS.has(key) || UNSAFE_TEXT.test(key)) throw new Error(`${label} contains a forbidden key`);
    assertSafeTree(Object.getOwnPropertyDescriptor(value, key).value, label, seen);
  }
}

function parseSource() {
  const raw = fs.readFileSync(SOURCE_PATH, "utf8");
  if (crypto.createHash("sha256").update(raw).digest("hex") !== EXPECTED_SOURCE_SHA256) throw new Error("Agent FAI OpenAPI raw source digest mismatch");
  const source = parseStrictJson(raw, "Agent FAI OpenAPI source");
  assertSafeTree(source);
  validateReferenceGraph(source, source);
  if (crypto.createHash("sha256").update(canonicalJson(source)).digest("hex") !== EXPECTED_SEMANTIC_SHA256) throw new Error("Agent FAI OpenAPI semantic source digest mismatch");
  if (source.openapi !== "3.1.0" || source.info?.version !== "1.0.0" || source["x-frootai-contract-status"] !== "contract-only-unimplemented" || source["x-frootai-compatibility"]?.apiMajor !== 1 || source["x-frootai-compatibility"]?.pathPrefix !== "/v1/agent-fai" || source.servers?.[0]?.url !== "https://frootai.dev") throw new Error("unsupported Agent FAI OpenAPI source");
  return source;
}

function resolvePointer(source, reference) {
  if (typeof reference !== "string" || !reference.startsWith("#/") || UNSAFE_TEXT.test(reference)) throw new Error("external or unsafe ref is forbidden");
  let fragment;
  try { fragment = decodeURIComponent(reference.slice(2)); } catch { throw new Error("ref pointer encoding is invalid"); }
  let current = source;
  for (const token of fragment.split("/")) {
    const key = token.replaceAll("~1", "/").replaceAll("~0", "~");
    if (/~(?![01])/u.test(token) || !current || typeof current !== "object" || !Object.hasOwn(current, key)) throw new Error("ref pointer escapes or does not exist");
    current = current[key];
  }
  return current;
}

function resolveRef(source, value, references = new Set()) {
  if (!value?.$ref) return value;
  if (Object.keys(value).length !== 1) throw new Error("ref siblings are forbidden");
  if (references.has(value.$ref)) throw new Error("ref cycle detected");
  const next = new Set(references); next.add(value.$ref);
  return resolveRef(source, resolvePointer(source, value.$ref), next);
}

function validateReferenceGraph(source, value, references = new Set()) {
  if (!value || typeof value !== "object") return;
  for (const key of dataKeys(value)) {
    const child = Object.getOwnPropertyDescriptor(value, key).value;
    if (key === "$ref") {
      if (typeof child !== "string") throw new Error("ref is invalid");
      if (EXPECTED_EXTERNAL_REFS.has(child)) continue;
      if (references.has(child)) throw new Error("ref cycle detected");
      const next = new Set(references); next.add(child);
      validateReferenceGraph(source, resolvePointer(source, child), next);
    } else {
      validateReferenceGraph(source, child, references);
    }
  }
}

function validatorName(schema) {
  if (!schema) return null;
  const name = schema.$ref?.split("/").at(-1);
  return name ? `validateApi${name}` : null;
}

function responseMetadata(source, status, rawResponse) {
  const responseRef = rawResponse?.$ref || null;
  const response = resolveRef(source, rawResponse);
  if (!response || typeof response !== "object") throw new Error(`response ${status} is invalid`);
  const contentTypes = Object.keys(response.content || {}).sort();
  if (contentTypes.length === 0) throw new Error(`response ${status} has no content type`);
  const jsonSchema = response.content?.["application/json"]?.schema;
  const streamSchema = response.content?.["text/event-stream"]?.schema;
  const streamDefinition = streamSchema ? resolveRef(source, streamSchema) : null;
  const headers = Object.entries(response.headers || {}).map(([name, header]) => {
    const resolved = resolveRef(source, header);
    return { name, required: true, schema: resolveRef(source, resolved.schema) || null };
  });
  return {
    status: Number(status),
    contentTypes,
    validator: validatorName(jsonSchema),
    requiredHeaders: headers,
    responseRef,
    sse: streamDefinition?.["x-frootai-sse-framing"] || null,
  };
}

function generateDefinition(source = parseSource()) {
  assertSafeTree(source);
  validateReferenceGraph(source, source);
  const pinnedSource = parseSource();
  validateReferenceGraph(pinnedSource, pinnedSource);
  if (canonicalJson(source) !== canonicalJson(pinnedSource)) throw new Error("Agent FAI OpenAPI candidate does not match the exact pinned source");
  if (source.openapi !== "3.1.0" || source.info?.version !== "1.0.0" || source["x-frootai-contract-status"] !== "contract-only-unimplemented" || source["x-frootai-compatibility"]?.apiMajor !== 1 || source["x-frootai-compatibility"]?.pathPrefix !== "/v1/agent-fai") throw new Error("unsupported Agent FAI OpenAPI source");
  const operations = [];
  for (const [route, pathItem] of Object.entries(source.paths)) {
    for (const [method, candidate] of Object.entries(pathItem)) {
      if (!candidate || typeof candidate !== "object" || !candidate.operationId) continue;
      const friendlyName = FRIENDLY_NAMES[candidate.operationId];
      if (!friendlyName) throw new Error(`unexpected operationId ${candidate.operationId}`);
      const parameters = [...(pathItem.parameters || []), ...(candidate.parameters || [])].map((entry) => resolveRef(source, entry)).map((entry) => ({
        name: entry.name,
        in: entry.in,
        required: entry.required === true,
        schema: resolveRef(source, entry.schema),
      }));
      const security = candidate.security ?? source.security;
      const expected = EXPECTED_OPERATIONS[candidate.operationId];
      if (!expected || expected[0] !== method.toUpperCase() || expected[1] !== route) throw new Error(`operation method/path drift for ${candidate.operationId}`);
      if (JSON.stringify(security) !== (candidate.operationId === "negotiateAgentFaiCompatibility" ? "[]" : '[{"FaiAccessToken":[]}]')) throw new Error(`operation security drift for ${candidate.operationId}`);
      const requestBody = candidate.requestBody ? resolveRef(source, candidate.requestBody) : null;
      const requestContentTypes = Object.keys(requestBody?.content || {}).sort();
      const requestSchema = requestBody?.content?.["application/json"]?.schema || null;
      if (requestBody && (requestBody.required !== true || requestContentTypes.join("|") !== "application/json" || !validatorName(requestSchema))) throw new Error(`request body metadata is invalid for ${candidate.operationId}`);
      const responseEntries = Object.entries(candidate.responses || {});
      if (responseEntries.length === 0 || responseEntries.some(([status]) => !/^[1-5]\d\d$/u.test(status))) throw new Error(`response statuses are invalid for ${candidate.operationId}`);
      const successes = responseEntries.filter(([status]) => /^2\d\d$/u.test(status)).map(([status, response]) => responseMetadata(source, status, response));
      const errors = responseEntries.filter(([status]) => /^[45]\d\d$/u.test(status)).map(([status, response]) => responseMetadata(source, status, response));
      if (successes.length === 0 || errors.length === 0 || errors.some((entry) => entry.contentTypes.join("|") !== "application/json" || !entry.validator || !entry.responseRef)) throw new Error(`response metadata is incomplete for ${candidate.operationId}`);
      if (responseEntries.map(([status]) => status).join(",") !== EXPECTED_STATUSES[candidate.operationId]) throw new Error(`response status drift for ${candidate.operationId}`);
      for (const response of [...successes, ...errors]) {
        const names = response.requiredHeaders.map((header) => header.name).sort();
        const expectedHeaders = response.contentTypes.includes("text/event-stream") ? ["Agent-FAI-Last-Sequence", "Agent-FAI-Version", "X-Request-Id"] : ["Agent-FAI-Version", "X-Request-Id"];
        if (JSON.stringify(names) !== JSON.stringify(expectedHeaders)) throw new Error(`response header drift for ${candidate.operationId}`);
      }
      const streamMetadata = successes.find((entry) => entry.contentTypes.includes("text/event-stream"));
      for (const response of successes) {
        const expectedContent = streamMetadata === response ? "application/json|text/event-stream" : "application/json";
        if (response.contentTypes.join("|") !== expectedContent || !response.validator) throw new Error(`success content type drift for ${candidate.operationId}`);
      }
      if (streamMetadata && JSON.stringify(streamMetadata.sse) !== JSON.stringify({ idField: "sequence", dataSchema: "https://frootai.dev/schemas/agent-fai-event.v1.json", oneEventPerMessage: true })) throw new Error(`SSE metadata drift for ${candidate.operationId}`);
      const jsonSuccess = successes.find((entry) => entry.contentTypes.includes("application/json"));
      const streamSuccess = successes.find((entry) => entry.contentTypes.includes("text/event-stream"));
      operations.push({
        operationId: candidate.operationId,
        friendlyName,
        method: method.toUpperCase(),
        path: route,
        security,
        auth: security.length !== 0,
        idempotency: method.toUpperCase() === "POST",
        eventStream: Boolean(streamSuccess),
        eventStreamMetadata: streamSuccess?.sse || null,
        pagination: jsonSuccess?.validator?.endsWith("Page") ? { cursorParameter: parameters.some((entry) => entry.name === "cursor") ? "cursor" : parameters.some((entry) => entry.name === "after") ? "after" : null, responseValidator: jsonSuccess.validator } : null,
        parameters,
        requestBody: requestBody ? { required: true, contentTypes: requestContentTypes, validator: validatorName(requestSchema) } : null,
        requestValidator: validatorName(requestSchema),
        responseValidator: jsonSuccess?.validator || null,
        successStatuses: successes.map((entry) => entry.status),
        successResponses: successes,
        errorStatuses: errors.map((entry) => entry.status),
        errorResponses: errors,
      });
    }
  }
  if (operations.length !== 20 || new Set(operations.map((entry) => entry.operationId)).size !== 20 || Object.keys(EXPECTED_OPERATIONS).some((id) => !operations.some((entry) => entry.operationId === id))) throw new Error("Agent FAI operation set must contain the exact 20 T009 operations");
  return { schemaVersion: "agent-fai-operation-registry.v1", source: "commands/agent/agent-fai-v1.openapi.json", operations };
}

function generate(source) {
  const definition = generateDefinition(source);
  return [
    "// Generated by scripts/generate-agent-operation-registry.js. Do not edit.",
    "// @ts-check",
    '"use strict";',
    "",
    `const definition = ${JSON.stringify(definition, null, 2)};`,
    "",
    "function deepFreeze(value, seen = new WeakSet()) {",
    "  if (!value || typeof value !== \"object\" || seen.has(value)) return value;",
    "  seen.add(value);",
    "  for (const key of Reflect.ownKeys(value)) deepFreeze(value[key], seen);",
    "  return Object.freeze(value);",
    "}",
    "deepFreeze(definition);",
    "const byId = Object.freeze(Object.fromEntries(definition.operations.map((operation) => [operation.operationId, operation])));",
    "const byFriendlyName = Object.freeze(Object.fromEntries(definition.operations.map((operation) => [operation.friendlyName, operation])));",
    "module.exports = Object.freeze({ ...definition, byId, byFriendlyName });",
    "",
  ].join("\n");
}

function main(argv = process.argv.slice(2)) {
  const output = generate();
  if (argv.includes("--write")) { fs.writeFileSync(OUTPUT_PATH, output, "utf8"); return 0; }
  if (argv.includes("--check")) return fs.existsSync(OUTPUT_PATH) && fs.readFileSync(OUTPUT_PATH, "utf8") === output ? 0 : 1;
  process.stdout.write(output);
  return 0;
}

if (require.main === module) process.exitCode = main();
module.exports = { SOURCE_PATH, OUTPUT_PATH, FRIENDLY_NAMES, EXPECTED_OPERATIONS, EXPECTED_STATUSES, EXPECTED_SOURCE_SHA256, EXPECTED_SEMANTIC_SHA256, assertSafeTree, generateDefinition, generate, main };