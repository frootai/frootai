// @ts-check
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createRequire } = require("node:module");
const test = require("node:test");
const { AgentFaiClientError, EXIT_BY_CODE, redact } = require("../lib/agent/client-error.js");
const { createAgentFaiClient, normalizeBaseUrl } = require("../lib/agent/protocol-client.js");
const { parseStrictJson } = require("../lib/agent/strict-json.js");
const { parseNoProxy, noProxyMatches, resolveProxy } = require("../lib/agent/proxy-policy.js");
const { parseSse } = require("../lib/agent/sse.js");

const requestId = "33333333-3333-4333-8333-333333333333";
const token = "test-bearer-token-never-log";
const cliRoot = path.resolve(__dirname, "..");
const sessionId = "44444444-4444-4444-8444-444444444444";
const turnId = "55555555-5555-4555-8555-555555555555";

function warningEvent(sequence, overrides = {}) {
  const eventId = sequence === 1 ? "11111111-1111-4111-8111-111111111111" : sequence === 2 ? "22222222-2222-4222-8222-222222222222" : "66666666-6666-4666-8666-666666666666";
  return { schemaVersion: "agent-fai-event.v1", eventId, requestId, sessionId, turnId, sequence, occurredAt: "2026-08-13T00:00:00Z", type: "warning", data: { eventType: "warning", code: "warning.code", messageCode: "warning.message" }, ...overrides };
}

function completedEvent(sequence, overrides = {}) {
  return { schemaVersion: "agent-fai-event.v1", eventId: "77777777-7777-4777-8777-777777777777", requestId, sessionId, turnId, sequence, occurredAt: "2026-08-13T00:00:01Z", type: "turn.completed", data: { eventType: "turn.completed", outcome: "completed", artifactRefs: [] }, ...overrides };
}

function sse(event) { return `id: ${event.sequence}\ndata: ${JSON.stringify(event)}\n\n`; }

function turnStreamOptions(overrides = {}) { return { identity: { requestId }, ...overrides }; }

function streamResponse(init, body, lastSequence) {
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream; charset=utf-8", "agent-fai-version": "1", "x-request-id": new Headers(init.headers).get("x-request-id"), "agent-fai-last-sequence": String(lastSequence) } });
}

function compatibility(overrides = {}) {
  return {
    schemaVersion: "agent-fai-compatibility.v1",
    requestedApiVersion: "1",
    supportedApiVersions: ["1"],
    negotiatedApiVersion: "1",
    contractVersion: "1.0.0",
    minimumClientVersion: "1.0.0",
    supportedEventVersions: ["agent-fai-event.v1"],
    supportedCapabilities: ["events.v1", "replay"],
    negotiatedCapabilities: ["events.v1", "replay"],
    unsupportedCapabilities: [],
    deprecation: { deprecated: false, sunsetAt: null, replacement: null },
    ...overrides,
  };
}

function jsonResponse(init, payload, status = 200, headers = {}) {
  const request = new Headers(init.headers);
  return new Response(typeof payload === "string" ? payload : JSON.stringify(payload), { status, headers: { "content-type": "application/json", "agent-fai-version": "1", "x-request-id": request.get("x-request-id"), ...headers } });
}

function createTestClient(fetchImpl, overrides = {}) {
  return createAgentFaiClient({ baseUrl: "https://agent.example.test", fetchImpl, authProvider: async () => ({ token, scheme: "Bearer" }), requestIdFactory: () => requestId, env: {}, ...overrides });
}

function standardFetch(handler = async (_url, init) => jsonResponse(init, { items: [], nextCursor: null })) {
  return async (url, init) => String(url).endsWith("/compatibility") ? jsonResponse(init, compatibility()) : handler(url, init);
}

test("client negotiates before sending an authenticated validated request", async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url: String(url), init });
    if (String(url).endsWith("/compatibility")) {
      return new Response(JSON.stringify({
        schemaVersion: "agent-fai-compatibility.v1",
        requestedApiVersion: "1",
        supportedApiVersions: ["1"],
        negotiatedApiVersion: "1",
        contractVersion: "1.0.0",
        minimumClientVersion: "1.0.0",
        supportedEventVersions: ["agent-fai-event.v1"],
        supportedCapabilities: ["events.v1", "replay"],
        negotiatedCapabilities: ["events.v1", "replay"],
        unsupportedCapabilities: [],
        deprecation: { deprecated: false, sunsetAt: null, replacement: null },
      }), { status: 200, headers: { "content-type": "application/json", "agent-fai-version": "1", "x-request-id": requestId } });
    }
    return new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200, headers: { "content-type": "application/json", "agent-fai-version": "1", "x-request-id": requestId } });
  };
  const client = createAgentFaiClient({
    baseUrl: "https://agent.example.test",
    fetchImpl,
    authProvider: async () => ({ token, scheme: "Bearer" }),
    requestIdFactory: () => requestId,
  });

  const result = await client.listSessions();
  assert.deepEqual(result, { items: [], nextCursor: null });
  assert.equal(requests.length, 2);
  assert.equal(new Headers(requests[0].init.headers).has("authorization"), false);
  const protectedHeaders = new Headers(requests[1].init.headers);
  assert.equal(protectedHeaders.get("authorization"), `Bearer ${token}`);
  assert.equal(protectedHeaders.get("agent-fai-version"), "1");
  assert.equal(protectedHeaders.get("x-request-id"), requestId);
  assert.doesNotMatch(JSON.stringify(client.diagnostics()), new RegExp(token, "u"));
});

test("operation registry contains the exact 20 independently generated operations and methods", () => {
  const registry = require("../lib/agent/operation-registry.generated.js");
  assert.equal(registry.operations.length, 20);
  assert.equal(new Set(registry.operations.map((entry) => entry.operationId)).size, 20);
  const client = createTestClient(standardFetch());
  for (const operation of registry.operations) assert.equal(typeof client[operation.friendlyName], "function", operation.friendlyName);
  assert.equal(typeof client.streamTurnEvents, "function");
  assert.equal(typeof client.streamJobEvents, "function");
});

test("operation registry generator is deterministic and drift-free", () => {
  const generator = require("../scripts/generate-agent-operation-registry.js");
  assert.equal(fs.readFileSync(generator.OUTPUT_PATH, "utf8"), generator.generate());
  assert.equal(generator.generate(), generator.generate());
});

test("operation registry rejects a missing or unexpected OpenAPI operation", () => {
  const { generateDefinition } = require("../scripts/generate-agent-operation-registry.js");
  const source = JSON.parse(fs.readFileSync(path.join(cliRoot, "commands/agent/agent-fai-v1.openapi.json"), "utf8"));
  delete source.paths["/v1/agent-fai/usage-receipts/{receiptId}"];
  assert.throws(() => generateDefinition(source), /exact pinned source/u);
});

test("generated operation registry is recursively immutable", () => {
  const registry = require("../lib/agent/operation-registry.generated.js");
  const operation = registry.byFriendlyName.listTurnEvents;
  const parameter = operation.parameters.find((entry) => entry.name === "Last-Event-ID");
  const originalPattern = parameter.schema.pattern;
  const originalErrorStatus = operation.errorStatuses[0];
  assert.throws(() => { operation.parameters[0].required = false; }, TypeError);
  assert.throws(() => { parameter.schema.pattern = ".*"; }, TypeError);
  assert.throws(() => { operation.errorStatuses[0] = 599; }, TypeError);
  assert.throws(() => { operation.successResponses[0].requiredHeaders.push({ name: "x-unsafe" }); }, TypeError);
  assert.equal(parameter.schema.pattern, originalPattern);
  assert.equal(operation.errorStatuses[0], originalErrorStatus);
  assert.equal(Object.isFrozen(registry.byId), true);
});

test("generator rejects method, security, status, response header, content type, and SSE drift", () => {
  const { generateDefinition } = require("../scripts/generate-agent-operation-registry.js");
  const original = JSON.parse(fs.readFileSync(path.join(cliRoot, "commands/agent/agent-fai-v1.openapi.json"), "utf8"));
  const mutations = [
    (source) => { source.paths["/v1/agent-fai/compatibility"].post = source.paths["/v1/agent-fai/compatibility"].get; delete source.paths["/v1/agent-fai/compatibility"].get; },
    (source) => { source.paths["/v1/agent-fai/compatibility"].get.security = [{ FaiAccessToken: [] }]; },
    (source) => { const responses = source.paths["/v1/agent-fai/sessions"].get.responses; responses[201] = responses[200]; delete responses[200]; },
    (source) => { delete source.paths["/v1/agent-fai/sessions"].get.responses[200].headers["X-Request-Id"]; },
    (source) => { const content = source.paths["/v1/agent-fai/sessions"].get.responses[200].content; content["text/plain"] = content["application/json"]; delete content["application/json"]; },
    (source) => { source.components.schemas.EventStream["x-frootai-sse-framing"].idField = "eventId"; },
  ];
  for (const mutate of mutations) { const source = structuredClone(original); mutate(source); assert.throws(() => generateDefinition(source)); }
});

test("generator rejects unsafe trees, external operation refs, missing pointers, and cycles", () => {
  const { generateDefinition } = require("../scripts/generate-agent-operation-registry.js");
  const original = JSON.parse(fs.readFileSync(path.join(cliRoot, "commands/agent/agent-fai-v1.openapi.json"), "utf8"));
  const mutations = [
    (source) => { source.info.summary += "\u202e"; },
    (source) => { source.paths["/v1/agent-fai/sessions"].get.parameters[0].$ref = "https://example.test/parameter.json"; },
    (source) => { source.paths["/v1/agent-fai/sessions"].get.parameters[0].$ref = "#/components/parameters/Missing"; },
    (source) => { source.components.parameters.ContractVersion = { $ref: "#/components/parameters/ContractVersion" }; },
  ];
  for (const mutate of mutations) { const source = structuredClone(original); mutate(source); assert.throws(() => generateDefinition(source)); }
});

test("generator exact source rejects symbols, hidden properties, accessors, and unexpected prototypes at any depth", () => {
  const { generateDefinition } = require("../scripts/generate-agent-operation-registry.js");
  const original = JSON.parse(fs.readFileSync(path.join(cliRoot, "commands/agent/agent-fai-v1.openapi.json"), "utf8"));
  const mutations = [
    (source) => { source[Symbol("root")] = true; },
    (source) => { source.components.schemas.Client[Symbol("nested")] = true; },
    (source) => { Object.defineProperty(source.components.schemas.Client.properties, "hidden", { value: { type: "string" }, enumerable: false }); },
    (source) => { Object.defineProperty(source.info, "title", { get() { throw new Error("accessor executed"); }, enumerable: true }); },
    (source) => { Object.setPrototypeOf(source.components.schemas.Client, null); },
  ];
  for (const mutate of mutations) {
    const source = structuredClone(original);
    mutate(source);
    assert.throws(() => generateDefinition(source), (error) => !String(error).includes("accessor executed"));
  }
});

test("generator scans unused components for external refs and local ref cycles", () => {
  const { generateDefinition } = require("../scripts/generate-agent-operation-registry.js");
  const original = JSON.parse(fs.readFileSync(path.join(cliRoot, "commands/agent/agent-fai-v1.openapi.json"), "utf8"));
  const external = structuredClone(original);
  external.components.schemas.UnusedExternal = { $ref: "https://example.test/unused.json" };
  assert.throws(() => generateDefinition(external), /external/u);
  const cyclic = structuredClone(original);
  cyclic.components.schemas.UnusedA = { $ref: "#/components/schemas/UnusedB" };
  cyclic.components.schemas.UnusedB = { $ref: "#/components/schemas/UnusedA" };
  assert.throws(() => generateDefinition(cyclic), /cycle/u);
});

test("generator rejects exact-source parameter, response, header, and unused component drift", () => {
  const { generateDefinition } = require("../scripts/generate-agent-operation-registry.js");
  const original = JSON.parse(fs.readFileSync(path.join(cliRoot, "commands/agent/agent-fai-v1.openapi.json"), "utf8"));
  const mutations = [
    (source) => { source.components.parameters.Limit.schema.maximum = 99; },
    (source) => { source.paths["/v1/agent-fai/sessions"].get.responses[200].content["application/json"].schema.$ref = "https://example.test/SessionPage.json"; },
    (source) => { source.paths["/v1/agent-fai/sessions"].get.responses[200].headers["X-Request-Id"].required = false; },
    (source) => { source.components.schemas.UnusedExternal = { $ref: "https://example.test/unused.json" }; },
  ];
  for (const mutate of mutations) { const source = structuredClone(original); mutate(source); assert.throws(() => generateDefinition(source)); }
});

test("vendored T010 artifacts and all pinned source blobs validate exactly", () => {
  const authority = require("../commands/agent/source-authority-t015.js");
  assert.equal(authority.validateAuthorityManifest(), authority.manifest);
});

test("T015 authority validator rejects structural and object identity mutations", () => {
  const { manifest, validateAuthorityManifest } = require("../commands/agent/source-authority-t015.js");
  const changed = JSON.parse(JSON.stringify(manifest)); changed.sources[0].gitBlobOid = "0".repeat(40);
  assert.throws(() => validateAuthorityManifest(changed, false));
  const extra = JSON.parse(JSON.stringify(manifest)); extra.extra = true;
  assert.throws(() => validateAuthorityManifest(extra, false));
});

test("all T006 client error mappings are stable and public messages are safe", () => {
  assert.equal(Object.keys(EXIT_BY_CODE).length, 22);
  for (const [code, exitCode] of Object.entries(EXIT_BY_CODE)) {
    const error = new AgentFaiClientError(code);
    assert.equal(error.exitCode, exitCode); assert.ok(error.message.length > 0 && error.message.length < 128); assert.doesNotMatch(error.message, new RegExp(token, "u"));
  }
});

test("recursive redaction removes credentials, bearer values, proxy userinfo, and known secrets", () => {
  const secret = "known-secret-value";
  const result = JSON.stringify(redact({ authorization: `Bearer ${token}`, nested: [{ password: secret }], note: `https://user:pass@example.test ${secret}` }, [secret]));
  assert.doesNotMatch(result, new RegExp(`${token}|${secret}|user:pass`, "u"));
});

test("endpoint policy accepts only normalized HTTPS origins or the canonical prefix", () => {
  assert.equal(normalizeBaseUrl("https://example.test").origin, "https://example.test");
  assert.equal(normalizeBaseUrl("https://example.test/v1/agent-fai").prefix, "/v1/agent-fai");
  for (const invalid of ["http://example.test", "https://user:pass@example.test", "https://example.test?token=x", "https://example.test/#x", "https://example.test/other"]) assert.throws(() => normalizeBaseUrl(invalid), (error) => error.code === "invalid_argument");
});

test("endpoint policy rejects controls, whitespace, Unicode, percent encoding, and noncanonical case", () => {
  for (const invalid of [" https://example.test", "https://example.test\t", "https://example.test\n", "https://example.test/%2e%2e", "https://example.test/v1%2fagent-fai", "https://münich.example", "https://EXAMPLE.test", "https://example.test:443"]) {
    assert.throws(() => normalizeBaseUrl(invalid), (error) => error.code === "invalid_argument");
  }
});

test("compatibility is unauthenticated and carries exact version, capability, and request headers", async () => {
  let observed;
  const client = createTestClient(async (_url, init) => { observed = new Headers(init.headers); return jsonResponse(init, compatibility()); });
  await client.negotiateCompatibility();
  assert.equal(observed.has("authorization"), false); assert.equal(observed.get("agent-fai-version"), "1");
  assert.equal(observed.get("agent-fai-capabilities"), "events.v1,replay"); assert.equal(observed.get("x-request-id"), requestId);
});

test("compatibility negotiation is single-flight and cached only after success", async () => {
  let compatibilityCalls = 0;
  const client = createTestClient(async (url, init) => {
    if (String(url).endsWith("/compatibility")) { compatibilityCalls += 1; await Promise.resolve(); return jsonResponse(init, compatibility()); }
    return jsonResponse(init, { items: [], nextCursor: null });
  });
  await Promise.all([client.listSessions(), client.listSessions(), client.listSessions()]);
  assert.equal(compatibilityCalls, 1);
});

test("compatibility rejects minimum client, capability, version, and deprecation mismatches", async () => {
  for (const value of [compatibility({ minimumClientVersion: "99.0.0" }), compatibility({ negotiatedCapabilities: ["events.v1"], unsupportedCapabilities: ["replay"] }), compatibility({ negotiatedApiVersion: "2" }), compatibility({ deprecation: { deprecated: true, sunsetAt: "2030-01-01T00:00:00Z", replacement: "2" } })]) {
    const client = createTestClient(async (_url, init) => jsonResponse(init, value));
    await assert.rejects(client.negotiateCompatibility(), (error) => error.code === "integrity_failed");
  }
});

test("compatibility rejects schema, contract, event, supported capability, and deprecation-null drift", async () => {
  const mutations = [
    compatibility({ schemaVersion: "agent-fai-compatibility.v2" }), compatibility({ contractVersion: "1.0.1" }), compatibility({ supportedEventVersions: ["agent-fai-event.v2"] }),
    compatibility({ supportedCapabilities: ["events.v1"] }), compatibility({ deprecation: { deprecated: false, sunsetAt: "2030-01-01T00:00:00Z", replacement: null } }),
  ];
  for (const value of mutations) {
    const client = createTestClient(async (_url, init) => jsonResponse(init, value));
    await assert.rejects(client.negotiateCompatibility(), (error) => error.code === "integrity_failed");
  }
});

test("absent and expired canonical credentials fail authentication without guest fallback", async () => {
  for (const initial of [null, { v: 1, access_token: token, refresh_token: null, token_type: "Bearer", expires_at: "2000-01-01T00:00:00.000Z", scope: null, subject: null, email: null, tier: "free", obtained_at: "1999-12-31T00:00:00.000Z" }]) {
    const backend = require("../commands/auth/credentials-store.js").buildMemoryBackend(initial);
    const client = createAgentFaiClient({ baseUrl: "https://agent.example.test", fetchImpl: standardFetch(), credentialsOptions: { backend }, requestIdFactory: () => requestId, env: {} });
    await assert.rejects(client.listSessions(), (error) => error.code === "authentication_required" && error.exitCode === 65);
  }
});

test("protected requests safely migrate legacy credentials by default", async () => {
  const legacyStore = require("../lib/auth/token-store.js");
  const canonicalStore = require("../commands/auth/credentials-store.js");
  const legacy = { v: 1, access_token: token, refresh_token: "legacy-refresh-token", expires_at: "2026-08-14T00:00:00.000Z", subject: "subject-1", email: null, tier: "pro" };
  const tokenBackend = legacyStore.buildMemoryBackend(legacy);
  const credentialsBackend = canonicalStore.buildMemoryBackend();
  const client = createAgentFaiClient({
    baseUrl: "https://agent.example.test",
    fetchImpl: standardFetch(),
    tokenBackend,
    credentialsOptions: { backend: credentialsBackend },
    identityState: { read: async () => null, clear: async () => false, markPurge: async () => {} },
    requestIdFactory: () => requestId,
    now: () => Date.parse("2026-08-13T00:00:00.000Z"),
    env: {},
  });
  assert.deepEqual(await client.listSessions(), { items: [], nextCursor: null });
  assert.equal(await tokenBackend.get(), null);
  assert.equal((await credentialsBackend.get()).access_token, token);
});

test("credential-store I/O failure is typed as integrity failure", async () => {
  const client = createAgentFaiClient({ baseUrl: "https://agent.example.test", fetchImpl: standardFetch(), credentialsOptions: { backend: { get: async () => { throw new Error(`disk ${token}`); } } }, requestIdFactory: () => requestId, env: {} });
  await assert.rejects(client.listSessions(), (error) => error.code === "integrity_failed" && !JSON.stringify(error).includes(token));
});

test("only Bearer authentication is accepted", async () => {
  const client = createTestClient(standardFetch(), { authProvider: async () => ({ token, scheme: "Basic" }) });
  await assert.rejects(client.listSessions(), (error) => error.code === "integrity_failed");
});

test("malformed canonical credential records fail integrity before authorization", async () => {
  const malformed = [
    { v: 2, access_token: token, token_type: "Bearer", expires_at: null },
    { v: 1, access_token: "short", token_type: "Bearer", expires_at: null },
    { v: 1, access_token: token, token_type: "bearer", expires_at: null },
    { v: 1, access_token: token, token_type: "Bearer", expires_at: "not-a-date" },
    Object.assign(Object.create(null), { v: 1, access_token: token, token_type: "Bearer", expires_at: null }),
  ];
  for (const stored of malformed) {
    const client = createAgentFaiClient({ baseUrl: "https://agent.example.test", fetchImpl: standardFetch(), credentialsOptions: { backend: { get: async () => stored } }, requestIdFactory: () => requestId, env: {} });
    await assert.rejects(client.listSessions(), (error) => error.code === "integrity_failed");
  }
});

test("protected request expands exact path/query and sends no credential profile fields", async () => {
  let protectedRequest;
  const client = createTestClient(standardFetch(async (url, init) => { protectedRequest = { url: String(url), headers: new Headers(init.headers) }; return jsonResponse(init, { items: [], nextCursor: null }); }));
  await client.listSessions({ limit: 10, cursor: "next" });
  assert.equal(protectedRequest.url, "https://agent.example.test/v1/agent-fai/sessions?limit=10&cursor=next");
  assert.equal(protectedRequest.headers.get("authorization"), `Bearer ${token}`);
  for (const name of ["refresh-token", "email", "subject"]) assert.equal(protectedRequest.headers.has(name), false);
});

test("invalid path, query, body, and idempotency inputs fail before protected fetch", async () => {
  let calls = 0; const client = createTestClient(standardFetch(async () => { calls += 1; throw new Error("must not fetch"); }));
  await assert.rejects(client.getSession({ sessionId: "../escape" }), (error) => error.code === "invalid_argument");
  await assert.rejects(client.listSessions({ limit: 101 }), (error) => error.code === "invalid_argument");
  await assert.rejects(client.createSession({ client: {} }, { idempotencyKey: "valid-key" }), (error) => error.code === "invalid_argument");
  assert.equal(calls, 0);
});

test("idempotency exact replay reuses request ID and byte-identical body", async () => {
  const observed = [];
  const client = createTestClient(standardFetch(async (_url, init) => { observed.push({ requestId: new Headers(init.headers).get("x-request-id"), body: init.body }); throw new Error("ambiguous"); }));
  const body = { client: { surface: "cli", version: "6.2.0", capabilities: [] }, retentionProfileId: "default" };
  for (let index = 0; index < 2; index += 1) await assert.rejects(client.createSession(body, { idempotencyKey: "same-key" }), (error) => error.code === "transport_failed");
  assert.deepEqual(observed[1], observed[0]);
});

test("idempotency changed body and cross-path reuse reject locally", async () => {
  let protectedCalls = 0;
  const client = createTestClient(standardFetch(async () => { protectedCalls += 1; throw new Error("ambiguous"); }));
  const body = { client: { surface: "cli", version: "6.2.0", capabilities: [] }, retentionProfileId: "one" };
  await assert.rejects(client.createSession(body, { idempotencyKey: "binding-key" }));
  await assert.rejects(client.createSession({ ...body, retentionProfileId: "two" }, { idempotencyKey: "binding-key" }), (error) => error.code === "idempotency_conflict");
  await assert.rejects(client.resumeSession("44444444-4444-4444-8444-444444444444", { client: body.client }, { idempotencyKey: "binding-key" }), (error) => error.code === "idempotency_conflict");
  assert.equal(protectedCalls, 1);
});

test("idempotency cache is bounded LRU and evicted keys do not retain bindings", async () => {
  let protectedCalls = 0;
  const client = createTestClient(standardFetch(async () => { protectedCalls += 1; throw new Error("ambiguous"); }), { idempotencyCacheSize: 2 });
  const body = (retentionProfileId) => ({ client: { surface: "cli", version: "6.2.0", capabilities: [] }, retentionProfileId });
  await assert.rejects(client.createSession(body("one"), { idempotencyKey: "cache-key-one" }));
  await assert.rejects(client.createSession(body("two"), { idempotencyKey: "cache-key-two" }));
  await assert.rejects(client.createSession(body("one"), { idempotencyKey: "cache-key-one" }));
  await assert.rejects(client.createSession(body("three"), { idempotencyKey: "cache-key-three" }));
  await assert.rejects(client.createSession(body("changed"), { idempotencyKey: "cache-key-two" }), (error) => error.code === "transport_failed");
  assert.equal(protectedCalls, 5);
});

test("ordinary calls do not retry transport failures by default", async () => {
  let calls = 0; const client = createTestClient(standardFetch(async () => { calls += 1; throw new Error("offline"); }));
  await assert.rejects(client.listSessions(), (error) => error.code === "transport_failed"); assert.equal(calls, 1);
});

test("retryable GET transport failure retries only to the caller bound", async () => {
  let calls = 0; const client = createTestClient(standardFetch(async (_url, init) => { calls += 1; if (calls === 1) throw new Error("offline"); return jsonResponse(init, { items: [], nextCursor: null }); }), { sleep: async () => {} });
  assert.deepEqual(await client.listSessions({ maxRetries: 1 }), { items: [], nextCursor: null }); assert.equal(calls, 2);
});

test("caller cancellation maps to exit 130 and does not retry", async () => {
  const controller = new AbortController(); let calls = 0;
  const client = createTestClient(standardFetch(async (_url, init) => { calls += 1; return new Promise((_resolve, reject) => { init.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }); controller.abort(); }); }));
  await assert.rejects(client.listSessions({ signal: controller.signal, maxRetries: 2 }), (error) => error.code === "cancelled" && error.exitCode === 130); assert.equal(calls, 1);
});

test("timeout maps to deadline exceeded and cleans up without retry", async () => {
  const client = createTestClient(standardFetch(async (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("timeout")), { once: true }))));
  await assert.rejects(client.listSessions({ timeoutMs: 5, maxRetries: 2 }), (error) => error.code === "deadline_exceeded" && error.exitCode === 75);
});

test("one absolute deadline cannot be multiplied by retries", async () => {
  let clock = 0; let calls = 0;
  const client = createTestClient(standardFetch(async () => { calls += 1; clock += 3; throw new Error("offline"); }), { now: () => clock, sleep: async () => {} });
  await assert.rejects(client.listSessions({ timeoutMs: 5, maxRetries: 2 }), (error) => error.code === "deadline_exceeded");
  assert.equal(calls, 2);
});

test("compatibility and protected request consume one caller deadline", async () => {
  let clock = 0; let protectedCalls = 0;
  const client = createTestClient(async (url, init) => {
    if (String(url).endsWith("/compatibility")) { clock += 3; return jsonResponse(init, compatibility()); }
    protectedCalls += 1; clock += 3; return jsonResponse(init, { items: [], nextCursor: null });
  }, { now: () => clock });
  await assert.rejects(client.listSessions({ timeoutMs: 5 }), (error) => error.code === "deadline_exceeded");
  assert.equal(protectedCalls, 1);
});

test("compatibility singleflight lets 5ms and 100ms callers enforce deadlines independently", async () => {
  let clock = 0; let release; let compatibilityCalls = 0; let protectedCalls = 0;
  const gate = new Promise((resolve) => { release = resolve; });
  const client = createTestClient(async (url, init) => {
    if (String(url).endsWith("/compatibility")) { compatibilityCalls += 1; await gate; clock = 6; return jsonResponse(init, compatibility()); }
    protectedCalls += 1; return jsonResponse(init, { items: [], nextCursor: null });
  }, { now: () => clock });
  const short = client.listSessions({ timeoutMs: 5 });
  const long = client.listSessions({ timeoutMs: 100 });
  await Promise.resolve(); release();
  await assert.rejects(short, (error) => error.code === "deadline_exceeded");
  assert.deepEqual(await long, { items: [], nextCursor: null });
  assert.equal(compatibilityCalls, 1); assert.equal(protectedCalls, 1);
});

test("client default timeout does not cap a shared compatibility flight for a longer caller", async () => {
  let compatibilityCalls = 0;
  const client = createTestClient(async (url, init) => {
    if (String(url).endsWith("/compatibility")) {
      compatibilityCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 15));
      assert.equal(init.signal.aborted, false);
      return jsonResponse(init, compatibility());
    }
    return jsonResponse(init, { items: [], nextCursor: null });
  }, { timeoutMs: 5, compatibilityTimeoutMs: 100 });
  assert.deepEqual(await client.listSessions({ timeoutMs: 100 }), { items: [], nextCursor: null });
  assert.equal(compatibilityCalls, 1);
});

test("compatibility internal cap aborts a flight and clears it for retry", async () => {
  let compatibilityCalls = 0;
  const client = createTestClient(async (url, init) => {
    if (!String(url).endsWith("/compatibility")) return jsonResponse(init, { items: [], nextCursor: null });
    compatibilityCalls += 1;
    if (compatibilityCalls > 1) return jsonResponse(init, compatibility());
    return new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("compatibility cap")), { once: true }));
  }, { compatibilityTimeoutMs: 5 });
  await assert.rejects(client.negotiateCompatibility({ timeoutMs: 100 }), (error) => error.code === "deadline_exceeded");
  assert.deepEqual(await client.negotiateCompatibility({ timeoutMs: 100 }), compatibility());
  assert.equal(compatibilityCalls, 2);
});

test("cancelling one compatibility waiter does not abort the shared flight", async () => {
  const controller = new AbortController(); let release; let compatibilityCalls = 0; let flightSignal;
  const gate = new Promise((resolve) => { release = resolve; });
  const client = createTestClient(async (_url, init) => {
    compatibilityCalls += 1; flightSignal = init.signal;
    await gate;
    return jsonResponse(init, compatibility());
  }, { compatibilityTimeoutMs: 100 });
  const cancelled = client.negotiateCompatibility({ signal: controller.signal, timeoutMs: 100 });
  const waiting = client.negotiateCompatibility({ timeoutMs: 100 });
  await Promise.resolve(); controller.abort();
  await assert.rejects(cancelled, (error) => error.code === "cancelled");
  assert.equal(flightSignal.aborted, false); release();
  assert.deepEqual(await waiting, compatibility());
  assert.equal(compatibilityCalls, 1);
});

test("response body stalls are covered by the request deadline", async () => {
  const client = createTestClient(standardFetch(async (_url, init) => new Response(new ReadableStream({ pull() { return new Promise(() => {}); } }), { status: 200, headers: { "content-type": "application/json", "agent-fai-version": "1", "x-request-id": new Headers(init.headers).get("x-request-id") } })));
  await assert.rejects(client.listSessions({ timeoutMs: 5 }), (error) => error.code === "deadline_exceeded");
});

test("strict JSON parser rejects duplicate keys, pollution keys, and trailing data", () => {
  assert.throws(() => parseStrictJson('{"a":1,"a":2}'), /duplicate/u);
  assert.throws(() => parseStrictJson('{"__proto__":{}}'), /forbidden/u);
  assert.throws(() => parseStrictJson('{} x'), /trailing/u);
});

test("response content type and oversized response fail closed without body leakage", async () => {
  const wrongType = createTestClient(standardFetch(async (_url, init) => new Response("secret-body", { status: 200, headers: { "content-type": "text/plain", "agent-fai-version": "1", "x-request-id": new Headers(init.headers).get("x-request-id") } })));
  await assert.rejects(wrongType.listSessions(), (error) => error.code === "integrity_failed" && !error.message.includes("secret"));
  const tooLarge = createTestClient(standardFetch(async (_url, init) => jsonResponse(init, "x".repeat(128))), { maximumResponseBytes: 32 });
  await assert.rejects(tooLarge.listSessions(), (error) => error.code === "request_too_large");
});

test("malformed response-like objects and inconsistent ok values are typed integrity failures", async () => {
  const body = new Response("{}").body;
  const candidates = [null, {}, { status: 99, ok: false, headers: new Headers(), body }, { status: 200, ok: false, headers: new Headers(), body }, { status: 200, ok: true, headers: {}, body }, { status: 200, ok: true, headers: new Headers(), body: null }, { status: 200, ok: true, headers: new Headers(), body, url: 42 }];
  for (const candidate of candidates) {
    const client = createTestClient(standardFetch(async () => candidate));
    await assert.rejects(client.listSessions(), (error) => error.code === "integrity_failed" && error instanceof AgentFaiClientError);
  }
});

test("throwing response getters never leak raw TypeError", async () => {
  const candidate = { get status() { throw new TypeError("secret getter"); } };
  const client = createTestClient(standardFetch(async () => candidate));
  await assert.rejects(client.listSessions(), (error) => error.code === "integrity_failed" && !error.message.includes("getter"));
});

test("undeclared listSessions 410 is rejected before a valid problem is trusted", async () => {
  const problem = new AgentFaiClientError("resource_gone", { requestId, errorId: "88888888-8888-4888-8888-888888888888" }).toProblem();
  const client = createTestClient(standardFetch(async (_url, init) => jsonResponse(init, problem, 410)));
  await assert.rejects(client.listSessions(), (error) => error.code === "integrity_failed");
});

test("duplicate-key and malicious error responses become content-free integrity failures", async () => {
  const client = createTestClient(standardFetch(async (_url, init) => jsonResponse(init, '{"error":{},"error":{"message":"Bearer stolen"}}', 503)));
  await assert.rejects(client.listSessions(), (error) => error.code === "integrity_failed" && !JSON.stringify(error).includes("stolen"));
});

test("redirects are manual and every 3xx response is an integrity failure", async () => {
  let redirectMode;
  const client = createTestClient(standardFetch(async (_url, init) => { redirectMode = init.redirect; return new Response("", { status: 307, headers: { location: "https://other.test" } }); }));
  await assert.rejects(client.listSessions(), (error) => error.code === "integrity_failed"); assert.equal(redirectMode, "manual");
});

test("proxy environment precedence, NO_PROXY domain/port/IPv6, and wildcard matching are exact", () => {
  const target = new URL("https://api.example.test:8443/path");
  assert.equal(resolveProxy(target, { HTTPS_PROXY: "http://upper:8080", https_proxy: "http://lower:8080" }).proxyUrl, "http://upper:8080/");
  assert.equal(noProxyMatches(target, parseNoProxy(".example.test:8443")), true);
  assert.equal(noProxyMatches(new URL("https://[::1]:443"), parseNoProxy("[::1]:443")), true);
  assert.equal(noProxyMatches(target, parseNoProxy("*")), true);
});

test("invalid proxy and applicable proxy without a factory fail before fetch", async () => {
  assert.throws(() => resolveProxy(new URL("https://example.test"), { HTTPS_PROXY: "socks://proxy" }), (error) => error.code === "integrity_failed");
  let calls = 0; const client = createTestClient(async () => { calls += 1; throw new Error("must not fetch"); }, { env: { HTTPS_PROXY: "http://user:pass@proxy.example:8080" } });
  await assert.rejects(client.negotiateCompatibility(), (error) => error.code === "service_unavailable" && !JSON.stringify(error).includes("user:pass")); assert.equal(calls, 0);
});

test("proxy dispatcher factory is used and direct requests omit dispatcher", async () => {
  const dispatcher = {}; let observed;
  const proxied = createTestClient(async (_url, init) => { observed = init.dispatcher; return jsonResponse(init, compatibility()); }, { env: { HTTPS_PROXY: "http://proxy.example:8080" }, proxyDispatcherFactory: () => dispatcher });
  await proxied.negotiateCompatibility(); assert.equal(observed, dispatcher);
  const direct = createTestClient(async (_url, init) => { observed = Object.hasOwn(init, "dispatcher"); return jsonResponse(init, compatibility()); });
  await direct.negotiateCompatibility(); assert.equal(observed, false);
});

test("SSE parser accepts arbitrary UTF-8 chunks and comment heartbeats", async () => {
  const event = { schemaVersion: "agent-fai-event.v1", eventId: "11111111-1111-4111-8111-111111111111", requestId, sessionId: "44444444-4444-4444-8444-444444444444", turnId: "55555555-5555-4555-8555-555555555555", sequence: 1, occurredAt: "2026-08-13T00:00:00Z", type: "warning", data: { eventType: "warning", code: "warning.code", messageCode: "warning.message" } };
  const bytes = new TextEncoder().encode(`: heartbeat\n\nid: 1\ndata: ${JSON.stringify(event)}\n\n`);
  const body = new ReadableStream({ start(controller) { for (let index = 0; index < bytes.length; index += 3) controller.enqueue(bytes.slice(index, index + 3)); controller.close(); } });
  const parsed = []; for await (const item of parseSse(body)) parsed.push(item.event);
  assert.deepEqual(parsed, [event]);
});

test("SSE parser rejects unknown, duplicate, missing, invalid UTF-8, and oversized framing", async () => {
  const streams = [
    "event: warning\nid: 1\ndata: {}\n\n",
    "id: 1\nid: 1\ndata: {}\n\n",
    "data: {}\n\n",
  ];
  for (const text of streams) {
    const body = new Response(text).body; await assert.rejects(async () => { for await (const unused of parseSse(body)) void unused; }, (error) => error.code === "integrity_failed");
  }
  const invalid = new ReadableStream({ start(controller) { controller.enqueue(Uint8Array.from([0xff, 0xfe])); controller.close(); } });
  await assert.rejects(async () => { for await (const unused of parseSse(invalid)) void unused; }, (error) => error.code === "integrity_failed");
  await assert.rejects(async () => { for await (const unused of parseSse(new Response("x".repeat(100)).body, { maximumEventBytes: 10 })) void unused; }, (error) => error.code === "message_too_large");
});

test("SSE reads clean abort listeners across more than 400 chunks", async () => {
  const controller = new AbortController(); let active = 0; let maximum = 0;
  const signal = {
    get aborted() { return controller.signal.aborted; },
    get reason() { return controller.signal.reason; },
    addEventListener(...args) { active += 1; maximum = Math.max(maximum, active); controller.signal.addEventListener(...args); },
    removeEventListener(...args) { active -= 1; controller.signal.removeEventListener(...args); },
  };
  const chunk = new TextEncoder().encode(": heartbeat\n\n");
  const body = new ReadableStream({ start(streamController) { for (let index = 0; index < 450; index += 1) streamController.enqueue(chunk); streamController.close(); } });
  for await (const unused of parseSse(body, { signal })) void unused;
  assert.equal(active, 0); assert.equal(maximum, 1);
});

test("late rejected fetch and reader promises are observed after abort", async () => {
  const unhandled = []; const onUnhandled = (error) => unhandled.push(error); process.on("unhandledRejection", onUnhandled);
  try {
    let rejectFetch;
    const client = createTestClient(() => new Promise((_resolve, reject) => { rejectFetch = reject; }));
    await assert.rejects(client.negotiateCompatibility({ timeoutMs: 5 }), (error) => error.code === "deadline_exceeded");
    rejectFetch(new Error("late fetch rejection"));

    let rejectRead; let cancellations = 0;
    const reader = { read: () => new Promise((_resolve, reject) => { rejectRead = reject; }), cancel: async () => { cancellations += 1; }, releaseLock: () => {} };
    const controller = new AbortController();
    const reading = (async () => { for await (const unused of parseSse({ getReader: () => reader }, { signal: controller.signal })) void unused; })();
    await Promise.resolve(); controller.abort();
    await assert.rejects(reading, (error) => error.code === "cancelled");
    rejectRead(new Error("late reader rejection"));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(cancellations > 0, true); assert.deepEqual(unhandled, []);
  } finally { process.removeListener("unhandledRejection", onUnhandled); }
});

test("diagnostics contain bounded metadata and no token, URL, key, or body", async () => {
  const client = createTestClient(standardFetch()); await client.listSessions();
  const text = JSON.stringify(client.diagnostics());
  assert.doesNotMatch(text, new RegExp(token, "u")); assert.doesNotMatch(text, /https?:|authorization|idempotency|body/iu);
  assert.match(text, /listAgentFaiSessions/u);
});

test("registry remains partial with protocol capability and bounded T018/T019 commands available", () => {
  const registry = require("../lib/agent/command-registry.generated.js");
  const available = ["help", "version", "ask", "run", "resume", "sessions list", "sessions show", "sessions resume", "sessions export"];
  assert.equal(registry.capability.status, "partial"); assert.deepEqual(registry.capability.implementedOperations, ["help", "protocol-client", "event-reducer", "renderers", "identity", "config", "organization-context", "session-metadata", "headless-execution", "interactive-line-mode", "session-commands", "offline-profile"]);
  assert.equal(registry.capability.state, "offline-profile-available-terminal-preview-partial");
  assert.deepEqual(registry.commands.filter((entry) => entry.implemented).map((entry) => entry.name), available);
  assert.equal(registry.commands.filter((entry) => !available.includes(entry.name)).every((entry) => entry.implemented === false), true);
  assert.equal(require("../lib/agent/dispatch.js").dispatchAgent(["ask", "hello"]).exitCode, 69);
});

test("packed artifact installs and runs public client exports with exact vendored contracts", { timeout: 120000 }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-fai-t015-pack-"));
  try {
    const npm = process.platform === "win32" ? process.execPath : "npm";
    const prefix = process.platform === "win32" ? [path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")] : [];
    const env = { ...process.env, npm_config_cache: path.join(root, "cache"), npm_config_offline: "true", npm_config_audit: "false", npm_config_fund: "false" };
    const packed = spawnSync(npm, [...prefix, "pack", cliRoot, "--ignore-scripts", "--offline", "--json", "--pack-destination", root], { encoding: "utf8", env });
    assert.equal(packed.status, 0, packed.stderr); const metadata = JSON.parse(packed.stdout)[0]; const files = new Set(metadata.files.map((entry) => entry.path));
    for (const file of ["lib/agent/protocol-client.js", "lib/agent/operation-registry.generated.js", "lib/agent/contracts/validators.cjs", "lib/agent/contracts/manifest.v1.json", "lib/agent/contracts/compatibility-current.v1.json"]) assert.equal(files.has(file), true, file);
    assert.deepEqual(require("../package.json").dependencies || {}, {});
    const installDir = path.join(root, "installed");
    const installed = spawnSync(npm, [...prefix, "install", "--prefix", installDir, "--ignore-scripts", "--offline", "--no-audit", "--no-fund", path.join(root, metadata.filename)], { encoding: "utf8", env });
    assert.equal(installed.status, 0, installed.stderr);
    const installedRequire = createRequire(path.join(installDir, "probe.cjs"));
    const protocol = installedRequire("frootai/agent/protocol-client");
    const errors = installedRequire("frootai/agent/client-error");
    assert.equal(typeof protocol.createAgentFaiClient, "function"); assert.equal(typeof errors.AgentFaiClientError, "function");
    const packedClient = protocol.createAgentFaiClient({ baseUrl: "https://agent.example.test", requestIdFactory: () => requestId, authProvider: async () => ({ scheme: "Bearer", token }), env: {}, fetchImpl: standardFetch() });
    assert.deepEqual(await packedClient.listSessions(), { items: [], nextCursor: null });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("constructed transport, timeout, and cancellation errors produce valid T006 exit and problem contracts", () => {
  const errorId = "88888888-8888-4888-8888-888888888888";
  for (const code of ["transport_failed", "deadline_exceeded", "cancelled"]) {
    const error = new AgentFaiClientError(code, { requestId, errorId });
    assert.equal(error.toExit().errorCode, code);
    assert.equal(error.toProblem().error.code, code);
  }
});

test("all 22 standalone errors generate valid UUID-backed exit and problem contracts", () => {
  for (const code of Object.keys(EXIT_BY_CODE)) {
    const error = new AgentFaiClientError(code);
    assert.match(error.requestId, /^[0-9a-f-]{36}$/iu); assert.match(error.errorId, /^[0-9a-f-]{36}$/iu);
    assert.equal(error.toExit().errorCode, code); assert.equal(error.toProblem().error.code, code);
  }
});

test("contradictory status metadata fails closed to the canonical integrity status", () => {
  const error = new AgentFaiClientError("not_found", { status: 503 });
  assert.equal(error.code, "integrity_failed"); assert.equal(error.status, 422); assert.equal(error.toProblem().error.httpStatus, 422);
});

test("timeout and pre-abort settle even when injected fetch ignores its signal", async () => {
  const hanging = createTestClient(standardFetch(async () => new Promise(() => {})));
  await assert.rejects(hanging.listSessions({ timeoutMs: 5 }), (error) => error.code === "deadline_exceeded");
  const controller = new AbortController(); controller.abort();
  await assert.rejects(hanging.listSessions({ signal: controller.signal, timeoutMs: 0 }), (error) => error.code === "cancelled");
});

test("TLS disable environment is rejected before any fetch", () => {
  assert.throws(() => createTestClient(async () => { throw new Error("must not fetch"); }, { env: { NODE_TLS_REJECT_UNAUTHORIZED: "0" } }), (error) => error.code === "integrity_failed");
});

test("streamTurnEvents validates terminal sequence/header identity and sends Last-Event-ID on resume", async () => {
  const event = { schemaVersion: "agent-fai-event.v1", eventId: "11111111-1111-4111-8111-111111111111", requestId, sessionId, turnId, sequence: 2, occurredAt: "2026-08-13T00:00:00Z", type: "turn.completed", data: { eventType: "turn.completed", outcome: "completed", artifactRefs: [] } };
  let lastEventId;
  const client = createTestClient(async (url, init) => {
    if (String(url).endsWith("/compatibility")) return jsonResponse(init, compatibility());
    lastEventId = new Headers(init.headers).get("last-event-id");
    return new Response(`id: 2\ndata: ${JSON.stringify(event)}\n\n`, { status: 200, headers: { "content-type": "text/event-stream; charset=utf-8", "agent-fai-version": "1", "x-request-id": new Headers(init.headers).get("x-request-id"), "agent-fai-last-sequence": "2" } });
  });
  const events = []; for await (const streamed of client.streamTurnEvents(sessionId, turnId, turnStreamOptions({ lastEventId: 1 }))) events.push(streamed);
  assert.deepEqual(events, [event]); assert.equal(lastEventId, "1");
});

test("streamJobEvents requires explicit session and turn identity", async () => {
  const client = createTestClient(async (_url, init) => jsonResponse(init, compatibility()));
  await assert.rejects(async () => { for await (const unused of client.streamJobEvents("99999999-9999-4999-8999-999999999999")) void unused; }, (error) => error.code === "invalid_argument");
  await assert.rejects(async () => { for await (const unused of client.streamTurnEvents(sessionId, turnId)) void unused; }, (error) => error.code === "invalid_argument");
});

test("clean SSE EOF reconnects with exact Last-Event-ID while HTTP IDs change", async () => {
  const first = warningEvent(1); const terminal = completedEvent(2); const observedLastIds = []; const observedHttpIds = []; let protectedCalls = 0;
  const httpIds = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3"];
  const client = createAgentFaiClient({ baseUrl: "https://agent.example.test", authProvider: async () => ({ token, scheme: "Bearer" }), requestIdFactory: () => httpIds.shift(), env: {}, fetchImpl: async (url, init) => {
    if (String(url).endsWith("/compatibility")) return jsonResponse(init, compatibility());
    const headers = new Headers(init.headers); observedLastIds.push(headers.get("last-event-id")); observedHttpIds.push(headers.get("x-request-id")); protectedCalls += 1;
    if (protectedCalls === 1) return streamResponse(init, sse(first), 1);
    return streamResponse(init, sse(first) + sse(terminal), 2);
  } });
  const events = []; for await (const event of client.streamTurnEvents(sessionId, turnId, turnStreamOptions())) events.push(event);
  assert.deepEqual(events, [first, terminal]); assert.deepEqual(observedLastIds, [null, "1"]); assert.equal(new Set(observedHttpIds).size, 2);
});

test("bounded clean SSE EOF exhaustion becomes transport_failed", async () => {
  const first = warningEvent(1); const observedLastIds = [];
  const client = createTestClient(async (url, init) => {
    if (String(url).endsWith("/compatibility")) return jsonResponse(init, compatibility());
    observedLastIds.push(new Headers(init.headers).get("last-event-id"));
    return streamResponse(init, sse(first), 1);
  });
  await assert.rejects(async () => { for await (const unused of client.streamTurnEvents(sessionId, turnId, turnStreamOptions({ maxReconnects: 1 }))) void unused; }, (error) => error.code === "transport_failed");
  assert.deepEqual(observedLastIds, [null, "1"]);
});

test("SSE rejects replay collisions, sequence gaps, and request identity drift", async () => {
  const cases = [
    { body: sse(warningEvent(2)), last: 2 },
    { body: sse(warningEvent(1, { requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })), last: 1 },
  ];
  for (const candidate of cases) {
    const client = createTestClient(async (url, init) => String(url).endsWith("/compatibility") ? jsonResponse(init, compatibility()) : streamResponse(init, candidate.body, candidate.last));
    await assert.rejects(async () => { for await (const unused of client.streamTurnEvents(sessionId, turnId, turnStreamOptions({ maxReconnects: 0 }))) void unused; }, (error) => error.code === "integrity_failed");
  }
  const first = warningEvent(1); const changed = warningEvent(1, { data: { eventType: "warning", code: "warning.changed", messageCode: "warning.message" } }); let calls = 0;
  const collision = createTestClient(async (url, init) => {
    if (String(url).endsWith("/compatibility")) return jsonResponse(init, compatibility());
    calls += 1;
    if (calls === 1) return streamResponse(init, new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(sse(first))); }, pull(controller) { controller.error(new Error("disconnect")); } }), 2);
    return streamResponse(init, sse(changed), 1);
  });
  await assert.rejects(async () => { for await (const unused of collision.streamTurnEvents(sessionId, turnId, turnStreamOptions())) void unused; }, (error) => error.code === "integrity_failed");
});

test("stream compatibility and reconnects cannot reset the caller deadline", async () => {
  let clock = 0; let streamCalls = 0; const lastIds = [];
  const client = createTestClient(async (url, init) => {
    if (String(url).endsWith("/compatibility")) { clock += 2; return jsonResponse(init, compatibility()); }
    streamCalls += 1; lastIds.push(new Headers(init.headers).get("last-event-id")); clock += 2;
    return streamResponse(init, sse(warningEvent(1)), 1);
  }, { now: () => clock });
  await assert.rejects(async () => { for await (const unused of client.streamTurnEvents(sessionId, turnId, turnStreamOptions({ timeoutMs: 5 }))) void unused; }, (error) => error.code === "deadline_exceeded");
  assert.equal(streamCalls, 2); assert.deepEqual(lastIds, [null, "1"]);
});

test("SSE cancellation and deadline remain active after response headers", async () => {
  const hangingFetch = async (url, init) => String(url).endsWith("/compatibility") ? jsonResponse(init, compatibility()) : streamResponse(init, new ReadableStream({ pull() { return new Promise(() => {}); } }), 0);
  const controller = new AbortController(); const cancelled = createTestClient(hangingFetch);
  const cancelledRead = (async () => { for await (const unused of cancelled.streamTurnEvents(sessionId, turnId, turnStreamOptions({ signal: controller.signal }))) void unused; })();
  setTimeout(() => controller.abort(), 5);
  await assert.rejects(cancelledRead, (error) => error.code === "cancelled");
  const timed = createTestClient(hangingFetch);
  await assert.rejects(async () => { for await (const unused of timed.streamTurnEvents(sessionId, turnId, turnStreamOptions({ timeoutMs: 5 }))) void unused; }, (error) => error.code === "deadline_exceeded");
});

test("SSE rejects any event after a terminal event before yielding terminal", async () => {
  const terminal = completedEvent(1); const trailing = warningEvent(2);
  const client = createTestClient(async (url, init) => String(url).endsWith("/compatibility") ? jsonResponse(init, compatibility()) : streamResponse(init, sse(terminal) + sse(trailing), 2));
  const events = [];
  await assert.rejects(async () => { for await (const event of client.streamTurnEvents(sessionId, turnId, turnStreamOptions({ maxReconnects: 0 }))) events.push(event); }, (error) => error.code === "integrity_failed");
  assert.deepEqual(events, []);
});