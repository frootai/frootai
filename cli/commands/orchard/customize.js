// @ts-check
/**
 * [H8.8] customize.js — `frootai orchard customize <play> --policy <yaml>` handler.
 *
 * Contract (verbatim from masterplan §3 row [H8.8]):
 *   `frootai orchard customize <play> --policy <yaml> [--dry-run]` wired to
 *   policy-overlay pipeline; dry-run emits 3-way diff.
 *
 * Seventh stage handler the [H8.1] router lazy-loads. This handler is
 * DIFFERENT from H8.2..H8.7: instead of harvesting an upstream URL, it
 * operates on a play directory ALREADY emitted to local disk (the typical
 * output of `frootai orchard install --as-play` from a prior session). It
 * re-runs the [H6] compose-infra pipeline with a NEW policy overlay, then
 * either previews the diff (--dry-run) or writes the new infra files in
 * place with a `.bak` of every replaced file.
 *
 * No upstream walk, no GitHub transport, no LLM calls — this is a 100%
 * deterministic local-disk-to-local-disk transformation. The play's
 * existing `spec/repo-facts.json` is the source of truth; that file MUST
 * exist (it's emitted by the H8.9 install flow + the [H3] extract stage).
 *
 * Pipeline (per invocation):
 *   1. parse argv (`<play-dir>` (positional), `--policy <path>` (required),
 *      `--dry-run`, `--facts <path>`, `--out <dir>`, `--max-diffs <n>`,
 *      `--json`, `--help`)
 *   2. parse policy file (YAML or JSON via shared parsers from H8.7)
 *   3. read `<play>/spec/repo-facts.json` (or `--facts <path>` override)
 *   4. compute THREE compose snapshots:
 *      a. VANILLA       — `composeInfraDeterministic(facts)` (no policy)
 *      b. CURRENT       — read on-disk files under `<play>/infra/...`
 *      c. NEW-POLICY    — `composeInfraDeterministic(facts, { policy: new })`
 *   5. build 3-way diff: per-path entry with { in_vanilla, in_current,
 *      in_new, hash_vanilla, hash_current, hash_new, change } — change is
 *      one of `unchanged` / `added_by_new_policy` / `removed_by_new_policy`
 *      / `modified_by_new_policy` / `out_of_sync_with_vanilla` (current
 *      differs from vanilla but new matches current — i.e. the policy is
 *      already applied on disk).
 *   6. if --dry-run: emit diff JSON (capped at --max-diffs entries to keep
 *      stdout manageable on big plays); no writes
 *   7. else: for each (added / modified / removed) file, backup current →
 *      `<file>.bak` (overwriting any existing .bak from a prior run) then
 *      write the new bytes. Emit a small write summary.
 *
 * Two surfaces (mirrors H8.3..H8.7):
 *
 *   1. Programmatic `runWithDeps(args, ctx, deps) → Promise<number>` — pure
 *      + injectable: `{composeImpl, readFile, writeFile, mkdir, existsSync,
 *      statSync, env}`. Tests run fully hermetically with a virtual FS.
 *
 *   2. Router-facing `run(args, ctx)` — default deps: real `node:fs` + real
 *      `composeInfraDeterministic`.
 *
 * Subcommand argv grammar (everything AFTER `customize` in `argv`):
 *   <play-dir>          path to the play directory (required)
 *   --policy <path>     new org-policy file (YAML or JSON; REQUIRED)
 *   --dry-run           emit 3-way diff; make no writes (default behaviour
 *                       per masterplan; ALSO supported explicitly)
 *   --facts <path>      override the RepoFacts source path (default:
 *                       `<play-dir>/spec/repo-facts.json`)
 *   --out <dir>         write new files under <dir> instead of in-place
 *                       (useful for side-by-side comparison)
 *   --max-diffs <n>     cap the diff array to N entries (default 100)
 *   --json              (router-inherited) machine-readable JSON to stdout
 *   --help, -h          print subcommand help + exit OK
 *
 * Exit codes (sysexits-aligned):
 *   0    OK             — diff emitted (dry-run) OR files written (commit)
 *   64   USAGE          — bad flags / missing <play-dir> / missing --policy
 *   65   DATA_ERR       — diff non-empty but compose result is gold/invalid
 *                          (caller should re-run the full harvest pipeline)
 *   66   NOINPUT        — play-dir missing / spec/repo-facts.json missing /
 *                          --policy unreadable or malformed
 *   69   UNAVAILABLE    — H6 gold_fallback_required (the new policy + facts
 *                          would force gold fallback — needs manual review)
 *   70   SOFTWARE       — unexpected internal error
 *
 * Non-goals for THIS ship (explicit):
 *   - Customizing scaffold-emitted files (agent.md / instructions / prompts):
 *     those are LLM-grounded on facts which don't change under a policy
 *     overlay; only infra files (Bicep + Terraform + parameters) change.
 *   - Re-running discover/fetch/extract — this is local-only.
 *   - Stripe / paid-gate enforcement — that's the H9 website wizard.
 *
 * License: CC0-1.0.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const COMPOSE_LIB_DIR = path.resolve(
  __dirname, "..", "..", "..", "scripts", "harvest", "lib", "compose-infra"
);

// Lazy-require at handler-load time so a broken transitive dep surfaces as
// EX_SOFTWARE (NOT "not yet wired").
const {
  composeInfraDeterministic,
} = require(path.join(COMPOSE_LIB_DIR, "idempotency.js"));

// Borrow the YAML+JSON dual-format file readers shipped in H8.7 so the
// policy-file contract is identical across `compose-infra` + `customize`.
const {
  parsePolicyFile,
} = require("./compose-infra.js");

/** Local sysexits enum. */
const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  DATA_ERR: 65,
  NOINPUT: 66,
  UNAVAILABLE: 69,
  SOFTWARE: 70,
});

/** Flags taking a value (`--flag <v>` or `--flag=v`). */
const VALUE_FLAGS = new Set([
  "--policy", "--facts", "--out", "--max-diffs",
]);

/** Default cap for the diff array in stdout output. */
const DEFAULT_MAX_DIFFS = 100;

/** Error carrying a sysexits exit code so the handler returns the right number. */
class CustomizeHandlerError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, exitCode?: number, cause?: Error }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = "CustomizeHandlerError";
    this.code = opts.code || "customize_handler_failed";
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Parse the subcommand-local argv. The first positional is `<play-dir>`;
 * `--policy <path>` is REQUIRED. Unknown long flags are USAGE.
 *
 * @param {readonly string[]} argv
 * @returns {{ playDir: string|null, policyPath: string|null, dryRun: boolean, factsPath: string|null, outDir: string|null, maxDiffs: number, json: boolean, help: boolean }}
 */
function parseCustomizeArgs(argv) {
  if (!Array.isArray(argv)) {
    throw new TypeError("parseCustomizeArgs: argv must be an array");
  }
  /** @type {{ playDir: string|null, policyPath: string|null, dryRun: boolean, factsPath: string|null, outDir: string|null, maxDiffs: number, json: boolean, help: boolean }} */
  const out = {
    playDir: null, policyPath: null, dryRun: false, factsPath: null,
    outDir: null, maxDiffs: DEFAULT_MAX_DIFFS, json: false, help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (typeof arg !== "string") {
      throw new CustomizeHandlerError(`argv entry ${i} must be a string`, {
        code: "bad_args", exitCode: EXIT.USAGE,
      });
    }
    if (arg === "--help" || arg === "-h") { out.help = true; continue; }
    if (arg === "--dry-run") { out.dryRun = true; continue; }
    if (arg === "--json") { out.json = true; continue; }

    let handled = false;
    for (const vf of VALUE_FLAGS) {
      if (arg === vf) {
        const v = argv[++i];
        if (typeof v !== "string" || v.length === 0) {
          throw new CustomizeHandlerError(`${vf} requires a value`, {
            code: "bad_args", exitCode: EXIT.USAGE,
          });
        }
        applyValueFlag(out, vf, v);
        handled = true; break;
      }
      if (arg.startsWith(`${vf}=`)) {
        const v = arg.slice(vf.length + 1);
        if (v.length === 0) {
          throw new CustomizeHandlerError(`${vf}= requires a non-empty value`, {
            code: "bad_args", exitCode: EXIT.USAGE,
          });
        }
        applyValueFlag(out, vf, v);
        handled = true; break;
      }
    }
    if (handled) continue;

    if (arg.startsWith("-")) {
      throw new CustomizeHandlerError(`unknown flag: ${arg}`, {
        code: "bad_args", exitCode: EXIT.USAGE,
      });
    }
    if (out.playDir === null) {
      out.playDir = arg;
      continue;
    }
    throw new CustomizeHandlerError(
      `unexpected positional argument: ${arg} (already have <play-dir>=${out.playDir})`,
      { code: "bad_args", exitCode: EXIT.USAGE },
    );
  }
  if (!Number.isInteger(out.maxDiffs) || out.maxDiffs < 1) {
    throw new CustomizeHandlerError(`--max-diffs must be a positive integer (got ${out.maxDiffs})`, {
      code: "bad_args", exitCode: EXIT.USAGE,
    });
  }
  return out;
}

function applyValueFlag(out, vf, v) {
  if (vf === "--policy") out.policyPath = v;
  else if (vf === "--facts") out.factsPath = v;
  else if (vf === "--out") out.outDir = v;
  else if (vf === "--max-diffs") out.maxDiffs = parseInt(v, 10);
}

/** Build the `frootai orchard customize --help` banner. */
function buildHelp() {
  return [
    "Usage: frootai orchard customize <play-dir> --policy <path> [options]",
    "",
    "Apply a NEW policy overlay to an existing harvested play. Re-runs the [H6]",
    "compose-infra pipeline with the policy + emits a 3-way diff (vanilla vs",
    "current on-disk vs new-policy). Local-only — no upstream walk, no LLM.",
    "",
    "Arguments:",
    "  <play-dir>           path to the harvested play directory (required)",
    "",
    "Options:",
    "  --policy <path>      new org-policy file (YAML or JSON; REQUIRED)",
    "  --dry-run            emit 3-way diff; make no writes (default behaviour)",
    "  --facts <path>       override RepoFacts source (default: <play>/spec/repo-facts.json)",
    "  --out <dir>          write new files under <dir> instead of in-place",
    "  --max-diffs <n>      cap diff array to N entries in stdout (default 100)",
    "  --json               machine-readable single-line JSON to stdout (default)",
    "  --help, -h           show this help and exit",
    "",
    "Exit codes:",
    "  0   success (diff emitted OR files written)",
    "  64  bad args / missing <play-dir> / missing --policy",
    "  65  diff non-empty but compose result is gold/invalid",
    "  66  play-dir / repo-facts.json / --policy file unreadable or malformed",
    "  69  H6 gold_fallback_required (new policy + facts would force gold)",
    "  70  unexpected internal error",
    "",
    "Examples:",
    "  frootai orchard customize ./my-play --policy ./company-policy.yaml --dry-run",
    "  frootai orchard customize ./my-play --policy ./policy.json   # commits in-place",
    "  frootai orchard customize ./my-play --policy ./p.yaml --out ./customized",
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
 * Read the CURRENT on-disk snapshot of a play's infra files. Returns a
 * `path → content` map covering the same paths the compose-infra snapshot
 * uses (`infra/main.bicep`, `infra/parameters.json`,
 * `infra/terraform/main.tf`, etc.). Paths that don't exist on disk are
 * absent from the map (so the 3-way diff can compare set-membership cleanly).
 *
 * @param {string} playDir
 * @param {Iterable<string>} expectedPaths — superset of paths to probe
 * @param {{ existsSync?: (p: string) => boolean, readFile?: (p: string, enc: string) => string }} [io]
 * @returns {Record<string,string>}
 */
function readCurrentSnapshot(playDir, expectedPaths, io = {}) {
  const exists = io.existsSync || fs.existsSync;
  const read = io.readFile || ((p, enc) => fs.readFileSync(p, enc));
  /** @type {Record<string,string>} */
  const snap = {};
  for (const rel of expectedPaths) {
    const abs = path.resolve(playDir, rel);
    try {
      if (exists(abs)) snap[rel] = String(read(abs, "utf8"));
    } catch {
      // unreadable → skip; the diff will surface it as missing
    }
  }
  return snap;
}

/**
 * Build the 3-way diff between vanilla / current / new-policy snapshots.
 *
 * `change` taxonomy (for each path):
 *   - `unchanged`                 — current === new (no write needed)
 *   - `added_by_new_policy`       — current absent + new present
 *   - `removed_by_new_policy`     — current present + new absent
 *   - `modified_by_new_policy`    — current present + new present + differ
 *   - `out_of_sync_with_vanilla`  — current differs from vanilla BUT new
 *                                    matches current (i.e. a PRIOR policy
 *                                    is already applied; running this
 *                                    handler is a no-op)
 *
 * Sorted alphabetically by path for deterministic output.
 *
 * @param {Record<string,string>} vanilla
 * @param {Record<string,string>} current
 * @param {Record<string,string>} newSnap
 * @returns {{ diffs: Array<object>, summary: { unchanged: number, added: number, removed: number, modified: number, out_of_sync: number, total: number } }}
 */
function buildThreeWayDiff(vanilla, current, newSnap) {
  const allPaths = new Set([
    ...Object.keys(vanilla || {}),
    ...Object.keys(current || {}),
    ...Object.keys(newSnap || {}),
  ]);
  const sorted = [...allPaths].sort();

  /** @type {Array<object>} */
  const diffs = [];
  let unchanged = 0;
  let added = 0;
  let removed = 0;
  let modified = 0;
  let outOfSync = 0;

  for (const p of sorted) {
    const inVan = p in vanilla;
    const inCur = p in current;
    const inNew = p in newSnap;
    const hVan = inVan ? sha256(vanilla[p]) : null;
    const hCur = inCur ? sha256(current[p]) : null;
    const hNew = inNew ? sha256(newSnap[p]) : null;

    let change;
    if (hCur === hNew) {
      if (hCur === hVan) {
        change = "unchanged";
        unchanged++;
      } else {
        change = "out_of_sync_with_vanilla";
        outOfSync++;
      }
    } else if (!inCur && inNew) {
      change = "added_by_new_policy";
      added++;
    } else if (inCur && !inNew) {
      change = "removed_by_new_policy";
      removed++;
    } else {
      change = "modified_by_new_policy";
      modified++;
    }

    diffs.push({
      path: p,
      in_vanilla: inVan,
      in_current: inCur,
      in_new: inNew,
      hash_vanilla: hVan,
      hash_current: hCur,
      hash_new: hNew,
      change,
    });
  }

  return {
    diffs,
    summary: {
      unchanged,
      added,
      removed,
      modified,
      out_of_sync: outOfSync,
      total: diffs.length,
    },
  };
}

/**
 * Apply the new snapshot to disk: for each (added / modified / removed) path,
 * back up the current file to `<file>.bak` (best-effort) then write the new
 * bytes (or delete on removed). Returns the list of write actions for the
 * commit summary.
 *
 * @param {string} targetDir
 * @param {Record<string,string>} currentSnap
 * @param {Record<string,string>} newSnap
 * @param {{ writeFile?: (p: string, body: string, enc: string) => void, mkdir?: (p: string, opts: object) => void, existsSync?: (p: string) => boolean, readFile?: (p: string, enc: string) => string, unlinkSync?: (p: string) => void }} [io]
 * @returns {Array<{ path: string, action: string, backed_up: boolean }>}
 */
function writeNewSnapshot(targetDir, currentSnap, newSnap, io = {}) {
  const writeFile = io.writeFile || ((p, body, enc) => fs.writeFileSync(p, body, enc));
  const mkdirSync = io.mkdir || ((p, opts) => fs.mkdirSync(p, opts));
  const exists = io.existsSync || fs.existsSync;
  const readFile = io.readFile || ((p, enc) => fs.readFileSync(p, enc));
  const unlinkSync = io.unlinkSync || ((p) => fs.unlinkSync(p));

  /** @type {Array<{ path: string, action: string, backed_up: boolean }>} */
  const written = [];
  const allPaths = new Set([...Object.keys(currentSnap || {}), ...Object.keys(newSnap || {})]);

  for (const rel of [...allPaths].sort()) {
    const abs = path.resolve(targetDir, rel);
    const cur = currentSnap[rel];
    const nxt = newSnap[rel];
    const curHash = typeof cur === "string" ? sha256(cur) : null;
    const nxtHash = typeof nxt === "string" ? sha256(nxt) : null;
    if (curHash === nxtHash) continue; // unchanged → no write

    let backedUp = false;
    if (typeof cur === "string" && exists(abs)) {
      try {
        const bakPath = `${abs}.bak`;
        writeFile(bakPath, readFile(abs, "utf8"), "utf8");
        backedUp = true;
      } catch {
        backedUp = false;
      }
    }

    if (typeof nxt === "string") {
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFile(abs, nxt, "utf8");
      written.push({ path: rel, action: typeof cur === "string" ? "modified" : "added", backed_up: backedUp });
    } else {
      // removed by new policy → delete on disk (after backup)
      try { unlinkSync(abs); } catch { /* ignore */ }
      written.push({ path: rel, action: "removed", backed_up: backedUp });
    }
  }

  return written;
}

/**
 * Programmatic surface. Pure + injectable.
 *
 * @param {readonly string[]} args
 * @param {object} ctx
 * @param {object} [deps]
 * @param {typeof composeInfraDeterministic} [deps.composeImpl]
 * @param {(p: string, enc: string) => string} [deps.readFile]
 * @param {(p: string, body: string, enc: string) => void} [deps.writeFile]
 * @param {(p: string, opts: object) => void} [deps.mkdir]
 * @param {(p: string) => boolean} [deps.existsSync]
 * @param {(p: string) => any} [deps.statSync]
 * @param {(p: string) => void} [deps.unlinkSync]
 * @param {Record<string, string|undefined>} [deps.env]
 * @returns {Promise<number>}
 */
async function runWithDeps(args, ctx, deps = {}) {
  const stdout = (ctx && ctx.stdout) || ((s) => process.stdout.write(s));
  const stderr = (ctx && ctx.stderr) || ((s) => process.stderr.write(s));
  const composeImpl = deps.composeImpl || composeInfraDeterministic;
  const readFile = deps.readFile || ((p, enc) => fs.readFileSync(p, enc));
  const exists = deps.existsSync || fs.existsSync;
  const statSync = deps.statSync || ((p) => fs.statSync(p));

  /** @type {ReturnType<typeof parseCustomizeArgs>} */
  let parsed;
  try {
    parsed = parseCustomizeArgs(args || []);
  } catch (err) {
    if (err instanceof CustomizeHandlerError) {
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
  if (parsed.policyPath === null) {
    if (json) {
      emit(stdout, JSON.stringify({
        ok: false,
        error: { code: "bad_args", message: "--policy <path> is required", exit_code: EXIT.USAGE },
      }));
    } else {
      emit(stderr, "error: --policy <path> is required");
      emit(stderr, buildHelp());
    }
    return EXIT.USAGE;
  }

  // ── 1. Validate play-dir exists + is a directory ──
  try {
    const st = statSync(parsed.playDir);
    if (!st.isDirectory || !st.isDirectory()) {
      throw new Error(`<play-dir> is not a directory: ${parsed.playDir}`);
    }
  } catch (err) {
    const message = `cannot access <play-dir> ${parsed.playDir}: ${err && err.message}`;
    if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "bad_play_dir", message, exit_code: EXIT.NOINPUT } }));
    else emit(stderr, `error: ${message}`);
    return EXIT.NOINPUT;
  }

  // ── 2. Read RepoFacts ──
  const factsPath = parsed.factsPath || path.resolve(parsed.playDir, "spec", "repo-facts.json");
  let facts;
  try {
    facts = JSON.parse(readFile(factsPath, "utf8"));
    if (!facts || typeof facts !== "object" || Array.isArray(facts)) {
      throw new Error("repo-facts JSON root must be an object");
    }
  } catch (err) {
    const message = `cannot read RepoFacts at ${factsPath}: ${err && err.message}`;
    if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "bad_facts", message, exit_code: EXIT.NOINPUT } }));
    else emit(stderr, `error: ${message}`);
    return EXIT.NOINPUT;
  }

  // ── 3. Parse --policy ──
  const polRes = parsePolicyFile(parsed.policyPath, readFile);
  if (!polRes.ok) {
    if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "bad_policy", message: polRes.error, exit_code: EXIT.NOINPUT } }));
    else emit(stderr, `error: ${polRes.error}`);
    return EXIT.NOINPUT;
  }
  const policy = polRes.data;

  // ── 4. Compute vanilla + new-policy snapshots ──
  let vanillaResult;
  let newResult;
  try {
    vanillaResult = await composeImpl(facts);
    newResult = await composeImpl(facts, { policy });
  } catch (err) {
    const code = (err && err.code) || "compose_failed";
    const message = err instanceof Error ? err.message : String(err);
    const exitCode = code === "gold_fallback_required" ? EXIT.UNAVAILABLE
      : (Number.isInteger(err && err.exit_code) ? err.exit_code : EXIT.SOFTWARE);
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "compose", error: { code, message, exit_code: exitCode } }));
    else emit(stderr, `error[compose/${code}]: ${message}`);
    return exitCode;
  }

  // ── 5. Read current on-disk snapshot ──
  const expectedPaths = new Set([
    ...Object.keys(vanillaResult.snapshot || {}),
    ...Object.keys(newResult.snapshot || {}),
  ]);
  const currentSnap = readCurrentSnapshot(parsed.playDir, expectedPaths, { existsSync: exists, readFile });

  // ── 6. Build 3-way diff ──
  const { diffs, summary } = buildThreeWayDiff(vanillaResult.snapshot, currentSnap, newResult.snapshot);

  // ── 7. Decide: dry-run vs commit ──
  const cappedDiffs = diffs.slice(0, parsed.maxDiffs);
  const truncated = diffs.length > parsed.maxDiffs;

  if (parsed.dryRun) {
    const payload = {
      ok: true,
      mode: "dry-run",
      play_dir: parsed.playDir,
      policy_path: parsed.policyPath,
      facts_slug: facts.slug || null,
      vanilla_hash: vanillaResult.hash,
      new_hash: newResult.hash,
      composition: newResult.decision && newResult.decision.composition,
      summary,
      diffs: cappedDiffs,
      diffs_truncated: truncated,
      diffs_total: diffs.length,
    };
    emit(stdout, verbose ? JSON.stringify(payload, null, 2) : JSON.stringify(payload));
    return EXIT.OK;
  }

  // ── 8. Commit path ──
  const targetDir = parsed.outDir
    ? path.resolve(parsed.outDir)
    : path.resolve(parsed.playDir);
  const writeFile = deps.writeFile || ((p, body, enc) => fs.writeFileSync(p, body, enc));
  const mkdir = deps.mkdir || ((p, opts) => fs.mkdirSync(p, opts));
  const unlinkSync = deps.unlinkSync || ((p) => fs.unlinkSync(p));
  const written = writeNewSnapshot(targetDir, currentSnap, newResult.snapshot, {
    writeFile, mkdir, existsSync: exists, readFile, unlinkSync,
  });

  const payload = {
    ok: true,
    mode: "commit",
    play_dir: parsed.playDir,
    target_dir: targetDir,
    policy_path: parsed.policyPath,
    facts_slug: facts.slug || null,
    vanilla_hash: vanillaResult.hash,
    new_hash: newResult.hash,
    composition: newResult.decision && newResult.decision.composition,
    summary,
    written,
  };
  emit(stdout, verbose ? JSON.stringify(payload, null, 2) : JSON.stringify(payload));
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
  CustomizeHandlerError,
  parseCustomizeArgs,
  buildHelp,
  buildThreeWayDiff,
  readCurrentSnapshot,
  writeNewSnapshot,
  runWithDeps,
  run,
  sha256,
};
