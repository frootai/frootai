// @ts-check
/**
 * FAI CLI auth — config store at ~/.frootai/config.json.
 *
 * Holds non-secret CLI preferences:
 *   - anonymous_mode: boolean   (default true — A4.9 doctrine: free works without sign-in)
 *   - telemetry_opt_in: boolean (default false — A4.27 opt-in; persisted here so login flow can prompt once)
 *   - last_user: string|null    (cached subject from last sign-in; cleared by logout)
 *   - last_user_email: string|null
 *   - first_run_at: ISO string  (set on first read — marks the install moment for support triage)
 *
 * Storage is JSON file with versioned shape (`v: 1`). Atomic write (tmp + rename).
 * Pure helpers (parseConfig / mergeConfig) split from IO so tests can inject
 * fake fs implementations.
 *
 * Secrets (auth tokens) live in token-store.js, NOT here.
 */
"use strict";

const fs = require("node:fs");
const fsP = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { OrchardCliError } = require("../orchard/cli-error");

const DEFAULT_CONFIG_DIR = path.join(os.homedir(), ".frootai");
const DEFAULT_CONFIG_PATH = path.join(DEFAULT_CONFIG_DIR, "config.json");
const CONFIG_VERSION = 1;
const CONFIG_FILE_MAX_BYTES = 64 * 1024; // 64 KiB is way more than realistic

const DEFAULT_CONFIG = Object.freeze({
  v: CONFIG_VERSION,
  anonymous_mode: true,
  telemetry_opt_in: false,
  last_user: null,
  last_user_email: null,
  first_run_at: null,
});

/** Pure — parse raw text into a validated config. Never throws (returns default on garbage). */
function parseConfig(raw) {
  if (raw === null || raw === undefined || raw === "") {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const parsed = JSON.parse(String(raw));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ...DEFAULT_CONFIG };
    }
    if (parsed.v !== CONFIG_VERSION) {
      return { ...DEFAULT_CONFIG };
    }
    return {
      v: CONFIG_VERSION,
      anonymous_mode: typeof parsed.anonymous_mode === "boolean" ? parsed.anonymous_mode : DEFAULT_CONFIG.anonymous_mode,
      telemetry_opt_in: typeof parsed.telemetry_opt_in === "boolean" ? parsed.telemetry_opt_in : DEFAULT_CONFIG.telemetry_opt_in,
      last_user: typeof parsed.last_user === "string" && parsed.last_user.length > 0 ? parsed.last_user : null,
      last_user_email: typeof parsed.last_user_email === "string" && parsed.last_user_email.length > 0 ? parsed.last_user_email : null,
      first_run_at: typeof parsed.first_run_at === "string" && parsed.first_run_at.length > 0 ? parsed.first_run_at : null,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/** Pure — immutable merge. Returns NEW config. Unknown keys silently dropped. */
function mergeConfig(current, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return { ...current };
  const merged = { ...current };
  if (typeof patch.anonymous_mode === "boolean") merged.anonymous_mode = patch.anonymous_mode;
  if (typeof patch.telemetry_opt_in === "boolean") merged.telemetry_opt_in = patch.telemetry_opt_in;
  if (patch.last_user === null || (typeof patch.last_user === "string" && patch.last_user.length > 0)) merged.last_user = patch.last_user;
  if (patch.last_user_email === null || (typeof patch.last_user_email === "string" && patch.last_user_email.length > 0)) merged.last_user_email = patch.last_user_email;
  if (typeof patch.first_run_at === "string" && patch.first_run_at.length > 0) merged.first_run_at = patch.first_run_at;
  merged.v = CONFIG_VERSION;
  return merged;
}

/** Read config file. Missing file → DEFAULT_CONFIG (no error). Also stamps `first_run_at` if missing. */
async function readConfigFile(opts) {
  const o = opts || {};
  const configPath = o.configPath || DEFAULT_CONFIG_PATH;
  let raw;
  try {
    const stat = await fsP.stat(configPath);
    if (stat.size > CONFIG_FILE_MAX_BYTES) {
      throw new OrchardCliError("file_too_large", `config file ${configPath} > cap ${CONFIG_FILE_MAX_BYTES}`, { path: configPath, size: stat.size });
    }
    raw = await fsP.readFile(configPath, "utf8");
  } catch (err) {
    if (err && /** @type {any} */(err).code === "ENOENT") {
      // First run — stamp + write the seed config.
      const seeded = mergeConfig(DEFAULT_CONFIG, { first_run_at: o.nowIso || new Date().toISOString() });
      if (!o.skipFirstRunWrite) {
        try { await writeConfigFile(seeded, { configPath, nowIso: o.nowIso }); } catch { /* best-effort */ }
      }
      return seeded;
    }
    if (err instanceof OrchardCliError) throw err;
    throw new OrchardCliError("io_error", `failed to read config: ${err instanceof Error ? err.message : String(err)}`, { path: configPath });
  }
  return parseConfig(raw);
}

/** Write atomically (tmp + rename). */
async function writeConfigFile(config, opts) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new OrchardCliError("invalid_input", "writeConfigFile requires a config object");
  }
  const o = opts || {};
  const configPath = o.configPath || DEFAULT_CONFIG_PATH;
  const tempPath = `${configPath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const json = JSON.stringify({
    v: CONFIG_VERSION,
    anonymous_mode: config.anonymous_mode !== false,
    telemetry_opt_in: config.telemetry_opt_in === true,
    last_user: typeof config.last_user === "string" && config.last_user.length > 0 ? config.last_user : null,
    last_user_email: typeof config.last_user_email === "string" && config.last_user_email.length > 0 ? config.last_user_email : null,
    first_run_at: typeof config.first_run_at === "string" && config.first_run_at.length > 0 ? config.first_run_at : (o.nowIso || new Date().toISOString()),
  }, null, 2) + "\n";
  if (Buffer.byteLength(json, "utf8") > CONFIG_FILE_MAX_BYTES) {
    throw new OrchardCliError("file_too_large", `would-be config exceeds cap ${CONFIG_FILE_MAX_BYTES}`, { path: configPath });
  }
  try {
    await fsP.mkdir(path.dirname(configPath), { recursive: true });
    await fsP.writeFile(tempPath, json, "utf8");
    await fsP.rename(tempPath, configPath);
  } catch (err) {
    try { await fsP.unlink(tempPath); } catch { /* */ }
    throw new OrchardCliError("io_error", `failed to write config: ${err instanceof Error ? err.message : String(err)}`, { path: configPath });
  }
  return { path: configPath, bytes: Buffer.byteLength(json, "utf8") };
}

/** Convenience: read + apply patch + write. Returns the new config. */
async function updateConfig(patch, opts) {
  const current = await readConfigFile(opts);
  const merged = mergeConfig(current, patch);
  await writeConfigFile(merged, opts);
  return merged;
}

module.exports = {
  DEFAULT_CONFIG_DIR,
  DEFAULT_CONFIG_PATH,
  CONFIG_VERSION,
  CONFIG_FILE_MAX_BYTES,
  DEFAULT_CONFIG,
  parseConfig,
  mergeConfig,
  readConfigFile,
  writeConfigFile,
  updateConfig,
};
