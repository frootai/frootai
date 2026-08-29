// @ts-check
"use strict";

const crypto = require("node:crypto");
const { validate } = require("./contract-validators.js");
const { canonicalJson, createEventStreamTracker, TERMINAL_EVENTS } = require("./semantic-runtime.generated.js");

const HARD_LIMITS = Object.freeze({
  acceptedEvents: 100000,
  deliveredEvents: 200000,
  aggregateEventBytes: 16 * 1024 * 1024,
  eventBytes: 1024 * 1024,
  contentBytes: 2 * 1024 * 1024,
  sources: 1000,
  tools: 1000,
  artifacts: 1000,
  evidence: 1000,
  usage: 1000,
  diagnostics: 1000,
});
const DEFAULT_LIMITS = HARD_LIMITS;
const DEFAULT_CONTENT_CAP_BYTES = DEFAULT_LIMITS.contentBytes;

class AgentFaiRenderError extends Error {
  constructor(issues = ["integrity-failed"]) {
    super("Agent FAI render integrity validation failed.");
    this.name = "AgentFaiRenderError";
    this.code = "integrity_failed";
    this.exitCode = 74;
    this.issues = Object.freeze([...new Set(issues)].slice(0, 32));
  }
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && "value" in descriptor) deepFreeze(descriptor.value, seen);
  }
  return Object.freeze(value);
}

function assertPlainData(value, active = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return;
  if (!value || typeof value !== "object" || active.has(value)) throw new AgentFaiRenderError(["event-invalid-shape"]);
  active.add(value);
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype || Object.keys(value).length !== value.length) throw new AgentFaiRenderError(["event-invalid-shape"]);
  } else if (Object.getPrototypeOf(value) !== Object.prototype) throw new AgentFaiRenderError(["event-invalid-shape"]);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || ["__proto__", "constructor", "prototype"].includes(key)) throw new AgentFaiRenderError(["event-invalid-shape"]);
    if (Array.isArray(value) && key === "length") continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new AgentFaiRenderError(["event-invalid-shape"]);
    assertPlainData(descriptor.value, active);
  }
  active.delete(value);
}

function parityEvent(event) {
  const normalized = structuredClone(event);
  delete normalized.eventId;
  delete normalized.occurredAt;
  if (normalized.type === "session.started") delete normalized.data.surface;
  return normalized;
}

function createEmptyState() {
  return {
    reducerVersion: "agent-fai-event-reducer.v1",
    identity: null,
    acceptedTurn: null,
    context: { status: "pending", manifestId: null, manifestDigest: null, reasonCode: null },
    retrieval: { status: "not-started", queryDigest: null, sourceCount: 0, sources: [], errorId: null, reason: null },
    tools: new Map(),
    model: { status: "not-started", modelAlias: null, stream: null, finishReason: null, errorId: null, deltaCount: 0, contentDigest: null },
    artifacts: [], evidence: [], usageReceiptIds: [], diagnostics: [], terminal: null, eventTypeCounts: {},
  };
}

function resolveLimits(options) {
  if ((options.startMode ?? "complete") !== "complete") throw new TypeError("startMode must be complete");
  const aliases = { contentBytes: "contentCapBytes" };
  const result = {};
  for (const [name, hardMaximum] of Object.entries(HARD_LIMITS)) {
    const optionName = aliases[name] || `max${name[0].toUpperCase()}${name.slice(1)}`;
    const value = options[optionName] ?? hardMaximum;
    if (!Number.isSafeInteger(value) || value < 1 || value > hardMaximum) throw new TypeError(`${optionName} must be a positive safe integer no greater than ${hardMaximum}`);
    result[name] = value;
  }
  return Object.freeze(result);
}

function snapshotResult(internal) {
  const { accepted, deliveredCount, duplicateCount, modelDeltas, state } = internal;
  if (accepted.length === 0) return deepFreeze({
    state: null,
    semanticDigest: null,
    delivery: { deliveredCount, acceptedCount: 0, duplicateCount, firstSequence: null, lastSequence: null },
    presentation: { content: "", sources: [], artifacts: [], evidence: [], usage: [], diagnostics: [] },
    acceptedEvents: [],
  });
  const projectedState = structuredClone({ ...state, tools: [...state.tools.values()] });
  projectedState.model.contentDigest = modelDeltas.length > 0 ? sha256(canonicalJson(modelDeltas)) : null;
  projectedState.tools.sort((left, right) => left.toolCallId.localeCompare(right.toolCallId));
  projectedState.artifacts.sort((left, right) => left.artifactId.localeCompare(right.artifactId));
  projectedState.evidence.sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
  const presentation = {
    content: modelDeltas.join(""),
    sources: structuredClone(projectedState.retrieval.sources),
    artifacts: structuredClone(projectedState.artifacts),
    evidence: structuredClone(projectedState.evidence),
    usage: [...projectedState.usageReceiptIds],
    diagnostics: structuredClone(projectedState.diagnostics),
  };
  return deepFreeze({
    state: projectedState,
    semanticDigest: sha256(canonicalJson(accepted.map(parityEvent))),
    delivery: { deliveredCount, acceptedCount: accepted.length, duplicateCount, firstSequence: accepted[0].sequence, lastSequence: accepted.at(-1).sequence },
    presentation,
    acceptedEvents: structuredClone(accepted),
  });
}

function createEventReducer(options = {}) {
  const limits = resolveLimits(options);
  let accepted = [];
  let modelDeltas = [];
  let contentBytes = 0;
  let aggregateEventBytes = 0;
  let deliveredCount = 0;
  let duplicateCount = 0;
  let finalized = false;
  let terminalAccepted = false;
  let byEventId = new Map();
  let bySequence = new Map();
  let tracker = createEventStreamTracker();
  let state = createEmptyState();
  let diagnosticKeys = new Set();

  function reject(issue) { throw new AgentFaiRenderError([issue]); }
  function collectionIssue(event) {
    if (event.type === "retrieval.source" && state.retrieval.sources.length >= limits.sources) return "presentation-sources-cap-exceeded";
    if (event.type === "tool.proposed" && !state.tools.has(event.data.toolCallId) && state.tools.size >= limits.tools) return "presentation-tools-cap-exceeded";
    if (event.type === "artifact.created" && state.artifacts.length >= limits.artifacts) return "presentation-artifacts-cap-exceeded";
    if (event.type === "evidence.created" && state.evidence.length >= limits.evidence) return "presentation-evidence-cap-exceeded";
    if (event.type === "usage.receipt" && state.usageReceiptIds.length >= limits.usage) return "presentation-usage-cap-exceeded";
    if (["warning", "limitation"].includes(event.type)) {
      const key = `${event.type}\0${event.data.code}\0${event.data.messageCode}`;
      if (!diagnosticKeys.has(key) && state.diagnostics.length >= limits.diagnostics) return "presentation-diagnostics-cap-exceeded";
    }
    return null;
  }

  function applyEvent(event) {
    const data = event.data;
    if (state.identity === null) state.identity = { requestId: event.requestId, sessionId: event.sessionId, turnId: event.turnId };
    state.eventTypeCounts[event.type] = (state.eventTypeCounts[event.type] || 0) + 1;
    if (event.type === "turn.accepted") state.acceptedTurn = { intent: data.intent, authority: data.authority, principalDigest: data.principalDigest, manifestDigest: data.manifestDigest, policyVersion: data.policyVersion };
    if (["context.accepted", "context.rejected", "context.compacted"].includes(event.type)) state.context = { status: event.type.split(".")[1], manifestId: data.manifestId, manifestDigest: data.manifestDigest, reasonCode: data.reasonCode };
    if (event.type === "retrieval.started") state.retrieval = { status: "started", queryDigest: data.queryDigest, sourceCount: 0, sources: [], errorId: null, reason: null };
    if (event.type === "retrieval.source") state.retrieval.sources.push({ sourceId: data.sourceId, category: data.category, href: data.href, rank: data.rank });
    if (event.type === "retrieval.completed") { state.retrieval.status = "completed"; state.retrieval.sourceCount = data.sourceCount; }
    if (event.type === "retrieval.failed") Object.assign(state.retrieval, { status: "failed", sourceCount: data.sourceCount, errorId: data.errorId });
    if (event.type === "retrieval.cancelled") Object.assign(state.retrieval, { status: "cancelled", sourceCount: data.sourceCount, reason: data.reason });
    if (data.toolCallId) {
      const tool = state.tools.get(data.toolCallId) || { toolCallId: data.toolCallId, toolName: null, actionId: null, risk: null, policy: null, approvalId: null, status: "unknown", progressPercent: null, outputDigest: null, effectId: null, errorId: null };
      if (event.type === "tool.proposed") Object.assign(tool, { toolName: data.toolName, actionId: data.actionId, risk: data.risk, status: "proposed" });
      if (event.type === "policy.decided") tool.policy = { decision: data.decision, policyVersion: data.policyVersion, reasonCode: data.reasonCode };
      if (event.type === "approval.required") tool.status = "awaiting-approval";
      if (event.type === "approval.granted") { tool.approvalId = data.approvalId; tool.status = "approved"; }
      if (event.type === "tool.started") tool.status = "started";
      if (event.type === "tool.progress") { tool.status = "progress"; tool.progressPercent = data.progressPercent; }
      if (event.type === "tool.completed") Object.assign(tool, { status: "completed", outputDigest: data.outputDigest, effectId: data.effectId });
      if (event.type === "tool.failed") Object.assign(tool, { status: "failed", errorId: data.errorId });
      state.tools.set(data.toolCallId, tool);
    }
    if (event.type === "model.started") Object.assign(state.model, { status: "started", modelAlias: data.modelAlias, stream: data.stream });
    if (event.type === "model.delta") { modelDeltas.push(data.content); contentBytes += Buffer.byteLength(data.content, "utf8"); state.model.deltaCount += 1; }
    if (event.type === "model.completed") Object.assign(state.model, { status: "completed", finishReason: data.finishReason });
    if (event.type === "model.failed") Object.assign(state.model, { status: "failed", errorId: data.errorId });
    if (event.type === "artifact.created") state.artifacts.push({ artifactId: data.artifactId, digest: data.digest });
    if (event.type === "evidence.created") state.evidence.push({ evidenceId: data.evidenceId, digest: data.digest });
    if (event.type === "usage.receipt") state.usageReceiptIds.push(data.receiptId);
    if (["warning", "limitation"].includes(event.type)) {
      const key = `${event.type}\0${data.code}\0${data.messageCode}`;
      if (!diagnosticKeys.has(key)) { diagnosticKeys.add(key); state.diagnostics.push({ type: event.type, code: data.code, messageCode: data.messageCode }); }
    }
    if (TERMINAL_EVENTS.has(event.type)) state.terminal = { type: event.type, data: structuredClone(data), sequence: event.sequence };
  }

  function push(event) {
    if (finalized) throw new AgentFaiRenderError(["reducer-finalized"]);
    let bytes;
    try { assertPlainData(event); bytes = canonicalJson(event); }
    catch { throw new AgentFaiRenderError(["event-invalid-shape"]); }
    const validation = validate("validateApiEvent", event);
    if (!validation.valid) throw new AgentFaiRenderError(["event-schema-invalid"]);
    if (deliveredCount >= limits.deliveredEvents) reject("stream-delivered-events-cap-exceeded");
    const sameId = byEventId.get(event.eventId);
    if (sameId !== undefined) {
      if (sameId !== bytes) throw new AgentFaiRenderError(["stream-event-id-collision"]);
      deliveredCount += 1;
      duplicateCount += 1;
      return Object.freeze({ accepted: false, duplicate: true, sequence: event.sequence });
    }
    const sameSequence = bySequence.get(event.sequence);
    if (sameSequence !== undefined) throw new AgentFaiRenderError([sameSequence === bytes ? "stream-sequence-duplicate" : "stream-sequence-collision"]);
    if (terminalAccepted) reject("stream-post-terminal-event");
    if (accepted.length >= limits.acceptedEvents) reject("stream-accepted-events-cap-exceeded");
    const eventByteLength = Buffer.byteLength(bytes, "utf8");
    if (eventByteLength > limits.eventBytes) reject("stream-event-bytes-cap-exceeded");
    if (aggregateEventBytes + eventByteLength > limits.aggregateEventBytes) reject("stream-aggregate-event-bytes-cap-exceeded");
    if (event.type === "model.delta" && contentBytes + Buffer.byteLength(event.data.content, "utf8") > limits.contentBytes) reject("presentation-content-cap-exceeded");
    const collectionLimit = collectionIssue(event); if (collectionLimit) reject(collectionLimit);
    let errors;
    try { errors = tracker.validateNext(event); } catch { throw new AgentFaiRenderError(["stream-invalid-shape"]); }
    if (errors.length > 0) throw new AgentFaiRenderError(errors);
    const stored = structuredClone(event);
    accepted.push(stored);
    deliveredCount += 1;
    aggregateEventBytes += eventByteLength;
    byEventId.set(event.eventId, bytes);
    bySequence.set(event.sequence, bytes);
    applyEvent(stored);
    terminalAccepted ||= TERMINAL_EVENTS.has(event.type);
    return Object.freeze({ accepted: true, duplicate: false, sequence: event.sequence });
  }

  function snapshot() {
    return snapshotResult({ accepted, deliveredCount, duplicateCount, modelDeltas, state });
  }

  function finalize() {
    if (finalized) throw new AgentFaiRenderError(["reducer-finalized"]);
    if (accepted.length === 0) throw new AgentFaiRenderError(["stream-empty"]);
    let errors;
    try { errors = tracker.finalErrors(); } catch { throw new AgentFaiRenderError(["stream-invalid-shape"]); }
    if (errors.length > 0) throw new AgentFaiRenderError(errors);
    finalized = true;
    return snapshot();
  }

  function reset() {
    accepted = [];
    modelDeltas = [];
    contentBytes = 0;
    aggregateEventBytes = 0;
    deliveredCount = 0;
    duplicateCount = 0;
    finalized = false;
    terminalAccepted = false;
    byEventId = new Map();
    bySequence = new Map();
    tracker = createEventStreamTracker();
    state = createEmptyState();
    diagnosticKeys = new Set();
  }

  return Object.freeze({ push, snapshot, finalize, reset });
}

module.exports = { AgentFaiRenderError, DEFAULT_CONTENT_CAP_BYTES, DEFAULT_LIMITS, HARD_LIMITS, createEventReducer, parityEvent };