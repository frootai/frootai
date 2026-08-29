// @ts-check
"use strict";

const crypto = require("node:crypto");
const packageJson = require("../../package.json");
const { createIdentityCoordinator } = require("./identity-coordinator.js");
const registry = require("./operation-registry.generated.js");
const { validate } = require("./contract-validators.js");
const { AgentFaiClientError, HTTP_STATUS_BY_CODE, UUID, redact } = require("./client-error.js");
const { parseStrictJson } = require("./strict-json.js");
const { resolveProxy } = require("./proxy-policy.js");
const { parseSse } = require("./sse.js");
const { awaitWithAbort } = require("./abort.js");

const API_VERSION = "1";
const REQUIRED_CAPABILITIES = Object.freeze(["events.v1", "replay"]);
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,256}$/u;
const SAFE_VALUE = /^[^\u0000-\u001f\u007f]*$/u;
const SAFE_ENDPOINT = /^[\x21-\x7e]+$/u;
const TERMINAL_EVENT_TYPES = new Set(["turn.completed", "turn.failed", "turn.cancelled", "job.completed", "job.failed", "job.cancelled"]);

function canonicalJson(value) {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") { if (!Number.isFinite(value)) throw new AgentFaiClientError("invalid_argument"); return Object.is(value, -0) ? "0" : JSON.stringify(value); }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) throw new AgentFaiClientError("invalid_argument");
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) deepFreeze(value[key], seen);
  return Object.freeze(value);
}

function normalizeBaseUrl(raw) {
  if (raw === undefined) raw = "https://frootai.dev";
  if (typeof raw !== "string" || !SAFE_ENDPOINT.test(raw) || raw.includes("%")) throw new AgentFaiClientError("invalid_argument");
  let url;
  try { url = new URL(raw); } catch { throw new AgentFaiClientError("invalid_argument"); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !["/", "/v1/agent-fai", "/v1/agent-fai/"].includes(url.pathname)) throw new AgentFaiClientError("invalid_argument");
  const canonical = new Set([url.origin, `${url.origin}/`, `${url.origin}/v1/agent-fai`, `${url.origin}/v1/agent-fai/`]);
  if (!canonical.has(raw)) throw new AgentFaiClientError("invalid_argument");
  return Object.freeze({ origin: url.origin, prefix: url.pathname.startsWith("/v1/agent-fai") ? "/v1/agent-fai" : "" });
}

function compareSemver(left, right) {
  const parse = (value) => String(value).split("-", 1)[0].split(".").map(Number);
  const a = parse(left); const b = parse(right);
  if (a.length !== 3 || b.length !== 3 || [...a, ...b].some((entry) => !Number.isInteger(entry))) throw new AgentFaiClientError("integrity_failed");
  for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
}

function validateScalar(value, schema) {
  if (schema?.const !== undefined && value !== schema.const) return false;
  if (schema?.type === "integer" && (!Number.isInteger(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity))) return false;
  if (schema?.type === "string") {
    if (typeof value !== "string" || !SAFE_VALUE.test(value) || value.length < (schema.minLength ?? 0) || value.length > (schema.maxLength ?? Infinity)) return false;
    if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) return false;
    if (schema.format === "uuid" && !UUID.test(value)) return false;
    if (schema.enum && !schema.enum.includes(value)) return false;
  }
  return true;
}

function splitInput(operation, input = {}) {
  if (input === null || input === undefined) input = {};
  if (typeof input !== "object" || Array.isArray(input)) throw new AgentFaiClientError("invalid_argument");
  const path = { ...(input.path || {}) }; const query = { ...(input.query || {}) }; const headers = { ...(input.headers || {}) };
  const control = new Set(["path", "query", "headers", "body", "signal", "timeoutMs", "retry", "maxRetries", "idempotencyKey"]);
  for (const parameter of operation.parameters) {
    const camel = parameter.name.replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    const value = input[parameter.name] ?? input[camel];
    if (value === undefined) continue;
    if (parameter.in === "path") path[parameter.name] = value;
    else if (parameter.in === "query") query[parameter.name] = value;
    else headers[parameter.name] = value;
    control.add(parameter.name); control.add(camel);
  }
  let body = input.body;
  if (operation.requestValidator && body === undefined) body = Object.fromEntries(Object.entries(input).filter(([key]) => !control.has(key)));
  return { path, query, headers, body, options: input };
}

function normalizeMethodInput(operation, args) {
  if (args.length === 0) return {};
  if (args[0] && typeof args[0] === "object" && !Array.isArray(args[0])) return { ...args[0], ...(args[1] || {}) };
  const pathParameters = operation.parameters.filter((entry) => entry.in === "path");
  const result = { path: {} }; let index = 0;
  for (const parameter of pathParameters) result.path[parameter.name] = args[index++];
  if (operation.requestValidator) result.body = args[index++];
  return { ...result, ...(args[index] || {}) };
}

function integrityFailure() { return new AgentFaiClientError("integrity_failed"); }

function validateResponseLike(candidate) {
  let status; let ok; let headers; let body; let url;
  try {
    if (!candidate || (typeof candidate !== "object" && typeof candidate !== "function")) throw integrityFailure();
    status = candidate.status; ok = candidate.ok; headers = candidate.headers; body = candidate.body; url = candidate.url;
    if (!Number.isInteger(status) || status < 100 || status > 599 || typeof ok !== "boolean" || ok !== (status >= 200 && status <= 299)) throw integrityFailure();
    if (!headers || (typeof headers !== "object" && typeof headers !== "function") || typeof headers.get !== "function") throw integrityFailure();
    headers.get("content-type");
    if (!body || typeof body.getReader !== "function") throw integrityFailure();
    if (url !== undefined && typeof url !== "string") throw integrityFailure();
  } catch (error) { if (error instanceof AgentFaiClientError) throw error; throw integrityFailure(); }
  return Object.freeze({ status, ok, headers, body, url: url || "" });
}

function getHeader(response, name) {
  try { const value = response.headers.get(name); return value === null ? null : String(value); } catch { throw integrityFailure(); }
}

function contentTypeMatches(actual, expected) {
  if (actual === expected) return true;
  return expected === "application/json" ? /^application\/json;\s*charset=utf-8$/iu.test(actual) : expected === "text/event-stream" ? /^text\/event-stream;\s*charset=utf-8$/iu.test(actual) : false;
}

function validateRequiredHeaders(response, metadata) {
  for (const header of metadata.requiredHeaders || []) {
    const value = getHeader(response, header.name);
    const scalar = header.schema?.type === "integer" && /^(?:0|[1-9]\d*)$/u.test(value || "") ? Number(value) : value;
    if (value === null || !validateScalar(scalar, header.schema)) throw integrityFailure();
  }
}

async function readJsonResponse(response, maximumBytes, signal) {
  if (!contentTypeMatches(getHeader(response, "content-type") || "", "application/json")) throw integrityFailure();
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await awaitWithAbort(Promise.resolve().then(() => reader.read()), signal, () => reader.cancel()); if (done) break;
      if (!(value instanceof Uint8Array)) throw integrityFailure();
      size += value.byteLength; if (size > maximumBytes) { await reader.cancel(); throw new AgentFaiClientError("request_too_large"); }
      chunks.push(value);
    }
  } catch (error) {
    if (signal?.aborted) { try { await reader.cancel(); } catch { /* */ } }
    throw error;
  } finally { try { reader.releaseLock(); } catch { /* */ } }
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks.map((entry) => Buffer.from(entry)))); } catch { throw integrityFailure(); }
  try { return parseStrictJson(text, "response JSON"); } catch { throw integrityFailure(); }
}

function createAgentFaiClient(options = {}) {
  const endpoint = normalizeBaseUrl(options.baseUrl);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new AgentFaiClientError("service_unavailable");
  const requestIdFactory = options.requestIdFactory || (() => crypto.randomUUID());
  const errorIdFactory = options.errorIdFactory || (() => crypto.randomUUID());
  const makeError = (code, metadata = {}) => new AgentFaiClientError(code, { requestIdFactory, errorIdFactory, ...metadata });
  const now = options.now || Date.now;
  const sleep = options.sleep || ((milliseconds, signal) => new Promise((resolve, reject) => { const timer = setTimeout(resolve, milliseconds); signal?.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason); }, { once: true }); }));
  const setTimer = options.setTimeout || setTimeout; const clearTimer = options.clearTimeout || clearTimeout;
  const maximumResponseBytes = options.maximumResponseBytes || 2 * 1024 * 1024;
  const idempotencyCacheSize = options.idempotencyCacheSize ?? 1024;
  if (!Number.isInteger(idempotencyCacheSize) || idempotencyCacheSize < 1 || idempotencyCacheSize > 1024) throw makeError("invalid_argument");
  const compatibilityTimeoutMs = options.compatibilityTimeoutMs ?? 30000;
  if (!Number.isFinite(compatibilityTimeoutMs) || compatibilityTimeoutMs <= 0) throw makeError("invalid_argument");
  const environment = options.env || process.env;
  if (environment.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw makeError("integrity_failed");
  const diagnostics = []; const idempotency = new Map();
  let compatibility = null; let compatibilityFlight = null;

  function createOperationContext(input = {}) {
    const timeoutMs = input.timeoutMs ?? options.timeoutMs ?? 30000;
    if (!Number.isFinite(timeoutMs) || timeoutMs < 0) throw makeError("invalid_argument");
    const started = now();
    return Object.freeze({ signal: input.signal, started, deadline: timeoutMs > 0 ? started + timeoutMs : Infinity });
  }

  function assertContextActive(context, requestId) {
    if (context.signal?.aborted) throw makeError("cancelled", { requestId });
    if (now() >= context.deadline) throw makeError("deadline_exceeded", { requestId });
  }

  async function awaitWithinContext(promise, context, requestId) {
    assertContextActive(context, requestId);
    const controller = new AbortController(); let timedOut = false;
    const onAbort = () => controller.abort(context.signal.reason);
    context.signal?.addEventListener("abort", onAbort, { once: true });
    if (context.signal?.aborted) controller.abort(context.signal.reason);
    const remaining = context.deadline - now();
    const timer = Number.isFinite(remaining) ? setTimer(() => { timedOut = true; controller.abort(); }, Math.max(0, remaining)) : null;
    try {
      const result = await awaitWithAbort(promise, controller.signal);
      assertContextActive(context, requestId);
      return result;
    } catch (error) {
      if (context.signal?.aborted) throw makeError("cancelled", { requestId });
      if (timedOut || now() >= context.deadline) throw makeError("deadline_exceeded", { requestId });
      throw error;
    } finally {
      if (timer) clearTimer(timer);
      context.signal?.removeEventListener("abort", onAbort);
    }
  }

  const record = (entry) => { diagnostics.push(Object.freeze(redact(entry))); if (diagnostics.length > 64) diagnostics.shift(); };
  const identityCoordinator = options.identityCoordinator || createIdentityCoordinator({
    now,
    tokenBackend: options.tokenBackend,
    tokenPath: options.tokenPath,
    credentialsOptions: options.credentialsOptions || {},
    identityState: options.identityState,
    operationLock: options.identityOperationLock,
    identityOperationLockPath: options.identityOperationLockPath,
    identityOperationLockOptions: options.identityOperationLockOptions,
  });
  const authProvider = options.authProvider || (() => identityCoordinator.authProvider({ migrate: options.migrateCredentials !== false }));

  async function resolveAuthentication() {
    let auth;
    try { auth = await authProvider(); } catch (error) { if (error instanceof AgentFaiClientError) throw error; if (error && error.code === "authentication_required") throw makeError("authentication_required"); throw makeError("integrity_failed"); }
    if (!auth || Object.getPrototypeOf(auth) !== Object.prototype || auth.scheme !== "Bearer" || typeof auth.token !== "string" || auth.token.length < 1 || auth.token.length > 8192 || !/^[\x21-\x7e]+$/u.test(auth.token)) throw makeError("integrity_failed");
    return auth.token;
  }

  function buildRequest(operation, input, requestId) {
    const parts = splitInput(operation, input); let route = operation.path;
    for (const parameter of operation.parameters) {
      const source = parameter.in === "path" ? parts.path : parameter.in === "query" ? parts.query : parts.headers;
      const value = source[parameter.name];
      if (parameter.required && value === undefined && !["Agent-FAI-Version", "X-Request-Id", "Idempotency-Key"].includes(parameter.name)) throw new AgentFaiClientError("invalid_argument", { requestId });
      if (value !== undefined && !validateScalar(value, parameter.schema)) throw new AgentFaiClientError("invalid_argument", { requestId });
      if (parameter.in === "path") route = route.replace(`{${parameter.name}}`, encodeURIComponent(String(value)));
    }
    if (route.includes("{") || !route.startsWith("/v1/agent-fai/")) throw new AgentFaiClientError("invalid_argument", { requestId });
    const url = new URL(endpoint.origin + (endpoint.prefix ? route.slice("/v1/agent-fai".length) : route));
    for (const parameter of operation.parameters.filter((entry) => entry.in === "query")) if (parts.query[parameter.name] !== undefined) url.searchParams.set(parameter.name, String(parts.query[parameter.name]));
    const headers = new Headers(); headers.set("Agent-FAI-Version", API_VERSION); headers.set("X-Request-Id", requestId);
    for (const parameter of operation.parameters.filter((entry) => entry.in === "header")) if (parts.headers[parameter.name] !== undefined) headers.set(parameter.name, String(parts.headers[parameter.name]));
    let body = null;
    if (operation.requestValidator) {
      if (!validate(operation.requestValidator, parts.body).valid) throw new AgentFaiClientError("invalid_argument", { requestId });
      body = canonicalJson(parts.body); headers.set("Content-Type", "application/json");
    }
    return { url, route, headers, body, parts };
  }

  async function rawRequest(operation, input = {}, internal = {}) {
    const requestId = internal.requestId || requestIdFactory();
    if (!UUID.test(requestId)) throw makeError("invalid_argument");
    const context = internal.context || createOperationContext(input);
    assertContextActive(context, requestId);
    const built = buildRequest(operation, input, requestId);
    if (operation.idempotency) {
      const key = input.idempotencyKey || input.headers?.["Idempotency-Key"];
      if (!IDEMPOTENCY_KEY.test(key || "")) throw makeError("invalid_argument", { requestId });
      const keyDigest = crypto.createHash("sha256").update(key).digest("hex");
      const query = [...built.url.searchParams.entries()].sort(([leftName, leftValue], [rightName, rightValue]) => leftName.localeCompare(rightName) || leftValue.localeCompare(rightValue)).map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`).join("&");
      const bodyDigest = crypto.createHash("sha256").update(built.body || "").digest("hex");
      const identityDigest = crypto.createHash("sha256").update(`${operation.operationId}\n${built.url.pathname}\n${query}\n${bodyDigest}`).digest("hex");
      const existing = idempotency.get(keyDigest);
      if (existing && existing.identityDigest !== identityDigest) throw makeError("idempotency_conflict", { requestId: existing.requestId });
      if (existing) {
        internal.requestId = existing.requestId;
        idempotency.delete(keyDigest);
        idempotency.set(keyDigest, existing);
      } else {
        idempotency.set(keyDigest, { identityDigest, requestId });
        if (idempotency.size > idempotencyCacheSize) idempotency.delete(idempotency.keys().next().value);
      }
      built.headers.set("Idempotency-Key", key);
    }
    const effectiveRequestId = internal.requestId || requestId; built.headers.set("X-Request-Id", effectiveRequestId);
    if (operation.auth) built.headers.set("Authorization", `Bearer ${await awaitWithinContext(resolveAuthentication(), context, effectiveRequestId)}`);
    else built.headers.set("Agent-FAI-Capabilities", REQUIRED_CAPABILITIES.join(","));
    const proxy = resolveProxy(built.url, environment); let dispatcher;
    if (proxy.kind === "proxy") {
      if (typeof options.proxyDispatcherFactory !== "function") throw makeError("service_unavailable", { requestId: effectiveRequestId });
      try { dispatcher = options.proxyDispatcherFactory(proxy.proxyUrl); } catch { throw makeError("service_unavailable", { requestId: effectiveRequestId }); }
      if (!dispatcher) throw makeError("service_unavailable", { requestId: effectiveRequestId });
    }
    const maximumRetries = Math.min(2, Math.max(0, input.maxRetries ?? input.retry?.maxRetries ?? 0));
    let attempt = 0; const { started, deadline } = context;
    while (true) {
      attempt += 1;
      const controller = new AbortController(); const callerSignal = context.signal; let timedOut = false;
      const onAbort = () => controller.abort(callerSignal.reason); callerSignal?.addEventListener("abort", onAbort, { once: true });
      if (callerSignal?.aborted) controller.abort(callerSignal.reason);
      const remaining = deadline - now();
      if (remaining <= 0) throw makeError("deadline_exceeded", { requestId: effectiveRequestId });
      const timer = Number.isFinite(remaining) ? setTimer(() => { timedOut = true; controller.abort(); }, remaining) : null;
      try {
        const fetchPromise = Promise.resolve().then(() => fetchImpl(built.url, { method: operation.method, headers: built.headers, body: built.body, redirect: "manual", signal: controller.signal, ...(dispatcher ? { dispatcher } : {}) }));
        const response = validateResponseLike(await awaitWithAbort(fetchPromise, controller.signal));
        assertContextActive(context, effectiveRequestId);
        if (response.url) {
          let responseUrl; try { responseUrl = new URL(response.url); } catch { throw integrityFailure(); }
          if (responseUrl.protocol !== "https:" || responseUrl.href !== built.url.href) throw integrityFailure();
        }
        const metadata = (response.ok ? operation.successResponses : operation.errorResponses).find((entry) => entry.status === response.status);
        if (!metadata) throw integrityFailure();
        validateRequiredHeaders(response, metadata);
        const responseRequestId = getHeader(response, "x-request-id"); const responseVersion = getHeader(response, "agent-fai-version");
        if (responseRequestId !== effectiveRequestId || responseVersion !== API_VERSION) throw integrityFailure();
        const contentType = getHeader(response, "content-type") || "";
        const expectedContentType = internal.stream && response.ok ? "text/event-stream" : "application/json";
        if (!metadata.contentTypes.includes(expectedContentType) || !contentTypeMatches(contentType, expectedContentType)) throw integrityFailure();
        if (internal.stream && response.ok) {
          record({ operationId: operation.operationId, requestId: effectiveRequestId, attempts: attempt, status: response.status, proxyClass: proxy.kind, durationMs: Math.max(0, now() - started), routeTemplate: operation.path });
          return { response, requestId: effectiveRequestId, attempts: attempt, deadline, controller };
        }
        const payload = await readJsonResponse(response, maximumResponseBytes, controller.signal);
        assertContextActive(context, effectiveRequestId);
        if (response.ok) {
          if (!metadata.validator || !validate(metadata.validator, payload).valid) throw integrityFailure();
          if (timer) clearTimer(timer); callerSignal?.removeEventListener("abort", onAbort);
        record({ operationId: operation.operationId, requestId: effectiveRequestId, attempts: attempt, status: response.status, proxyClass: proxy.kind, durationMs: Math.max(0, now() - started), routeTemplate: operation.path });
        return payload;
        }
        if (!metadata.validator || !validate(metadata.validator, payload).valid || !validate("validateApiProblem", payload).valid || !validate("validateAgentFaiProblem", payload).valid || payload.error?.httpStatus !== response.status || payload.error?.requestId !== responseRequestId || HTTP_STATUS_BY_CODE[payload.error?.code] !== response.status) throw integrityFailure();
        const error = makeError(payload.error.code, { requestId: payload.error.requestId, errorId: payload.error.errorId, status: response.status, retryAfterSeconds: payload.error.retryAfterSeconds, details: payload.error.details });
        const retryableStatus = [429, 503, 504].includes(response.status) && error.retryable && attempt <= maximumRetries && (operation.method === "GET" || operation.idempotency) && !operation.friendlyName.startsWith("cancel");
        if (!retryableStatus) throw error;
        const delay = Math.min(30, Math.max(0, error.retryAfterSeconds || 0)) * 1000;
        await awaitWithAbort(Promise.resolve().then(() => sleep(Math.min(delay, Math.max(0, deadline - now())), controller.signal)), controller.signal);
      } catch (error) {
        if (callerSignal?.aborted) throw makeError("cancelled", { requestId: effectiveRequestId });
        if (timedOut || now() >= deadline) throw makeError("deadline_exceeded", { requestId: effectiveRequestId });
        if (error instanceof AgentFaiClientError) {
          if (error.requestId === effectiveRequestId && error.errorId && error.status !== undefined) throw error;
          throw makeError(error.code, { requestId: effectiveRequestId, retryAfterSeconds: error.retryAfterSeconds, details: error.details });
        }
        const retryable = attempt <= maximumRetries && (operation.method === "GET" || operation.idempotency) && !operation.friendlyName.startsWith("cancel");
        if (!retryable) throw makeError("transport_failed", { requestId: effectiveRequestId });
        try { await awaitWithAbort(Promise.resolve().then(() => sleep(0, controller.signal)), controller.signal); } catch { throw makeError(callerSignal?.aborted ? "cancelled" : now() >= deadline ? "deadline_exceeded" : "transport_failed", { requestId: effectiveRequestId }); }
      } finally {
        if (timer) clearTimer(timer); callerSignal?.removeEventListener("abort", onAbort);
      }
    }
  }

  function getCompatibilityFlight() {
    if (compatibility) return compatibility;
    if (compatibilityFlight) return compatibilityFlight;
    const sharedContext = createOperationContext({ timeoutMs: compatibilityTimeoutMs });
    compatibilityFlight = (async () => {
      const operation = registry.byFriendlyName.negotiateCompatibility;
      const result = await rawRequest(operation, {}, { context: sharedContext });
      const exactDeprecation = result.deprecation?.deprecated === false && result.deprecation.sunsetAt === null && result.deprecation.replacement === null;
      const exactVersions = result.schemaVersion === "agent-fai-compatibility.v1" && result.requestedApiVersion === API_VERSION && result.negotiatedApiVersion === API_VERSION && result.contractVersion === "1.0.0" && JSON.stringify(result.supportedApiVersions) === '["1"]' && JSON.stringify(result.supportedEventVersions) === '["agent-fai-event.v1"]';
      const exactCapabilities = REQUIRED_CAPABILITIES.every((capability) => result.supportedCapabilities.includes(capability) && result.negotiatedCapabilities.includes(capability) && !result.unsupportedCapabilities.includes(capability)) && result.negotiatedCapabilities.every((capability) => result.supportedCapabilities.includes(capability));
      if (!exactVersions || !exactCapabilities || !exactDeprecation || compareSemver(packageJson.version, result.minimumClientVersion) < 0) throw makeError("integrity_failed");
      compatibility = deepFreeze(result); return compatibility;
    })().finally(() => { compatibilityFlight = null; });
    compatibilityFlight.catch(() => {});
    return compatibilityFlight;
  }

  async function negotiateCompatibility(input = {}, internal = {}) {
    const context = internal.context || createOperationContext(input);
    assertContextActive(context);
    if (compatibility) return compatibility;
    return awaitWithinContext(getCompatibilityFlight(), context);
  }

  async function request(name, input = {}) {
    const operation = registry.byId[name] || registry.byFriendlyName[name];
    if (!operation) throw new AgentFaiClientError("invalid_argument");
    const context = createOperationContext(input);
    if (operation.auth) await negotiateCompatibility({}, { context });
    return rawRequest(operation, input, { context });
  }

  async function* stream(name, input = {}) {
    const operation = registry.byFriendlyName[name === "streamTurnEvents" ? "listTurnEvents" : name === "streamJobEvents" ? "listJobEvents" : name];
    if (!operation?.eventStream) throw makeError("invalid_argument");
    const context = createOperationContext(input);
    const requestedReconnects = input.maxReconnects ?? 2;
    if (!Number.isInteger(requestedReconnects) || requestedReconnects < 0) throw makeError("invalid_argument");
    const maximumReconnects = Math.min(2, requestedReconnects);
    let lastSequence = input.lastEventId === undefined ? 0 : Number(input.lastEventId); let reconnects = 0; let terminal = false;
    const accepted = new Map(); const eventIds = new Map();
    const pathIdentity = name === "streamTurnEvents" ? { sessionId: input.path?.sessionId, turnId: input.path?.turnId, requestId: input.identity?.requestId } : input.identity;
    if (!pathIdentity || Object.getPrototypeOf(pathIdentity) !== Object.prototype || !UUID.test(pathIdentity.sessionId || "") || !UUID.test(pathIdentity.turnId || "") || !UUID.test(pathIdentity.requestId || "")) throw makeError("invalid_argument");
    if (!Number.isSafeInteger(lastSequence) || lastSequence < 0) throw makeError("invalid_argument");
    await negotiateCompatibility({}, { context });
    while (!terminal) {
      assertContextActive(context);
      const streamInput = { ...input, headers: { ...(input.headers || {}), ...(lastSequence === 0 ? {} : { "Last-Event-ID": String(lastSequence) }) } };
      let connection;
      try { connection = await rawRequest(operation, streamInput, { stream: true, context }); }
      catch (error) { if (input.signal?.aborted || now() >= context.deadline || reconnects >= maximumReconnects || !(error instanceof AgentFaiClientError) || !error.retryable) throw error; reconnects += 1; continue; }
      const serverLast = getHeader(connection.response, "agent-fai-last-sequence");
      if (serverLast === null || !/^(?:0|[1-9]\d{0,15})$/u.test(serverLast)) throw makeError("integrity_failed");
      const responseController = new AbortController(); let deadlineExpired = false;
      const onAbort = () => responseController.abort(input.signal.reason); input.signal?.addEventListener("abort", onAbort, { once: true });
      if (input.signal?.aborted) responseController.abort(input.signal.reason);
      const responseRemaining = context.deadline - now();
      const responseTimer = Number.isFinite(responseRemaining) ? setTimer(() => { deadlineExpired = true; responseController.abort(); }, Math.max(0, responseRemaining)) : null;
      let pendingTerminal = null;
      try {
        for await (const parsed of parseSse(connection.response.body, { ...input, signal: responseController.signal })) {
          const sequence = Number(parsed.id); const prior = accepted.get(sequence);
          if (pendingTerminal) throw makeError("integrity_failed");
          if (prior !== undefined) { if (prior.bytes !== parsed.bytes || prior.eventId !== parsed.event.eventId) throw makeError("integrity_failed"); continue; }
          if (sequence !== lastSequence + 1) throw makeError("integrity_failed");
          const event = parsed.event; const identity = `${event.sessionId}:${event.turnId}`;
          if (identity !== `${pathIdentity.sessionId}:${pathIdentity.turnId}` || event.requestId !== pathIdentity.requestId) throw makeError("integrity_failed");
          const priorEvent = eventIds.get(event.eventId);
          if (priorEvent !== undefined && priorEvent !== parsed.bytes) throw makeError("integrity_failed");
          if (priorEvent !== undefined) throw makeError("integrity_failed");
          eventIds.set(event.eventId, parsed.bytes); accepted.set(sequence, { bytes: parsed.bytes, eventId: event.eventId }); lastSequence = sequence;
          const isTerminal = event.terminal === true || TERMINAL_EVENT_TYPES.has(event.type);
          record({ operationId: operation.operationId, requestId: pathIdentity.requestId, attempts: connection.attempts, negotiatedVersion: compatibility?.negotiatedApiVersion, lastSequence: sequence, status: connection.response.status, routeTemplate: operation.path });
          if (isTerminal) pendingTerminal = event;
          else yield event;
        }
        if (Number(serverLast) !== lastSequence) throw makeError("integrity_failed");
        if (pendingTerminal) { terminal = true; yield pendingTerminal; }
      } catch (error) {
        if (input.signal?.aborted) throw makeError("cancelled");
        if (deadlineExpired || now() >= context.deadline) throw makeError("deadline_exceeded");
        if (!(error instanceof AgentFaiClientError) || !error.retryable || reconnects >= maximumReconnects) throw error;
      } finally {
        if (responseTimer) clearTimer(responseTimer); input.signal?.removeEventListener("abort", onAbort);
      }
      if (terminal) break;
      if (reconnects >= maximumReconnects) throw makeError("transport_failed");
      reconnects += 1;
    }
  }

  const client = { request, negotiateCompatibility, diagnostics: () => diagnostics.slice() };
  for (const operation of registry.operations) if (operation.friendlyName !== "negotiateCompatibility") client[operation.friendlyName] = (...args) => request(operation.friendlyName, normalizeMethodInput(operation, args));
  client.streamTurnEvents = (...args) => stream("streamTurnEvents", normalizeMethodInput(registry.byFriendlyName.listTurnEvents, args));
  client.streamJobEvents = (...args) => stream("streamJobEvents", normalizeMethodInput(registry.byFriendlyName.listJobEvents, args));
  return Object.freeze(client);
}

module.exports = { API_VERSION, REQUIRED_CAPABILITIES, createAgentFaiClient, normalizeBaseUrl, canonicalJson, compareSemver };