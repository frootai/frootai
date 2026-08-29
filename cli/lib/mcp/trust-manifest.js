// @ts-check
/**
 * FAI MCP CLI — shipped + user trust manifest loader (M4.7 ship).
 *
 * Shipped manifest lives at
 *   `frootai-core/npm-mcp/src/federation/trust.json`
 * and the user-override file at
 *   `~/.frootai/trust.json`
 *
 * Merge semantics mirror the M2.3 `mergeTrustManifest()` runtime contract
 * (Doctrine #3 — overlay `policies` are NEVER honoured):
 *   - `knownPublishers`: shallow merge; user keys win on conflict.
 *   - `overrides`:        shallow merge; user keys win on conflict.
 *   - `policies`:         shipped value is authoritative; any user
 *                         `policies` block is dropped + counted in
 *                         `droppedPoliciesCount`.
 *
 * M4.8/M4.9 will mutate the user file via `writeUserTrustFile()` (set/unset
 * a single publisher override).
 */
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { McpCliError } = require("./cli-error");

const SHIPPED_TRUST_RELPATH = path.join(
  "frootai-core", "npm-mcp", "src", "federation", "trust.json",
);
const USER_TRUST_RELPATH = path.join(".frootai", "trust.json");

const VALID_TIERS = Object.freeze([
  "first-party-ms",
  "verified-publisher",
  "community",
  "untrusted",
]);

/**
 * Resolve absolute paths for both manifest files. Honours injection so
 * tests never touch the operator's real `~/.frootai/`.
 *
 * @param {object} [deps]
 * @returns {{ shippedPath: string, userPath: string }}
 */
function resolveTrustPaths(deps) {
  const d = deps || {};
  const repoRoot = d.repoRoot || path.resolve(__dirname, "..", "..", "..", "..");
  const home = d.homeDir || os.homedir();
  return {
    shippedPath: d.shippedTrustPath || path.join(repoRoot, SHIPPED_TRUST_RELPATH),
    userPath: d.userTrustPath || path.join(home, USER_TRUST_RELPATH),
  };
}

function _readJsonFile(absPath, errCode, friendlyName) {
  let raw;
  try {
    raw = fs.readFileSync(absPath, "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") return null;
    throw new McpCliError(errCode, `cannot read ${friendlyName} at ${absPath}: ${err && err.message}`, {
      hint: `Check permissions on ${path.dirname(absPath)}.`,
      path: absPath,
    });
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new McpCliError(errCode, `${friendlyName} is not valid JSON: ${absPath}`, {
      hint: "Fix or delete the file to fall back to defaults.",
      path: absPath,
    });
  }
}

/**
 * Read the shipped manifest. Throws `McpCliError("trust_shipped_read_failed")`
 * on filesystem / parse error — the shipped file MUST exist (Doctrine #3:
 * no kernel ever ships without policies).
 *
 * @param {object} [deps]
 * @returns {{ version: number, policies: object, knownPublishers: Record<string, string>, overrides: Record<string, string> }}
 */
function readShippedTrustManifest(deps) {
  const { shippedPath } = resolveTrustPaths(deps);
  const parsed = _readJsonFile(shippedPath, "trust_shipped_read_failed", "shipped trust manifest");
  if (parsed == null) {
    throw new McpCliError("trust_shipped_read_failed", `shipped trust manifest not found at ${shippedPath}`, {
      hint: "Re-install frootai or report this as a packaging bug.",
      path: shippedPath,
    });
  }
  return {
    version: typeof parsed.version === "number" ? parsed.version : 1,
    policies: (parsed.policies && typeof parsed.policies === "object" && !Array.isArray(parsed.policies))
      ? parsed.policies : {},
    knownPublishers: (parsed.knownPublishers && typeof parsed.knownPublishers === "object" && !Array.isArray(parsed.knownPublishers))
      ? parsed.knownPublishers : {},
    overrides: (parsed.overrides && typeof parsed.overrides === "object" && !Array.isArray(parsed.overrides))
      ? parsed.overrides : {},
  };
}

/**
 * Read the user manifest. Returns `null` when absent (first-run UX);
 * throws `McpCliError("trust_user_read_failed")` on malformed JSON.
 *
 * @param {object} [deps]
 * @returns {{ knownPublishers: Record<string, string>, overrides: Record<string, string>, droppedPoliciesCount: number } | null}
 */
function readUserTrustFile(deps) {
  const { userPath } = resolveTrustPaths(deps);
  const parsed = _readJsonFile(userPath, "trust_user_read_failed", "user trust file");
  if (parsed == null) return null;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new McpCliError("trust_user_read_failed", `user trust file root is not an object: ${userPath}`, {
      hint: "Expected `{ knownPublishers?, overrides? }` per the M2.3 contract.",
      path: userPath,
    });
  }
  const droppedPoliciesCount = (parsed.policies && typeof parsed.policies === "object" && !Array.isArray(parsed.policies))
    ? Object.keys(parsed.policies).length : 0;
  return {
    knownPublishers: (parsed.knownPublishers && typeof parsed.knownPublishers === "object" && !Array.isArray(parsed.knownPublishers))
      ? parsed.knownPublishers : {},
    overrides: (parsed.overrides && typeof parsed.overrides === "object" && !Array.isArray(parsed.overrides))
      ? parsed.overrides : {},
    droppedPoliciesCount,
  };
}

/**
 * Merge shipped + user manifests per M2.3 semantics. Pure.
 *
 * @param {ReturnType<typeof readShippedTrustManifest>} shipped
 * @param {ReturnType<typeof readUserTrustFile>} user
 * @returns {{
 *   policies: object,
 *   knownPublishers: Record<string, string>,
 *   overrides: Record<string, string>,
 *   userOverrideKeys: string[],
 *   droppedPoliciesCount: number
 * }}
 */
function mergeTrustManifest(shipped, user) {
  const userKnown = (user && user.knownPublishers) ? user.knownPublishers : {};
  const userOverrides = (user && user.overrides) ? user.overrides : {};
  const droppedPoliciesCount = user ? (user.droppedPoliciesCount || 0) : 0;
  const mergedKnown = { ...shipped.knownPublishers, ...userKnown };
  const mergedOverrides = { ...shipped.overrides, ...userOverrides };
  // Track which publishers the user explicitly touched (either layer).
  const userOverrideKeys = Array.from(new Set([
    ...Object.keys(userKnown),
    ...Object.keys(userOverrides),
  ])).sort();
  return {
    policies: shipped.policies,
    knownPublishers: mergedKnown,
    overrides: mergedOverrides,
    userOverrideKeys,
    droppedPoliciesCount,
  };
}

/**
 * Resolve a publisher's effective tier through the merged manifest +
 * track the `source` (shipped / override / flip / unknown).
 *
 * @param {string} publisher
 * @param {ReturnType<typeof readShippedTrustManifest>} shipped
 * @param {ReturnType<typeof readUserTrustFile>} user
 * @returns {{ publisher: string, tier: string | "unknown", source: "shipped" | "user-override" | "user-flip" | "unknown" }}
 */
function resolvePublisherTier(publisher, shipped, user) {
  const shippedTier = shipped.knownPublishers[publisher];
  const userTier = user && user.knownPublishers && user.knownPublishers[publisher];
  if (userTier && shippedTier && userTier !== shippedTier) {
    return { publisher, tier: userTier, source: "user-flip" };
  }
  if (userTier) return { publisher, tier: userTier, source: "user-override" };
  if (shippedTier) return { publisher, tier: shippedTier, source: "shipped" };
  return { publisher, tier: "unknown", source: "unknown" };
}

/**
 * Atomically write the user trust file. Creates `~/.frootai/` if missing.
 * Pattern mirrors `state.js writeState()`: `<file>.tmp` then `rename()`.
 *
 * Per Doctrine #3 the `policies` block is NEVER persisted — even if the
 * caller passes one, the writer silently drops it so a malformed user
 * file cannot inject runtime-policy overrides.
 *
 * @param {{ knownPublishers?: Record<string, string>, overrides?: Record<string, string> }} body
 * @param {object} [deps]
 * @returns {string} absolute path of the written file
 */
function writeUserTrustFile(body, deps) {
  const { userPath } = resolveTrustPaths(deps);
  const dir = path.dirname(userPath);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    throw new McpCliError("trust_user_write_failed", `cannot create ${dir}: ${err && err.message}`, {
      hint: "Check filesystem permissions on your home directory.",
      path: dir,
    });
  }
  const payload = {
    $schema: "https://frootai.dev/schemas/fai-mcp-trust-v1.json",
    version: 1,
    knownPublishers: (body && body.knownPublishers && typeof body.knownPublishers === "object" && !Array.isArray(body.knownPublishers))
      ? body.knownPublishers : {},
    overrides: (body && body.overrides && typeof body.overrides === "object" && !Array.isArray(body.overrides))
      ? body.overrides : {},
  };
  const tmp = `${userPath}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2) + "\n", "utf8");
    fs.renameSync(tmp, userPath);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* best-effort cleanup */ }
    throw new McpCliError("trust_user_write_failed", `cannot write ${userPath}: ${err && err.message}`, {
      hint: "Check disk space + permissions on ~/.frootai/.",
      path: userPath,
    });
  }
  return userPath;
}

module.exports = {
  SHIPPED_TRUST_RELPATH,
  USER_TRUST_RELPATH,
  VALID_TIERS,
  resolveTrustPaths,
  readShippedTrustManifest,
  readUserTrustFile,
  writeUserTrustFile,
  mergeTrustManifest,
  resolvePublisherTier,
};
