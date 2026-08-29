// @ts-check
/**
 * [H8.15] free-list.js — free-vs-paid URL classification policy.
 *
 * Contract (verbatim from masterplan §3 row [H8.15]):
 *   Free vs paid policy: `--as-play` of a repo in `harvest-free-list.json`
 *   (50 MSFT anchors) is free; any other URL routes paid; clear messaging
 *   on first run
 *
 * Library module (not a command handler). Wires INTO `install.js` (H8.9)
 * via a new optional `paidGateImpl` dep that follows the same drop-in
 * pattern as H8.14's `buildEntitlementsImpl`. The H8.15 ship delivers
 * the library + the wiring instructions; activating the gate by default
 * (without breaking the 67 H8.9 install tests) is deferred to the
 * future bin-reconciliation sub-phase that wires every handler from
 * a single bin.js entry.
 *
 * **Source-of-truth simplification**: the masterplan calls the free list
 * `harvest-free-list.json (50 MSFT anchors)` — that's the same 50-entry
 * list already shipped as `frootai/orchard/registry/harvest-seed-list.json`
 * (the H6.x seed list). H8.15 REUSES that file as the free-list source
 * of truth — no duplication. A future ship can add a separate
 * `harvest-free-list.json` if free + seed diverge; today they are
 * identical by definition.
 *
 * **Classification:** an input is FREE iff its `owner/repo` shorthand
 * (case-insensitive, with optional `.git` suffix stripped, with any URL
 * `<host>` prefix stripped) matches an entry in the free list's
 * `items[].full_name` field. Otherwise it's PAID.
 *
 * **Public API:**
 *
 *   1. `extractOwnerRepo(input) → {owner, repo}|null`
 *      Pure URL parser. Accepts: `owner/repo`, `https://github.com/owner/repo`,
 *      `git@github.com:owner/repo.git`, `https://...com/owner/repo.git`.
 *      Returns null on unparseable input.
 *
 *   2. `loadFreeList({path?, readFile?})` → `{ok, items?, error?}`
 *      Reads + parses the file (defaults to the seed list path). Each
 *      item must have a `full_name` (owner/repo). Other fields ignored.
 *
 *   3. `classifyInput(input, opts) → {free, tier, owner_repo, source,
 *      upgrade_url?, message}`
 *      Pure classification. `opts.freeList` overrides the loaded list
 *      (so callers can preload it once + classify many).
 *
 *   4. `buildPaidGateImpl(opts) → ({input, env}) => Promise<{free, tier,
 *      message, ok, reason, upgrade_url?, owner_repo, source}>`
 *      Drop-in factory for `install.js` and `re-harvest.js`. Combines
 *      classifyInput (free-list lookup) with the H8.14 entitlements
 *      check (HTTP call when paid + no env override). Returns
 *      `ok:true` when free OR entitled; `ok:false` when paid AND not
 *      entitled — caller maps that to NOPERM 77 + emits the upgrade URL.
 *
 *      Behavior in order:
 *        (a) classifyInput(input, opts) — if free → ok:true (no HTTP)
 *        (b) if env.FROOTAI_PRO=1|true → ok:true (local-dev bypass,
 *            preserved for parity with H8.10/H8.14)
 *        (c) if entitlementsImpl provided → delegate to it; ok:true
 *            when impl returns ok:true
 *        (d) else → ok:false with `paid_not_entitled` reason + upgrade
 *            URL + clear human message
 *
 * License: CC0-1.0.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_FREE_LIST_PATH = path.resolve(
  __dirname, "..", "..", "..", "..", "frootai", "orchard", "registry",
  "harvest-seed-list.json"
);
const DEFAULT_UPGRADE_URL = "https://frootai.dev/pricing";

/** Frozen set of REASON codes (callers may switch on these). */
const REASON_CODES = Object.freeze({
  FREE: "free",
  ENV_PRO: "env_pro",
  ENTITLED: "entitled",
  PAID_NOT_ENTITLED: "paid_not_entitled",
  BAD_INPUT: "bad_input",
  FREE_LIST_LOAD_FAILED: "free_list_load_failed",
});

/** Error carrying a sysexits exit code. */
class FreeListError extends Error {
  /**
   * @param {string} code @param {string} message
   * @param {{ exitCode?: number, cause?: Error }} [opts]
   */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "FreeListError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : 70;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Pure — extract `{owner, repo}` from a URL or shorthand. Returns null
 * on unparseable input. Strips `.git` suffix + any host prefix.
 *
 * Accepted shapes:
 *   - `owner/repo`
 *   - `owner/repo.git`
 *   - `https://github.com/owner/repo`
 *   - `https://github.com/owner/repo.git`
 *   - `http://github.com/owner/repo/`
 *   - `git@github.com:owner/repo.git`
 *   - `git+https://github.com/owner/repo.git`
 *
 * @param {string|null|undefined} input
 * @returns {{ owner: string, repo: string }|null}
 */
function extractOwnerRepo(input) {
  if (typeof input !== "string") return null;
  let s = input.trim();
  if (!s) return null;

  // Strip git+ scheme prefix.
  if (s.startsWith("git+")) s = s.slice(4);

  // git@host:owner/repo.git form → convert to owner/repo
  const sshMatch = /^git@[^:]+:(.+)$/.exec(s);
  if (sshMatch) s = sshMatch[1];

  // Strip http(s):// + host
  const urlMatch = /^https?:\/\/[^/]+\/(.+)$/.exec(s);
  if (urlMatch) s = urlMatch[1];

  // Strip trailing slash + .git suffix
  s = s.replace(/\/+$/, "").replace(/\.git$/, "");

  // Now expect exactly `owner/repo` (no further slashes).
  const parts = s.split("/");
  if (parts.length !== 2) return null;
  const owner = parts[0];
  const repo = parts[1];
  if (!owner || !repo) return null;
  if (!/^[A-Za-z0-9._-]+$/.test(owner) || !/^[A-Za-z0-9._-]+$/.test(repo)) return null;
  return { owner, repo };
}

/**
 * Build the canonical `owner/repo` key for matching. Lowercased so
 * lookups are case-insensitive. Pure.
 *
 * @param {{ owner: string, repo: string }|null|undefined} or
 * @returns {string|null}
 */
function ownerRepoKey(or) {
  if (!or || typeof or.owner !== "string" || typeof or.repo !== "string") return null;
  return `${or.owner.toLowerCase()}/${or.repo.toLowerCase()}`;
}

/**
 * Read + parse the free-list file. Returns `{ok, items?, count?, error?}`.
 * Each accepted item must have a string `full_name` (`owner/repo` shape).
 *
 * @param {object} [opts]
 * @param {string} [opts.path] — defaults to harvest-seed-list.json
 * @param {(p: string, enc: string) => string} [opts.readFile]
 * @returns {{ ok: boolean, items?: Array<{full_name: string}>, count?: number, error?: string, path?: string }}
 */
function loadFreeList(opts = {}) {
  const p = opts.path || DEFAULT_FREE_LIST_PATH;
  const read = opts.readFile || ((q, enc) => fs.readFileSync(q, enc));
  let body;
  try { body = read(p, "utf8"); }
  catch (err) { return { ok: false, error: `cannot read free list at ${p}: ${err && err.message}`, path: p }; }
  let data;
  try { data = JSON.parse(body); }
  catch (err) { return { ok: false, error: `free list ${p} is malformed JSON: ${err && err.message}`, path: p }; }
  if (!data || typeof data !== "object" || !Array.isArray(data.items)) {
    return { ok: false, error: `free list ${p} has no items[] array`, path: p };
  }
  const items = data.items
    .filter((it) => it && typeof it.full_name === "string" && it.full_name.includes("/"))
    .map((it) => ({ full_name: it.full_name }));
  return { ok: true, items, count: items.length, path: p };
}

/**
 * Build a Set of lowercased `owner/repo` keys from a parsed free-list
 * `items[]` array. Pure.
 *
 * @param {Array<{full_name: string}>|null|undefined} items
 * @returns {Set<string>}
 */
function buildFreeKeySet(items) {
  const set = new Set();
  if (!Array.isArray(items)) return set;
  for (const it of items) {
    if (!it || typeof it.full_name !== "string") continue;
    const or = extractOwnerRepo(it.full_name);
    const k = ownerRepoKey(or);
    if (k) set.add(k);
  }
  return set;
}

/**
 * Pure classification — does NOT load anything; caller passes either
 * `opts.freeList` (preloaded list result) or `opts.freeKeys` (preloaded
 * Set). On absent both, falls back to `loadFreeList(opts)` (impure but
 * convenient).
 *
 * Returns shape:
 *   {
 *     free: boolean,
 *     tier: "free" | "paid",
 *     owner_repo: "owner/repo" | null,
 *     source: "free-list" | "url-not-in-free-list" | "bad-input",
 *     upgrade_url?: string,  // only when free=false
 *     message: string,
 *     reason: string,        // one of REASON_CODES
 *     free_list_count?: number,
 *   }
 *
 * @param {string} input
 * @param {object} [opts]
 * @param {{ items?: Array<{full_name: string}>, ok?: boolean }} [opts.freeList]
 * @param {Set<string>} [opts.freeKeys]
 * @param {string} [opts.freeListPath]
 * @param {string} [opts.upgradeUrl]
 * @param {(p: string, enc: string) => string} [opts.readFile]
 */
function classifyInput(input, opts = {}) {
  const upgradeUrl = opts.upgradeUrl || DEFAULT_UPGRADE_URL;
  const or = extractOwnerRepo(input);
  if (!or) {
    return {
      free: false, tier: "paid", owner_repo: null,
      source: "bad-input",
      upgrade_url: upgradeUrl,
      message: `unrecognized input "${input}" — expected owner/repo or a GitHub URL`,
      reason: REASON_CODES.BAD_INPUT,
    };
  }
  const ownerRepo = `${or.owner}/${or.repo}`;
  const lookupKey = ownerRepoKey(or);

  /** @type {Set<string>|undefined} */
  let keys = opts.freeKeys;
  let count = 0;
  if (!keys) {
    let list = opts.freeList;
    if (!list || list.ok === false) {
      list = loadFreeList({ path: opts.freeListPath, readFile: opts.readFile });
    }
    if (!list.ok) {
      // Fail-safe: classify as PAID when free list cannot be loaded.
      return {
        free: false, tier: "paid", owner_repo: ownerRepo,
        source: "url-not-in-free-list",
        upgrade_url: upgradeUrl,
        message: `could not load free list (${list.error}); treating ${ownerRepo} as paid`,
        reason: REASON_CODES.FREE_LIST_LOAD_FAILED,
      };
    }
    keys = buildFreeKeySet(list.items);
    count = list.items ? list.items.length : 0;
  } else {
    count = keys.size;
  }

  if (keys.has(lookupKey)) {
    return {
      free: true, tier: "free", owner_repo: ownerRepo,
      source: "free-list",
      message: `${ownerRepo} is in the free list (${count} anchors) — install proceeds without payment.`,
      reason: REASON_CODES.FREE,
      free_list_count: count,
    };
  }
  return {
    free: false, tier: "paid", owner_repo: ownerRepo,
    source: "url-not-in-free-list",
    upgrade_url: upgradeUrl,
    message: buildPaidMessage(ownerRepo, upgradeUrl, count),
    reason: REASON_CODES.PAID_NOT_ENTITLED,
    free_list_count: count,
  };
}

/**
 * Pure — build the "this URL is paid" first-run message. Includes the
 * upgrade URL prominently per masterplan contract ("clear messaging on
 * first run").
 *
 * @param {string} ownerRepo @param {string} upgradeUrl @param {number} [count]
 */
function buildPaidMessage(ownerRepo, upgradeUrl, count) {
  const lines = [
    `${ownerRepo} is not in the free list (${count || 0} MSFT anchors are free).`,
    `Installing arbitrary upstream repos requires a Pro+ subscription.`,
    `  • Upgrade at: ${upgradeUrl}`,
    `  • Or run \`frootai login\` after upgrading to enable paid installs.`,
    `  • Set FROOTAI_PRO=1 for local-dev bypass.`,
  ];
  return lines.join("\n");
}

/**
 * Build a `paidGateImpl({input, env}) → Promise<...>` function that
 * combines the H8.15 free-list classifier with the H8.14 entitlements
 * check. Drop-in dep for `install.js` + `re-harvest.js`.
 *
 * Behavior (in order):
 *   1. classifyInput(input) — if free → return ok:true (no HTTP call)
 *   2. if env.FROOTAI_PRO=1|true → return ok:true (local-dev bypass)
 *   3. if `entitlementsImpl` provided → await it; ok:true when impl ok:true
 *   4. else → ok:false with paid_not_entitled reason + upgrade URL
 *
 * Returned shape:
 *   { ok, free, tier, message, reason, upgrade_url?, owner_repo, source,
 *     entitlement?: {tier, message, reason, status?} }
 *
 * @param {object} [opts]
 * @param {string} [opts.freeListPath]
 * @param {string} [opts.upgradeUrl]
 * @param {(p: string, enc: string) => string} [opts.readFile]
 * @param {boolean} [opts.honorEnvOverride] — default true
 * @param {(env: object) => Promise<{ok: boolean, tier?: string, message?: string, reason?: string, upgrade_url?: string|null, status?: number|null }>|{ok: boolean, tier?: string, message?: string}} [opts.entitlementsImpl]
 */
function buildPaidGateImpl(opts = {}) {
  const honorEnv = opts.honorEnvOverride !== false;
  // Preload the key-set once per impl-factory call to avoid re-parsing
  // the file on every install. Tests can pass a per-call freeKeys via
  // the deps shape if they need to override.
  let cachedKeys = null;
  let cachedCount = 0;
  const ensureKeys = () => {
    if (cachedKeys) return { keys: cachedKeys, count: cachedCount };
    const list = loadFreeList({ path: opts.freeListPath, readFile: opts.readFile });
    if (list.ok) {
      cachedKeys = buildFreeKeySet(list.items);
      cachedCount = list.items ? list.items.length : 0;
    }
    return { keys: cachedKeys, count: cachedCount };
  };

  return async function paidGateImpl(call) {
    const input = call && typeof call.input === "string" ? call.input : "";
    const env = (call && call.env) || {};

    const { keys, count: _cnt } = ensureKeys();
    const verdict = classifyInput(input, {
      freeKeys: keys || undefined,
      freeListPath: opts.freeListPath,
      readFile: opts.readFile,
      upgradeUrl: opts.upgradeUrl,
    });

    if (verdict.free) {
      return {
        ok: true, free: true, tier: "free",
        message: verdict.message, reason: REASON_CODES.FREE,
        owner_repo: verdict.owner_repo, source: verdict.source,
      };
    }

    if (honorEnv && (env.FROOTAI_PRO === "1" || env.FROOTAI_PRO === "true")) {
      return {
        ok: true, free: false, tier: "pro-env",
        message: `${verdict.owner_repo || input} is paid; FROOTAI_PRO env override accepted (local-dev).`,
        reason: REASON_CODES.ENV_PRO,
        owner_repo: verdict.owner_repo, source: verdict.source,
      };
    }

    if (typeof opts.entitlementsImpl === "function") {
      let entitlement;
      try {
        entitlement = await opts.entitlementsImpl(env);
      } catch (err) {
        entitlement = { ok: false, message: `entitlements check threw: ${err && err.message}` };
      }
      if (entitlement && entitlement.ok === true) {
        return {
          ok: true, free: false, tier: entitlement.tier || "pro",
          message: `${verdict.owner_repo || input} is paid; ${entitlement.tier || "pro"} entitlement verified.`,
          reason: REASON_CODES.ENTITLED,
          owner_repo: verdict.owner_repo, source: verdict.source,
          entitlement,
        };
      }
      // Entitled-check rejected → fall through to paid_not_entitled
      // but enrich the message with the entitlements-side detail.
      const entMsg = entitlement && entitlement.message ? entitlement.message : "entitlements check rejected";
      return {
        ok: false, free: false, tier: (entitlement && entitlement.tier) || "free",
        message: `${verdict.message}\n  • ${entMsg}`,
        reason: REASON_CODES.PAID_NOT_ENTITLED,
        upgrade_url: (entitlement && entitlement.upgrade_url) || verdict.upgrade_url,
        owner_repo: verdict.owner_repo, source: verdict.source,
        entitlement,
      };
    }

    return {
      ok: false, free: false, tier: "free",
      message: verdict.message,
      reason: REASON_CODES.PAID_NOT_ENTITLED,
      upgrade_url: verdict.upgrade_url,
      owner_repo: verdict.owner_repo, source: verdict.source,
    };
  };
}

module.exports = {
  DEFAULT_FREE_LIST_PATH,
  DEFAULT_UPGRADE_URL,
  REASON_CODES,
  FreeListError,
  extractOwnerRepo,
  ownerRepoKey,
  loadFreeList,
  buildFreeKeySet,
  classifyInput,
  buildPaidMessage,
  buildPaidGateImpl,
};
