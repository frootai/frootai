// @ts-check
"use strict";

const crypto = require("node:crypto");

const EXIT_BY_CODE = Object.freeze({ invalid_argument: 2, invalid_json: 2, request_too_large: 2, message_too_large: 2, authentication_required: 65, not_found: 66, resource_gone: 66, service_unavailable: 69, transport_failed: 69, model_unavailable: 69, tool_failed: 70, internal: 70, conflict: 73, idempotency_conflict: 73, integrity_failed: 74, deadline_exceeded: 75, authorization_denied: 77, policy_denied: 77, approval_required: 78, quota_exceeded: 79, budget_exceeded: 79, cancelled: 130 });
const RETRYABLE_BY_CODE = Object.freeze({ invalid_argument: false, invalid_json: false, request_too_large: false, message_too_large: false, authentication_required: false, not_found: false, resource_gone: false, authorization_denied: false, policy_denied: false, approval_required: false, quota_exceeded: false, budget_exceeded: false, conflict: false, idempotency_conflict: false, service_unavailable: true, deadline_exceeded: true, cancelled: false, transport_failed: true, model_unavailable: true, tool_failed: false, integrity_failed: false, internal: false });
const SAFE_MESSAGE_BY_CODE = Object.freeze({ invalid_argument: "The request is invalid.", invalid_json: "The request body is not valid JSON.", request_too_large: "The request exceeds the allowed size.", message_too_large: "The message exceeds the allowed size.", authentication_required: "Authentication is required.", not_found: "The requested resource was not found.", resource_gone: "The requested resource is no longer available.", authorization_denied: "Authorization was denied.", policy_denied: "Policy denied this operation.", approval_required: "This operation requires an exact approval.", quota_exceeded: "The applicable quota was exceeded.", budget_exceeded: "The authorized budget was exceeded.", conflict: "The request conflicts with current state.", idempotency_conflict: "The idempotency key conflicts with a prior request.", service_unavailable: "The service is temporarily unavailable.", deadline_exceeded: "The request deadline was exceeded.", cancelled: "The request was cancelled.", transport_failed: "The transport failed.", model_unavailable: "The selected model is unavailable.", tool_failed: "The tool operation failed.", integrity_failed: "Integrity validation failed.", internal: "An internal error occurred." });
const HTTP_STATUS_BY_CODE = Object.freeze({ invalid_argument: 400, invalid_json: 400, request_too_large: 413, message_too_large: 413, authentication_required: 401, not_found: 404, resource_gone: 410, authorization_denied: 403, policy_denied: 403, approval_required: 403, quota_exceeded: 429, budget_exceeded: 429, conflict: 409, idempotency_conflict: 409, service_unavailable: 503, model_unavailable: 503, deadline_exceeded: 504, cancelled: 499, transport_failed: 502, tool_failed: 502, integrity_failed: 422, internal: 500 });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const SECRET_KEY = /(?:authorization|token|secret|password|passwd|cookie|api[-_]?key|proxy|credential|body|headers?|url|endpoint|idempotency)/iu;
const SECRET_VALUE = /(?:bearer\s+[A-Za-z0-9._~+\/-]+=*|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}|https?:\/\/[^\s/@:]+:[^\s/@]+@|(?:api[-_]?key|password|token|secret)\s*[:=]\s*\S+)/giu;

function redact(value, knownSecrets = [], depth = 0, seen = new WeakSet()) {
  if (depth > 8) return "[bounded]";
  if (typeof value === "string") {
    let result = value.slice(0, 512).replace(SECRET_VALUE, "[redacted]");
    for (const secret of knownSecrets) if (typeof secret === "string" && secret.length >= 4) result = result.split(secret).join("[redacted]");
    return result;
  }
  if (value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return value;
  if (!value || typeof value !== "object" || seen.has(value)) return "[redacted]";
  seen.add(value);
  if (Array.isArray(value)) return value.slice(0, 32).map((entry) => redact(entry, knownSecrets, depth + 1, seen));
  const result = Object.create(null);
  for (const key of Object.keys(value).slice(0, 32)) result[key] = SECRET_KEY.test(key) ? "[redacted]" : redact(value[key], knownSecrets, depth + 1, seen);
  return result;
}

class AgentFaiClientError extends Error {
  constructor(code, metadata = {}) {
    if (!Object.hasOwn(EXIT_BY_CODE, code)) code = "internal";
    if (metadata.status !== undefined && metadata.status !== HTTP_STATUS_BY_CODE[code]) code = "integrity_failed";
    super(SAFE_MESSAGE_BY_CODE[code]);
    this.name = "AgentFaiClientError";
    this.code = code;
    this.exitCode = EXIT_BY_CODE[code];
    this.retryable = RETRYABLE_BY_CODE[code];
    const createUuid = (value, factory) => {
      if (UUID.test(value || "")) return value;
      try { const generated = factory?.(); if (UUID.test(generated || "")) return generated; } catch { /* fall through */ }
      return crypto.randomUUID();
    };
    this.requestId = createUuid(metadata.requestId, metadata.requestIdFactory);
    this.errorId = createUuid(metadata.errorId, metadata.errorIdFactory);
    if (metadata.status !== undefined) this.status = HTTP_STATUS_BY_CODE[code];
    for (const key of ["retryAfterSeconds", "details"]) if (metadata[key] !== undefined) this[key] = redact(metadata[key], metadata.knownSecrets || []);
  }
  diagnostics() {
    return redact({ code: this.code, exitCode: this.exitCode, retryable: this.retryable, requestId: this.requestId || null, errorId: this.errorId || null, status: this.status || null, retryAfterSeconds: this.retryAfterSeconds ?? null });
  }
  toExit() {
    const value = { $schema: "https://frootai.dev/schemas/agent-fai-exit.v1.json", schemaVersion: "agent-fai-exit.v1", outcome: this.code === "cancelled" ? "cancelled" : "failure", exitCode: this.exitCode, errorCode: this.code, retryable: this.retryable };
    if (!require("./contract-validators.js").validate("validateAgentFaiExit", value).valid) throw new AgentFaiClientError("internal");
    return Object.freeze(value);
  }
  toProblem({ requestId = this.requestId, errorId = this.errorId, details = this.details || {} } = {}) {
    if (!UUID.test(requestId || "") || !UUID.test(errorId || "")) throw new Error("Agent FAI problem identifiers are invalid");
    const value = { $schema: "https://frootai.dev/schemas/agent-fai-problem.v1.json", schemaVersion: "agent-fai-problem.v1", error: { errorId, code: this.code, message: this.message, requestId, httpStatus: HTTP_STATUS_BY_CODE[this.code], retryable: this.retryable, retryAfterSeconds: this.retryable ? (this.retryAfterSeconds ?? null) : null, details: redact(details) } };
    if (!require("./contract-validators.js").validate("validateAgentFaiProblem", value).valid) throw new AgentFaiClientError("internal");
    return Object.freeze(value);
  }
}

module.exports = { AgentFaiClientError, EXIT_BY_CODE, RETRYABLE_BY_CODE, SAFE_MESSAGE_BY_CODE, HTTP_STATUS_BY_CODE, UUID, redact };