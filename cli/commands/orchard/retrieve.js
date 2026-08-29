// @ts-check
/**
 * [H8.5] retrieve.js — `frootai orchard retrieve <url>` handler.
 *
 * Contract (verbatim from masterplan §3 row [H8.5]):
 *   `frootai orchard retrieve <url> [--top-k] [--explain]` wired to `[H4]`
 *   library.
 *
 * Fourth stage handler the [H8.1] router lazy-loads. The user passes ONLY a
 * `<url>` (the masterplan-pinned UX); we chain S1 discover → S2 fetch → S3
 * extract → S4 retrieve internally so the operator never has to pre-derive
 * RepoFacts onto disk. Same chaining doctrine as H8.3 + H8.4 — push the
 * boilerplate one layer deeper per stage.
 *
 * Pipeline (per invocation):
 *   1. parse argv (`<url>`, `--top-k`, `--explain`, `--domain`, `--cloud`,
 *      `--mock`, `--persist`, `--no-cache`, `--force`, `--json`, `--help`)
 *   2. build GitHub transport from `GH_TOKEN_1/2/3` env vars
 *   3. `discover()` (H1) → resolve normalized owner/repo + SHA
 *   4. `fetch()`    (H2) → snapshot files into a FetchRecord
 *   5. `extract()`  (H3) → derive RepoFacts (validation must pass; --field NOT
 *                          supported here — retrieve needs the whole facts
 *                          object, not a single deriver's output)
 *   6. `retrieve()` (H4) → embed (or keyword fallback) + top-K + explain →
 *                          RetrievalRecord
 *   7. emit RetrievalRecord JSON to stdout (or pretty-printed when ctx.verbose)
 *
 * Two surfaces (identical pattern to H8.3/H8.4):
 *
 *   1. Programmatic `runWithDeps(args, ctx, deps) → Promise<number>` — pure
 *      + injectable: `{transport, discoverImpl, fetchImpl, extractImpl,
 *      retrieveImpl, env}`. Tests run hermetically.
 *
 *   2. Router-facing `run(args, ctx)` — default deps: builds TokenPool from
 *      env + dispatches via library `discover` + `fetch` + `extract` +
 *      `retrieve`.
 *
 * Subcommand argv grammar (everything AFTER `retrieve` in `argv`):
 *   <url>              owner/repo or full GitHub URL (required)
 *   --top-k <n>        number of nearest plays to retrieve (default H4: 5)
 *   --explain          annotate each pick with a "why" reason ([H4.19])
 *   --domain <name>    hard-filter to a domain ([H4.9])
 *   --cloud <c>        cloud-weight reranking azure|aws|gcp ([H4.10])
 *   --mock             use deterministic offline embeddings (no OpenAI call)
 *   --persist          write the RetrievalRecord to disk under tmp/retrieve/
 *   --no-cache         bypass discover cache READ
 *   --force            re-fetch even if cached FetchRecord is fresh
 *   --json             (router-inherited) machine-readable JSON to stdout
 *   --persist-dir <p>  override FetchRecord persist directory
 *   --workdir-root <p> override the temp clone workdir root
 *   --help, -h         print subcommand help + exit OK
 *
 * Exit codes (sysexits-aligned; FIRST failure wins per stage):
 *   0    OK             — RetrievalRecord emitted
 *   64   USAGE          — bad flags / missing <url> / no transport configured
 *   65   DATA_ERR       — any stage failed its schema gate; or retrieve
 *                          surfaced a `corpus_load_failed` / `no_matches`
 *   69   UNAVAILABLE    — discover routed to review queue
 *   70   SOFTWARE       — unexpected internal error (retrieve fallback exit)
 *   75   TEMPFAIL       — H4 RetrievalError.code === "embed_failed" (retryable)
 *   77   NOPERM         — 403 / forbidden
 *
 * Non-goals for THIS ship:
 *   - `--seed-list` bulk mode (separate H8 bulk row)
 *   - Auth / paid gating — `retrieve` is FREE
 *   - Cross-stage telemetry threading — each stage emits on its own
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
const RETRIEVE_LIB_DIR = path.resolve(
  __dirname, "..", "..", "..", "scripts", "harvest", "lib", "retrieve"
);

// Lazy-require at handler-load time so a broken transitive dep surfaces as
// EX_SOFTWARE (NOT "not yet wired"). Mirrors H8.2/H8.3/H8.4.
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
  retrieve,
} = require(path.join(RETRIEVE_LIB_DIR, "retrieve-cli.js"));

/** Local sysexits enum (byte-identical to upstream conventions). */
const EXIT = Object.freeze({
  OK: H1_EXIT.OK,
  USAGE: H1_EXIT.USAGE,
  DATA_ERR: H1_EXIT.DATA_ERR,
  UNAVAILABLE: H1_EXIT.UNAVAILABLE,
  SOFTWARE: H1_EXIT.SOFTWARE,
  TEMPFAIL: 75,
  NOPERM: H1_EXIT.NOPERM,
});

/** Flags taking a value (`--flag <v>` or `--flag=v`). */
const VALUE_FLAGS = new Set([
  "--top-k", "--domain", "--cloud",
  "--persist-dir", "--workdir-root",
]);

/** Error carrying a sysexits exit code so the handler returns the right number. */
class RetrieveHandlerError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, exitCode?: number, cause?: Error }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = "RetrieveHandlerError";
    this.code = opts.code || "retrieve_handler_failed";
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Parse the subcommand-local argv. The first positional is `<url>`; the
 * recognized flags are the H8.5-pinned set + H4 pass-throughs. Unknown long
 * flags are USAGE.
 *
 * @param {readonly string[]} argv
 * @returns {{ url: string|null, topK: number|null, explain: boolean, domain: string|null, cloud: string|null, mock: boolean, persist: boolean, force: boolean, noCache: boolean, json: boolean, help: boolean, persistDir?: string, workdirRoot?: string }}
 */
function parseRetrieveArgs(argv) {
  if (!Array.isArray(argv)) {
    throw new TypeError("parseRetrieveArgs: argv must be an array");
  }
  /** @type {{ url: string|null, topK: number|null, explain: boolean, domain: string|null, cloud: string|null, mock: boolean, persist: boolean, force: boolean, noCache: boolean, json: boolean, help: boolean, persistDir?: string, workdirRoot?: string }} */
  const out = {
    url: null, topK: null, explain: false, domain: null, cloud: null,
    mock: false, persist: false, force: false, noCache: false, json: false, help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (typeof arg !== "string") {
      throw new RetrieveHandlerError(`argv entry ${i} must be a string`, {
        code: "bad_args", exitCode: EXIT.USAGE,
      });
    }
    if (arg === "--help" || arg === "-h") { out.help = true; continue; }
    if (arg === "--explain") { out.explain = true; continue; }
    if (arg === "--mock") { out.mock = true; continue; }
    if (arg === "--persist") { out.persist = true; continue; }
    if (arg === "--force") { out.force = true; continue; }
    if (arg === "--no-cache") { out.noCache = true; continue; }
    if (arg === "--json") { out.json = true; continue; }

    // value flags
    let handled = false;
    for (const vf of VALUE_FLAGS) {
      if (arg === vf) {
        const v = argv[++i];
        if (typeof v !== "string" || v.length === 0) {
          throw new RetrieveHandlerError(`${vf} requires a value`, {
            code: "bad_args", exitCode: EXIT.USAGE,
          });
        }
        applyValueFlag(out, vf, v);
        handled = true; break;
      }
      if (arg.startsWith(`${vf}=`)) {
        const v = arg.slice(vf.length + 1);
        if (v.length === 0) {
          throw new RetrieveHandlerError(`${vf}= requires a non-empty value`, {
            code: "bad_args", exitCode: EXIT.USAGE,
          });
        }
        applyValueFlag(out, vf, v);
        handled = true; break;
      }
    }
    if (handled) continue;

    if (arg.startsWith("-")) {
      throw new RetrieveHandlerError(`unknown flag: ${arg}`, {
        code: "bad_args", exitCode: EXIT.USAGE,
      });
    }
    if (out.url === null) {
      out.url = arg;
      continue;
    }
    throw new RetrieveHandlerError(
      `unexpected positional argument: ${arg} (already have <url>=${out.url})`,
      { code: "bad_args", exitCode: EXIT.USAGE },
    );
  }
  // --top-k validation: must be a positive integer.
  if (out.topK !== null && (!Number.isInteger(out.topK) || out.topK < 1)) {
    throw new RetrieveHandlerError(`--top-k must be a positive integer (got ${out.topK})`, {
      code: "bad_args", exitCode: EXIT.USAGE,
    });
  }
  // --cloud token validation: azure|aws|gcp (case-insensitive).
  if (out.cloud !== null) {
    const c = String(out.cloud).toLowerCase();
    if (!["azure", "aws", "gcp"].includes(c)) {
      throw new RetrieveHandlerError(`--cloud must be one of azure|aws|gcp (got ${out.cloud})`, {
        code: "bad_args", exitCode: EXIT.USAGE,
      });
    }
    out.cloud = c;
  }
  return out;
}

function applyValueFlag(out, vf, v) {
  if (vf === "--top-k") out.topK = parseInt(v, 10);
  else if (vf === "--domain") out.domain = v;
  else if (vf === "--cloud") out.cloud = v;
  else if (vf === "--persist-dir") out.persistDir = v;
  else if (vf === "--workdir-root") out.workdirRoot = v;
}

/** Build the `frootai orchard retrieve --help` banner. */
function buildHelp() {
  return [
    "Usage: frootai orchard retrieve <url> [options]",
    "",
    "Retrieve nearest reference plays from the corpus for an upstream repo.",
    "Chains S1 discover → S2 fetch → S3 extract → S4 retrieve.",
    "",
    "Arguments:",
    "  <url>                owner/repo or full https://github.com/owner/repo URL",
    "",
    "Retrieve options:",
    "  --top-k <n>          number of nearest plays (default 5)",
    "  --explain            annotate each pick with a 'why' reason",
    "  --domain <name>      hard-filter to a domain (e.g. rag / agent / cookbook)",
    "  --cloud <c>          cloud-weight reranking azure|aws|gcp",
    "  --mock               use deterministic offline embeddings",
    "  --persist            also write the RetrievalRecord to tmp/retrieve/",
    "",
    "Pre-stage options:",
    "  --no-cache           bypass discover cache READ",
    "  --force              re-fetch even if cached FetchRecord is fresh",
    "  --persist-dir <dir>  override FetchRecord persist directory (default: tmp/harvest)",
    "  --workdir-root <dir> override the temp clone workdir root",
    "",
    "Output:",
    "  --json               machine-readable single-line JSON to stdout (default)",
    "  --help, -h           show this help and exit",
    "",
    "Exit codes:",
    "  0   success",
    "  64  bad args / missing <url> / no transport configured",
    "  65  discover/fetch/extract failed schema gate; or retrieve corpus / no_matches",
    "  69  routed to review queue (archived / monorepo / fork)",
    "  70  unexpected internal error",
    "  75  retrieve embed_failed (transient; safe to retry)",
    "  77  forbidden (private repo or missing PAT scope)",
    "",
    "Examples:",
    "  frootai orchard retrieve Azure-Samples/azure-search-openai-demo --top-k 5",
    "  frootai orchard retrieve owner/repo --explain --domain rag",
    "  frootai orchard retrieve owner/repo --mock --persist",
    "",
  ].join("\n");
}

/** Build the GitHub transport from env vars (same shape as H8.2/H8.3/H8.4). */
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
 * Map an H4 RetrievalError (or any error) to a sysexits exit code. Mirrors
 * the H4 CLI's `re.exit_code` fall-back behaviour but normalises a few well-
 * known codes onto the local enum so the handler's exit contract is stable.
 *
 * @param {any} err
 * @returns {number}
 */
function mapRetrieveErrorToExit(err) {
  if (!err) return EXIT.SOFTWARE;
  if (Number.isInteger(err.exit_code)) return /** @type {number} */ (err.exit_code);
  if (Number.isInteger(err.exitCode)) return /** @type {number} */ (err.exitCode);
  const code = err.code || "";
  if (code === "embed_failed") return EXIT.TEMPFAIL;
  if (code === "corpus_load_failed") return EXIT.DATA_ERR;
  if (code === "no_matches") return EXIT.DATA_ERR;
  if (code === "corpus_drift") return EXIT.DATA_ERR;
  return EXIT.SOFTWARE;
}

/**
 * Programmatic surface. Chains discover → fetch → extract → retrieve with
 * injectable deps so the handler can be exercised hermetically.
 *
 * @param {readonly string[]} args
 * @param {object} ctx
 * @param {object} [deps]
 * @param {object}                  [deps.transport]
 * @param {typeof discover}         [deps.discoverImpl]
 * @param {typeof fetch}            [deps.fetchImpl]
 * @param {typeof extract}          [deps.extractImpl]
 * @param {typeof retrieve}         [deps.retrieveImpl]
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
  const retrieveImpl = deps.retrieveImpl || retrieve;

  /** @type {ReturnType<typeof parseRetrieveArgs>} */
  let parsed;
  try {
    parsed = parseRetrieveArgs(args || []);
  } catch (err) {
    if (err instanceof RetrieveHandlerError) {
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

  // Review-queue → bail with the discover exit hint.
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
    extractResult = await extractImpl({
      fetchRecord,
      verbose,
    });
  } catch (err) {
    const code = (err && err.code) || "extract_failed";
    const message = err instanceof Error ? err.message : String(err);
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "extract", error: { code, message, exit_code: EXIT.SOFTWARE } }));
    else emit(stderr, `error[extract/${code}]: ${message}`);
    return EXIT.SOFTWARE;
  }

  if (extractResult.valid === false) {
    // Without --field (H8.4) the validation gate is mandatory here.
    const n = Array.isArray(extractResult.errors) ? extractResult.errors.length : 0;
    const message = `RepoFacts validation failed (${n} errors); cannot proceed to retrieve`;
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

  // ── Step 4: retrieve ──
  let record;
  try {
    record = await retrieveImpl({
      repoFacts: facts,
      topK: parsed.topK != null ? parsed.topK : undefined,
      explain: parsed.explain,
      domain: parsed.domain || undefined,
      cloud: parsed.cloud || undefined,
      mock: parsed.mock,
      persist: parsed.persist,
      verbose,
    });
  } catch (err) {
    const exitCode = mapRetrieveErrorToExit(err);
    const code = (err && err.code) || "retrieve_failed";
    const message = err instanceof Error ? err.message : String(err);
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "retrieve", error: { code, message, exit_code: exitCode } }));
    else emit(stderr, `error[retrieve/${code}]: ${message}`);
    return exitCode;
  }

  // ── Step 5: emit ──
  const body = verbose ? JSON.stringify(record, null, 2) : JSON.stringify(record);
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
  RetrieveHandlerError,
  parseRetrieveArgs,
  buildHelp,
  buildTransport,
  mapRetrieveErrorToExit,
  runWithDeps,
  run,
};
