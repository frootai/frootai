// @ts-check
/**
 * [H8.16] config-store.js — XDG-compliant CLI config store at
 * `~/.config/frootai/config.json`. Holds NON-SECRET preferences:
 * telemetry consent, first-run marker, anonymous_mode toggle.
 *
 * Contract slice (from masterplan §3 row [H8.16]):
 *   Telemetry opt-out: `frootai config set telemetry false` disables OTEL;
 *   opt-in by default with first-run consent banner; document at
 *   `docs/cli/telemetry.md`
 *
 * **Interpretation of "opt-in by default":** telemetry is OFF until the
 * user EXPLICITLY opts in (industry standard). The "first-run consent
 * banner" prompts the user once on first invocation; if they answer yes,
 * `telemetry: true`; if they answer no, `telemetry: false`. The consent
 * record is `consent_recorded_at` (ISO) so the banner only shows once.
 * The `DO_NOT_TRACK=1` env var ALWAYS overrides config (force OFF).
 *
 * Path resolution (mirrors H8.13 credentials-store XDG handling):
 *   1. `$XDG_CONFIG_HOME/frootai/config.json` if XDG_CONFIG_HOME is set AND
 *      is an absolute path
 *   2. else `$HOME/.config/frootai/config.json`
 *
 * **Coexistence with A4.27 config-store at `~/.frootai/config.json`:** the
 * two stores serve different surface contracts. A4.27's `frootai telemetry
 * on|off|status` writes the OLD path; H8.16's `frootai config set telemetry`
 * writes the NEW XDG path. Same A4-coexistence policy as H8.13 — both live
 * until a future bin-reconciliation sub-phase elects one.
 *
 * Stored shape (`Config`, migrated fail-closed from v1):
 *   {
 *     v: 2, revision: number,            // schema version + optimistic revision
 *     telemetry: boolean,                // explicit opt-in (default: false)
 *     consent_recorded_at: string|null,  // ISO; null = banner not yet shown
 *     anonymous_mode: boolean,           // default true (free works w/o login)
 *     first_run_at: string,              // ISO; set on first read
 *     last_subcommand: string|null,      // optional; no PII
 *     agent: { defaultFormat, color, unicode, requestTimeoutMs,
 *              reconnects, retentionDays }
 *   }
 *
 * Security:
 *   - Mode 0600 on POSIX because preferences may be personally confidential.
 *     Windows owner-ACL enforcement and secure storage are not implemented.
 *   - 64 KiB hard size cap.
 *   - Atomic write (tmp + rename).
 *
 * License: CC0-1.0.
 */
"use strict";

const path = require("node:path");
const os = require("node:os");
const { parseStrictJson } = require("../../lib/agent/strict-json.js");
const { DEFAULT_AGENT_CONFIG, validateConfig, migrateConfigV1 } = require("../../lib/agent/config-v2.js");
const { createAtomicJsonFile, LocalStoreError } = require("../../lib/agent/atomic-json-store.js");

const CONFIG_VERSION = 2;
const CONFIG_FILE_MAX_BYTES = 64 * 1024;
const CONFIG_FILE_MODE = 0o600;

/** Frozen default config. */
const DEFAULT_CONFIG = Object.freeze({
  v: CONFIG_VERSION,
  revision: 0,
  telemetry: false,
  consent_recorded_at: null,
  anonymous_mode: true,
  first_run_at: null,
  last_subcommand: null,
  agent: DEFAULT_AGENT_CONFIG,
});

/** Allowed `frootai config set/get` keys. Frozen for both validation + help text. */
const ALLOWED_KEYS = Object.freeze([
  "telemetry",
  "anonymous_mode",
  "last_subcommand",
]);

/** Error carrying a sysexits exit code. */
class ConfigStoreError extends Error {
  /**
   * @param {string} code @param {string} message
   * @param {{ exitCode?: number, cause?: Error, meta?: object }} [opts]
   */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "ConfigStoreError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : 70;
    if (opts.cause) this.cause = opts.cause;
    if (opts.meta) this.meta = opts.meta;
  }
}

/**
 * Resolve the config.json path per XDG Base Directory spec.
 *
 * @param {object} [opts]
 * @param {Record<string,string|undefined>} [opts.env]
 * @param {() => string} [opts.homedir]
 * @returns {string}
 */
function resolveConfigPath(opts = {}) {
  const env = opts.env || process.env;
  const homedir = opts.homedir || (() => os.homedir());
  const xdg = env.XDG_CONFIG_HOME;
  if (typeof xdg === "string" && xdg.length > 0 && path.isAbsolute(xdg)) {
    return path.join(xdg, "frootai", "config.json");
  }
  return path.join(homedir(), ".config", "frootai", "config.json");
}

/**
 * Pure — parse the raw config JSON. Returns DEFAULT_CONFIG only when absent.
 * Corrupt, invalid, and unsupported versions fail closed with ConfigStoreError.
 *
 * @param {string|null|undefined} raw
 * @returns {object}
 */
function parseConfig(raw) {
  if (raw === null || raw === undefined || raw === "") return { ...DEFAULT_CONFIG };
  let parsed;
  try { parsed = parseStrictJson(String(raw), "config"); }
  catch (error) { throw new ConfigStoreError("invalid_config", "config file is corrupt", { exitCode: 74, cause: error instanceof Error ? error : undefined }); }
  if (parsed && parsed.v === 1) {
    try { return migrateConfigV1(parsed); }
    catch (error) { throw new ConfigStoreError("invalid_config", "config v1 shape is invalid", { exitCode: 74, cause: error instanceof Error ? error : undefined }); }
  }
  if (!validateConfig(parsed)) {
    const code = parsed && Number.isInteger(parsed.v) && parsed.v > CONFIG_VERSION ? "unsupported_config_version" : "invalid_config";
    throw new ConfigStoreError(code, code === "unsupported_config_version" ? "config version is newer than this CLI" : "config shape is invalid", { exitCode: 74 });
  }
  return parsed;
}

function normalizeStoredConfig(value) {
  if (value === null || value === undefined) return null;
  if (value.v === 1) {
    try { return migrateConfigV1(value); }
    catch (error) { throw new ConfigStoreError("invalid_config", "config v1 shape is invalid", { exitCode: 74, cause: error instanceof Error ? error : undefined }); }
  }
  if (!validateConfig(value)) {
    const code = value && Number.isInteger(value.v) && value.v > CONFIG_VERSION ? "unsupported_config_version" : "invalid_config";
    throw new ConfigStoreError(code, code === "unsupported_config_version" ? "config version is newer than this CLI" : "config shape is invalid", { exitCode: 74 });
  }
  return value;
}

/**
 * Pure — immutable merge. Unknown keys silently dropped. Returns a new object.
 *
 * @param {object} current @param {object} patch
 */
function mergeConfig(current, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return { ...current };
  const merged = { ...current };
  if (typeof patch.telemetry === "boolean") merged.telemetry = patch.telemetry;
  if (typeof patch.consent_recorded_at === "string" && patch.consent_recorded_at.length > 0) merged.consent_recorded_at = patch.consent_recorded_at;
  if (patch.consent_recorded_at === null) merged.consent_recorded_at = null;
  if (typeof patch.anonymous_mode === "boolean") merged.anonymous_mode = patch.anonymous_mode;
  if (typeof patch.first_run_at === "string" && patch.first_run_at.length > 0) merged.first_run_at = patch.first_run_at;
  if (typeof patch.last_subcommand === "string" && patch.last_subcommand.length > 0) merged.last_subcommand = patch.last_subcommand;
  if (patch.last_subcommand === null) merged.last_subcommand = null;
  if (patch.agent && typeof patch.agent === "object" && !Array.isArray(patch.agent)) merged.agent = { ...current.agent, ...patch.agent };
  merged.v = CONFIG_VERSION;
  return merged;
}

/**
 * Pure — serialize config to the on-disk JSON string (newline-terminated).
 * Validates input shape; throws ConfigStoreError on bad input.
 */
function serializeConfig(cfg) {
  if (!validateConfig(cfg)) {
    throw new ConfigStoreError("invalid_input", "serializeConfig requires an exact v=2 config object", { exitCode: 64 });
  }
  return JSON.stringify({
    v: CONFIG_VERSION,
    revision: cfg.revision,
    telemetry: cfg.telemetry,
    consent_recorded_at: cfg.consent_recorded_at,
    anonymous_mode: cfg.anonymous_mode,
    first_run_at: cfg.first_run_at,
    last_subcommand: cfg.last_subcommand,
    agent: cfg.agent,
  }, null, 2) + "\n";
}

/**
 * Pure — true when `DO_NOT_TRACK=1` env is set (industry standard:
 * https://consoledonottrack.com/).
 *
 * @param {Record<string,string|undefined>|null|undefined} env
 * @returns {boolean}
 */
function isDoNotTrackEnv(env) {
  const e = env || {};
  return e.DO_NOT_TRACK === "1" || e.DO_NOT_TRACK === "true";
}

/**
 * Pure — true when telemetry is EFFECTIVELY enabled. Combines config +
 * env-override semantics in one place so callers don't repeat the logic.
 * Order: DO_NOT_TRACK env wins → config.telemetry.
 *
 * @param {object|null|undefined} cfg
 * @param {Record<string,string|undefined>|null|undefined} env
 * @returns {boolean}
 */
function isTelemetryEnabled(cfg, env) {
  if (isDoNotTrackEnv(env)) return false;
  if (!cfg || typeof cfg.telemetry !== "boolean") return false;
  return cfg.telemetry === true;
}

/**
 * Pure — coerce a CLI-provided value string into a typed value for the
 * named key. Returns `{ok, value?, error?}`. Used by `config set <key> <val>`.
 *
 * @param {string} key @param {string} rawValue
 * @returns {{ ok: boolean, value?: any, error?: string }}
 */
function coerceConfigValue(key, rawValue) {
  if (!ALLOWED_KEYS.includes(key)) {
    return { ok: false, error: `unknown config key "${key}" (allowed: ${ALLOWED_KEYS.join(", ")})` };
  }
  if (typeof rawValue !== "string") {
    return { ok: false, error: `value must be a string (got ${typeof rawValue})` };
  }
  if (key === "telemetry" || key === "anonymous_mode") {
    const v = rawValue.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "yes" || v === "on") return { ok: true, value: true };
    if (v === "false" || v === "0" || v === "no" || v === "off") return { ok: true, value: false };
    return { ok: false, error: `${key} must be one of: true, false, 1, 0, yes, no, on, off (got "${rawValue}")` };
  }
  if (key === "last_subcommand") {
    if (rawValue.length === 0) return { ok: false, error: `last_subcommand must be a non-empty string` };
    if (rawValue.length > 64) return { ok: false, error: `last_subcommand too long (max 64 chars)` };
    return { ok: true, value: rawValue };
  }
  return { ok: false, error: `internal: no coercer for key "${key}"` };
}

/**
 * Build the default file backend pinned to `configPath`. Pass an `io`
 * object to inject fs hooks for tests.
 */
function buildFileBackend(configPath, io = {}) {
  const p = configPath;
  const warnLooseMode = () => {
    const stderr = io.stderr || process.stderr;
    const message = "warning: config file permissions are broader than 0600\n";
    if (typeof stderr === "function") stderr(message);
    else if (stderr && typeof stderr.write === "function") stderr.write(message);
  };
  const file = createAtomicJsonFile(p, { maximumBytes: CONFIG_FILE_MAX_BYTES, mode: CONFIG_FILE_MODE, io: Object.keys(io).length === 0 ? undefined : io, onLooseMode: warnLooseMode });
  function lockedBackend(controls) {
    let rawCurrent = controls.current === null ? null : structuredClone(controls.current);
    let current = normalizeStoredConfig(rawCurrent);
    return Object.freeze({
      name: "file",
      path: p,
      get: async () => current === null ? null : structuredClone(current),
      getRaw: async () => rawCurrent === null ? null : structuredClone(rawCurrent),
      set: async (cfg) => {
        const raw = serializeConfig(cfg);
        await controls.write(cfg);
        rawCurrent = structuredClone(cfg);
        current = structuredClone(cfg);
        return { path: p, bytes: Buffer.byteLength(raw, "utf8") };
      },
      delete: async () => {
        if (current === null) return false;
        await controls.clear();
        rawCurrent = null;
        current = null;
        return true;
      },
    });
  }
  const backend = {
    name: "file",
    path: p,
    get: async () => {
      const stored = await file.read();
      return normalizeStoredConfig(stored);
    },
    set: async (cfg) => {
      const raw = serializeConfig(cfg);
      if (Buffer.byteLength(raw, "utf8") > CONFIG_FILE_MAX_BYTES) {
        throw new ConfigStoreError("file_too_large", `would-be config exceeds cap ${CONFIG_FILE_MAX_BYTES}`, { exitCode: 74, meta: { path: p } });
      }
      await file.write(cfg);
      return { path: p, bytes: Buffer.byteLength(raw, "utf8") };
    },
    delete: async () => file.clear(),
    transaction: async (operation) => file.transaction((controls) => operation(lockedBackend(controls))),
  };
  return Object.freeze(backend);
}

/** In-memory backend (for hermetic tests). */
function buildMemoryBackend(initial = null) {
  let stored = initial ? { ...initial } : null;
  let queue = Promise.resolve();
  function serialize(operation) {
    const next = queue.then(operation, operation);
    queue = next.then(() => undefined, () => undefined);
    return next;
  }
  function lockedBackend() {
    return Object.freeze({
      name: "memory",
      path: ":memory:",
      get: async () => (stored ? structuredClone(stored) : null),
      getRaw: async () => (stored ? structuredClone(stored) : null),
      set: async (cfg) => { stored = { ...cfg, agent: { ...cfg.agent }, v: CONFIG_VERSION }; return { path: ":memory:", bytes: 0 }; },
      delete: async () => { const had = !!stored; stored = null; return had; },
    });
  }
  const backend = {
    name: "memory",
    path: ":memory:",
    get: async () => (stored ? { ...stored } : null),
    set: async (cfg) => serialize(() => lockedBackend().set(cfg)),
    delete: async () => serialize(() => lockedBackend().delete()),
    transaction: async (operation) => serialize(() => operation(lockedBackend())),
  };
  return Object.freeze(backend);
}

// ─── Public API (backend-agnostic) ─────────────────────────────────────

/**
 * Read the config (or DEFAULT_CONFIG on absent). When the file is absent
 * AND `stampFirstRun !== false`, this writes the seed config with a
 * `first_run_at` timestamp before returning it (best-effort).
 *
 * @param {object} [opts]
 * @param {object} [opts.backend]
 * @param {string} [opts.path]
 * @param {Record<string,string|undefined>} [opts.env]
 * @param {() => string} [opts.homedir]
 * @param {object} [opts.io]
 * @param {string} [opts.nowIso]
 * @param {boolean} [opts.stampFirstRun] — default true
 * @returns {Promise<object>}
 */
async function readConfig(opts = {}) {
  const backend = opts.backend || buildFileBackend(opts.path || resolveConfigPath({ env: opts.env, homedir: opts.homedir }), opts.io || {});
  const operation = async (store) => {
    const stored = typeof store.getRaw === "function" ? await store.getRaw() : await store.get();
    let cfg = normalizeStoredConfig(stored);
    if (stored && stored.v === 1) await store.set(cfg);
    if (!cfg) cfg = { ...DEFAULT_CONFIG, agent: { ...DEFAULT_AGENT_CONFIG } };
    if (!cfg.first_run_at && opts.stampFirstRun !== false) {
      cfg = mergeConfig(cfg, { first_run_at: opts.nowIso || new Date().toISOString() });
      try { await store.set(cfg); } catch { /* best-effort */ }
    }
    return cfg;
  };
  try {
    return typeof backend.transaction === "function" ? await backend.transaction(operation) : await operation(backend);
  } catch (error) {
    if (error instanceof LocalStoreError) throw new ConfigStoreError("config_read_failed", "config read failed", { exitCode: 74 });
    throw error;
  }
}

/**
 * Patch + write the config. Returns the merged config + write info.
 *
 * @param {object} patch
 * @param {object} [opts]
 */
async function writeConfig(patch, opts = {}) {
  const backend = opts.backend || buildFileBackend(opts.path || resolveConfigPath({ env: opts.env, homedir: opts.homedir }), opts.io || {});
  const operation = async (store) => {
    let current = normalizeStoredConfig(await store.get());
    if (!current) current = { ...DEFAULT_CONFIG, agent: { ...DEFAULT_AGENT_CONFIG } };
    if (!current.first_run_at) current = mergeConfig(current, { first_run_at: opts.nowIso || new Date().toISOString() });
    const merged = { ...mergeConfig(current, patch), revision: current.revision + 1 };
    const written = await store.set(merged);
    return { config: merged, ...written };
  };
  try {
    return typeof backend.transaction === "function" ? await backend.transaction(operation) : await operation(backend);
  } catch (error) {
    if (error instanceof LocalStoreError) throw new ConfigStoreError("config_write_failed", "config write failed", { exitCode: 75 });
    throw error;
  }
}

/** Delete the config file. */
async function deleteConfig(opts = {}) {
  const backend = opts.backend || buildFileBackend(opts.path || resolveConfigPath({ env: opts.env, homedir: opts.homedir }), opts.io || {});
  try { return await backend.delete(); }
  catch (error) {
    if (error instanceof LocalStoreError) throw new ConfigStoreError("config_delete_failed", "config delete failed", { exitCode: 75 });
    throw error;
  }
}

/**
 * Record the result of the first-run consent banner. Idempotent: if
 * `consent_recorded_at` is already set, returns the existing config
 * unchanged (the banner only ever shows once).
 *
 * @param {boolean} accepted — true = opt-in, false = opt-out
 * @param {object} [opts] — `{ backend?, path?, env?, nowIso? }`
 */
async function recordConsent(accepted, opts = {}) {
  const current = await readConfig(opts);
  if (current.consent_recorded_at) return { config: current, recorded_now: false };
  const nowIso = opts.nowIso || new Date().toISOString();
  const r = await writeConfig({
    telemetry: !!accepted,
    consent_recorded_at: nowIso,
  }, opts);
  return { config: r.config, recorded_now: true, path: r.path, bytes: r.bytes };
}

/**
 * Should the first-run consent banner be shown? True iff
 * `consent_recorded_at` is null AND `DO_NOT_TRACK` is NOT set. Pure.
 *
 * @param {object|null|undefined} cfg
 * @param {Record<string,string|undefined>|null|undefined} env
 */
function shouldShowConsentBanner(cfg, env) {
  if (isDoNotTrackEnv(env)) return false;
  if (!cfg) return true;
  return !cfg.consent_recorded_at;
}

module.exports = {
  CONFIG_VERSION,
  CONFIG_FILE_MAX_BYTES,
  CONFIG_FILE_MODE,
  DEFAULT_CONFIG,
  ALLOWED_KEYS,
  ConfigStoreError,
  resolveConfigPath,
  parseConfig,
  mergeConfig,
  serializeConfig,
  isDoNotTrackEnv,
  isTelemetryEnabled,
  coerceConfigValue,
  buildFileBackend,
  buildMemoryBackend,
  readConfig,
  writeConfig,
  deleteConfig,
  recordConsent,
  shouldShowConsentBanner,
};
