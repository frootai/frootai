// @ts-check
"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { Readable } = require("node:stream");
const test = require("node:test");
const { AgentFaiClientError } = require("../lib/agent/client-error.js");
const { executeHeadless, parseHeadlessArgs } = require("../lib/agent/headless-host.js");

const requestId = "33333333-3333-4333-8333-333333333333";
const sessionId = "44444444-4444-4444-8444-444444444444";
const turnId = "55555555-5555-4555-8555-555555555555";
const config = { agent: { defaultFormat: "text", color: "never", unicode: "always", requestTimeoutMs: 30000, reconnects: 1, retentionDays: 30 } };

function event(sequence, type, data) {
  return { schemaVersion: "agent-fai-event.v1", eventId: `${String(sequence).padStart(8, "0")}-1111-4111-8111-111111111111`, requestId, sessionId, turnId, sequence, occurredAt: `2026-08-13T00:00:0${Math.min(sequence, 9)}Z`, type, data: { eventType: type, ...data } };
}

function successEvents() {
  return [
    event(1, "session.started", { surface: "cli" }),
    event(2, "turn.accepted", { intent: "answer", authority: "observe", principalDigest: "a".repeat(64), manifestDigest: "b".repeat(64), policyVersion: "policy-v1" }),
    event(3, "model.started", { modelAlias: "agent-fai", stream: true }),
    event(4, "model.delta", { content: "Grounded answer" }),
    event(5, "model.completed", { finishReason: "stop" }),
    event(6, "turn.completed", { outcome: "completed", artifactRefs: [] }),
  ];
}

function terminalEvents(type, data) {
  return [
    event(1, "session.started", { surface: "cli" }),
    event(2, "turn.accepted", { intent: "answer", authority: "observe", principalDigest: "a".repeat(64), manifestDigest: "b".repeat(64), policyVersion: "policy-v1" }),
    event(3, type, data),
  ];
}

function fakeClient(events = successEvents()) {
  const calls = [];
  return {
    calls,
    async createSession(...args) { calls.push(["createSession", ...args]); return { sessionId }; },
    async createTurn(...args) { calls.push(["createTurn", ...args]); return { sessionId, turnId, requestId }; },
    async *streamTurnEvents(...args) { calls.push(["streamTurnEvents", ...args]); for (const item of events) yield item; },
    async cancelTurn(...args) { calls.push(["cancelTurn", ...args]); return {}; },
  };
}

function dependencies(client, overrides = {}) {
  let key = 0;
  return { protocolClient: client, config, env: {}, signalEmitter: new EventEmitter(), idempotencyKeyFactory: () => `headless-key-${++key}`, ...overrides };
}

test("ask creates one observe-only session and turn then renders the terminal stream", async () => {
  const client = fakeClient();
  const result = await executeHeadless("ask", ["Explain", "this repository"], dependencies(client));
  assert.deepEqual(result, { exitCode: 0, output: "Grounded answer\n", error: "" });
  assert.equal(client.calls.length, 3);
  assert.deepEqual(client.calls[0][1], { client: { surface: "cli", version: "6.2.0", capabilities: ["events.v1", "citations", "mermaid", "ascii", "artifacts", "usage", "cancellation", "replay"] }, retentionProfileId: "cli-default" });
  assert.deepEqual(client.calls[1][1], sessionId);
  assert.deepEqual(client.calls[1][2], { intent: "answer", requestedAuthority: "observe", client: client.calls[0][1].client, input: { kind: "user-text", content: "Explain this repository" }, contextManifestRef: null, budgets: { deadlineMs: 30000, maxOutputTokens: 4096, maxEstimatedCostUsd: null } });
  assert.deepEqual(client.calls[2][1], sessionId);
  assert.deepEqual(client.calls[2][2], turnId);
  assert.deepEqual(client.calls[2][3].identity, { requestId });
});

test("run reads bounded redirected UTF-8 stdin without prompting", async () => {
  const client = fakeClient();
  const stdin = Readable.from([Buffer.from("Review\r\nthis", "utf8")]);
  Object.defineProperty(stdin, "isTTY", { value: false });
  const result = await executeHeadless("run", ["--stdin", "--format", "json"], dependencies(client, { stdin }));
  assert.equal(result.exitCode, 0);
  assert.equal(JSON.parse(result.output).content, "Grounded answer");
  assert.equal(client.calls[1][2].input.content, "Review\r\nthis");
});

test("run --prompt preserves option-looking prompt values verbatim", async () => {
  for (const prompt of ["--confirm-external", "--confirm-force"]) {
    const client = fakeClient();
    const result = await executeHeadless("run", ["--prompt", prompt], dependencies(client));
    assert.equal(result.exitCode, 0);
    assert.equal(client.calls[1][2].input.content, prompt);
  }
});

test("headless grammar rejects ambiguous, interactive, oversized, and unknown input before network", async () => {
  const cases = [
    ["ask", [], "missing_input"],
    ["ask", [""], "invalid_prompt"],
    ["ask", ["hello", "--offline"], "unknown_option"],
    ["run", [], "missing_input"],
    ["run", ["--prompt", "hello", "--stdin"], "conflicting_input"],
    ["run", ["--prompt", "hello", "--quiet", "--verbose"], "conflicting_output"],
    ["run", ["--prompt", "hello", "--unicode", "--no-unicode"], "conflicting_unicode"],
    ["run", ["--prompt", "hello", "--deadline", "99"], "invalid_deadline"],
    ["run", ["--prompt", "hello", "--deadline", "300001"], "invalid_deadline"],
    ["run", ["--prompt", "hello", "--format", "yaml"], "invalid_format"],
  ];
  for (const [command, args, code] of cases) assert.throws(() => parseHeadlessArgs(command, args), (error) => error.code === code);
  const client = fakeClient();
  const stdin = new Readable({ read() {} });
  Object.defineProperty(stdin, "isTTY", { value: true });
  const result = await executeHeadless("run", ["--stdin"], dependencies(client, { stdin }));
  assert.equal(result.exitCode, 2);
  assert.match(result.error, /never reads interactively/u);
  assert.equal(client.calls.length, 0);
});

test("stdin byte bounds, malformed UTF-8, and ended streams fail before network", async () => {
  const cases = [
    [Readable.from([Buffer.alloc(32001, 0x61)]), /32000-byte/u],
    [Readable.from([Buffer.from([0xc3, 0x28])]), /valid Unicode/u],
  ];
  for (const [stdin, message] of cases) {
    Object.defineProperty(stdin, "isTTY", { value: false });
    const client = fakeClient();
    const result = await executeHeadless("run", ["--stdin"], dependencies(client, { stdin }));
    assert.equal(result.exitCode, 2);
    assert.match(result.error, message);
    assert.equal(client.calls.length, 0);
  }
  const ended = Readable.from([]);
  ended.resume();
  await new Promise((resolve) => ended.once("end", resolve));
  const client = fakeClient();
  const result = await executeHeadless("run", ["--stdin"], dependencies(client, { stdin: ended }));
  assert.equal(result.exitCode, 2);
  assert.equal(client.calls.length, 0);
});

test("absolute deadline and pre-aborted caller signal produce deterministic exits", async () => {
  const deadlineClient = fakeClient();
  deadlineClient.createSession = async (_body, options) => {
    await new Promise((resolve) => setImmediate(resolve));
    if (options.signal.aborted) throw new AgentFaiClientError("cancelled");
    throw new Error("deadline signal was not propagated");
  };
  const deadline = await executeHeadless("ask", ["hello", "--deadline", "100"], dependencies(deadlineClient, {
    setTimeout: (callback) => { queueMicrotask(callback); return { unref() {} }; },
    clearTimeout() {},
  }));
  assert.equal(deadline.exitCode, 75);
  const controller = new AbortController();
  controller.abort();
  const cancelled = await executeHeadless("ask", ["hello"], dependencies(fakeClient(), { signal: controller.signal }));
  assert.equal(cancelled.exitCode, 130);
});

test("config reads are inside the absolute deadline and respond to caller cancellation", async () => {
  const never = { read: () => new Promise(() => {}) };
  const deadline = await executeHeadless("ask", ["hello", "--deadline", "100"], dependencies(fakeClient(), {
    config: undefined,
    configCoordinator: never,
    setTimeout: (callback) => { queueMicrotask(callback); return { unref() {} }; },
    clearTimeout() {},
  }));
  assert.equal(deadline.exitCode, 75);
  const controller = new AbortController();
  const pending = executeHeadless("ask", ["hello"], dependencies(fakeClient(), { config: undefined, configCoordinator: never, signal: controller.signal }));
  controller.abort();
  assert.equal((await pending).exitCode, 130);
});

test("production client construction pins the shared endpoint and propagates a proxy factory", async () => {
  const client = fakeClient();
  const proxyDispatcherFactory = () => ({ dispatcher: true });
  let captured;
  const result = await executeHeadless("ask", ["hello"], dependencies(null, {
    protocolClient: null,
    proxyDispatcherFactory,
    clientOptions: { baseUrl: "https://attacker.example", env: { HTTPS_PROXY: "https://ignored.example" } },
    clientFactory: (options) => { captured = options; return client; },
  }));
  assert.equal(result.exitCode, 0);
  assert.equal(captured.baseUrl, "https://frootai.dev");
  assert.equal(captured.proxyDispatcherFactory, proxyDispatcherFactory);
  assert.deepEqual(captured.env, {});
});

test("turn response is bound to the fresh session identity", async () => {
  const client = fakeClient();
  client.createTurn = async () => ({ sessionId: "99999999-9999-4999-8999-999999999999", turnId, requestId });
  const result = await executeHeadless("ask", ["hello"], dependencies(client));
  assert.equal(result.exitCode, 74);
  assert.match(result.error, /integrity_failed/u);
});

test("renderer integrity failures retain exit 74", async () => {
  const invalid = successEvents();
  invalid[1] = event(2, "turn.accepted", { intent: "answer", authority: "observe" });
  const result = await executeHeadless("ask", ["hello"], dependencies(fakeClient(invalid)));
  assert.equal(result.exitCode, 74);
  assert.match(result.error, /integrity_failed/u);
});

test("formats, quiet, verbose, deadline, color, and Unicode are deterministic", async () => {
  const markdown = await executeHeadless("ask", ["hello", "--format", "markdown", "--deadline", "5000"], dependencies(fakeClient()));
  assert.deepEqual(markdown, { exitCode: 0, output: "Grounded answer\n", error: "" });
  const jsonl = await executeHeadless("ask", ["hello", "--format", "jsonl", "--quiet", "--no-color", "--no-unicode"], dependencies(fakeClient()));
  assert.equal(jsonl.exitCode, 0);
  assert.equal(jsonl.output.trim().split("\n").length, 6);
  assert.equal(jsonl.error, "");
  const verbose = await executeHeadless("ask", ["hello", "--verbose"], dependencies(fakeClient()));
  assert.match(verbose.error, new RegExp(`requestId=${requestId} sessionId=${sessionId} turnId=${turnId} exitCode=0`, "u"));
});

test("typed client failures preserve deterministic redacted exits", async () => {
  for (const [code, exitCode] of [["authentication_required", 65], ["transport_failed", 69], ["integrity_failed", 74], ["deadline_exceeded", 75]]) {
    const client = fakeClient();
    client.createSession = async () => { throw new AgentFaiClientError(code); };
    const result = await executeHeadless("ask", ["hello"], dependencies(client));
    assert.equal(result.exitCode, exitCode, code);
    assert.match(result.error, new RegExp(`\\[${code}\\]`, "u"));
    assert.equal(result.output, "");
  }
});

test("terminal failure and cancellation map without inventing an unavailable server error code", async () => {
  const failed = await executeHeadless("ask", ["hello"], dependencies(fakeClient(terminalEvents("turn.failed", { errorId: "66666666-6666-4666-8666-666666666666" }))));
  assert.equal(failed.exitCode, 70);
  const cancelled = await executeHeadless("ask", ["hello"], dependencies(fakeClient(terminalEvents("turn.cancelled", { reason: "user", initiator: "user", modelDisposition: "not-started" }))));
  assert.equal(cancelled.exitCode, 130);
  const deadline = await executeHeadless("ask", ["hello"], dependencies(fakeClient(terminalEvents("turn.cancelled", { reason: "deadline", initiator: "server", modelDisposition: "not-started" }))));
  assert.equal(deadline.exitCode, 75);
});

test("a process signal aborts streaming, requests bounded remote cancellation, and exits 130", async () => {
  const emitter = new EventEmitter();
  const client = fakeClient([]);
  client.streamTurnEvents = async function* (...args) {
    this.calls.push(["streamTurnEvents", ...args]);
    emitter.emit("SIGINT");
    await new Promise((resolve) => setImmediate(resolve));
    if (args[2].signal.aborted) throw new AgentFaiClientError("cancelled");
  };
  const result = await executeHeadless("ask", ["hello"], dependencies(client, { signalEmitter: emitter }));
  assert.equal(result.exitCode, 130);
  assert.equal(client.calls.some(([name]) => name === "cancelTurn"), true);
});

test("remote cancellation cannot hold local signal termination open", async () => {
  const emitter = new EventEmitter();
  const client = fakeClient([]);
  client.streamTurnEvents = async function* (...args) {
    this.calls.push(["streamTurnEvents", ...args]);
    emitter.emit("SIGINT");
    throw new AgentFaiClientError("cancelled");
  };
  client.cancelTurn = () => new Promise(() => {});
  const result = await executeHeadless("ask", ["hello"], dependencies(client, {
    signalEmitter: emitter,
    setTimeout: (callback, milliseconds) => {
      if (milliseconds === 1000) queueMicrotask(callback);
      return { unref() {} };
    },
    clearTimeout() {},
  }));
  assert.equal(result.exitCode, 130);
});

test("T018 source authority pins the T017 host dependencies and rejects mutation", () => {
  const { manifest, validateAuthorityManifest } = require("../commands/agent/source-authority-t018.js");
  assert.equal(validateAuthorityManifest(manifest), manifest);
  assert.equal(manifest.sources.length, 10);
  assert.deepEqual(manifest.constraints.implementedCommands, ["ask", "run"]);
  assert.equal(manifest.constraints.backendAuthority, "shared-agent-fai-control-plane-no-new-backend");
  assert.equal(manifest.constraints.interactiveCommandHostAvailable, false);
  for (const mutate of [
    (candidate) => { candidate.unknown = true; },
    (candidate) => { candidate.authorities[0].commit = "0".repeat(40); },
    (candidate) => { candidate.sources[0].gitBlobOid = "0".repeat(40); },
    (candidate) => { candidate.sources[0].path = "cli/README.md"; },
    (candidate) => { candidate.constraints.requestedAuthority = "local-write"; },
    (candidate) => { candidate.constraints.azureResourcesCreated = true; },
  ]) {
    const candidate = structuredClone(manifest);
    mutate(candidate);
    assert.throws(() => validateAuthorityManifest(candidate, false));
  }
});