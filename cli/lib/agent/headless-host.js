// @ts-check
"use strict";

const crypto = require("node:crypto");
const { TextDecoder } = require("node:util");
const packageJson = require("../../package.json");
const { AgentFaiClientError, EXIT_BY_CODE, UUID } = require("./client-error.js");
const { DEFAULT_AGENT_CONFIG, createConfigCoordinator } = require("./config-v2.js");
const { AgentFaiRenderError } = require("./event-reducer.js");
const { createAgentFaiClient } = require("./protocol-client.js");
const { createRenderer } = require("./renderers.js");
const { awaitWithAbort } = require("./abort.js");

const PRODUCTION_ENDPOINT = "https://frootai.dev";
const CLIENT_CAPABILITIES = Object.freeze(["events.v1", "citations", "mermaid", "ascii", "artifacts", "usage", "cancellation", "replay"]);
const FORMATS = new Set(["text", "markdown", "json", "jsonl", "tty"]);
const MAXIMUM_PROMPT_CHARACTERS = 8000;
const MAXIMUM_STDIN_BYTES = 32000;
const MAXIMUM_DEADLINE_MS = 300000;
const MINIMUM_DEADLINE_MS = 100;

const USAGE_MESSAGES = Object.freeze({
  conflicting_input: "Choose exactly one of --prompt or --stdin.",
  conflicting_output: "Choose only one of --quiet or --verbose.",
  conflicting_unicode: "Choose only one of --unicode or --no-unicode.",
  duplicate_option: "An Agent FAI option was supplied more than once.",
  invalid_deadline: "The deadline must be an integer from 100 through 300000 milliseconds.",
  invalid_format: "The format must be text, markdown, json, jsonl, or tty.",
  invalid_prompt: "The prompt must contain 1 through 8000 valid Unicode characters without NUL bytes.",
  missing_input: "A prompt is required; use ask <prompt>, run --prompt <prompt>, or run --stdin.",
  stdin_failed: "Agent FAI could not read stdin.",
  stdin_interactive: "--stdin requires redirected input and never reads interactively.",
  stdin_too_large: "Stdin exceeds the 32000-byte input limit.",
  unknown_option: "The Agent FAI option is not supported by this command.",
  unexpected_argument: "The Agent FAI command contains an unexpected argument.",
});

class AgentFaiUsageError extends Error {
  constructor(code) {
    super(USAGE_MESSAGES[code] || USAGE_MESSAGES.unknown_option);
    this.name = "AgentFaiUsageError";
    this.code = code;
    this.exitCode = 2;
  }
}

function validUnicode(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}

function validatePrompt(value) {
  if (typeof value !== "string" || value.includes("\0") || !validUnicode(value)) throw new AgentFaiUsageError("invalid_prompt");
  const length = [...value].length;
  if (length < 1 || length > MAXIMUM_PROMPT_CHARACTERS || Buffer.byteLength(value, "utf8") > MAXIMUM_STDIN_BYTES) throw new AgentFaiUsageError("invalid_prompt");
  return value;
}

function parseHeadlessArgs(command, args) {
  if (!new Set(["ask", "run"]).has(command) || !Array.isArray(args) || !args.every((entry) => typeof entry === "string")) throw new AgentFaiUsageError("unexpected_argument");
  const options = { prompt: null, stdin: false, format: null, deadlineMs: null, quiet: false, verbose: false, noColor: false, unicode: null };
  const seen = new Set();
  const positional = [];
  let positionalOnly = false;
  const once = (name) => { if (seen.has(name)) throw new AgentFaiUsageError("duplicate_option"); seen.add(name); };
  const valueAfter = (index, name) => {
    if (index + 1 >= args.length || (name !== "prompt" && args[index + 1].startsWith("--"))) throw new AgentFaiUsageError(name === "format" ? "invalid_format" : name === "deadline" ? "invalid_deadline" : "missing_input");
    return args[index + 1];
  };
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (positionalOnly) { positional.push(token); continue; }
    if (token === "--") { positionalOnly = true; continue; }
    if (token === "--quiet" || token === "-q") { once("quiet"); options.quiet = true; continue; }
    if (token === "--verbose" || token === "-v") { once("verbose"); options.verbose = true; continue; }
    if (token === "--no-color") { once("noColor"); options.noColor = true; continue; }
    if (token === "--unicode") { once("unicode"); options.unicode = true; continue; }
    if (token === "--no-unicode") { once("noUnicode"); options.unicode = false; continue; }
    if (token === "--stdin") { once("stdin"); options.stdin = true; continue; }
    if (token === "--prompt") { once("prompt"); options.prompt = valueAfter(index, "prompt"); index += 1; continue; }
    if (token === "--format") {
      once("format"); const value = valueAfter(index, "format"); index += 1;
      if (!FORMATS.has(value)) throw new AgentFaiUsageError("invalid_format");
      options.format = value; continue;
    }
    if (token === "--deadline") {
      once("deadline"); const value = valueAfter(index, "deadline"); index += 1;
      if (!/^(?:0|[1-9]\d*)$/u.test(value)) throw new AgentFaiUsageError("invalid_deadline");
      options.deadlineMs = Number(value);
      if (!Number.isSafeInteger(options.deadlineMs) || options.deadlineMs < MINIMUM_DEADLINE_MS || options.deadlineMs > MAXIMUM_DEADLINE_MS) throw new AgentFaiUsageError("invalid_deadline");
      continue;
    }
    if (token.startsWith("-")) throw new AgentFaiUsageError("unknown_option");
    positional.push(token);
  }
  if (options.quiet && options.verbose) throw new AgentFaiUsageError("conflicting_output");
  if (seen.has("unicode") && seen.has("noUnicode")) throw new AgentFaiUsageError("conflicting_unicode");
  if (command === "ask") {
    if (options.stdin || options.prompt !== null) throw new AgentFaiUsageError("unexpected_argument");
    if (positional.length === 0) throw new AgentFaiUsageError("missing_input");
    options.prompt = validatePrompt(positional.join(" "));
  } else {
    if (positional.length > 0) throw new AgentFaiUsageError("unexpected_argument");
    if (options.stdin && options.prompt !== null) throw new AgentFaiUsageError("conflicting_input");
    if (!options.stdin && options.prompt === null) throw new AgentFaiUsageError("missing_input");
    if (options.prompt !== null) options.prompt = validatePrompt(options.prompt);
  }
  return Object.freeze(options);
}

function readBoundedStdin(stream, signal) {
  if (!stream || typeof stream.on !== "function" || typeof stream.removeListener !== "function") return Promise.reject(new AgentFaiUsageError("stdin_failed"));
  if (stream.isTTY === true) return Promise.reject(new AgentFaiUsageError("stdin_interactive"));
  if (stream.readableEnded === true) return Promise.reject(new AgentFaiUsageError("invalid_prompt"));
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    let settled = false;
    const cleanup = () => {
      stream.removeListener("data", onData); stream.removeListener("end", onEnd); stream.removeListener("error", onError); stream.removeListener("close", onClose);
      signal?.removeEventListener("abort", onAbort);
    };
    const finish = (callback, value) => { if (settled) return; settled = true; cleanup(); callback(value); };
    const onData = (chunk) => {
      const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8");
      bytes += value.length;
      if (bytes > MAXIMUM_STDIN_BYTES) { stream.pause?.(); finish(reject, new AgentFaiUsageError("stdin_too_large")); return; }
      chunks.push(value);
    };
    const onEnd = () => {
      let text;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)); } catch { finish(reject, new AgentFaiUsageError("invalid_prompt")); return; }
      try { finish(resolve, validatePrompt(text)); } catch (error) { finish(reject, error); }
    };
    const onError = () => finish(reject, new AgentFaiUsageError("stdin_failed"));
    const onClose = () => { if (!stream.readableEnded) finish(reject, new AgentFaiUsageError("stdin_failed")); };
    const onAbort = () => finish(reject, new AgentFaiClientError("cancelled"));
    stream.on("data", onData); stream.once("end", onEnd); stream.once("error", onError); stream.once("close", onClose);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
    else stream.resume?.();
  });
}

function safeIdentity(value, key) {
  if (!value || typeof value !== "object" || !UUID.test(value[key] || "")) throw new AgentFaiClientError("integrity_failed");
  return value[key];
}

function terminalExit(event) {
  if (event?.type === "turn.completed") return 0;
  if (event?.type === "turn.cancelled") return event.data?.reason === "deadline" ? EXIT_BY_CODE.deadline_exceeded : EXIT_BY_CODE.cancelled;
  if (event?.type === "turn.failed") return EXIT_BY_CODE.internal;
  throw new AgentFaiClientError("integrity_failed");
}

function errorResult(error, options = {}) {
  const deadlineExpired = options.deadlineExpired === true;
  const normalized = deadlineExpired ? new AgentFaiClientError("deadline_exceeded") : error instanceof AgentFaiRenderError ? new AgentFaiClientError("integrity_failed") : error instanceof AgentFaiUsageError || error instanceof AgentFaiClientError ? error : new AgentFaiClientError("internal");
  const code = normalized instanceof AgentFaiUsageError ? "invalid_argument" : normalized.code;
  let diagnostic = `Agent FAI error [${code}]: ${normalized.message}`;
  if (options.verbose && normalized instanceof AgentFaiClientError) diagnostic += ` requestId=${normalized.requestId} errorId=${normalized.errorId}`;
  return { exitCode: normalized.exitCode, output: options.output || "", error: `${diagnostic}\n` };
}

async function executeHeadless(command, args, dependencies = {}) {
  let parsed;
  try { parsed = parseHeadlessArgs(command, args); } catch (error) { return errorResult(error); }
  const now = dependencies.now || Date.now;
  const setTimer = dependencies.setTimeout || setTimeout;
  const clearTimer = dependencies.clearTimeout || clearTimeout;
  const signalEmitter = dependencies.signalEmitter || process;
  const stdin = dependencies.stdin || process.stdin;
  const env = dependencies.env || process.env;
  const controller = new AbortController();
  const invocationStarted = now();
  let deadlineExpired = false;
  let sessionId = null;
  let turnId = null;
  let client = null;
  let output = "";
  let errorOutput = "";
  const abortForUser = () => { if (!controller.signal.aborted) controller.abort(new AgentFaiClientError("cancelled")); };
  const externalAbort = () => abortForUser();
  const onSignal = () => abortForUser();
  dependencies.signal?.addEventListener("abort", externalAbort, { once: true });
  if (dependencies.signal?.aborted) externalAbort();
  signalEmitter?.once?.("SIGINT", onSignal); signalEmitter?.once?.("SIGTERM", onSignal);
  let deadlineTimer = null;
  try {
    const assertActive = () => { if (controller.signal.aborted) throw new AgentFaiClientError("cancelled"); };
    assertActive();
    let deadlineMs = parsed.deadlineMs ?? DEFAULT_AGENT_CONFIG.requestTimeoutMs;
    let deadlineAt = invocationStarted + deadlineMs;
    const armDeadline = () => {
      if (deadlineTimer) clearTimer(deadlineTimer);
      const delay = deadlineAt - now();
      if (delay <= 0) throw new AgentFaiClientError("deadline_exceeded");
      deadlineTimer = setTimer(() => { deadlineExpired = true; if (!controller.signal.aborted) controller.abort(new AgentFaiClientError("deadline_exceeded")); }, delay);
      deadlineTimer.unref?.();
    };
    armDeadline();
    const configCoordinator = dependencies.configCoordinator || createConfigCoordinator(dependencies.configOptions || {});
    const config = dependencies.config || await awaitWithAbort(Promise.resolve().then(() => configCoordinator.read()), controller.signal);
    assertActive();
    deadlineMs = parsed.deadlineMs ?? config.agent.requestTimeoutMs;
    deadlineAt = invocationStarted + deadlineMs;
    armDeadline();
    const remaining = () => {
      const value = deadlineAt - now();
      if (deadlineExpired || value <= 0) throw new AgentFaiClientError("deadline_exceeded");
      return Math.max(1, Math.ceil(value));
    };
    const prompt = parsed.stdin ? await readBoundedStdin(stdin, controller.signal) : parsed.prompt;
    assertActive();
    const format = parsed.format || config.agent.defaultFormat;
    const color = !parsed.noColor && config.agent.color !== "never";
    const unicode = parsed.unicode === null ? config.agent.unicode !== "never" : parsed.unicode;
    const renderer = createRenderer(format, { color, unicode, env, isTTY: dependencies.stdout?.isTTY === true, columns: dependencies.stdout?.columns });
    const clientOptions = dependencies.clientOptions || {};
    const clientFactory = dependencies.clientFactory || createAgentFaiClient;
    client = dependencies.protocolClient || clientFactory({ ...clientOptions, baseUrl: PRODUCTION_ENDPOINT, env, proxyDispatcherFactory: dependencies.proxyDispatcherFactory || clientOptions.proxyDispatcherFactory });
    const clientIdentity = { surface: "cli", version: packageJson.version, capabilities: [...CLIENT_CAPABILITIES] };
    const idempotencyKeyFactory = dependencies.idempotencyKeyFactory || (() => crypto.randomUUID());
    const reconnects = config.agent.reconnects;
    const session = await client.createSession({ client: clientIdentity, retentionProfileId: "cli-default" }, { idempotencyKey: idempotencyKeyFactory(), signal: controller.signal, timeoutMs: remaining(), maxRetries: reconnects });
    assertActive();
    sessionId = safeIdentity(session, "sessionId");
    const turn = await client.createTurn(sessionId, {
      intent: "answer",
      requestedAuthority: "observe",
      client: clientIdentity,
      input: { kind: "user-text", content: prompt },
      contextManifestRef: null,
      budgets: { deadlineMs, maxOutputTokens: 4096, maxEstimatedCostUsd: null },
    }, { idempotencyKey: idempotencyKeyFactory(), signal: controller.signal, timeoutMs: remaining(), maxRetries: reconnects });
    assertActive();
    if (safeIdentity(turn, "sessionId") !== sessionId) throw new AgentFaiClientError("integrity_failed");
    turnId = safeIdentity(turn, "turnId");
    const requestId = safeIdentity(turn, "requestId");
    let terminal = null;
    for await (const event of client.streamTurnEvents(sessionId, turnId, { identity: { requestId }, signal: controller.signal, timeoutMs: remaining(), maxReconnects: reconnects })) {
      terminal = event;
      const projected = renderer.renderEvent(event);
      output += projected.stdout;
      if (!parsed.quiet) errorOutput += projected.stderr;
    }
    const final = renderer.finalize();
    output += final.stdout;
    if (!parsed.quiet) errorOutput += final.stderr;
    const exitCode = terminalExit(terminal);
    if (parsed.verbose) errorOutput += `Agent FAI diagnostic: requestId=${requestId} sessionId=${sessionId} turnId=${turnId} exitCode=${exitCode}\n`;
    return { exitCode, output, error: errorOutput };
  } catch (error) {
    if (client && sessionId && turnId && controller.signal.aborted) {
      const cancelController = new AbortController();
      const cancelTimer = setTimer(() => cancelController.abort(new AgentFaiClientError("cancelled")), 1000);
      cancelTimer.unref?.();
      try {
        await awaitWithAbort(Promise.resolve().then(() => client.cancelTurn(sessionId, turnId, { reason: deadlineExpired ? "deadline" : "user" }, { idempotencyKey: (dependencies.idempotencyKeyFactory || (() => crypto.randomUUID()))(), signal: cancelController.signal, timeoutMs: 1000, maxRetries: 0 })), cancelController.signal);
      } catch { /* cancellation remains best effort after local termination */ }
      finally { clearTimer(cancelTimer); }
    }
    const result = errorResult(error, { deadlineExpired, verbose: parsed.verbose, output });
    return { ...result, error: errorOutput + result.error };
  } finally {
    if (deadlineTimer) clearTimer(deadlineTimer);
    dependencies.signal?.removeEventListener("abort", externalAbort);
    signalEmitter?.removeListener?.("SIGINT", onSignal); signalEmitter?.removeListener?.("SIGTERM", onSignal);
  }
}

function createHeadlessHost(dependencies = {}) {
  return Object.freeze({ execute: (command, args) => executeHeadless(command, args, dependencies) });
}

module.exports = { AgentFaiUsageError, CLIENT_CAPABILITIES, MAXIMUM_DEADLINE_MS, MAXIMUM_PROMPT_CHARACTERS, MAXIMUM_STDIN_BYTES, MINIMUM_DEADLINE_MS, PRODUCTION_ENDPOINT, createHeadlessHost, executeHeadless, parseHeadlessArgs, readBoundedStdin };