// @ts-check
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const test = require("node:test");
const { spawnSync } = require("node:child_process");
const { EventEmitter } = require("node:events");
const { createRequire } = require("node:module");
const { AgentFaiRenderError, DEFAULT_LIMITS, createEventReducer } = require("../lib/agent/event-reducer.js");
const { AgentFaiChannelError, createRenderer, finalDocument, renderToChannels, sanitizeHuman } = require("../lib/agent/renderers.js");
const { TerminalSanitizer, canonicalHttps, displayWidth, graphemes, wrapLine } = require("../lib/agent/presentation.js");
const { validateRenderResult } = require("../lib/agent/render-result-validator.js");
const { createEventStreamTracker, validateEventStream } = require("../lib/agent/semantic-runtime.generated.js");

const contractsRoot = path.resolve(__dirname, "..", "..", "..", "frootai-agent-fai-cli-contracts");
const goldenRoot = path.join(contractsRoot, "tests", "fixtures", "agent-fai-golden-transcripts");
const contractFixtureRoot = path.join(contractsRoot, "tests", "fixtures", "agent-fai-contracts");
const manifest = JSON.parse(fs.readFileSync(path.join(goldenRoot, "manifest.v1.json"), "utf8"));
const events = readJson(path.join(goldenRoot, "grounded-success", "cli.json"));
const expectedState = readJson(path.join(goldenRoot, "grounded-success", "expected-state.json"));

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function reduce(input = events, options) { const reducer = createEventReducer(options); for (const event of input) reducer.push(event); return reducer.finalize(); }
function clone(value) { return structuredClone(value); }
function rendered(format, result, options) { return createRenderer(format, options).renderResult(result).stdout; }
function diagnosticTranscript(count) {
  const transcript = [clone(events[0]), clone(events[1])];
  for (let index = 0; index < count; index += 1) {
    const warning = clone(events[13]);
    warning.eventId = `12000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`;
    warning.type = "warning"; warning.sequence = index + 3; warning.occurredAt = "2026-08-12T01:02:02Z";
    warning.data = { eventType: "warning", code: "bounded-warning", messageCode: "bounded-warning" };
    transcript.push(warning);
  }
  const terminal = clone(events.at(-1)); terminal.sequence = count + 3; terminal.data.artifactRefs = [];
  transcript.push(terminal); return transcript;
}
function assertIntegrity(callback, issue) {
  assert.throws(callback, (error) => error instanceof AgentFaiRenderError && error.exitCode === 74 && (!issue || error.issues.includes(issue)) && !JSON.stringify(error).includes("Grounded answer"));
}

test("incremental reducer preserves T008 semantic state separately from presentation content", () => {
  const reducer = createEventReducer();
  for (const event of events) reducer.push(event);
  const result = reducer.finalize();
  assert.deepEqual(result.state, expectedState);
  assert.equal(result.presentation.content, "Grounded answer.");
  assert.equal(JSON.stringify(result.state).includes("Grounded answer."), false);
});

test("structured renderers are deterministic, ANSI-free, and format-pure", () => {
  const reducer = createEventReducer();
  for (const event of events) reducer.push(event);
  const result = reducer.finalize();
  const json = rendered("json", result);
  const jsonl = createRenderer("jsonl").renderEvents(events).stdout;
  const markdown = rendered("markdown", result);
  const text = rendered("text", result);
  assert.equal(JSON.parse(json).schemaVersion, "agent-fai-render-result.v1");
  assert.equal(jsonl.trim().split("\n").length, events.length);
  assert.equal(text, "Grounded answer.\n");
  assert.match(markdown, /Grounded answer\./u);
  for (const output of [json, jsonl, markdown, text]) assert.doesNotMatch(output, /\u001b\[/u);
});

test("all 27 superseding T008 transcripts have exact state, digest, and delivery parity", () => {
  assert.equal(manifest.transcripts.length, 27);
  for (const entry of manifest.transcripts) {
    const transcript = readJson(path.join(goldenRoot, entry.path));
    const result = reduce(transcript);
    assert.deepEqual(result.state, readJson(path.join(goldenRoot, entry.scenario, "expected-state.json")), entry.path);
    assert.equal(result.semanticDigest, entry.semanticDigest, entry.path);
    assert.deepEqual(result.delivery, { deliveredCount: entry.eventCount, acceptedCount: entry.eventCount, duplicateCount: 0, firstSequence: 1, lastSequence: entry.eventCount });
  }
});

for (const scenario of manifest.scenarios) test(`${scenario.id} renders identically across all nine surfaces`, () => {
  const entries = manifest.transcripts.filter((entry) => entry.scenario === scenario.id);
  const outputs = entries.map((entry) => {
    const result = reduce(readJson(path.join(goldenRoot, entry.path)));
    return [rendered("text", result), rendered("markdown", result), rendered("json", result)];
  });
  for (const output of outputs.slice(1)) assert.deepEqual(output, outputs[0]);
});

test("snapshot accepts an incremental active prefix without inventing terminal state", () => {
  const reducer = createEventReducer();
  for (const event of events.slice(0, 10)) reducer.push(event);
  const snapshot = reducer.snapshot();
  assert.equal(snapshot.state.model.status, "started");
  assert.equal(snapshot.state.terminal, null);
  assert.equal(snapshot.delivery.acceptedCount, 10);
});

test("reset clears accepted events and permits deterministic replay", () => {
  const reducer = createEventReducer();
  reducer.push(events[0]); reducer.reset();
  assert.equal(reducer.snapshot().delivery.acceptedCount, 0);
  for (const event of events) reducer.push(event);
  assert.deepEqual(reducer.finalize().state, expectedState);
});

test("finalize rejects an empty stream", () => assertIntegrity(() => createEventReducer().finalize(), "stream-empty"));
test("finalize rejects a prefix without a terminal event", () => {
  const reducer = createEventReducer(); for (const event of events.slice(0, -1)) reducer.push(event);
  assertIntegrity(() => reducer.finalize(), "stream-missing-terminal-event");
});
test("a second terminal event is rejected as post-terminal", () => {
  const reducer = createEventReducer(); for (const event of events) reducer.push(event);
  const extra = clone(events.at(-1)); extra.eventId = "12000000-0000-4000-8000-000000000099"; extra.sequence += 1; extra.occurredAt = "2026-08-12T01:02:16Z";
  assertIntegrity(() => reducer.push(extra), "stream-post-terminal-event");
});
test("a productive post-terminal event is rejected", () => {
  const reducer = createEventReducer(); for (const event of events) reducer.push(event);
  const extra = clone(events[10]); extra.eventId = "12000000-0000-4000-8000-000000000098"; extra.sequence = 17; extra.occurredAt = "2026-08-12T01:02:16Z";
  assertIntegrity(() => reducer.push(extra), "stream-post-terminal-event");
});
test("sequence gaps are rejected", () => { const changed = clone(events); changed[4].sequence += 1; assertIntegrity(() => reduce(changed), "stream-sequence-gap"); });
test("out-of-order sequences are rejected", () => { const changed = clone(events); changed[4].sequence = 3; assertIntegrity(() => reduce(changed), "stream-sequence-collision"); });
test("timestamp regression is rejected", () => { const changed = clone(events); changed[4].occurredAt = "2026-08-12T01:01:00Z"; assertIntegrity(() => reduce(changed), "stream-time-regression"); });
test("execution identity drift is rejected", () => { const changed = clone(events); changed[4].requestId = "99999999-9999-4999-8999-999999999999"; assertIntegrity(() => reduce(changed), "stream-identity-mismatch"); });

test("byte-identical duplicate replay is accepted once", () => {
  const replayed = [...events.slice(0, 4), clone(events[3]), ...events.slice(4)];
  const result = reduce(replayed);
  assert.deepEqual(result.state, expectedState);
  assert.deepEqual(result.delivery, { deliveredCount: 17, acceptedCount: 16, duplicateCount: 1, firstSequence: 1, lastSequence: 16 });
  assert.equal(createRenderer("jsonl").renderEvents(replayed).stdout.trim().split("\n").length, 16);
});
test("same eventId with changed bytes is rejected", () => { const changed = clone(events[0]); changed.data.surface = "web"; const reducer = createEventReducer(); reducer.push(events[0]); assertIntegrity(() => reducer.push(changed), "stream-event-id-collision"); });
test("same sequence under a different eventId is rejected", () => { const changed = clone(events[0]); changed.eventId = "12000000-0000-4000-8000-000000000097"; const reducer = createEventReducer(); reducer.push(events[0]); assertIntegrity(() => reducer.push(changed), "stream-sequence-collision"); });
test("schema unknown fields are rejected", () => { const changed = clone(events[0]); changed.unknown = true; assertIntegrity(() => createEventReducer().push(changed), "event-schema-invalid"); });
test("prototype-bearing events are rejected", () => { const changed = clone(events[0]); Object.setPrototypeOf(changed, { polluted: true }); assertIntegrity(() => createEventReducer().push(changed), "event-invalid-shape"); });
test("accessor-bearing data is rejected without invoking the getter", () => { const changed = clone(events[0]); Object.defineProperty(changed.data, "surface", { get() { throw new Error("unsafe"); }, enumerable: true }); assertIntegrity(() => createEventReducer().push(changed), "event-invalid-shape"); });
test("work before turn acceptance is rejected", () => { const changed = clone(events); changed.splice(1, 1); changed.forEach((event, index) => { event.sequence = index + 1; }); assertIntegrity(() => reduce(changed), "stream-work-before-turn-accepted"); });
test("content is bounded by UTF-8 bytes", () => { const reducer = createEventReducer({ contentCapBytes: 4 }); for (const event of events.slice(0, 10)) reducer.push(event); assertIntegrity(() => reducer.push(events[10]), "presentation-content-cap-exceeded"); });

const invalidIndex = readJson(path.join(contractFixtureRoot, "fixture-index.v1.json"));
for (const fixture of invalidIndex.fixtures.filter((entry) => entry.kind === "event-stream" && !entry.valid)) test(`T006 invalid stream remains rejected: ${fixture.id}`, () => {
  assertIntegrity(() => reduce(readJson(path.join(contractFixtureRoot, fixture.path))));
});
for (const fixture of invalidIndex.fixtures.filter((entry) => entry.kind === "event-stream")) test(`generated T006 semantics match fixture verdict: ${fixture.id}`, () => {
  const transcript = readJson(path.join(contractFixtureRoot, fixture.path));
  const generatedValid = validateEventStream(transcript).length === 0;
  let reducerValid = true; try { reduce(transcript); } catch { reducerValid = false; }
  assert.equal(generatedValid, fixture.valid); assert.equal(reducerValid, fixture.valid);
});
test("incremental tracker errors match pinned T006 errors for mutation prefixes", () => {
  const mutations = [
    (input) => { input[4].requestId = "99999999-9999-4999-8999-999999999999"; return input.slice(0, 5); },
    (input) => { input[4].occurredAt = "2026-08-12T01:01:00Z"; return input.slice(0, 5); },
    (input) => { input[4].sequence += 1; return input.slice(0, 5); },
  ];
  for (const mutate of mutations) {
    const prefix = mutate(clone(events)); const tracker = createEventStreamTracker(); let incremental = [];
    for (const event of prefix) { incremental = tracker.validateNext(event); if (incremental.length) break; }
    const exact = validateEventStream(prefix).filter((issue) => issue !== "stream-missing-terminal-event");
    assert.deepEqual([...incremental].sort(), [...exact].sort());
  }
});

test("text success output is exact and newline terminated", () => assert.equal(rendered("text", reduce()), "Grounded answer.\n"));
test("text cancellation preserves bounded partial model content", () => {
  const transcript = readJson(path.join(goldenRoot, "model-cancelled", "cli.json"));
  const content = transcript.filter((event) => event.type === "model.delta").map((event) => event.data.content).join("");
  assert.equal(rendered("text", reduce(transcript)), `${content}\n`);
});
test("text failure has deterministic fallback without raw error identifiers", () => {
  const output = rendered("text", reduce(readJson(path.join(goldenRoot, "tool-failed", "cli.json"))));
  assert.equal(output, "Agent FAI request failed.\n"); assert.doesNotMatch(output, /[0-9a-f]{8}-/iu);
});
test("Markdown golden includes deterministic reference sections", () => {
  const output = rendered("markdown", reduce());
  assert.match(output, /^Grounded answer\.\n\n## Sources\n/u); assert.match(output, /## Artifacts/u); assert.match(output, /## Evidence/u); assert.match(output, /## Usage/u); assert.equal(output.endsWith("\n"), true);
});
test("JSON golden is one closed schema-versioned line", () => {
  const output = rendered("json", reduce()); const document = JSON.parse(output);
  assert.equal(output.trim().split("\n").length, 1); assert.equal(validateRenderResult(document).valid, true); assert.equal(document.schemaVersion, "agent-fai-render-result.v1");
});
test("JSON result validator rejects additional properties", () => { const document = finalDocument(reduce()); document.extra = true; assert.equal(validateRenderResult(document).valid, false); });
test("JSON result validator counts Unicode code points rather than UTF-16 code units", () => { const document = finalDocument(reduce()); document.content = "😀".repeat(1048577); assert.equal(validateRenderResult(document).valid, true); });
test("JSON result validator enforces every collection maximum", () => { for (const name of ["sources", "artifacts", "evidence", "usage", "diagnostics"]) { const document = finalDocument(reduce()); document[name] = Array(1001).fill(document[name][0]); assert.equal(validateRenderResult(document).errors.includes(name), true, name); } });
test("JSON result validator rejects zero delivery minima", () => { const document = finalDocument(reduce()); document.delivery.acceptedCount = 0; assert.equal(validateRenderResult(document).errors.includes("delivery"), true); });
test("JSON result validator rejects inconsistent delivery arithmetic", () => { const document = finalDocument(reduce()); document.delivery.deliveredCount += 1; assert.equal(validateRenderResult(document).errors.includes("delivery"), true); });
test("JSON result validator rejects non-complete sequence ranges", () => { const document = finalDocument(reduce()); document.delivery.firstSequence = 2; document.delivery.lastSequence += 1; assert.equal(validateRenderResult(document).errors.includes("delivery"), true); });
test("standalone result validator matches AJV for schema constraints", () => {
  const contractRequire = createRequire(path.join(contractsRoot, "package.json"));
  const Ajv2020 = contractRequire("ajv/dist/2020"); const addFormats = contractRequire("ajv-formats");
  const ajv = new Ajv2020({ allErrors: true, strict: true }); addFormats(ajv);
  const validateWithAjv = ajv.compile(readJson(path.resolve(__dirname, "..", "commands", "agent", "render-result.v1.schema.json")));
  const mutations = [
    (value) => { value.extra = true; },
    (value) => { value.content = "x".repeat(2097153); },
    (value) => { value.sources = Array(1001).fill(value.sources[0]); },
    (value) => { value.sources[0].rank = 0; },
    (value) => { value.sources[0].href = "http://unsafe.test"; },
    (value) => { value.artifacts[0].artifactId = "bad"; },
    (value) => { value.evidence[0].digest = "0"; },
    (value) => { value.usage[0] = "bad"; },
    (value) => { value.diagnostics = [{ type: "bad", code: "x", messageCode: "x" }]; },
    (value) => { value.delivery.acceptedCount = 0; },
  ];
  const valid = finalDocument(reduce()); assert.equal(validateWithAjv(valid), true); assert.equal(validateRenderResult(valid).valid, true);
  for (const mutate of mutations) { const candidate = clone(valid); mutate(candidate); assert.equal(validateWithAjv(candidate), false); assert.equal(validateRenderResult(candidate).valid, false); }
  const limit = 2097152;
  const unicodeCases = [
    ["astral exact maximum", () => "😀".repeat(limit), true],
    ["astral over maximum", () => "😀".repeat(limit + 1), false],
    ["mixed BMP and astral exact maximum", () => "A😀".repeat(limit / 2), true],
    ["mixed BMP and astral over maximum", () => `${"A😀".repeat(limit / 2)}A`, false],
    ["lone surrogate", () => "safe\ud800", true],
  ];
  const candidate = finalDocument(reduce());
  for (const [name, content, expected] of unicodeCases) {
    candidate.content = content();
    assert.equal(validateWithAjv(candidate), expected, `${name}: AJV`);
    assert.equal(validateRenderResult(candidate).valid, expected, `${name}: standalone`);
  }
});
test("JSONL emits accepted protocol events in canonical sequence order", () => {
  const output = createRenderer("jsonl").renderEvents(events).stdout; const lines = output.trim().split("\n").map(JSON.parse);
  assert.deepEqual(lines.map((event) => event.sequence), events.map((event) => event.sequence)); assert.equal(output.endsWith("\n"), true);
});
for (const [scenario, status] of [["model-cancelled", "cancelled"], ["tool-failed", "failed"]]) test(`JSON and JSONL are exact for ${scenario}`, () => {
  const transcript = readJson(path.join(goldenRoot, scenario, "cli.json")); const result = reduce(transcript);
  const document = JSON.parse(rendered("json", result)); const jsonl = createRenderer("jsonl").renderEvents(transcript).stdout.trim().split("\n").map(JSON.parse);
  assert.deepEqual(document, finalDocument(result)); assert.equal(document.status, status); assert.deepEqual(jsonl, transcript);
});
test("presentation references are unique and sorted deterministically", () => {
  const result = clone(reduce());
  result.presentation.sources = [
    { sourceId: "source.z", category: "canonical", href: "https://example.test/z", rank: 2 },
    { sourceId: "source.a", category: "canonical", href: "https://example.test/a", rank: 1 },
    { sourceId: "source.a", category: "canonical", href: "https://example.test/a", rank: 1 },
  ];
  assert.deepEqual(finalDocument(result).sources.map((source) => source.sourceId), ["source.a", "source.z"]);
});

test("TTY routes model deltas to stdout and status/reference/tool lines to stderr", () => {
  const output = createRenderer("tty", { isTTY: false, columns: 80 }).renderEvents(events);
  assert.equal(output.stdout, "Grounded answer."); assert.match(output.stderr, /retrieval\.started/u); assert.match(output.stderr, /tool\.started/u); assert.match(output.stderr, /completed/u);
});
test("TTY is append-only and emits no cursor, erase, alternate-screen, or spinner controls", () => {
  const output = createRenderer("tty", { isTTY: true, color: false }).renderEvents(events); const combined = output.stdout + output.stderr;
  assert.doesNotMatch(combined, /\u001b\[(?:[0-9;?]*[ABCDHJKfhl]|\?1049[hl])/u); assert.doesNotMatch(combined, /spinner/iu);
});
test("non-TTY output disables color even when color is requested", () => { const output = createRenderer("tty", { isTTY: false, color: true }).renderEvents(events); assert.doesNotMatch(output.stderr, /\u001b/u); });
test("NO_COLOR disables TTY color by presence", () => { const output = createRenderer("tty", { isTTY: true, color: true, env: { NO_COLOR: "" } }).renderEvents(events); assert.doesNotMatch(output.stderr, /\u001b/u); });
test("TTY color is generated only when every capability permits it", () => { const output = createRenderer("tty", { isTTY: true, color: true, env: {} }).renderEvents(events); assert.match(output.stderr, /\u001b\[/u); });
test("structured formats never color even with TTY options", () => { for (const format of ["json", "jsonl"]) { const renderer = createRenderer(format, { isTTY: true, color: true, env: {} }); const output = format === "json" ? renderer.renderResult(reduce()).stdout : renderer.renderEvents(events).stdout; assert.doesNotMatch(output, /\u001b\[/u); } });
test("TTY columns clamp to the minimum and wrap long reference lines", () => {
  const changed = clone(events); changed[3].data.sourceId = "source." + "x".repeat(100);
  const output = createRenderer("tty", { isTTY: false, columns: 1 }).renderEvents(changed);
  assert.equal(output.stderr.split("\n").filter(Boolean).every((line) => [...line].length <= 20), true);
});
test("TTY columns clamp to the maximum", () => { const changed = clone(events); changed[3].data.sourceId = "source." + "x".repeat(249); const output = createRenderer("tty", { columns: 1000 }).renderEvents(changed); assert.equal(output.stderr.split("\n").filter(Boolean).every((line) => [...line].length <= 240), true); });
test("TTY wrapping preserves surrogate pairs and combining sequences", () => { const text = "e\u0301😀".repeat(30); const changed = clone(events); changed[3].data.sourceId = text; const output = createRenderer("tty", { columns: 20 }).renderEvents(changed); assert.doesNotMatch(output.stderr, /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/u); assert.equal(output.stderr.includes("e\u0301"), true); });
test("ASCII fallback emits no Unicode status symbols", () => { const output = createRenderer("tty", { unicode: false }).renderEvents(events); assert.doesNotMatch(output.stderr, /[●↳]/u); assert.match(output.stderr, /\[status\]|\[source\]/u); });
test("warnings and limitations use TTY stderr and remain structured protocol events", () => {
  const changed = clone(events); const warning = clone(events[13]); warning.eventId = "12000000-0000-4000-8000-000000000090"; warning.type = "warning"; warning.data = { eventType: "warning", code: "bounded-warning", messageCode: "bounded-warning" }; changed.splice(14, 0, warning); changed.forEach((event, index) => { event.sequence = index + 1; });
  const result = reduce(changed); const tty = createRenderer("tty").renderEvents(changed); const json = JSON.parse(rendered("json", result)); const jsonl = createRenderer("jsonl").renderEvents(changed).stdout;
  assert.equal(tty.stdout.includes("bounded-warning"), false); assert.match(tty.stderr, /bounded-warning/u); assert.deepEqual(json.diagnostics, [{ type: "warning", code: "bounded-warning", messageCode: "bounded-warning" }]); assert.match(jsonl, /"type":"warning"/u);
});

test("human renderers remove ANSI, OSC-8, bidi, zero-width, C0, and normalize CRLF", () => {
  const injected = "safe\r\n\u001b[31mred\u001b[0m\u001b]8;;https://evil.test\u0007link\u001b]8;;\u0007\u202eevil\u200b\u0000";
  const clean = sanitizeHuman(injected);
  assert.equal(clean, "safe\nredlinkevil"); assert.doesNotMatch(clean, /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u202a-\u202e\u200b]/u);
});
test("JSONL preserves event semantics while escaping literal terminal controls", () => {
  const changed = clone(events); changed[10].data.content = "safe\u001b[31mred\u0000";
  const output = createRenderer("jsonl").renderEvents(changed).stdout;
  assert.doesNotMatch(output, /[\u0000\u001b]/u); assert.equal(JSON.parse(output.trim().split("\n")[10]).data.content, changed[10].data.content);
});
test("Markdown preserves code fences, Mermaid, and ASCII content", () => {
  const changed = clone(events); changed[10].data.content = "```mermaid\ngraph TD\nA-->B\n```\n\n+---+\n| A |\n+---+";
  const output = rendered("markdown", reduce(changed)); assert.match(output, /```mermaid\ngraph TD\nA-->B\n```/u); assert.match(output, /\+---\+/u);
});
test("successful turn without model content uses the bounded terminal fallback", () => {
  const changed = clone(events).filter((event) => !event.type.startsWith("model.")); changed.forEach((event, index) => { event.sequence = index + 1; });
  assert.equal(rendered("text", reduce(changed)), "Agent FAI completed without response content.\n");
});
test("outputs are byte deterministic and contain no clock, random, or path metadata", () => { const first = rendered("json", reduce()); const second = rendered("json", reduce()); assert.equal(first, second); assert.doesNotMatch(first, /[A-Z]:\\|\/tmp\/|generatedAt|renderedAt/iu); });

test("renderer host flow owns reduction and always returns frozen fragments", () => {
  for (const format of ["text", "markdown", "json", "jsonl", "tty"]) {
    const renderer = createRenderer(format, { isTTY: false });
    const incremental = renderer.renderEvents(events); const final = renderer.finalize();
    assert.equal(Object.isFrozen(incremental), true); assert.equal(Object.isFrozen(final), true);
    assert.equal(typeof incremental.stdout, "string"); assert.equal(typeof incremental.stderr, "string");
    assert.equal(typeof final.stdout, "string"); assert.equal(typeof final.stderr, "string");
    if (["text", "markdown", "json"].includes(format)) assert.notEqual(final.stdout, "");
    if (format === "jsonl") { assert.notEqual(incremental.stdout, ""); assert.deepEqual(final, { stdout: "", stderr: "" }); }
  }
});
test("renderEvent always returns fragments", () => { const output = createRenderer("text").renderEvent(events[0]); assert.deepEqual(output, { stdout: "", stderr: "" }); assert.equal(Object.isFrozen(output), true); });
test("finalize rejects external result arguments", () => assert.throws(() => createRenderer("text").finalize(reduce()), TypeError));
test("renderResult rejects mixing external truth with internal events", () => { const renderer = createRenderer("json"); renderer.renderEvent(events[0]); assertIntegrity(() => renderer.renderResult(reduce()), "external-result-mixed-with-internal-events"); });
test("renderResult leaves a fresh renderer internal reducer untouched", () => { const renderer = createRenderer("text"); assert.equal(renderer.renderResult(reduce()).stdout, "Grounded answer.\n"); assertIntegrity(() => renderer.finalize(), "stream-empty"); });

test("complete stream mode rejects a first sequence above one", () => { const first = clone(events[0]); first.sequence = 2; assertIntegrity(() => createEventReducer({ startMode: "complete" }).push(first), "complete-stream-required"); });
test("only complete stream mode is accepted", () => assert.throws(() => createEventReducer({ startMode: "resume" }), /startMode must be complete/u));
test("an exact duplicate after terminal is counted without output", () => { const reducer = createEventReducer(); for (const event of events) reducer.push(event); assert.deepEqual(reducer.push(clone(events[3])), { accepted: false, duplicate: true, sequence: 4 }); assert.equal(reducer.finalize().delivery.duplicateCount, 1); });
test("new post-terminal events remain rejected", () => { const reducer = createEventReducer(); for (const event of events) reducer.push(event); const warning = diagnosticTranscript(1)[2]; warning.sequence = 17; assertIntegrity(() => reducer.push(warning), "stream-post-terminal-event"); });
test("default reducer limits are explicit and bounded", () => assert.deepEqual(DEFAULT_LIMITS, { acceptedEvents: 100000, deliveredEvents: 200000, aggregateEventBytes: 16777216, eventBytes: 1048576, contentBytes: 2097152, sources: 1000, tools: 1000, artifacts: 1000, evidence: 1000, usage: 1000, diagnostics: 1000 }));
test("limits cannot be configured above hard maxima", () => assert.throws(() => createEventReducer({ maxAcceptedEvents: 100001 }), /no greater than/u));
test("accepted event cap rejects before map growth", () => { const reducer = createEventReducer({ maxAcceptedEvents: 3 }); const input = diagnosticTranscript(2); input.slice(0, 3).forEach((event) => reducer.push(event)); assertIntegrity(() => reducer.push(input[3]), "stream-accepted-events-cap-exceeded"); });
test("delivered event cap includes exact duplicate deliveries", () => { const reducer = createEventReducer({ maxDeliveredEvents: 3 }); reducer.push(events[0]); reducer.push(clone(events[0])); reducer.push(clone(events[0])); assertIntegrity(() => reducer.push(clone(events[0])), "stream-delivered-events-cap-exceeded"); });
test("aggregate canonical event bytes are capped", () => { const reducer = createEventReducer({ maxAggregateEventBytes: 800 }); reducer.push(events[0]); assertIntegrity(() => reducer.push(events[1]), "stream-aggregate-event-bytes-cap-exceeded"); });
test("diagnostic cardinality is capped before growth", () => { const reducer = createEventReducer({ maxDiagnostics: 1 }); const input = diagnosticTranscript(2); input[3].data.code = "second-warning"; input.slice(0, 3).forEach((event) => reducer.push(event)); assertIntegrity(() => reducer.push(input[3]), "presentation-diagnostics-cap-exceeded"); });
test("10k valid diagnostic events reduce within a practical bound", { timeout: 5000 }, () => { const input = diagnosticTranscript(10000); const started = performance.now(); const result = reduce(input); const elapsed = performance.now() - started; assert.equal(result.delivery.acceptedCount, 10003); assert.equal(result.state.eventTypeCounts.warning, 10000); assert.equal(result.presentation.diagnostics.length, 1); assert.ok(elapsed < 2000, `elapsed ${elapsed}ms`); });

test("Markdown source labels cannot inject links, images, HTML, or newlines", () => { const result = clone(reduce()); result.presentation.sources = [{ sourceId: "x](https://evil.test)\n<script>alert(1)</script>", category: "x\nhtml", href: "https://good.test/a_(b)?q=x", rank: 1 }]; const output = rendered("markdown", result); assert.doesNotMatch(output, /\]\(https:\/\/evil\.test\)|<script>|\n<script>|!\[/u); assert.match(output, /\(<https:\/\/good\.test\/a_\(b\)\?q=x>\)/u); });
test("canonical HTTPS rejects controls, credentials, non-ASCII spoof input, and insecure URLs", () => { for (const value of ["https://good.test/\u202eevil", "https://good.test/\nnext", "https://user:pass@good.test/", "http://good.test/"]) assert.equal(canonicalHttps(value), null); });

for (const [name, chunks] of Object.entries({ CSI: ["a\u001b[", "31", "mb"], OSC: ["a\u001b]8;;https://evil", ".test\u0007b"], DCS: ["a\u001bPpayload", "\u001b\\b"], SOS: ["a\u001bXpayload", "\u001b\\b"], PM: ["a\u001b^payload", "\u001b\\b"], APC: ["a\u001b_payload", "\u001b\\b"] })) test(`streaming sanitizer removes split ${name} sequences`, () => { const sanitizer = new TerminalSanitizer(); assert.equal(chunks.map((chunk) => sanitizer.write(chunk)).join("") + sanitizer.finalize(), "ab"); });
test("streaming sanitizer drops an incomplete escape at finalize", () => { const sanitizer = new TerminalSanitizer(); assert.equal(sanitizer.write("safe\u001b]unfinished") + sanitizer.finalize(), "safe"); });
test("streaming sanitizer bounds malformed attacks and resumes safe text", () => { const sanitizer = new TerminalSanitizer({ maximumSequenceLength: 16 }); const output = sanitizer.write("a\u001b]" + "x".repeat(20) + "safe") + sanitizer.finalize(); assert.match(output, /^ax{1,16}safe$/u); });
test("streaming sanitizer normalizes CRLF split across chunks", () => { const sanitizer = new TerminalSanitizer(); assert.equal(sanitizer.write("a\r") + sanitizer.write("\nb\r") + sanitizer.finalize(), "a\nb\n"); });
test("streaming sanitizer preserves valid emoji ZWJ graphemes across chunks", () => { const sanitizer = new TerminalSanitizer(); const output = sanitizer.write("👩🏽\u200d") + sanitizer.write("💻 👨\u200d👩\u200d") + sanitizer.write("👧\u200d👦") + sanitizer.finalize(); assert.equal(output, "👩🏽‍💻 👨‍👩‍👧‍👦"); });
test("sanitizer strips standalone and non-emoji ZWJ spoofing", () => { assert.equal(sanitizeHuman("\u200dA\u200dB😀\u200dX"), "AB😀X"); assert.equal(displayWidth("\u200d"), 0); });

test("display width treats CJK and emoji as two cells", () => { assert.equal(displayWidth("A界😀"), 5); });
test("display width treats combining and variation modifiers as zero width", () => { assert.equal(displayWidth("e\u0301✈️"), 3); });
test("display width assigns two cells to flags, keycaps, and complete emoji graphemes", () => { for (const value of ["🇺🇸", "1️⃣", "#️⃣", "👨‍👩‍👧‍👦", "👩🏽‍💻"]) assert.equal(displayWidth(value), 2, value); });
test("display width advances tabs to the next eight-cell stop", () => { assert.equal(displayWidth("ab\tX"), 9); });
test("wrapping never splits graphemes and every mixed line fits", () => { const lines = wrapLine("界😀e\u0301\tXYZ".repeat(8), 20); assert.ok(lines.length > 1); assert.equal(lines.every((line) => displayWidth(line) <= 20), true); assert.equal(lines.join("").includes("e\u0301"), true); });
test("mixed CJK and emoji wrap at exactly twenty display columns", () => { const text = `${"界".repeat(6)}🇺🇸1️⃣#️⃣👨‍👩‍👧‍👦👩🏽‍💻`; const lines = wrapLine(text, 20); assert.deepEqual(lines, [`${"界".repeat(6)}🇺🇸1️⃣#️⃣👨‍👩‍👧‍👦`, "👩🏽‍💻"]); assert.deepEqual(lines.map(displayWidth), [20, 2]); });
test("Node 18 fallback groups flags, keycaps, and emoji ZWJ sequences deterministically", () => { const segmenter = Intl.Segmenter; try { Intl.Segmenter = undefined; assert.deepEqual(graphemes("🇺🇸1️⃣#️⃣👨‍👩‍👧‍👦👩🏽‍💻"), ["🇺🇸", "1️⃣", "#️⃣", "👨‍👩‍👧‍👦", "👩🏽‍💻"]); assert.equal(displayWidth("🇺🇸1️⃣#️⃣👨‍👩‍👧‍👦👩🏽‍💻"), 10); } finally { Intl.Segmenter = segmenter; } });

test("renderToChannels writes only explicit stdout and stderr fragments", async () => {
  const writes = { stdout: [], stderr: [] }; const stream = (name) => ({ write(value) { writes[name].push(value); return true; } });
  await renderToChannels({ stdout: "answer", stderr: "status" }, { stdout: stream("stdout"), stderr: stream("stderr") });
  assert.deepEqual(writes, { stdout: ["answer"], stderr: ["status"] });
});
function blockedStream() { const stream = new EventEmitter(); stream.write = () => false; stream.destroyed = false; stream.closed = false; stream.writableEnded = false; return stream; }
test("renderToChannels waits for drain and removes every listener", async () => { const stdout = blockedStream(); const promise = renderToChannels({ stdout: "answer", stderr: "" }, { stdout }); queueMicrotask(() => stdout.emit("drain")); await promise; for (const event of ["drain", "error", "close"]) assert.equal(stdout.listenerCount(event), 0); });
test("renderToChannels rejects a channel closed before write", async () => { const stdout = blockedStream(); stdout.closed = true; await assert.rejects(renderToChannels({ stdout: "answer", stderr: "" }, { stdout }), (error) => error instanceof AgentFaiChannelError && error.code === "closed"); });
test("renderToChannels rejects close during backpressure and cleans listeners", async () => { const stdout = blockedStream(); const promise = renderToChannels({ stdout: "answer", stderr: "" }, { stdout }); queueMicrotask(() => stdout.emit("close")); await assert.rejects(promise, (error) => error instanceof AgentFaiChannelError && error.code === "closed"); for (const event of ["drain", "error", "close"]) assert.equal(stdout.listenerCount(event), 0); });
test("renderToChannels forwards stream errors and cleans listeners", async () => { const stdout = blockedStream(); const failure = new Error("write failed"); const promise = renderToChannels({ stdout: "answer", stderr: "" }, { stdout }); queueMicrotask(() => stdout.emit("error", failure)); await assert.rejects(promise, failure); for (const event of ["drain", "error", "close"]) assert.equal(stdout.listenerCount(event), 0); });
test("renderToChannels supports abort during backpressure and cleans listeners", async () => { const stdout = blockedStream(); const controller = new AbortController(); const promise = renderToChannels({ stdout: "answer", stderr: "" }, { stdout, signal: controller.signal }); controller.abort(); await assert.rejects(promise, (error) => error instanceof AgentFaiChannelError && error.code === "aborted"); assert.equal(controller.signal.onabort, null); for (const event of ["drain", "error", "close"]) assert.equal(stdout.listenerCount(event), 0); });
test("renderer registry is generated byte-for-byte from its source", () => { const generator = require("../scripts/generate-agent-renderer-registry.js"); assert.equal(fs.readFileSync(generator.OUTPUT_PATH, "utf8"), generator.generateRendererRegistry()); });
test("renderer registry rejects format and field drift", () => { const generator = require("../scripts/generate-agent-renderer-registry.js"); const source = readJson(generator.SOURCE_PATH); const extra = clone(source); extra.extra = true; assert.throws(() => generator.validateDefinition(extra)); const changed = clone(source); changed.formats[0].stderr = "diagnostics"; assert.throws(() => generator.validateDefinition(changed)); });
test("render-result validator is generated byte-for-byte from its schema", () => { const generator = require("../scripts/generate-agent-render-result-validator.js"); assert.equal(fs.readFileSync(generator.OUTPUT_PATH, "utf8"), generator.generateRenderResultValidator()); });
test("semantic runtime is generated byte-for-byte from the pinned T006 blob", () => { const generator = require("../scripts/generate-agent-semantic-runtime.js"); const output = generator.generateSemanticRuntime(); assert.equal(fs.readFileSync(generator.OUTPUT_PATH, "utf8"), output); assert.match(output, new RegExp(generator.SOURCE_BLOB, "u")); });
test("T016 source authority resolves all exact commits, trees, blobs, and vendored validators", () => { const authority = require("../commands/agent/source-authority-t016.js"); assert.equal(authority.validateAuthorityManifest(), authority.manifest); });
test("T016 source authority rejects source and cardinality mutations", () => { const authority = require("../commands/agent/source-authority-t016.js"); const changed = clone(authority.manifest); changed.sources[0].gitBlobOid = "0".repeat(40); assert.throws(() => authority.validateAuthorityManifest(changed, false)); const removed = clone(authority.manifest); removed.sources.pop(); assert.throws(() => authority.validateAuthorityManifest(removed, false)); });
test("registry preserves renderer capability with bounded online and offline profiles", () => { const registry = require("../lib/agent/command-registry.generated.js"); const available = ["help", "version", "ask", "run", "resume", "sessions list", "sessions show", "sessions resume", "sessions export"]; assert.deepEqual(registry.capability.implementedOperations, ["help", "protocol-client", "event-reducer", "renderers", "identity", "config", "organization-context", "session-metadata", "headless-execution", "interactive-line-mode", "session-commands", "offline-profile"]); assert.equal(registry.capability.state, "offline-profile-available-terminal-preview-partial"); assert.deepEqual(registry.commands.filter((entry) => entry.implemented).map((entry) => entry.name), available); assert.equal(registry.commands.filter((entry) => !available.includes(entry.name)).every((entry) => entry.implemented === false), true); });

test("packed artifact contains and installs reducer, renderers, schema, and registries with zero dependencies", { timeout: 120000 }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-fai-t016-pack-"));
  try {
    const npm = process.platform === "win32" ? process.execPath : "npm";
    const prefix = process.platform === "win32" ? [path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")] : [];
    const env = { ...process.env, npm_config_cache: path.join(root, "cache"), npm_config_offline: "true", npm_config_audit: "false", npm_config_fund: "false", npm_config_update_notifier: "false" };
    const packed = spawnSync(npm, [...prefix, "pack", path.resolve(__dirname, ".."), "--ignore-scripts", "--offline", "--json", "--pack-destination", root], { encoding: "utf8", env });
    assert.equal(packed.status, 0, packed.stderr); const metadata = JSON.parse(packed.stdout)[0]; const files = new Set(metadata.files.map((entry) => entry.path));
    for (const file of ["lib/agent/event-reducer.js", "lib/agent/renderers.js", "lib/agent/semantic-runtime.generated.js", "lib/agent/presentation.js", "lib/agent/render-result-validator.js", "lib/agent/renderer-registry.generated.js", "commands/agent/render-result.v1.schema.json", "commands/agent/renderer-registry.v1.json"]) assert.equal(files.has(file), true, file);
    assert.deepEqual(require("../package.json").dependencies || {}, {});
    const install = path.join(root, "install"); const installed = spawnSync(npm, [...prefix, "install", "--prefix", install, "--ignore-scripts", "--offline", "--no-audit", "--no-fund", path.join(root, metadata.filename)], { encoding: "utf8", env }); assert.equal(installed.status, 0, installed.stderr);
    const installedRequire = createRequire(path.join(install, "probe.cjs")); assert.equal(typeof installedRequire("frootai/agent/event-reducer").createEventReducer, "function"); assert.equal(typeof installedRequire("frootai/agent/renderers").createRenderer, "function");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});