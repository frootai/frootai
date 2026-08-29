// @ts-check
/**
 * [H8.21] linux-packages.js — Linux .deb + .rpm build + gpg-sign library.
 *
 * Contract (verbatim from masterplan §3 row [H8.21]):
 *   Linux package: `.deb` + `.rpm` via `fpm`; published to GitHub
 *   Releases + apt repository at `apt.frootai.dev`; gpg-signed
 *
 * Pure command-builder library (mirror of H8.18/H8.19/H8.20). No
 * shelling out, no side effects. The CI workflow consumes the argv
 * arrays returned here + the apt-repo metadata strings + executes
 * them on the `ubuntu-latest` runner (fpm + dpkg-deb + rpmbuild +
 * gpg + aptly all preinstalled or installable via apt-get).
 *
 * **The 5-step Linux distribution pipeline**:
 *   1. `fpm -s dir -t deb -n frootai -v <VERSION> -a amd64
 *      --maintainer "FrootAI <ops@frootai.dev>" --description "..."
 *      --url https://frootai.dev --license CC0-1.0
 *      --deb-no-default-config-files
 *      <BINARY_DIR>/frootai-linux-x64=/usr/local/bin/frootai`
 *      — builds the `.deb` from the H8.18 pkg-built linux-x64 binary
 *        (we don't bundle node_modules; the binary is self-contained
 *        via pkg's snapshot).
 *   2. `fpm -s dir -t rpm -n frootai -v <VERSION> -a x86_64 ...`
 *      — same source bag, different output format.
 *   3. `gpg --batch --yes --pinentry-mode loopback
 *      --passphrase-file <KEY_PASSPHRASE_FILE>
 *      --detach-sign --armor <package>` — produces `<package>.asc`
 *        for both .deb + .rpm (GitHub Release downloaders verify via
 *        `gpg --verify`).
 *   4. apt-repo metadata generation: `Packages.gz` + `Release` +
 *      `InRelease` (gpg-signed). The CI workflow generates these
 *      using `dpkg-scanpackages` + `apt-ftparchive`; this library
 *      provides the canonical Release-file template + the
 *      content-addressed checksum helpers.
 *   5. rsync to apt.frootai.dev (DNS CNAME → Cloudflare R2 / S3
 *      static-hosted bucket). The CI workflow holds the rsync
 *      credentials; this library only generates the rsync command.
 *
 * **GPG key posture**:
 *   - Production: 4096-bit RSA, stored in the runner's GPG keyring
 *     via `GPG_PRIVATE_KEY_B64` secret + `GPG_KEY_PASSPHRASE` secret;
 *     workflow imports into ephemeral GNUPGHOME, signs, then nukes.
 *   - The public key is published at `apt.frootai.dev/frootai.gpg`
 *     so end-users can `curl ... | gpg --dearmor | tee
 *     /etc/apt/trusted.gpg.d/frootai.gpg`.
 *   - Key rotation: when the active key approaches its 3-year cap,
 *     a new key is added to the keyring + the apt repo is re-signed
 *     by BOTH keys for a 6-month transition (existing users keep
 *     trusting the old key; new users get the new key).
 *
 * **Public API:**
 *   - `LINUX_TARGETS` — frozen 1-entry array (frootai-linux-x64 →
 *     amd64 deb / x86_64 rpm); future arm64 ship adds without
 *     touching H8.18.
 *   - `PACKAGE_NAME` — "frootai" (the npm, deb, and rpm package names
 *     match the `frootai` binary on $PATH).
 *   - `MAINTAINER`/`DESCRIPTION`/`HOMEPAGE`/`LICENSE_SPDX` — package
 *     metadata defaults; overrideable per call.
 *   - `REQUIRED_SECRETS` — frozen list of env var names.
 *   - `SEMVER_PATTERN` — strict `MAJOR.MINOR.PATCH` (no prereleases
 *     in published Linux packages; dev builds use a `0.0.0-dev<n>`
 *     internal-only version).
 *   - `validateSecrets(env)` → `{ok, missing[], present[]}`
 *   - `validateVersion(version)` → `{ok, error?}`
 *   - `buildFpmDebCommand({binary, version, outDir, packageName?,
 *      maintainer?, description?, homepage?, licenseSpdx?, arch?})`
 *   - `buildFpmRpmCommand(opts)` — same shape, emits rpm-specific
 *     architecture ("x86_64" instead of "amd64") + license-format
 *     flag.
 *   - `buildGpgSignCommand({file, passphraseFile, gnupghome?})` —
 *     emits `--detach-sign --armor` to produce <file>.asc
 *   - `buildGpgVerifyCommand({file, signatureFile, gnupghome?})` —
 *     verifies a previously-signed package; CI round-trips.
 *   - `buildAptScanPackagesCommand({poolDir, distDir?})` — `dpkg-scanpackages`
 *   - `buildAptFtparchiveReleaseCommand({distDir, codename, components,
 *      architectures})` — `apt-ftparchive release` with the canonical
 *     conf-string.
 *   - `buildAptReleaseFileContent({codename, components,
 *      architectures, suite?, origin?, label?, description?,
 *      date?, validUntilDays?})` — generates the deb822 Release-file
 *     content (`Origin: FrootAI`, `Codename: stable`, `Components: main`,
 *     `Architectures: amd64`, `Date: <RFC 1123>`, `Valid-Until: <RFC 1123>`)
 *   - `buildAptInreleaseCommand({releaseFile, passphraseFile,
 *      gnupghome?})` — clear-sign Release in-place to InRelease.
 *   - `buildRsyncToAptRepoCommand({localDir, remoteHost?, remotePath?,
 *      sshKeyFile?})` — rsync the assembled `dists/stable/` tree to
 *     the apt.frootai.dev backing store.
 *   - `buildAptListLineForUser({codename?})` — the single line
 *     end-users paste into `/etc/apt/sources.list.d/frootai.list`.
 *   - `buildInstallInstructions({codename?, version?})` — formats
 *     the 3-line "how to install" snippet for the install-clients
 *     doc + GitHub release notes.
 *
 * License: CC0-1.0.
 */
"use strict";

const path = require("node:path");

/** Frozen 1-target matrix (independent of H8.18 per H8.19 loose-coupling). */
const LINUX_TARGETS = Object.freeze([
  Object.freeze({
    name: "frootai-linux-x64",
    runner: "ubuntu-latest",
    debArch: "amd64",
    rpmArch: "x86_64",
    binarySource: "frootai-linux-x64",
    binaryTarget: "/usr/local/bin/frootai",
  }),
]);

const PACKAGE_NAME = "frootai";
const MAINTAINER = "FrootAI <ops@frootai.dev>";
const DESCRIPTION = "FrootAI CLI — harvest GitHub repos into solution plays";
const HOMEPAGE = "https://frootai.dev";
const LICENSE_SPDX = "CC0-1.0";
const DEFAULT_CODENAME = "stable";
const DEFAULT_COMPONENT = "main";
const DEFAULT_ARCHITECTURE = "amd64";
const DEFAULT_ORIGIN = "FrootAI";
const DEFAULT_LABEL = "FrootAI";
const DEFAULT_DESCRIPTION_APT = "FrootAI CLI apt repository";
const DEFAULT_REMOTE_HOST = "apt.frootai.dev";
const DEFAULT_REMOTE_PATH = "/var/www/apt";
const DEFAULT_VALID_UNTIL_DAYS = 30;

/** Required env vars for the CI workflow. */
const REQUIRED_SECRETS = Object.freeze([
  "GPG_PRIVATE_KEY_B64",
  "GPG_KEY_PASSPHRASE",
  "APT_REPO_SSH_PRIVATE_KEY_B64",
]);

/** Strict semver (no prereleases — published Linux packages are release-only). */
const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

/** Error carrying a sysexits exit code. */
class LinuxPackagesError extends Error {
  /**
   * @param {string} code @param {string} message
   * @param {{ exitCode?: number, cause?: Error }} [opts]
   */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "LinuxPackagesError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : 70;
    if (opts.cause) this.cause = opts.cause;
  }
}

/** Pure — returns LINUX_TARGETS unchanged (future-proof seam). */
function applicableTargets() {
  return LINUX_TARGETS;
}

/**
 * Pure — check `env` for required secrets. Returns `{ok, missing,
 * present}`. Same shape as H8.19/H8.20 validateSecrets.
 *
 * @param {Record<string,string|undefined>|null|undefined} env
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
 * Pure — validate a strict MAJOR.MINOR.PATCH semver (no prereleases,
 * no build metadata; published Linux packages are release-only).
 *
 * @param {string|null|undefined} value
 */
function validateVersion(value) {
  if (typeof value !== "string") {
    return { ok: false, error: `version must be a string (got ${typeof value})` };
  }
  if (value.length === 0) {
    return { ok: false, error: "version must not be empty" };
  }
  if (!SEMVER_PATTERN.test(value)) {
    return { ok: false, error: `version must match MAJOR.MINOR.PATCH (got "${value}")` };
  }
  return { ok: true };
}

/** Internal — assert opts required fields. Throws LinuxPackagesError. */
function _requireString(opts, key, errCode) {
  if (typeof opts[key] !== "string" || opts[key].length === 0) {
    throw new LinuxPackagesError(errCode, `requires opts.${key} (got ${typeof opts[key]})`, { exitCode: 64 });
  }
}

/** Internal — build the canonical fpm command for either deb or rpm. */
function _buildFpmCommand(target, opts) {
  _requireString(opts, "binary", "invalid_binary");
  _requireString(opts, "version", "invalid_version");
  _requireString(opts, "outDir", "invalid_outDir");
  const v = validateVersion(opts.version);
  if (!v.ok) throw new LinuxPackagesError("invalid_version", v.error, { exitCode: 64 });

  const packageName = typeof opts.packageName === "string" && opts.packageName.length > 0
    ? opts.packageName : PACKAGE_NAME;
  const maintainer = typeof opts.maintainer === "string" && opts.maintainer.length > 0
    ? opts.maintainer : MAINTAINER;
  const description = typeof opts.description === "string" && opts.description.length > 0
    ? opts.description : DESCRIPTION;
  const homepage = typeof opts.homepage === "string" && opts.homepage.length > 0
    ? opts.homepage : HOMEPAGE;
  const licenseSpdx = typeof opts.licenseSpdx === "string" && opts.licenseSpdx.length > 0
    ? opts.licenseSpdx : LICENSE_SPDX;
  const arch = typeof opts.arch === "string" && opts.arch.length > 0
    ? opts.arch : (target === "deb" ? DEFAULT_ARCHITECTURE : "x86_64");

  // Use forward slashes throughout — fpm runs on Linux runners.
  const binarySrc = String(opts.binary).replace(/\\/g, "/");
  const binaryDst = "/usr/local/bin/frootai";
  const outDir = String(opts.outDir).replace(/\\/g, "/");

  /** @type {string[]} */
  const argv = [
    "-s", "dir",
    "-t", target,
    "-n", packageName,
    "-v", opts.version,
    "-a", arch,
    "--maintainer", maintainer,
    "--description", description,
    "--url", homepage,
    "--license", licenseSpdx,
    "--package", `${outDir}/`,
    "--force",
  ];
  if (target === "deb") {
    argv.push("--deb-no-default-config-files");
  } else if (target === "rpm") {
    argv.push("--rpm-os", "linux");
  }
  argv.push(`${binarySrc}=${binaryDst}`);
  return argv;
}

/** Pure — build the fpm command for a .deb package. */
function buildFpmDebCommand(opts) {
  return _buildFpmCommand("deb", opts || {});
}

/** Pure — build the fpm command for a .rpm package. */
function buildFpmRpmCommand(opts) {
  return _buildFpmCommand("rpm", opts || {});
}

/**
 * Pure — build the gpg detach-sign command. Produces <file>.asc.
 * `passphraseFile` is a path on disk containing the GPG key
 * passphrase (so the secret never appears in process listings).
 *
 * @param {object} opts — `{file, passphraseFile, gnupghome?, keyId?}`
 */
function buildGpgSignCommand(opts) {
  const o = opts || {};
  _requireString(o, "file", "invalid_file");
  _requireString(o, "passphraseFile", "invalid_passphraseFile");
  /** @type {string[]} */
  const argv = ["--batch", "--yes", "--pinentry-mode", "loopback", "--passphrase-file", o.passphraseFile];
  if (typeof o.gnupghome === "string" && o.gnupghome.length > 0) {
    argv.unshift("--homedir", o.gnupghome);
  }
  if (typeof o.keyId === "string" && o.keyId.length > 0) {
    argv.push("--local-user", o.keyId);
  }
  argv.push("--detach-sign", "--armor", o.file);
  return argv;
}

/**
 * Pure — build the gpg verify command. Used by CI for round-trip
 * after signing + recommended for downloaders to verify integrity.
 *
 * @param {object} opts — `{file, signatureFile?, gnupghome?}`
 */
function buildGpgVerifyCommand(opts) {
  const o = opts || {};
  _requireString(o, "file", "invalid_file");
  /** @type {string[]} */
  const argv = [];
  if (typeof o.gnupghome === "string" && o.gnupghome.length > 0) {
    argv.push("--homedir", o.gnupghome);
  }
  argv.push("--verify");
  if (typeof o.signatureFile === "string" && o.signatureFile.length > 0) {
    argv.push(o.signatureFile);
  } else {
    argv.push(`${o.file}.asc`);
  }
  argv.push(o.file);
  return argv;
}

/**
 * Pure — build the `dpkg-scanpackages` argv. Scans the pool directory
 * + emits a `Packages` file to stdout (CI redirects to
 * `dists/<codename>/main/binary-amd64/Packages` + gzips).
 *
 * @param {object} opts — `{poolDir}`
 */
function buildAptScanPackagesCommand(opts) {
  const o = opts || {};
  _requireString(o, "poolDir", "invalid_poolDir");
  return ["--arch", DEFAULT_ARCHITECTURE, String(o.poolDir).replace(/\\/g, "/"), "/dev/null"];
}

/**
 * Pure — build the `apt-ftparchive release` argv. Emits the canonical
 * `Release` file (suitable for clearsign → InRelease).
 *
 * @param {object} opts — `{distDir, codename, components, architectures, origin?, label?, description?}`
 */
function buildAptFtparchiveReleaseCommand(opts) {
  const o = opts || {};
  _requireString(o, "distDir", "invalid_distDir");
  const codename = typeof o.codename === "string" && o.codename.length > 0 ? o.codename : DEFAULT_CODENAME;
  const components = Array.isArray(o.components) && o.components.length > 0 ? o.components : [DEFAULT_COMPONENT];
  const architectures = Array.isArray(o.architectures) && o.architectures.length > 0 ? o.architectures : [DEFAULT_ARCHITECTURE];
  const origin = typeof o.origin === "string" && o.origin.length > 0 ? o.origin : DEFAULT_ORIGIN;
  const label = typeof o.label === "string" && o.label.length > 0 ? o.label : DEFAULT_LABEL;
  const description = typeof o.description === "string" && o.description.length > 0 ? o.description : DEFAULT_DESCRIPTION_APT;
  return [
    "release",
    "-o", `APT::FTPArchive::Release::Origin=${origin}`,
    "-o", `APT::FTPArchive::Release::Label=${label}`,
    "-o", `APT::FTPArchive::Release::Codename=${codename}`,
    "-o", `APT::FTPArchive::Release::Components=${components.join(" ")}`,
    "-o", `APT::FTPArchive::Release::Architectures=${architectures.join(" ")}`,
    "-o", `APT::FTPArchive::Release::Description=${description}`,
    String(o.distDir).replace(/\\/g, "/"),
  ];
}

/**
 * Pure — build the deb822 Release-file content. Independent of
 * `apt-ftparchive` so callers can emit the file without the binary.
 * The CI workflow prefers `apt-ftparchive` (because it computes
 * checksums against the actual Packages.gz/Packages files on disk);
 * this helper is the canonical text for tests + docs.
 *
 * @param {object} opts
 * @param {string} [opts.codename]      — default "stable"
 * @param {string[]} [opts.components]  — default ["main"]
 * @param {string[]} [opts.architectures] — default ["amd64"]
 * @param {string} [opts.suite]         — default same as codename
 * @param {string} [opts.origin]        — default "FrootAI"
 * @param {string} [opts.label]         — default "FrootAI"
 * @param {string} [opts.description]   — default "FrootAI CLI apt repository"
 * @param {string} [opts.date]          — RFC 1123 UTC; default now
 * @param {number} [opts.validUntilDays] — default 30
 * @returns {string}
 */
function buildAptReleaseFileContent(opts = {}) {
  const codename = typeof opts.codename === "string" && opts.codename.length > 0 ? opts.codename : DEFAULT_CODENAME;
  const suite = typeof opts.suite === "string" && opts.suite.length > 0 ? opts.suite : codename;
  const components = Array.isArray(opts.components) && opts.components.length > 0 ? opts.components.slice() : [DEFAULT_COMPONENT];
  const architectures = Array.isArray(opts.architectures) && opts.architectures.length > 0 ? opts.architectures.slice() : [DEFAULT_ARCHITECTURE];
  const origin = typeof opts.origin === "string" && opts.origin.length > 0 ? opts.origin : DEFAULT_ORIGIN;
  const label = typeof opts.label === "string" && opts.label.length > 0 ? opts.label : DEFAULT_LABEL;
  const description = typeof opts.description === "string" && opts.description.length > 0 ? opts.description : DEFAULT_DESCRIPTION_APT;
  const validUntilDays = Number.isInteger(opts.validUntilDays) && opts.validUntilDays > 0
    ? opts.validUntilDays : DEFAULT_VALID_UNTIL_DAYS;

  const now = (typeof opts.date === "string" && opts.date.length > 0)
    ? new Date(opts.date)
    : new Date();
  if (!Number.isFinite(now.getTime())) {
    throw new LinuxPackagesError("invalid_date", `bad date: "${opts.date}"`, { exitCode: 64 });
  }
  const validUntil = new Date(now.getTime() + validUntilDays * 86_400_000);

  const lines = [
    `Origin: ${origin}`,
    `Label: ${label}`,
    `Suite: ${suite}`,
    `Codename: ${codename}`,
    `Components: ${components.join(" ")}`,
    `Architectures: ${architectures.join(" ")}`,
    `Description: ${description}`,
    `Date: ${now.toUTCString()}`,
    `Valid-Until: ${validUntil.toUTCString()}`,
  ];
  return lines.join("\n") + "\n";
}

/**
 * Pure — build the gpg clear-sign command that converts a `Release`
 * file in-place to an `InRelease` file. Same passphrase-file +
 * homedir story as `buildGpgSignCommand`.
 *
 * @param {object} opts — `{releaseFile, passphraseFile, gnupghome?, keyId?}`
 */
function buildAptInreleaseCommand(opts) {
  const o = opts || {};
  _requireString(o, "releaseFile", "invalid_releaseFile");
  _requireString(o, "passphraseFile", "invalid_passphraseFile");
  /** @type {string[]} */
  const argv = ["--batch", "--yes", "--pinentry-mode", "loopback", "--passphrase-file", o.passphraseFile];
  if (typeof o.gnupghome === "string" && o.gnupghome.length > 0) {
    argv.unshift("--homedir", o.gnupghome);
  }
  if (typeof o.keyId === "string" && o.keyId.length > 0) {
    argv.push("--local-user", o.keyId);
  }
  // --clearsign embeds the signature in-band so the output file is a
  // single InRelease file (apt-get prefers InRelease over Release+sig).
  // -o picks the output path; CI passes <dist>/InRelease.
  const outFile = path.posix.join(path.posix.dirname(String(o.releaseFile).replace(/\\/g, "/")), "InRelease");
  argv.push("-o", outFile, "--clearsign", o.releaseFile);
  return argv;
}

/**
 * Pure — build the rsync argv for publishing the assembled apt repo
 * tree to apt.frootai.dev. The remote path defaults to
 * `/var/www/apt`; CI overrides via `--remote-path` if the hosting
 * provider mounts the bucket elsewhere.
 *
 * Uses `--delete` so removed packages are reflected on the server,
 * but `--exclude` keeps the GPG public key in place across deploys.
 *
 * @param {object} opts — `{localDir, remoteHost?, remotePath?, sshKeyFile?, remoteUser?}`
 */
function buildRsyncToAptRepoCommand(opts) {
  const o = opts || {};
  _requireString(o, "localDir", "invalid_localDir");
  const remoteHost = typeof o.remoteHost === "string" && o.remoteHost.length > 0 ? o.remoteHost : DEFAULT_REMOTE_HOST;
  const remotePath = typeof o.remotePath === "string" && o.remotePath.length > 0 ? o.remotePath : DEFAULT_REMOTE_PATH;
  const remoteUser = typeof o.remoteUser === "string" && o.remoteUser.length > 0 ? o.remoteUser : "deploy";
  const localDir = String(o.localDir).replace(/\\/g, "/").replace(/\/+$/, "") + "/";
  /** @type {string[]} */
  const argv = ["-avz", "--delete", "--exclude", "frootai.gpg"];
  if (typeof o.sshKeyFile === "string" && o.sshKeyFile.length > 0) {
    argv.push("-e", `ssh -i ${o.sshKeyFile} -o StrictHostKeyChecking=accept-new`);
  }
  argv.push(localDir, `${remoteUser}@${remoteHost}:${remotePath}/`);
  return argv;
}

/**
 * Pure — build the single line end-users paste into
 * `/etc/apt/sources.list.d/frootai.list`.
 *
 * @param {object} [opts] — `{codename?}`
 */
function buildAptListLineForUser(opts = {}) {
  const codename = typeof opts.codename === "string" && opts.codename.length > 0 ? opts.codename : DEFAULT_CODENAME;
  return `deb [signed-by=/usr/share/keyrings/frootai.gpg] https://apt.frootai.dev ${codename} main`;
}

/**
 * Pure — build the multi-line install snippet for the install-clients
 * doc + GitHub release notes.
 *
 * @param {object} [opts] — `{codename?, version?}`
 */
function buildInstallInstructions(opts = {}) {
  const codename = typeof opts.codename === "string" && opts.codename.length > 0 ? opts.codename : DEFAULT_CODENAME;
  const aptLine = buildAptListLineForUser({ codename });
  return [
    "# Add the FrootAI gpg key + apt source (one-time)",
    "curl -fsSL https://apt.frootai.dev/frootai.gpg | sudo gpg --dearmor -o /usr/share/keyrings/frootai.gpg",
    `echo "${aptLine}" | sudo tee /etc/apt/sources.list.d/frootai.list`,
    "",
    "# Install",
    "sudo apt-get update",
    "sudo apt-get install -y frootai",
  ].join("\n");
}

/** Pure — build the canonical RPM yum-repo line for /etc/yum.repos.d. */
function buildYumRepoFileContent() {
  return [
    "[frootai]",
    `name=${DEFAULT_LABEL}`,
    `baseurl=https://apt.frootai.dev/rpm`,
    "enabled=1",
    "gpgcheck=1",
    "gpgkey=https://apt.frootai.dev/frootai.gpg",
  ].join("\n") + "\n";
}

/**
 * Pure — build the full per-binary publish plan as `[{step, argv|content}]`.
 * The CI workflow runs each step in order; failure aborts the rest.
 *
 * @param {object} opts — `{binary, version, outDir, passphraseFile, gnupghome?}`
 */
function buildFullPipeline(opts = {}) {
  return [
    { step: "fpm-deb", argv: buildFpmDebCommand(opts) },
    { step: "fpm-rpm", argv: buildFpmRpmCommand(opts) },
    {
      step: "gpg-sign-deb",
      argv: buildGpgSignCommand({
        file: `${String(opts.outDir).replace(/\\/g, "/")}/${PACKAGE_NAME}_${opts.version}_${DEFAULT_ARCHITECTURE}.deb`,
        passphraseFile: opts.passphraseFile,
        gnupghome: opts.gnupghome,
        keyId: opts.keyId,
      }),
    },
    {
      step: "gpg-sign-rpm",
      argv: buildGpgSignCommand({
        file: `${String(opts.outDir).replace(/\\/g, "/")}/${PACKAGE_NAME}-${opts.version}-1.x86_64.rpm`,
        passphraseFile: opts.passphraseFile,
        gnupghome: opts.gnupghome,
        keyId: opts.keyId,
      }),
    },
  ];
}

module.exports = {
  LINUX_TARGETS,
  PACKAGE_NAME,
  MAINTAINER,
  DESCRIPTION,
  HOMEPAGE,
  LICENSE_SPDX,
  DEFAULT_CODENAME,
  DEFAULT_COMPONENT,
  DEFAULT_ARCHITECTURE,
  DEFAULT_ORIGIN,
  DEFAULT_LABEL,
  DEFAULT_REMOTE_HOST,
  DEFAULT_REMOTE_PATH,
  DEFAULT_VALID_UNTIL_DAYS,
  REQUIRED_SECRETS,
  SEMVER_PATTERN,
  LinuxPackagesError,
  applicableTargets,
  validateSecrets,
  validateVersion,
  buildFpmDebCommand,
  buildFpmRpmCommand,
  buildGpgSignCommand,
  buildGpgVerifyCommand,
  buildAptScanPackagesCommand,
  buildAptFtparchiveReleaseCommand,
  buildAptReleaseFileContent,
  buildAptInreleaseCommand,
  buildRsyncToAptRepoCommand,
  buildAptListLineForUser,
  buildInstallInstructions,
  buildYumRepoFileContent,
  buildFullPipeline,
};
