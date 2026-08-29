// @ts-check
/**
 * [H8.20] signtool-windows.js — Windows EV code-signing library.
 *
 * Contract (verbatim from masterplan §3 row [H8.20]):
 *   Windows code-signing: standalone binary signed with EV cert from
 *   DigiCert / Sectigo; SmartScreen reputation built post-launch
 *
 * Pure command-builder library (mirror of H8.19 notarize-macos.js).
 * No shelling out, no side effects. The CI workflow consumes the argv
 * arrays returned here and executes them on a `windows-latest` runner.
 *
 * **The 3-step Windows signing pipeline** (Microsoft-canonical order):
 *   1. `signtool sign /tr <rfc3161-url> /td sha256 /fd sha256
 *      /sha1 <cert-thumbprint> /d "<description>" /du "<info-url>"
 *      <binary>.exe`
 *      — embeds the Authenticode signature (SHA-256 file digest) into
 *        the PE binary + counter-signs with an RFC 3161 timestamp so
 *        the signature stays valid after the cert expires.
 *      — `/sha1 <thumbprint>` selects the EV cert by its 40-char hex
 *        thumbprint (the EV private key lives in a Windows certificate
 *        store on the runner; for HSM-backed EV certs the operator
 *        imports via a CSP plugin first — same `/sha1` selector works).
 *   2. `signtool verify /pa /v <binary>.exe`
 *      — round-trips the signature in the same job so a broken signing
 *        ceremony fails BEFORE the workflow marks success.
 *      — `/pa` uses the Default Authentication Policy (the same one
 *        SmartScreen + Windows Defender consult); `/v` verbose.
 *   3. (Optional) `signtool timestamp /tr <url> /td sha256 <binary>.exe`
 *      — only needed if a separate timestamp step is required (most EV
 *        signing flows do timestamp inline in step 1; this is a safety
 *        net for any future re-timestamp flow).
 *
 * **EV-cert posture:** the row pins **DigiCert / Sectigo** as the
 * accepted CAs. Both issue EV code-signing certs as either:
 *   (a) USB hardware token + Windows CSP driver (older flow, requires
 *       a physical token plugged into a self-hosted runner — NOT
 *       supported here; we use GitHub-hosted runners), OR
 *   (b) Cloud HSM + RFC-3161 + remote-signing API (newer flow:
 *       DigiCert KeyLocker / Sectigo Cloud Code Signing) — the runner
 *       authenticates via API key + the actual private key never
 *       leaves the HSM. This is what we target.
 *
 * The library doesn't bake in the HSM choice; the workflow supplies
 * one of two cert sources via `--cert-thumbprint` (already in store)
 * OR `--cert-file` (PKCS#12/PFX path — for non-HSM dev signing only,
 * NEVER for production).
 *
 * **Public API:**
 *   - `WINDOWS_TARGETS` — frozen 1-entry array (frootai-windows-x64.exe)
 *   - `REQUIRED_SECRETS` — frozen list of env var names
 *   - `DEFAULT_TIMESTAMP_URL` — DigiCert's RFC 3161 timestamp URL
 *   - `DEFAULT_DESCRIPTION` — "FrootAI CLI" (shows in UAC prompts)
 *   - `DEFAULT_INFO_URL` — "https://frootai.dev"
 *   - `SHA1_THUMBPRINT_PATTERN` — `/^[A-Fa-f0-9]{40}$/`
 *   - `applicableTargets()` — returns WINDOWS_TARGETS
 *   - `validateSecrets(env)` → `{ok, missing[], present[]}`
 *   - `validateThumbprint(value)` → `{ok, error?}` — case-insensitive
 *     40-char hex
 *   - `buildSigntoolSignCommand({binary, certThumbprint?, certFile?,
 *      certPassword?, description?, infoUrl?, timestampUrl?})` —
 *     returns argv[]; supports BOTH thumbprint mode (production EV
 *     via Windows store) AND PFX-file mode (dev/test only)
 *   - `buildSigntoolVerifyCommand({binary, verbose?})` — `/pa /v`
 *   - `buildSigntoolTimestampCommand({binary, timestampUrl?})` —
 *     optional re-timestamp
 *   - `buildFullPipeline({binary, ...})` — returns 2-or-3 step plan
 *     as `[{step, argv}, ...]` array
 *   - `parseSigntoolVerifyOutput(stdout)` — pure; extracts
 *     `Successfully verified` / `SignTool Error` from verify stdout
 *   - `buildSmartScreenNotice(opts)` — pure; formats the operator
 *     notice that SmartScreen reputation needs ~50-100 user installs
 *     before the "Unrecognized publisher" warning subsides
 *
 * License: CC0-1.0.
 */
"use strict";

const path = require("node:path");

/**
 * The 1 Windows target from H8.18 BUILD_TARGETS that needs signing.
 * Pinned independently (loose coupling per H8.19 doctrine — H8.20
 * owns its own copy so a future ship adding `frootai-windows-arm64`
 * doesn't need to touch H8.18).
 */
const WINDOWS_TARGETS = Object.freeze([
  Object.freeze({
    name: "frootai-windows-x64",
    arch: "x64",
    runner: "windows-latest",
    extension: ".exe",
  }),
]);

/**
 * Required environment variables for the CI workflow. The thumbprint
 * mode is preferred (the EV private key stays in the runner's Windows
 * certificate store, never serialized as a workflow secret); the PFX
 * mode requires `WINDOWS_CERT_PFX_B64` + `WINDOWS_CERT_PFX_PASSWORD`
 * (NOT in this list — those gate the PFX-mode branch in the workflow).
 */
const REQUIRED_SECRETS = Object.freeze([
  "WINDOWS_CERT_THUMBPRINT",
]);

/** DigiCert's RFC 3161 timestamp URL (works for both DigiCert + Sectigo). */
const DEFAULT_TIMESTAMP_URL = "http://timestamp.digicert.com";

/** Shows in UAC dialogs + the `Get-AuthenticodeSignature` output. */
const DEFAULT_DESCRIPTION = "FrootAI CLI";

/** "More info" URL embedded in the signature. */
const DEFAULT_INFO_URL = "https://frootai.dev";

/** EV-cert thumbprint: 40-char hex (SHA-1 fingerprint of the cert). */
const SHA1_THUMBPRINT_PATTERN = /^[A-Fa-f0-9]{40}$/;

/** Error carrying a sysexits exit code. */
class SigntoolWindowsError extends Error {
  /**
   * @param {string} code @param {string} message
   * @param {{ exitCode?: number, cause?: Error }} [opts]
   */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "SigntoolWindowsError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : 70;
    if (opts.cause) this.cause = opts.cause;
  }
}

/** Pure — returns the 1-entry WINDOWS_TARGETS list. Future-proof seam. */
function applicableTargets() {
  return WINDOWS_TARGETS;
}

/**
 * Pure — check `env` for the required secrets. Returns
 * `{ok, missing[], present[]}`. When `--cert-file` mode is used
 * (dev/test only), the caller bypasses this check via a separate
 * `validatePfxSecrets` branch (not implemented here — workflow opts in).
 *
 * @param {Record<string, string|undefined>|null|undefined} env
 */
function validateSecrets(env) {
  const e = env || {};
  /** @type {string[]} */
  const missing = [];
  /** @type {string[]} */
  const present = [];
  for (const key of REQUIRED_SECRETS) {
    const v = e[key];
    if (typeof v === "string" && v.length > 0) present.push(key);
    else missing.push(key);
  }
  return { ok: missing.length === 0, missing, present };
}

/**
 * Pure — validate a SHA-1 thumbprint string (case-insensitive 40-char
 * hex). Returns `{ok, error?}`. Spaces are NOT allowed (some Windows
 * UIs display thumbprints with spaces — callers should strip them
 * before passing to this validator).
 *
 * @param {string|null|undefined} value
 */
function validateThumbprint(value) {
  if (typeof value !== "string") {
    return { ok: false, error: `thumbprint must be a string (got ${typeof value})` };
  }
  if (value.length === 0) {
    return { ok: false, error: "thumbprint must not be empty" };
  }
  if (!SHA1_THUMBPRINT_PATTERN.test(value)) {
    return { ok: false, error: `thumbprint must be 40 hex chars (got ${value.length} chars: "${value}")` };
  }
  return { ok: true };
}

/**
 * Pure — build the `signtool sign` argv. Two mutually-exclusive cert
 * sources: `certThumbprint` (production EV via Windows certificate
 * store; preferred) OR `certFile`+`certPassword` (PFX file; dev/test
 * only). Always emits `/tr <rfc3161-url>` + `/td sha256` + `/fd sha256`
 * so the signature stays valid past cert expiry + uses the SHA-256
 * file digest (Authenticode 2008+).
 *
 * @param {object} opts
 * @param {string} opts.binary — path to the .exe
 * @param {string} [opts.certThumbprint] — 40-char hex SHA-1
 * @param {string} [opts.certFile] — path to .pfx
 * @param {string} [opts.certPassword] — required when certFile is set
 * @param {string} [opts.description] — default DEFAULT_DESCRIPTION
 * @param {string} [opts.infoUrl] — default DEFAULT_INFO_URL
 * @param {string} [opts.timestampUrl] — default DEFAULT_TIMESTAMP_URL
 * @returns {string[]} signtool argv
 */
function buildSigntoolSignCommand(opts) {
  const o = opts || {};
  if (typeof o.binary !== "string" || o.binary.length === 0) {
    throw new SigntoolWindowsError("invalid_binary", "buildSigntoolSignCommand requires opts.binary", { exitCode: 64 });
  }
  const hasThumb = typeof o.certThumbprint === "string" && o.certThumbprint.length > 0;
  const hasFile = typeof o.certFile === "string" && o.certFile.length > 0;
  if (!hasThumb && !hasFile) {
    throw new SigntoolWindowsError("missing_cert", "buildSigntoolSignCommand requires either certThumbprint or certFile", { exitCode: 64 });
  }
  if (hasThumb && hasFile) {
    throw new SigntoolWindowsError("conflicting_cert", "buildSigntoolSignCommand: certThumbprint and certFile are mutually exclusive", { exitCode: 64 });
  }
  if (hasThumb) {
    const v = validateThumbprint(o.certThumbprint);
    if (!v.ok) throw new SigntoolWindowsError("invalid_thumbprint", v.error, { exitCode: 64 });
  }
  if (hasFile && (typeof o.certPassword !== "string" || o.certPassword.length === 0)) {
    throw new SigntoolWindowsError("missing_pfx_password", "certFile mode requires certPassword", { exitCode: 64 });
  }

  const description = typeof o.description === "string" && o.description.length > 0
    ? o.description : DEFAULT_DESCRIPTION;
  const infoUrl = typeof o.infoUrl === "string" && o.infoUrl.length > 0
    ? o.infoUrl : DEFAULT_INFO_URL;
  const timestampUrl = typeof o.timestampUrl === "string" && o.timestampUrl.length > 0
    ? o.timestampUrl : DEFAULT_TIMESTAMP_URL;

  /** @type {string[]} */
  const argv = ["sign", "/tr", timestampUrl, "/td", "sha256", "/fd", "sha256"];
  if (hasThumb) {
    argv.push("/sha1", String(o.certThumbprint));
  } else {
    argv.push("/f", String(o.certFile), "/p", String(o.certPassword));
  }
  argv.push("/d", description, "/du", infoUrl, o.binary);
  return argv;
}

/**
 * Pure — `signtool verify /pa /v <binary>`. `/pa` uses the Default
 * Authentication Policy (same one SmartScreen + Windows Defender
 * consult); `/v` verbose so we get the full chain in the stdout
 * (parsed by `parseSigntoolVerifyOutput`).
 *
 * @param {object} opts — `{binary, verbose?}`
 * @returns {string[]}
 */
function buildSigntoolVerifyCommand(opts) {
  const o = opts || {};
  if (typeof o.binary !== "string" || o.binary.length === 0) {
    throw new SigntoolWindowsError("invalid_binary", "buildSigntoolVerifyCommand requires opts.binary", { exitCode: 64 });
  }
  /** @type {string[]} */
  const argv = ["verify", "/pa"];
  if (o.verbose !== false) argv.push("/v");
  argv.push(o.binary);
  return argv;
}

/**
 * Pure — optional `signtool timestamp /tr <url> /td sha256 <binary>`.
 * Use ONLY when re-timestamping a previously-signed binary (e.g.
 * after the original timestamp authority's cert has expired). The
 * main sign step already timestamps inline via `/tr`.
 *
 * @param {object} opts — `{binary, timestampUrl?}`
 * @returns {string[]}
 */
function buildSigntoolTimestampCommand(opts) {
  const o = opts || {};
  if (typeof o.binary !== "string" || o.binary.length === 0) {
    throw new SigntoolWindowsError("invalid_binary", "buildSigntoolTimestampCommand requires opts.binary", { exitCode: 64 });
  }
  const timestampUrl = typeof o.timestampUrl === "string" && o.timestampUrl.length > 0
    ? o.timestampUrl : DEFAULT_TIMESTAMP_URL;
  return ["timestamp", "/tr", timestampUrl, "/td", "sha256", o.binary];
}

/**
 * Pure — build the full sign+verify pipeline as `[{step, argv}, ...]`.
 * The workflow runs each step in order; failure of any step aborts
 * the rest (Microsoft's recommendation: NEVER ship a signed binary
 * without a round-trip verify).
 *
 * @param {object} opts — passed through to buildSigntoolSignCommand
 * @returns {Array<{step: string, argv: string[]}>}
 */
function buildFullPipeline(opts) {
  return [
    { step: "sign", argv: buildSigntoolSignCommand(opts) },
    { step: "verify", argv: buildSigntoolVerifyCommand({ binary: opts.binary, verbose: true }) },
  ];
}

/**
 * Pure — parse signtool's verify stdout into a status envelope.
 * signtool emits `Successfully verified: <path>` on success;
 * `SignTool Error: <details>` on any failure. Both can appear in the
 * same stdout when verifying multiple binaries — we return an array
 * of statuses.
 *
 * @param {string|null|undefined} stdout
 * @returns {{ ok: boolean, verified: string[], errors: string[] }}
 */
function parseSigntoolVerifyOutput(stdout) {
  if (typeof stdout !== "string") {
    return { ok: false, verified: [], errors: ["signtool verify produced no output"] };
  }
  /** @type {string[]} */
  const verified = [];
  /** @type {string[]} */
  const errors = [];
  const lines = stdout.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const okMatch = /^Successfully verified:\s*(.+)$/i.exec(trimmed);
    if (okMatch) { verified.push(okMatch[1].trim()); continue; }
    const errMatch = /^SignTool Error:\s*(.+)$/i.exec(trimmed);
    if (errMatch) { errors.push(errMatch[1].trim()); continue; }
  }
  return {
    ok: verified.length > 0 && errors.length === 0,
    verified,
    errors,
  };
}

/**
 * Pure — build the operator notice about SmartScreen reputation. The
 * masterplan row pins "SmartScreen reputation built post-launch" as
 * an explicit expectation: a freshly-signed EV binary still triggers
 * the "Unrecognized publisher" SmartScreen warning until ~50-100
 * unique users have downloaded + run it. The notice is meant for the
 * release-announcement blog post + the install-clients docs.
 *
 * @param {object} [opts] — `{thresholdUsers?, certCa?}`
 */
function buildSmartScreenNotice(opts = {}) {
  const threshold = Number.isInteger(opts.thresholdUsers) && opts.thresholdUsers > 0
    ? opts.thresholdUsers : 100;
  const ca = typeof opts.certCa === "string" && opts.certCa.length > 0
    ? opts.certCa : "DigiCert/Sectigo";
  return [
    "Note: this Windows binary is signed with a Microsoft-trusted EV code-signing certificate",
    `(issued by ${ca}). On the first ~${threshold} downloads, Windows SmartScreen may still`,
    'display "Windows protected your PC". This is normal: SmartScreen reputation is',
    "accumulated per-publisher over time, not granted at signing. Click 'More info' →",
    "'Run anyway' to proceed. Subsequent versions sign with the same EV cert + accumulate",
    "reputation cumulatively.",
  ].join("\n");
}

module.exports = {
  WINDOWS_TARGETS,
  REQUIRED_SECRETS,
  DEFAULT_TIMESTAMP_URL,
  DEFAULT_DESCRIPTION,
  DEFAULT_INFO_URL,
  SHA1_THUMBPRINT_PATTERN,
  SigntoolWindowsError,
  applicableTargets,
  validateSecrets,
  validateThumbprint,
  buildSigntoolSignCommand,
  buildSigntoolVerifyCommand,
  buildSigntoolTimestampCommand,
  buildFullPipeline,
  parseSigntoolVerifyOutput,
  buildSmartScreenNotice,
};
