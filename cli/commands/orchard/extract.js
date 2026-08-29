// @ts-check
/**
 * [H8.4] extract.js — `frootai orchard extract <url>` handler.
 *
 * Contract (verbatim from masterplan §3 row [H8.4]):
 *   `frootai orchard extract <url> [--field <name>]` wired to `[H3]` library.
 *
 * Third stage handler the [H8.1] router lazy-loads. The user passes ONLY a
 * `<url>` (the masterplan-pinned UX); we chain S1 discover → S2 fetch → S3
 * extract internally so the operator never has to pre-fetch a FetchRecord
 * onto disk. This mirrors what `00-pipeline.js` does in production, packaged
 * behind the single-stage `extract` CLI command.
 *
 * Pipeline (per invocation):
 *   1. parse argv (`<url>`, `--field <name>`, `--no-cache`, `--force`,
 *      `--json`, pass-through flags)
 *   2. build GitHub transport from `GH_TOKEN_1/2/3` env vars
 *   3. `discover()` (H1) → resolve normalized owner/repo + upstream SHA
 *      ─ honors `--no-cache` (bypass discover cache READ)
 *      ─ on review-queue routing returns the discover record + exit 69
 *   4. `fetch()`    (H2) → snapshot files into a FetchRecord
 *      ─ honors `--force` (re-fetch even if cached snapshot is fresh)
 *   5. `extract()`  (H3) → derive `RepoFacts` from the FetchRecord
 *      ─ honors `--field <name>` to filter to a single deriver output
 *        (matches the H3 CLI semantics — useful for debugging one deriver)
 *      ─ honors `--verbose` to log per-deriver progress to stderr
 *   6. emit `RepoFacts` JSON to stdout (or just the named field if `--field`
 *      was set)
 *
 * Two surfaces (mirroring the [H8.3] fetch.js shape):
 *
 *   1. Programmatic `runWithDeps(args, ctx, deps)` — pure + injectable.
 *      `deps = { transport, discoverImpl, fetchImpl, extractImpl, env }`
 *      lets tests run the chain hermetically (no real GitHub API, no real
 *      git clone, no real deriver run).
 *
 *   2. Router-facing `run(args, ctx)` — default deps: builds `TokenPool`
 *      from env + dispatches via library `discover` + `fetch` + `extract`.
 *      This is what the [H8.1] `defaultResolveHandler` lazy-requires.
 *
 * Subcommand argv grammar (everything AFTER `extract` in `argv`):
 *   <url>              owner/repo or full GitHub URL (required)
 *   --field <name>     filter output to a single RepoFacts field (debug)
 *   --no-cache         bypass discover cache READ
 *   --force            re-fetch even if cached FetchRecord is fresh
 *   --json             (router-inherited) machine-readable JSON to stdout
 *   --persist-dir <p>  override FetchRecord persist directory
 *   --workdir-root <p> override the temp clone workdir root
 *   --help, -h         print subcommand help + exit OK
 *
 * Exit codes (sysexits-aligned; FIRST failure wins):
 *   0    OK             — RepoFacts emitted (or single field via --field)
 *   64   USAGE          — bad flags / missing <url> / no transport configured
 *   65   DATA_ERR       — discover/fetch failed schema gate; or extract
 *                          failed RepoFacts validation (unless `--field`
 *                          was set, which suppresses the validation gate)
 *   69   UNAVAILABLE    — discover routed to review queue
 *   70   SOFTWARE       — unexpected internal error
 *   77   NOPERM         — 403 / forbidden
 *
 * Non-goals for THIS ship (explicit):
 *   - `--seed-list` bulk mode — separate H8 bulk row.
 *   - Re-implementing transport / cache / fetcher / derivers — H1+H2+H3.
 *   - Auth / paid gating — `extract` is FREE.
 *   - Cross-stage telemetry threading — each H1/H2/H3 emits on its own.
 *
 * License: CC0-1.0.
 */
"use strict";

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

// Lazy-require the H1 + H2 + H3 libraries at handler-load time so a broken
// transitive dep surfaces as EX_SOFTWARE (NOT "not yet wired").
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

/** Local sysexits enum — byte-identical to H1 / H2 / handler norms. */
const EXIT = Object.freeze({
  OK: H1_EXIT.OK,
  USAGE: H1_EXIT.USAGE,
  DATA_ERR: H1_EXIT.DATA_ERR,
  UNAVAILABLE: H1_EXIT.UNAVAILABLE,
  SOFTWARE: H1_EXIT.SOFTWARE,
  NOPERM: H1_EXIT.NOPERM,
});

/** Flags taking a value (`--flag <v>` or `--flag=v`). */
const VALUE_FLAGS = new Set(["--field", "--persist-dir", "--workdir-root"]);

/** Error carrying a sysexits exit code so the handler returns the right number. */
class ExtractHandlerError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, exitCode?: number, cause?: Error }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = "ExtractHandlerError";
    this.code = opts.code || "extract_handler_failed";
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Parse the subcommand-local argv. The first positional is `<url>`; the
 * recognized flags are the H8.4-pinned set. Unknown long flags are USAGE.
 *
 * @param {readonly string[]} argv
 * @returns {{ url: string|null, field: string|null, force: boolean, noCache: boolean, json: boolean, help: boolean, persistDir?: string, workdirRoot?: string }}
 */
function parseExtractArgs(argv) {
  if (!Array.isArray(argv)) {
    throw new TypeError("parseExtractArgs: argv must be an array");
  }
  /** @type {{ url: string|null, field: string|null, force: boolean, noCache: boolean, json: boolean, help: boolean, persistDir?: string, workdirRoot?: string }} */
  const out = { url: null, field: null, force: false, noCache: false, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (typeof arg !== "string") {
      throw new ExtractHandlerError(`argv entry ${i} must be a string`, {
        code: "bad_args", exitCode: EXIT.USAGE,
      });
    }
    if (arg === "--help" || arg === "-h") { out.help = true; continue; }
    if (arg === "--force") { out.force = true; continue; }
    if (arg === "--no-cache") { out.noCache = true; continue; }
    if (arg === "--json") { out.json = true; continue; }

    // value flags — accept both `--flag value` and `--flag=value`
    let handled = false;
    for (const vf of VALUE_FLAGS) {
      if (arg === vf) {
        const v = argv[++i];
        if (typeof v !== "string" || v.length === 0) {
          throw new ExtractHandlerError(`${vf} requires a value`, {
            code: "bad_args", exitCode: EXIT.USAGE,
          });
        }
        if (vf === "--field") out.field = v;
        else if (vf === "--persist-dir") out.persistDir = v;
        else if (vf === "--workdir-root") out.workdirRoot = v;
        handled = true;
        break;
      }
      if (arg.startsWith(`${vf}=`)) {
        const v = arg.slice(vf.length + 1);
        if (v.length === 0) {
          throw new ExtractHandlerError(`${vf}= requires a non-empty value`, {
            code: "bad_args", exitCode: EXIT.USAGE,
          });
        }
        if (vf === "--field") out.field = v;
        else if (vf === "--persist-dir") out.persistDir = v;
        else if (vf === "--workdir-root") out.workdirRoot = v;
        handled = true;
        break;
      }
    }
    if (handled) continue;

    if (arg.startsWith("-")) {
      throw new ExtractHandlerError(`unknown flag: ${arg}`, {
        code: "bad_args", exitCode: EXIT.USAGE,
      });
    }
    if (out.url === null) {
      out.url = arg;
      continue;
    }
    throw new ExtractHandlerError(
      `unexpected positional argument: ${arg} (already have <url>=${out.url})`,
      { code: "bad_args", exitCode: EXIT.USAGE },
    );
  }
  return out;
}

/** Build the `frootai orchard extract --help` banner. */
function buildHelp() {
  return [
    "Usage: frootai orchard extract <url> [options]",
    "",
    "Extract RepoFacts from an upstream repo. Chains S1 discover → S2 fetch → S3 extract:",
    "resolves the URL to a SHA, snapshots files, then runs all derivers and emits RepoFacts.",
    "",
    "Arguments:",
    "  <url>                owner/repo or full https://github.com/owner/repo URL",
    "",
    "Options:",
    "  --field <name>       emit only this RepoFacts field (debug a single deriver)",
    "  --no-cache           bypass discover cache READ",
    "  --force              re-fetch even if cached FetchRecord is fresh",
    "  --json               machine-readable single-line JSON to stdout (default)",
    "  --persist-dir <dir>  override FetchRecord persist directory (default: tmp/harvest)",
    "  --workdir-root <dir> override the temp clone workdir root",
    "  --help, -h           show this help and exit",
    "",
    "Exit codes:",
    "  0   success",
    "  64  bad args / missing <url> / no transport configured",
    "  65  discover/fetch/extract failed schema gate (RepoFacts invalid)",
    "  69  routed to review queue (archived / monorepo / fork)",
    "  70  unexpected internal error",
    "  77  forbidden (private repo or missing PAT scope)",
    "",
    "Examples:",
    "  frootai orchard extract Azure-Samples/azure-search-openai-demo",
    "  frootai orchard extract Azure-Samples/azure-search-openai-demo --field primary_cloud",
    "  frootai orchard extract owner/repo --force --field frameworks",
    "",
  ].join("\n");
}

/** Build the GitHub transport from env vars (same shape as H8.2/H8.3). */
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
 * Resolve the value of a single RepoFacts field. Supports dotted paths
 * (`a.b.c`) so the user can drill into a nested sub-object — useful for
 * debugging the bicep / waf / cost / carbon nested derivers.
 *
 * @param {object} facts
 * @param {string} fieldPath
 * @returns {{ found: boolean, value: any }}
 */
function pickField(facts, fieldPath) {
  if (!facts || typeof facts !== "object") return { found: false, value: undefined };
  const parts = String(fieldPath || "").split(".").filter(Boolean);
  if (parts.length === 0) return { found: false, value: undefined };
  let cursor = /** @type {any} */ (facts);
  for (const p of parts) {
    if (cursor === null || cursor === undefined || typeof cursor !== "object") {
      return { found: false, value: undefined };
    }
    if (!(p in cursor)) return { found: false, value: undefined };
    cursor = cursor[p];
  }
  return { found: true, value: cursor };
}

/**
 * Programmatic surface. Chains discover → fetch → extract with injectable
 * deps so the handler can be exercised hermetically.
 *
 * @param {readonly string[]} args
 * @param {object} ctx       — router ctx { json, quiet, verbose, stdout, stderr }
 * @param {object} [deps]
 * @param {object}                  [deps.transport]    — injectable GH transport
 * @param {typeof discover}         [deps.discoverImpl] — injectable H1
 * @param {typeof fetch}            [deps.fetchImpl]    — injectable H2
 * @param {typeof extract}          [deps.extractImpl]  — injectable H3
 * @param {Record<string, string|undefined>} [deps.env]
 * @returns {Promise<number>}
 */
async function runWithDeps(args, ctx, deps = {}) {
  const stdout = (ctx && ctx.stdout) || ((s) => process.stdout.write(s));
  const stderr = (ctx && ctx.stderr) || ((s) => process.stderr.write(s));
  const env = deps.env || process.env;
  const discoverImpl = deps.discoverImpl || discover;
  const fetchImpl = deps.fetchImpl || fetch;
  const extractImpl = deps.extractImpl || extract;

  /** @type {ReturnType<typeof parseExtractArgs>} */
  let parsed;
  try {
    parsed = parseExtractArgs(args || []);
  } catch (err) {
    if (err instanceof ExtractHandlerError) {
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

  // Build transport from env unless injected.
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

  // ── Step 1: discover (resolve URL → SHA) ─────────────────────────────────
  let discoverResult;
  try {
    discoverResult = await discoverImpl({
      input: parsed.url,
      transport,
      noCache: parsed.noCache,
    });
  } catch (err) {
    const exitCode = mapDiscoverErrorToExit(err);
    const code = (err && /** @type {any} */ (err).code) || "discover_failed";
    const message = err instanceof Error ? err.message : String(err);
    if (json) {
      emit(stdout, JSON.stringify({ ok: false, stage: "discover", error: { code, message, exit_code: exitCode } }));
    } else {
      emit(stderr, `error[discover/${code}]: ${message}`);
    }
    return exitCode;
  }

  // Review-queue → no fetch / no extract.
  if (discoverResult.source === "review-queued" || typeof discoverResult.exitHint === "number") {
    const exitCode = typeof discoverResult.exitHint === "number" ? discoverResult.exitHint : EXIT.UNAVAILABLE;
    if (exitCode !== EXIT.OK) {
      if (json) {
        emit(stdout, JSON.stringify({
          ok: false,
          stage: "discover",
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
    if (json) {
      emit(stdout, JSON.stringify({
        ok: false, stage: "discover",
        error: { code: "no_sha", message, exit_code: EXIT.DATA_ERR },
      }));
    } else {
      emit(stderr, `error[discover]: ${message}`);
    }
    return EXIT.DATA_ERR;
  }

  // ── Step 2: fetch (snapshot @ SHA) ───────────────────────────────────────
  let fetchResult;
  try {
    fetchResult = await fetchImpl({
      owner,
      repo,
      upstreamCommitSha: sha,
      force: parsed.force,
      persistDir: parsed.persistDir,
      workdirRoot: parsed.workdirRoot,
    });
  } catch (err) {
    const exitCode = mapFetchErrorToExit(err);
    const code = (err && /** @type {any} */ (err).code) || "fetch_failed";
    const message = err instanceof Error ? err.message : String(err);
    if (json) {
      emit(stdout, JSON.stringify({ ok: false, stage: "fetch", error: { code, message, exit_code: exitCode } }));
    } else {
      emit(stderr, `error[fetch/${code}]: ${message}`);
    }
    return exitCode;
  }

  const fetchRecord = fetchResult && fetchResult.record;
  if (!fetchRecord || typeof fetchRecord !== "object") {
    const message = "fetch did not return a usable FetchRecord";
    if (json) {
      emit(stdout, JSON.stringify({
        ok: false, stage: "fetch",
        error: { code: "no_record", message, exit_code: EXIT.DATA_ERR },
      }));
    } else {
      emit(stderr, `error[fetch]: ${message}`);
    }
    return EXIT.DATA_ERR;
  }

  // ── Step 3: extract (run all derivers) ───────────────────────────────────
  let extractResult;
  try {
    extractResult = await extractImpl({
      fetchRecord,
      verbose,
      field: parsed.field || undefined,
    });
  } catch (err) {
    const code = (err && /** @type {any} */ (err).code) || "extract_failed";
    const message = err instanceof Error ? err.message : String(err);
    if (json) {
      emit(stdout, JSON.stringify({
        ok: false, stage: "extract",
        error: { code, message, exit_code: EXIT.SOFTWARE },
      }));
    } else {
      emit(stderr, `error[extract/${code}]: ${message}`);
    }
    return EXIT.SOFTWARE;
  }

  // ── Step 4: emit output ──────────────────────────────────────────────────
  // If --field was set, emit only that field's value (JSON). Otherwise emit
  // the whole RepoFacts object. The H3 CLI semantics: a single-field probe
  // suppresses the validation gate so the user can debug one deriver in
  // isolation even when the overall facts wouldn't pass Ajv.
  if (parsed.field) {
    const picked = pickField(extractResult.facts, parsed.field);
    if (!picked.found) {
      const message = `field not found in RepoFacts: ${parsed.field}`;
      if (json) {
        emit(stdout, JSON.stringify({
          ok: false, stage: "extract",
          error: { code: "field_not_found", message, exit_code: EXIT.DATA_ERR },
        }));
      } else {
        emit(stderr, `error[extract]: ${message}`);
      }
      return EXIT.DATA_ERR;
    }
    // Wrap the value in a small envelope so the output is always valid JSON
    // even when the field's value is null / a bare scalar.
    emit(stdout, JSON.stringify({ field: parsed.field, value: picked.value }));
    return EXIT.OK;
  }

  // No --field → emit the whole RepoFacts. JSON-default; if --verbose was
  // requested at the router level we pretty-print for readability.
  const facts = extractResult.facts;
  const body = verbose ? JSON.stringify(facts, null, 2) : JSON.stringify(facts);
  emit(stdout, body);

  // Validation gate — DATA_ERR when Ajv said no.
  if (extractResult.valid === false) {
    const n = Array.isArray(extractResult.errors) ? extractResult.errors.length : 0;
    if (!json) emit(stderr, `warning: RepoFacts validation failed (${n} errors)`);
    return EXIT.DATA_ERR;
  }
  return EXIT.OK;
}

/**
 * Router-facing entry. The [H8.1] router's `defaultResolveHandler` lazy-
 * requires this module and calls `run(args, ctx)`.
 *
 * @param {readonly string[]} args
 * @param {object} ctx
 * @returns {Promise<number>}
 */
function run(args, ctx) {
  return runWithDeps(args, ctx, {});
}

module.exports = {
  EXIT,
  VALUE_FLAGS,
  ExtractHandlerError,
  parseExtractArgs,
  buildHelp,
  buildTransport,
  pickField,
  runWithDeps,
  run,
};
