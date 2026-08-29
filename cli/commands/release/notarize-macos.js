// @ts-check
/**
 * [H8.19] notarize-macos.js — macOS sign + notarize + staple library.
 *
 * Contract (verbatim from masterplan §3 row [H8.19]):
 *   macOS notarization: standalone binary signed + notarized + stapled
 *   via `notarytool`; `frootai-macos-arm64` opens without Gatekeeper
 *   warning
 *
 * Pure command-builder library — no shelling out, no side effects. The
 * CI workflow consumes the argv arrays returned here and executes them
 * on a `macos-14` / `macos-13` runner. Same shape contract as H8.18
 * `build-binaries.js`: the workflow stays a thin orchestrator, the
 * library is the testable single-source-of-truth for "what command do
 * we run to notarize this binary".
 *
 * **The 4-step macOS hardening pipeline** (Apple-canonical order):
 *   1. `codesign --force --options runtime --timestamp --sign
 *      "Developer ID Application: <team>" <binary>`
 *      — applies hardened-runtime + secure timestamp, embedding the
 *        Developer ID signature into the Mach-O binary.
 *   2. `ditto -c -k --keepParent <binary> <binary>.zip`
 *      — wraps the signed binary in a ZIP for upload (notarytool wants
 *        ZIP/PKG/DMG, not raw Mach-O).
 *   3. `xcrun notarytool submit <binary>.zip --apple-id <id>
 *      --team-id <team> --password <app-specific> --wait`
 *      — submits to Apple's notary service + blocks until "Accepted" or
 *        "Invalid" (the `--wait` keeps CI synchronous). On Invalid,
 *        Apple returns a submission UUID that the operator runs
 *        `notarytool log <uuid>` against for the rejection reason.
 *   4. `xcrun stapler staple <binary>`
 *      — embeds the notarization ticket INTO the binary so it works
 *        offline (without it, Gatekeeper has to round-trip Apple's
 *        server on first launch, which still warns over slow links).
 *
 * **Two-binary scope:** the row only mentions `frootai-macos-arm64` in
 * the Gatekeeper claim, but `applicableTargets()` returns both
 * arm64 + x64 — Apple notarizes per-binary, and shipping a notarized
 * arm64 alongside an unnotarized x64 would be inconsistent (the x64
 * user gets a "untrusted developer" alert on first launch). The CI
 * workflow runs the full pipeline against BOTH macOS targets in
 * parallel.
 *
 * **Required secrets** (set in GitHub repo settings, surface via env
 * in the workflow): `APPLE_ID` (the email of the Developer Account),
 * `APPLE_TEAM_ID` (10-char alphanumeric), `APPLE_APP_PASSWORD`
 * (app-specific password generated at appleid.apple.com), and one of
 * either `APPLE_CERT_P12_B64` + `APPLE_CERT_P12_PASSWORD` (the
 * Developer ID Application certificate exported as a base64 PKCS#12)
 * OR `MACOS_KEYCHAIN_*` for the keychain-import path. The library
 * does NOT touch secrets — `validateSecrets(env)` just reports which
 * are missing so the workflow can fail fast with a clear message.
 *
 * **Public API:**
 *   - `MACOS_TARGETS` — the 2 names from H8.18 BUILD_TARGETS (arm64 + x64)
 *   - `applicableTargets()` — same as `MACOS_TARGETS`; future-proof seam
 *   - `REQUIRED_SECRETS` — frozen list of env var names
 *   - `validateSecrets(env)` → `{ok, missing[], present[]}`
 *   - `buildCodesignCommand({binary, signingIdentity, entitlements?})`
 *   - `buildZipCommand({binary, zipPath?})` — wraps binary in ZIP for
 *     notarytool submission
 *   - `buildNotarytoolSubmitCommand({zipPath, appleId, teamId,
 *      keychainProfile?, password?})` — supports BOTH the
 *      keychain-profile mode (preferred for repeated runs) and the
 *      raw-password mode (for one-shot CI)
 *   - `buildStapleCommand({binary})`
 *   - `buildFullPipeline({binary, signingIdentity, appleId, teamId,
 *      password?, keychainProfile?})` — returns the 4-step plan as an
 *      array of `{step, argv}` entries the workflow runs in order
 *   - `parseNotarytoolOutput(stdout)` — pure; extracts submission UUID
 *     + status from `xcrun notarytool submit` output (the format is
 *     `id: <uuid>\n  ...status: Accepted\n  ...`)
 *   - `buildVerificationCommand({binary})` — `spctl -a -vv` to confirm
 *     Gatekeeper accepts the stapled binary
 *
 * License: CC0-1.0.
 */
"use strict";

const path = require("node:path");

/**
 * The 2 macOS targets from H8.18 BUILD_TARGETS that need notarization.
 * Pinned independently here so this library doesn't import H8.18
 * (loose coupling — the matrix is the SAME data, but H8.19 owns its
 * own copy so a future ship can add per-target notarization quirks
 * like different entitlements per arch).
 */
const MACOS_TARGETS = Object.freeze([
  Object.freeze({ name: "frootai-macos-arm64", arch: "arm64", runner: "macos-14" }),
  Object.freeze({ name: "frootai-macos-x64",   arch: "x64",   runner: "macos-13" }),
]);

/** Required environment variables for the CI workflow. */
const REQUIRED_SECRETS = Object.freeze([
  "APPLE_ID",
  "APPLE_TEAM_ID",
  "APPLE_APP_PASSWORD",
]);

/**
 * Apple team-ID format: 10-character alphanumeric (uppercase letters +
 * digits). E.g. `ABCDE12345`. Used at validate-time so a fat-fingered
 * secret fails the workflow at preflight instead of after the codesign
 * step runs.
 */
const TEAM_ID_PATTERN = /^[A-Z0-9]{10}$/;

/** Default name of the keychain-stored notarytool credential profile. */
const DEFAULT_KEYCHAIN_PROFILE = "frootai-notarize";

/** Default Developer ID Application identity suffix (prefix is the team-id
 *  prepended at runtime — Apple's full form is "Developer ID Application:
 *  <Team Name> (<TEAM_ID>)"). */
const DEFAULT_SIGNING_IDENTITY_PREFIX = "Developer ID Application";

/** Error carrying a sysexits exit code. */
class NotarizeError extends Error {
  /**
   * @param {string} code @param {string} message
   * @param {{ exitCode?: number, cause?: Error }} [opts]
   */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "NotarizeError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : 70;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Return the MACOS_TARGETS list. Future-proof seam — a future ship can
 * filter by `arch` if/when we add `frootai-macos-x64-server` etc.
 *
 * @returns {ReadonlyArray<{name: string, arch: string, runner: string}>}
 */
function applicableTargets() {
  return MACOS_TARGETS;
}

/**
 * Pure — check the env for the REQUIRED_SECRETS. Returns
 * `{ok, missing[], present[]}`. Empty-string values count as missing.
 *
 * @param {Record<string,string|undefined>|null|undefined} env
 * @returns {{ ok: boolean, missing: string[], present: string[] }}
 */
function validateSecrets(env) {
  const e = env || {};
  const missing = [];
  const present = [];
  for (const k of REQUIRED_SECRETS) {
    const v = e[k];
    if (typeof v === "string" && v.length > 0) present.push(k);
    else missing.push(k);
  }
  return { ok: missing.length === 0, missing, present };
}

/**
 * Pure — true when the value matches Apple's 10-character team-id shape.
 *
 * @param {string|null|undefined} teamId
 * @returns {boolean}
 */
function isValidTeamId(teamId) {
  return typeof teamId === "string" && TEAM_ID_PATTERN.test(teamId);
}

/**
 * Pure — build the canonical signing-identity string given a team-id +
 * optional team-name. Apple's exact format is:
 *   "Developer ID Application: <Team Name> (<TEAM_ID>)"
 * When teamName is omitted, returns the form keychain accepts via just
 * the team-id wildcard: "Developer ID Application: (<TEAM_ID>)".
 *
 * @param {string} teamId @param {string} [teamName]
 * @returns {string}
 */
function buildSigningIdentity(teamId, teamName) {
  if (!isValidTeamId(teamId)) {
    throw new NotarizeError("bad_team_id", `team-id must match ${TEAM_ID_PATTERN} (got "${teamId}")`, { exitCode: 64 });
  }
  if (typeof teamName === "string" && teamName.length > 0) {
    return `${DEFAULT_SIGNING_IDENTITY_PREFIX}: ${teamName} (${teamId})`;
  }
  return `${DEFAULT_SIGNING_IDENTITY_PREFIX}: (${teamId})`;
}

/**
 * Build the `codesign` argv. The CI runs this as `codesign ${argv.join(" ")}`.
 *
 * Pinned flags:
 *   `--force`         — overwrite any existing signature
 *   `--options runtime` — enable hardened runtime (REQUIRED for notarization)
 *   `--timestamp`     — embed Apple's secure timestamp (REQUIRED for notarization)
 *   `--sign "<id>"`   — the Developer ID Application identity
 *   [`--entitlements <plist>`] — optional, for binaries that need specific
 *                                 entitlements like JIT/file-system-access
 *
 * @param {object} opts — `{binary, signingIdentity, entitlements?}`
 * @returns {string[]}
 */
function buildCodesignCommand(opts) {
  const { binary, signingIdentity, entitlements } = opts || {};
  if (typeof binary !== "string" || binary.length === 0) {
    throw new NotarizeError("bad_binary", "buildCodesignCommand requires opts.binary", { exitCode: 64 });
  }
  if (typeof signingIdentity !== "string" || signingIdentity.length === 0) {
    throw new NotarizeError("bad_identity", "buildCodesignCommand requires opts.signingIdentity", { exitCode: 64 });
  }
  /** @type {string[]} */
  const argv = ["--force", "--options", "runtime", "--timestamp", "--sign", signingIdentity];
  if (typeof entitlements === "string" && entitlements.length > 0) {
    argv.push("--entitlements", entitlements);
  }
  argv.push(binary);
  return argv;
}

/**
 * Build the `ditto` argv to wrap a signed binary in a ZIP for notarytool
 * submission. The default zipPath is `<binary>.zip` alongside the
 * binary.
 *
 * @param {object} opts — `{binary, zipPath?}`
 * @returns {{ zipPath: string, argv: string[] }}
 */
function buildZipCommand(opts) {
  const { binary, zipPath } = opts || {};
  if (typeof binary !== "string" || binary.length === 0) {
    throw new NotarizeError("bad_binary", "buildZipCommand requires opts.binary", { exitCode: 64 });
  }
  const out = typeof zipPath === "string" && zipPath.length > 0
    ? zipPath
    : `${binary}.zip`;
  return {
    zipPath: out,
    argv: ["-c", "-k", "--keepParent", binary, out],
  };
}

/**
 * Build the `xcrun notarytool submit` argv. Supports BOTH auth modes:
 *   - `keychainProfile` (preferred for local dev + repeated runs): the
 *     workflow runs `notarytool store-credentials <profile> --apple-id
 *     <id> --team-id <team> --password <pw>` ONCE per runner, then
 *     subsequent submits just say `--keychain-profile <profile>`.
 *   - `password` (single-shot CI): pass `--apple-id`, `--team-id`,
 *     `--password` directly. Caller MUST set the secret via env (CI
 *     runner inlines from GitHub secret) — never log this argv with
 *     password to stdout.
 *
 * Always includes `--wait` so the workflow blocks until Apple returns
 * a verdict (otherwise we'd have to poll separately).
 *
 * @param {object} opts — `{zipPath, appleId?, teamId?, keychainProfile?, password?}`
 * @returns {string[]}
 */
function buildNotarytoolSubmitCommand(opts) {
  const { zipPath, appleId, teamId, keychainProfile, password } = opts || {};
  if (typeof zipPath !== "string" || zipPath.length === 0) {
    throw new NotarizeError("bad_zip", "buildNotarytoolSubmitCommand requires opts.zipPath", { exitCode: 64 });
  }
  /** @type {string[]} */
  const argv = ["notarytool", "submit", zipPath, "--wait"];
  if (typeof keychainProfile === "string" && keychainProfile.length > 0) {
    argv.push("--keychain-profile", keychainProfile);
    return argv;
  }
  // Raw-password mode requires all three.
  if (typeof appleId !== "string" || appleId.length === 0 ||
      !isValidTeamId(teamId) ||
      typeof password !== "string" || password.length === 0) {
    throw new NotarizeError(
      "missing_auth",
      "buildNotarytoolSubmitCommand requires either keychainProfile OR all of {appleId, teamId, password}",
      { exitCode: 64 },
    );
  }
  argv.push("--apple-id", appleId);
  argv.push("--team-id", teamId);
  argv.push("--password", password);
  return argv;
}

/**
 * Build the `xcrun notarytool store-credentials` argv — used ONCE per
 * runner to import the secret into a keychain-profile (preferred to
 * passing password as a literal argv item which leaks into ps(1)).
 *
 * @param {object} opts — `{profile?, appleId, teamId, password}`
 * @returns {string[]}
 */
function buildStoreCredentialsCommand(opts) {
  const { profile, appleId, teamId, password } = opts || {};
  if (typeof appleId !== "string" || appleId.length === 0 ||
      !isValidTeamId(teamId) ||
      typeof password !== "string" || password.length === 0) {
    throw new NotarizeError(
      "missing_auth",
      "buildStoreCredentialsCommand requires {appleId, teamId, password}",
      { exitCode: 64 },
    );
  }
  const p = typeof profile === "string" && profile.length > 0 ? profile : DEFAULT_KEYCHAIN_PROFILE;
  return [
    "notarytool", "store-credentials", p,
    "--apple-id", appleId,
    "--team-id", teamId,
    "--password", password,
  ];
}

/**
 * Build the `xcrun stapler staple` argv — embeds the notarization
 * ticket INTO the binary so Gatekeeper accepts it offline.
 *
 * @param {object} opts — `{binary}`
 * @returns {string[]}
 */
function buildStapleCommand(opts) {
  const { binary } = opts || {};
  if (typeof binary !== "string" || binary.length === 0) {
    throw new NotarizeError("bad_binary", "buildStapleCommand requires opts.binary", { exitCode: 64 });
  }
  return ["stapler", "staple", binary];
}

/**
 * Build the `spctl -a -vv` argv — verifies Gatekeeper will accept the
 * stapled binary. The workflow runs this as a smoke test AFTER stapling
 * so we never ship a binary that would warn on first launch.
 *
 * @param {object} opts — `{binary}`
 * @returns {string[]}
 */
function buildVerificationCommand(opts) {
  const { binary } = opts || {};
  if (typeof binary !== "string" || binary.length === 0) {
    throw new NotarizeError("bad_binary", "buildVerificationCommand requires opts.binary", { exitCode: 64 });
  }
  return ["spctl", "-a", "-vv", "--type", "execute", binary];
}

/**
 * Build the FULL 4-step pipeline plan for one binary. Returns an array
 * of `{step, tool, argv}` entries in execution order. The CI runs them
 * sequentially; if any step exits non-zero, the workflow fails.
 *
 * @param {object} opts — `{binary, signingIdentity, appleId?, teamId?, password?, keychainProfile?, entitlements?, zipPath?}`
 * @returns {Array<{ step: string, tool: string, argv: string[] }>}
 */
function buildFullPipeline(opts) {
  const o = opts || {};
  if (typeof o.binary !== "string" || o.binary.length === 0) {
    throw new NotarizeError("bad_binary", "buildFullPipeline requires opts.binary", { exitCode: 64 });
  }
  if (typeof o.signingIdentity !== "string" || o.signingIdentity.length === 0) {
    throw new NotarizeError("bad_identity", "buildFullPipeline requires opts.signingIdentity", { exitCode: 64 });
  }
  /** @type {Array<{ step: string, tool: string, argv: string[] }>} */
  const plan = [];
  // 1. codesign
  plan.push({
    step: "codesign",
    tool: "codesign",
    argv: buildCodesignCommand({
      binary: o.binary,
      signingIdentity: o.signingIdentity,
      entitlements: o.entitlements,
    }),
  });
  // 2. ditto → zip
  const zip = buildZipCommand({ binary: o.binary, zipPath: o.zipPath });
  plan.push({ step: "zip", tool: "ditto", argv: zip.argv });
  // 3. notarytool submit --wait
  plan.push({
    step: "notarize",
    tool: "xcrun",
    argv: buildNotarytoolSubmitCommand({
      zipPath: zip.zipPath,
      appleId: o.appleId,
      teamId: o.teamId,
      password: o.password,
      keychainProfile: o.keychainProfile,
    }),
  });
  // 4. stapler staple
  plan.push({
    step: "staple",
    tool: "xcrun",
    argv: buildStapleCommand({ binary: o.binary }),
  });
  // 5. spctl verify (smoke test)
  plan.push({
    step: "verify",
    tool: "spctl",
    argv: buildVerificationCommand({ binary: o.binary }),
  });
  return plan;
}

/**
 * Pure — parse `xcrun notarytool submit --wait` stdout. Apple's format:
 *   Submission ID: <uuid>
 *     ...
 *     status: Accepted | Invalid | In Progress
 *
 * Returns `{ok, submissionId?, status?, error?}`. `ok` is true ONLY
 * when `status === "Accepted"` (Invalid + In Progress + missing-field
 * all map to ok:false).
 *
 * @param {string|null|undefined} stdout
 * @returns {{ ok: boolean, submissionId: string|null, status: string|null, error: string|null }}
 */
function parseNotarytoolOutput(stdout) {
  if (typeof stdout !== "string" || stdout.length === 0) {
    return { ok: false, submissionId: null, status: null, error: "empty notarytool output" };
  }
  const idMatch = /(?:^|\s)id:\s+([0-9a-fA-F-]{36})\b/.exec(stdout);
  const statusMatch = /(?:^|\s)status:\s+([A-Za-z][A-Za-z ]*?)\s*$/m.exec(stdout);
  const submissionId = idMatch ? idMatch[1] : null;
  const status = statusMatch ? statusMatch[1].trim() : null;
  if (!status) {
    return { ok: false, submissionId, status: null, error: "no status field in notarytool output" };
  }
  if (status === "Accepted") {
    return { ok: true, submissionId, status, error: null };
  }
  return { ok: false, submissionId, status, error: `notarization status: ${status}` };
}

/**
 * Build the `notarytool log <uuid>` argv — the operator runs this when
 * a submission returns Invalid, to fetch Apple's machine-readable
 * rejection-reason JSON.
 *
 * @param {object} opts — `{submissionId, outFile?, keychainProfile?}`
 * @returns {string[]}
 */
function buildLogCommand(opts) {
  const { submissionId, outFile, keychainProfile } = opts || {};
  if (typeof submissionId !== "string" || !/^[0-9a-fA-F-]{36}$/.test(submissionId)) {
    throw new NotarizeError("bad_submission_id", "buildLogCommand requires a UUID submissionId", { exitCode: 64 });
  }
  const argv = ["notarytool", "log", submissionId];
  if (typeof keychainProfile === "string" && keychainProfile.length > 0) {
    argv.push("--keychain-profile", keychainProfile);
  }
  if (typeof outFile === "string" && outFile.length > 0) {
    argv.push(outFile);
  }
  return argv;
}

module.exports = {
  MACOS_TARGETS,
  REQUIRED_SECRETS,
  TEAM_ID_PATTERN,
  DEFAULT_KEYCHAIN_PROFILE,
  DEFAULT_SIGNING_IDENTITY_PREFIX,
  NotarizeError,
  applicableTargets,
  validateSecrets,
  isValidTeamId,
  buildSigningIdentity,
  buildCodesignCommand,
  buildZipCommand,
  buildNotarytoolSubmitCommand,
  buildStoreCredentialsCommand,
  buildStapleCommand,
  buildVerificationCommand,
  buildFullPipeline,
  parseNotarytoolOutput,
  buildLogCommand,
};
