// @ts-check
/**
 * [H8.17] update.js — `frootai update` self-updater.
 *
 * Contract (verbatim from masterplan §3 row [H8.17]):
 *   Update-self: `frootai update` checks `npm view frootai version` +
 *   offers in-place upgrade; nudges to update when version > 2 minors behind
 *
 * Top-level handler at `cli/commands/update/update.js`. Two-surface
 * contract (mirrors H8.13 / H8.16): `runWithDeps(args, ctx, deps)`
 * (hermetic via injectable shell + version-source) + `run(args, ctx)`
 * (defaults wire `npm view` + `npm install -g` via child_process).
 *
 * **Two operating modes:**
 *
 *   ─ CHECK (default): runs `npm view <pkg> version`, compares with the
 *     current local version, prints a friendly status line + (when
 *     `>2 minors behind`) the upgrade nudge with the exact install
 *     command. NEVER mutates the system. Exit 0 always (unless flags
 *     are bad).
 *
 *   ─ APPLY (`--apply` or `--yes`): runs `npm install -g <pkg>@latest`
 *     to perform the in-place upgrade. Requires either `--yes` (no
 *     prompt) OR an interactive confirmImpl. The handler NEVER prompts
 *     in `--json` mode — `--json` always implies `--yes`-or-fail
 *     (callers consuming JSON output don't want a TTY prompt).
 *
 * **Nudge rule (per masterplan):** "nudges to update when version > 2
 * minors behind". `compareSemver(a, b)` returns negative/zero/positive;
 * `isUpdateNudgeNeeded(current, latest)` returns true when the gap is
 * STRICTLY MORE THAN 2 MINOR versions (the masterplan wording). MAJOR
 * gaps always nudge (even if exactly 1 major); MINOR gaps need >2;
 * PATCH gaps never nudge.
 *
 * The nudge helper is EXPORTED so other handlers (a future bin.js
 * dispatcher) can print the nudge BEFORE running their primary work,
 * without invoking the full `update` command. That's how install /
 * commit / etc. surface "you should update" without forcing a user to
 * type a separate command.
 *
 * **Pipeline (per invocation):**
 *   1. parse argv (`--apply`, `--yes`, `--package <name>`,
 *      `--registry <url>`, `--check-only`, `--timeout <sec>`,
 *      `--json`, `--help`)
 *   2. read local version from package.json (or `--current <ver>`)
 *   3. run `npm view <pkg> version --registry <reg>` (or injected
 *      `npmViewImpl({pkg, registry, timeoutSec})`); parse stdout
 *   4. compute gap + nudge boolean
 *   5. CHECK mode: print summary + exit 0
 *      APPLY mode: print confirmation prompt (unless --yes), then run
 *      `npm install -g <pkg>@<latest>` (or injected `npmInstallImpl`).
 *      Honor exit codes from the install: 0 → emit success summary;
 *      non-zero → SOFTWARE 70 with the captured stderr in the envelope.
 *
 * **Two surfaces:**
 *
 *   1. Programmatic `runWithDeps(args, ctx, deps) → Promise<number>`.
 *      Injectable: `{npmViewImpl, npmInstallImpl, currentVersionImpl,
 *      confirmImpl, env, now}`. Tests pass scripted versions + a fake
 *      `npmInstallImpl` to verify the full flow.
 *
 *   2. Router-facing `run(args, ctx)` — default deps shell out via
 *      child_process, read package.json from the cli-relative path.
 *
 * **Subcommand argv grammar** (everything AFTER `update` in `argv`):
 *   --apply               run `npm install -g <pkg>@latest` after check
 *   --yes, -y             skip the confirmation prompt (implied by --json)
 *   --check-only          force CHECK mode (overrides --apply if both)
 *   --package <name>      npm package name (default: `frootai` per
 *                          masterplan; override for forks or staging)
 *   --registry <url>      npm registry URL (default: npm's default)
 *   --current <ver>       override the local version (for testing)
 *   --timeout <sec>       npm view request timeout in seconds (default 30)
 *   --json                machine-readable JSON to stdout (implies --yes)
 *   --help, -h            print help + exit OK
 *
 * **Exit codes (sysexits-aligned):**
 *   0    OK             — check completed OR upgrade succeeded
 *   64   USAGE          — bad flags / bad current-version / bad latest
 *                          response / interactive prompt declined
 *   69   UNAVAILABLE    — `npm view` returned non-zero / unparseable
 *                          version / network error
 *   70   SOFTWARE       — unexpected internal error; `npm install`
 *                          returned non-zero
 *
 * **Non-goals for THIS ship:**
 *   - Auto-running on a schedule (no daemon).
 *   - Inserting the upgrade nudge into other subcommands (deferred to
 *     the bin-reconciliation sub-phase; the `isUpdateNudgeNeeded` helper
 *     is exported so wiring is a one-liner when bin gets rebuilt).
 *   - Beta / RC channel selection (`--channel beta` is a future ship).
 *   - Standalone binary self-update (H8.18 ships pkg-style binaries; a
 *     future ship adds in-place binary replacement).
 *
 * License: CC0-1.0.
 */
"use strict";

const path = require("node:path");
const fs = require("node:fs");
const childProcess = require("node:child_process");

/** Local sysexits enum. */
const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  UNAVAILABLE: 69,
  SOFTWARE: 70,
});

/** Defaults. */
const DEFAULT_PACKAGE = "frootai";
const DEFAULT_TIMEOUT_SEC = 30;
const NUDGE_MINOR_THRESHOLD = 2;

/** Flags taking a value. */
const VALUE_FLAGS = new Set([
  "--package", "--registry", "--current", "--timeout",
]);

/** Error carrying a sysexits exit code. */
class UpdateHandlerError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, exitCode?: number, cause?: Error }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = "UpdateHandlerError";
    this.code = opts.code || "update_handler_failed";
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Pure — parse a semver string `MAJOR.MINOR.PATCH[-prerelease][+build]`
 * into `{major, minor, patch, prerelease?, build?}`. Returns null on
 * unparseable input (the caller decides whether that's USAGE or
 * UNAVAILABLE depending on whose version it came from).
 *
 * @param {string|null|undefined} input
 * @returns {{ major: number, minor: number, patch: number, prerelease: string|null, build: string|null }|null}
 */
function parseSemver(input) {
  if (typeof input !== "string") return null;
  const s = input.trim().replace(/^v/i, "");
  if (!s) return null;
  const re = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;
  const m = re.exec(s);
  if (!m) return null;
  const major = parseInt(m[1], 10);
  const minor = parseInt(m[2], 10);
  const patch = parseInt(m[3], 10);
  if (!Number.isInteger(major) || !Number.isInteger(minor) || !Number.isInteger(patch)) return null;
  return {
    major, minor, patch,
    prerelease: m[4] || null,
    build: m[5] || null,
  };
}

/**
 * Pure — compare two semver strings. Returns negative/zero/positive
 * (Array#sort-compatible). Throws on unparseable input.
 *
 * Pre-release ordering follows the SemVer 2.0 §11 rules: a version with
 * a pre-release tag has LOWER precedence than the same without (1.0.0-rc
 * < 1.0.0). Within pre-release tags, dot-separated identifiers are
 * compared numerically when all-digits, alphanumerically otherwise.
 *
 * @param {string} a @param {string} b
 * @returns {number}
 */
function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa) throw new UpdateHandlerError(`compareSemver: bad input "${a}"`, { code: "bad_semver", exitCode: EXIT.USAGE });
  if (!pb) throw new UpdateHandlerError(`compareSemver: bad input "${b}"`, { code: "bad_semver", exitCode: EXIT.USAGE });
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;
  // Same M.m.p — compare pre-release tags.
  if (pa.prerelease === null && pb.prerelease === null) return 0;
  if (pa.prerelease === null) return 1;   // release > prerelease
  if (pb.prerelease === null) return -1;
  return comparePrerelease(pa.prerelease, pb.prerelease);
}

/** Pure — SemVer §11 pre-release identifier comparison. */
function comparePrerelease(a, b) {
  const aParts = a.split(".");
  const bParts = b.split(".");
  const n = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < n; i++) {
    const ax = aParts[i];
    const bx = bParts[i];
    if (ax === undefined) return -1; // shorter < longer
    if (bx === undefined) return 1;
    const aNum = /^\d+$/.test(ax);
    const bNum = /^\d+$/.test(bx);
    if (aNum && bNum) {
      const an = parseInt(ax, 10);
      const bn = parseInt(bx, 10);
      if (an !== bn) return an - bn;
      continue;
    }
    if (aNum) return -1; // numeric < alphanumeric
    if (bNum) return 1;
    if (ax !== bx) return ax < bx ? -1 : 1;
  }
  return 0;
}

/**
 * Pure — return true when `latest` is "> 2 minor versions ahead" of
 * `current` per masterplan §3 row [H8.17]. Rules:
 *   - latest <= current → false (nothing to nudge)
 *   - any MAJOR bump   → true   (always nudge; semver-breaking)
 *   - same MAJOR, latest.minor - current.minor > 2 → true (the strict
 *      "more than 2 minors" reading of the masterplan)
 *   - same MAJOR + minor diff ≤ 2 → false (still relevant but not yet
 *      stale enough to nudge — caller may still want to print the
 *      "update available" line, just without the nudge banner)
 *   - PATCH-only gaps → false
 *
 * @param {string} current @param {string} latest
 * @returns {boolean}
 */
function isUpdateNudgeNeeded(current, latest) {
  const cur = parseSemver(current);
  const lat = parseSemver(latest);
  if (!cur || !lat) return false;
  if (compareSemver(latest, current) <= 0) return false;
  if (lat.major > cur.major) return true;
  if (lat.major < cur.major) return false;
  if ((lat.minor - cur.minor) > NUDGE_MINOR_THRESHOLD) return true;
  return false;
}

/**
 * Pure — classify the gap between current + latest into a small enum
 * the summary uses for messaging.
 *
 * @param {string} current @param {string} latest
 * @returns {"up_to_date" | "ahead" | "patch_behind" | "minor_behind" | "major_behind"}
 */
function classifyVersionGap(current, latest) {
  const cur = parseSemver(current);
  const lat = parseSemver(latest);
  if (!cur || !lat) return "up_to_date"; // be conservative
  const cmp = compareSemver(latest, current);
  if (cmp === 0) return "up_to_date";
  if (cmp < 0) return "ahead";
  if (lat.major > cur.major) return "major_behind";
  if (lat.minor > cur.minor) return "minor_behind";
  return "patch_behind";
}

/**
 * Parse the subcommand-local argv. NO positionals. Unknown long flags →
 * USAGE.
 *
 * @param {readonly string[]} argv
 * @returns {{ apply: boolean, yes: boolean, checkOnly: boolean, pkg: string, registry: string|null, current: string|null, timeoutSec: number, json: boolean, help: boolean }}
 */
function parseUpdateArgs(argv) {
  if (!Array.isArray(argv)) {
    throw new TypeError("parseUpdateArgs: argv must be an array");
  }
  /** @type {{ apply: boolean, yes: boolean, checkOnly: boolean, pkg: string, registry: string|null, current: string|null, timeoutSec: number, json: boolean, help: boolean }} */
  const out = {
    apply: false, yes: false, checkOnly: false,
    pkg: DEFAULT_PACKAGE, registry: null, current: null,
    timeoutSec: DEFAULT_TIMEOUT_SEC,
    json: false, help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (typeof arg !== "string") {
      throw new UpdateHandlerError(`argv entry ${i} must be a string`, { code: "bad_args", exitCode: EXIT.USAGE });
    }
    if (arg === "--help" || arg === "-h") { out.help = true; continue; }
    if (arg === "--apply") { out.apply = true; continue; }
    if (arg === "--yes" || arg === "-y") { out.yes = true; continue; }
    if (arg === "--check-only") { out.checkOnly = true; continue; }
    if (arg === "--json") { out.json = true; continue; }

    let handled = false;
    for (const vf of VALUE_FLAGS) {
      if (arg === vf) {
        const v = argv[++i];
        if (typeof v !== "string" || v.length === 0) {
          throw new UpdateHandlerError(`${vf} requires a value`, { code: "bad_args", exitCode: EXIT.USAGE });
        }
        applyValueFlag(out, vf, v);
        handled = true; break;
      }
      if (arg.startsWith(`${vf}=`)) {
        const v = arg.slice(vf.length + 1);
        if (v.length === 0) {
          throw new UpdateHandlerError(`${vf}= requires a non-empty value`, { code: "bad_args", exitCode: EXIT.USAGE });
        }
        applyValueFlag(out, vf, v);
        handled = true; break;
      }
    }
    if (handled) continue;

    if (arg.startsWith("-")) {
      throw new UpdateHandlerError(`unknown flag: ${arg}`, { code: "bad_args", exitCode: EXIT.USAGE });
    }
    throw new UpdateHandlerError(
      `unexpected positional argument: ${arg} (frootai update takes no positionals)`,
      { code: "bad_args", exitCode: EXIT.USAGE },
    );
  }
  if (!Number.isInteger(out.timeoutSec) || out.timeoutSec < 1) {
    throw new UpdateHandlerError(`--timeout must be a positive integer (got ${out.timeoutSec})`, { code: "bad_args", exitCode: EXIT.USAGE });
  }
  // --check-only beats --apply (defensive: an automation that wants ONLY
  // a check pass --check-only AND that wins over --apply).
  if (out.checkOnly) out.apply = false;
  // --json always implies --yes (no interactive prompt under JSON output).
  if (out.json) out.yes = true;
  return out;
}

function applyValueFlag(out, vf, v) {
  if (vf === "--package") out.pkg = v;
  else if (vf === "--registry") out.registry = v;
  else if (vf === "--current") out.current = v;
  else if (vf === "--timeout") out.timeoutSec = parseInt(v, 10);
}

/** Build the `frootai update --help` banner. */
function buildHelp() {
  return [
    "Usage: frootai update [options]",
    "",
    "Check for a newer version of the CLI on npm and (optionally) install it",
    "in-place. By default this only CHECKS — pass --apply to perform the upgrade.",
    "",
    "Options:",
    "  --apply               run `npm install -g <pkg>@latest` after the check",
    "  --yes, -y             skip the confirmation prompt (implied by --json)",
    "  --check-only          force check-only mode (overrides --apply)",
    "  --package <name>      npm package name (default: " + DEFAULT_PACKAGE + ")",
    "  --registry <url>      npm registry URL (default: npm's configured registry)",
    "  --current <ver>       override the local version (for testing)",
    "  --timeout <sec>       npm view request timeout (default " + DEFAULT_TIMEOUT_SEC + "s)",
    "  --json                machine-readable JSON to stdout (implies --yes)",
    "  --help, -h            show this help and exit",
    "",
    "Exit codes:",
    "  0   success (check OR upgrade succeeded)",
    "  64  bad args / bad version / interactive prompt declined",
    "  69  `npm view` returned non-zero / unparseable version / network error",
    "  70  unexpected internal error / `npm install` returned non-zero",
    "",
    "Examples:",
    "  frootai update                         # check only",
    "  frootai update --apply --yes           # upgrade in-place (no prompt)",
    "  frootai update --json                  # check + emit JSON envelope",
    "  frootai update --package myfork@cli --apply",
    "",
  ].join("\n");
}

/** Emit a string to a sink that may be `(s) => void` or `{ write }`. */
function emit(sink, text) {
  const s = text.endsWith("\n") ? text : `${text}\n`;
  if (typeof sink === "function") sink(s);
  else if (sink && typeof sink.write === "function") sink.write(s);
}

/**
 * Default `currentVersionImpl` — read `package.json#version` from the
 * package root (3 dirs up from this file: cli/commands/update/ → cli/ →
 * package root). Returns null on read failure (caller falls back to
 * `--current` flag or errors out).
 *
 * @returns {string|null}
 */
function defaultCurrentVersionImpl() {
  const candidates = [
    path.resolve(__dirname, "..", "..", "..", "package.json"),
  ];
  for (const p of candidates) {
    try {
      const body = fs.readFileSync(p, "utf8");
      const pkg = JSON.parse(body);
      if (pkg && typeof pkg.version === "string") return pkg.version;
    } catch { /* try next */ }
  }
  return null;
}

/**
 * Default `npmViewImpl({pkg, registry, timeoutSec}) → Promise<{ok, version?, error?, stderr?}>`.
 * Shells out to `npm view <pkg> version --json` and parses stdout.
 * Always resolves; never throws.
 */
function defaultNpmViewImpl(opts) {
  return new Promise((resolve) => {
    const args = ["view", opts.pkg, "version", "--json"];
    if (opts.registry) { args.push("--registry", opts.registry); }
    const timeoutMs = (opts.timeoutSec || DEFAULT_TIMEOUT_SEC) * 1000;
    let stdout = "";
    let stderr = "";
    let resolved = false;
    let timer = null;
    try {
      const child = childProcess.spawn("npm", args, { stdio: ["ignore", "pipe", "pipe"] });
      child.stdout.on("data", (d) => { stdout += d.toString("utf8"); });
      child.stderr.on("data", (d) => { stderr += d.toString("utf8"); });
      child.on("error", (err) => {
        if (resolved) return; resolved = true;
        if (timer) clearTimeout(timer);
        resolve({ ok: false, error: `failed to spawn npm: ${err && err.message}`, stderr });
      });
      child.on("close", (code) => {
        if (resolved) return; resolved = true;
        if (timer) clearTimeout(timer);
        if (code !== 0) {
          resolve({ ok: false, error: `npm view exited with code ${code}`, stderr, exit_code: code });
          return;
        }
        const trimmed = stdout.trim().replace(/^"|"$/g, "");
        resolve({ ok: true, version: trimmed });
      });
      timer = setTimeout(() => {
        if (resolved) return; resolved = true;
        try { child.kill("SIGTERM"); } catch { /* */ }
        resolve({ ok: false, error: `npm view timed out after ${opts.timeoutSec || DEFAULT_TIMEOUT_SEC}s`, stderr });
      }, timeoutMs);
    } catch (err) {
      if (resolved) return; resolved = true;
      if (timer) clearTimeout(timer);
      resolve({ ok: false, error: `npm view failed: ${err && err.message}`, stderr });
    }
  });
}

/**
 * Default `npmInstallImpl({pkg, version, registry}) → Promise<{ok, exit_code, stdout, stderr}>`.
 * Shells out to `npm install -g <pkg>@<version>`. Always resolves.
 */
function defaultNpmInstallImpl(opts) {
  return new Promise((resolve) => {
    const target = opts.version ? `${opts.pkg}@${opts.version}` : opts.pkg;
    const args = ["install", "-g", target];
    if (opts.registry) { args.push("--registry", opts.registry); }
    let stdout = "";
    let stderr = "";
    let resolved = false;
    try {
      const child = childProcess.spawn("npm", args, { stdio: ["ignore", "pipe", "pipe"] });
      child.stdout.on("data", (d) => { stdout += d.toString("utf8"); });
      child.stderr.on("data", (d) => { stderr += d.toString("utf8"); });
      child.on("error", (err) => {
        if (resolved) return; resolved = true;
        resolve({ ok: false, exit_code: -1, stdout, stderr, error: `failed to spawn npm: ${err && err.message}` });
      });
      child.on("close", (code) => {
        if (resolved) return; resolved = true;
        resolve({ ok: code === 0, exit_code: code, stdout, stderr });
      });
    } catch (err) {
      if (resolved) return; resolved = true;
      resolve({ ok: false, exit_code: -1, stdout, stderr, error: `npm install failed: ${err && err.message}` });
    }
  });
}

/**
 * Build the human-readable summary line printed in non-json mode.
 * Always one line — additional context lines come from the caller.
 *
 * @param {string} current @param {string} latest @param {string} gap
 */
function buildStatusLine(current, latest, gap) {
  switch (gap) {
    case "up_to_date":   return `Up to date (v${current}).`;
    case "ahead":        return `Local version ${current} is AHEAD of npm latest ${latest} (dev build?).`;
    case "patch_behind": return `Update available: ${current} → ${latest} (patch).`;
    case "minor_behind": return `Update available: ${current} → ${latest} (minor).`;
    case "major_behind": return `MAJOR update available: ${current} → ${latest}.`;
    default:             return `Compared ${current} vs ${latest} (${gap}).`;
  }
}

/**
 * Build the nudge text shown when `isUpdateNudgeNeeded` is true.
 *
 * @param {string} current @param {string} latest @param {string} pkg
 */
function buildNudgeText(current, latest, pkg) {
  const cmd = `frootai update --apply --yes`;
  return [
    "",
    "  ┌─ Update strongly recommended ──",
    `  │ You're running ${current}; latest is ${latest}.`,
    `  │ Run: ${cmd}    (or: npm install -g ${pkg}@latest)`,
    "  └─",
    "",
  ].join("\n");
}

/**
 * Programmatic surface. Hermetic via injectable deps.
 *
 * @param {readonly string[]} args
 * @param {object} ctx
 * @param {object} [deps]
 * @param {() => string|null} [deps.currentVersionImpl]
 * @param {(opts: {pkg: string, registry?: string|null, timeoutSec: number}) => Promise<{ok: boolean, version?: string, error?: string, stderr?: string}>} [deps.npmViewImpl]
 * @param {(opts: {pkg: string, version?: string, registry?: string|null}) => Promise<{ok: boolean, exit_code: number, stdout?: string, stderr?: string, error?: string}>} [deps.npmInstallImpl]
 * @param {(prompt: string) => Promise<boolean>} [deps.confirmImpl]
 * @param {Record<string, string|undefined>} [deps.env]
 * @returns {Promise<number>}
 */
async function runWithDeps(args, ctx, deps = {}) {
  const stdout = (ctx && ctx.stdout) || ((s) => process.stdout.write(s));
  const stderr = (ctx && ctx.stderr) || ((s) => process.stderr.write(s));
  const currentVersionImpl = deps.currentVersionImpl || defaultCurrentVersionImpl;
  const npmViewImpl = deps.npmViewImpl || defaultNpmViewImpl;
  const npmInstallImpl = deps.npmInstallImpl || defaultNpmInstallImpl;

  /** @type {ReturnType<typeof parseUpdateArgs>} */
  let parsed;
  try {
    parsed = parseUpdateArgs(args || []);
  } catch (err) {
    if (err instanceof UpdateHandlerError) {
      emit(stderr, `error: ${err.message}`);
      emit(stderr, buildHelp());
      return err.exitCode;
    }
    emit(stderr, `error: ${err instanceof Error ? err.message : String(err)}`);
    return EXIT.SOFTWARE;
  }

  if (parsed.help) {
    emit(stdout, buildHelp());
    return EXIT.OK;
  }

  const json = !!(parsed.json || (ctx && ctx.json));
  const verbose = !!(ctx && ctx.verbose);

  // 1. Resolve current version.
  const current = parsed.current || currentVersionImpl();
  if (!current || !parseSemver(current)) {
    const message = current
      ? `bad local version "${current}" — cannot compare against npm`
      : "could not determine local version (no package.json found; pass --current <ver> to override)";
    if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "bad_current_version", message, exit_code: EXIT.USAGE } }));
    else emit(stderr, `error: ${message}`);
    return EXIT.USAGE;
  }

  // 2. Query npm view.
  /** @type {Awaited<ReturnType<typeof defaultNpmViewImpl>>} */
  let viewResult;
  try {
    viewResult = await npmViewImpl({ pkg: parsed.pkg, registry: parsed.registry, timeoutSec: parsed.timeoutSec });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "npm_view_threw", message, exit_code: EXIT.UNAVAILABLE } }));
    else emit(stderr, `error: ${message}`);
    return EXIT.UNAVAILABLE;
  }
  if (!viewResult || viewResult.ok !== true) {
    const message = (viewResult && viewResult.error) || "`npm view` failed";
    if (json) emit(stdout, JSON.stringify({
      ok: false, current,
      error: {
        code: "npm_view_failed",
        message,
        stderr: viewResult && viewResult.stderr ? viewResult.stderr.slice(0, 4096) : null,
        exit_code: EXIT.UNAVAILABLE,
      },
    }));
    else emit(stderr, `error[npm view]: ${message}`);
    return EXIT.UNAVAILABLE;
  }
  const latest = viewResult.version;
  if (!latest || !parseSemver(latest)) {
    const message = `npm view returned unparseable version "${latest}"`;
    if (json) emit(stdout, JSON.stringify({ ok: false, current, error: { code: "bad_latest_version", message, exit_code: EXIT.UNAVAILABLE } }));
    else emit(stderr, `error: ${message}`);
    return EXIT.UNAVAILABLE;
  }

  // 3. Compute gap + nudge.
  const gap = classifyVersionGap(current, latest);
  const nudge = isUpdateNudgeNeeded(current, latest);
  const upToDate = gap === "up_to_date" || gap === "ahead";

  // 4a. CHECK mode (or up-to-date in APPLY mode — no work to do).
  if (!parsed.apply || upToDate) {
    if (json) {
      emit(stdout, JSON.stringify({
        ok: true, mode: "check",
        package: parsed.pkg, current, latest, gap, nudge,
        up_to_date: upToDate,
        action: "none",
      }));
    } else {
      emit(stdout, buildStatusLine(current, latest, gap));
      if (nudge) emit(stdout, buildNudgeText(current, latest, parsed.pkg));
      if (parsed.apply && upToDate) emit(stdout, "Nothing to apply.");
    }
    return EXIT.OK;
  }

  // 4b. APPLY mode: confirm (unless --yes / --json) + install.
  if (!parsed.yes) {
    if (typeof deps.confirmImpl !== "function") {
      const message = "interactive confirmation required (no confirmImpl available); pass --yes to skip the prompt";
      if (json) emit(stdout, JSON.stringify({ ok: false, current, latest, gap, error: { code: "needs_yes", message, exit_code: EXIT.USAGE } }));
      else emit(stderr, `error: ${message}`);
      return EXIT.USAGE;
    }
    /** @type {boolean} */
    let answer;
    try {
      answer = !!(await deps.confirmImpl(`Upgrade ${parsed.pkg} from ${current} to ${latest}? [y/N] `));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "confirm_failed", message, exit_code: EXIT.USAGE } }));
      else emit(stderr, `error: ${message}`);
      return EXIT.USAGE;
    }
    if (!answer) {
      const message = "upgrade declined by user";
      if (json) emit(stdout, JSON.stringify({ ok: false, current, latest, gap, error: { code: "declined", message, exit_code: EXIT.USAGE } }));
      else emit(stdout, message);
      return EXIT.USAGE;
    }
  }

  /** @type {Awaited<ReturnType<typeof defaultNpmInstallImpl>>} */
  let installResult;
  try {
    installResult = await npmInstallImpl({ pkg: parsed.pkg, version: latest, registry: parsed.registry });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (json) emit(stdout, JSON.stringify({ ok: false, current, latest, gap, error: { code: "npm_install_threw", message, exit_code: EXIT.SOFTWARE } }));
    else emit(stderr, `error: ${message}`);
    return EXIT.SOFTWARE;
  }
  if (!installResult || installResult.ok !== true) {
    const message = (installResult && installResult.error) || `npm install exited with code ${installResult ? installResult.exit_code : "?"}`;
    if (json) emit(stdout, JSON.stringify({
      ok: false, current, latest, gap,
      error: {
        code: "npm_install_failed",
        message,
        exit_code: EXIT.SOFTWARE,
        npm_exit_code: installResult ? installResult.exit_code : null,
        stderr: installResult && installResult.stderr ? installResult.stderr.slice(0, 4096) : null,
      },
    }));
    else emit(stderr, `error[npm install]: ${message}`);
    return EXIT.SOFTWARE;
  }

  // 5. Success summary.
  if (json) {
    const summary = {
      ok: true, mode: "apply",
      package: parsed.pkg, current, latest, gap, nudge,
      action: "installed",
      installed_version: latest,
    };
    const body = verbose ? JSON.stringify(summary, null, 2) : JSON.stringify(summary);
    emit(stdout, body);
  } else {
    emit(stdout, `Upgraded ${parsed.pkg} from ${current} to ${latest}.`);
  }
  return EXIT.OK;
}

/** Router-facing entry. */
function run(args, ctx) { return runWithDeps(args, ctx, {}); }

module.exports = {
  EXIT,
  VALUE_FLAGS,
  DEFAULT_PACKAGE,
  DEFAULT_TIMEOUT_SEC,
  NUDGE_MINOR_THRESHOLD,
  UpdateHandlerError,
  parseSemver,
  compareSemver,
  comparePrerelease,
  isUpdateNudgeNeeded,
  classifyVersionGap,
  parseUpdateArgs,
  buildHelp,
  buildStatusLine,
  buildNudgeText,
  defaultCurrentVersionImpl,
  defaultNpmViewImpl,
  defaultNpmInstallImpl,
  runWithDeps,
  run,
};
