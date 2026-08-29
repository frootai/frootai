// @ts-check
/**
 * [H8.3] fetch.js — `frootai orchard fetch <url>` handler.
 *
 * Contract (verbatim from masterplan §3 row [H8.3]):
 *   `frootai orchard fetch <url> [--force] [--no-cache]` wired to `[H2]`
 *   library.
 *
 * This is the second stage handler the [H8.1] router lazy-loads. The user
 * passes ONLY a `<url>` (the masterplan-pinned UX); we chain S1 discover →
 * S2 fetch internally so the operator never has to paste a SHA. This
 * mirrors what `00-pipeline.js` does in production, just packaged behind the
 * single-stage `fetch` CLI command.
 *
 * Pipeline (per invocation):
 *   1. parse argv (`<url>`, `--force`, `--no-cache`, pass-through flags)
 *   2. build GitHub transport from `GH_TOKEN_1/2/3` env vars
 *   3. `discover()` (H1) → resolve normalized owner/repo + upstream SHA
 *      ─ honors `--no-cache` (bypass discover cache READ)
 *      ─ on review-queue routing returns the discover record + exit 69
 *   4. `fetch()` (H2) with `{owner, repo, upstreamCommitSha, force}`
 *      ─ honors `--force` (re-fetch even if cached snapshot is fresh)
 *      ─ writes the FetchRecord under `--persist-dir` (default `tmp/harvest`)
 *   5. format output via the H2 `formatOutput` (JSON by default; --verbose
 *      switches to pretty-printed record + trace)
 *
 * Two surfaces (mirroring the [H8.2] discover.js shape):
 *
 *   1. Programmatic `runWithDeps(args, ctx, deps)` — pure + injectable.
 *      `deps = { transport, discoverImpl, fetchImpl, env }` lets tests run
 *      the chain hermetically (no real GitHub API, no real git clone).
 *
 *   2. Router-facing `run(args, ctx)` — default deps: builds `TokenPool`
 *      from env + dispatches via the library `discover` + `fetch`. This is
 *      what the [H8.1] `defaultResolveHandler` lazy-requires.
 *
 * Subcommand argv grammar (everything AFTER `fetch` in `argv`):
 *   <url>              owner/repo or full GitHub URL (required)
 *   --force            re-fetch even if cached FetchRecord is fresh
 *   --no-cache         bypass discover cache READ (still WRITES fresh record)
 *   --json             (router-inherited) machine-readable JSON to stdout
 *   --persist-dir <p>  override FetchRecord persist directory
 *   --workdir-root <p> override the temp clone workdir root
 *   --help, -h         print subcommand help + exit OK
 *
 * Exit codes (sysexits-aligned; FIRST failure wins — discover's exit code
 * takes precedence when discover fails, otherwise the fetch's exit):
 *   0    OK             — snapshot persisted (or already cached + not forced)
 *   64   USAGE          — bad flags / missing <url> / no transport configured
 *   65   DATA_ERR       — discover or fetch failed schema gate
 *   69   UNAVAILABLE    — discover routed to review queue
 *   70   SOFTWARE       — unexpected internal error
 *   77   NOPERM         — 403 / forbidden
 *
 * Non-goals for THIS ship (explicit):
 *   - `--seed-list` bulk mode — separate bulk row in H8.
 *   - Re-implementing transport / cache / fetcher — H1 + H2 primitives.
 *   - Auth / paid gating — `fetch` is FREE (no entitlements pre-flight).
 *   - Cross-stage telemetry threading — H1 + H2 already emit on their own.
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

// Lazy-require the H1 + H2 libraries at handler-load time so a broken
// transitive dep surfaces as EX_SOFTWARE (NOT "not yet wired").
const {
  discover,
  mapErrorToExit: mapDiscoverErrorToExit,
  EXIT: H1_EXIT,
} = require(path.join(DISCOVER_LIB_DIR, "discover-cli.js"));

const {
  fetch,
  formatOutput: formatFetchOutput,
  mapErrorToExit: mapFetchErrorToExit,
  EXIT: H2_EXIT,
} = require(path.join(FETCH_LIB_DIR, "fetch-cli.js"));

/** Local sysexits enum — byte-identical to H1 + H2. */
const EXIT = Object.freeze({
  OK: H1_EXIT.OK,
  USAGE: H1_EXIT.USAGE,
  DATA_ERR: H1_EXIT.DATA_ERR,
  UNAVAILABLE: H1_EXIT.UNAVAILABLE,
  SOFTWARE: H1_EXIT.SOFTWARE,
  NOPERM: H1_EXIT.NOPERM,
});

/** Flags taking a value (`--flag <v>` or `--flag=v`). */
const VALUE_FLAGS = new Set(["--persist-dir", "--workdir-root"]);

/** Error carrying a sysexits exit code so the handler returns the right number. */
class FetchHandlerError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, exitCode?: number, cause?: Error }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = "FetchHandlerError";
    this.code = opts.code || "fetch_handler_failed";
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Parse the subcommand-local argv. The first positional is `<url>`; the
 * recognized flags are the H8.3-pinned set. Unknown long flags are USAGE.
 *
 * @param {readonly string[]} argv
 * @returns {{ url: string|null, force: boolean, noCache: boolean, json: boolean, help: boolean, persistDir?: string, workdirRoot?: string }}
 */
function parseFetchArgs(argv) {
  if (!Array.isArray(argv)) {
    throw new TypeError("parseFetchArgs: argv must be an array");
  }
  /** @type {{ url: string|null, force: boolean, noCache: boolean, json: boolean, help: boolean, persistDir?: string, workdirRoot?: string }} */
  const out = { url: null, force: false, noCache: false, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (typeof arg !== "string") {
      throw new FetchHandlerError(`argv entry ${i} must be a string`, {
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
          throw new FetchHandlerError(`${vf} requires a value`, {
            code: "bad_args", exitCode: EXIT.USAGE,
          });
        }
        if (vf === "--persist-dir") out.persistDir = v;
        else if (vf === "--workdir-root") out.workdirRoot = v;
        handled = true;
        break;
      }
      if (arg.startsWith(`${vf}=`)) {
        const v = arg.slice(vf.length + 1);
        if (v.length === 0) {
          throw new FetchHandlerError(`${vf}= requires a non-empty value`, {
            code: "bad_args", exitCode: EXIT.USAGE,
          });
        }
        if (vf === "--persist-dir") out.persistDir = v;
        else if (vf === "--workdir-root") out.workdirRoot = v;
        handled = true;
        break;
      }
    }
    if (handled) continue;

    if (arg.startsWith("-")) {
      throw new FetchHandlerError(`unknown flag: ${arg}`, {
        code: "bad_args", exitCode: EXIT.USAGE,
      });
    }
    if (out.url === null) {
      out.url = arg;
      continue;
    }
    throw new FetchHandlerError(
      `unexpected positional argument: ${arg} (already have <url>=${out.url})`,
      { code: "bad_args", exitCode: EXIT.USAGE },
    );
  }
  return out;
}

/** Build the `frootai orchard fetch --help` banner. */
function buildHelp() {
  return [
    "Usage: frootai orchard fetch <url> [options]",
    "",
    "Snapshot upstream repo files at the head commit. Chains S1 discover → S2 fetch:",
    "discovers the URL to resolve the SHA, then clones + persists a FetchRecord.",
    "",
    "Arguments:",
    "  <url>                owner/repo or full https://github.com/owner/repo URL",
    "",
    "Options:",
    "  --force              re-fetch even if cached FetchRecord is fresh",
    "  --no-cache           bypass discover cache READ (still writes fresh record)",
    "  --json               machine-readable single-line JSON to stdout (default)",
    "  --persist-dir <dir>  override FetchRecord persist directory (default: tmp/harvest)",
    "  --workdir-root <dir> override the temp clone workdir root",
    "  --help, -h           show this help and exit",
    "",
    "Exit codes:",
    "  0   success",
    "  64  bad args / missing <url> / no transport configured",
    "  65  discover or fetch failed schema gate",
    "  69  routed to review queue (archived / monorepo / fork)",
    "  70  unexpected internal error",
    "  77  forbidden (private repo or missing PAT scope)",
    "",
    "Examples:",
    "  frootai orchard fetch Azure-Samples/azure-search-openai-demo",
    "  frootai orchard fetch https://github.com/Azure-Samples/azure-search-openai-demo --force",
    "",
  ].join("\n");
}

/**
 * Build the GitHub transport from env vars (same shape as [H8.2] discover.js).
 * @param {Record<string, string|undefined>} env
 * @returns {object|null}
 */
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

/**
 * Emit a string to a sink that may be `(s) => void` or `{ write }`.
 * @param {any} sink @param {string} text
 */
function emit(sink, text) {
  const s = text.endsWith("\n") ? text : `${text}\n`;
  if (typeof sink === "function") sink(s);
  else if (sink && typeof sink.write === "function") sink.write(s);
}

/**
 * Programmatic surface. Chains discover → fetch with injectable deps so the
 * handler can be exercised hermetically.
 *
 * @param {readonly string[]} args
 * @param {object} ctx       — router ctx { json, quiet, verbose, stdout, stderr }
 * @param {object} [deps]
 * @param {object} [deps.transport]                — injectable GH transport
 * @param {typeof discover} [deps.discoverImpl]    — injectable H1 orchestrator
 * @param {typeof fetch}    [deps.fetchImpl]       — injectable H2 orchestrator
 * @param {Record<string, string|undefined>} [deps.env]
 * @returns {Promise<number>}
 */
async function runWithDeps(args, ctx, deps = {}) {
  const stdout = (ctx && ctx.stdout) || ((s) => process.stdout.write(s));
  const stderr = (ctx && ctx.stderr) || ((s) => process.stderr.write(s));
  const env = deps.env || process.env;
  const discoverImpl = deps.discoverImpl || discover;
  const fetchImpl = deps.fetchImpl || fetch;

  /** @type {ReturnType<typeof parseFetchArgs>} */
  let parsed;
  try {
    parsed = parseFetchArgs(args || []);
  } catch (err) {
    if (err instanceof FetchHandlerError) {
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

  // If discover routed to review-queue, honor its exit hint and surface the
  // reason — DO NOT proceed to fetch.
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
  try {
    const fetchResult = await fetchImpl({
      owner,
      repo,
      upstreamCommitSha: sha,
      force: parsed.force,
      persistDir: parsed.persistDir,
      workdirRoot: parsed.workdirRoot,
    });
    const { stdout: outText, stderr: errText } = formatFetchOutput(fetchResult, {
      json: json || !verbose,
      verbose,
    });
    if (outText) emit(stdout, outText);
    if (errText) emit(stderr, errText);
    return EXIT.OK;
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
  FetchHandlerError,
  parseFetchArgs,
  buildHelp,
  buildTransport,
  runWithDeps,
  run,
};
