// @ts-check
/**
 * [H8.20] sign-windows.js — Windows EV code-signing library.
 *
 * Contract (verbatim from masterplan §3 row [H8.20]):
 *   Windows code-signing: standalone binary signed with EV cert from
 *   DigiCert / Sectigo; SmartScreen reputation built post-launch
 *
 * Pure command-builder library (no shelling out, no side effects) —
 * same shape contract as H8.18 build-binaries.js + H8.19 notarize-macos.js.
 * The CI workflow consumes the argv arrays returned here and runs them
 * on the `windows-latest` runner. Workflow = thin orchestrator;
 * library = testable single-source-of-truth.
 *
 * **EV-cert delivery context (per masterplan):** Microsoft's SmartScreen
 * trust signal is reputation-based — fresh EV-signed binaries STILL
 * trigger "Unrecognized app" warnings until enough installs accumulate
 * (typically 30-90 days post-launch). The signing step protects the
 * binary from tampering + ensures the signature carries through; the
 * reputation builds in production. The library doesn't try to bypass
 * SmartScreen, just produces a correctly-signed binary.
 *
 * **Three signing modes supported:**
 *
 *   1. PFX (raw certificate file): `signtool sign /f cert.pfx /p <pw>`
 *      — single-shot CI; PFX inlined from `SIGN_CERT_PFX_B64` base64
 *      secret. Lowest friction but the EV private key is exposed in
 *      cleartext on the runner during the run (unavoidable).
 *
 *   2. CertificateThumbprint (Windows cert store):
 *      `signtool sign /sha1 <thumbprint> /sm`
 *      — preferred for self-hosted Windows runners with a pre-imported
 *      EV cert. The thumbprint is a 40-char hex SHA1 of the cert; `/sm`
 *      tells signtool to read from the Local Machine store. The
 *      private key never leaves the cert store.
 *
 *   3. AzureKeyVault (DigiCert KeyLocker / cloud HSM):
 *      `AzureSignTool sign --azure-key-vault-url <url>
 *      --azure-key-vault-client-id <id>
 *      --azure-key-vault-client-secret <secret>
 *      --azure-key-vault-tenant-id <tenant>
 *      --azure-key-vault-certificate <name>`
 *      — recommended for EV certs stored in HSM. Requires
 *      AzureSignTool (https://github.com/vcsjones/AzureSignTool).
 *      The private key NEVER touches the runner.
 *
 * **Required defaults (per masterplan):**
 *   - Timestamp authority (TSA): `http://timestamp.digicert.com` (DigiCert)
 *     — without `/tr` + `/td sha256`, the signature expires when the
 *     EV cert expires (typically 3 years). With TSA, the signature
 *     remains valid forever as long as the timestamp authority's
 *     intermediate is trusted.
 *   - Digest: SHA-256 (`/fd sha256`) — Authenticode default, required
 *     for Windows 10+ trust.
 *   - Description (`/d`): `frootai CLI`. Description URL (`/du`):
 *     `https://frootai.dev` — UAC dialog shows these.
 *
 * **Public API:**
 *   - `WINDOWS_TARGETS` — the 1 binary from H8.18 (`frootai-windows-x64.exe`)
 *   - `SIGNING_MODES` — `["pfx", "thumbprint", "azure_kv"]`
 *   - `DIGICERT_TIMESTAMP_URL` — default TSA per masterplan
 *   - `SECTIGO_TIMESTAMP_URL` — alternative TSA (masterplan mentions Sectigo)
 *   - `REQUIRED_SECRETS_BY_MODE` — frozen map mode → secret names
 *   - `validateSecrets(env, mode)` → `{ok, missing[], present[], mode}`
 *   - `isValidThumbprint(thumbprint)` → 40-char hex check
 *   - `buildSigntoolCommand({binary, mode, secrets, opts?})` — builds
 *      argv for `pfx` / `thumbprint` modes
 *   - `buildAzureSignToolCommand({binary, secrets, opts?})` — separate
 *      tool, separate argv
 *   - `buildSignCommand({binary, mode, secrets, opts?})` — dispatches
 *      to the right builder based on mode
 *   - `buildVerifyCommand({binary})` — `signtool verify /pa /v <bin>`
 *   - `parseVerifyOutput(stdout)` → `{ok, signer?, subject?, sha?, error?}`
 *      checks for "Successfully verified" + extracts issuer
 *   - `buildFullPipeline({binary, mode, secrets, opts?})` — returns the
 *      2-step plan: sign + verify
 *   - `buildSmartScreenAdvisoryText(version)` — release-notes blurb
 *      explaining the reputation-build expectation per masterplan
 *
 * License: CC0-1.0.
 */
"use strict";

/**
 * The 1 Windows target from H8.18 BUILD_TARGETS that needs signing.
 * Pinned independently here so this library doesn't import H8.18
 * (loose coupling, mirrors H8.19 doctrine).
 */
const WINDOWS_TARGETS = Object.freeze([
  Object.freeze({
    name: "frootai-windows-x64.exe",
    arch: "x64",
    runner: "windows-latest",
  }),
]);

/** Three signing modes supported. */
const SIGNING_MODES = Object.freeze(["pfx", "thumbprint", "azure_kv"]);

/** Default timestamp authority — DigiCert (masterplan §3 mentions DigiCert). */
const DIGICERT_TIMESTAMP_URL = "http://timestamp.digicert.com";

/** Alternative timestamp authority — Sectigo (masterplan §3 also mentions Sectigo). */
const SECTIGO_TIMESTAMP_URL = "http://timestamp.sectigo.com";

/** Default description shown in UAC dialog. */
const DEFAULT_DESCRIPTION = "frootai CLI";

/** Default description URL shown in UAC dialog. */
const DEFAULT_DESCRIPTION_URL = "https://frootai.dev";

/** Required environment secrets per signing mode. */
const REQUIRED_SECRETS_BY_MODE = Object.freeze({
  pfx: Object.freeze(["SIGN_CERT_PFX_B64", "SIGN_CERT_PFX_PASSWORD"]),
  thumbprint: Object.freeze(["SIGN_CERT_THUMBPRINT"]),
  azure_kv: Object.freeze([
    "AZURE_KV_URL",
    "AZURE_KV_CLIENT_ID",
    "AZURE_KV_CLIENT_SECRET",
    "AZURE_KV_TENANT_ID",
    "AZURE_KV_CERT_NAME",
  ]),
});

/** SHA1 thumbprint pattern: 40 hex chars (with optional separators). */
const THUMBPRINT_PATTERN = /^[0-9A-Fa-f]{40}$/;

/** Error carrying a sysexits exit code. */
class SignWindowsError extends Error {
  /**
   * @param {string} code @param {string} message
   * @param {{ exitCode?: number, cause?: Error }} [opts]
   */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "SignWindowsError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : 70;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Pure — check env for required secrets given a signing mode. Returns
 * `{ok, mode, missing[], present[]}`. Empty-string values count as missing.
 *
 * @param {Record<string,string|undefined>|null|undefined} env
 * @param {string} mode — one of SIGNING_MODES
 * @returns {{ ok: boolean, mode: string, missing: string[], present: string[] }}
 */
function validateSecrets(env, mode) {
  if (!SIGNING_MODES.includes(mode)) {
    throw new SignWindowsError(
      "bad_mode",
      `mode must be one of: ${SIGNING_MODES.join(", ")} (got "${mode}")`,
      { exitCode: 64 },
    );
  }
  const required = REQUIRED_SECRETS_BY_MODE[mode];
  const e = env || {};
  const missing = [];
  const present = [];
  for (const k of required) {
    const v = e[k];
    if (typeof v === "string" && v.length > 0) present.push(k);
    else missing.push(k);
  }
  return { ok: missing.length === 0, mode, missing, present };
}

/** Pure — true when value is a 40-char hex SHA1 thumbprint. Tolerates
 *  spaces + colons (Windows cert store displays often include them);
 *  the library strips them before validation. */
function isValidThumbprint(thumbprint) {
  if (typeof thumbprint !== "string") return false;
  const stripped = thumbprint.replace(/[\s:]+/g, "");
  return THUMBPRINT_PATTERN.test(stripped);
}

/** Pure — canonicalise a thumbprint for signtool (strip whitespace + colons). */
function canonicalizeThumbprint(thumbprint) {
  if (!isValidThumbprint(thumbprint)) {
    throw new SignWindowsError(
      "bad_thumbprint",
      `thumbprint must be 40 hex chars (got "${thumbprint}")`,
      { exitCode: 64 },
    );
  }
  return thumbprint.replace(/[\s:]+/g, "").toUpperCase();
}

/**
 * Build the `signtool sign` argv for PFX or thumbprint modes. Common
 * flags: `/fd sha256` digest, `/tr <tsa>` + `/td sha256` for the
 * RFC 3161 timestamp (per masterplan — without timestamp, signature
 * expires with the EV cert), `/d "<desc>"` + `/du "<url>"` UAC text.
 *
 * @param {object} call — `{binary, mode, secrets, opts?}`
 * @returns {string[]}
 */
function buildSigntoolCommand(call) {
  const { binary, mode, secrets, opts } = call || {};
  if (typeof binary !== "string" || binary.length === 0) {
    throw new SignWindowsError("bad_binary", "buildSigntoolCommand requires binary", { exitCode: 64 });
  }
  if (mode !== "pfx" && mode !== "thumbprint") {
    throw new SignWindowsError(
      "bad_mode",
      `buildSigntoolCommand only handles pfx + thumbprint (got "${mode}"); use buildAzureSignToolCommand for azure_kv`,
      { exitCode: 64 },
    );
  }
  const tsa = (opts && typeof opts.timestampUrl === "string" && opts.timestampUrl.length > 0)
    ? opts.timestampUrl
    : DIGICERT_TIMESTAMP_URL;
  const desc = (opts && typeof opts.description === "string" && opts.description.length > 0)
    ? opts.description
    : DEFAULT_DESCRIPTION;
  const descUrl = (opts && typeof opts.descriptionUrl === "string" && opts.descriptionUrl.length > 0)
    ? opts.descriptionUrl
    : DEFAULT_DESCRIPTION_URL;

  /** @type {string[]} */
  const argv = ["sign", "/fd", "sha256", "/tr", tsa, "/td", "sha256", "/d", desc, "/du", descUrl];

  if (mode === "pfx") {
    const pfxPath = secrets && typeof secrets.pfxPath === "string" ? secrets.pfxPath : "";
    const pfxPw = secrets && typeof secrets.pfxPassword === "string" ? secrets.pfxPassword : "";
    if (!pfxPath || !pfxPw) {
      throw new SignWindowsError(
        "missing_pfx",
        "pfx mode requires secrets.pfxPath + secrets.pfxPassword",
        { exitCode: 64 },
      );
    }
    argv.push("/f", pfxPath, "/p", pfxPw);
  } else {
    // thumbprint mode
    const thumbprint = secrets && typeof secrets.thumbprint === "string" ? secrets.thumbprint : "";
    const canon = canonicalizeThumbprint(thumbprint);
    argv.push("/sha1", canon);
    // /sm reads from Local Machine store (default is Current User)
    if (opts && opts.machineStore === false) {
      // explicit user-store opt-out — DON'T add /sm
    } else {
      argv.push("/sm");
    }
  }

  if (opts && opts.verbose === true) argv.push("/v");
  argv.push(binary);
  return argv;
}

/**
 * Build the `AzureSignTool sign` argv for Azure KeyVault-backed EV
 * certs (DigiCert KeyLocker is the canonical commercial offering).
 *
 * @param {object} call — `{binary, secrets, opts?}`
 * @returns {string[]}
 */
function buildAzureSignToolCommand(call) {
  const { binary, secrets, opts } = call || {};
  if (typeof binary !== "string" || binary.length === 0) {
    throw new SignWindowsError("bad_binary", "buildAzureSignToolCommand requires binary", { exitCode: 64 });
  }
  const s = secrets || {};
  const required = ["url", "clientId", "clientSecret", "tenantId", "certName"];
  for (const k of required) {
    if (typeof s[k] !== "string" || s[k].length === 0) {
      throw new SignWindowsError(
        "missing_azure_kv_field",
        `azure_kv mode requires secrets.${k}`,
        { exitCode: 64 },
      );
    }
  }
  const tsa = (opts && typeof opts.timestampUrl === "string" && opts.timestampUrl.length > 0)
    ? opts.timestampUrl
    : DIGICERT_TIMESTAMP_URL;
  const desc = (opts && typeof opts.description === "string" && opts.description.length > 0)
    ? opts.description
    : DEFAULT_DESCRIPTION;
  const descUrl = (opts && typeof opts.descriptionUrl === "string" && opts.descriptionUrl.length > 0)
    ? opts.descriptionUrl
    : DEFAULT_DESCRIPTION_URL;

  /** @type {string[]} */
  const argv = [
    "sign",
    "--file-digest", "sha256",
    "--timestamp-rfc3161", tsa,
    "--timestamp-digest", "sha256",
    "--description", desc,
    "--description-url", descUrl,
    "--azure-key-vault-url", s.url,
    "--azure-key-vault-client-id", s.clientId,
    "--azure-key-vault-client-secret", s.clientSecret,
    "--azure-key-vault-tenant-id", s.tenantId,
    "--azure-key-vault-certificate", s.certName,
  ];
  if (opts && opts.verbose === true) argv.push("--verbose");
  argv.push(binary);
  return argv;
}

/**
 * Dispatch to the right command builder by mode. Returns
 * `{tool, argv}` so the workflow knows which executable to spawn.
 *
 * @param {object} call — `{binary, mode, secrets, opts?}`
 * @returns {{ tool: string, argv: string[] }}
 */
function buildSignCommand(call) {
  const mode = call && call.mode;
  if (!SIGNING_MODES.includes(mode)) {
    throw new SignWindowsError(
      "bad_mode",
      `mode must be one of: ${SIGNING_MODES.join(", ")} (got "${mode}")`,
      { exitCode: 64 },
    );
  }
  if (mode === "azure_kv") {
    return { tool: "AzureSignTool", argv: buildAzureSignToolCommand(call) };
  }
  return { tool: "signtool", argv: buildSigntoolCommand(call) };
}

/**
 * Build the `signtool verify /pa /v` argv — Authenticode verify with
 * the default chain policy + verbose output (so we can parse signer/
 * subject from stdout). The workflow runs this as the post-sign smoke
 * test.
 *
 * @param {object} call — `{binary}`
 * @returns {string[]}
 */
function buildVerifyCommand(call) {
  const { binary } = call || {};
  if (typeof binary !== "string" || binary.length === 0) {
    throw new SignWindowsError("bad_binary", "buildVerifyCommand requires binary", { exitCode: 64 });
  }
  return ["verify", "/pa", "/v", binary];
}

/**
 * Pure — parse `signtool verify /pa /v` stdout for the success line +
 * the signer subject. Returns `{ok, signer?, subject?, sha?, error?}`.
 * `ok === true` only when stdout includes "Successfully verified".
 *
 * Typical successful output (signtool 10+):
 *   File: dist\\binaries\\frootai-windows-x64.exe
 *   Index  Algorithm  Timestamp
 *   ========================================
 *   0      sha256     RFC3161
 *
 *   Issued by: DigiCert Trusted G4 RSA4096 SHA256 TimeStamping CA
 *   Issued to: Acme Corp
 *   ...
 *   Successfully verified: dist\\binaries\\frootai-windows-x64.exe
 *
 * @param {string|null|undefined} stdout
 */
function parseVerifyOutput(stdout) {
  if (typeof stdout !== "string" || stdout.length === 0) {
    return { ok: false, signer: null, subject: null, sha: null, error: "empty signtool output" };
  }
  const ok = /Successfully verified/i.test(stdout);
  const signerMatch = /Issued by:\s*(.+)/i.exec(stdout);
  const subjectMatch = /Issued to:\s*(.+)/i.exec(stdout);
  const shaMatch = /SHA1 hash:\s*([0-9A-Fa-f]+)/i.exec(stdout);
  return {
    ok,
    signer: signerMatch ? signerMatch[1].trim() : null,
    subject: subjectMatch ? subjectMatch[1].trim() : null,
    sha: shaMatch ? shaMatch[1].toUpperCase() : null,
    error: ok ? null : "signtool did not report 'Successfully verified'",
  };
}

/**
 * Build the FULL 2-step pipeline plan: sign + verify. Returns
 * `[{step, tool, argv}, ...]` in execution order. The CI runs them
 * sequentially; if either exits non-zero or verify fails to find the
 * success line, the workflow fails.
 *
 * @param {object} call — `{binary, mode, secrets, opts?}`
 * @returns {Array<{ step: string, tool: string, argv: string[] }>}
 */
function buildFullPipeline(call) {
  if (!call || typeof call.binary !== "string" || call.binary.length === 0) {
    throw new SignWindowsError("bad_binary", "buildFullPipeline requires call.binary", { exitCode: 64 });
  }
  const sign = buildSignCommand(call);
  return [
    { step: "sign", tool: sign.tool, argv: sign.argv },
    { step: "verify", tool: "signtool", argv: buildVerifyCommand({ binary: call.binary }) },
  ];
}

/**
 * Build the release-notes advisory text explaining SmartScreen
 * reputation behavior per masterplan "reputation built post-launch"
 * clause. Pure.
 *
 * @param {string|null|undefined} version — current CLI version (optional)
 * @returns {string}
 */
function buildSmartScreenAdvisoryText(version) {
  const v = typeof version === "string" && version.length > 0 ? ` v${version}` : "";
  return [
    `### Windows users: SmartScreen note`,
    ``,
    `The Windows binary${v} is signed with an EV certificate from a`,
    `commercial CA (DigiCert / Sectigo). SmartScreen reputation is`,
    `cumulative — fresh releases may still show an "Unrecognized app"`,
    `warning until enough installs accumulate. Click **More info →`,
    `Run anyway** to proceed; the signature is intact and verifiable via:`,
    ``,
    "```",
    `signtool verify /pa /v frootai-windows-x64.exe`,
    "```",
    ``,
    `Or in PowerShell:`,
    ``,
    "```powershell",
    `Get-AuthenticodeSignature .\\frootai-windows-x64.exe | Format-List *`,
    "```",
    ``,
    `The warning typically subsides 30-90 days after release.`,
  ].join("\n");
}

module.exports = {
  WINDOWS_TARGETS,
  SIGNING_MODES,
  DIGICERT_TIMESTAMP_URL,
  SECTIGO_TIMESTAMP_URL,
  DEFAULT_DESCRIPTION,
  DEFAULT_DESCRIPTION_URL,
  REQUIRED_SECRETS_BY_MODE,
  THUMBPRINT_PATTERN,
  SignWindowsError,
  validateSecrets,
  isValidThumbprint,
  canonicalizeThumbprint,
  buildSigntoolCommand,
  buildAzureSignToolCommand,
  buildSignCommand,
  buildVerifyCommand,
  parseVerifyOutput,
  buildFullPipeline,
  buildSmartScreenAdvisoryText,
};
