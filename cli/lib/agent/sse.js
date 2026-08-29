// @ts-check
"use strict";

const { AgentFaiClientError } = require("./client-error.js");
const { parseStrictJson } = require("./strict-json.js");
const { validate } = require("./contract-validators.js");
const { awaitWithAbort } = require("./abort.js");

async function* parseSse(body, options = {}) {
  if (!body || typeof body.getReader !== "function") throw new AgentFaiClientError("integrity_failed");
  const maximumBytes = options.maximumBytes || 8 * 1024 * 1024;
  const maximumEventBytes = options.maximumEventBytes || 1024 * 1024;
  const maximumEvents = options.maximumEvents || 100000;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const reader = body.getReader();
  let buffer = ""; let totalBytes = 0; let count = 0;
  const signal = options.signal;
  try {
    while (true) {
      let chunk;
      try { chunk = await awaitWithAbort(Promise.resolve().then(() => reader.read()), signal, () => reader.cancel()); } catch {
        if (signal?.aborted) throw new AgentFaiClientError("cancelled");
        throw new AgentFaiClientError("transport_failed");
      }
      const { done, value } = chunk;
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new AgentFaiClientError("integrity_failed");
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) throw new AgentFaiClientError("request_too_large");
      try { buffer += decoder.decode(value, { stream: true }); } catch { throw new AgentFaiClientError("integrity_failed"); }
      if (Buffer.byteLength(buffer, "utf8") > maximumEventBytes) throw new AgentFaiClientError("message_too_large");
      buffer = buffer.replaceAll("\r\n", "\n");
      let separator;
      while ((separator = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, separator); buffer = buffer.slice(separator + 2);
        if (!block || block.split("\n").every((line) => line.startsWith(":"))) continue;
        const fields = Object.create(null);
        for (const line of block.split("\n")) {
          if (!line || line.startsWith(":")) continue;
          const colon = line.indexOf(":");
          const name = colon < 0 ? line : line.slice(0, colon);
          const valueText = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /u, "");
          if (!["id", "data"].includes(name) || Object.hasOwn(fields, name) || valueText.includes("\n")) throw new AgentFaiClientError("integrity_failed");
          fields[name] = valueText;
        }
        if (!/^(?:0|[1-9]\d{0,15})$/u.test(fields.id || "") || typeof fields.data !== "string") throw new AgentFaiClientError("integrity_failed");
        let event;
        try { event = parseStrictJson(fields.data, "SSE data"); } catch { throw new AgentFaiClientError("integrity_failed"); }
        if (!validate("validateApiEvent", event).valid || Number(fields.id) !== event.sequence) throw new AgentFaiClientError("integrity_failed");
        count += 1;
        if (count > maximumEvents) throw new AgentFaiClientError("request_too_large");
        yield { id: fields.id, bytes: fields.data, event };
      }
    }
    try { buffer += decoder.decode(); } catch { throw new AgentFaiClientError("integrity_failed"); }
    if (buffer.trim()) {
      if (buffer.includes("\n\n")) throw new AgentFaiClientError("integrity_failed");
      throw new AgentFaiClientError("transport_failed");
    }
  } finally {
    if (signal?.aborted) { try { await reader.cancel(); } catch { /* */ } }
    try { reader.releaseLock(); } catch { /* */ }
  }
}

module.exports = { parseSse };