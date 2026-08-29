// @ts-check
"use strict";

const { AgentFaiRenderError, createEventReducer } = require("./event-reducer.js");
const { canonicalJson } = require("./semantic-runtime.generated.js");
const { TerminalSanitizer, canonicalHttps, orderedUnique, sanitizeHuman, terminalStatus, wrapLine } = require("./presentation.js");
const { validateRenderResult } = require("./render-result-validator.js");

const FORMATS = Object.freeze(["text", "markdown", "json", "jsonl", "tty"]);
const EMPTY = Object.freeze({ stdout: "", stderr: "" });

function fragments(stdout = "", stderr = "") {
  return Object.freeze({ stdout, stderr });
}

function markdownLabel(value) {
  return sanitizeHuman(value).replace(/\s+/gu, " ").trim()
    .replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;")
    .replace(/\\/gu, "&#92;").replace(/\[/gu, "&#91;").replace(/\]/gu, "&#93;")
    .replace(/\(/gu, "&#40;").replace(/\)/gu, "&#41;").replace(/!/gu, "&#33;").replace(/:/gu, "&#58;");
}

function safePresentation(result) {
  const sources = orderedUnique(result.presentation.sources, (item) => `${item.sourceId}\0${item.href}`, (left, right) => left.rank - right.rank || left.sourceId.localeCompare(right.sourceId))
    .map((item) => ({ sourceId: sanitizeHuman(item.sourceId), category: sanitizeHuman(item.category), href: canonicalHttps(item.href), rank: item.rank }))
    .filter((item) => item.href !== null);
  return {
    content: sanitizeHuman(result.presentation.content),
    sources,
    artifacts: orderedUnique(result.presentation.artifacts, (item) => item.artifactId, (left, right) => left.artifactId.localeCompare(right.artifactId)),
    evidence: orderedUnique(result.presentation.evidence, (item) => item.evidenceId, (left, right) => left.evidenceId.localeCompare(right.evidenceId)),
    usage: [...new Set(result.presentation.usage)],
    diagnostics: orderedUnique(result.presentation.diagnostics, (item) => `${item.type}\0${item.code}\0${item.messageCode}`)
      .map((item) => ({ type: item.type, code: sanitizeHuman(item.code), messageCode: sanitizeHuman(item.messageCode) })),
  };
}

function fallback(status) {
  if (status === "completed") return "Agent FAI completed without response content.";
  if (status === "cancelled") return "Agent FAI request cancelled.";
  return "Agent FAI request failed.";
}

function finalDocument(result) {
  const status = terminalStatus(result);
  if (status === "incomplete") throw new AgentFaiRenderError(["render-result-incomplete"]);
  const presentation = safePresentation(result);
  const document = {
    schemaVersion: "agent-fai-render-result.v1",
    status,
    identity: structuredClone(result.state.identity),
    content: presentation.content,
    sources: presentation.sources,
    artifacts: presentation.artifacts,
    evidence: presentation.evidence,
    usage: presentation.usage,
    diagnostics: presentation.diagnostics,
    semanticDigest: result.semanticDigest,
    delivery: structuredClone(result.delivery),
  };
  const validation = validateRenderResult(document);
  if (!validation.valid) throw new AgentFaiRenderError(validation.errors.map((entry) => `render-result-${entry}`));
  return document;
}

function renderText(result) {
  const document = finalDocument(result);
  return `${document.content || fallback(document.status)}\n`;
}

function renderMarkdown(result) {
  const document = finalDocument(result);
  const lines = [document.content || fallback(document.status)];
  if (document.sources.length) {
    lines.push("", "## Sources");
    for (const source of document.sources) lines.push(`- [${markdownLabel(source.sourceId)}](<${source.href}>)`);
  }
  if (document.artifacts.length) {
    lines.push("", "## Artifacts");
    for (const artifact of document.artifacts) lines.push(`- \`${artifact.artifactId}\` (\`${artifact.digest}\`)`);
  }
  if (document.evidence.length) {
    lines.push("", "## Evidence");
    for (const evidence of document.evidence) lines.push(`- \`${evidence.evidenceId}\` (\`${evidence.digest}\`)`);
  }
  if (document.usage.length) {
    lines.push("", "## Usage");
    for (const receiptId of document.usage) lines.push(`- \`${receiptId}\``);
  }
  return `${lines.join("\n").replace(/\n*$/u, "")}\n`;
}

function ttyProjection(event, options, sanitizer) {
  const unicode = options.unicode !== false;
  const prefix = unicode ? "●" : "[status]";
  const sourcePrefix = unicode ? "↳" : "[source]";
  const warningPrefix = unicode ? "!" : "[warning]";
  const status = (text, kind = "status") => {
    const label = kind === "source" ? sourcePrefix : kind === "warning" ? warningPrefix : prefix;
    const plain = `${label} ${text}`;
    const lines = wrapLine(plain, options.columns).join("\n") + "\n";
    if (!options.colorEnabled) return lines;
    const color = kind === "warning" ? "\u001b[33m" : kind === "source" ? "\u001b[36m" : "\u001b[2m";
    return `${color}${lines}\u001b[0m`;
  };
  if (event.type === "model.delta") return fragments(sanitizer.write(event.data.content), "");
  if (event.type === "retrieval.source") {
    const href = canonicalHttps(event.data.href);
    return href ? fragments("", status(`${sanitizeHuman(event.data.sourceId)} ${href}`, "source")) : EMPTY;
  }
  if (["warning", "limitation"].includes(event.type)) return fragments("", status(`${event.type}: ${sanitizeHuman(event.data.code)}`, "warning"));
  if (event.type === "turn.completed") return fragments("", status("completed"));
  if (event.type === "turn.cancelled") return fragments("", status("cancelled"));
  if (event.type === "turn.failed") return fragments("", status("failed", "warning"));
  if (event.type === "usage.receipt") return fragments("", status(`usage ${event.data.receiptId}`));
  if (event.type.startsWith("tool.")) return fragments("", status(`${event.type} ${event.data.toolCallId}`));
  if (event.type === "policy.decided") return fragments("", status(`policy ${event.data.decision}`));
  if (event.type.startsWith("retrieval.")) return fragments("", status(event.type));
  if (event.type === "model.started" || event.type === "model.completed" || event.type === "model.failed") return fragments("", status(event.type));
  return EMPTY;
}

function createRenderer(format, options = {}) {
  if (!FORMATS.includes(format)) throw new TypeError(`Unsupported Agent FAI render format: ${String(format)}`);
  const reducer = createEventReducer({ contentCapBytes: options.contentCapBytes });
  const ttyOptions = {
    unicode: options.unicode !== false,
    columns: Math.max(20, Math.min(240, Number.isFinite(options.columns) ? Math.trunc(options.columns) : 80)),
    colorEnabled: format === "tty" && options.isTTY === true && options.color !== false && !Object.hasOwn(options.env || {}, "NO_COLOR"),
  };
  const ttySanitizer = new TerminalSanitizer({ maximumSequenceLength: options.maximumEscapeSequenceLength });
  let internalUsed = false;

  function renderEvent(event) {
    const pushed = reducer.push(event);
    internalUsed = true;
    if (!pushed.accepted) return EMPTY;
    if (format === "jsonl") return fragments(`${canonicalJson(event)}\n`, "");
    if (format === "tty") return ttyProjection(event, ttyOptions, ttySanitizer);
    return EMPTY;
  }

  function renderEvents(events) {
    if (!Array.isArray(events)) throw new TypeError("Agent FAI events must be an array");
    let stdout = "";
    let stderr = "";
    for (const event of events) {
      const projected = renderEvent(event);
      stdout += projected.stdout;
      stderr += projected.stderr;
    }
    return fragments(stdout, stderr);
  }

  function projectResult(result, sanitizer = new TerminalSanitizer({ maximumSequenceLength: options.maximumEscapeSequenceLength })) {
    if (format === "text") return fragments(renderText(result), "");
    if (format === "markdown") return fragments(renderMarkdown(result), "");
    if (format === "json") return fragments(`${canonicalJson(finalDocument(result))}\n`, "");
    finalDocument(result);
    if (format === "jsonl") return fragments(result.acceptedEvents.map((event) => `${canonicalJson(event)}\n`).join(""), "");
    let stdout = ""; let stderr = "";
    for (const event of result.acceptedEvents) { const part = ttyProjection(event, ttyOptions, sanitizer); stdout += part.stdout; stderr += part.stderr; }
    stdout += sanitizer.finalize();
    return fragments(stdout, stderr);
  }

  function finalize(...args) {
    if (args.length > 0) throw new TypeError("finalize() does not accept an external result");
    const result = reducer.finalize();
    if (format === "jsonl") return EMPTY;
    if (format === "tty") { const tail = ttySanitizer.finalize(); return fragments(tail, ""); }
    return projectResult(result);
  }

  function renderResult(result) {
    if (internalUsed) throw new AgentFaiRenderError(["external-result-mixed-with-internal-events"]);
    return projectResult(result);
  }

  return Object.freeze({ format, renderEvent, renderEvents, finalize, renderResult });
}

class AgentFaiChannelError extends Error {
  constructor(code, cause) { super(`Agent FAI output channel ${code}.`, { cause }); this.name = "AgentFaiChannelError"; this.code = code; }
}

async function writeChunk(stream, chunk, signal) {
  if (!chunk) return;
  if (!stream || typeof stream.write !== "function") throw new TypeError("A writable channel is required");
  if (signal?.aborted) throw new AgentFaiChannelError("aborted", signal.reason);
  if (stream.destroyed || stream.closed || stream.writableEnded) throw new AgentFaiChannelError("closed");
  if (typeof stream.once !== "function" || typeof stream.removeListener !== "function") {
    if (stream.write(chunk) === false) throw new TypeError("A backpressured writable channel must support events");
    return;
  }
  await new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      stream.removeListener?.("drain", onDrain); stream.removeListener?.("error", onError); stream.removeListener?.("close", onClose);
      signal?.removeEventListener("abort", onAbort);
    };
    const settle = (callback, value) => { if (settled) return; settled = true; cleanup(); callback(value); };
    const onDrain = () => settle(resolve);
    const onError = (error) => settle(reject, error);
    const onClose = () => settle(reject, new AgentFaiChannelError("closed"));
    const onAbort = () => settle(reject, new AgentFaiChannelError("aborted", signal.reason));
    stream.once("drain", onDrain); stream.once("error", onError); stream.once("close", onClose);
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      if (stream.destroyed || stream.closed || stream.writableEnded) return onClose();
      if (stream.write(chunk) !== false) settle(resolve);
    } catch (error) { settle(reject, error); }
  });
}

async function renderToChannels(projected, channels) {
  if (!projected || typeof projected.stdout !== "string" || typeof projected.stderr !== "string") throw new TypeError("Projected output must contain stdout and stderr strings");
  await writeChunk(channels.stdout, projected.stdout, channels.signal);
  await writeChunk(channels.stderr, projected.stderr, channels.signal);
}

module.exports = { AgentFaiChannelError, FORMATS, createRenderer, finalDocument, renderToChannels, sanitizeHuman };