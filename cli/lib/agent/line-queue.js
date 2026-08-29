// @ts-check
"use strict";

const readline = require("node:readline");
const { AgentFaiClientError } = require("./client-error.js");

const DEFAULT_MAXIMUM_LINES = 32;
const DEFAULT_MAXIMUM_LINE_BYTES = 32000;

function createLineQueue(input, options = {}) {
  if (!input || typeof input.on !== "function") throw new TypeError("Agent FAI interactive input must be readable");
  const maximumLines = options.maximumLines ?? DEFAULT_MAXIMUM_LINES;
  const maximumLineBytes = options.maximumLineBytes ?? DEFAULT_MAXIMUM_LINE_BYTES;
  if (!Number.isInteger(maximumLines) || maximumLines < 1 || maximumLines > 256 || !Number.isInteger(maximumLineBytes) || maximumLineBytes < 1 || maximumLineBytes > 65536) throw new TypeError("Agent FAI line queue limits are invalid");
  const lines = [];
  const waiters = [];
  let closed = false;
  let failure = null;
  const lineInterface = options.lineInterface || readline.createInterface({ input, crlfDelay: Infinity, terminal: false });

  const settle = () => {
    while (waiters.length > 0 && (lines.length > 0 || closed || failure)) {
      const waiter = waiters.shift();
      if (failure) waiter.reject(failure);
      else if (lines.length > 0) waiter.resolve({ value: lines.shift(), done: false });
      else waiter.resolve({ value: undefined, done: true });
    }
  };
  const fail = (error) => {
    if (closed || failure) return;
    failure = error instanceof AgentFaiClientError ? error : new AgentFaiClientError("integrity_failed");
    lineInterface.close?.();
    settle();
  };
  const onLine = (line) => {
    if (closed || failure) return;
    if (typeof line !== "string" || Buffer.byteLength(line, "utf8") > maximumLineBytes) { fail(new AgentFaiClientError("message_too_large")); return; }
    if (lines.length >= maximumLines && waiters.length === 0) { fail(new AgentFaiClientError("quota_exceeded")); return; }
    lines.push(line);
    settle();
  };
  const cleanup = () => {
    lineInterface.removeListener?.("line", onLine);
    lineInterface.removeListener?.("close", onClose);
    lineInterface.removeListener?.("error", onError);
    options.signal?.removeEventListener("abort", onAbort);
  };
  const onClose = () => { closed = true; cleanup(); settle(); };
  const onError = () => fail(new AgentFaiClientError("integrity_failed"));
  const onAbort = () => fail(new AgentFaiClientError("cancelled"));
  lineInterface.on("line", onLine);
  lineInterface.once("close", onClose);
  lineInterface.once("error", onError);
  options.signal?.addEventListener("abort", onAbort, { once: true });
  if (options.signal?.aborted) onAbort();

  function next() {
    if (failure) return Promise.reject(failure);
    if (lines.length > 0) return Promise.resolve({ value: lines.shift(), done: false });
    if (closed) return Promise.resolve({ value: undefined, done: true });
    return new Promise((resolve, reject) => waiters.push({ resolve, reject }));
  }
  function close() {
    if (closed) { cleanup(); return; }
    closed = true;
    cleanup();
    lineInterface.close?.();
    settle();
  }
  return Object.freeze({ next, close, pending: () => lines.length, [Symbol.asyncIterator]() { return this; } });
}

module.exports = { DEFAULT_MAXIMUM_LINES, DEFAULT_MAXIMUM_LINE_BYTES, createLineQueue };