// @ts-check
"use strict";

const crypto = require("node:crypto");
const packageJson = require("../../package.json");
const { AgentFaiClientError, EXIT_BY_CODE, UUID } = require("./client-error.js");
const { awaitWithAbort } = require("./abort.js");
const { DEFAULT_AGENT_CONFIG, createConfigCoordinator } = require("./config-v2.js");
const { AgentFaiRenderError } = require("./event-reducer.js");
const { CLIENT_CAPABILITIES, PRODUCTION_ENDPOINT, parseHeadlessArgs } = require("./headless-host.js");
const { createLineQueue } = require("./line-queue.js");
const { canonicalJson, createAgentFaiClient } = require("./protocol-client.js");
const { createRenderer, renderToChannels, sanitizeHuman } = require("./renderers.js");
const { canonicalHttps } = require("./presentation.js");
const { createSessionMetadataStore } = require("./session-metadata-store.js");

const MODES = Object.freeze(["answer", "architecture", "plan", "review"]);
const TERMINAL_TYPES = new Set(["turn.completed", "turn.failed", "turn.cancelled"]);
const MAXIMUM_STEERING_ITEMS = 32;
const SECOND_SIGNAL_WINDOW_MS = 750;
const HELP = Object.freeze([
  "/status", "/mode [answer|architecture|plan|review]", "/authority", "/context", "/sources", "/tools", "/mcp",
  "/plan", "/review", "/artifacts", "/usage", "/session", "/resume <session-id>", "/compact", "/cancel", "/export [json|markdown]", "/help", "/exit",
]);

function parseInteractiveArgs(args) {
  if (!Array.isArray(args) || !args.every((entry) => typeof entry === "string")) throw new AgentFaiClientError("invalid_argument");
  let mode = "answer";
  let sessionId = null;
  const seen = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!["--mode", "--resume"].includes(token) || seen.has(token) || index + 1 >= args.length) throw new AgentFaiClientError("invalid_argument");
    seen.add(token);
    const value = args[++index];
    if (token === "--mode") {
      if (!MODES.includes(value)) throw new AgentFaiClientError("invalid_argument");
      mode = value;
    } else {
      if (!UUID.test(value)) throw new AgentFaiClientError("invalid_argument");
      sessionId = value;
    }
  }
  return Object.freeze({ mode, sessionId });
}

function normalizedError(error) {
  if (error instanceof AgentFaiClientError) return error;
  if (error instanceof AgentFaiRenderError) return new AgentFaiClientError("integrity_failed");
  return new AgentFaiClientError("internal");
}

function sessionMetadata(session, overrides = {}) {
  if (!session || typeof session !== "object" || !UUID.test(session.sessionId || "")) throw new AgentFaiClientError("integrity_failed");
  const value = {
    sessionId: session.sessionId,
    lastTurnId: overrides.lastTurnId === undefined ? session.lastTurnId ?? null : overrides.lastTurnId,
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: overrides.updatedAt || session.updatedAt,
    lastSequence: overrides.lastSequence ?? 0,
    semanticDigest: overrides.semanticDigest ?? null,
    organizationScopeId: session.organizationId ?? null,
    projectId: session.projectId ?? null,
  };
  if (overrides.preserveProgress === true) { delete value.lastSequence; delete value.semanticDigest; }
  if (typeof session.expiresAt === "string") value.expiresAt = session.expiresAt;
  return value;
}

function publicSession(session) {
  if (!session || typeof session !== "object" || !UUID.test(session.sessionId || "")) throw new AgentFaiClientError("integrity_failed");
  return {
    schemaVersion: session.schemaVersion,
    sessionId: session.sessionId,
    organizationId: session.organizationId ?? null,
    projectId: session.projectId ?? null,
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    expiresAt: session.expiresAt ?? null,
    surfaces: session.surfaces,
    policyVersion: session.policyVersion,
    retention: session.retention,
    lastTurnId: session.lastTurnId ?? null,
  };
}

function createProtocolRuntime(dependencies, config) {
  const env = dependencies.env || process.env;
  const clientOptions = dependencies.clientOptions || {};
  const clientFactory = dependencies.clientFactory || createAgentFaiClient;
  return {
    client: dependencies.protocolClient || clientFactory({ ...clientOptions, baseUrl: PRODUCTION_ENDPOINT, env, proxyDispatcherFactory: dependencies.proxyDispatcherFactory || clientOptions.proxyDispatcherFactory }),
    clientIdentity: { surface: "cli", version: packageJson.version, capabilities: [...CLIENT_CAPABILITIES] },
    idempotencyKeyFactory: dependencies.idempotencyKeyFactory || (() => crypto.randomUUID()),
    timeoutMs: config.agent.requestTimeoutMs,
    maxRetries: config.agent.reconnects,
  };
}

function parseSessionCommand(name, args) {
  if (!Array.isArray(args) || !args.every((entry) => typeof entry === "string")) throw new AgentFaiClientError("invalid_argument");
  if (name === "sessions list") {
    const result = { limit: 25, cursor: undefined };
    const seen = new Set();
    for (let index = 0; index < args.length; index += 1) {
      const token = args[index];
      if (!["--limit", "--cursor"].includes(token) || seen.has(token) || index + 1 >= args.length) throw new AgentFaiClientError("invalid_argument");
      seen.add(token); const value = args[++index];
      if (token === "--limit") { if (!/^(?:[1-9]|[1-9]\d|100)$/u.test(value)) throw new AgentFaiClientError("invalid_argument"); result.limit = Number(value); }
      else { if (value.length < 1 || value.length > 512 || /[\u0000-\u001f\u007f]/u.test(value)) throw new AgentFaiClientError("invalid_argument"); result.cursor = value; }
    }
    return result;
  }
  if (!["sessions show", "sessions export"].includes(name) || args.length < 1 || !UUID.test(args[0])) throw new AgentFaiClientError("invalid_argument");
  if (name === "sessions show") { if (args.length !== 1) throw new AgentFaiClientError("invalid_argument"); return { sessionId: args[0] }; }
  let format = "markdown";
  if (args.length === 3 && args[1] === "--format" && ["json", "markdown"].includes(args[2])) format = args[2];
  else if (args.length !== 1) throw new AgentFaiClientError("invalid_argument");
  return { sessionId: args[0], format };
}

async function executeSessionCommand(name, args, dependencies = {}) {
  try {
    const parsed = parseSessionCommand(name, args);
    const configCoordinator = dependencies.configCoordinator || createConfigCoordinator(dependencies.configOptions || {});
    const config = dependencies.config || await configCoordinator.read();
    const runtime = createProtocolRuntime(dependencies, config);
    if (name === "sessions list") {
      const page = await runtime.client.listSessions({ limit: parsed.limit, ...(parsed.cursor ? { cursor: parsed.cursor } : {}), timeoutMs: runtime.timeoutMs, maxRetries: runtime.maxRetries, signal: dependencies.signal });
      return { exitCode: 0, output: `${canonicalJson({ schemaVersion: "agent-fai-session-list.v1", items: page.items.map(publicSession), nextCursor: page.nextCursor })}\n`, error: "" };
    }
    if (name === "sessions show") {
      const session = await runtime.client.getSession(parsed.sessionId, { timeoutMs: runtime.timeoutMs, maxRetries: runtime.maxRetries, signal: dependencies.signal });
      if (session.sessionId !== parsed.sessionId) throw new AgentFaiClientError("integrity_failed");
      return { exitCode: 0, output: `${canonicalJson(publicSession(session))}\n`, error: "" };
    }
    const artifact = await runtime.client.exportSession(parsed.sessionId, { format: parsed.format }, { idempotencyKey: runtime.idempotencyKeyFactory(), timeoutMs: runtime.timeoutMs, maxRetries: runtime.maxRetries, signal: dependencies.signal });
    if (!artifact || artifact.sessionId !== parsed.sessionId || artifact.kind !== "export" || !UUID.test(artifact.artifactId || "")) throw new AgentFaiClientError("integrity_failed");
    const projection = { schemaVersion: artifact.schemaVersion, artifactId: artifact.artifactId, sessionId: artifact.sessionId, kind: artifact.kind, mediaType: artifact.mediaType, digest: artifact.digest, sizeBytes: artifact.sizeBytes, createdAt: artifact.createdAt, downloadAvailable: artifact.downloadUrl !== null, revoked: artifact.revoked };
    return { exitCode: 0, output: `${canonicalJson(projection)}\n`, error: "" };
  } catch (error) {
    const normalized = normalizedError(error);
    return { exitCode: normalized.exitCode, output: "", error: `Agent FAI error [${normalized.code}]: ${normalized.message}\n` };
  }
}

function createTurnProjection() {
  return { status: "idle", turnId: null, requestId: null, lastSequence: 0, sources: [], tools: [], artifacts: [], usage: [], diagnostics: [] };
}

function observeEvent(projection, event) {
  projection.status = TERMINAL_TYPES.has(event.type) ? event.type.slice("turn.".length) : "running";
  projection.turnId = event.turnId;
  projection.requestId = event.requestId;
  projection.lastSequence = event.sequence;
  if (event.type === "retrieval.source") { const href = canonicalHttps(event.data.href); if (href) projection.sources.push({ sourceId: event.data.sourceId, href, rank: event.data.rank }); }
  if (event.type.startsWith("tool.")) projection.tools.push({ type: event.type, toolName: event.data.toolName || null, toolCallId: event.data.toolCallId });
  if (event.type === "artifact.created") projection.artifacts.push({ artifactId: event.data.artifactId, digest: event.data.digest });
  if (event.type === "usage.receipt") projection.usage.push(event.data.receiptId);
  if (["warning", "limitation"].includes(event.type)) projection.diagnostics.push({ type: event.type, code: event.data.code });
}

function createInteractiveHost(dependencies = {}) {
  const input = dependencies.stdin || process.stdin;
  const stdout = dependencies.stdout || process.stdout;
  const stderr = dependencies.stderr || process.stderr;
  const signalEmitter = dependencies.signalEmitter || process;
  const now = dependencies.now || Date.now;
  const setTimer = dependencies.setTimeout || setTimeout;
  const clearTimer = dependencies.clearTimeout || clearTimeout;
  const forceExit = dependencies.forceExit || ((code) => process.exit(code));
  const env = dependencies.env || process.env;
  const idempotencyKeyFactory = dependencies.idempotencyKeyFactory || (() => crypto.randomUUID());

  async function run(args = []) {
    let parsed;
    try { parsed = parseInteractiveArgs(args); }
    catch (error) { const normalized = normalizedError(error); return { exitCode: normalized.exitCode, output: "", error: `Agent FAI error [${normalized.code}]: ${normalized.message}\n` }; }
    if (input.isTTY !== true || stderr.isTTY !== true) return { exitCode: 2, output: "", error: "Agent FAI interactive mode requires terminal stdin and stderr; use ask or run for redirected input.\n" };

    const savedRaw = typeof input.isRaw === "boolean" ? input.isRaw : null;
    const lifecycle = new AbortController();
    let active = null;
    let currentSession = null;
    let mode = parsed.mode;
    let exitCode = 0;
    let exiting = false;
    let fatal = null;
    let signalAt = -Infinity;
    let signalTimer = null;
    let restoreFlight = null;
    const steering = [];
    let latest = createTurnProjection();
    let writeChain = Promise.resolve();
    const outputController = new AbortController();
    const write = (projected) => {
      const operation = writeChain.catch(() => {}).then(() => renderToChannels(projected, { stdout, stderr, signal: outputController.signal }));
      writeChain = operation;
      return operation;
    };
    const status = (text) => write({ stdout: "", stderr: `${sanitizeHuman(text)}\n` });
    const prompt = () => exiting || active ? Promise.resolve() : write({ stdout: "", stderr: `Agent FAI [${mode}|observe]> ` });

    let config;
    let client;
    let metadataStore;
    const clientIdentity = { surface: "cli", version: packageJson.version, capabilities: [...CLIENT_CAPABILITIES] };

    const persist = async (session, overrides = {}) => {
      try { await metadataStore.upsert(sessionMetadata(session, overrides)); }
      catch { throw new AgentFaiClientError("integrity_failed"); }
    };
    const establishSession = async (sessionId = null) => {
      const options = { idempotencyKey: idempotencyKeyFactory(), timeoutMs: config.agent.requestTimeoutMs, maxRetries: config.agent.reconnects, signal: lifecycle.signal };
      const request = sessionId
        ? client.resumeSession(sessionId, { client: clientIdentity }, options)
        : client.createSession({ client: clientIdentity, retentionProfileId: "cli-default" }, options);
      const session = await awaitWithAbort(request, lifecycle.signal);
      if (!session || !UUID.test(session.sessionId || "") || (sessionId && session.sessionId !== sessionId) || session.status !== "active") throw new AgentFaiClientError("integrity_failed");
      await persist(session, sessionId ? { preserveProgress: true } : {});
      currentSession = session;
      latest = createTurnProjection();
      await status(`${sessionId ? "Resumed" : "Started"} session ${session.sessionId}.`);
    };

    const cancelRemote = async (turn, reason) => {
      if (!turn || !UUID.test(turn.turnId || "") || turn.remoteCancellationStarted) return;
      turn.remoteCancellationStarted = true;
      const cancelController = new AbortController();
      const timer = setTimer(() => cancelController.abort(), 1000); timer.unref?.();
      try { await client.cancelTurn(currentSession.sessionId, turn.turnId, { reason }, { idempotencyKey: idempotencyKeyFactory(), signal: cancelController.signal, timeoutMs: 1000, maxRetries: 0 }); }
      catch { /* cancellation acknowledgement is best effort after local abort */ }
      finally { clearTimer(timer); }
    };
    const cancelActive = async (reason = "user") => {
      const turn = active;
      if (!turn) { await status("No active turn."); return; }
      if (!turn.controller.signal.aborted) turn.controller.abort(new AgentFaiClientError("cancelled"));
      await cancelRemote(turn, reason);
    };

    const flushProjection = () => { latest = createTurnProjection(); };
    const listProjection = async (kind) => {
      const values = latest[kind];
      if (!Array.isArray(values) || values.length === 0) { await status(`No ${kind} in the latest turn.`); return; }
      for (const value of values) await status(typeof value === "string" ? value : JSON.stringify(value));
    };
    const exportCurrent = async (format = "markdown") => {
      if (!currentSession || active) { await status(active ? "Export is unavailable while a turn is active." : "No active session."); return; }
      if (!new Set(["json", "markdown"]).has(format)) { await status("Export format must be json or markdown."); return; }
      const artifact = await client.exportSession(currentSession.sessionId, { format }, { idempotencyKey: idempotencyKeyFactory(), timeoutMs: config.agent.requestTimeoutMs, maxRetries: config.agent.reconnects, signal: lifecycle.signal });
      if (!artifact || artifact.sessionId !== currentSession.sessionId || artifact.kind !== "export" || !UUID.test(artifact.artifactId || "")) throw new AgentFaiClientError("integrity_failed");
      await status(`Export artifact ${artifact.artifactId} ${artifact.digest} download=${artifact.downloadUrl ? "available" : "unavailable"}`);
    };

    const resumeInline = async (sessionId) => {
      if (active || steering.length > 0) { await status("Resume requires an idle session with an empty steering queue."); return; }
      if (!UUID.test(sessionId || "")) { await status("Resume requires a canonical session UUID."); return; }
      await establishSession(sessionId);
    };

    const slash = async (line) => {
      const tokens = line.trim().split(/\s+/u);
      const command = tokens[0].toLowerCase();
      const argument = tokens[1];
      const noArgument = new Set(["/", "/help", "/exit", "/cancel", "/status", "/authority", "/plan", "/review", "/context", "/tools", "/mcp", "/sources", "/artifacts", "/usage", "/session", "/compact"]);
      const optionalArgument = new Set(["/mode", "/export"]);
      const validArity = noArgument.has(command) ? tokens.length === 1 : optionalArgument.has(command) ? tokens.length <= 2 : command === "/resume" ? tokens.length === 2 : tokens.length <= 2;
      if (!validArity || /[\u0000-\u001f\u007f]/u.test(line)) { await status("Invalid slash command."); return; }
      if (command === "/" || command === "/help") { for (const item of HELP) await status(item); return; }
      if (command === "/exit") { exiting = true; exitCode = 0; if (active) await cancelActive("user"); lineQueue?.close(); return; }
      if (command === "/cancel") { await cancelActive("user"); return; }
      if (command === "/status") { await status(`session=${currentSession?.sessionId || "none"} mode=${mode} authority=observe turn=${latest.status} queued=${steering.length}`); return; }
      if (command === "/authority") { await status("Execution authority: observe. Workflow mode never elevates authority."); return; }
      if (command === "/mode") {
        if (argument === undefined) { await status(`Mode: ${mode}.`); return; }
        if (!MODES.includes(argument)) { await status("Mode must be answer, architecture, plan, or review; operate remains unavailable."); return; }
        mode = argument; await status(`Mode changed to ${mode}.`); return;
      }
      if (command === "/plan") { mode = "plan"; await status("Mode changed to plan."); return; }
      if (command === "/review") { mode = "review"; await status("Mode changed to review."); return; }
      if (command === "/context") { await status("Repository context is unavailable until trusted-root and context-manifest tasks are complete."); return; }
      if (command === "/tools") { await listProjection("tools"); await status("Local tool invocation is unavailable in T019."); return; }
      if (command === "/mcp") { await status("MCP discovery and invocation are unavailable in T019."); return; }
      if (command === "/sources") { await listProjection("sources"); return; }
      if (command === "/artifacts") { await listProjection("artifacts"); return; }
      if (command === "/usage") { await listProjection("usage"); return; }
      if (command === "/session") { await status(currentSession ? `Session ${currentSession.sessionId} status=${currentSession.status} lastTurn=${latest.turnId || "none"} sequence=${latest.lastSequence}` : "No active session."); return; }
      if (command === "/resume") { await resumeInline(argument); return; }
      if (command === "/compact") { flushProjection(); await status("Local display metadata compacted; remote session context is unchanged."); return; }
      if (command === "/export") { await exportCurrent(argument || "markdown"); return; }
      await status(`Unknown slash command ${command}. Use /help.`);
    };

    const launchNext = () => {
      if (active || exiting || fatal || steering.length === 0) return;
      const queued = steering.shift();
      const controller = new AbortController();
      const turnState = { controller, turnId: null, remoteCancellationStarted: false, deadlineExpired: false, promise: null };
      active = turnState;
      turnState.promise = (async () => {
        const promptValue = parseHeadlessArgs("ask", ["--", queued.content]).prompt;
        const deadlineAt = now() + config.agent.requestTimeoutMs;
        const deadlineTimer = setTimer(() => { turnState.deadlineExpired = true; if (!controller.signal.aborted) controller.abort(new AgentFaiClientError("deadline_exceeded")); }, config.agent.requestTimeoutMs); deadlineTimer.unref?.();
        const remaining = () => {
          const value = deadlineAt - now();
          if (turnState.deadlineExpired || value <= 0) throw new AgentFaiClientError("deadline_exceeded");
          return Math.max(1, Math.ceil(value));
        };
        try {
        const turn = await client.createTurn(currentSession.sessionId, {
          intent: queued.intent,
          requestedAuthority: "observe",
          client: clientIdentity,
          input: { kind: "user-text", content: promptValue },
          contextManifestRef: null,
          budgets: { deadlineMs: config.agent.requestTimeoutMs, maxOutputTokens: 4096, maxEstimatedCostUsd: null },
        }, { idempotencyKey: idempotencyKeyFactory(), signal: controller.signal, timeoutMs: remaining(), maxRetries: config.agent.reconnects });
        if (controller.signal.aborted) throw turnState.deadlineExpired ? new AgentFaiClientError("deadline_exceeded") : new AgentFaiClientError("cancelled");
        if (turn.sessionId !== currentSession.sessionId || !UUID.test(turn.turnId || "") || !UUID.test(turn.requestId || "")) throw new AgentFaiClientError("integrity_failed");
        turnState.turnId = turn.turnId;
        if (controller.signal.aborted) throw turnState.deadlineExpired ? new AgentFaiClientError("deadline_exceeded") : new AgentFaiClientError("cancelled");
        latest = createTurnProjection();
        const renderer = createRenderer("tty", { color: config.agent.color !== "never", unicode: config.agent.unicode !== "never", env, isTTY: stdout.isTTY === true, columns: stdout.columns });
        let terminal = null;
        for await (const event of client.streamTurnEvents(currentSession.sessionId, turn.turnId, { identity: { requestId: turn.requestId }, signal: controller.signal, timeoutMs: remaining(), maxReconnects: config.agent.reconnects })) {
          if (controller.signal.aborted) throw turnState.deadlineExpired ? new AgentFaiClientError("deadline_exceeded") : new AgentFaiClientError("cancelled");
          const projected = renderer.renderEvent(event);
          observeEvent(latest, event);
          terminal = event;
          await write(projected);
        }
        await write(renderer.finalize());
        if (!terminal || !TERMINAL_TYPES.has(terminal.type)) throw new AgentFaiClientError("integrity_failed");
        await persist(currentSession, { lastTurnId: turn.turnId, lastSequence: latest.lastSequence, updatedAt: terminal.occurredAt });
        if (terminal.type === "turn.failed") await status("Turn failed; the server supplied an opaque error reference.");
        else if (terminal.type === "turn.cancelled") await status(`Turn cancelled (${terminal.data.reason}).`);
        } finally { clearTimer(deadlineTimer); }
      })().catch(async (error) => {
        const normalized = normalizedError(error);
        if (controller.signal.aborted || normalized.code === "cancelled" || normalized.code === "deadline_exceeded") await cancelRemote(turnState, turnState.deadlineExpired ? "deadline" : "user");
        try { await status(`Turn error [${normalized.code}]: ${normalized.message}`); } catch { /* output failure is handled by the terminal lifecycle below */ }
        if (["authentication_required", "authorization_denied", "policy_denied", "integrity_failed", "internal"].includes(normalized.code)) { fatal = normalized; exiting = true; exitCode = normalized.exitCode; lineQueue?.close(); }
      }).finally(async () => {
        active = null;
        if (exiting) return;
        if (steering.length > 0) launchNext();
        else await prompt();
      }).catch((error) => {
        const normalized = normalizedError(error);
        fatal = normalized; exiting = true; exitCode = normalized.exitCode; lineQueue?.close();
      });
    };

    const handleLine = async (line) => {
      if (exiting) return;
      if (line.startsWith("/")) { await slash(line); if (!exiting && !active) await prompt(); return; }
      if (line.length === 0) { if (!active) await prompt(); return; }
      if (steering.length >= MAXIMUM_STEERING_ITEMS) { await status("Steering queue is full; cancel or wait for the active turn."); return; }
      steering.push({ content: line, intent: mode });
      if (active) await status(`Queued steering input (${steering.length}).`);
      launchNext();
    };

    let lineQueue;
    const restore = (force = false) => {
      if (restoreFlight) return restoreFlight;
      restoreFlight = (async () => {
        lineQueue?.close();
        lifecycle.abort(new AgentFaiClientError("cancelled"));
        if (signalTimer) clearTimer(signalTimer);
        signalEmitter?.removeListener?.("SIGINT", onSignal);
        signalEmitter?.removeListener?.("SIGTERM", onTerminate);
        if (savedRaw !== null && typeof input.setRawMode === "function" && input.isRaw !== savedRaw) { try { input.setRawMode(savedRaw); } catch { /* terminal is already closing */ } }
        if (force) outputController.abort(new AgentFaiClientError("cancelled"));
        let drainTimer;
        const boundedDrain = new Promise((resolve) => { drainTimer = setTimer(resolve, force ? 25 : 250); drainTimer.unref?.(); });
        await Promise.race([writeChain.catch(() => {}), boundedDrain]);
        clearTimer(drainTimer);
        outputController.abort(new AgentFaiClientError("cancelled"));
      })();
      return restoreFlight;
    };
    const onAnySignal = (reason) => {
      const timestamp = now();
      if (timestamp - signalAt <= SECOND_SIGNAL_WINDOW_MS) { exiting = true; exitCode = 130; restore(true).finally(() => forceExit(130)); return; }
      signalAt = timestamp;
      if (signalTimer) clearTimer(signalTimer);
      signalTimer = setTimer(() => { signalAt = -Infinity; }, SECOND_SIGNAL_WINDOW_MS); signalTimer.unref?.();
      if (active) cancelActive(reason).catch(() => {});
      else { exiting = true; exitCode = 130; lifecycle.abort(new AgentFaiClientError("cancelled")); outputController.abort(new AgentFaiClientError("cancelled")); lineQueue?.close(); }
    };
    const onSignal = () => onAnySignal("user");
    const onTerminate = () => onAnySignal("shutdown");
    signalEmitter?.on?.("SIGINT", onSignal);
    signalEmitter?.on?.("SIGTERM", onTerminate);

    try {
      const configCoordinator = dependencies.configCoordinator || createConfigCoordinator(dependencies.configOptions || {});
      const configTimer = setTimer(() => lifecycle.abort(new AgentFaiClientError("deadline_exceeded")), 30000); configTimer.unref?.();
      try { config = dependencies.config || await awaitWithAbort(Promise.resolve().then(() => configCoordinator.read()), lifecycle.signal); }
      finally { clearTimer(configTimer); }
      const runtime = createProtocolRuntime(dependencies, config);
      client = runtime.client;
      metadataStore = dependencies.sessionMetadataStore || createSessionMetadataStore({ ...(dependencies.sessionMetadataOptions || {}), retentionDays: config.agent.retentionDays });
      await establishSession(parsed.sessionId);
      lineQueue = dependencies.lineQueue || createLineQueue(input, { signal: lifecycle.signal });
      await status(`Interactive line mode. Mode=${mode}; authority=observe. Use /help for commands.`);
      await prompt();
      for await (const line of lineQueue) await handleLine(line);
      exiting = true;
      if (active) { const turn = active; await cancelActive("shutdown"); await turn.promise; }
      while (active) await active.promise;
      await writeChain;
    } catch (error) {
      const normalized = normalizedError(error);
      if (!exiting) { fatal = normalized; exitCode = normalized.exitCode; try { await status(`Agent FAI error [${normalized.code}]: ${normalized.message}`); } catch { /* terminal is unavailable */ } }
    } finally {
      await restore();
    }
    return { exitCode: fatal ? fatal.exitCode : exitCode, output: "", error: "" };
  }

  return Object.freeze({ run });
}

async function executeInteractive(args, dependencies = {}) { return createInteractiveHost(dependencies).run(args); }

module.exports = { HELP, MAXIMUM_STEERING_ITEMS, MODES, SECOND_SIGNAL_WINDOW_MS, createInteractiveHost, executeInteractive, executeSessionCommand, observeEvent, parseInteractiveArgs, parseSessionCommand, publicSession, sessionMetadata };