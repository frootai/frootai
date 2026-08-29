// @ts-check
/**
 * [H8.27] errors.js — structured error UX library.
 *
 * Contract (verbatim from masterplan §3 row [H8.27]):
 *   Every error includes `code`, `message`, `remediation` (URL or
 *   command), `support_id` (last 100 lines of log uploaded to support
 *   endpoint when consented)
 *
 * Top-level group `errors/` parallels `progress/` (H8.26) per H8.x
 * group-per-domain doctrine. Library lives at
 * `cli/commands/errors/errors.js` so the bin-reconciliation
 * sub-phase can wire it into every handler via
 * `deps.errorReporter = createErrorReporter({...})` WITHOUT changing
 * the existing 2281 H8.x tests. This file ships ONLY the library +
 * `runWithDeps(args, ctx, deps)` + `run(args, ctx)` demo runner that
 * round-trips a fake error (for documentation + smoke purposes).
 *
 * **Three pillars** of structured error UX:
 *
 *   1. Stable `code` (one of `ERROR_CODES`) — programmatic key for
 *      machine consumers + remediation lookup. Maps 1:1 to a sysexits
 *      exit code via `EXIT_FOR_CODE`. Codes are **frozen** + version
 *      promised — adding new codes is non-breaking; renaming is a
 *      MAJOR bump.
 *
 *   2. `remediation` — for each `code`, a `{kind, value}` payload:
 *        - `{kind: "url", value: "https://frootai.dev/docs/errors/..."}`
 *        - `{kind: "command", value: "frootai auth login"}`
 *        - `{kind: "hint", value: "set GH_TOKEN env var with 'repo' scope"}`
 *      The remediation is taken from `REMEDIATIONS[code]` (overridable
 *      per-call via `buildError({code, remediationOverride})`).
 *
 *   3. `support_id` — opaque 16-hex string + an optional upload of
 *      the last 100 lines of log to the support endpoint. The upload
 *      is GATED by `deps.consent.isTelemetryEnabled()` (default reads
 *      the H8.16 config store); when consent is absent we still print
 *      the support_id so users can quote it manually + we offer the
 *      `frootai support upload <id>` command as a remediation hint.
 *
 * **Tail-buffer log capture**: a `LogTailBuffer` ring of capacity 100
 * (default) collects every line the CLI emits. The reporter snapshots
 * the buffer at error-time + uploads it (or includes it in a local
 * `--debug` JSON dump). The buffer is FIFO-bounded — older lines drop.
 * Lines are REDACTED before storage: GitHub tokens (`ghp_/gho_/...`),
 * Azure subscription IDs, bearer tokens, AWS keys, and absolute paths
 * containing the user's homedir are masked to `<redacted:kind>`.
 *
 * **JSON envelope** for `--json` mode (stable shape — versioned by
 * `version: 1`):
 *   {
 *     "version": 1,
 *     "ok": false,
 *     "error": {
 *       "code": "AUTH_REQUIRED",
 *       "message": "...",
 *       "remediation": {"kind": "command", "value": "frootai auth login"},
 *       "support_id": "f7c9...",
 *       "support_upload": {
 *         "uploaded": false,
 *         "reason": "telemetry_not_consented" | "endpoint_unreachable",
 *         "command_to_upload_later": "frootai support upload f7c9..."
 *       }
 *     },
 *     "exit_code": 77
 *   }
 *
 * **Subcommand argv grammar** — `frootai errors <subcommand>`:
 *   demo <code>       round-trip a fake error of the given code (for docs)
 *   codes             list all known codes + their default remediation
 *   upload <id>       (placeholder) wire to bin-reconciliation
 *   --json            emit JSON envelope on stdout (vs human format)
 *   --no-upload       skip the support-id upload attempt
 *   --debug           dump the full redacted tail buffer to stderr
 *   --help, -h        print help + exit OK
 *
 * **Exit codes** (sysexits-aligned + per-code map):
 *   0    OK              — `codes` subcommand listing
 *   64   USAGE           — bad flags / unknown subcommand / unknown code
 *   65   DATA_ERR        — VALIDATION_FAILED / SCHEMA_INVALID
 *   66   NOINPUT         — INPUT_MISSING / FILE_NOT_FOUND
 *   69   UNAVAILABLE     — UPSTREAM_UNAVAILABLE / RATE_LIMITED
 *   70   SOFTWARE        — INTERNAL_ERROR / UNEXPECTED
 *   74   IOERR           — IO_FAILED / WRITE_FAILED
 *   75   TEMPFAIL        — NETWORK_TEMP / RETRY_LATER
 *   77   NOPERM          — AUTH_REQUIRED / FORBIDDEN
 *
 * **Non-goals for THIS ship**:
 *   - Wiring into every H8 handler (deferred to bin-reconciliation).
 *   - A real network upload (we ship a pluggable `deps.uploader` that
 *     defaults to a no-op + `reason: "endpoint_unreachable"` when not
 *     injected — the real httpsPost wire ships in the upload-handler
 *     ship-cluster).
 *   - i18n of remediation messages (always English in this ship).
 *
 * License: CC0-1.0.
 */
"use strict";

const crypto = require("node:crypto");

const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  DATA_ERR: 65,
  NOINPUT: 66,
  UNAVAILABLE: 69,
  SOFTWARE: 70,
  IOERR: 74,
  TEMPFAIL: 75,
  NOPERM: 77,
});

/**
 * Frozen registry of stable error codes. Each code maps to an exit
 * code in EXIT_FOR_CODE + a default remediation in REMEDIATIONS. The
 * `version` field on the JSON envelope guards renames as MAJOR.
 */
const ERROR_CODES = Object.freeze([
  "AUTH_REQUIRED",
  "FORBIDDEN",
  "VALIDATION_FAILED",
  "SCHEMA_INVALID",
  "INPUT_MISSING",
  "FILE_NOT_FOUND",
  "UPSTREAM_UNAVAILABLE",
  "RATE_LIMITED",
  "NETWORK_TEMP",
  "RETRY_LATER",
  "IO_FAILED",
  "WRITE_FAILED",
  "INTERNAL_ERROR",
  "UNEXPECTED",
  "USAGE_BAD_FLAG",
]);

const EXIT_FOR_CODE = Object.freeze({
  AUTH_REQUIRED: EXIT.NOPERM,
  FORBIDDEN: EXIT.NOPERM,
  VALIDATION_FAILED: EXIT.DATA_ERR,
  SCHEMA_INVALID: EXIT.DATA_ERR,
  INPUT_MISSING: EXIT.NOINPUT,
  FILE_NOT_FOUND: EXIT.NOINPUT,
  UPSTREAM_UNAVAILABLE: EXIT.UNAVAILABLE,
  RATE_LIMITED: EXIT.UNAVAILABLE,
  NETWORK_TEMP: EXIT.TEMPFAIL,
  RETRY_LATER: EXIT.TEMPFAIL,
  IO_FAILED: EXIT.IOERR,
  WRITE_FAILED: EXIT.IOERR,
  INTERNAL_ERROR: EXIT.SOFTWARE,
  UNEXPECTED: EXIT.SOFTWARE,
  USAGE_BAD_FLAG: EXIT.USAGE,
});

const DOCS_BASE = "https://frootai.dev/docs/errors";

/**
 * Default remediation per code. `{kind, value}` where kind ∈ url|command|hint.
 * Callers may override per-error via `buildError({remediationOverride})`.
 */
const REMEDIATIONS = Object.freeze({
  AUTH_REQUIRED: Object.freeze({ kind: "command", value: "frootai auth login" }),
  FORBIDDEN: Object.freeze({ kind: "hint", value: "your token lacks the required scope; see " + DOCS_BASE + "/forbidden" }),
  VALIDATION_FAILED: Object.freeze({ kind: "url", value: DOCS_BASE + "/validation-failed" }),
  SCHEMA_INVALID: Object.freeze({ kind: "url", value: DOCS_BASE + "/schema-invalid" }),
  INPUT_MISSING: Object.freeze({ kind: "hint", value: "provide the required input via the documented flag" }),
  FILE_NOT_FOUND: Object.freeze({ kind: "hint", value: "check the path you passed (typo, missing dir?)" }),
  UPSTREAM_UNAVAILABLE: Object.freeze({ kind: "url", value: "https://status.frootai.dev" }),
  RATE_LIMITED: Object.freeze({ kind: "hint", value: "wait and retry; see " + DOCS_BASE + "/rate-limited" }),
  NETWORK_TEMP: Object.freeze({ kind: "command", value: "frootai --retry 3 <your-command>" }),
  RETRY_LATER: Object.freeze({ kind: "hint", value: "transient — retry in a moment" }),
  IO_FAILED: Object.freeze({ kind: "hint", value: "check filesystem permissions + free space" }),
  WRITE_FAILED: Object.freeze({ kind: "hint", value: "the destination directory is read-only or full" }),
  INTERNAL_ERROR: Object.freeze({ kind: "url", value: DOCS_BASE + "/internal-error" }),
  UNEXPECTED: Object.freeze({ kind: "url", value: DOCS_BASE + "/unexpected" }),
  USAGE_BAD_FLAG: Object.freeze({ kind: "command", value: "frootai --help" }),
});

const SUBCOMMANDS = Object.freeze(["demo", "codes", "upload"]);

const VALUE_FLAGS = new Set([]); // none today (--json/--no-upload/--debug/--help are bools)
const BOOL_FLAGS = new Set([
  "--json",
  "--no-upload",
  "--debug",
  "--help",
  "-h",
]);

const SUPPORT_ID_BYTES = 8; // → 16 hex chars

const DEFAULT_TAIL_CAPACITY = 100;

class ErrorReporterError extends Error {
  /** @param {string} code @param {string} message @param {{exitCode?: number, cause?: Error}} [opts] */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "ErrorReporterError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Parse argv for `frootai errors <subcommand> [OPTIONS]`.
 *
 * @param {string[]} argv
 * @returns {{subcommand: string|null, code: string|null, supportId: string|null, json: boolean, noUpload: boolean, debug: boolean, help: boolean}}
 */
function parseErrorsArgs(argv) {
  if (!Array.isArray(argv)) throw new TypeError("parseErrorsArgs: argv must be an array");
  const out = {
    subcommand: /** @type {string|null} */ (null),
    code: /** @type {string|null} */ (null),
    supportId: /** @type {string|null} */ (null),
    json: false,
    noUpload: false,
    debug: false,
    help: false,
  };
  /** @type {string[]} */
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (typeof a !== "string") throw new ErrorReporterError("usage", `argv[${i}] must be a string`, { exitCode: EXIT.USAGE });
    if (a === "--help" || a === "-h") { out.help = true; continue; }
    if (a === "--json") { out.json = true; continue; }
    if (a === "--no-upload") { out.noUpload = true; continue; }
    if (a === "--debug") { out.debug = true; continue; }
    if (a.startsWith("-")) throw new ErrorReporterError("usage", `unknown flag: ${a}`, { exitCode: EXIT.USAGE });
    positional.push(a);
  }
  if (positional.length === 0) return out;
  const sub = positional[0];
  if (!SUBCOMMANDS.includes(sub)) {
    throw new ErrorReporterError("usage", `unknown subcommand: ${sub} (valid: ${SUBCOMMANDS.join("|")})`, { exitCode: EXIT.USAGE });
  }
  out.subcommand = sub;
  if (sub === "demo") {
    if (positional.length < 2) throw new ErrorReporterError("usage", `demo requires an error code argument`, { exitCode: EXIT.USAGE });
    if (positional.length > 2) throw new ErrorReporterError("usage", `demo accepts exactly one positional arg`, { exitCode: EXIT.USAGE });
    if (!ERROR_CODES.includes(positional[1])) {
      throw new ErrorReporterError("usage", `unknown error code: ${positional[1]}`, { exitCode: EXIT.USAGE });
    }
    out.code = positional[1];
  } else if (sub === "codes") {
    if (positional.length > 1) throw new ErrorReporterError("usage", `codes accepts no positional args`, { exitCode: EXIT.USAGE });
  } else if (sub === "upload") {
    if (positional.length < 2) throw new ErrorReporterError("usage", `upload requires a support_id argument`, { exitCode: EXIT.USAGE });
    if (positional.length > 2) throw new ErrorReporterError("usage", `upload accepts exactly one positional arg`, { exitCode: EXIT.USAGE });
    if (!isValidSupportId(positional[1])) {
      throw new ErrorReporterError("usage", `invalid support_id (expected 16 hex chars)`, { exitCode: EXIT.USAGE });
    }
    out.supportId = positional[1];
  }
  return out;
}

function buildHelp() {
  return [
    "Usage: frootai errors <subcommand> [OPTIONS]",
    "",
    "Structured error UX — every error has code, message, remediation,",
    "and a support_id (with optional log-tail upload).",
    "",
    "Subcommands:",
    "  demo <code>     round-trip a fake error of the given code",
    "  codes           list all known error codes + default remediations",
    "  upload <id>     upload tail buffer for an existing support_id",
    "",
    "Options:",
    "  --json          emit JSON envelope on stdout (vs human format)",
    "  --no-upload     skip the support-id upload attempt",
    "  --debug         dump the redacted tail buffer to stderr",
    "  --help, -h      print this help",
    "",
    "License: CC0-1.0.",
  ].join("\n");
}

/**
 * Validate a support_id (16-char lowercase hex). Pure.
 *
 * @param {unknown} s
 * @returns {boolean}
 */
function isValidSupportId(s) {
  return typeof s === "string" && /^[0-9a-f]{16}$/.test(s);
}

/**
 * Generate a fresh support_id. Pure-ish — uses crypto.randomBytes by
 * default; tests inject `{randomBytes}` to make it deterministic.
 *
 * @param {object} [deps]
 * @param {(n: number) => Buffer} [deps.randomBytes]
 * @returns {string}
 */
function generateSupportId(deps) {
  const d = deps || {};
  const rb = typeof d.randomBytes === "function" ? d.randomBytes : crypto.randomBytes;
  const buf = rb(SUPPORT_ID_BYTES);
  // accept Buffer or Uint8Array
  return Buffer.from(buf).toString("hex").toLowerCase();
}

/**
 * Resolve the exit code for an error `code`. Pure. Falls back to
 * SOFTWARE for unknown codes (so newer callers with unknown codes
 * still get a sensible exit).
 *
 * @param {string} code
 * @returns {number}
 */
function exitCodeForErrorCode(code) {
  const e = EXIT_FOR_CODE[code];
  return typeof e === "number" ? e : EXIT.SOFTWARE;
}

/**
 * Resolve the default remediation for a code. Pure.
 *
 * @param {string} code
 * @returns {{kind: string, value: string}|null}
 */
function remediationForCode(code) {
  const r = REMEDIATIONS[code];
  return r ? { kind: r.kind, value: r.value } : null;
}

/**
 * Redact sensitive substrings from a single log line. Pure.
 *
 * Redacts (in order):
 *   - GitHub PATs / fine-grained / OAuth: `ghp_/gho_/ghu_/ghs_/ghr_` + base62
 *   - Bearer tokens in `Authorization: Bearer ...` headers
 *   - Azure subscription IDs (UUIDs in `/subscriptions/<uuid>/...`)
 *   - AWS access key IDs (`AKIA[0-9A-Z]{16}`)
 *   - User homedir absolute-path prefixes (replaced with `~`)
 *
 * Replacement form: `<redacted:kind>` (caller can match `<redacted:` in
 * tests). Pure; no I/O.
 *
 * @param {string} line
 * @param {object} [opts]
 * @param {string} [opts.homedir] — if provided, prefix matches → `~`
 * @returns {string}
 */
function redactLine(line, opts) {
  if (typeof line !== "string") return "";
  let s = line;
  // GitHub tokens (ghp_, gho_, ghu_, ghs_, ghr_) — 36+ chars of base62 after prefix
  s = s.replace(/\bgh[pousr]_[A-Za-z0-9]{20,255}/g, "<redacted:gh_token>");
  // Generic `Bearer <token>` (case-insensitive)
  s = s.replace(/\bBearer\s+[A-Za-z0-9\-._~+/]{20,}=*\b/gi, "Bearer <redacted:bearer>");
  // Azure subscription UUIDs inside /subscriptions/...
  s = s.replace(/\/subscriptions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/subscriptions/<redacted:azure_sub>");
  // AWS access keys
  s = s.replace(/\bAKIA[0-9A-Z]{16}\b/g, "<redacted:aws_key>");
  // Homedir absolute-path prefix → ~
  if (opts && opts.homedir && typeof opts.homedir === "string" && opts.homedir.length > 0) {
    const escaped = opts.homedir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    s = s.replace(new RegExp(escaped, "g"), "~");
  }
  return s;
}

/**
 * Ring buffer of the last N log lines. All lines are redacted at
 * `push()` time so no raw secret ever sits in memory after capture.
 */
class LogTailBuffer {
  /** @param {{capacity?: number, homedir?: string}} [opts] */
  constructor(opts) {
    const o = opts || {};
    /** @type {number} */
    this.capacity = Number.isInteger(o.capacity) && o.capacity > 0 ? o.capacity : DEFAULT_TAIL_CAPACITY;
    /** @type {string|undefined} */
    this.homedir = typeof o.homedir === "string" ? o.homedir : undefined;
    /** @type {string[]} */
    this._lines = [];
  }

  /** @param {string} line */
  push(line) {
    if (typeof line !== "string") return;
    const redacted = redactLine(line, { homedir: this.homedir });
    this._lines.push(redacted);
    if (this._lines.length > this.capacity) {
      this._lines.splice(0, this._lines.length - this.capacity);
    }
  }

  /** @returns {string[]} */
  snapshot() { return this._lines.slice(); }

  clear() { this._lines = []; }

  /** @returns {number} */
  get size() { return this._lines.length; }
}

/**
 * Build the structured error envelope. Pure.
 *
 * @param {object} args
 * @param {string} args.code — one of ERROR_CODES
 * @param {string} args.message
 * @param {string} args.support_id
 * @param {{kind: string, value: string}} [args.remediationOverride]
 * @param {{uploaded: boolean, reason?: string, url?: string, command_to_upload_later?: string}} [args.support_upload]
 * @returns {{version: 1, ok: false, error: {code: string, message: string, remediation: {kind: string, value: string}|null, support_id: string, support_upload?: object}, exit_code: number}}
 */
function buildErrorEnvelope(args) {
  if (!args || typeof args !== "object") {
    throw new ErrorReporterError("usage", "buildErrorEnvelope: args required", { exitCode: EXIT.USAGE });
  }
  const { code, message, support_id, remediationOverride, support_upload } = args;
  if (!ERROR_CODES.includes(code)) {
    throw new ErrorReporterError("usage", `buildErrorEnvelope: unknown code ${code}`, { exitCode: EXIT.USAGE });
  }
  if (typeof message !== "string" || !message) {
    throw new ErrorReporterError("usage", `buildErrorEnvelope: message must be a non-empty string`, { exitCode: EXIT.USAGE });
  }
  if (!isValidSupportId(support_id)) {
    throw new ErrorReporterError("usage", `buildErrorEnvelope: invalid support_id`, { exitCode: EXIT.USAGE });
  }
  const rem = remediationOverride && typeof remediationOverride.kind === "string" && typeof remediationOverride.value === "string"
    ? { kind: remediationOverride.kind, value: remediationOverride.value }
    : remediationForCode(code);
  /** @type {*} */
  const error = {
    code,
    message,
    remediation: rem,
    support_id,
  };
  if (support_upload && typeof support_upload === "object") {
    error.support_upload = Object.assign({}, support_upload);
  }
  return {
    version: 1,
    ok: false,
    error,
    exit_code: exitCodeForErrorCode(code),
  };
}

/**
 * Render the envelope as a human-readable multi-line string for the
 * `--no-json` mode. Pure.
 *
 * @param {ReturnType<typeof buildErrorEnvelope>} env
 * @returns {string}
 */
function renderHuman(env) {
  if (!env || !env.error) return "error";
  const e = env.error;
  const lines = [];
  lines.push(`error: ${e.code} — ${e.message}`);
  if (e.remediation && e.remediation.kind && e.remediation.value) {
    const prefix = e.remediation.kind === "command" ? "run" : e.remediation.kind === "url" ? "see" : "hint";
    lines.push(`  ${prefix}: ${e.remediation.value}`);
  }
  lines.push(`  support_id: ${e.support_id}`);
  if (e.support_upload) {
    if (e.support_upload.uploaded) {
      lines.push(`  log-tail uploaded${e.support_upload.url ? ` (${e.support_upload.url})` : ""}`);
    } else {
      const reason = e.support_upload.reason ? ` (${e.support_upload.reason})` : "";
      lines.push(`  log-tail NOT uploaded${reason}`);
      if (e.support_upload.command_to_upload_later) {
        lines.push(`    to upload later: ${e.support_upload.command_to_upload_later}`);
      }
    }
  }
  return lines.join("\n");
}

/**
 * Pretty-print the codes registry (for `frootai errors codes`). Pure.
 *
 * @returns {string}
 */
function renderCodesList() {
  /** @type {string[]} */
  const out = [];
  for (const c of ERROR_CODES) {
    const r = REMEDIATIONS[c];
    const ec = exitCodeForErrorCode(c);
    out.push(`${c}  exit=${ec}  ${r.kind}: ${r.value}`);
  }
  return out.join("\n");
}

/**
 * Build the upload command hint for a support_id. Pure.
 *
 * @param {string} supportId
 * @returns {string}
 */
function buildUploadCommand(supportId) {
  if (!isValidSupportId(supportId)) return "";
  return `frootai support upload ${supportId}`;
}

/**
 * Build the support_upload sub-payload for a given consent/uploader
 * combination. Pure (deps explicit). Tests pass canned uploader
 * results without touching the network.
 *
 * @param {object} args
 * @param {string} args.support_id
 * @param {string[]} args.tail
 * @param {boolean} args.consented — telemetry consent recorded?
 * @param {boolean} args.noUpload — `--no-upload` flag passed?
 * @param {(opts: {support_id: string, tail: string[]}) => {ok: boolean, url?: string, reason?: string}|null} [args.uploader]
 * @returns {{uploaded: boolean, reason?: string, url?: string, command_to_upload_later?: string}}
 */
function decideSupportUpload(args) {
  const { support_id, tail, consented, noUpload, uploader } = args || /** @type {*} */ ({});
  if (noUpload) {
    return { uploaded: false, reason: "no_upload_flag", command_to_upload_later: buildUploadCommand(support_id) };
  }
  if (!consented) {
    return { uploaded: false, reason: "telemetry_not_consented", command_to_upload_later: buildUploadCommand(support_id) };
  }
  if (typeof uploader !== "function") {
    return { uploaded: false, reason: "endpoint_unreachable", command_to_upload_later: buildUploadCommand(support_id) };
  }
  let result;
  try { result = uploader({ support_id, tail: Array.isArray(tail) ? tail : [] }); }
  catch (err) {
    return { uploaded: false, reason: "uploader_threw", command_to_upload_later: buildUploadCommand(support_id) };
  }
  if (!result || !result.ok) {
    const reason = result && result.reason ? String(result.reason) : "upload_failed";
    return { uploaded: false, reason, command_to_upload_later: buildUploadCommand(support_id) };
  }
  /** @type {*} */
  const out = { uploaded: true };
  if (result.url) out.url = String(result.url);
  return out;
}

/**
 * Create a stateful error reporter instance. The reporter owns the
 * tail buffer + threads the support_upload + render decision.
 *
 * @param {object} [opts]
 * @param {number} [opts.capacity]
 * @param {string} [opts.homedir]
 * @param {object} [deps]
 * @param {() => string} [deps.generateSupportId]
 * @param {() => boolean} [deps.consented]
 * @param {(opts: {support_id: string, tail: string[]}) => {ok: boolean, url?: string, reason?: string}|null} [deps.uploader]
 * @returns {object}
 */
function createErrorReporter(opts, deps) {
  const o = opts || {};
  const d = deps || {};
  const tail = new LogTailBuffer({ capacity: o.capacity, homedir: o.homedir });
  const gen = typeof d.generateSupportId === "function" ? d.generateSupportId : () => generateSupportId({});
  const consentedFn = typeof d.consented === "function" ? d.consented : () => false;

  return {
    tail,

    /** @param {string} line */
    captureLine(line) { tail.push(line); },

    /**
     * @param {object} args
     * @param {string} args.code
     * @param {string} args.message
     * @param {{kind: string, value: string}} [args.remediationOverride]
     * @param {boolean} [args.noUpload]
     * @returns {ReturnType<typeof buildErrorEnvelope>}
     */
    report(args) {
      const support_id = gen();
      const upload = decideSupportUpload({
        support_id,
        tail: tail.snapshot(),
        consented: Boolean(consentedFn()),
        noUpload: Boolean(args && args.noUpload),
        uploader: d.uploader,
      });
      return buildErrorEnvelope({
        code: args.code,
        message: args.message,
        support_id,
        remediationOverride: args.remediationOverride,
        support_upload: upload,
      });
    },
  };
}

/**
 * Demo runner: rounds-trips a fake error of the given code. Returns
 * the sysexits exit code.
 *
 * @param {string[]} argv
 * @param {object} [ctx]
 * @param {object} [deps]
 * @param {(s: string) => void} [deps.write] — stderr
 * @param {(s: string) => void} [deps.writeLn] — stdout
 * @param {() => string} [deps.generateSupportId]
 * @param {() => boolean} [deps.consented]
 * @param {(opts: {support_id: string, tail: string[]}) => {ok: boolean, url?: string, reason?: string}|null} [deps.uploader]
 * @returns {Promise<number>}
 */
async function runWithDeps(argv, ctx, deps) {
  const d = deps || {};
  const writeErr = typeof d.write === "function" ? d.write : (s) => { process.stderr.write(s); };
  const writeLn = typeof d.writeLn === "function" ? d.writeLn : (s) => { process.stdout.write(String(s) + "\n"); };

  let parsed;
  try { parsed = parseErrorsArgs(argv); }
  catch (err) {
    const m = err && err.message ? err.message : String(err);
    writeErr(`error: ${m}\n`);
    writeErr(buildHelp() + "\n");
    return EXIT.USAGE;
  }
  if (parsed.help) { writeLn(buildHelp()); return EXIT.OK; }
  if (parsed.subcommand === null) {
    writeErr("error: missing subcommand\n");
    writeErr(buildHelp() + "\n");
    return EXIT.USAGE;
  }
  if (parsed.subcommand === "codes") {
    if (parsed.json) {
      const obj = ERROR_CODES.map((c) => ({
        code: c,
        exit_code: exitCodeForErrorCode(c),
        remediation: remediationForCode(c),
      }));
      writeLn(JSON.stringify(obj));
    } else {
      writeLn(renderCodesList());
    }
    return EXIT.OK;
  }
  if (parsed.subcommand === "upload") {
    // Placeholder until bin-reconciliation wires the real uploader.
    if (parsed.json) {
      writeLn(JSON.stringify({ version: 1, ok: false, support_id: parsed.supportId, reason: "upload_handler_not_yet_wired" }));
    } else {
      writeErr(`upload handler not yet wired; quote support_id=${parsed.supportId} to support directly\n`);
    }
    return EXIT.UNAVAILABLE;
  }
  // demo
  const reporter = createErrorReporter({}, {
    generateSupportId: d.generateSupportId,
    consented: d.consented,
    uploader: d.uploader,
  });
  // Seed the tail with a couple of fake lines so the envelope is realistic.
  reporter.captureLine(`[demo] running 'errors demo ${parsed.code}'`);
  reporter.captureLine(`[demo] argv: ${JSON.stringify(argv)}`);
  const env = reporter.report({
    code: /** @type {string} */ (parsed.code),
    message: `demo error: ${parsed.code}`,
    noUpload: parsed.noUpload,
  });
  if (parsed.debug) {
    writeErr(`-- tail (${reporter.tail.size} lines) --\n`);
    for (const ln of reporter.tail.snapshot()) writeErr(ln + "\n");
    writeErr(`-- end tail --\n`);
  }
  if (parsed.json) {
    writeLn(JSON.stringify(env));
  } else {
    writeErr(renderHuman(env) + "\n");
  }
  return env.exit_code;
}

function run(argv, ctx) { return runWithDeps(argv, ctx, {}); }

module.exports = {
  EXIT,
  ERROR_CODES,
  EXIT_FOR_CODE,
  REMEDIATIONS,
  DOCS_BASE,
  SUBCOMMANDS,
  VALUE_FLAGS,
  BOOL_FLAGS,
  SUPPORT_ID_BYTES,
  DEFAULT_TAIL_CAPACITY,
  ErrorReporterError,
  LogTailBuffer,
  parseErrorsArgs,
  buildHelp,
  isValidSupportId,
  generateSupportId,
  exitCodeForErrorCode,
  remediationForCode,
  redactLine,
  buildErrorEnvelope,
  renderHuman,
  renderCodesList,
  buildUploadCommand,
  decideSupportUpload,
  createErrorReporter,
  runWithDeps,
  run,
};
