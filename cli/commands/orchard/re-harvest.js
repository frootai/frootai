// @ts-check
/**
 * [H8.11] re-harvest.js — `frootai orchard re-harvest <play>` handler.
 *
 * Contract (verbatim from masterplan §3 row [H8.11]):
 *   `frootai orchard re-harvest <play>` re-runs pipeline at upstream HEAD;
 *   emits 3-way diff against published version; founder approves.
 *
 * Tenth stage handler the [H8.1] router lazy-loads. The "stay-fresh"
 * command: a developer who installed a play N weeks ago types this to
 * re-run the entire H1..H6 pipeline at the CURRENT upstream HEAD and see
 * what changed. The default mode is DRY-RUN (emit 3-way diff; no writes)
 * — the founder explicitly opts in with `--apply` before any file on
 * disk is replaced (this honors the "founder approves" half of the
 * contract).
 *
 * Two modes:
 *
 *   ─ DRY-RUN (default): runs the full pipeline into a staging directory
 *     (`<play>/.re-harvest-staging/` by default; `--out <dir>` overrides),
 *     walks both the existing play AND the staging output, emits a 3-way
 *     diff JSON. The user inspects the diff (and optionally diffs the
 *     staging dir vs the play dir) before re-running with `--apply`.
 *
 *   ─ APPLY (`--apply`): does the same pipeline run, but after the diff
 *     is computed it writes every (added/modified/removed) file into the
 *     play dir, backing up the prior content to `<file>.bak` first.
 *     Mirrors the H8.8 customize `writeNewSnapshot` discipline.
 *
 * Pipeline (per invocation):
 *   1. parse argv (`<play-dir>`, `--apply`, `--out <dir>`, `--customize`,
 *      `--no-cache`, `--force`, `--no-retrieve`, `--mock`, `--top-k`,
 *      `--model`, `--skip-validate`, `--persist-dir`, `--workdir-root`,
 *      `--upstream-ref <ref>`, `--max-diffs <n>`, `--json`, `--help`)
 *   2. load the existing play from disk: walks the tree, reads
 *      `spec/repo-facts.json` (REQUIRED — supplies upstream URL +
 *      previous SHA). Reuses the H8.10 `loadPlayFromDir` helper.
 *   3. resolve upstream URL: take from `repoFacts.upstream_url` |
 *      `repoFacts.full_name` | `repoFacts.repo` (in that order).
 *   4. parse `--customize` overlay (optional, via H8.7 parser)
 *   5. build GitHub transport from env (reuses H8.9 builder)
 *   6. chain `discover → fetch → extract → retrieve → scaffold →
 *      compose-infra` at upstream HEAD (or `--upstream-ref <ref>`),
 *      writing scaffold + compose output into the staging directory.
 *   7. walk the staging directory → NEW snapshot
 *   8. compute 3-way diff against (BASE=on-disk, CURRENT=on-disk, NEW=staging)
 *      via `buildHarvestDiff`. Change taxonomy:
 *      - `unchanged`              — content identical between disk + staging
 *      - `added_by_new_harvest`   — only in staging
 *      - `removed_by_new_harvest` — only on disk
 *      - `modified_by_new_harvest`— present in both with different content
 *   9. if `--apply`: write the staging snapshot over the play dir, .bak-ing
 *      any modified/removed files. Otherwise just emit the diff JSON.
 *  10. emit a structured ReHarvestResult JSON summary.
 *
 * Two surfaces (mirrors H8.3..H8.10):
 *
 *   1. Programmatic `runWithDeps(args, ctx, deps) → Promise<number>` —
 *      pure + injectable: `{harvestImpl, transport, env, readFile,
 *      writeFile, mkdir, existsSync, statSync, readdirSync, unlinkSync,
 *      seedListPath}`. `harvestImpl` is the single seam that runs the
 *      whole H1..H6 pipeline — the default implementation chains the
 *      real stage libraries; tests inject a stub that returns
 *      `{newSnapshot, scaffold, compose, validation, stages}` directly
 *      so they don't need to mock 6 separate stages.
 *
 *   2. Router-facing `run(args, ctx)` — default deps wire the real
 *      pipeline + real `node:fs`.
 *
 * Subcommand argv grammar (everything AFTER `re-harvest` in `argv`):
 *   <play-dir>            path to the existing play directory (required)
 *   --apply               write the re-harvested files into the play dir
 *                         (default: dry-run; emit diff only)
 *   --out <dir>           staging directory (default: `<play>/.re-harvest-staging/`)
 *   --customize <path>    org policy file applied at compose-infra (YAML/JSON)
 *   --no-cache            bypass discover cache READ
 *   --force               re-fetch even if cached FetchRecord is fresh
 *   --no-retrieve         skip H4 exemplar retrieval
 *   --mock                use deterministic mock LLM + mock embeddings
 *   --top-k <n>           number of nearest plays to retrieve (default 5)
 *   --model <name>        override scaffold LLM (default gpt-4o-mini)
 *   --skip-validate       skip the H7 validator gate on the new play
 *   --persist-dir <p>     override FetchRecord persist directory
 *   --workdir-root <p>    override the temp clone workdir root
 *   --upstream-ref <ref>  upstream branch/tag/SHA (default: HEAD)
 *   --max-diffs <n>       cap diff array in stdout (default 100)
 *   --json                (router-inherited) machine-readable JSON to stdout
 *   --help, -h            print subcommand help + exit OK
 *
 * Exit codes (sysexits-aligned; FIRST failure wins):
 *   0    OK             — diff emitted (dry-run) OR files applied OK
 *   64   USAGE          — bad flags / missing <play-dir> / no transport
 *   65   DATA_ERR       — pre-stage schema gate; scaffold commit-bar; H6 build
 *                          fail; H7 validation overall FAIL on the new play
 *   66   NOINPUT        — play-dir / spec/repo-facts.json / --customize
 *                          unreadable or malformed; no upstream URL in facts
 *   69   UNAVAILABLE    — discover review queue; H6 gold_fallback_required
 *   70   SOFTWARE       — unexpected internal error
 *   74   IOERR          — staging-write OR apply-write failure
 *   75   TEMPFAIL       — retrieve embed_failed; scaffold llm_call_failed
 *   77   NOPERM         — 403 / forbidden
 *
 * Non-goals for THIS ship:
 *   - "Compare against PUBLISHED version on CDN" (the literal masterplan
 *     phrasing) — that would require fetching the canonical published
 *     bundle from `cdn.frootai.dev/plays/<slug>/<version>.zip`. Today
 *     we treat the ON-DISK play as the proxy for "the version the
 *     developer currently has installed". A future ship can extend
 *     `harvestImpl` to also pull the published bundle for a true 3-way.
 *   - Auto-promotion to the CDN (that's `commit --upgrade-to-play`).
 *   - Cherry-picking which files to apply (today: all-or-nothing per
 *     --apply invocation; future row could add `--only <glob>`).
 *
 * License: CC0-1.0.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

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

// Lazy-require chained libs at handler-load time so transitive-dep errors
// surface as EX_SOFTWARE (NOT "not yet wired").
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
const {
  runPlayValidators,
  formatSummaryLine,
  STATUS: VALIDATE_STATUS,
} = require(path.join(VALIDATE_LIB_DIR, "play.js"));

// Reuse sibling-handler helpers — single source of truth for the loaders.
const { parsePolicyFile } = require("./compose-infra.js");
const installH = require("./install.js");
const { loadPlayFromDir, walkPlayDir } = require("./commit.js");

/** Local sysexits enum (superset across H1..H7 chained stages). */
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
  "--out", "--customize", "--top-k", "--model",
  "--persist-dir", "--workdir-root", "--upstream-ref", "--max-diffs",
]);

/** Default cap for the diff array in stdout output. */
const DEFAULT_MAX_DIFFS = 100;

/** Default staging-dir name (under the play dir). Dot-prefixed so the H8.10
 *  walkPlayDir excludes it on the NEXT `commit` invocation. */
const DEFAULT_STAGING_DIRNAME = ".re-harvest-staging";

/** Error carrying a sysexits exit code so the handler returns the right number. */
class ReHarvestHandlerError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, exitCode?: number, cause?: Error }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = "ReHarvestHandlerError";
    this.code = opts.code || "re_harvest_handler_failed";
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Parse the subcommand-local argv. The first positional is `<play-dir>`
 * (REQUIRED). Unknown long flags are USAGE.
 *
 * @param {readonly string[]} argv
 * @returns {{ playDir: string|null, apply: boolean, outDir: string|null, customize: string|null, noCache: boolean, force: boolean, noRetrieve: boolean, mock: boolean, topK: number|null, model: string|null, skipValidate: boolean, persistDir: string|null, workdirRoot: string|null, upstreamRef: string|null, maxDiffs: number, json: boolean, help: boolean }}
 */
function parseReHarvestArgs(argv) {
  if (!Array.isArray(argv)) {
    throw new TypeError("parseReHarvestArgs: argv must be an array");
  }
  /** @type {{ playDir: string|null, apply: boolean, outDir: string|null, customize: string|null, noCache: boolean, force: boolean, noRetrieve: boolean, mock: boolean, topK: number|null, model: string|null, skipValidate: boolean, persistDir: string|null, workdirRoot: string|null, upstreamRef: string|null, maxDiffs: number, json: boolean, help: boolean }} */
  const out = {
    playDir: null, apply: false, outDir: null, customize: null,
    noCache: false, force: false, noRetrieve: false, mock: false,
    topK: null, model: null, skipValidate: false,
    persistDir: null, workdirRoot: null, upstreamRef: null,
    maxDiffs: DEFAULT_MAX_DIFFS, json: false, help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (typeof arg !== "string") {
      throw new ReHarvestHandlerError(`argv entry ${i} must be a string`, {
        code: "bad_args", exitCode: EXIT.USAGE,
      });
    }
    if (arg === "--help" || arg === "-h") { out.help = true; continue; }
    if (arg === "--apply") { out.apply = true; continue; }
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
          throw new ReHarvestHandlerError(`${vf} requires a value`, {
            code: "bad_args", exitCode: EXIT.USAGE,
          });
        }
        applyValueFlag(out, vf, v);
        handled = true; break;
      }
      if (arg.startsWith(`${vf}=`)) {
        const v = arg.slice(vf.length + 1);
        if (v.length === 0) {
          throw new ReHarvestHandlerError(`${vf}= requires a non-empty value`, {
            code: "bad_args", exitCode: EXIT.USAGE,
          });
        }
        applyValueFlag(out, vf, v);
        handled = true; break;
      }
    }
    if (handled) continue;

    if (arg.startsWith("-")) {
      throw new ReHarvestHandlerError(`unknown flag: ${arg}`, {
        code: "bad_args", exitCode: EXIT.USAGE,
      });
    }
    if (out.playDir === null) {
      out.playDir = arg;
      continue;
    }
    throw new ReHarvestHandlerError(
      `unexpected positional argument: ${arg} (already have <play-dir>=${out.playDir})`,
      { code: "bad_args", exitCode: EXIT.USAGE },
    );
  }
  if (out.topK !== null && (!Number.isInteger(out.topK) || out.topK < 1)) {
    throw new ReHarvestHandlerError(`--top-k must be a positive integer (got ${out.topK})`, {
      code: "bad_args", exitCode: EXIT.USAGE,
    });
  }
  if (!Number.isInteger(out.maxDiffs) || out.maxDiffs < 1) {
    throw new ReHarvestHandlerError(`--max-diffs must be a positive integer (got ${out.maxDiffs})`, {
      code: "bad_args", exitCode: EXIT.USAGE,
    });
  }
  return out;
}

function applyValueFlag(out, vf, v) {
  if (vf === "--out") out.outDir = v;
  else if (vf === "--customize") out.customize = v;
  else if (vf === "--top-k") out.topK = parseInt(v, 10);
  else if (vf === "--model") out.model = v;
  else if (vf === "--persist-dir") out.persistDir = v;
  else if (vf === "--workdir-root") out.workdirRoot = v;
  else if (vf === "--upstream-ref") out.upstreamRef = v;
  else if (vf === "--max-diffs") out.maxDiffs = parseInt(v, 10);
}

/** Build the `frootai orchard re-harvest --help` banner. */
function buildHelp() {
  return [
    "Usage: frootai orchard re-harvest <play-dir> [options]",
    "",
    "Re-run the H1..H6 pipeline at upstream HEAD against a play already on disk,",
    "emit a 3-way diff. Default mode is DRY-RUN — pass --apply to write the new",
    "files into the play (each replaced file is backed up to <file>.bak first).",
    "",
    "Arguments:",
    "  <play-dir>            path to the existing play directory (required)",
    "",
    "Mode:",
    "  --apply               write the re-harvested files into <play-dir>",
    "                        (default: dry-run; emit diff only — 'founder approves')",
    "  --out <dir>           staging directory (default: <play>/.re-harvest-staging/)",
    "",
    "Pipeline options (mirror `install`):",
    "  --customize <path>    org policy file applied at compose-infra (YAML/JSON)",
    "  --no-cache            bypass discover cache READ",
    "  --force               re-fetch even if cached FetchRecord is fresh",
    "  --no-retrieve         skip H4 exemplar retrieval",
    "  --mock                use deterministic mock LLM + mock embeddings",
    "  --top-k <n>           number of nearest plays to retrieve (default 5)",
    "  --model <name>        override scaffold LLM (default gpt-4o-mini)",
    "  --skip-validate       skip the H7 validator gate on the new play",
    "  --persist-dir <dir>   override FetchRecord persist directory",
    "  --workdir-root <dir>  override the temp clone workdir root",
    "  --upstream-ref <ref>  upstream branch/tag/SHA (default: HEAD)",
    "  --max-diffs <n>       cap diff array in stdout (default 100)",
    "",
    "Output:",
    "  --json                machine-readable single-line JSON to stdout (default)",
    "  --help, -h            show this help and exit",
    "",
    "Exit codes:",
    "  0   success (diff emitted OR --apply written)",
    "  64  bad args / missing <play-dir> / no transport",
    "  65  pre-stage schema gate; scaffold commit-bar; H6 build/validate; H7 RED",
    "  66  play-dir / repo-facts.json / --customize unreadable; no upstream URL",
    "  69  review-queue routing; H6 gold_fallback_required",
    "  70  unexpected internal error",
    "  74  staging-write OR apply-write failure",
    "  75  retrieve embed_failed; scaffold llm_call_failed (transient)",
    "  77  forbidden (private repo or missing PAT scope)",
    "",
    "Examples:",
    "  frootai orchard re-harvest ./my-play                    # diff only",
    "  frootai orchard re-harvest ./my-play --apply            # write in-place",
    "  frootai orchard re-harvest ./my-play --customize ./p.yaml --apply",
    "  frootai orchard re-harvest ./my-play --upstream-ref main --mock",
    "",
  ].join("\n");
}

/** Emit a string to a sink that may be `(s) => void` or `{ write }`. */
function emit(sink, text) {
  const s = text.endsWith("\n") ? text : `${text}\n`;
  if (typeof sink === "function") sink(s);
  else if (sink && typeof sink.write === "function") sink.write(s);
}

/** sha256 hex digest of a string. */
function sha256(s) {
  return crypto.createHash("sha256").update(typeof s === "string" ? s : "", "utf8").digest("hex");
}

/**
 * Pull the upstream repo URL out of the loaded play's RepoFacts. Accepts
 * (in priority order) `upstream_url`, `full_name` (owner/repo shorthand),
 * `repo` (same). Returns null if none of those are present.
 *
 * @param {object} repoFacts
 * @returns {string|null}
 */
function resolveUpstreamFromFacts(repoFacts) {
  if (!repoFacts || typeof repoFacts !== "object") return null;
  if (typeof repoFacts.upstream_url === "string" && repoFacts.upstream_url.length > 0) {
    return repoFacts.upstream_url;
  }
  if (typeof repoFacts.full_name === "string" && repoFacts.full_name.length > 0) {
    return repoFacts.full_name;
  }
  if (typeof repoFacts.repo === "string" && repoFacts.repo.length > 0) {
    return repoFacts.repo;
  }
  return null;
}

/**
 * Build the 2-as-3-way harvest diff between the current on-disk play
 * snapshot and the freshly re-harvested NEW snapshot. The "BASE" axis is
 * collapsed to the CURRENT axis today (we don't store a separate
 * vanilla baseline for the install state) — the data shape preserves
 * the three slots so a future ship can populate BASE from the published
 * CDN bundle for a true 3-way.
 *
 * `change` taxonomy:
 *   - `unchanged`                — hashes match
 *   - `added_by_new_harvest`     — only in NEW
 *   - `removed_by_new_harvest`   — only in CURRENT
 *   - `modified_by_new_harvest`  — present in both with different content
 *
 * Sorted alphabetically by path for deterministic output.
 *
 * @param {Record<string,string>} currentSnap
 * @param {Record<string,string>} newSnap
 * @returns {{ diffs: Array<object>, summary: { unchanged: number, added: number, removed: number, modified: number, total: number } }}
 */
function buildHarvestDiff(currentSnap, newSnap) {
  const allPaths = new Set([
    ...Object.keys(currentSnap || {}),
    ...Object.keys(newSnap || {}),
  ]);
  const sorted = [...allPaths].sort();

  /** @type {Array<object>} */
  const diffs = [];
  let unchanged = 0, added = 0, removed = 0, modified = 0;

  for (const p of sorted) {
    const inCur = p in currentSnap;
    const inNew = p in newSnap;
    const hCur = inCur ? sha256(currentSnap[p]) : null;
    const hNew = inNew ? sha256(newSnap[p]) : null;

    let change;
    if (hCur === hNew) {
      change = "unchanged";
      unchanged++;
    } else if (!inCur && inNew) {
      change = "added_by_new_harvest";
      added++;
    } else if (inCur && !inNew) {
      change = "removed_by_new_harvest";
      removed++;
    } else {
      change = "modified_by_new_harvest";
      modified++;
    }

    diffs.push({
      path: p,
      in_base: inCur,    // collapsed-3-way: BASE === CURRENT for now
      in_current: inCur,
      in_new: inNew,
      hash_base: hCur,
      hash_current: hCur,
      hash_new: hNew,
      change,
    });
  }

  return {
    diffs,
    summary: { unchanged, added, removed, modified, total: diffs.length },
  };
}

/**
 * Convert a `loadPlayFromDir`-style `files: [{path, content}]` array to a
 * `path → content` snapshot map (for hashing + diffing).
 *
 * @param {Array<{path: string, content: string}>} files
 * @returns {Record<string,string>}
 */
function filesToSnapshot(files) {
  /** @type {Record<string,string>} */
  const snap = {};
  for (const f of files || []) {
    if (!f || typeof f.path !== "string") continue;
    snap[f.path] = String(f.content || "");
  }
  return snap;
}

/**
 * Write the new snapshot OVER the play directory, backing up each replaced
 * file to `<file>.bak` first. Mirrors the H8.8 `writeNewSnapshot` shape but
 * extended to the full play tree (not just infra/ paths). Files in
 * currentSnap but absent from newSnap are removed (after .bak).
 *
 * @param {string} playDir
 * @param {Record<string,string>} currentSnap
 * @param {Record<string,string>} newSnap
 * @param {{ writeFile?: (p: string, body: string, enc: string) => void, mkdir?: (p: string, opts: object) => void, existsSync?: (p: string) => boolean, readFile?: (p: string, enc: string) => string, unlinkSync?: (p: string) => void }} [io]
 * @returns {Array<{ path: string, action: string, backed_up: boolean }>}
 */
function writeNewSnapshot(playDir, currentSnap, newSnap, io = {}) {
  const writeFile = io.writeFile || ((p, body, enc) => fs.writeFileSync(p, body, enc));
  const mkdirSync = io.mkdir || ((p, opts) => fs.mkdirSync(p, opts));
  const exists = io.existsSync || fs.existsSync;
  const readFile = io.readFile || ((p, enc) => fs.readFileSync(p, enc));
  const unlinkSync = io.unlinkSync || ((p) => fs.unlinkSync(p));

  /** @type {Array<{ path: string, action: string, backed_up: boolean }>} */
  const written = [];
  const allPaths = new Set([...Object.keys(currentSnap || {}), ...Object.keys(newSnap || {})]);

  for (const rel of [...allPaths].sort()) {
    const abs = path.resolve(playDir, rel);
    const cur = currentSnap[rel];
    const nxt = newSnap[rel];
    const curHash = typeof cur === "string" ? sha256(cur) : null;
    const nxtHash = typeof nxt === "string" ? sha256(nxt) : null;
    if (curHash === nxtHash) continue;

    let backedUp = false;
    if (typeof cur === "string" && exists(abs)) {
      try {
        const bakPath = `${abs}.bak`;
        writeFile(bakPath, readFile(abs, "utf8"), "utf8");
        backedUp = true;
      } catch { backedUp = false; }
    }

    if (typeof nxt === "string") {
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFile(abs, nxt, "utf8");
      written.push({ path: rel, action: typeof cur === "string" ? "modified" : "added", backed_up: backedUp });
    } else {
      try { unlinkSync(abs); } catch { /* ignore */ }
      written.push({ path: rel, action: "removed", backed_up: backedUp });
    }
  }
  return written;
}

/**
 * Default harvest pipeline: chains H1→H2→H3→H4→H5→H6 (+ H7) at the given
 * upstream URL, writes scaffold + compose output into the staging dir,
 * walks the staging dir, returns the NEW snapshot + per-stage timing.
 *
 * Tests inject a stub `harvestImpl` to bypass the real pipeline entirely.
 *
 * @param {object} opts
 * @returns {Promise<{ ok: boolean, newSnapshot?: Record<string,string>, scaffold?: object, compose?: object, validation?: object|null, stages?: object, error?: { stage: string, code: string, message: string, exit_code: number } }>}
 */
async function defaultHarvestImpl(opts) {
  const {
    upstreamUrl, upstreamRef, stagingDir, repoFacts: _existingFacts,
    policy, noCache, force, noRetrieve, mock, topK, model,
    skipValidate, persistDir, workdirRoot, transport, env,
    readFile, writeFile, mkdir, readdirSync, statSync,
    discoverImpl = discover,
    fetchImpl = fetch,
    extractImpl = extract,
    retrieveImpl = retrieve,
    scaffoldImpl = scaffold,
    composeImpl = composeInfraDeterministic,
    validateImpl = runPlayValidators,
  } = opts;

  /** @type {Record<string, {status: string, duration_ms?: number}>} */
  const stages = {};
  const stamp = async (name, fn) => {
    const t0 = Date.now();
    try {
      const r = await fn();
      stages[name] = { status: "ok", duration_ms: Date.now() - t0 };
      return r;
    } catch (err) {
      stages[name] = { status: "failed", duration_ms: Date.now() - t0 };
      throw err;
    }
  };

  // ── discover ──
  let discoverResult;
  try {
    discoverResult = await stamp("discover", () => discoverImpl({
      input: upstreamUrl, transport, noCache: !!noCache,
      ref: upstreamRef || undefined,
    }));
  } catch (err) {
    return { ok: false, stages, error: errorEnvelope("discover", err, mapDiscoverErrorToExit(err)) };
  }

  if (discoverResult.source === "review-queued" || typeof discoverResult.exitHint === "number") {
    const exitCode = typeof discoverResult.exitHint === "number" ? discoverResult.exitHint : EXIT.UNAVAILABLE;
    if (exitCode !== EXIT.OK) {
      return {
        ok: false, stages,
        error: {
          stage: "discover", code: "review_queued",
          message: `routed to review queue (${discoverResult.reviewReason || "unspecified"})`,
          exit_code: exitCode,
        },
      };
    }
  }

  const sha = discoverResult.record && discoverResult.record.upstream_commit_sha;
  const owner = discoverResult.normalized && discoverResult.normalized.owner;
  const repo = discoverResult.normalized && discoverResult.normalized.repo;
  if (typeof sha !== "string" || !sha || !owner || !repo) {
    return { ok: false, stages, error: { stage: "discover", code: "no_sha", message: "discover did not return owner/repo/SHA", exit_code: EXIT.DATA_ERR } };
  }

  // ── fetch ──
  let fetchResult;
  try {
    fetchResult = await stamp("fetch", () => fetchImpl({
      owner, repo, upstreamCommitSha: sha,
      force: !!force, persistDir, workdirRoot,
    }));
  } catch (err) {
    return { ok: false, stages, error: errorEnvelope("fetch", err, mapFetchErrorToExit(err)) };
  }
  const fetchRecord = fetchResult && fetchResult.record;
  if (!fetchRecord) {
    return { ok: false, stages, error: { stage: "fetch", code: "no_record", message: "fetch did not return a FetchRecord", exit_code: EXIT.DATA_ERR } };
  }

  // ── extract ──
  let extractResult;
  try {
    extractResult = await stamp("extract", () => extractImpl({ fetchRecord }));
  } catch (err) {
    return { ok: false, stages, error: errorEnvelope("extract", err, EXIT.SOFTWARE) };
  }
  if (extractResult.valid === false) {
    return {
      ok: false, stages,
      error: {
        stage: "extract", code: "facts_invalid",
        message: `RepoFacts validation failed (${(extractResult.errors || []).length} errors)`,
        exit_code: EXIT.DATA_ERR,
      },
    };
  }
  const facts = extractResult.facts;
  if (!facts) {
    return { ok: false, stages, error: { stage: "extract", code: "no_facts", message: "extract did not return RepoFacts", exit_code: EXIT.DATA_ERR } };
  }

  const slug = installH.deriveSlug(facts, owner, repo);

  // ── retrieve (optional) ──
  let retrievalRecord;
  if (!noRetrieve) {
    try {
      retrievalRecord = await stamp("retrieve", () => retrieveImpl({
        repoFacts: facts,
        topK: topK != null ? topK : undefined,
        mock: mock || !(env && env.OPENAI_API_KEY && String(env.OPENAI_API_KEY).length > 0),
      }));
    } catch (err) {
      let exitCode = EXIT.SOFTWARE;
      if (Number.isInteger(err && err.exit_code)) exitCode = err.exit_code;
      else if ((err && err.code) === "embed_failed") exitCode = EXIT.TEMPFAIL;
      else if ((err && err.code) === "corpus_load_failed") exitCode = EXIT.DATA_ERR;
      return { ok: false, stages, error: errorEnvelope("retrieve", err, exitCode) };
    }
  } else {
    stages.retrieve = { status: "skipped", duration_ms: 0 };
  }

  // ── scaffold (writes into stagingDir) ──
  let scaffoldResult;
  try {
    scaffoldResult = await stamp("scaffold", () => scaffoldImpl({
      repoFacts: facts, retrievalRecord, slug,
      repo: `${owner}/${repo}`, model: model || undefined,
      outDir: stagingDir,
    }));
  } catch (err) {
    return { ok: false, stages, error: errorEnvelope("scaffold", err, installH.mapScaffoldErrorToExit(err)) };
  }
  if (scaffoldResult && scaffoldResult.commit_ok === false) {
    return {
      ok: false, stages, scaffold: scaffoldResult,
      error: {
        stage: "scaffold", code: "below_commit_bar",
        message: `scaffold aggregate confidence below 0.7 (got ${scaffoldResult.aggregate})`,
        exit_code: EXIT.DATA_ERR,
      },
    };
  }

  // ── compose-infra ──
  let composeResult;
  try {
    composeResult = await stamp("compose-infra", () => composeImpl(facts, { policy }));
  } catch (err) {
    return { ok: false, stages, error: errorEnvelope("compose-infra", err, installH.mapComposeInfraErrorToExit(err)) };
  }

  // Write compose snapshot + spec/repo-facts.json into staging.
  try {
    installH.writeComposeSnapshot(composeResult.snapshot, stagingDir, { writeFile, mkdir });
    installH.writeSpecFile(stagingDir, "repo-facts.json", facts, { writeFile, mkdir });
  } catch (err) {
    return { ok: false, stages, error: errorEnvelope("write", err, EXIT.IOERR) };
  }

  // Walk staging dir → NEW snapshot.
  let newSnapshot;
  try {
    const entries = walkPlayDir(stagingDir, { readdirSync, statSync });
    /** @type {Record<string,string>} */
    const snap = {};
    for (const e of entries) {
      snap[e.relPath] = String((readFile || ((p, enc) => fs.readFileSync(p, enc)))(e.absPath, "utf8"));
    }
    newSnapshot = snap;
  } catch (err) {
    return { ok: false, stages, error: errorEnvelope("walk-staging", err, EXIT.IOERR) };
  }

  // ── validate (optional skip) ──
  let validation = null;
  if (!skipValidate) {
    try {
      const filesArr = Object.entries(newSnapshot).map(([p, content]) => ({ path: p, content }));
      validation = await stamp("validate", () => validateImpl({
        play: slug, playDir: stagingDir, repoFacts: facts,
        policy: policy || {}, manifest: {}, files: filesArr,
      }));
    } catch (err) {
      return { ok: false, stages, error: errorEnvelope("validate", err, EXIT.SOFTWARE) };
    }
    if (validation && String(validation.overall || "").toUpperCase() !== String(VALIDATE_STATUS.PASS).toUpperCase()) {
      return {
        ok: false, stages, validation,
        error: {
          stage: "validate", code: "validation_failed",
          message: formatSummaryLine(validation),
          exit_code: EXIT.DATA_ERR,
        },
      };
    }
  } else {
    stages.validate = { status: "skipped", duration_ms: 0 };
  }

  return {
    ok: true, newSnapshot,
    scaffold: scaffoldResult, compose: composeResult,
    validation, stages,
    discovered: { owner, repo, sha, slug },
  };
}

function errorEnvelope(stage, err, exitCode) {
  const code = (err && err.code) || `${stage}_failed`;
  const message = err instanceof Error ? err.message : String(err);
  return { stage, code, message, exit_code: exitCode };
}

/**
 * Programmatic surface. Loads the play, runs the harvest pipeline at HEAD,
 * builds the 3-way diff, and either emits it (dry-run) or applies it.
 *
 * @param {readonly string[]} args
 * @param {object} ctx
 * @param {object} [deps]
 * @param {(opts: object) => Promise<object>} [deps.harvestImpl]
 * @param {object} [deps.transport]
 * @param {Record<string, string|undefined>} [deps.env]
 * @param {(p: string, enc: string) => string} [deps.readFile]
 * @param {(p: string, body: string, enc: string) => void} [deps.writeFile]
 * @param {(p: string, opts: object) => void} [deps.mkdir]
 * @param {(p: string) => boolean} [deps.existsSync]
 * @param {(p: string) => any} [deps.statSync]
 * @param {(p: string, opts: object) => any[]} [deps.readdirSync]
 * @param {(p: string) => void} [deps.unlinkSync]
 * @returns {Promise<number>}
 */
async function runWithDeps(args, ctx, deps = {}) {
  const stdout = (ctx && ctx.stdout) || ((s) => process.stdout.write(s));
  const stderr = (ctx && ctx.stderr) || ((s) => process.stderr.write(s));
  const env = deps.env || process.env;
  const harvestImpl = deps.harvestImpl || defaultHarvestImpl;
  const readFile = deps.readFile;
  const writeFile = deps.writeFile;
  const mkdir = deps.mkdir;
  const existsSync = deps.existsSync;
  const statSync = deps.statSync;
  const readdirSync = deps.readdirSync;
  const unlinkSync = deps.unlinkSync;

  /** @type {ReturnType<typeof parseReHarvestArgs>} */
  let parsed;
  try {
    parsed = parseReHarvestArgs(args || []);
  } catch (err) {
    if (err instanceof ReHarvestHandlerError) {
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

  if (parsed.playDir === null) {
    if (json) {
      emit(stdout, JSON.stringify({
        ok: false,
        error: { code: "bad_args", message: "missing <play-dir> argument", exit_code: EXIT.USAGE },
      }));
    } else {
      emit(stderr, "error: missing <play-dir> argument");
      emit(stderr, buildHelp());
    }
    return EXIT.USAGE;
  }

  // ── 1. Load existing play ──
  const loaded = loadPlayFromDir(parsed.playDir, {
    readFile, readdirSync, statSync,
  });
  if (!loaded.ok) {
    if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "bad_play_dir", message: loaded.error, exit_code: EXIT.NOINPUT } }));
    else emit(stderr, `error: ${loaded.error}`);
    return EXIT.NOINPUT;
  }
  const play = loaded.play;

  // ── 2. Resolve upstream URL from facts ──
  const upstreamUrl = resolveUpstreamFromFacts(play.repoFacts);
  if (!upstreamUrl) {
    const message = "spec/repo-facts.json has no upstream_url / full_name / repo — cannot re-harvest";
    if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "no_upstream", message, exit_code: EXIT.NOINPUT } }));
    else emit(stderr, `error: ${message}`);
    return EXIT.NOINPUT;
  }

  // ── 3. Parse --customize (optional) ──
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

  // ── 4. Transport (only needed for default harvestImpl) ──
  let transport = deps.transport;
  if (!transport && harvestImpl === defaultHarvestImpl) {
    transport = installH.buildTransport(env);
    if (!transport) {
      const message = "no GitHub transport configured (set GH_TOKEN_1, GH_TOKEN_2, or GH_TOKEN_3)";
      if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "no_transport", message, exit_code: EXIT.USAGE } }));
      else emit(stderr, `error: ${message}`);
      return EXIT.USAGE;
    }
  }

  // ── 5. Staging dir ──
  const stagingDir = parsed.outDir
    ? path.resolve(parsed.outDir)
    : path.resolve(parsed.playDir, DEFAULT_STAGING_DIRNAME);

  // ── 6. Run harvest pipeline ──
  let harvest;
  try {
    harvest = await harvestImpl({
      upstreamUrl,
      upstreamRef: parsed.upstreamRef,
      stagingDir,
      repoFacts: play.repoFacts,
      policy,
      noCache: parsed.noCache,
      force: parsed.force,
      noRetrieve: parsed.noRetrieve,
      mock: parsed.mock,
      topK: parsed.topK,
      model: parsed.model,
      skipValidate: parsed.skipValidate,
      persistDir: parsed.persistDir,
      workdirRoot: parsed.workdirRoot,
      transport, env,
      readFile, writeFile, mkdir, readdirSync, statSync,
    });
  } catch (err) {
    const code = (err && err.code) || "harvest_failed";
    const message = err instanceof Error ? err.message : String(err);
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "harvest", error: { code, message, exit_code: EXIT.SOFTWARE } }));
    else emit(stderr, `error[harvest/${code}]: ${message}`);
    return EXIT.SOFTWARE;
  }

  if (!harvest || harvest.ok !== true) {
    const e = (harvest && harvest.error) || { stage: "harvest", code: "harvest_failed", message: "harvest did not return ok:true", exit_code: EXIT.SOFTWARE };
    if (json) {
      emit(stdout, JSON.stringify({
        ok: false, mode: parsed.apply ? "apply" : "dry-run",
        play_dir: parsed.playDir, staging_dir: stagingDir,
        upstream_url: upstreamUrl, upstream_ref: parsed.upstreamRef || null,
        stages: harvest && harvest.stages ? harvest.stages : {},
        error: e,
      }));
    } else {
      emit(stderr, `error[${e.stage}/${e.code}]: ${e.message}`);
    }
    return Number.isInteger(e.exit_code) ? e.exit_code : EXIT.SOFTWARE;
  }

  // ── 7. Build 3-way diff ──
  const currentSnap = filesToSnapshot(play.files);
  const newSnap = harvest.newSnapshot || {};
  const diff = buildHarvestDiff(currentSnap, newSnap);
  const truncated = diff.diffs.length > parsed.maxDiffs;
  const diffsForOutput = truncated ? diff.diffs.slice(0, parsed.maxDiffs) : diff.diffs;

  // ── 8. APPLY (optional) ──
  let writeResult = null;
  if (parsed.apply) {
    try {
      writeResult = writeNewSnapshot(parsed.playDir, currentSnap, newSnap, {
        writeFile, mkdir, existsSync, readFile, unlinkSync,
      });
    } catch (err) {
      const code = (err && err.code) || "apply_failed";
      const message = err instanceof Error ? err.message : String(err);
      if (json) emit(stdout, JSON.stringify({ ok: false, stage: "apply", error: { code, message, exit_code: EXIT.IOERR } }));
      else emit(stderr, `error[apply/${code}]: ${message}`);
      return EXIT.IOERR;
    }
  }

  // ── 9. Emit summary ──
  const summary = {
    ok: true,
    mode: parsed.apply ? "apply" : "dry-run",
    slug: play.slug,
    play_dir: parsed.playDir,
    staging_dir: stagingDir,
    upstream_url: upstreamUrl,
    upstream_ref: parsed.upstreamRef || null,
    previous_upstream_sha: play.upstreamSha || null,
    new_upstream_sha: (harvest.discovered && harvest.discovered.sha) || null,
    customize_policy_applied: !!policy,
    file_count_before: play.files.length,
    file_count_after: Object.keys(newSnap).length,
    diff_summary: diff.summary,
    diffs: diffsForOutput,
    diffs_truncated: truncated,
    diffs_total: diff.diffs.length,
    write_actions: writeResult,
    skipped_validate: !!parsed.skipValidate,
    validation: harvest.validation ? {
      overall: harvest.validation.overall,
      passed: harvest.validation.passed,
      failed: harvest.validation.failed,
      skipped: harvest.validation.skipped,
      total: harvest.validation.total,
    } : null,
    scaffold: harvest.scaffold ? {
      file_count: harvest.scaffold.file_count,
      aggregate: harvest.scaffold.aggregate,
      aggregate_band: harvest.scaffold.aggregate_band,
      commit_ok: harvest.scaffold.commit_ok,
    } : null,
    compose: harvest.compose ? {
      composition: harvest.compose.decision && harvest.compose.decision.composition,
      coverage: harvest.compose.decision && harvest.compose.decision.coverage,
      module_count: (harvest.compose.ast && Array.isArray(harvest.compose.ast.modules)) ? harvest.compose.ast.modules.length : 0,
      hash: harvest.compose.hash,
    } : null,
    stages: harvest.stages || {},
    next_step: parsed.apply
      ? "diff applied; review .bak files; commit when satisfied"
      : (diff.summary.added + diff.summary.modified + diff.summary.removed > 0
          ? "re-run with --apply to write the new files in place"
          : "no changes — play is already at upstream HEAD"),
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
  DEFAULT_MAX_DIFFS,
  DEFAULT_STAGING_DIRNAME,
  ReHarvestHandlerError,
  parseReHarvestArgs,
  buildHelp,
  resolveUpstreamFromFacts,
  buildHarvestDiff,
  filesToSnapshot,
  writeNewSnapshot,
  defaultHarvestImpl,
  runWithDeps,
  run,
};
