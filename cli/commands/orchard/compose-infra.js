// @ts-check
/**
 * [H8.7] compose-infra.js — `frootai orchard compose-infra <url>` handler.
 *
 * Contract (verbatim from masterplan §3 row [H8.7]):
 *   `frootai orchard compose-infra <url> [--policy <yaml>]` wired to `[H6]`
 *   library.
 *
 * Sixth stage handler the [H8.1] router lazy-loads. The user passes ONLY a
 * `<url>` (the masterplan-pinned UX) plus an optional `--policy <path>`
 * pointing at the org policy file. We chain S1 discover → S2 fetch → S3
 * extract → S6 compose-infra internally so the operator never has to
 * pre-derive RepoFacts onto disk. Retrieve (S4) and scaffold (S5) are
 * SKIPPED — the compose stage is a pure function over RepoFacts, no LLM,
 * no exemplar grounding required.
 *
 * Pipeline (per invocation):
 *   1. parse argv (`<url>`, `--policy <path>`, `--version-lock <path>`,
 *      `--dry-run`, `--out <dir>`, `--no-cache`, `--force`, `--persist-dir`,
 *      `--workdir-root`, `--json`, `--help`)
 *   2. parse policy file (YAML via `js-yaml.load` or JSON via JSON.parse —
 *      file extension drives the choice; mismatched body falls back gracefully)
 *   3. parse version-lock file (JSON only — it's a kind→version map)
 *   4. build GitHub transport from `GH_TOKEN_1/2/3` env vars (SKIPPED on --dry-run)
 *   5. `discover()` (H1) → resolve normalized owner/repo + SHA
 *   6. `fetch()`    (H2) → snapshot files
 *   7. `extract()`  (H3) → derive RepoFacts (validation must pass)
 *   8. `composeInfra()` (H6) → run the [H6.1]→[H6.19] chain with the parsed
 *      policy + version-lock; honor `--dry-run` (plan-only, no file writes)
 *      and `--out <dir>` (default `./infra`).
 *   9. emit the H6 result JSON to stdout (pretty when ctx.verbose; single-line
 *      otherwise). When --dry-run, emit the compact plan summary (matches the
 *      H6 CLI shape).
 *
 * Two surfaces (identical pattern to H8.3..H8.6):
 *
 *   1. Programmatic `runWithDeps(args, ctx, deps) → Promise<number>` — pure
 *      + injectable: `{transport, discoverImpl, fetchImpl, extractImpl,
 *      composeInfraImpl, env, readFile}`. Tests run hermetically with
 *      mocked stages + a mocked filesystem reader.
 *
 *   2. Router-facing `run(args, ctx)` — default deps: builds TokenPool from
 *      env + dispatches via the library `composeInfra()`.
 *
 * Subcommand argv grammar (everything AFTER `compose-infra` in `argv`):
 *   <url>              owner/repo or full GitHub URL (required)
 *   --policy <path>    org policy file (YAML or JSON)
 *   --version-lock <p> kind→version pins (JSON)
 *   --dry-run          plan only — no file writes
 *   --out <dir>        write Bicep + Terraform here (default ./infra)
 *   --no-cache         bypass discover cache READ
 *   --force            re-fetch even if cached FetchRecord is fresh
 *   --persist-dir <p>  override FetchRecord persist directory
 *   --workdir-root <p> override the temp clone workdir root
 *   --json             (router-inherited) machine-readable JSON to stdout
 *   --help, -h         print subcommand help + exit OK
 *
 * Exit codes (sysexits-aligned; FIRST failure wins):
 *   0    OK             — composed (or dry-run plan emitted)
 *   64   USAGE          — bad flags / missing <url> / no transport configured
 *   65   DATA_ERR       — pre-stage schema gate; H6 bicep_build_failed /
 *                          terraform_validate_failed / waf_compliance_failed /
 *                          policy_overlay_failed; OR generic compose failure
 *   66   NOINPUT        — --policy / --version-lock file unreadable or malformed
 *   69   UNAVAILABLE    — discover review queue; OR H6 gold_fallback_required;
 *                          OR H6 avm_resolve_failed (transient/retryable)
 *   70   SOFTWARE       — H6 avm_compose_failed; unexpected internal error
 *   77   NOPERM         — 403 / forbidden
 *
 * Non-goals for THIS ship:
 *   - Skipping H1+H2+H3 with a `--facts <path>` shortcut (deferred; the H6
 *     library CLI already supports it directly via
 *     `node scripts/harvest/lib/compose-infra/compose-infra-cli.js --facts ...`)
 *   - Auth / paid gating — `compose-infra` is FREE.
 *   - `--seed-list` bulk mode.
 *
 * License: CC0-1.0.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DISCOVER_LIB_DIR = path.resolve(
  __dirname, "..", "..", "..", "scripts", "harvest", "lib", "discover"
);
const FETCH_LIB_DIR = path.resolve(
  __dirname, "..", "..", "..", "scripts", "harvest", "lib", "fetch"
);
const EXTRACT_LIB_DIR = path.resolve(
  __dirname, "..", "..", "..", "scripts", "harvest", "lib", "extract"
);
const COMPOSE_LIB_DIR = path.resolve(
  __dirname, "..", "..", "..", "scripts", "harvest", "lib", "compose-infra"
);

// Lazy-require at handler-load time so a broken transitive dep surfaces as
// EX_SOFTWARE (NOT "not yet wired"). Mirrors H8.2..H8.6.
const {
  discover,
  mapErrorToExit: mapDiscoverErrorToExit,
  EXIT: H1_EXIT,
} = require(path.join(DISCOVER_LIB_DIR, "discover-cli.js"));

const {
  fetch,
  mapErrorToExit: mapFetchErrorToExit,
} = require(path.join(FETCH_LIB_DIR, "fetch-cli.js"));

const {
  extract,
} = require(path.join(EXTRACT_LIB_DIR, "extract-cli.js"));

const {
  composeInfra,
} = require(path.join(COMPOSE_LIB_DIR, "compose-infra-cli.js"));

/** Local sysexits enum. */
const EXIT = Object.freeze({
  OK: H1_EXIT.OK,
  USAGE: H1_EXIT.USAGE,
  DATA_ERR: H1_EXIT.DATA_ERR,
  NOINPUT: 66,
  UNAVAILABLE: H1_EXIT.UNAVAILABLE,
  SOFTWARE: H1_EXIT.SOFTWARE,
  NOPERM: H1_EXIT.NOPERM,
});

/** Flags taking a value (`--flag <v>` or `--flag=v`). */
const VALUE_FLAGS = new Set([
  "--policy", "--version-lock", "--out",
  "--persist-dir", "--workdir-root",
]);

/** Error carrying a sysexits exit code so the handler returns the right number. */
class ComposeInfraHandlerError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, exitCode?: number, cause?: Error }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = "ComposeInfraHandlerError";
    this.code = opts.code || "compose_infra_handler_failed";
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Parse the subcommand-local argv. The first positional is `<url>` (required
 * unless --dry-run with no upstream walk — but H6 needs RepoFacts so URL is
 * always required here; --dry-run only skips the file writes, not the stages).
 * Unknown long flags are USAGE.
 *
 * @param {readonly string[]} argv
 * @returns {{ url: string|null, policyPath: string|null, versionLockPath: string|null, dryRun: boolean, outDir: string|null, force: boolean, noCache: boolean, json: boolean, help: boolean, persistDir?: string, workdirRoot?: string }}
 */
function parseComposeInfraArgs(argv) {
  if (!Array.isArray(argv)) {
    throw new TypeError("parseComposeInfraArgs: argv must be an array");
  }
  /** @type {{ url: string|null, policyPath: string|null, versionLockPath: string|null, dryRun: boolean, outDir: string|null, force: boolean, noCache: boolean, json: boolean, help: boolean, persistDir?: string, workdirRoot?: string }} */
  const out = {
    url: null, policyPath: null, versionLockPath: null,
    dryRun: false, outDir: null, force: false, noCache: false,
    json: false, help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (typeof arg !== "string") {
      throw new ComposeInfraHandlerError(`argv entry ${i} must be a string`, {
        code: "bad_args", exitCode: EXIT.USAGE,
      });
    }
    if (arg === "--help" || arg === "-h") { out.help = true; continue; }
    if (arg === "--dry-run") { out.dryRun = true; continue; }
    if (arg === "--force") { out.force = true; continue; }
    if (arg === "--no-cache") { out.noCache = true; continue; }
    if (arg === "--json") { out.json = true; continue; }

    let handled = false;
    for (const vf of VALUE_FLAGS) {
      if (arg === vf) {
        const v = argv[++i];
        if (typeof v !== "string" || v.length === 0) {
          throw new ComposeInfraHandlerError(`${vf} requires a value`, {
            code: "bad_args", exitCode: EXIT.USAGE,
          });
        }
        applyValueFlag(out, vf, v);
        handled = true; break;
      }
      if (arg.startsWith(`${vf}=`)) {
        const v = arg.slice(vf.length + 1);
        if (v.length === 0) {
          throw new ComposeInfraHandlerError(`${vf}= requires a non-empty value`, {
            code: "bad_args", exitCode: EXIT.USAGE,
          });
        }
        applyValueFlag(out, vf, v);
        handled = true; break;
      }
    }
    if (handled) continue;

    if (arg.startsWith("-")) {
      throw new ComposeInfraHandlerError(`unknown flag: ${arg}`, {
        code: "bad_args", exitCode: EXIT.USAGE,
      });
    }
    if (out.url === null) {
      out.url = arg;
      continue;
    }
    throw new ComposeInfraHandlerError(
      `unexpected positional argument: ${arg} (already have <url>=${out.url})`,
      { code: "bad_args", exitCode: EXIT.USAGE },
    );
  }
  return out;
}

function applyValueFlag(out, vf, v) {
  if (vf === "--policy") out.policyPath = v;
  else if (vf === "--version-lock") out.versionLockPath = v;
  else if (vf === "--out") out.outDir = v;
  else if (vf === "--persist-dir") out.persistDir = v;
  else if (vf === "--workdir-root") out.workdirRoot = v;
}

/** Build the `frootai orchard compose-infra --help` banner. */
function buildHelp() {
  return [
    "Usage: frootai orchard compose-infra <url> [options]",
    "",
    "Compose production-grade infra from an upstream repo. Chains:",
    "S1 discover → S2 fetch → S3 extract → S6 compose-infra (skips S4+S5).",
    "Emits infra/main.bicep + parameters.json + terraform/{main.tf,variables.tf}",
    "from Azure Verified Modules — never hand-authored.",
    "",
    "Arguments:",
    "  <url>                owner/repo or full https://github.com/owner/repo URL",
    "",
    "Compose options:",
    "  --policy <path>      org policy file (YAML or JSON; .yaml/.yml → YAML)",
    "  --version-lock <p>   kind→version pins (JSON) to freeze AVM versions",
    "  --dry-run            plan only — no file writes; emits the plan summary",
    "  --out <dir>          write Bicep + Terraform here (default ./infra)",
    "",
    "Pre-stage options:",
    "  --no-cache           bypass discover cache READ",
    "  --force              re-fetch even if cached FetchRecord is fresh",
    "  --persist-dir <dir>  override FetchRecord persist directory",
    "  --workdir-root <dir> override the temp clone workdir root",
    "",
    "Output:",
    "  --json               machine-readable single-line JSON to stdout (default)",
    "  --help, -h           show this help and exit",
    "",
    "Exit codes:",
    "  0   success",
    "  64  bad args / missing <url> / no transport configured",
    "  65  pre-stage failed schema gate; H6 bicep_build / terraform_validate /",
    "       waf_compliance / policy_overlay failed; generic compose failure",
    "  66  --policy or --version-lock file unreadable or malformed",
    "  69  routed to review queue OR gold-fallback required OR avm_resolve_failed",
    "  70  unexpected internal error / H6 avm_compose_failed",
    "  77  forbidden (private repo or missing PAT scope)",
    "",
    "Examples:",
    "  frootai orchard compose-infra Azure-Samples/azure-search-openai-demo",
    "  frootai orchard compose-infra owner/repo --policy ./company-policy.yaml",
    "  frootai orchard compose-infra owner/repo --dry-run --version-lock ./pins.json",
    "  frootai orchard compose-infra owner/repo --out ./play/infra",
    "",
  ].join("\n");
}

/** Build the GitHub transport from env vars (same shape as H8.2..H8.6). */
function buildTransport(env) {
  const e = env || process.env;
  try {
    const { TokenPool } = require(path.join(DISCOVER_LIB_DIR, "token-pool.js"));
    const tokens = [
      { id: "GH_TOKEN_1", value: e.GH_TOKEN_1 },
      { id: "GH_TOKEN_2", value: e.GH_TOKEN_2 },
      { id: "GH_TOKEN_3", value: e.GH_TOKEN_3 },
    ].filter((t) => typeof t.value === "string" && t.value.length > 0);
    if (tokens.length === 0) return null;
    return new TokenPool({ tokens });
  } catch {
    return null;
  }
}

/** Emit a string to a sink that may be `(s) => void` or `{ write }`. */
function emit(sink, text) {
  const s = text.endsWith("\n") ? text : `${text}\n`;
  if (typeof sink === "function") sink(s);
  else if (sink && typeof sink.write === "function") sink.write(s);
}

/**
 * Parse a policy file. YAML or JSON is auto-detected from extension; an
 * unreadable / malformed file returns `{ ok: false, error }`.
 *
 * @param {string} filePath
 * @param {(p: string, enc: string) => string} [readFile] — injectable for tests
 * @returns {{ ok: boolean, data?: any, error?: string }}
 */
function parsePolicyFile(filePath, readFile) {
  const read = readFile || ((p, enc) => fs.readFileSync(p, enc));
  let raw;
  try {
    raw = read(filePath, "utf8");
  } catch (e) {
    return { ok: false, error: `cannot read policy file ${filePath}: ${(e && e.message) || e}` };
  }
  const ext = String(filePath || "").toLowerCase().replace(/.*\./, ".");
  const isYaml = ext === ".yaml" || ext === ".yml";
  try {
    if (isYaml) {
      // eslint-disable-next-line global-require
      const jsYaml = require("js-yaml");
      const data = jsYaml.load(raw, { schema: jsYaml.CORE_SCHEMA });
      if (data === null || typeof data !== "object") {
        return { ok: false, error: `policy ${filePath}: YAML root must be a mapping` };
      }
      return { ok: true, data };
    }
    const data = JSON.parse(raw);
    if (data === null || typeof data !== "object") {
      return { ok: false, error: `policy ${filePath}: JSON root must be an object` };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: `policy ${filePath} parse error: ${(e && e.message) || e}` };
  }
}

/**
 * Parse a version-lock file. JSON only (it's a flat kind→version map).
 *
 * @param {string} filePath
 * @param {(p: string, enc: string) => string} [readFile]
 * @returns {{ ok: boolean, data?: Record<string,string>, error?: string }}
 */
function parseVersionLockFile(filePath, readFile) {
  const read = readFile || ((p, enc) => fs.readFileSync(p, enc));
  let raw;
  try {
    raw = read(filePath, "utf8");
  } catch (e) {
    return { ok: false, error: `cannot read version-lock file ${filePath}: ${(e && e.message) || e}` };
  }
  try {
    const data = JSON.parse(raw);
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, error: `version-lock ${filePath}: JSON root must be an object map` };
    }
    for (const [k, v] of Object.entries(data)) {
      if (typeof v !== "string") {
        return { ok: false, error: `version-lock ${filePath}: value at "${k}" must be a version string` };
      }
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: `version-lock ${filePath} parse error: ${(e && e.message) || e}` };
  }
}

/**
 * Map an H6 ComposeInfraError (or any error) to a sysexits exit code. The H6
 * library tags errors with `.exit_code`; we honor that, fall back to
 * `.exitCode`, then bucket common shapes.
 *
 * @param {any} err @returns {number}
 */
function mapComposeInfraErrorToExit(err) {
  if (!err) return EXIT.SOFTWARE;
  if (Number.isInteger(err.exit_code)) return /** @type {number} */ (err.exit_code);
  if (Number.isInteger(err.exitCode)) return /** @type {number} */ (err.exitCode);
  const code = err.code || "";
  if (code === "gold_fallback_required") return EXIT.UNAVAILABLE;  // 69
  if (code === "avm_resolve_failed") return EXIT.UNAVAILABLE;      // 69
  if (code === "avm_compose_failed") return EXIT.SOFTWARE;          // 70
  if (code === "bicep_build_failed") return EXIT.DATA_ERR;          // 65
  if (code === "terraform_validate_failed") return EXIT.DATA_ERR;   // 65
  if (code === "waf_compliance_failed") return EXIT.DATA_ERR;       // 65
  if (code === "policy_overlay_failed") return EXIT.DATA_ERR;       // 65
  return EXIT.DATA_ERR; // generic compose failure → DATA_ERR (matches H6 CLI fallback)
}

/**
 * Build the compact summary the H6 CLI emits — small enough for stdout
 * even on `--dry-run`. Mirrors the H6 CLI's output exactly so operators
 * scripting against `compose-infra-cli.js` directly get the same shape.
 *
 * @param {object} result @param {boolean} dryRun
 */
function buildSummary(result, dryRun) {
  if (dryRun) {
    return {
      dry_run: true,
      slug: result.slug,
      composition: result.composition,
      coverage: result.coverage,
      module_count: result.module_count,
      hash: result.hash,
      policy_applied: result.policy_applied,
      policy_actions: result.policy_actions,
      files_emitted: result.files_emitted,
    };
  }
  return {
    slug: result.slug,
    composition: result.composition,
    coverage: result.coverage,
    module_count: result.module_count,
    hash: result.hash,
    policy_applied: result.policy_applied,
    policy_actions_count: result.policy_actions_count,
    written: result.written,
  };
}

/**
 * Programmatic surface. Chains discover → fetch → extract → composeInfra
 * with injectable deps so the handler is hermetically testable.
 *
 * @param {readonly string[]} args
 * @param {object} ctx
 * @param {object} [deps]
 * @param {object}                  [deps.transport]
 * @param {typeof discover}         [deps.discoverImpl]
 * @param {typeof fetch}            [deps.fetchImpl]
 * @param {typeof extract}          [deps.extractImpl]
 * @param {typeof composeInfra}     [deps.composeInfraImpl]
 * @param {Record<string, string|undefined>} [deps.env]
 * @param {(p: string, enc: string) => string} [deps.readFile]
 * @returns {Promise<number>}
 */
async function runWithDeps(args, ctx, deps = {}) {
  const stdout = (ctx && ctx.stdout) || ((s) => process.stdout.write(s));
  const stderr = (ctx && ctx.stderr) || ((s) => process.stderr.write(s));
  const env = deps.env || process.env;
  const discoverImpl = deps.discoverImpl || discover;
  const fetchImpl = deps.fetchImpl || fetch;
  const extractImpl = deps.extractImpl || extract;
  const composeInfraImpl = deps.composeInfraImpl || composeInfra;
  const readFile = deps.readFile;

  /** @type {ReturnType<typeof parseComposeInfraArgs>} */
  let parsed;
  try {
    parsed = parseComposeInfraArgs(args || []);
  } catch (err) {
    if (err instanceof ComposeInfraHandlerError) {
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

  if (parsed.url === null) {
    if (json) {
      emit(stdout, JSON.stringify({
        ok: false,
        error: { code: "bad_args", message: "missing <url> argument", exit_code: EXIT.USAGE },
      }));
    } else {
      emit(stderr, "error: missing <url> argument");
      emit(stderr, buildHelp());
    }
    return EXIT.USAGE;
  }

  // ── Parse --policy (YAML or JSON) ──
  let policy;
  if (parsed.policyPath) {
    const r = parsePolicyFile(parsed.policyPath, readFile);
    if (!r.ok) {
      if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "bad_policy", message: r.error, exit_code: EXIT.NOINPUT } }));
      else emit(stderr, `error: ${r.error}`);
      return EXIT.NOINPUT;
    }
    policy = r.data;
  }

  // ── Parse --version-lock (JSON) ──
  let versionLock;
  if (parsed.versionLockPath) {
    const r = parseVersionLockFile(parsed.versionLockPath, readFile);
    if (!r.ok) {
      if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "bad_version_lock", message: r.error, exit_code: EXIT.NOINPUT } }));
      else emit(stderr, `error: ${r.error}`);
      return EXIT.NOINPUT;
    }
    versionLock = r.data;
  }

  // ── Transport (required — H6 still needs RepoFacts from upstream) ──
  const transport = deps.transport || buildTransport(env);
  if (!transport) {
    const message = "no GitHub transport configured (set GH_TOKEN_1, GH_TOKEN_2, or GH_TOKEN_3)";
    if (json) {
      emit(stdout, JSON.stringify({
        ok: false,
        error: { code: "no_transport", message, exit_code: EXIT.USAGE },
      }));
    } else {
      emit(stderr, `error: ${message}`);
    }
    return EXIT.USAGE;
  }

  // ── Step 1: discover ──
  let discoverResult;
  try {
    discoverResult = await discoverImpl({
      input: parsed.url,
      transport,
      noCache: parsed.noCache,
    });
  } catch (err) {
    const exitCode = mapDiscoverErrorToExit(err);
    const code = (err && err.code) || "discover_failed";
    const message = err instanceof Error ? err.message : String(err);
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "discover", error: { code, message, exit_code: exitCode } }));
    else emit(stderr, `error[discover/${code}]: ${message}`);
    return exitCode;
  }

  if (discoverResult.source === "review-queued" || typeof discoverResult.exitHint === "number") {
    const exitCode = typeof discoverResult.exitHint === "number" ? discoverResult.exitHint : EXIT.UNAVAILABLE;
    if (exitCode !== EXIT.OK) {
      if (json) {
        emit(stdout, JSON.stringify({
          ok: false, stage: "discover",
          source: discoverResult.source,
          review_reason: discoverResult.reviewReason || null,
          record: discoverResult.record,
          exit_code: exitCode,
        }));
      } else {
        emit(stderr, `error[discover]: routed to review queue (${discoverResult.reviewReason || "unspecified"})`);
      }
      return exitCode;
    }
  }

  const sha = discoverResult.record && discoverResult.record.upstream_commit_sha;
  const owner = discoverResult.normalized && discoverResult.normalized.owner;
  const repo = discoverResult.normalized && discoverResult.normalized.repo;
  if (typeof sha !== "string" || !sha || !owner || !repo) {
    const message = "discover did not return a usable owner/repo/SHA";
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "discover", error: { code: "no_sha", message, exit_code: EXIT.DATA_ERR } }));
    else emit(stderr, `error[discover]: ${message}`);
    return EXIT.DATA_ERR;
  }

  // ── Step 2: fetch ──
  let fetchResult;
  try {
    fetchResult = await fetchImpl({
      owner, repo,
      upstreamCommitSha: sha,
      force: parsed.force,
      persistDir: parsed.persistDir,
      workdirRoot: parsed.workdirRoot,
    });
  } catch (err) {
    const exitCode = mapFetchErrorToExit(err);
    const code = (err && err.code) || "fetch_failed";
    const message = err instanceof Error ? err.message : String(err);
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "fetch", error: { code, message, exit_code: exitCode } }));
    else emit(stderr, `error[fetch/${code}]: ${message}`);
    return exitCode;
  }

  const fetchRecord = fetchResult && fetchResult.record;
  if (!fetchRecord || typeof fetchRecord !== "object") {
    const message = "fetch did not return a usable FetchRecord";
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "fetch", error: { code: "no_record", message, exit_code: EXIT.DATA_ERR } }));
    else emit(stderr, `error[fetch]: ${message}`);
    return EXIT.DATA_ERR;
  }

  // ── Step 3: extract ──
  let extractResult;
  try {
    extractResult = await extractImpl({ fetchRecord, verbose });
  } catch (err) {
    const code = (err && err.code) || "extract_failed";
    const message = err instanceof Error ? err.message : String(err);
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "extract", error: { code, message, exit_code: EXIT.SOFTWARE } }));
    else emit(stderr, `error[extract/${code}]: ${message}`);
    return EXIT.SOFTWARE;
  }

  if (extractResult.valid === false) {
    const n = Array.isArray(extractResult.errors) ? extractResult.errors.length : 0;
    const message = `RepoFacts validation failed (${n} errors); cannot proceed to compose-infra`;
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "extract", error: { code: "facts_invalid", message, exit_code: EXIT.DATA_ERR, errors: extractResult.errors || [] } }));
    else emit(stderr, `error[extract]: ${message}`);
    return EXIT.DATA_ERR;
  }

  const facts = extractResult.facts;
  if (!facts || typeof facts !== "object") {
    const message = "extract did not return usable RepoFacts";
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "extract", error: { code: "no_facts", message, exit_code: EXIT.DATA_ERR } }));
    else emit(stderr, `error[extract]: ${message}`);
    return EXIT.DATA_ERR;
  }

  // ── Step 4: compose-infra ──
  const outDir = parsed.dryRun
    ? null
    : (parsed.outDir || path.resolve(process.cwd(), "infra"));
  let result;
  try {
    result = await composeInfraImpl({
      repoFacts: facts,
      policy,
      versionLock,
      dryRun: parsed.dryRun,
      outDir,
    });
  } catch (err) {
    const exitCode = mapComposeInfraErrorToExit(err);
    const code = (err && err.code) || "compose_infra_failed";
    const message = err instanceof Error ? err.message : String(err);
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "compose-infra", error: { code, message, exit_code: exitCode } }));
    else emit(stderr, `error[compose-infra/${code}]: ${message}`);
    return exitCode;
  }

  // ── Step 5: emit ──
  const summary = buildSummary(result, parsed.dryRun);
  const body = verbose ? JSON.stringify(summary, null, 2) : JSON.stringify(summary);
  emit(stdout, body);
  return EXIT.OK;
}

/**
 * Router-facing entry. The [H8.1] router's `defaultResolveHandler` lazy-
 * requires this module and calls `run(args, ctx)`.
 * @param {readonly string[]} args @param {object} ctx
 * @returns {Promise<number>}
 */
function run(args, ctx) {
  return runWithDeps(args, ctx, {});
}

module.exports = {
  EXIT,
  VALUE_FLAGS,
  ComposeInfraHandlerError,
  parseComposeInfraArgs,
  parsePolicyFile,
  parseVersionLockFile,
  buildHelp,
  buildTransport,
  mapComposeInfraErrorToExit,
  buildSummary,
  runWithDeps,
  run,
};
