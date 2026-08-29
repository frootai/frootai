// @ts-check
/**
 * [H8.12] list-pending-reviews.js — `frootai orchard list-pending-reviews`
 *
 * Contract (verbatim from masterplan §3 row [H8.12]):
 *   `frootai orchard list-pending-reviews` lists harvested plays not yet
 *   committed; shows confidence + warnings + license class.
 *
 * Eleventh stage handler the [H8.1] router lazy-loads. The "what's in my
 * queue" command: a developer who's harvested N plays via `install` (and
 * not yet `commit --upgrade-to-play`'d them) types this to see what's
 * waiting for review.
 *
 * Definition of "pending" for this ship:
 *   A play directory is PENDING when ALL of the following hold:
 *     1. it contains `spec/repo-facts.json` (proves it was harvested)
 *     2. it does NOT contain `spec/published.json` (the marker file that
 *        a future commit-success step will write; absent today, so today
 *        EVERY harvested play counts as pending — exactly the intended
 *        behaviour for the H8.x arc)
 *
 *   `--include-committed` flips the filter to ALSO include plays with a
 *   published marker (useful for "show me everything I've ever harvested").
 *
 * Pipeline (per invocation):
 *   1. parse argv (`--root <dir>`, `--include-committed`, `--min-confidence`,
 *      `--max-confidence`, `--license-class <class>`, `--sort <field>`,
 *      `--limit <n>`, `--json`, `--help`)
 *   2. resolve plays-root (default `<cwd>/tmp/plays/`, matching H8.9
 *      install's default `out-dir`)
 *   3. walk plays-root one level deep; for each subdirectory that contains
 *      `spec/repo-facts.json`, build a PlayReviewEntry:
 *        { slug, dir, harvested_at, upstream_url, upstream_sha,
 *          published: bool, confidence, confidence_band, commit_ok,
 *          warnings: [{file, severity, message}], license, license_class }
 *   4. filter by --include-committed, --min/max-confidence, --license-class
 *   5. sort by --sort (default: confidence_asc — show "needs-attention" first)
 *   6. apply --limit
 *   7. emit table (non-json) OR structured JSON (json)
 *
 * Two surfaces (mirrors H8.3..H8.11):
 *
 *   1. Programmatic `runWithDeps(args, ctx, deps) → Promise<number>` —
 *      pure + injectable: `{readFile, readdirSync, statSync, existsSync,
 *      cwd}`. Tests run fully hermetically with a virtual FS shim.
 *
 *   2. Router-facing `run(args, ctx)` — default deps wire real `node:fs`.
 *
 * Subcommand argv grammar (everything AFTER `list-pending-reviews` in `argv`):
 *   --root <dir>             plays root (default: tmp/plays/ under cwd)
 *   --include-committed      include plays with a published-marker
 *   --min-confidence <n>     filter to plays with aggregate >= n (0.0-1.0)
 *   --max-confidence <n>     filter to plays with aggregate <= n (0.0-1.0)
 *   --license-class <class>  filter by license class (one of:
 *                            permissive, weak-copyleft, strong-copyleft,
 *                            commercial, unknown)
 *   --sort <field>           one of:
 *                            confidence_asc (default), confidence_desc,
 *                            name_asc, name_desc, mtime_asc, mtime_desc
 *   --limit <n>              cap the output list to N entries
 *   --json                   (router-inherited) machine-readable JSON to stdout
 *   --help, -h               print subcommand help + exit OK
 *
 * Exit codes (sysexits-aligned):
 *   0    OK             — list emitted (even if empty)
 *   64   USAGE          — bad flags / unknown --sort field / unknown
 *                          --license-class / out-of-range confidence
 *   66   NOINPUT        — --root does not exist or is not a directory
 *   70   SOFTWARE       — unexpected internal error
 *
 * Non-goals for THIS ship:
 *   - Interactive review UI (a future H9 wizard).
 *   - Pagination — `--limit` is a hard cap; no offset.
 *   - Remote check ("did anyone else commit this?") — local-only.
 *   - Recursing into nested plays (only one level under --root for now).
 *
 * License: CC0-1.0.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

/** Local sysexits enum. */
const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  NOINPUT: 66,
  SOFTWARE: 70,
});

/** Flags taking a value (`--flag <v>` or `--flag=v`). */
const VALUE_FLAGS = new Set([
  "--root", "--min-confidence", "--max-confidence",
  "--license-class", "--sort", "--limit",
]);

/** Allowed --sort field values. */
const SORT_FIELDS = Object.freeze([
  "confidence_asc", "confidence_desc",
  "name_asc", "name_desc",
  "mtime_asc", "mtime_desc",
]);

/** Allowed --license-class filter values. */
const LICENSE_CLASSES = Object.freeze([
  "permissive", "weak-copyleft", "strong-copyleft", "commercial", "unknown",
]);

/** SPDX-ish license → class mapping. Lowercased on lookup. */
const LICENSE_CLASS_MAP = Object.freeze({
  "mit": "permissive",
  "isc": "permissive",
  "apache-2.0": "permissive",
  "apache 2.0": "permissive",
  "bsd-2-clause": "permissive",
  "bsd-3-clause": "permissive",
  "0bsd": "permissive",
  "cc0-1.0": "permissive",
  "cc-by-4.0": "permissive",
  "unlicense": "permissive",
  "mpl-2.0": "weak-copyleft",
  "lgpl-2.1": "weak-copyleft",
  "lgpl-3.0": "weak-copyleft",
  "epl-2.0": "weak-copyleft",
  "epl-1.0": "weak-copyleft",
  "cddl-1.0": "weak-copyleft",
  "gpl-2.0": "strong-copyleft",
  "gpl-3.0": "strong-copyleft",
  "agpl-3.0": "strong-copyleft",
  "commercial": "commercial",
  "proprietary": "commercial",
});

/** Marker filenames under `spec/`. */
const SPEC_FILES = Object.freeze({
  REPO_FACTS: "spec/repo-facts.json",
  MANIFEST: "spec/fai-manifest.json",
  PUBLISHED: "spec/published.json",
});

/** Error carrying a sysexits exit code. */
class ListPendingReviewsHandlerError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, exitCode?: number, cause?: Error }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = "ListPendingReviewsHandlerError";
    this.code = opts.code || "list_pending_reviews_handler_failed";
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Parse the subcommand-local argv. Takes NO positionals — every option is
 * a flag. Unknown long flags are USAGE.
 *
 * @param {readonly string[]} argv
 * @returns {{ root: string|null, includeCommitted: boolean, minConfidence: number|null, maxConfidence: number|null, licenseClass: string|null, sort: string, limit: number|null, json: boolean, help: boolean }}
 */
function parseListPendingReviewsArgs(argv) {
  if (!Array.isArray(argv)) {
    throw new TypeError("parseListPendingReviewsArgs: argv must be an array");
  }
  /** @type {{ root: string|null, includeCommitted: boolean, minConfidence: number|null, maxConfidence: number|null, licenseClass: string|null, sort: string, limit: number|null, json: boolean, help: boolean }} */
  const out = {
    root: null, includeCommitted: false,
    minConfidence: null, maxConfidence: null,
    licenseClass: null, sort: "confidence_asc", limit: null,
    json: false, help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (typeof arg !== "string") {
      throw new ListPendingReviewsHandlerError(`argv entry ${i} must be a string`, {
        code: "bad_args", exitCode: EXIT.USAGE,
      });
    }
    if (arg === "--help" || arg === "-h") { out.help = true; continue; }
    if (arg === "--include-committed") { out.includeCommitted = true; continue; }
    if (arg === "--json") { out.json = true; continue; }

    let handled = false;
    for (const vf of VALUE_FLAGS) {
      if (arg === vf) {
        const v = argv[++i];
        if (typeof v !== "string" || v.length === 0) {
          throw new ListPendingReviewsHandlerError(`${vf} requires a value`, {
            code: "bad_args", exitCode: EXIT.USAGE,
          });
        }
        applyValueFlag(out, vf, v);
        handled = true; break;
      }
      if (arg.startsWith(`${vf}=`)) {
        const v = arg.slice(vf.length + 1);
        if (v.length === 0) {
          throw new ListPendingReviewsHandlerError(`${vf}= requires a non-empty value`, {
            code: "bad_args", exitCode: EXIT.USAGE,
          });
        }
        applyValueFlag(out, vf, v);
        handled = true; break;
      }
    }
    if (handled) continue;

    if (arg.startsWith("-")) {
      throw new ListPendingReviewsHandlerError(`unknown flag: ${arg}`, {
        code: "bad_args", exitCode: EXIT.USAGE,
      });
    }
    throw new ListPendingReviewsHandlerError(
      `unexpected positional argument: ${arg} (this subcommand takes no positionals)`,
      { code: "bad_args", exitCode: EXIT.USAGE },
    );
  }
  // Range + enum validation.
  if (out.minConfidence !== null && (!Number.isFinite(out.minConfidence) || out.minConfidence < 0 || out.minConfidence > 1)) {
    throw new ListPendingReviewsHandlerError(`--min-confidence must be 0.0..1.0 (got ${out.minConfidence})`, {
      code: "bad_args", exitCode: EXIT.USAGE,
    });
  }
  if (out.maxConfidence !== null && (!Number.isFinite(out.maxConfidence) || out.maxConfidence < 0 || out.maxConfidence > 1)) {
    throw new ListPendingReviewsHandlerError(`--max-confidence must be 0.0..1.0 (got ${out.maxConfidence})`, {
      code: "bad_args", exitCode: EXIT.USAGE,
    });
  }
  if (out.licenseClass !== null && !LICENSE_CLASSES.includes(out.licenseClass)) {
    throw new ListPendingReviewsHandlerError(
      `--license-class must be one of ${LICENSE_CLASSES.join(", ")} (got "${out.licenseClass}")`,
      { code: "bad_args", exitCode: EXIT.USAGE },
    );
  }
  if (!SORT_FIELDS.includes(out.sort)) {
    throw new ListPendingReviewsHandlerError(
      `--sort must be one of ${SORT_FIELDS.join(", ")} (got "${out.sort}")`,
      { code: "bad_args", exitCode: EXIT.USAGE },
    );
  }
  if (out.limit !== null && (!Number.isInteger(out.limit) || out.limit < 1)) {
    throw new ListPendingReviewsHandlerError(`--limit must be a positive integer (got ${out.limit})`, {
      code: "bad_args", exitCode: EXIT.USAGE,
    });
  }
  return out;
}

function applyValueFlag(out, vf, v) {
  if (vf === "--root") out.root = v;
  else if (vf === "--min-confidence") out.minConfidence = parseFloat(v);
  else if (vf === "--max-confidence") out.maxConfidence = parseFloat(v);
  else if (vf === "--license-class") out.licenseClass = v;
  else if (vf === "--sort") out.sort = v;
  else if (vf === "--limit") out.limit = parseInt(v, 10);
}

/** Build the `frootai orchard list-pending-reviews --help` banner. */
function buildHelp() {
  return [
    "Usage: frootai orchard list-pending-reviews [options]",
    "",
    "List harvested plays not yet committed (no spec/published.json marker).",
    "Shows confidence + warnings + license class for each pending play.",
    "",
    "Options:",
    "  --root <dir>             plays root (default: tmp/plays/ under cwd)",
    "  --include-committed      include plays with a published marker",
    "  --min-confidence <0..1>  filter to aggregate confidence >= n",
    "  --max-confidence <0..1>  filter to aggregate confidence <= n",
    "  --license-class <class>  filter by license class (" + LICENSE_CLASSES.join(", ") + ")",
    "  --sort <field>           " + SORT_FIELDS.join(", ") + " (default: confidence_asc)",
    "  --limit <n>              cap the output list to N entries",
    "",
    "Output:",
    "  --json                   machine-readable single-line JSON to stdout",
    "  --help, -h               show this help and exit",
    "",
    "Exit codes:",
    "  0   success (list emitted, even if empty)",
    "  64  bad args / unknown --sort field or --license-class",
    "  66  --root does not exist or is not a directory",
    "  70  unexpected internal error",
    "",
    "Examples:",
    "  frootai orchard list-pending-reviews",
    "  frootai orchard list-pending-reviews --root ./my-plays --sort name_asc",
    "  frootai orchard list-pending-reviews --max-confidence 0.7        # needs-attention",
    "  frootai orchard list-pending-reviews --license-class strong-copyleft",
    "  frootai orchard list-pending-reviews --include-committed --json",
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
 * Classify a license identifier into one of the LICENSE_CLASSES buckets.
 * Falls back to `"unknown"` for anything we don't recognise (or absent).
 *
 * @param {string|null|undefined} license
 * @returns {string}
 */
function classifyLicense(license) {
  if (typeof license !== "string" || license.length === 0) return "unknown";
  const key = license.trim().toLowerCase();
  return LICENSE_CLASS_MAP[key] || "unknown";
}

/**
 * Read + JSON.parse a sidecar under `spec/`. Returns `{ ok, data?, error? }`.
 *
 * @param {string} playDir @param {string} rel
 * @param {(p: string, enc: string) => string} readFile
 */
function readSpecJson(playDir, rel, readFile) {
  const abs = path.resolve(playDir, rel);
  let text;
  try { text = readFile(abs, "utf8"); }
  catch (err) { return { ok: false, error: `cannot read ${rel}: ${err && err.message}` }; }
  try { return { ok: true, data: JSON.parse(text) }; }
  catch (err) { return { ok: false, error: `cannot parse ${rel}: ${err && err.message}` }; }
}

/**
 * Build a single `PlayReviewEntry` from a candidate directory. Returns
 * `null` when the directory is not a play (missing repo-facts.json) — the
 * caller filters nulls out.
 *
 * @param {string} playDir
 * @param {object} io — `{ readFile, existsSync, statSync }`
 * @returns {object|null}
 */
function buildPlayEntry(playDir, io) {
  const readFile = io.readFile || ((p, enc) => fs.readFileSync(p, enc));
  const exists = io.existsSync || fs.existsSync;
  const stat = io.statSync || ((p) => fs.statSync(p));

  const factsAbs = path.resolve(playDir, SPEC_FILES.REPO_FACTS);
  if (!exists(factsAbs)) return null;

  const factsR = readSpecJson(playDir, SPEC_FILES.REPO_FACTS, readFile);
  if (!factsR.ok) {
    // A play directory with broken facts is still a play that needs attention.
    return {
      slug: path.basename(path.resolve(playDir)),
      dir: path.resolve(playDir),
      harvested_at: null,
      upstream_url: null,
      upstream_sha: null,
      published: false,
      confidence: null,
      confidence_band: null,
      commit_ok: null,
      warnings: [{ file: SPEC_FILES.REPO_FACTS, severity: "error", message: factsR.error }],
      license: null,
      license_class: "unknown",
    };
  }
  const facts = factsR.data || {};

  // harvested_at: best-effort from facts.harvested_at OR file mtime.
  /** @type {string|null} */
  let harvestedAt = null;
  if (typeof facts.harvested_at === "string") {
    harvestedAt = facts.harvested_at;
  } else {
    try {
      const s = stat(factsAbs);
      const ms = s.mtimeMs || (s.mtime && s.mtime.getTime && s.mtime.getTime()) || 0;
      if (ms > 0) harvestedAt = new Date(ms).toISOString();
    } catch { /* ignore */ }
  }

  // published marker.
  const publishedAbs = path.resolve(playDir, SPEC_FILES.PUBLISHED);
  const published = !!exists(publishedAbs);

  // Manifest → confidence + per-file warnings (optional).
  /** @type {Array<{file:string,severity:string,message:string}>} */
  const warnings = [];
  let confidence = null;
  let confidenceBand = null;
  let commitOk = null;
  const manifestR = readSpecJson(playDir, SPEC_FILES.MANIFEST, readFile);
  if (manifestR.ok && manifestR.data && typeof manifestR.data === "object") {
    const m = manifestR.data;
    if (typeof m.aggregate === "number") confidence = m.aggregate;
    if (typeof m.aggregate_band === "string") confidenceBand = m.aggregate_band;
    if (typeof m.commit_ok === "boolean") commitOk = m.commit_ok;
    if (Array.isArray(m.files)) {
      for (const f of m.files) {
        if (f && Array.isArray(f.warnings)) {
          for (const w of f.warnings) {
            warnings.push({
              file: typeof f.filename === "string" ? f.filename : "",
              severity: typeof w === "object" && w && typeof w.severity === "string" ? w.severity : "warn",
              message: typeof w === "string" ? w : (w && typeof w.message === "string" ? w.message : String(w)),
            });
          }
        }
      }
    }
  } else if (!manifestR.ok && manifestR.error && !/cannot read/.test(manifestR.error)) {
    // A malformed manifest is a parse error, not "absent" — surface it.
    warnings.push({ file: SPEC_FILES.MANIFEST, severity: "warn", message: manifestR.error });
  }

  const license = typeof facts.license === "string" ? facts.license : null;
  const licenseClass = classifyLicense(license);

  return {
    slug: typeof facts.slug === "string" && facts.slug ? facts.slug : path.basename(path.resolve(playDir)),
    dir: path.resolve(playDir),
    harvested_at: harvestedAt,
    upstream_url: typeof facts.upstream_url === "string" ? facts.upstream_url
      : (typeof facts.full_name === "string" ? facts.full_name : null),
    upstream_sha: typeof facts.upstream_commit_sha === "string" ? facts.upstream_commit_sha
      : (typeof facts.sha === "string" ? facts.sha : null),
    published,
    confidence,
    confidence_band: confidenceBand,
    commit_ok: commitOk,
    warnings,
    license,
    license_class: licenseClass,
  };
}

/**
 * Scan a plays-root one level deep. Returns the list of PlayReviewEntry
 * objects in directory-iteration order (the caller sorts later).
 *
 * @param {string} root
 * @param {object} io
 * @returns {Array<object>}
 */
function scanPlaysRoot(root, io) {
  const readdir = io.readdirSync || ((p, opts) => fs.readdirSync(p, opts));
  const stat = io.statSync || ((p) => fs.statSync(p));

  /** @type {Array<object>} */
  const entries = [];
  // Let readdir errors propagate — the handler validates --root exists +
  // is a directory upstream, so an unexpected readdir throw is genuinely
  // exceptional (disk failure, permission flip mid-flight) and deserves
  // SOFTWARE 70 via the runWithDeps catch.
  const dirents = readdir(root, { withFileTypes: true });
  for (const dirent of dirents) {
    const name = dirent && dirent.name ? String(dirent.name) : "";
    if (!name || name.startsWith(".")) continue;
    const abs = path.resolve(root, name);
    let isDir = false;
    try {
      isDir = typeof dirent.isDirectory === "function" ? dirent.isDirectory() : stat(abs).isDirectory();
    } catch { isDir = false; }
    if (!isDir) continue;
    const e = buildPlayEntry(abs, io);
    if (e) entries.push(e);
  }
  return entries;
}

/**
 * Apply filters (--include-committed, --min/max-confidence, --license-class)
 * to a list of PlayReviewEntry objects.
 *
 * @param {Array<object>} entries
 * @param {{ includeCommitted: boolean, minConfidence: number|null, maxConfidence: number|null, licenseClass: string|null }} filters
 * @returns {Array<object>}
 */
function filterEntries(entries, filters) {
  return entries.filter((e) => {
    if (!filters.includeCommitted && e.published) return false;
    if (filters.minConfidence !== null) {
      if (typeof e.confidence !== "number" || e.confidence < filters.minConfidence) return false;
    }
    if (filters.maxConfidence !== null) {
      if (typeof e.confidence !== "number" || e.confidence > filters.maxConfidence) return false;
    }
    if (filters.licenseClass !== null && e.license_class !== filters.licenseClass) return false;
    return true;
  });
}

/**
 * Sort a list of PlayReviewEntry objects by the requested field. NaN/null
 * confidence sorts AFTER any numeric value in ascending order (so it
 * surfaces in `confidence_asc` mode — "needs attention" includes "we
 * couldn't even score it").
 *
 * @param {Array<object>} entries
 * @param {string} sort
 * @returns {Array<object>}
 */
function sortEntries(entries, sort) {
  const arr = entries.slice();
  const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  // Null/NaN confidences ALWAYS sort last regardless of direction ("needs
  // attention" includes "we couldn't even score it" — but in DESC mode the
  // user wants high-confidence first, so nulls still belong at the end).
  const cmpConf = (a, b, asc) => {
    const an = typeof a === "number" && Number.isFinite(a);
    const bn = typeof b === "number" && Number.isFinite(b);
    if (!an && !bn) return 0;
    if (!an) return 1;
    if (!bn) return -1;
    return asc ? a - b : b - a;
  };
  switch (sort) {
    case "confidence_asc":  arr.sort((a, b) => cmpConf(a.confidence, b.confidence, true)  || cmpStr(a.slug, b.slug)); break;
    case "confidence_desc": arr.sort((a, b) => cmpConf(a.confidence, b.confidence, false) || cmpStr(a.slug, b.slug)); break;
    case "name_asc":        arr.sort((a, b) => cmpStr(a.slug, b.slug)); break;
    case "name_desc":       arr.sort((a, b) => -cmpStr(a.slug, b.slug)); break;
    case "mtime_asc":       arr.sort((a, b) => cmpStr(a.harvested_at || "", b.harvested_at || "") || cmpStr(a.slug, b.slug)); break;
    case "mtime_desc":      arr.sort((a, b) => -cmpStr(a.harvested_at || "", b.harvested_at || "") || cmpStr(a.slug, b.slug)); break;
    default: /* validated upstream; default to confidence_asc */
      arr.sort((a, b) => cmpConf(a.confidence, b.confidence, true) || cmpStr(a.slug, b.slug));
  }
  return arr;
}

/**
 * Format a non-JSON table summary for stdout. Columns:
 *   SLUG  CONF  BAND  WARN  LICENSE   CLASS    PUBLISHED  DIR
 *
 * @param {Array<object>} entries
 */
function formatTable(entries) {
  const lines = [];
  if (entries.length === 0) {
    lines.push("No pending reviews. Run `frootai orchard install --as-play <url>` to harvest a play.");
    return lines.join("\n");
  }
  const fmtConf = (c) => (typeof c === "number" && Number.isFinite(c)) ? c.toFixed(2) : "—";
  const fmtBand = (b) => (typeof b === "string" && b.length > 0) ? b : "—";
  const slugW = Math.max("SLUG".length, ...entries.map((e) => String(e.slug || "").length));
  const licW = Math.max("LICENSE".length, ...entries.map((e) => String(e.license || "—").length));
  const classW = Math.max("CLASS".length, ...entries.map((e) => String(e.license_class || "—").length));
  const bandW = Math.max("BAND".length, ...entries.map((e) => fmtBand(e.confidence_band).length));
  const header = [
    pad("SLUG", slugW), pad("CONF", 5), pad("BAND", bandW),
    pad("WARN", 4), pad("LICENSE", licW), pad("CLASS", classW),
    pad("PUBLISHED", 9), "DIR",
  ].join("  ");
  lines.push(header);
  lines.push("-".repeat(header.length));
  for (const e of entries) {
    lines.push([
      pad(e.slug || "", slugW),
      pad(fmtConf(e.confidence), 5),
      pad(fmtBand(e.confidence_band), bandW),
      pad(String(e.warnings.length), 4),
      pad(e.license || "—", licW),
      pad(e.license_class || "—", classW),
      pad(e.published ? "yes" : "no", 9),
      e.dir,
    ].join("  "));
  }
  return lines.join("\n");
}

function pad(s, n) {
  const str = String(s);
  if (str.length >= n) return str;
  return str + " ".repeat(n - str.length);
}

/**
 * Programmatic surface. Pure + injectable.
 *
 * @param {readonly string[]} args
 * @param {object} ctx
 * @param {object} [deps]
 * @param {(p: string, enc: string) => string} [deps.readFile]
 * @param {(p: string, opts: object) => any[]} [deps.readdirSync]
 * @param {(p: string) => any} [deps.statSync]
 * @param {(p: string) => boolean} [deps.existsSync]
 * @param {() => string} [deps.cwd]
 * @returns {Promise<number>}
 */
async function runWithDeps(args, ctx, deps = {}) {
  const stdout = (ctx && ctx.stdout) || ((s) => process.stdout.write(s));
  const stderr = (ctx && ctx.stderr) || ((s) => process.stderr.write(s));
  const cwd = deps.cwd || (() => process.cwd());

  /** @type {ReturnType<typeof parseListPendingReviewsArgs>} */
  let parsed;
  try {
    parsed = parseListPendingReviewsArgs(args || []);
  } catch (err) {
    if (err instanceof ListPendingReviewsHandlerError) {
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

  const root = parsed.root
    ? path.resolve(parsed.root)
    : path.resolve(cwd(), "tmp", "plays");

  // Validate --root.
  const exists = deps.existsSync || fs.existsSync;
  const stat = deps.statSync || ((p) => fs.statSync(p));
  if (!exists(root)) {
    const message = `plays root does not exist: ${root}`;
    if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "no_root", message, exit_code: EXIT.NOINPUT } }));
    else emit(stderr, `error: ${message}`);
    return EXIT.NOINPUT;
  }
  try {
    const s = stat(root);
    if (!(typeof s.isDirectory === "function" && s.isDirectory())) {
      const message = `plays root is not a directory: ${root}`;
      if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "no_root", message, exit_code: EXIT.NOINPUT } }));
      else emit(stderr, `error: ${message}`);
      return EXIT.NOINPUT;
    }
  } catch (err) {
    const message = `cannot stat plays root ${root}: ${err && err.message}`;
    if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "no_root", message, exit_code: EXIT.NOINPUT } }));
    else emit(stderr, `error: ${message}`);
    return EXIT.NOINPUT;
  }

  // Scan + filter + sort + cap.
  const io = {
    readFile: deps.readFile, readdirSync: deps.readdirSync,
    statSync: deps.statSync, existsSync: deps.existsSync,
  };
  let entries;
  try {
    entries = scanPlaysRoot(root, io);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "scan_failed", message, exit_code: EXIT.SOFTWARE } }));
    else emit(stderr, `error: ${message}`);
    return EXIT.SOFTWARE;
  }

  const totalScanned = entries.length;
  const pendingCount = entries.filter((e) => !e.published).length;
  const publishedCount = entries.filter((e) => e.published).length;

  const filtered = filterEntries(entries, {
    includeCommitted: parsed.includeCommitted,
    minConfidence: parsed.minConfidence,
    maxConfidence: parsed.maxConfidence,
    licenseClass: parsed.licenseClass,
  });
  const sorted = sortEntries(filtered, parsed.sort);
  const capped = parsed.limit !== null ? sorted.slice(0, parsed.limit) : sorted;
  const limitTruncated = parsed.limit !== null && sorted.length > parsed.limit;

  if (json) {
    const summary = {
      ok: true,
      root,
      total_scanned: totalScanned,
      pending_count: pendingCount,
      published_count: publishedCount,
      filtered_count: filtered.length,
      returned_count: capped.length,
      limit_truncated: limitTruncated,
      filters: {
        include_committed: parsed.includeCommitted,
        min_confidence: parsed.minConfidence,
        max_confidence: parsed.maxConfidence,
        license_class: parsed.licenseClass,
        sort: parsed.sort,
        limit: parsed.limit,
      },
      entries: capped,
    };
    const body = verbose ? JSON.stringify(summary, null, 2) : JSON.stringify(summary);
    emit(stdout, body);
  } else {
    emit(stdout, formatTable(capped));
    const footer = `\n${capped.length} of ${filtered.length} matching (${pendingCount} pending / ${publishedCount} committed / ${totalScanned} scanned) under ${root}`
      + (limitTruncated ? ` — truncated by --limit ${parsed.limit}` : "");
    emit(stdout, footer);
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
  SORT_FIELDS,
  LICENSE_CLASSES,
  LICENSE_CLASS_MAP,
  SPEC_FILES,
  ListPendingReviewsHandlerError,
  parseListPendingReviewsArgs,
  buildHelp,
  classifyLicense,
  buildPlayEntry,
  scanPlaysRoot,
  filterEntries,
  sortEntries,
  formatTable,
  runWithDeps,
  run,
};
