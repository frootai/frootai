// @ts-check
/**
 * [H8.10] commit.js — `frootai orchard commit <play-dir>` handler.
 *
 * Contract (verbatim from masterplan §3 row [H8.10]):
 *   `frootai orchard commit <play-dir> [--upgrade-to-play]` paid gate:
 *   requires Pro+ for `--upgrade-to-play`; runs `[H7]` validate + bundle +
 *   publish.
 *
 * Ninth (and final stage-handler) the [H8.1] router lazy-loads. The
 * COMMIT command — the one a paid customer types after `install` to ship
 * the play to the FrootAI marketplace CDN.
 *
 * Two modes:
 *
 *   ─ LOCAL (default, no flag): runs only the H7 validator gate on the
 *     emitted play files. Emits a per-validator report + aggregate
 *     summary. No bundle, no CDN upload, no Slack, no ISR. FREE.
 *
 *   ─ PUBLISH (`--upgrade-to-play`): runs the full H7 pipeline —
 *     validate → bundle → sign → CDN upload → ISR revalidate → Slack
 *     notify → CHANGELOG append. Gated on a Pro+ entitlements check.
 *     The actual entitlement check seam is injectable so the H8.13/14
 *     auth + entitlements wiring can plug in directly when that ships;
 *     for now, the default check honors a `FROOTAI_PRO=1` env override
 *     (local dev) or returns ok:false (any other env). The handler exits
 *     NOPERM 77 with a clear `frootai login` remediation when the check
 *     fails.
 *
 * Pipeline (per invocation):
 *   1. parse argv (`<play-dir>`, `--upgrade-to-play`, `--dry-run`,
 *      `--force`, `--out-cdn`, `--skip <key[:reason]>`, `--changelog`,
 *      `--prev`, `--upstream-sha`, `--variety`, `--no-entitlements-check`,
 *      `--json`, `--help`)
 *   2. validate <play-dir> exists + is a directory
 *   3. load the play from disk: walk the tree → `files: [{path, content}]`,
 *      read `spec/repo-facts.json`, optional `spec/policy.json`, optional
 *      `spec/fai-manifest.json`, optional `spec/CHANGELOG.md`
 *   4. derive slug from RepoFacts.slug || basename(play-dir)
 *   5. if `--upgrade-to-play`:
 *        a. check Pro entitlement (default: env-override; injectable)
 *        b. if ok=false → exit NOPERM 77 + remediation message
 *        c. else run `runPublish()` (H7) with full deps from env
 *      else:
 *        a. just run the H7 validators (no bundle, no upload) via the
 *           dedicated `runValidateOnly()` helper
 *   6. emit a CommitResult JSON summary
 *
 * Two surfaces (mirrors H8.3..H8.9):
 *
 *   1. Programmatic `runWithDeps(args, ctx, deps) → Promise<number>` —
 *      pure + injectable: `{publishImpl, validateImpl, entitlementsImpl,
 *      blobOps, httpClient, webhookUrl, isrSecret, signer, env, readFile,
 *      readdirSync, statSync}`. Tests run fully hermetically.
 *
 *   2. Router-facing `run(args, ctx)` — default deps wire the real
 *      `runPublish` + `runPlayValidators` + a stub blobOps when no
 *      `AZURE_STORAGE_CONNECTION_STRING` is in env.
 *
 * Subcommand argv grammar (everything AFTER `commit` in `argv`):
 *   <play-dir>            path to the play directory (required)
 *   --upgrade-to-play     run the full H7 publish pipeline (paid)
 *   --dry-run             plan only; emit version + skip-decision; no upload
 *   --force               override the H7 confidence-floor + idempotency skip
 *   --out-cdn <prefix>    override the CDN prefix (publish target)
 *   --skip <key[:reason]> skip a single H7 validator (with optional reason)
 *   --changelog <path>    override the CHANGELOG source path
 *   --prev <path>         JSON of the previous publish (for republish diff)
 *   --upstream-sha <sha>  override the upstream commit SHA (default: from facts.sha)
 *   --variety <name>      slug variety for ISR path (default: "general")
 *   --no-entitlements-check
 *                         skip the Pro+ entitlement check (DEV ONLY; never
 *                         supported in CI / shipped binaries — exits USAGE
 *                         unless `--upgrade-to-play` was passed too)
 *   --json                (router-inherited) machine-readable JSON to stdout
 *   --help, -h            print subcommand help + exit OK
 *
 * Exit codes (sysexits-aligned):
 *   0    OK             — local validate OK; OR publish succeeded; OR dry-run OK
 *   64   USAGE          — bad flags / missing <play-dir>
 *   65   DATA_ERR       — H7 validators RED; OR publish action="blocked"
 *   66   NOINPUT        — <play-dir> missing or unreadable;
 *                          --prev/--changelog file unreadable
 *   69   UNAVAILABLE    — H7 publish action="skipped" with --no-republish-on-skip
 *                          (currently always treated as success — reserved)
 *   70   SOFTWARE       — unexpected internal error
 *   77   NOPERM         — --upgrade-to-play but entitlements check failed
 *
 * Non-goals for THIS ship:
 *   - The actual OAuth device-flow (H8.13).
 *   - The real `/api/entitlements` HTTP call (H8.14) — handler exposes
 *     an injectable seam so the wiring drops in.
 *   - The free-vs-paid policy gate for non-MSFT-anchor URLs (H8.15).
 *
 * License: CC0-1.0.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const PUBLISH_LIB_DIR = path.resolve(
  __dirname, "..", "..", "..", "scripts", "harvest", "lib", "publish"
);
const VALIDATE_LIB_DIR = path.resolve(
  __dirname, "..", "..", "..", "scripts", "harvest", "lib", "validate"
);

const {
  runPublish,
} = require(path.join(PUBLISH_LIB_DIR, "publish-cli.js"));

const {
  runPlayValidators,
  formatSummaryLine,
  STATUS: VALIDATE_STATUS,
  VALIDATOR_KEYS,
} = require(path.join(VALIDATE_LIB_DIR, "play.js"));

/** Local sysexits enum. */
const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  DATA_ERR: 65,
  NOINPUT: 66,
  UNAVAILABLE: 69,
  SOFTWARE: 70,
  NOPERM: 77,
});

/** Flags taking a value (`--flag <v>` or `--flag=v`). */
const VALUE_FLAGS = new Set([
  "--out-cdn", "--skip", "--changelog", "--prev",
  "--upstream-sha", "--variety",
]);

/** Files under `spec/` we lazy-load as part of the play snapshot. */
const SPEC_FILES = Object.freeze({
  REPO_FACTS: "spec/repo-facts.json",
  POLICY: "spec/policy.json",
  MANIFEST: "spec/fai-manifest.json",
  CHANGELOG: "spec/CHANGELOG.md",
});

/** Error carrying a sysexits exit code so the handler returns the right number. */
class CommitHandlerError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, exitCode?: number, cause?: Error }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = "CommitHandlerError";
    this.code = opts.code || "commit_handler_failed";
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Parse the subcommand-local argv. The first positional is `<play-dir>`.
 * `--skip` is REPEATABLE; every occurrence appends an entry. Unknown long
 * flags are USAGE.
 *
 * @param {readonly string[]} argv
 * @returns {{ playDir: string|null, upgradeToPlay: boolean, dryRun: boolean, force: boolean, outCdn: string|null, skip: Array<{key:string,reason:string}>, changelog: string|null, prev: string|null, upstreamSha: string|null, variety: string|null, noEntitlementsCheck: boolean, json: boolean, help: boolean }}
 */
function parseCommitArgs(argv) {
  if (!Array.isArray(argv)) {
    throw new TypeError("parseCommitArgs: argv must be an array");
  }
  /** @type {{ playDir: string|null, upgradeToPlay: boolean, dryRun: boolean, force: boolean, outCdn: string|null, skip: Array<{key:string,reason:string}>, changelog: string|null, prev: string|null, upstreamSha: string|null, variety: string|null, noEntitlementsCheck: boolean, json: boolean, help: boolean }} */
  const out = {
    playDir: null, upgradeToPlay: false, dryRun: false, force: false,
    outCdn: null, skip: [], changelog: null, prev: null,
    upstreamSha: null, variety: null,
    noEntitlementsCheck: false, json: false, help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (typeof arg !== "string") {
      throw new CommitHandlerError(`argv entry ${i} must be a string`, {
        code: "bad_args", exitCode: EXIT.USAGE,
      });
    }
    if (arg === "--help" || arg === "-h") { out.help = true; continue; }
    if (arg === "--upgrade-to-play") { out.upgradeToPlay = true; continue; }
    if (arg === "--dry-run") { out.dryRun = true; continue; }
    if (arg === "--force") { out.force = true; continue; }
    if (arg === "--no-entitlements-check") { out.noEntitlementsCheck = true; continue; }
    if (arg === "--json") { out.json = true; continue; }

    let handled = false;
    for (const vf of VALUE_FLAGS) {
      if (arg === vf) {
        const v = argv[++i];
        if (typeof v !== "string" || v.length === 0) {
          throw new CommitHandlerError(`${vf} requires a value`, {
            code: "bad_args", exitCode: EXIT.USAGE,
          });
        }
        applyValueFlag(out, vf, v);
        handled = true; break;
      }
      if (arg.startsWith(`${vf}=`)) {
        const v = arg.slice(vf.length + 1);
        if (v.length === 0) {
          throw new CommitHandlerError(`${vf}= requires a non-empty value`, {
            code: "bad_args", exitCode: EXIT.USAGE,
          });
        }
        applyValueFlag(out, vf, v);
        handled = true; break;
      }
    }
    if (handled) continue;

    if (arg.startsWith("-")) {
      throw new CommitHandlerError(`unknown flag: ${arg}`, {
        code: "bad_args", exitCode: EXIT.USAGE,
      });
    }
    if (out.playDir === null) {
      out.playDir = arg;
      continue;
    }
    throw new CommitHandlerError(
      `unexpected positional argument: ${arg} (already have <play-dir>=${out.playDir})`,
      { code: "bad_args", exitCode: EXIT.USAGE },
    );
  }
  // Validate every --skip key.
  for (const s of out.skip) {
    if (!VALIDATOR_KEYS.includes(s.key)) {
      throw new CommitHandlerError(
        `--skip: "${s.key}" is not a known validator key (one of ${VALIDATOR_KEYS.join(", ")})`,
        { code: "bad_args", exitCode: EXIT.USAGE },
      );
    }
  }
  return out;
}

function applyValueFlag(out, vf, v) {
  if (vf === "--out-cdn") out.outCdn = v;
  else if (vf === "--skip") {
    // `<key>` or `<key>:<reason>` — the reason is freeform text.
    const colon = v.indexOf(":");
    if (colon >= 0) out.skip.push({ key: v.slice(0, colon), reason: v.slice(colon + 1) });
    else out.skip.push({ key: v, reason: "" });
  } else if (vf === "--changelog") out.changelog = v;
  else if (vf === "--prev") out.prev = v;
  else if (vf === "--upstream-sha") out.upstreamSha = v;
  else if (vf === "--variety") out.variety = v;
}

/** Build the `frootai orchard commit --help` banner. */
function buildHelp() {
  return [
    "Usage: frootai orchard commit <play-dir> [options]",
    "       frootai orchard commit <play-dir> --upgrade-to-play [options]",
    "",
    "Validate (and optionally publish) a harvested play. Two modes:",
    "",
    "  LOCAL    (default)            run only the H7 validator gate; FREE",
    "  PUBLISH  (--upgrade-to-play)  validate + bundle + sign + CDN upload +",
    "                                ISR + Slack; requires Pro+ entitlement",
    "",
    "Arguments:",
    "  <play-dir>            path to the play directory (required)",
    "",
    "Commit options:",
    "  --upgrade-to-play     run the full H7 publish pipeline (paid)",
    "  --dry-run             plan only — no upload (publish mode emits version)",
    "  --force               override the H7 confidence-floor + idempotency skip",
    "  --out-cdn <prefix>    override the CDN prefix (publish target)",
    "  --skip <key[:reason]> skip a single H7 validator (with optional reason);",
    "                        repeatable; one of: " + VALIDATOR_KEYS.join(", "),
    "  --changelog <path>    override the CHANGELOG source path",
    "  --prev <path>         JSON of the previous publish (for republish diff)",
    "  --upstream-sha <sha>  override upstream SHA (default: from RepoFacts)",
    "  --variety <name>      slug variety for ISR path (default: 'general')",
    "  --no-entitlements-check",
    "                        DEV: skip the Pro+ gate (no-op without --upgrade-to-play)",
    "",
    "Output:",
    "  --json                machine-readable single-line JSON to stdout (default)",
    "  --help, -h            show this help and exit",
    "",
    "Exit codes:",
    "  0   success (local validate OK OR publish succeeded OR dry-run OK)",
    "  64  bad args / missing <play-dir>",
    "  65  H7 validators RED OR publish blocked",
    "  66  <play-dir> / --prev / --changelog unreadable",
    "  70  unexpected internal error",
    "  77  --upgrade-to-play but entitlements check failed (run `frootai login`)",
    "",
    "Examples:",
    "  frootai orchard commit ./my-play                   # local validate only",
    "  frootai orchard commit ./my-play --upgrade-to-play # publish to CDN (paid)",
    "  frootai orchard commit ./my-play --upgrade-to-play --dry-run",
    "  frootai orchard commit ./my-play --skip waf:experimental-pillar",
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
 * Recursively walk a directory and return `{ relPath, absPath }[]` for every
 * file under it. Excludes `.bak` backup files (left by H8.8 customize) and
 * any path containing a `/.` segment (dot-dirs like `.git/`).
 *
 * @param {string} rootDir
 * @param {{ readdirSync?: (p: string, opts: object) => any[], statSync?: (p: string) => any }} [io]
 * @returns {Array<{ relPath: string, absPath: string }>}
 */
function walkPlayDir(rootDir, io = {}) {
  const readdir = io.readdirSync || ((p, opts) => fs.readdirSync(p, opts));
  const stat = io.statSync || ((p) => fs.statSync(p));
  /** @type {Array<{ relPath: string, absPath: string }>} */
  const out = [];
  const stack = [{ abs: path.resolve(rootDir), rel: "" }];
  while (stack.length > 0) {
    const cur = stack.pop();
    let entries;
    try {
      entries = readdir(cur.abs, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const name = entry && entry.name ? String(entry.name) : "";
      if (!name) continue;
      if (name.endsWith(".bak")) continue;       // H8.8 backup files
      if (name.startsWith(".")) continue;         // dot files / dirs (.git, .DS_Store)
      const absChild = path.resolve(cur.abs, name);
      const relChild = cur.rel ? path.posix.join(cur.rel, name) : name;
      let isDir = false;
      try {
        isDir = typeof entry.isDirectory === "function" ? entry.isDirectory() : stat(absChild).isDirectory();
      } catch { isDir = false; }
      if (isDir) {
        stack.push({ abs: absChild, rel: relChild });
      } else {
        out.push({ relPath: relChild, absPath: absChild });
      }
    }
  }
  // Deterministic byte-stable order (locale-independent for cross-platform repeatability).
  out.sort((a, b) => (a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0));
  return out;
}

/**
 * Load a play directory into the shape `runPublish()` consumes. The H7
 * library wants `files: [{path, content}]` plus optional sidecars
 * (repoFacts, policy, manifest, changelogText). Missing sidecars are
 * tolerated — only `repo-facts.json` is REQUIRED.
 *
 * @param {string} playDir
 * @param {{ readFile?: (p: string, enc: string) => string, readdirSync?: (p: string, opts: object) => any[], statSync?: (p: string) => any }} [io]
 * @returns {{ ok: boolean, error?: string, play?: { slug?: string, files: Array<{path: string, content: string}>, repoFacts?: object, policy?: object, manifest?: object, changelogText?: string, upstreamSha?: string } }}
 */
function loadPlayFromDir(playDir, io = {}) {
  const readFile = io.readFile || ((p, enc) => fs.readFileSync(p, enc));
  const stat = io.statSync || ((p) => fs.statSync(p));
  let dirStat;
  try {
    dirStat = stat(playDir);
    if (!(typeof dirStat.isDirectory === "function" && dirStat.isDirectory())) {
      return { ok: false, error: `<play-dir> is not a directory: ${playDir}` };
    }
  } catch (err) {
    return { ok: false, error: `cannot access <play-dir> ${playDir}: ${err && err.message}` };
  }

  // Walk + read every file.
  const entries = walkPlayDir(playDir, io);
  /** @type {Array<{path: string, content: string}>} */
  const files = [];
  for (const e of entries) {
    try {
      files.push({ path: e.relPath, content: String(readFile(e.absPath, "utf8")) });
    } catch (err) {
      return { ok: false, error: `cannot read ${e.relPath}: ${err && err.message}` };
    }
  }

  // Read optional sidecars.
  const sidecar = (rel) => {
    const f = files.find((x) => x.path === rel);
    return f ? f.content : null;
  };
  const factsText = sidecar(SPEC_FILES.REPO_FACTS);
  if (factsText === null) {
    return { ok: false, error: `play missing required ${SPEC_FILES.REPO_FACTS}` };
  }
  let repoFacts;
  try {
    repoFacts = JSON.parse(factsText);
  } catch (err) {
    return { ok: false, error: `cannot parse ${SPEC_FILES.REPO_FACTS}: ${err && err.message}` };
  }

  let policy;
  const policyText = sidecar(SPEC_FILES.POLICY);
  if (policyText) {
    try { policy = JSON.parse(policyText); } catch { policy = undefined; }
  }

  let manifest;
  const manifestText = sidecar(SPEC_FILES.MANIFEST);
  if (manifestText) {
    try { manifest = JSON.parse(manifestText); } catch { manifest = undefined; }
  }

  const changelogText = sidecar(SPEC_FILES.CHANGELOG) || "";

  return {
    ok: true,
    play: {
      slug: typeof repoFacts.slug === "string" && repoFacts.slug ? repoFacts.slug : path.basename(path.resolve(playDir)),
      files,
      repoFacts,
      policy,
      manifest,
      changelogText,
      upstreamSha: repoFacts.upstream_commit_sha || repoFacts.sha || undefined,
    },
  };
}

/**
 * Default Pro+ entitlements check. Honors `FROOTAI_PRO=1` env override (for
 * local dev). Returns `{ ok: false }` by default — this is the local-dev
 * fallback when no OAuth wiring is in place. H8.14 ships the real HTTP
 * check at `cli/commands/auth/entitlements.js`; callers wire it in via
 * `deps.entitlementsImpl = buildEntitlementsImpl({...})` (the env override
 * is preserved inside that wrapper, so local-dev still works).
 *
 * @param {Record<string, string|undefined>} env
 * @returns {{ ok: boolean, tier?: string, message?: string }}
 */
function defaultEntitlementsCheck(env) {
  const e = env || process.env;
  if (e.FROOTAI_PRO === "1" || e.FROOTAI_PRO === "true") {
    return { ok: true, tier: "pro-env", message: "Pro+ via FROOTAI_PRO env override" };
  }
  return {
    ok: false,
    tier: "free",
    message: "Pro+ entitlement required for --upgrade-to-play. Run `frootai login` to authenticate (ships in H8.13).",
  };
}

/**
 * Run the H7 validators in isolation (no bundle / no publish). The LOCAL
 * mode of this handler: a developer running `commit <dir>` without
 * `--upgrade-to-play` gets a fast local gate before paying for upload.
 *
 * @param {object} play — `{ slug, files, repoFacts, policy, manifest }`
 * @param {{ validateImpl?: typeof runPlayValidators, skip?: string[], force?: boolean, now?: () => number }} [opts]
 * @returns {Promise<object>} aggregate
 */
async function runValidateOnly(play, opts = {}) {
  const validateImpl = opts.validateImpl || runPlayValidators;
  return validateImpl(
    {
      play: play.slug || "",
      playDir: "",
      repoFacts: play.repoFacts || {},
      policy: play.policy || {},
      manifest: play.manifest || {},
      files: play.files || [],
    },
    {
      skip: opts.skip || [],
      force: !!opts.force,
      now: opts.now,
    },
  );
}

/**
 * Programmatic surface. LOCAL or PUBLISH depending on `--upgrade-to-play`.
 *
 * @param {readonly string[]} args
 * @param {object} ctx
 * @param {object} [deps]
 * @param {typeof runPublish} [deps.publishImpl]
 * @param {typeof runPlayValidators} [deps.validateImpl]
 * @param {(env: object) => { ok: boolean, tier?: string, message?: string }} [deps.entitlementsImpl]
 * @param {object} [deps.blobOps]
 * @param {object} [deps.httpClient]
 * @param {string} [deps.webhookUrl]
 * @param {string} [deps.isrSecret]
 * @param {object} [deps.signer]
 * @param {Record<string, string|undefined>} [deps.env]
 * @param {(p: string, enc: string) => string} [deps.readFile]
 * @param {(p: string, opts: object) => any[]} [deps.readdirSync]
 * @param {(p: string) => any} [deps.statSync]
 * @returns {Promise<number>}
 */
async function runWithDeps(args, ctx, deps = {}) {
  const stdout = (ctx && ctx.stdout) || ((s) => process.stdout.write(s));
  const stderr = (ctx && ctx.stderr) || ((s) => process.stderr.write(s));
  const env = deps.env || process.env;
  const publishImpl = deps.publishImpl || runPublish;
  const validateImpl = deps.validateImpl || runPlayValidators;
  const entitlementsImpl = deps.entitlementsImpl || defaultEntitlementsCheck;

  /** @type {ReturnType<typeof parseCommitArgs>} */
  let parsed;
  try {
    parsed = parseCommitArgs(args || []);
  } catch (err) {
    if (err instanceof CommitHandlerError) {
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

  // ── 1. Load play from disk ──
  const loaded = loadPlayFromDir(parsed.playDir, {
    readFile: deps.readFile,
    readdirSync: deps.readdirSync,
    statSync: deps.statSync,
  });
  if (!loaded.ok) {
    if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "bad_play_dir", message: loaded.error, exit_code: EXIT.NOINPUT } }));
    else emit(stderr, `error: ${loaded.error}`);
    return EXIT.NOINPUT;
  }
  const play = loaded.play;

  // Augment with --upstream-sha override.
  if (parsed.upstreamSha) play.upstreamSha = parsed.upstreamSha;

  // Optional --changelog override.
  if (parsed.changelog) {
    const read = deps.readFile || ((p, enc) => fs.readFileSync(p, enc));
    try {
      play.changelogText = String(read(parsed.changelog, "utf8"));
    } catch (err) {
      const message = `cannot read --changelog ${parsed.changelog}: ${err && err.message}`;
      if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "bad_changelog", message, exit_code: EXIT.NOINPUT } }));
      else emit(stderr, `error: ${message}`);
      return EXIT.NOINPUT;
    }
  }

  // Optional --prev (republish-diff input).
  /** @type {object|undefined} */
  let previous;
  if (parsed.prev) {
    const read = deps.readFile || ((p, enc) => fs.readFileSync(p, enc));
    try {
      previous = JSON.parse(read(parsed.prev, "utf8"));
    } catch (err) {
      const message = `cannot read --prev ${parsed.prev}: ${err && err.message}`;
      if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "bad_prev", message, exit_code: EXIT.NOINPUT } }));
      else emit(stderr, `error: ${message}`);
      return EXIT.NOINPUT;
    }
  }

  // ── 2. LOCAL mode (no --upgrade-to-play): validate only ──
  if (!parsed.upgradeToPlay) {
    let aggregate;
    try {
      aggregate = await runValidateOnly(play, {
        validateImpl,
        skip: parsed.skip.map((s) => s.key),
        force: parsed.force,
      });
    } catch (err) {
      const code = (err && err.code) || "validate_failed";
      const message = err instanceof Error ? err.message : String(err);
      if (json) emit(stdout, JSON.stringify({ ok: false, stage: "validate", error: { code, message, exit_code: EXIT.SOFTWARE } }));
      else emit(stderr, `error[validate/${code}]: ${message}`);
      return EXIT.SOFTWARE;
    }
    const overall = String(aggregate.overall || "").toUpperCase();
    const pass = overall === String(VALIDATE_STATUS.PASS).toUpperCase();
    const summary = {
      ok: pass,
      mode: "local",
      slug: play.slug,
      play_dir: parsed.playDir,
      file_count: play.files.length,
      validation: {
        overall: aggregate.overall,
        passed: aggregate.passed,
        failed: aggregate.failed,
        skipped: aggregate.skipped,
        total: aggregate.total,
      },
      reports: aggregate.reports,
      next_step: pass ? "ready to commit with --upgrade-to-play (Pro+)" : "fix RED validators or use --skip <key[:reason]>",
    };
    const body = verbose ? JSON.stringify(summary, null, 2) : JSON.stringify(summary);
    emit(stdout, body);
    if (!pass) {
      if (!json) emit(stderr, `error[validate]: ${formatSummaryLine(aggregate)}`);
      return EXIT.DATA_ERR;
    }
    return EXIT.OK;
  }

  // ── 3. PUBLISH mode: --upgrade-to-play ──
  // 3a. Pro entitlement check (skippable in dev with --no-entitlements-check).
  //     entitlementsImpl may be sync OR async (H8.14's buildEntitlementsImpl
  //     returns a Promise) — the `await` accepts both.
  let entitlement = { ok: true, tier: "skipped", message: "--no-entitlements-check (DEV)" };
  if (!parsed.noEntitlementsCheck) {
    try {
      entitlement = (await entitlementsImpl(env)) || { ok: false, message: "entitlements check returned nothing" };
    } catch (err) {
      entitlement = { ok: false, message: `entitlements check failed: ${err && err.message}` };
    }
  }
  if (entitlement.ok !== true) {
    const message = entitlement.message || "Pro+ entitlement required";
    if (json) emit(stdout, JSON.stringify({
      ok: false, mode: "publish",
      entitlement,
      error: { code: "not_pro", message, exit_code: EXIT.NOPERM },
    }));
    else emit(stderr, `error: ${message}`);
    return EXIT.NOPERM;
  }

  // 3b. Run full H7 publish.
  let publishResult;
  try {
    publishResult = await publishImpl({
      play: { ...play, previous },
      cli: {
        dryRun: parsed.dryRun,
        force: parsed.force,
        outCdn: parsed.outCdn,
        skip: parsed.skip,
      },
      deps: {
        validators: deps.validators,
        blobOps: deps.blobOps,
        httpClient: deps.httpClient,
        webhookUrl: deps.webhookUrl,
        isrSecret: deps.isrSecret,
        signer: deps.signer,
        variety: parsed.variety || deps.variety || "general",
      },
    });
  } catch (err) {
    const code = (err && err.code) || "publish_failed";
    const message = err instanceof Error ? err.message : String(err);
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "publish", error: { code, message, exit_code: EXIT.SOFTWARE } }));
    else emit(stderr, `error[publish/${code}]: ${message}`);
    return EXIT.SOFTWARE;
  }

  const action = publishResult.action || "unknown";
  // Decide exit code per H7 action taxonomy.
  let exitCode = EXIT.OK;
  if (action === "blocked") exitCode = EXIT.DATA_ERR;
  else if (publishResult.ok === false) exitCode = EXIT.DATA_ERR;

  const summary = {
    ok: publishResult.ok === true,
    mode: "publish",
    slug: play.slug,
    play_dir: parsed.playDir,
    file_count: play.files.length,
    entitlement,
    action,
    version: publishResult.version || null,
    plan: publishResult.plan || null,
    bundle: publishResult.bundle || null,
    upload: publishResult.upload || null,
    cdn: publishResult.cdn || null,
    changelog: publishResult.changelog || null,
    isr: publishResult.isr || null,
    slack: publishResult.slack || null,
    validation: publishResult.aggregate ? {
      overall: publishResult.aggregate.overall,
      passed: publishResult.aggregate.passed,
      failed: publishResult.aggregate.failed,
      skipped: publishResult.aggregate.skipped,
      total: publishResult.aggregate.total,
    } : null,
    steps: publishResult.steps || [],
  };
  const body = verbose ? JSON.stringify(summary, null, 2) : JSON.stringify(summary);
  emit(stdout, body);
  if (exitCode !== EXIT.OK && !json) {
    emit(stderr, `error[publish]: action=${action}${publishResult.aggregate ? ` (${formatSummaryLine(publishResult.aggregate)})` : ""}`);
  }
  return exitCode;
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
  SPEC_FILES,
  CommitHandlerError,
  parseCommitArgs,
  buildHelp,
  walkPlayDir,
  loadPlayFromDir,
  defaultEntitlementsCheck,
  runValidateOnly,
  runWithDeps,
  run,
};
