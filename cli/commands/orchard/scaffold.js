// @ts-check
/**
 * [H8.6] scaffold.js — `frootai orchard scaffold <url>` handler.
 *
 * Contract (verbatim from masterplan §3 row [H8.6]):
 *   `frootai orchard scaffold <url> [--only <file>] [--force] [--out <dir>]`
 *   wired to `[H5]` library.
 *
 * Fifth stage handler the [H8.1] router lazy-loads. The user passes ONLY a
 * `<url>` (the masterplan-pinned UX); we chain S1 discover → S2 fetch → S3
 * extract → S4 retrieve → S5 scaffold internally so the operator never has
 * to pre-derive RepoFacts / RetrievalRecord onto disk. Same chaining
 * doctrine as H8.3/H8.4/H8.5 — push the boilerplate one layer deeper per
 * stage.
 *
 * Pipeline (per invocation):
 *   1. parse argv (`<url>`, `--only`, `--force`, `--out`, `--dry-run`,
 *      `--mock`, `--top-k`, `--no-cache`, `--persist-dir`, `--workdir-root`,
 *      `--model`, `--json`, `--help`)
 *   2. build GitHub transport from `GH_TOKEN_1/2/3` env vars
 *      ─ skipped when `--dry-run` is set (plan-only mode needs no transport,
 *        no upstream walk — scaffold itself runs zero LLM calls in dry-run
 *        and the handler skips the pre-stages entirely + uses an empty
 *        RepoFacts stub since dry-run just plans the registry)
 *   3. `discover()` (H1) → resolve normalized owner/repo + SHA
 *   4. `fetch()`    (H2) → snapshot files into a FetchRecord
 *   5. `extract()`  (H3) → derive RepoFacts (must pass validation)
 *   6. `retrieve()` (H4) → top-K reference plays (mock embeddings unless
 *      otherwise instructed; opt-out via `--no-retrieve` if a user wants to
 *      scaffold without exemplar grounding)
 *   7. `scaffold()` (H5) → emit the 25 LLM-generated play files to `--out`
 *      ─ honors `--only <filename>` to regenerate a single file
 *      ─ honors `--force` to bust the LLM cache for fresh outputs
 *      ─ honors `--dry-run` to PLAN ONLY (no LLM, no file writes)
 *      ─ honors `--model <name>` to override the default gpt-4o-mini
 *      ─ defaults to the H5 mock client when no `OPENAI_API_KEY` is in env
 *        (matches the H5 standalone CLI's offline-friendly default)
 *   8. emit the H5 ScaffoldResult JSON to stdout (pretty when ctx.verbose;
 *      single-line otherwise)
 *
 * Two surfaces (identical pattern to H8.3/H8.4/H8.5):
 *
 *   1. Programmatic `runWithDeps(args, ctx, deps) → Promise<number>` — pure
 *      + injectable: `{transport, discoverImpl, fetchImpl, extractImpl,
 *      retrieveImpl, scaffoldImpl, env}`. Tests run hermetically with
 *      mocked stages.
 *
 *   2. Router-facing `run(args, ctx)` — default deps: builds TokenPool from
 *      env + dispatches via library `discover` + `fetch` + `extract` +
 *      `retrieve` + `scaffold`.
 *
 * Subcommand argv grammar (everything AFTER `scaffold` in `argv`):
 *   <url>              owner/repo or full GitHub URL (required UNLESS --dry-run)
 *   --only <filename>  regenerate a single play file (debug a single scaffolder)
 *   --force            bust the LLM cache and re-call for all files
 *   --out <dir>        write files here (else `tmp/scaffold/<slug>/`)
 *   --dry-run          plan only — no LLM, no file writes, no pre-stages
 *   --mock             use H5's deterministic mock LLM client (default if no
 *                       OPENAI_API_KEY in env; pass to force mock even when
 *                       OPENAI_API_KEY is set)
 *   --no-retrieve      skip the H4 retrieve stage (scaffold without exemplars)
 *   --top-k <n>        number of nearest plays to retrieve (default 5)
 *   --model <name>     override the LLM model (default: gpt-4o-mini)
 *   --no-cache         bypass discover cache READ
 *   --persist-dir <p>  override FetchRecord persist directory
 *   --workdir-root <p> override the temp clone workdir root
 *   --json             (router-inherited) machine-readable JSON to stdout
 *   --help, -h         print subcommand help + exit OK
 *
 * Exit codes (sysexits-aligned; FIRST failure wins):
 *   0    OK             — ScaffoldResult emitted; aggregate confidence ≥ 0.7
 *                          OR --dry-run plan emitted
 *   64   USAGE          — bad flags / missing <url> / no transport configured
 *   65   DATA_ERR       — discover/fetch/extract/retrieve failed schema gate
 *                          OR scaffold below 0.7 commit bar (matches H5 CLI)
 *                          OR scaffold's --only filename didn't match
 *   69   UNAVAILABLE    — discover routed to review queue
 *   70   SOFTWARE       — scaffold unexpected internal error
 *   74   IOERR          — scaffold cache write failure (from H5 taxonomy)
 *   75   TEMPFAIL       — retrieve embed_failed OR scaffold llm_call_failed
 *   77   NOPERM         — 403 / forbidden
 *
 * Non-goals for THIS ship:
 *   - `--seed-list` bulk mode (separate H8 bulk row)
 *   - Auth / paid gating — `scaffold` is FREE
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
const SCAFFOLD_LIB_DIR = path.resolve(
  __dirname, "..", "..", "..", "scripts", "harvest", "lib", "scaffold"
);

// Lazy-require at handler-load time so a broken transitive dep surfaces as
// EX_SOFTWARE (NOT "not yet wired"). Mirrors H8.2..H8.5.
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

const {
  scaffold,
} = require(path.join(SCAFFOLD_LIB_DIR, "scaffold-cli.js"));

/** Local sysexits enum. */
const EXIT = Object.freeze({
  OK: H1_EXIT.OK,
  USAGE: H1_EXIT.USAGE,
  DATA_ERR: H1_EXIT.DATA_ERR,
  UNAVAILABLE: H1_EXIT.UNAVAILABLE,
  SOFTWARE: H1_EXIT.SOFTWARE,
  IOERR: 74,
  TEMPFAIL: 75,
  NOPERM: H1_EXIT.NOPERM,
});

/** Flags taking a value (`--flag <v>` or `--flag=v`). */
const VALUE_FLAGS = new Set([
  "--only", "--out", "--top-k", "--model",
  "--persist-dir", "--workdir-root",
]);

/** Error carrying a sysexits exit code so the handler returns the right number. */
class ScaffoldHandlerError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, exitCode?: number, cause?: Error }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = "ScaffoldHandlerError";
    this.code = opts.code || "scaffold_handler_failed";
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Parse the subcommand-local argv. The first positional is `<url>` (optional
 * when --dry-run; required otherwise). Unknown long flags are USAGE.
 *
 * @param {readonly string[]} argv
 * @returns {{ url: string|null, only: string|null, force: boolean, outDir: string|null, dryRun: boolean, mock: boolean, noRetrieve: boolean, topK: number|null, model: string|null, noCache: boolean, json: boolean, help: boolean, persistDir?: string, workdirRoot?: string }}
 */
function parseScaffoldArgs(argv) {
  if (!Array.isArray(argv)) {
    throw new TypeError("parseScaffoldArgs: argv must be an array");
  }
  /** @type {{ url: string|null, only: string|null, force: boolean, outDir: string|null, dryRun: boolean, mock: boolean, noRetrieve: boolean, topK: number|null, model: string|null, noCache: boolean, json: boolean, help: boolean, persistDir?: string, workdirRoot?: string }} */
  const out = {
    url: null, only: null, force: false, outDir: null, dryRun: false,
    mock: false, noRetrieve: false, topK: null, model: null,
    noCache: false, json: false, help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (typeof arg !== "string") {
      throw new ScaffoldHandlerError(`argv entry ${i} must be a string`, {
        code: "bad_args", exitCode: EXIT.USAGE,
      });
    }
    if (arg === "--help" || arg === "-h") { out.help = true; continue; }
    if (arg === "--force") { out.force = true; continue; }
    if (arg === "--dry-run") { out.dryRun = true; continue; }
    if (arg === "--mock") { out.mock = true; continue; }
    if (arg === "--no-retrieve") { out.noRetrieve = true; continue; }
    if (arg === "--no-cache") { out.noCache = true; continue; }
    if (arg === "--json") { out.json = true; continue; }

    let handled = false;
    for (const vf of VALUE_FLAGS) {
      if (arg === vf) {
        const v = argv[++i];
        if (typeof v !== "string" || v.length === 0) {
          throw new ScaffoldHandlerError(`${vf} requires a value`, {
            code: "bad_args", exitCode: EXIT.USAGE,
          });
        }
        applyValueFlag(out, vf, v);
        handled = true; break;
      }
      if (arg.startsWith(`${vf}=`)) {
        const v = arg.slice(vf.length + 1);
        if (v.length === 0) {
          throw new ScaffoldHandlerError(`${vf}= requires a non-empty value`, {
            code: "bad_args", exitCode: EXIT.USAGE,
          });
        }
        applyValueFlag(out, vf, v);
        handled = true; break;
      }
    }
    if (handled) continue;

    if (arg.startsWith("-")) {
      throw new ScaffoldHandlerError(`unknown flag: ${arg}`, {
        code: "bad_args", exitCode: EXIT.USAGE,
      });
    }
    if (out.url === null) {
      out.url = arg;
      continue;
    }
    throw new ScaffoldHandlerError(
      `unexpected positional argument: ${arg} (already have <url>=${out.url})`,
      { code: "bad_args", exitCode: EXIT.USAGE },
    );
  }
  if (out.topK !== null && (!Number.isInteger(out.topK) || out.topK < 1)) {
    throw new ScaffoldHandlerError(`--top-k must be a positive integer (got ${out.topK})`, {
      code: "bad_args", exitCode: EXIT.USAGE,
    });
  }
  return out;
}

function applyValueFlag(out, vf, v) {
  if (vf === "--only") out.only = v;
  else if (vf === "--out") out.outDir = v;
  else if (vf === "--top-k") out.topK = parseInt(v, 10);
  else if (vf === "--model") out.model = v;
  else if (vf === "--persist-dir") out.persistDir = v;
  else if (vf === "--workdir-root") out.workdirRoot = v;
}

/** Build the `frootai orchard scaffold --help` banner. */
function buildHelp() {
  return [
    "Usage: frootai orchard scaffold <url> [options]",
    "       frootai orchard scaffold --dry-run               # plan registry only",
    "",
    "Generate the 25-file play scaffold for an upstream repo. Chains:",
    "S1 discover → S2 fetch → S3 extract → S4 retrieve → S5 scaffold.",
    "",
    "Arguments:",
    "  <url>                owner/repo or full https://github.com/owner/repo URL",
    "                       (required unless --dry-run)",
    "",
    "Scaffold options:",
    "  --only <filename>    regenerate a single play file (debug one scaffolder)",
    "  --force              bust the LLM cache and re-call for all files",
    "  --out <dir>          write files here (else tmp/scaffold/<slug>/)",
    "  --dry-run            plan registry only — no LLM, no file writes, no pre-stages",
    "  --mock               use deterministic mock LLM client (default when",
    "                        OPENAI_API_KEY is not in env)",
    "  --no-retrieve        skip the H4 retrieve stage (no exemplar grounding)",
    "  --top-k <n>          retrieve top-N nearest plays (default 5)",
    "  --model <name>       override LLM model (default gpt-4o-mini)",
    "",
    "Pre-stage options:",
    "  --no-cache           bypass discover cache READ",
    "  --persist-dir <dir>  override FetchRecord persist directory",
    "  --workdir-root <dir> override the temp clone workdir root",
    "",
    "Output:",
    "  --json               machine-readable single-line JSON to stdout (default)",
    "  --help, -h           show this help and exit",
    "",
    "Exit codes:",
    "  0   success (scaffold emitted; aggregate confidence ≥ 0.7)",
    "  64  bad args / missing <url> / no transport configured",
    "  65  pre-stage failed schema gate; or scaffold below 0.7 commit bar;",
    "       or --only filename didn't match any scaffolder",
    "  69  routed to review queue (archived / monorepo / fork)",
    "  70  scaffold unexpected internal error",
    "  74  scaffold cache write failure",
    "  75  retrieve embed_failed OR scaffold llm_call_failed (transient)",
    "  77  forbidden (private repo or missing PAT scope)",
    "",
    "Examples:",
    "  frootai orchard scaffold Azure-Samples/azure-search-openai-demo --out ./play",
    "  frootai orchard scaffold owner/repo --only README.md --force",
    "  frootai orchard scaffold --dry-run                  # just list scaffolders",
    "  frootai orchard scaffold owner/repo --no-retrieve --mock",
    "",
  ].join("\n");
}

/** Build the GitHub transport from env vars (same shape as H8.2..H8.5). */
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
 * Map an H5 ScaffoldError (or any error) to a sysexits exit code. The H5
 * library tags errors with `.exit_code` already; we honor that, fall back
 * to `.exitCode`, then bucket common shapes. Mirrors mapRetrieveErrorToExit.
 *
 * @param {any} err @returns {number}
 */
function mapScaffoldErrorToExit(err) {
  if (!err) return EXIT.SOFTWARE;
  if (Number.isInteger(err.exit_code)) return /** @type {number} */ (err.exit_code);
  if (Number.isInteger(err.exitCode)) return /** @type {number} */ (err.exitCode);
  const code = err.code || "";
  if (code === "llm_call_failed") return EXIT.TEMPFAIL;       // 75
  if (code === "fact_check_failed") return EXIT.DATA_ERR;     // 65
  if (code === "schema_validation_failed") return EXIT.DATA_ERR; // 65
  if (code === "cache_corrupt") return EXIT.IOERR;            // 74
  if (code === "prompt_too_long") return EXIT.DATA_ERR;       // 65
  return EXIT.SOFTWARE;
}

/**
 * Default output directory when `--out` was not supplied. Mirrors the H6.26
 * adapter convention (slug under tmp/) so a plain `scaffold owner/repo` is
 * reproducible without a flag.
 * @param {object} facts @returns {string}
 */
function defaultOutDir(facts) {
  const slug = (facts && (facts.slug || facts.repo)) || "play";
  const safeSlug = String(slug).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return path.resolve(process.cwd(), "tmp", "scaffold", safeSlug || "play");
}

/**
 * Programmatic surface. Chains discover → fetch → extract → retrieve →
 * scaffold with injectable deps so the handler is hermetically testable.
 *
 * @param {readonly string[]} args
 * @param {object} ctx
 * @param {object} [deps]
 * @param {object}                  [deps.transport]
 * @param {typeof discover}         [deps.discoverImpl]
 * @param {typeof fetch}            [deps.fetchImpl]
 * @param {typeof extract}          [deps.extractImpl]
 * @param {typeof retrieve}         [deps.retrieveImpl]
 * @param {typeof scaffold}         [deps.scaffoldImpl]
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
  const scaffoldImpl = deps.scaffoldImpl || scaffold;

  /** @type {ReturnType<typeof parseScaffoldArgs>} */
  let parsed;
  try {
    parsed = parseScaffoldArgs(args || []);
  } catch (err) {
    if (err instanceof ScaffoldHandlerError) {
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

  // ── Dry-run short-circuit: no pre-stages, no transport, no env needed.
  // Scaffold's dry-run mode planks the registry from an empty RepoFacts +
  // no retrieval record. The H5 library does the right thing here.
  if (parsed.dryRun) {
    try {
      const planResult = await scaffoldImpl({
        repoFacts: {},
        slug: "play",
        dryRun: true,
        only: parsed.only || undefined,
        outDir: parsed.outDir || undefined,
        model: parsed.model || undefined,
      });
      emit(stdout, verbose ? JSON.stringify(planResult, null, 2) : JSON.stringify(planResult));
      return EXIT.OK;
    } catch (err) {
      const exitCode = mapScaffoldErrorToExit(err);
      const code = (err && err.code) || "scaffold_failed";
      const message = err instanceof Error ? err.message : String(err);
      if (json) emit(stdout, JSON.stringify({ ok: false, stage: "scaffold", error: { code, message, exit_code: exitCode } }));
      else emit(stderr, `error[scaffold/${code}]: ${message}`);
      return exitCode;
    }
  }

  if (parsed.url === null) {
    if (json) {
      emit(stdout, JSON.stringify({
        ok: false,
        error: { code: "bad_args", message: "missing <url> argument (or pass --dry-run for plan-only)", exit_code: EXIT.USAGE },
      }));
    } else {
      emit(stderr, "error: missing <url> argument (or pass --dry-run for plan-only)");
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
    discoverResult = await discoverImpl({ input: parsed.url, transport, noCache: parsed.noCache });
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
    const message = `RepoFacts validation failed (${n} errors); cannot proceed to scaffold`;
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

  // ── Step 4: retrieve (optional) ──
  let retrievalRecord;
  if (!parsed.noRetrieve) {
    try {
      retrievalRecord = await retrieveImpl({
        repoFacts: facts,
        topK: parsed.topK != null ? parsed.topK : undefined,
        // Default to mock embeddings when --mock OR when no OPENAI_API_KEY in
        // env (no point firing a 401 for offline scaffolds).
        mock: parsed.mock || !(env.OPENAI_API_KEY && String(env.OPENAI_API_KEY).length > 0),
        verbose,
      });
    } catch (err) {
      // Mirror the H8.5 mapping. Retrieve failure is fatal — scaffold needs
      // exemplars to ground its prose. Operator can opt out with --no-retrieve.
      let exitCode = EXIT.SOFTWARE;
      if (Number.isInteger(err && err.exit_code)) exitCode = err.exit_code;
      else if ((err && err.code) === "embed_failed") exitCode = EXIT.TEMPFAIL;
      else if ((err && err.code) === "corpus_load_failed") exitCode = EXIT.DATA_ERR;
      const code = (err && err.code) || "retrieve_failed";
      const message = err instanceof Error ? err.message : String(err);
      if (json) emit(stdout, JSON.stringify({ ok: false, stage: "retrieve", error: { code, message, exit_code: exitCode } }));
      else emit(stderr, `error[retrieve/${code}]: ${message}`);
      return exitCode;
    }
  }

  // ── Step 5: scaffold ──
  const outDir = parsed.outDir || defaultOutDir(facts);
  let scaffoldResult;
  try {
    scaffoldResult = await scaffoldImpl({
      repoFacts: facts,
      retrievalRecord,
      slug: facts.slug || repo,
      repo: facts.repo || `${owner}/${repo}`,
      model: parsed.model || undefined,
      only: parsed.only || undefined,
      force: parsed.force,
      outDir,
      // Mirror the retrieve heuristic: prefer mock if --mock OR no API key.
      // Pass undefined so scaffold's default makeMockClient() kicks in.
      llmClient: undefined,
    });
  } catch (err) {
    const exitCode = mapScaffoldErrorToExit(err);
    const code = (err && err.code) || "scaffold_failed";
    const message = err instanceof Error ? err.message : String(err);
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "scaffold", error: { code, message, exit_code: exitCode } }));
    else emit(stderr, `error[scaffold/${code}]: ${message}`);
    return exitCode;
  }

  // ── Step 6: emit ──
  const body = verbose ? JSON.stringify(scaffoldResult, null, 2) : JSON.stringify(scaffoldResult);
  emit(stdout, body);

  // H5 commit-bar gate: aggregate < 0.7 → soft DATA_ERR (matches H5 CLI's
  // surfaced exit when `commit_ok === false`). Don't apply for --only mode
  // (the partial scaffold has no meaningful aggregate).
  if (!parsed.only && scaffoldResult && scaffoldResult.commit_ok === false) {
    if (!json) {
      const agg = typeof scaffoldResult.aggregate === "number" ? scaffoldResult.aggregate.toFixed(3) : "?";
      emit(stderr, `warning: aggregate confidence ${agg} < 0.7 — use --force + founder approval to commit`);
    }
    return EXIT.DATA_ERR;
  }
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
  ScaffoldHandlerError,
  parseScaffoldArgs,
  buildHelp,
  buildTransport,
  mapScaffoldErrorToExit,
  defaultOutDir,
  runWithDeps,
  run,
};
