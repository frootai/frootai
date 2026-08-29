// @ts-check
"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");
const test = require("node:test");
const { executeInteractive, executeSessionCommand, observeEvent, parseInteractiveArgs, parseSessionCommand, sessionMetadata } = require("../lib/agent/interactive-host.js");
const { createLineQueue } = require("../lib/agent/line-queue.js");

const sessionId = "44444444-4444-4444-8444-444444444444";
const resumedId = "99999999-9999-4999-8999-999999999999";
const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const baseTime = "2026-08-13T00:00:00.000Z";
const config = { agent: { defaultFormat: "text", color: "never", unicode: "always", requestTimeoutMs: 30000, reconnects: 1, retentionDays: 30 } };

class ManualQueue {
  constructor() { this.values = []; this.waiters = []; this.closed = false; }
  push(value) { if (this.waiters.length) this.waiters.shift()({ value, done: false }); else this.values.push(value); }
  close() { this.closed = true; while (this.waiters.length) this.waiters.shift()({ value: undefined, done: true }); }
  next() { if (this.values.length) return Promise.resolve({ value: this.values.shift(), done: false }); if (this.closed) return Promise.resolve({ value: undefined, done: true }); return new Promise((resolve) => this.waiters.push(resolve)); }
  [Symbol.asyncIterator]() { return this; }
}

function channel(tty = true) { const stream = new PassThrough(); stream.isTTY = tty; stream.columns = 80; stream.text = ""; stream.on("data", (chunk) => { stream.text += chunk.toString("utf8"); }); return stream; }
function blockedChannel() { const stream = new EventEmitter(); stream.isTTY = true; stream.columns = 80; stream.destroyed = false; stream.closed = false; stream.writableEnded = false; stream.write = () => false; return stream; }
function session(id = sessionId) { return { schemaVersion: "agent-fai-session.v1", sessionId: id, principal: { type: "user", subjectId: "subject" }, organizationId, projectId: null, status: "active", createdAt: baseTime, updatedAt: baseTime, expiresAt: null, surfaces: ["cli"], policyVersion: "policy-v1", retention: { profileId: "cli-default", contentPersistence: "account", deleteRequested: false }, lastTurnId: null }; }
function event(identity, sequence, type, data) { return { schemaVersion: "agent-fai-event.v1", eventId: `${String(sequence).padStart(8, "0")}-1111-4111-8111-111111111111`, ...identity, sequence, occurredAt: `2026-08-13T00:00:0${Math.min(sequence, 9)}.000Z`, type, data: { eventType: type, ...data } }; }
function events(identity, content = "Interactive answer") { return [event(identity, 1, "session.started", { surface: "cli" }), event(identity, 2, "turn.accepted", { intent: "answer", authority: "observe", principalDigest: "a".repeat(64), manifestDigest: "b".repeat(64), policyVersion: "policy-v1" }), event(identity, 3, "model.started", { modelAlias: "agent-fai", stream: true }), event(identity, 4, "model.delta", { content }), event(identity, 5, "model.completed", { finishReason: "stop" }), event(identity, 6, "turn.completed", { outcome: "completed", artifactRefs: [] })]; }
function fakeClient(options = {}) {
  const calls = []; let turns = 0;
  return {
    calls,
    async createSession(...args) { calls.push(["createSession", ...args]); return session(); },
    async listSessions(...args) { calls.push(["listSessions", ...args]); return { items: [session()], nextCursor: null }; },
    async getSession(id, ...args) { calls.push(["getSession", id, ...args]); return session(id); },
    async resumeSession(id, ...args) { calls.push(["resumeSession", id, ...args]); return session(id); },
    async createTurn(id, body, requestOptions) { calls.push(["createTurn", id, body, requestOptions]); turns += 1; const suffix = String(turns).padStart(12, "0"); return { sessionId: id, turnId: `55555555-5555-4555-8555-${suffix}`, requestId: `33333333-3333-4333-8333-${suffix}` }; },
    async *streamTurnEvents(id, turnId, streamOptions) { calls.push(["streamTurnEvents", id, turnId, streamOptions]); const identity = { sessionId: id, turnId, requestId: streamOptions.identity.requestId }; for (const item of events(identity, options.content || "Interactive answer")) yield item; },
    async cancelTurn(...args) { calls.push(["cancelTurn", ...args]); return {}; },
    async exportSession(id, body, requestOptions) { calls.push(["exportSession", id, body, requestOptions]); return { schemaVersion: "agent-fai-artifact.v1", artifactId: "77777777-7777-4777-8777-777777777777", sessionId: id, turnId: null, jobId: null, kind: "export", mediaType: "text/markdown", digest: "c".repeat(64), sizeBytes: 10, createdAt: baseTime, downloadUrl: null, supersededBy: null, revoked: false }; },
  };
}
function metadataStore() { const writes = []; return { writes, async upsert(value) { writes.push(value); return value; } }; }
function deps(client, queue, overrides = {}) { let key = 0; const stdin = new EventEmitter(); stdin.isTTY = true; stdin.isRaw = false; stdin.setRawMode = (value) => { stdin.isRaw = value; }; return { protocolClient: client, lineQueue: queue, sessionMetadataStore: metadataStore(), config, stdin, stdout: channel(), stderr: channel(), signalEmitter: new EventEmitter(), env: {}, idempotencyKeyFactory: () => `interactive-key-${++key}`, ...overrides }; }
async function waitFor(predicate) { for (let index = 0; index < 100; index += 1) { if (predicate()) return; await new Promise((resolve) => setImmediate(resolve)); } throw new Error("condition not reached"); }

function fakeInterface() {
  const value = new EventEmitter();
  value.close = () => value.emit("close");
  return value;
}

test("line queue delivers input while preserving order and CRLF-normalized lines", async () => {
  const lineInterface = fakeInterface();
  const queue = createLineQueue(new EventEmitter(), { lineInterface });
  lineInterface.emit("line", "first");
  lineInterface.emit("line", "/cancel");
  assert.deepEqual(await queue.next(), { value: "first", done: false });
  assert.deepEqual(await queue.next(), { value: "/cancel", done: false });
  lineInterface.emit("close");
  assert.deepEqual(await queue.next(), { value: undefined, done: true });
});

test("line queue fails closed on line and queue bounds", async () => {
  const oversizedInterface = fakeInterface();
  const oversized = createLineQueue(new EventEmitter(), { lineInterface: oversizedInterface, maximumLineBytes: 4 });
  oversizedInterface.emit("line", "12345");
  await assert.rejects(oversized.next(), (error) => error.code === "message_too_large");
  const fullInterface = fakeInterface();
  const full = createLineQueue(new EventEmitter(), { lineInterface: fullInterface, maximumLines: 1 });
  fullInterface.emit("line", "one");
  fullInterface.emit("line", "two");
  await assert.rejects(full.next(), (error) => error.code === "quota_exceeded");
});

test("line queue cancellation rejects pending reads and removes state", async () => {
  const controller = new AbortController();
  const lineInterface = fakeInterface();
  const queue = createLineQueue(new EventEmitter(), { lineInterface, signal: controller.signal });
  const pending = queue.next();
  controller.abort();
  await assert.rejects(pending, (error) => error.code === "cancelled");
  assert.equal(queue.pending(), 0);
  assert.equal(lineInterface.listenerCount("line"), 0);
  assert.equal(lineInterface.listenerCount("close"), 0);
  assert.equal(lineInterface.listenerCount("error"), 0);
});

test("interactive argument and session metadata mapping are strict and content-free", () => {
  assert.deepEqual(parseInteractiveArgs([]), { mode: "answer", sessionId: null });
  assert.deepEqual(parseInteractiveArgs(["--mode", "review", "--resume", resumedId]), { mode: "review", sessionId: resumedId });
  for (const args of [["--mode", "operate"], ["--resume", "bad"], ["--offline"], ["--mode", "answer", "--mode", "plan"]]) assert.throws(() => parseInteractiveArgs(args), (error) => error.code === "invalid_argument");
  const mapped = sessionMetadata(session(), { lastTurnId: null, lastSequence: 4 });
  assert.equal(mapped.organizationScopeId, organizationId);
  assert.equal(JSON.stringify(mapped).includes("subject"), false);
  assert.equal(Object.hasOwn(mapped, "content"), false);
  const resumed = sessionMetadata(session(), { preserveProgress: true });
  assert.equal(Object.hasOwn(resumed, "lastSequence"), false);
  assert.equal(Object.hasOwn(resumed, "semanticDigest"), false);
});

test("interactive host creates one session, executes multiple queued turns, and restores the terminal", async () => {
  const client = fakeClient(); const queue = new ManualQueue(); const dependencies = deps(client, queue);
  const running = executeInteractive([], dependencies);
  queue.push("first question");
  queue.push("second question");
  await waitFor(() => client.calls.filter(([name]) => name === "createTurn").length === 2);
  await waitFor(() => dependencies.stderr.text.includes("Agent FAI [answer|observe]> "));
  queue.push("/exit");
  const result = await running;
  assert.equal(result.exitCode, 0);
  assert.match(dependencies.stdout.text, /Interactive answer/u);
  assert.equal(client.calls.filter(([name]) => name === "createSession").length, 1);
  assert.equal(client.calls.filter(([name]) => name === "createTurn").length, 2);
  for (const call of client.calls.filter(([name]) => name === "createTurn")) { assert.equal(call[2].requestedAuthority, "observe"); assert.equal(call[2].contextManifestRef, null); }
  assert.equal(dependencies.sessionMetadataStore.writes.length >= 3, true);
  assert.equal(dependencies.stdin.isRaw, false);
});

test("slash commands change workflow intent without authority and expose bounded local state", async () => {
  const client = fakeClient(); const queue = new ManualQueue(); const dependencies = deps(client, queue);
  const running = executeInteractive([], dependencies);
  for (const line of ["/mode plan", "/authority", "/context", "/tools", "/mcp", "/compact", "planned question"]) queue.push(line);
  await waitFor(() => client.calls.some(([name]) => name === "createTurn"));
  await waitFor(() => dependencies.stderr.text.includes("Local display metadata compacted"));
  queue.push("/exit");
  await running;
  const turn = client.calls.find(([name]) => name === "createTurn");
  assert.equal(turn[2].intent, "plan");
  assert.equal(turn[2].requestedAuthority, "observe");
  assert.match(dependencies.stderr.text, /Repository context is unavailable/u);
  assert.match(dependencies.stderr.text, /Local tool invocation is unavailable/u);
  assert.match(dependencies.stderr.text, /MCP discovery and invocation are unavailable/u);
});

test("interactive resume and export bind exact session identity", async () => {
  const client = fakeClient(); const queue = new ManualQueue(); const dependencies = deps(client, queue);
  const running = executeInteractive(["--resume", resumedId], dependencies);
  await waitFor(() => client.calls.some(([name]) => name === "resumeSession"));
  queue.push("/export json");
  await waitFor(() => client.calls.some(([name]) => name === "exportSession"));
  queue.push("/exit");
  assert.equal((await running).exitCode, 0);
  assert.equal(client.calls.find(([name]) => name === "resumeSession")[1], resumedId);
  assert.deepEqual(client.calls.find(([name]) => name === "exportSession").slice(1, 3), [resumedId, { format: "json" }]);
  assert.match(dependencies.stderr.text, /Export artifact 77777777/u);
  assert.doesNotMatch(dependencies.stderr.text, /https?:\/\//u);
});

test("session commands validate grammar and emit content-free canonical projections", async () => {
  assert.deepEqual(parseSessionCommand("sessions list", ["--limit", "10", "--cursor", "next"]), { limit: 10, cursor: "next" });
  for (const [name, args] of [["sessions list", ["--limit", "101"]], ["sessions show", ["bad"]], ["sessions export", [sessionId, "--format", "html"]]]) assert.throws(() => parseSessionCommand(name, args), (error) => error.code === "invalid_argument");
  const client = fakeClient();
  const listed = await executeSessionCommand("sessions list", [], deps(client, new ManualQueue()));
  const listDocument = JSON.parse(listed.output);
  assert.equal(listDocument.items.length, 1);
  assert.equal(JSON.stringify(listDocument).includes("subject"), false);
  const shown = await executeSessionCommand("sessions show", [sessionId], deps(client, new ManualQueue()));
  assert.equal(JSON.parse(shown.output).sessionId, sessionId);
  assert.equal(shown.output.includes("subject"), false);
  const exported = await executeSessionCommand("sessions export", [sessionId, "--format", "json"], deps(client, new ManualQueue()));
  assert.equal(JSON.parse(exported.output).kind, "export");
  assert.equal(JSON.parse(exported.output).downloadAvailable, false);
  assert.doesNotMatch(exported.output, /downloadUrl|https?:\/\//u);
  assert.deepEqual(client.calls.find(([name]) => name === "exportSession").slice(1, 3), [sessionId, { format: "json" }]);
});

test("T019 source authority pins T018 dependencies and rejects authority expansion", () => {
  const { manifest, validateAuthorityManifest } = require("../commands/agent/source-authority-t019.js");
  assert.equal(validateAuthorityManifest(manifest), manifest);
  assert.equal(manifest.sources.length, 10);
  assert.deepEqual(manifest.constraints.workflowModes, ["answer", "architecture", "plan", "review"]);
  assert.equal(manifest.constraints.requestedAuthority, "observe-only");
  for (const mutate of [(value) => { value.unknown = true; }, (value) => { value.authorities[0].commit = "0".repeat(40); }, (value) => { value.sources[0].path = "cli/README.md"; }, (value) => { value.constraints.requestedAuthority = "local-write"; }, (value) => { value.constraints.toolsImplemented = true; }, (value) => { value.constraints.azureResourcesCreated = true; }]) { const candidate = structuredClone(manifest); mutate(candidate); assert.throws(() => validateAuthorityManifest(candidate, false)); }
});

test("interactive mode fails closed without terminal input and diagnostics", async () => {
  const client = fakeClient(); const queue = new ManualQueue(); const dependencies = deps(client, queue);
  dependencies.stdin.isTTY = false;
  const result = await executeInteractive([], dependencies);
  assert.equal(result.exitCode, 2);
  assert.match(result.error, /requires terminal stdin and stderr/u);
  assert.equal(client.calls.length, 0);
});

test("queued turns retain the workflow mode active when each line was entered", async () => {
  const client = fakeClient(); const queue = new ManualQueue(); const dependencies = deps(client, queue);
  const running = executeInteractive([], dependencies);
  queue.push("answer question");
  queue.push("/mode review");
  queue.push("review question");
  await waitFor(() => client.calls.filter(([name]) => name === "createTurn").length === 2);
  await waitFor(() => dependencies.stderr.text.includes("Agent FAI [review|observe]> "));
  queue.push("/exit"); await running;
  const turns = client.calls.filter(([name]) => name === "createTurn");
  assert.deepEqual(turns.map((entry) => entry[2].intent), ["answer", "review"]);
  assert.equal(turns.every((entry) => entry[2].requestedAuthority === "observe"), true);
});

test("first signal cancels an active turn and preserves the session", async () => {
  const client = fakeClient(); const queue = new ManualQueue(); const dependencies = deps(client, queue);
  client.streamTurnEvents = async function* (id, turnId, options) {
    this.calls.push(["streamTurnEvents", id, turnId, options]);
    await new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new (require("../lib/agent/client-error.js").AgentFaiClientError)("cancelled")), { once: true });
    });
  };
  const running = executeInteractive([], dependencies);
  queue.push("long question");
  await waitFor(() => client.calls.some(([name]) => name === "streamTurnEvents"));
  dependencies.signalEmitter.emit("SIGINT");
  await waitFor(() => client.calls.some(([name]) => name === "cancelTurn"));
  await waitFor(() => dependencies.stderr.text.includes("Agent FAI [answer|observe]> "));
  queue.push("/exit");
  assert.equal((await running).exitCode, 0);
  assert.match(dependencies.stderr.text, /Turn error \[cancelled\]/u);
});

test("second signal inside the bounded window restores terminal state then forces exit 130", async () => {
  const client = fakeClient(); const queue = new ManualQueue(); let forced = null; const dependencies = deps(client, queue, { forceExit: (code) => { forced = code; } });
  const running = executeInteractive([], dependencies);
  await waitFor(() => dependencies.stderr.text.includes("Agent FAI [answer|observe]> "));
  dependencies.signalEmitter.emit("SIGINT");
  dependencies.signalEmitter.emit("SIGINT");
  assert.equal((await running).exitCode, 130);
  await waitFor(() => forced === 130);
  assert.equal(dependencies.stdin.isRaw, false);
});

test("signal during session establishment aborts a client that ignores its signal", async () => {
  const client = fakeClient(); const queue = new ManualQueue(); const dependencies = deps(client, queue);
  client.createSession = () => new Promise(() => {});
  const running = executeInteractive([], dependencies);
  await new Promise((resolve) => setImmediate(resolve));
  dependencies.signalEmitter.emit("SIGINT");
  assert.equal((await running).exitCode, 130);
});

test("output failure is contained without an unhandled detached turn rejection", async () => {
  const client = fakeClient(); const queue = new ManualQueue(); const dependencies = deps(client, queue);
  dependencies.stdout = channel();
  dependencies.stdout.write = () => { throw new Error("closed output"); };
  const unhandled = [];
  const onUnhandled = (error) => unhandled.push(error);
  process.on("unhandledRejection", onUnhandled);
  try {
    const running = executeInteractive([], dependencies);
    queue.push("question");
    assert.equal((await running).exitCode, 70);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(unhandled, []);
  } finally { process.removeListener("unhandledRejection", onUnhandled); }
});

test("second repeated SIGTERM force-exits despite permanently backpressured output", async () => {
  const client = fakeClient(); const queue = new ManualQueue(); let forced = null;
  const dependencies = deps(client, queue, {
    stderr: blockedChannel(),
    forceExit: (code) => { forced = code; },
    setTimeout: (callback, milliseconds) => { if (milliseconds <= 25) queueMicrotask(callback); return { unref() {} }; },
    clearTimeout() {},
  });
  const running = executeInteractive([], dependencies);
  await waitFor(() => client.calls.some(([name]) => name === "createSession"));
  dependencies.signalEmitter.emit("SIGTERM");
  dependencies.signalEmitter.emit("SIGTERM");
  await waitFor(() => forced === 130);
  assert.equal((await running).exitCode, 130);
});

test("first idle signal exits 130 despite permanently backpressured startup output", async () => {
  const client = fakeClient(); const queue = new ManualQueue();
  const dependencies = deps(client, queue, { stderr: blockedChannel() });
  const running = executeInteractive([], dependencies);
  await waitFor(() => client.calls.some(([name]) => name === "createSession"));
  dependencies.signalEmitter.emit("SIGINT");
  assert.equal((await running).exitCode, 130);
});

test("source projection rejects credential-bearing URLs before retention", () => {
  const projection = { status: "idle", turnId: null, requestId: null, lastSequence: 0, sources: [], tools: [], artifacts: [], usage: [], diagnostics: [] };
  observeEvent(projection, event({ sessionId, turnId: "55555555-5555-4555-8555-555555555555", requestId: "33333333-3333-4333-8333-333333333333" }, 1, "retrieval.source", { sourceId: "secret-source", category: "docs", href: "https://user:secret@example.test/path", rank: 1 }));
  assert.deepEqual(projection.sources, []);
});

test("slash commands enforce command-specific arity", async () => {
  const client = fakeClient(); const queue = new ManualQueue(); const dependencies = deps(client, queue);
  const running = executeInteractive([], dependencies);
  await waitFor(() => dependencies.stderr.text.includes("Agent FAI [answer|observe]> "));
  queue.push("/exit typo");
  queue.push("/cancel typo");
  await waitFor(() => (dependencies.stderr.text.match(/Invalid slash command\./gu) || []).length === 2);
  queue.push("/exit");
  assert.equal((await running).exitCode, 0);
});