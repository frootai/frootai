// @ts-check
/**
 * [H8.9] install.js — `frootai orchard install --as-play <url-or-slug>` handler.
 *
 * Contract (verbatim from masterplan §3 row [H8.9]):
 *   `frootai orchard install --as-play <url-or-slug> [--customize <yaml>]
 *    [--out <dir>]` end-to-end: discover → fetch → extract → retrieve →
 *    scaffold → compose-infra → validate → unpack into out dir.
 *
 * Eighth stage handler the [H8.1] router lazy-loads. THE end-to-end command
 * — the one developers actually type. Chains all 6 harvest stages + the H7
 * validator gate + writes the assembled play to a single output directory.
 * This handler is the production form of what `00-pipeline.js` does in dev.
 *
 * Pipeline (per invocation):
 *   1. parse argv (`--as-play <url|slug>` (required), `--customize <yaml>`,
 *      `--out <dir>`, `--no-cache`, `--force`, `--no-retrieve`, `--mock`,
 *      `--top-k <n>`, `--model <name>`, `--skip-validate`,
 *      `--persist-dir <p>`, `--workdir-root <p>`, `--json`, `--help`)
 *   2. resolve `<url-or-slug>`: if input matches `owner/repo` shorthand OR a
 *      full GitHub URL → treat as URL; ELSE look up in `harvest-seed-list.json`
 *      by exact slug (last segment of `full_name` matches), and use that
 *      entry's `full_name` as the URL. Unknown slug → USAGE error.
 *   3. parse `--customize` policy file (YAML or JSON via H8.7 parser)
 *   4. build GitHub transport from env (`GH_TOKEN_1/2/3`)
 *   5. `discover()`  (H1) → resolve owner/repo + SHA  (honors --no-cache)
 *   6. `fetch()`     (H2) → snapshot files            (honors --force)
 *   7. `extract()`   (H3) → derive RepoFacts          (must validate)
 *   8. `retrieve()`  (H4) → top-K exemplars           (skipped if --no-retrieve;
 *                                                       mock-default heuristic
 *                                                       mirrors H8.6 scaffold)
 *   9. `scaffold()`  (H5) → emit 25 LLM-grounded files to `<out>/<slug>/`
 *  10. `composeInfraDeterministic()` (H6) → emit infra/* to `<out>/<slug>/`
 *      (honors --customize as the H6 policy overlay)
 *  11. `runPlayValidators()` (H7) → gate the play; on RED, exit DATA_ERR
 *      (skip with --skip-validate; in that case the play still ships but
 *      stdout flags `validation_skipped: true`)
 *  12. emit a structured InstallResult JSON summary
 *
 * Two surfaces (identical pattern to H8.3..H8.8):
 *
 *   1. Programmatic `runWithDeps(args, ctx, deps) → Promise<number>` — pure
 *      + injectable: every stage impl + transport + env + readFile +
 *      seedListPath. Tests run fully hermetically.
 *
 *   2. Router-facing `run(args, ctx)` — default deps wire the real library
 *      functions.
 *
 * Subcommand argv grammar (everything AFTER `install` in `argv`):
 *   --as-play <url|slug>  upstream URL or known slug (REQUIRED)
 *   --customize <path>    org policy file applied at compose-infra (YAML/JSON)
 *   --out <dir>           output directory (default: `tmp/plays/<slug>/`)
 *   --no-cache            bypass discover cache READ
 *   --force               re-fetch even if cached FetchRecord is fresh
 *   --no-retrieve         skip H4 exemplar retrieval (scaffold w/o grounding)
 *   --mock                use deterministic mock LLM + mock embeddings
 *   --top-k <n>           number of nearest plays to retrieve (default 5)
 *   --model <name>        override scaffold LLM (default gpt-4o-mini)
 *   --skip-validate       skip the H7 validator gate (commits the play anyway)
 *   --persist-dir <p>     override FetchRecord persist directory
 *   --workdir-root <p>    override the temp clone workdir root
 *   --json                (router-inherited) machine-readable JSON to stdout
 *   --help, -h            print subcommand help + exit OK
 *
 * Exit codes (sysexits-aligned; FIRST failure wins):
 *   0    OK             — play assembled + validated; written to --out
 *   64   USAGE          — bad flags / missing --as-play / no transport / unknown slug
 *   65   DATA_ERR       — any pre-stage schema gate; OR scaffold below 0.7 commit bar;
 *                          OR H6 bicep_build/terraform_validate/waf/policy fail; OR
 *                          H7 validation overall FAIL
 *   66   NOINPUT        — --customize file unreadable or malformed; or seed list missing
 *   69   UNAVAILABLE    — discover review queue; OR H6 gold_fallback_required;
 *                          OR H6 avm_resolve_failed
 *   70   SOFTWARE       — scaffold avm_compose_failed / unexpected internal error
 *   74   IOERR          — scaffold cache_corrupt / output write failure
 *   75   TEMPFAIL       — retrieve embed_failed OR scaffold llm_call_failed
 *   77   NOPERM         — 403 / forbidden
 *
 * Non-goals for THIS ship:
 *   - Auth / paid gating (H8.13–H8.15 own free-vs-paid logic) — install is
 *     FREE for the MSFT-anchor seed list. Other URLs are accepted today; the
 *     paid gate goes in via the H8.14 entitlements check.
 *
 *     H8.15 STATUS UPDATE: the free-vs-paid classification library now
 *     ships at `cli/commands/auth/free-list.js`. To activate the paid
 *     gate at this handler, wire it via a future `deps.paidGateImpl`:
 *
 *       const { buildPaidGateImpl } = require("../auth/free-list");
 *       const { buildEntitlementsImpl } = require("../auth/entitlements");
 *       installHandler.runWithDeps(args, ctx, {
 *         paidGateImpl: buildPaidGateImpl({
 *           entitlementsImpl: buildEntitlementsImpl({}),
 *         }),
 *       });
 *
 *     Wiring is deferred to the bin-reconciliation sub-phase so the
 *     67 existing install tests remain green.
 *   - Streaming progress (H8.26 spinner/ETA). The handler emits ONE JSON
 *     summary at the end; pre-stage progress goes to stderr only when
 *     ctx.verbose.
 *   - --upgrade-to-play CDN publish (that's H8.10 `commit`).
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
const RETRIEVE_LIB_DIR = path.resolve(
  __dirname, "..", "..", "..", "scripts", "harvest", "lib", "retrieve"
);
const SCAFFOLD_LIB_DIR = path.resolve(
  __dirname, "..", "..", "..", "scripts", "harvest", "lib", "scaffold"
);
const COMPOSE_LIB_DIR = path.resolve(
  __dirname, "..", "..", "..", "scripts", "harvest", "lib", "compose-infra"
);
const VALIDATE_LIB_DIR = path.resolve(
  __dirname, "..", "..", "..", "scripts", "harvest", "lib", "validate"
);

// Lazy-require all chained libraries at handler-load time so transitive-dep
// errors surface as EX_SOFTWARE (NOT "not yet wired").
const {
  discover,
  mapErrorToExit: mapDiscoverErrorToExit,
  EXIT: H1_EXIT,
} = require(path.join(DISCOVER_LIB_DIR, "discover-cli.js"));

const {
  fetch,
  mapErrorToExit: mapFetchErrorToExit,
} = require(path.join(FETCH_LIB_DIR, "fetch-cli.js"));

const { extract } = require(path.join(EXTRACT_LIB_DIR, "extract-cli.js"));
const { retrieve } = require(path.join(RETRIEVE_LIB_DIR, "retrieve-cli.js"));
const { scaffold } = require(path.join(SCAFFOLD_LIB_DIR, "scaffold-cli.js"));
const { composeInfraDeterministic } = require(path.join(COMPOSE_LIB_DIR, "idempotency.js"));
const { runPlayValidators, formatSummaryLine, STATUS: VALIDATE_STATUS } = require(path.join(VALIDATE_LIB_DIR, "play.js"));

// Reuse H8.7's parsePolicyFile so the --customize file contract is
// identical across compose-infra + customize + install.
const { parsePolicyFile } = require("./compose-infra.js");

/** Local sysexits enum (superset of every chained stage's exits). */
const EXIT = Object.freeze({
  OK: H1_EXIT.OK,
  USAGE: H1_EXIT.USAGE,
  DATA_ERR: H1_EXIT.DATA_ERR,
  NOINPUT: 66,
  UNAVAILABLE: H1_EXIT.UNAVAILABLE,
  SOFTWARE: H1_EXIT.SOFTWARE,
  IOERR: 74,
  TEMPFAIL: 75,
  NOPERM: H1_EXIT.NOPERM,
});

/** Flags taking a value (`--flag <v>` or `--flag=v`). */
const VALUE_FLAGS = new Set([
  "--as-play", "--customize", "--out", "--top-k", "--model",
  "--persist-dir", "--workdir-root",
]);

/** Default seed-list path (used to resolve a slug → URL). */
const DEFAULT_SEED_LIST_PATH = path.resolve(
  __dirname, "..", "..", "..", "..", "frootai", "orchard", "registry",
  "harvest-seed-list.json"
);

/** Error carrying a sysexits exit code so the handler returns the right number. */
class InstallHandlerError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, exitCode?: number, cause?: Error }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = "InstallHandlerError";
    this.code = opts.code || "install_handler_failed";
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Parse the subcommand-local argv. `--as-play <url|slug>` is REQUIRED.
 * Unknown long flags are USAGE.
 *
 * @param {readonly string[]} argv
 * @returns {{ asPlay: string|null, customize: string|null, outDir: string|null, noCache: boolean, force: boolean, noRetrieve: boolean, mock: boolean, topK: number|null, model: string|null, skipValidate: boolean, json: boolean, help: boolean, persistDir?: string, workdirRoot?: string }}
 */
function parseInstallArgs(argv) {
  if (!Array.isArray(argv)) {
    throw new TypeError("parseInstallArgs: argv must be an array");
  }
  /** @type {{ asPlay: string|null, customize: string|null, outDir: string|null, noCache: boolean, force: boolean, noRetrieve: boolean, mock: boolean, topK: number|null, model: string|null, skipValidate: boolean, json: boolean, help: boolean, persistDir?: string, workdirRoot?: string }} */
  const out = {
    asPlay: null, customize: null, outDir: null,
    noCache: false, force: false, noRetrieve: false, mock: false,
    topK: null, model: null, skipValidate: false, json: false, help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (typeof arg !== "string") {
      throw new InstallHandlerError(`argv entry ${i} must be a string`, {
        code: "bad_args", exitCode: EXIT.USAGE,
      });
    }
    if (arg === "--help" || arg === "-h") { out.help = true; continue; }
    if (arg === "--no-cache") { out.noCache = true; continue; }
    if (arg === "--force") { out.force = true; continue; }
    if (arg === "--no-retrieve") { out.noRetrieve = true; continue; }
    if (arg === "--mock") { out.mock = true; continue; }
    if (arg === "--skip-validate") { out.skipValidate = true; continue; }
    if (arg === "--json") { out.json = true; continue; }

    let handled = false;
    for (const vf of VALUE_FLAGS) {
      if (arg === vf) {
        const v = argv[++i];
        if (typeof v !== "string" || v.length === 0) {
          throw new InstallHandlerError(`${vf} requires a value`, {
            code: "bad_args", exitCode: EXIT.USAGE,
          });
        }
        applyValueFlag(out, vf, v);
        handled = true; break;
      }
      if (arg.startsWith(`${vf}=`)) {
        const v = arg.slice(vf.length + 1);
        if (v.length === 0) {
          throw new InstallHandlerError(`${vf}= requires a non-empty value`, {
            code: "bad_args", exitCode: EXIT.USAGE,
          });
        }
        applyValueFlag(out, vf, v);
        handled = true; break;
      }
    }
    if (handled) continue;

    if (arg.startsWith("-")) {
      throw new InstallHandlerError(`unknown flag: ${arg}`, {
        code: "bad_args", exitCode: EXIT.USAGE,
      });
    }
    // Install takes NO positionals — everything goes through --as-play.
    throw new InstallHandlerError(
      `unexpected positional argument: ${arg} (use --as-play <url|slug>)`,
      { code: "bad_args", exitCode: EXIT.USAGE },
    );
  }
  if (out.topK !== null && (!Number.isInteger(out.topK) || out.topK < 1)) {
    throw new InstallHandlerError(`--top-k must be a positive integer (got ${out.topK})`, {
      code: "bad_args", exitCode: EXIT.USAGE,
    });
  }
  return out;
}

function applyValueFlag(out, vf, v) {
  if (vf === "--as-play") out.asPlay = v;
  else if (vf === "--customize") out.customize = v;
  else if (vf === "--out") out.outDir = v;
  else if (vf === "--top-k") out.topK = parseInt(v, 10);
  else if (vf === "--model") out.model = v;
  else if (vf === "--persist-dir") out.persistDir = v;
  else if (vf === "--workdir-root") out.workdirRoot = v;
}

/** Build the `frootai orchard install --help` banner. */
function buildHelp() {
  return [
    "Usage: frootai orchard install --as-play <url|slug> [options]",
    "",
    "End-to-end: discover → fetch → extract → retrieve → scaffold → compose-infra →",
    "validate → write the assembled play to disk. The one-command developer flow.",
    "",
    "Required:",
    "  --as-play <url|slug>  upstream URL (owner/repo or full GitHub URL) OR a",
    "                        known slug from the harvest-seed-list",
    "",
    "Pipeline options:",
    "  --customize <path>    org policy file applied at compose-infra (YAML/JSON)",
    "  --out <dir>           output directory (default: tmp/plays/<slug>/)",
    "  --no-cache            bypass discover cache READ",
    "  --force               re-fetch even if cached FetchRecord is fresh",
    "  --no-retrieve         skip H4 exemplar retrieval (scaffold w/o grounding)",
    "  --mock                use deterministic mock LLM + mock embeddings",
    "  --top-k <n>           number of nearest plays to retrieve (default 5)",
    "  --model <name>        override scaffold LLM (default gpt-4o-mini)",
    "  --skip-validate       skip the H7 validator gate (commits the play anyway)",
    "  --persist-dir <dir>   override FetchRecord persist directory",
    "  --workdir-root <dir>  override the temp clone workdir root",
    "",
    "Output:",
    "  --json                machine-readable single-line JSON to stdout (default)",
    "  --help, -h            show this help and exit",
    "",
    "Exit codes:",
    "  0   success (play assembled + validated; written to --out)",
    "  64  bad args / missing --as-play / unknown slug / no transport",
    "  65  pre-stage schema gate; scaffold commit-bar; H6 build/validate; H7 RED",
    "  66  --customize file unreadable or malformed; seed list missing",
    "  69  review-queue routing; H6 gold_fallback_required / avm_resolve_failed",
    "  70  scaffold avm_compose_failed / unexpected internal error",
    "  74  scaffold cache_corrupt / output write failure",
    "  75  retrieve embed_failed OR scaffold llm_call_failed (transient)",
    "  77  forbidden (private repo or missing PAT scope)",
    "",
    "Examples:",
    "  frootai orchard install --as-play Azure-Samples/azure-search-openai-demo",
    "  frootai orchard install --as-play azure-search-openai-demo            # slug",
    "  frootai orchard install --as-play owner/repo --customize ./policy.yaml",
    "  frootai orchard install --as-play owner/repo --out ./my-play --skip-validate",
    "",
  ].join("\n");
}

/** Build the GitHub transport from env vars (same shape as H8.2..H8.8). */
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
 * Is the input a URL-shape token? Accepts both `owner/repo` shorthand and
 * full GitHub URLs. Anything else falls through to slug lookup.
 *
 * @param {string} input @returns {boolean}
 */
function looksLikeUrl(input) {
  if (typeof input !== "string" || input.length === 0) return false;
  // Full URL.
  if (/^https?:\/\//i.test(input)) return true;
  // owner/repo shorthand (single slash, no whitespace).
  if (/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(input)) return true;
  return false;
}

/**
 * Resolve `--as-play <url|slug>` → URL. If the input is URL-shape, return
 * as-is. Otherwise look it up in the seed list. Slug matching is exact on
 * the LAST segment of `full_name` (case-insensitive).
 *
 * @param {string} input
 * @param {{ seedListPath?: string, readFile?: (p: string, enc: string) => string }} [opts]
 * @returns {{ ok: boolean, url?: string, error?: string }}
 */
function resolveAsPlayInput(input, opts = {}) {
  if (looksLikeUrl(input)) return { ok: true, url: input };
  const seedListPath = opts.seedListPath || DEFAULT_SEED_LIST_PATH;
  const read = opts.readFile || ((p, enc) => fs.readFileSync(p, enc));
  let body;
  try {
    body = read(seedListPath, "utf8");
  } catch (e) {
    return { ok: false, error: `cannot read seed list at ${seedListPath}: ${e && e.message}` };
  }
  let data;
  try {
    data = JSON.parse(body);
  } catch (e) {
    return { ok: false, error: `seed list ${seedListPath} is malformed: ${e && e.message}` };
  }
  const items = (data && Array.isArray(data.items)) ? data.items : [];
  const slugLower = String(input).toLowerCase();
  for (const item of items) {
    const fn = typeof item.full_name === "string" ? item.full_name : "";
    const segment = fn.split("/").pop() || "";
    if (segment.toLowerCase() === slugLower) {
      return { ok: true, url: fn };
    }
  }
  return { ok: false, error: `slug "${input}" not found in harvest-seed-list (use a URL like owner/repo instead)` };
}

/**
 * Derive a play slug from RepoFacts (or fallback to owner-repo). Sanitised
 * to lower-kebab so it's safe as a directory name. Mirrors H8.6's
 * `defaultOutDir` slug logic.
 *
 * @param {object} facts @param {string} owner @param {string} repo
 */
function deriveSlug(facts, owner, repo) {
  const candidate = (facts && (facts.slug || facts.repo)) || `${owner}-${repo}`;
  return String(candidate)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "play";
}

/**
 * Map a scaffold-stage error to a sysexits exit code (mirrors H8.6 logic).
 * @param {any} err @returns {number}
 */
function mapScaffoldErrorToExit(err) {
  if (!err) return EXIT.SOFTWARE;
  if (Number.isInteger(err.exit_code)) return /** @type {number} */ (err.exit_code);
  if (Number.isInteger(err.exitCode)) return /** @type {number} */ (err.exitCode);
  const code = err.code || "";
  if (code === "llm_call_failed") return EXIT.TEMPFAIL;
  if (code === "fact_check_failed") return EXIT.DATA_ERR;
  if (code === "schema_validation_failed") return EXIT.DATA_ERR;
  if (code === "cache_corrupt") return EXIT.IOERR;
  if (code === "prompt_too_long") return EXIT.DATA_ERR;
  return EXIT.SOFTWARE;
}

/**
 * Map a compose-infra error to a sysexits exit code (mirrors H8.7 logic).
 * @param {any} err @returns {number}
 */
function mapComposeInfraErrorToExit(err) {
  if (!err) return EXIT.SOFTWARE;
  if (Number.isInteger(err.exit_code)) return /** @type {number} */ (err.exit_code);
  if (Number.isInteger(err.exitCode)) return /** @type {number} */ (err.exitCode);
  const code = err.code || "";
  if (code === "gold_fallback_required") return EXIT.UNAVAILABLE;
  if (code === "avm_resolve_failed") return EXIT.UNAVAILABLE;
  if (code === "avm_compose_failed") return EXIT.SOFTWARE;
  if (code === "bicep_build_failed") return EXIT.DATA_ERR;
  if (code === "terraform_validate_failed") return EXIT.DATA_ERR;
  if (code === "waf_compliance_failed") return EXIT.DATA_ERR;
  if (code === "policy_overlay_failed") return EXIT.DATA_ERR;
  return EXIT.DATA_ERR;
}

/**
 * Write the compose snapshot (path → content map) under `outDir`. Mirrors
 * the H6.26 adapter convention — the snapshot keys already carry the
 * `infra/...` prefix, so we write relative to `outDir` (the play root),
 * not `outDir/infra/`.
 *
 * @param {Record<string,string>} snapshot @param {string} outDir
 * @param {{ writeFile?: (p: string, body: string, enc: string) => void, mkdir?: (p: string, opts: object) => void }} [io]
 * @returns {string[]} written relative paths (sorted)
 */
function writeComposeSnapshot(snapshot, outDir, io = {}) {
  const writeFile = io.writeFile || ((p, body, enc) => fs.writeFileSync(p, body, enc));
  const mkdir = io.mkdir || ((p, opts) => fs.mkdirSync(p, opts));
  const written = [];
  for (const [rel, content] of Object.entries(snapshot).sort((a, b) => a[0].localeCompare(b[0]))) {
    const abs = path.resolve(outDir, rel);
    mkdir(path.dirname(abs), { recursive: true });
    writeFile(abs, String(content), "utf8");
    written.push(rel);
  }
  return written;
}

/**
 * Write a JSON blob to `<outDir>/spec/<filename>` for downstream consumption
 * (e.g. `customize` reads `spec/repo-facts.json`). Returns the relative path
 * actually written.
 *
 * @param {string} outDir @param {string} filename @param {object} data
 * @param {{ writeFile?: (p: string, body: string, enc: string) => void, mkdir?: (p: string, opts: object) => void }} [io]
 */
function writeSpecFile(outDir, filename, data, io = {}) {
  const writeFile = io.writeFile || ((p, body, enc) => fs.writeFileSync(p, body, enc));
  const mkdir = io.mkdir || ((p, opts) => fs.mkdirSync(p, opts));
  const rel = path.posix.join("spec", filename);
  const abs = path.resolve(outDir, rel);
  mkdir(path.dirname(abs), { recursive: true });
  writeFile(abs, JSON.stringify(data, null, 2) + "\n", "utf8");
  return rel;
}

/**
 * Programmatic surface. Chains every stage with injectable deps so the
 * handler is hermetically testable.
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
 * @param {typeof composeInfraDeterministic} [deps.composeImpl]
 * @param {typeof runPlayValidators} [deps.validateImpl]
 * @param {Record<string, string|undefined>} [deps.env]
 * @param {(p: string, enc: string) => string} [deps.readFile]
 * @param {(p: string, body: string, enc: string) => void} [deps.writeFile]
 * @param {(p: string, opts: object) => void} [deps.mkdir]
 * @param {string} [deps.seedListPath]
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
  const composeImpl = deps.composeImpl || composeInfraDeterministic;
  const validateImpl = deps.validateImpl || runPlayValidators;
  const readFile = deps.readFile;
  const writeFile = deps.writeFile;
  const mkdir = deps.mkdir;

  /** @type {ReturnType<typeof parseInstallArgs>} */
  let parsed;
  try {
    parsed = parseInstallArgs(args || []);
  } catch (err) {
    if (err instanceof InstallHandlerError) {
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

  if (parsed.asPlay === null) {
    if (json) {
      emit(stdout, JSON.stringify({
        ok: false,
        error: { code: "bad_args", message: "--as-play <url|slug> is required", exit_code: EXIT.USAGE },
      }));
    } else {
      emit(stderr, "error: --as-play <url|slug> is required");
      emit(stderr, buildHelp());
    }
    return EXIT.USAGE;
  }

  // ── 1. Resolve --as-play → URL ──
  const resolve = resolveAsPlayInput(parsed.asPlay, { seedListPath: deps.seedListPath, readFile });
  if (!resolve.ok) {
    if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "unknown_slug", message: resolve.error, exit_code: EXIT.USAGE } }));
    else emit(stderr, `error: ${resolve.error}`);
    return EXIT.USAGE;
  }
  const inputUrl = resolve.url;

  // ── 2. Parse --customize (optional) ──
  let policy;
  if (parsed.customize) {
    const r = parsePolicyFile(parsed.customize, readFile);
    if (!r.ok) {
      if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "bad_policy", message: r.error, exit_code: EXIT.NOINPUT } }));
      else emit(stderr, `error: ${r.error}`);
      return EXIT.NOINPUT;
    }
    policy = r.data;
  }

  // ── 3. Transport ──
  const transport = deps.transport || buildTransport(env);
  if (!transport) {
    const message = "no GitHub transport configured (set GH_TOKEN_1, GH_TOKEN_2, or GH_TOKEN_3)";
    if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "no_transport", message, exit_code: EXIT.USAGE } }));
    else emit(stderr, `error: ${message}`);
    return EXIT.USAGE;
  }

  const stages = {
    /** @type {Record<string, {status: string, duration_ms?: number}>} */
    by_name: {},
  };
  const stamp = async (name, fn) => {
    const t0 = Date.now();
    try {
      const r = await fn();
      stages.by_name[name] = { status: "ok", duration_ms: Date.now() - t0 };
      return r;
    } catch (err) {
      stages.by_name[name] = { status: "failed", duration_ms: Date.now() - t0 };
      throw err;
    }
  };

  // ── 4. discover ──
  let discoverResult;
  try {
    discoverResult = await stamp("discover", () => discoverImpl({
      input: inputUrl, transport, noCache: parsed.noCache,
    }));
  } catch (err) {
    const exitCode = mapDiscoverErrorToExit(err);
    const code = (err && err.code) || "discover_failed";
    const message = err instanceof Error ? err.message : String(err);
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "discover", stages: stages.by_name, error: { code, message, exit_code: exitCode } }));
    else emit(stderr, `error[discover/${code}]: ${message}`);
    return exitCode;
  }

  if (discoverResult.source === "review-queued" || typeof discoverResult.exitHint === "number") {
    const exitCode = typeof discoverResult.exitHint === "number" ? discoverResult.exitHint : EXIT.UNAVAILABLE;
    if (exitCode !== EXIT.OK) {
      if (json) {
        emit(stdout, JSON.stringify({
          ok: false, stage: "discover", stages: stages.by_name,
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
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "discover", stages: stages.by_name, error: { code: "no_sha", message, exit_code: EXIT.DATA_ERR } }));
    else emit(stderr, `error[discover]: ${message}`);
    return EXIT.DATA_ERR;
  }

  // ── 5. fetch ──
  let fetchResult;
  try {
    fetchResult = await stamp("fetch", () => fetchImpl({
      owner, repo, upstreamCommitSha: sha,
      force: parsed.force,
      persistDir: parsed.persistDir,
      workdirRoot: parsed.workdirRoot,
    }));
  } catch (err) {
    const exitCode = mapFetchErrorToExit(err);
    const code = (err && err.code) || "fetch_failed";
    const message = err instanceof Error ? err.message : String(err);
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "fetch", stages: stages.by_name, error: { code, message, exit_code: exitCode } }));
    else emit(stderr, `error[fetch/${code}]: ${message}`);
    return exitCode;
  }
  const fetchRecord = fetchResult && fetchResult.record;
  if (!fetchRecord || typeof fetchRecord !== "object") {
    const message = "fetch did not return a usable FetchRecord";
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "fetch", stages: stages.by_name, error: { code: "no_record", message, exit_code: EXIT.DATA_ERR } }));
    else emit(stderr, `error[fetch]: ${message}`);
    return EXIT.DATA_ERR;
  }

  // ── 6. extract ──
  let extractResult;
  try {
    extractResult = await stamp("extract", () => extractImpl({ fetchRecord, verbose }));
  } catch (err) {
    const code = (err && err.code) || "extract_failed";
    const message = err instanceof Error ? err.message : String(err);
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "extract", stages: stages.by_name, error: { code, message, exit_code: EXIT.SOFTWARE } }));
    else emit(stderr, `error[extract/${code}]: ${message}`);
    return EXIT.SOFTWARE;
  }
  if (extractResult.valid === false) {
    const n = Array.isArray(extractResult.errors) ? extractResult.errors.length : 0;
    const message = `RepoFacts validation failed (${n} errors); cannot proceed to scaffold`;
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "extract", stages: stages.by_name, error: { code: "facts_invalid", message, exit_code: EXIT.DATA_ERR, errors: extractResult.errors || [] } }));
    else emit(stderr, `error[extract]: ${message}`);
    return EXIT.DATA_ERR;
  }
  const facts = extractResult.facts;
  if (!facts || typeof facts !== "object") {
    const message = "extract did not return usable RepoFacts";
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "extract", stages: stages.by_name, error: { code: "no_facts", message, exit_code: EXIT.DATA_ERR } }));
    else emit(stderr, `error[extract]: ${message}`);
    return EXIT.DATA_ERR;
  }

  const slug = deriveSlug(facts, owner, repo);
  const outDir = parsed.outDir
    ? path.resolve(parsed.outDir)
    : path.resolve(process.cwd(), "tmp", "plays", slug);

  // ── 7. retrieve (optional) ──
  let retrievalRecord;
  if (!parsed.noRetrieve) {
    try {
      retrievalRecord = await stamp("retrieve", () => retrieveImpl({
        repoFacts: facts,
        topK: parsed.topK != null ? parsed.topK : undefined,
        mock: parsed.mock || !(env.OPENAI_API_KEY && String(env.OPENAI_API_KEY).length > 0),
        verbose,
      }));
    } catch (err) {
      let exitCode = EXIT.SOFTWARE;
      if (Number.isInteger(err && err.exit_code)) exitCode = err.exit_code;
      else if ((err && err.code) === "embed_failed") exitCode = EXIT.TEMPFAIL;
      else if ((err && err.code) === "corpus_load_failed") exitCode = EXIT.DATA_ERR;
      const code = (err && err.code) || "retrieve_failed";
      const message = err instanceof Error ? err.message : String(err);
      if (json) emit(stdout, JSON.stringify({ ok: false, stage: "retrieve", stages: stages.by_name, error: { code, message, exit_code: exitCode } }));
      else emit(stderr, `error[retrieve/${code}]: ${message}`);
      return exitCode;
    }
  } else {
    stages.by_name.retrieve = { status: "skipped", duration_ms: 0 };
  }

  // ── 8. scaffold ──
  let scaffoldResult;
  try {
    scaffoldResult = await stamp("scaffold", () => scaffoldImpl({
      repoFacts: facts,
      retrievalRecord,
      slug,
      repo: `${owner}/${repo}`,
      model: parsed.model || undefined,
      outDir,
    }));
  } catch (err) {
    const exitCode = mapScaffoldErrorToExit(err);
    const code = (err && err.code) || "scaffold_failed";
    const message = err instanceof Error ? err.message : String(err);
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "scaffold", stages: stages.by_name, error: { code, message, exit_code: exitCode } }));
    else emit(stderr, `error[scaffold/${code}]: ${message}`);
    return exitCode;
  }
  if (scaffoldResult && scaffoldResult.commit_ok === false) {
    if (!json) {
      const agg = typeof scaffoldResult.aggregate === "number" ? scaffoldResult.aggregate.toFixed(3) : "?";
      emit(stderr, `warning: scaffold aggregate confidence ${agg} < 0.7 (commit bar)`);
    }
    // soft DATA_ERR mirroring H8.6 — the play emitted but is below the bar.
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "scaffold", stages: stages.by_name, error: { code: "below_commit_bar", message: "scaffold aggregate confidence below 0.7", exit_code: EXIT.DATA_ERR, aggregate: scaffoldResult.aggregate } }));
    return EXIT.DATA_ERR;
  }

  // ── 9. compose-infra ──
  let composeResult;
  try {
    composeResult = await stamp("compose-infra", () => composeImpl(facts, {
      policy,
    }));
  } catch (err) {
    const exitCode = mapComposeInfraErrorToExit(err);
    const code = (err && err.code) || "compose_infra_failed";
    const message = err instanceof Error ? err.message : String(err);
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "compose-infra", stages: stages.by_name, error: { code, message, exit_code: exitCode } }));
    else emit(stderr, `error[compose-infra/${code}]: ${message}`);
    return exitCode;
  }

  // ── 10. write infra + spec files ──
  let composeWritten = [];
  let specRepoFactsPath = null;
  try {
    composeWritten = writeComposeSnapshot(composeResult.snapshot, outDir, { writeFile, mkdir });
    // Persist RepoFacts under spec/ so `customize` can re-read it later.
    specRepoFactsPath = writeSpecFile(outDir, "repo-facts.json", facts, { writeFile, mkdir });
  } catch (err) {
    const code = (err && err.code) || "write_failed";
    const message = err instanceof Error ? err.message : String(err);
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "write", stages: stages.by_name, error: { code, message, exit_code: EXIT.IOERR } }));
    else emit(stderr, `error[write/${code}]: ${message}`);
    return EXIT.IOERR;
  }

  // ── 11. validate (optional skip) ──
  let validateAggregate = null;
  if (!parsed.skipValidate) {
    try {
      validateAggregate = await stamp("validate", () => validateImpl({
        play: slug,
        playDir: outDir,
        repoFacts: facts,
        policy: policy || {},
        manifest: {},
        files: composeWritten,
      }));
    } catch (err) {
      const code = (err && err.code) || "validate_failed";
      const message = err instanceof Error ? err.message : String(err);
      if (json) emit(stdout, JSON.stringify({ ok: false, stage: "validate", stages: stages.by_name, error: { code, message, exit_code: EXIT.SOFTWARE } }));
      else emit(stderr, `error[validate/${code}]: ${message}`);
      return EXIT.SOFTWARE;
    }
    if (validateAggregate && String(validateAggregate.overall || "").toUpperCase() !== String(VALIDATE_STATUS.PASS).toUpperCase()) {
      if (!json) emit(stderr, `error[validate]: ${formatSummaryLine(validateAggregate)}`);
      if (json) emit(stdout, JSON.stringify({
        ok: false, stage: "validate", stages: stages.by_name,
        validation: validateAggregate,
        error: {
          code: "validation_failed",
          message: formatSummaryLine(validateAggregate),
          exit_code: EXIT.DATA_ERR,
        },
      }));
      return EXIT.DATA_ERR;
    }
  } else {
    stages.by_name.validate = { status: "skipped", duration_ms: 0 };
  }

  // ── 12. emit success summary ──
  const summary = {
    ok: true,
    slug,
    owner_repo: `${owner}/${repo}`,
    upstream_commit_sha: sha,
    out_dir: outDir,
    composition: composeResult.decision && composeResult.decision.composition,
    coverage: composeResult.decision && composeResult.decision.coverage,
    module_count: (composeResult.ast && Array.isArray(composeResult.ast.modules)) ? composeResult.ast.modules.length : 0,
    compose_hash: composeResult.hash,
    scaffold: scaffoldResult ? {
      file_count: scaffoldResult.file_count,
      aggregate: scaffoldResult.aggregate,
      aggregate_band: scaffoldResult.aggregate_band,
      commit_ok: scaffoldResult.commit_ok,
      written: scaffoldResult.written,
    } : null,
    written: {
      compose: composeWritten,
      spec_repo_facts: specRepoFactsPath,
    },
    validation: validateAggregate ? {
      overall: validateAggregate.overall,
      passed: validateAggregate.passed,
      failed: validateAggregate.failed,
      skipped: validateAggregate.skipped,
      total: validateAggregate.total,
    } : null,
    validation_skipped: !!parsed.skipValidate,
    customize_policy_applied: !!policy,
    stages: stages.by_name,
  };
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
  DEFAULT_SEED_LIST_PATH,
  InstallHandlerError,
  parseInstallArgs,
  buildHelp,
  buildTransport,
  looksLikeUrl,
  resolveAsPlayInput,
  deriveSlug,
  mapScaffoldErrorToExit,
  mapComposeInfraErrorToExit,
  writeComposeSnapshot,
  writeSpecFile,
  runWithDeps,
  run,
};
