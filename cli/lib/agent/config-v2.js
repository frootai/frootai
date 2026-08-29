// @ts-check
"use strict";

const path = require("node:path");
const os = require("node:os");
const { createAtomicJsonFile, LocalStoreError } = require("./atomic-json-store.js");

const CONFIG_VERSION = 2;
const CONFIG_FILE_MAX_BYTES = 64 * 1024;
const V1_KEYS = Object.freeze(["v", "telemetry", "consent_recorded_at", "anonymous_mode", "first_run_at", "last_subcommand"]);
const V2_KEYS = Object.freeze([...V1_KEYS, "revision", "agent"]);
const AGENT_KEYS = Object.freeze(["defaultFormat", "color", "unicode", "requestTimeoutMs", "reconnects", "retentionDays"]);
const DEFAULT_AGENT_CONFIG = Object.freeze({ defaultFormat: "text", color: "auto", unicode: "auto", requestTimeoutMs: 30_000, reconnects: 1, retentionDays: 30 });
const DEFAULT_CONFIG = Object.freeze({ v: 2, revision: 0, telemetry: false, consent_recorded_at: null, anonymous_mode: true, first_run_at: null, last_subcommand: null, agent: DEFAULT_AGENT_CONFIG });

function resolveConfigPath(options = {}) {
  const env = options.env || process.env;
  const home = (options.homedir || os.homedir)();
  const base = typeof env.XDG_CONFIG_HOME === "string" && path.isAbsolute(env.XDG_CONFIG_HOME) ? env.XDG_CONFIG_HOME : path.join(home, ".config");
  return path.join(base, "frootai", "config.json");
}
function plain(value) { return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function exact(value, keys) { return plain(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"); }
function iso(value) { if (value === null) return true; if (typeof value !== "string") return false; const time = Date.parse(value); return Number.isFinite(time) && new Date(time).toISOString() === value; }
function text(value, max) { return value === null || (typeof value === "string" && value.length > 0 && value.length <= max && !/[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/u.test(value)); }

function validateAgent(value) {
  return exact(value, AGENT_KEYS)
    && ["text", "markdown", "json", "jsonl"].includes(value.defaultFormat)
    && ["auto", "always", "never"].includes(value.color)
    && ["auto", "always", "never"].includes(value.unicode)
    && Number.isInteger(value.requestTimeoutMs) && value.requestTimeoutMs >= 1000 && value.requestTimeoutMs <= 120_000
    && Number.isInteger(value.reconnects) && value.reconnects >= 0 && value.reconnects <= 2
    && Number.isInteger(value.retentionDays) && value.retentionDays >= 0 && value.retentionDays <= 30;
}
function validateConfig(value) {
  return exact(value, V2_KEYS) && value.v === 2 && Number.isSafeInteger(value.revision) && value.revision >= 0
    && typeof value.telemetry === "boolean" && iso(value.consent_recorded_at)
    && typeof value.anonymous_mode === "boolean" && iso(value.first_run_at)
    && text(value.last_subcommand, 64) && validateAgent(value.agent);
}
function validateV1(value) {
  return exact(value, V1_KEYS) && value.v === 1 && typeof value.telemetry === "boolean"
    && iso(value.consent_recorded_at) && typeof value.anonymous_mode === "boolean"
    && iso(value.first_run_at) && text(value.last_subcommand, 64);
}
function migrateConfigV1(value) {
  if (!validateV1(value)) throw new LocalStoreError("invalid_config_v1");
  return { v: 2, revision: 0, telemetry: value.telemetry, consent_recorded_at: value.consent_recorded_at, anonymous_mode: value.anonymous_mode, first_run_at: value.first_run_at, last_subcommand: value.last_subcommand, agent: { ...DEFAULT_AGENT_CONFIG } };
}

function createConfigCoordinator(options = {}) {
  const file = options.backend || createAtomicJsonFile(options.path || resolveConfigPath(options), { maximumBytes: CONFIG_FILE_MAX_BYTES, mode: 0o600, io: options.io });
  let queue = Promise.resolve();
  function serialize(operation) { const next = queue.then(operation, operation); queue = next.then(() => undefined, () => undefined); return next; }
  function decode(value) {
    if (value === null) return { ...DEFAULT_CONFIG, agent: { ...DEFAULT_AGENT_CONFIG } };
    if (value && value.v === 1) return migrateConfigV1(value);
    if (!validateConfig(value)) throw new LocalStoreError(value && Number.isInteger(value.v) && value.v > 2 ? "unsupported_config_version" : "invalid_config");
    return value;
  }
  async function transact(operation) {
    if (typeof file.transaction === "function") {
      return file.transaction(async ({ current, write: store }) => operation(current, store));
    }
    return serialize(async () => operation(await file.read(), (value) => file.write(value)));
  }
  async function read() {
    return transact(async (value, store) => {
      const decoded = decode(value);
      if (value && value.v === 1) await store(decoded);
      return decoded;
    });
  }
  async function commit(currentValue, store, next, expectedRevision) {
    if (!validateConfig(next)) throw new LocalStoreError("invalid_config");
    const current = decode(currentValue);
    if (expectedRevision !== undefined && current.revision !== expectedRevision) throw new LocalStoreError("revision_conflict");
    const stored = { ...next, revision: current.revision + 1, agent: { ...next.agent } };
    await store(stored);
    return stored;
  }
  async function write(next, expectedRevision) {
    return transact((current, store) => commit(current, store, next, expectedRevision));
  }
  async function update(patch, expectedRevision) {
    return transact(async (currentValue, store) => {
      const current = decode(currentValue);
      if (!plain(patch) || Object.keys(patch).some((key) => !["telemetry", "consent_recorded_at", "anonymous_mode", "first_run_at", "last_subcommand", "agent"].includes(key))) throw new LocalStoreError("invalid_config_patch");
      const next = { ...current, ...patch, agent: patch.agent ? { ...current.agent, ...patch.agent } : current.agent };
      return commit(currentValue, store, next, expectedRevision === undefined ? current.revision : expectedRevision);
    });
  }
  return Object.freeze({
    read,
    write,
    update,
    clearAccountHints: async () => update({ anonymous_mode: true }),
    markAuthenticated: async () => update({ anonymous_mode: false }),
  });
}

module.exports = { CONFIG_VERSION, CONFIG_FILE_MAX_BYTES, DEFAULT_AGENT_CONFIG, DEFAULT_CONFIG, resolveConfigPath, validateConfig, migrateConfigV1, createConfigCoordinator };