// @ts-check
/**
 * FAI MCP CLI — minimal `~/.frootai/mcp-state.json` reader (M4.3 ship).
 *
 * Pinned to a minimum-viable shape so M4.3 (`frootai mcp list`) can render
 * even when the file is absent (first-run UX). The full Ajv-validated schema
 * + writer land at M4.15. Until then, callers MUST tolerate partial shapes
 * and the absence of the file entirely.
 *
 * Forward-compatible reader contract (M4.15 will tighten the validator):
 *   {
 *     version:           1,                // single supported version today
 *     preAttach:         string[],         // area names to attach on kernel boot
 *     lastHealthCheck:   Array<{
 *       area:       string,                // area name
 *       status:     "ok" | "fail" | string,
 *       latencyMs?: number,
 *       toolCount?: number,
 *       checkedAt?: string                 // ISO-8601 timestamp
 *     }>
 *   }
 *
 * No writes here — that's M4.5/M4.6 (attach/detach) + M4.10 (test).
 */
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { McpCliError } = require("./cli-error");
const { validateState } = require("./state-validator");

const STATE_FILE_RELPATH = path.join(".frootai", "mcp-state.json");
const STATE_VERSION = 1;

/**
 * @returns {{
 *   version: number,
 *   preAttach: string[],
 *   lastHealthCheck: Array<{ area: string, status: string, latencyMs?: number, toolCount?: number, checkedAt?: string }>
 * }}
 */
function emptyState() {
  return { version: STATE_VERSION, preAttach: [], lastHealthCheck: [] };
}

/**
 * Resolve the absolute path to the state file. Honours `deps.homeDir`
 * injection so tests never touch the operator's real `~/.frootai/`.
 *
 * @param {object} [deps]
 * @returns {string}
 */
function resolveStatePath(deps) {
  const d = deps || {};
  const home = d.homeDir || os.homedir();
  return path.join(home, STATE_FILE_RELPATH);
}

/**
 * Read + parse the state file. Returns the empty default when the file is
 * absent. Throws `McpCliError("state_read_failed")` on malformed JSON or
 * unreadable file (NOT on absence — absence is normal first-run state).
 *
 * Shape is normalised so callers always get `preAttach: []` /
 * `lastHealthCheck: []` even if either field is missing in the source file.
 *
 * @param {object} [deps]
 * @returns {{ version: number, preAttach: string[], lastHealthCheck: Array<object> }}
 */
function readState(deps) {
  const abs = resolveStatePath(deps);
  let raw;
  try {
    raw = fs.readFileSync(abs, "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") return emptyState();
    throw new McpCliError("state_read_failed", `cannot read ${abs}: ${err && err.message}`, {
      hint: `Check permissions on ${path.dirname(abs)}.`,
      path: abs,
    });
  }
  /** @type {any} */
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new McpCliError("state_read_failed", `state file is not valid JSON: ${abs}`, {
      hint: "Fix or delete the file; absence is treated as a clean empty state.",
      path: abs,
    });
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new McpCliError("state_read_failed", `state file root is not an object: ${abs}`, {
      hint: "Expected `{ version, preAttach, lastHealthCheck }`.",
      path: abs,
    });
  }
  // M4.15: schema-validate before normalising. Validation runs against the
  // v1 contract at `frootai/schemas/mcp-cli-state-v1.schema.json`. Absence
  // of optional fields is fine (the reader defaults them below); type /
  // pattern / enum violations on present fields throw a structured error.
  const validation = validateState(parsed);
  if (!validation.valid) {
    throw new McpCliError(
      "state_read_failed",
      `state file failed v1 schema validation (${validation.errors.length} error${validation.errors.length === 1 ? "" : "s"}): ${abs}`,
      {
        hint: validation.errors.slice(0, 5).join("; ") + (validation.errors.length > 5 ? "; \u2026" : ""),
        path: abs,
        errors: validation.errors,
      },
    );
  }
  return {
    version: typeof parsed.version === "number" ? parsed.version : STATE_VERSION,
    preAttach: Array.isArray(parsed.preAttach)
      ? parsed.preAttach.filter((s) => typeof s === "string")
      : [],
    lastHealthCheck: Array.isArray(parsed.lastHealthCheck)
      ? parsed.lastHealthCheck.filter((e) => e && typeof e === "object" && typeof e.area === "string")
      : [],
  };
}

/**
 * Atomically write the state file. Creates `~/.frootai/` if missing.
 * Pattern: write to `<file>.tmp` then `rename()` — guarantees the
 * file is either fully old or fully new from any concurrent reader,
 * never a half-written body. Throws `McpCliError("state_write_failed")`
 * on filesystem error.
 *
 * @param {object} state
 * @param {object} [deps]
 * @returns {string} absolute path of the written file
 */
function writeState(state, deps) {
  const abs = resolveStatePath(deps);
  const dir = path.dirname(abs);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    throw new McpCliError("state_write_failed", `cannot create ${dir}: ${err && err.message}`, {
      hint: "Check filesystem permissions on your home directory.",
      path: dir,
    });
  }
  const tmp = `${abs}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n", "utf8");
    fs.renameSync(tmp, abs);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* best-effort cleanup */ }
    throw new McpCliError("state_write_failed", `cannot write ${abs}: ${err && err.message}`, {
      hint: "Check disk space + permissions on ~/.frootai/.",
      path: abs,
    });
  }
  return abs;
}

/**
 * Upsert a `lastHealthCheck[]` entry by area name. Pure.
 * Replaces any prior entry for the same area; appends otherwise.
 *
 * @param {Array<object>} list
 * @param {{ area: string, status: string, latencyMs?: number, toolCount?: number, checkedAt?: string }} entry
 * @returns {Array<object>}
 */
function upsertHealthCheck(list, entry) {
  const out = Array.isArray(list) ? list.slice() : [];
  if (!entry || typeof entry.area !== "string" || !entry.area) return out;
  const idx = out.findIndex((e) => e && e.area === entry.area);
  if (idx === -1) out.push(entry);
  else out[idx] = entry;
  return out;
}

module.exports = {
  STATE_FILE_RELPATH,
  STATE_VERSION,
  emptyState,
  resolveStatePath,
  readState,
  writeState,
  upsertHealthCheck,
};
