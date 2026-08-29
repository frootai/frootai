// @ts-check
/**
 * [H8.21] package-linux.js — Linux .deb + .rpm packaging library.
 *
 * Contract (verbatim from masterplan §3 row [H8.21]):
 *   Linux package: `.deb` + `.rpm` via `fpm`; published to GitHub
 *   Releases + apt repository at `apt.frootai.dev`; gpg-signed
 *
 * Pure command-builder library (no shelling out, no side effects) —
 * fourth release library after H8.18 build-binaries / H8.19
 * notarize-macos / H8.20 sign-windows. CI consumes argv arrays + runs
 * on `ubuntu-latest`.
 *
 * **Three artifact pipelines** the row demands:
 *   1. `.deb` package via `fpm -s dir -t deb …`  (Debian/Ubuntu format)
 *   2. `.rpm` package via `fpm -s dir -t rpm …`  (RHEL/Fedora/openSUSE)
 *   3. apt repository hosted at apt.frootai.dev — fpm produces a single
 *      `.deb` per build; the repo is the long-lived store. The library
 *      ships `buildAptRepoCommands(...)` that emits the
 *      `reprepro includedeb <suite> <deb>` argv the publish job runs
 *      against a checked-out apt-repo working copy on a separate
 *      `apt.frootai.dev` worktree (managed by the gh-pages / R2 /
 *      object-storage backend that fronts the domain).
 *
 * **GPG signing context (per masterplan):** both the .deb (via `dpkg-sig`
 * OR fpm's built-in `--deb-sign-key` flag) AND the .rpm (via
 * `rpm --addsign` OR fpm's `--rpm-sign`) must carry the FrootAI signing
 * key. apt clients verify the InRelease file's clear-signed signature
 * AGAINST a keyring shipped under `/usr/share/keyrings/frootai-archive-
 * keyring.gpg`; the install snippet for users is
 *   `curl -fsSL https://apt.frootai.dev/keyring.gpg
 *     | sudo tee /usr/share/keyrings/frootai-archive-keyring.gpg > /dev/null`
 * `buildInstallSnippet({arch})` emits this for the docs.
 *
 * **Public API:**
 *   - `LINUX_TARGETS` — frozen list (single x64 entry today;
 *     architectured-list shape so arm64 can be added later)
 *   - `PACKAGE_FORMATS` — `["deb", "rpm"]`
 *   - `DEFAULT_APT_HOST` — `"apt.frootai.dev"`
 *   - `DEFAULT_APT_SUITE` — `"stable"`
 *   - `DEFAULT_GPG_KEY_ID` — set via env at runtime; no hard-coded fingerprint
 *   - `validateSecrets(env)` → `{ok, missing[], present[]}` for the
 *     GPG_PRIVATE_KEY_B64 + GPG_PASSPHRASE + GPG_KEY_ID secrets
 *   - `buildPackageMetadata({name, version, description?, maintainer?,
 *      url?, license?})` → frozen metadata object both .deb + .rpm
 *     pipelines consume
 *   - `buildFpmCommand({format, binary, metadata, outDir, opts?})` →
 *     argv for `fpm -s dir -t <format> ...`; supports `--deb-sign-key`
 *     OR `--rpm-sign` via opts.gpgKey
 *   - `buildGpgImportCommand({keyB64Path?})` → `gpg --batch --import <file>`
 *   - `buildGpgVerifyCommand({pkgPath, format})` → format-specific verify
 *     (`dpkg-sig --verify <file>` for deb; `rpm --checksig <file>` for rpm)
 *   - `buildAptRepoCommands({repoDir, suite?, debPath})` → 2-step
 *     `reprepro --basedir <repo> includedeb <suite> <deb>` +
 *     `reprepro --basedir <repo> export` argv
 *   - `buildPackageFilename({format, name, version, arch})` — `name_ver_arch.deb`
 *     OR `name-ver.arch.rpm` (the two formats use DIFFERENT separators)
 *   - `parseFpmOutput(stdout)` → `{ok, path?, error?}` extracts the
 *     emitted package path from fpm's "Created package" line
 *   - `buildInstallSnippet({arch?})` → user-facing curl/apt snippet
 *      with the keyring + sources.list line
 *
 * License: CC0-1.0.
 */
"use strict";

const path = require("node:path");

/**
 * Linux targets that get packaged. Single x64 entry today; the matrix
 * shape future-proofs for `frootai-linux-arm64` which lands when H8.18
 * adds the arm64 target. Each entry has `{arch, fpmArch, debArch,
 * rpmArch}` because all three tools use DIFFERENT names for the same
 * architecture (typical Linux packaging cruft).
 */
const LINUX_TARGETS = Object.freeze([
  Object.freeze({
    arch: "x64",            // Node convention (matches H8.18 BUILD_TARGETS)
    fpmArch: "amd64",       // fpm + Debian convention
    debArch: "amd64",       // .deb filename arch
    rpmArch: "x86_64",      // .rpm filename arch
    binaryName: "frootai-linux-x64", // matches H8.18 BUILD_TARGETS[linux].name
  }),
]);

/** Frozen list of supported package formats. */
const PACKAGE_FORMATS = Object.freeze(["deb", "rpm"]);

/** Default apt repo host (per masterplan: apt.frootai.dev). */
const DEFAULT_APT_HOST = "apt.frootai.dev";

/** Default apt suite — `stable`. Future: `beta`, `nightly` per channel. */
const DEFAULT_APT_SUITE = "stable";

/** Default install prefix where fpm writes the binary. */
const DEFAULT_INSTALL_PREFIX = "/usr/local/bin";

/** Required environment secrets for the GPG-sign pipeline. */
const REQUIRED_SECRETS = Object.freeze([
  "GPG_PRIVATE_KEY_B64",   // base64-encoded ASCII-armored private key
  "GPG_PASSPHRASE",        // unlocks the private key
  "GPG_KEY_ID",            // long-form 16-hex key id OR fingerprint (40-hex)
]);

/** Long key-id pattern: 16 hex chars (uppercase or lower). */
const GPG_KEY_ID_PATTERN = /^[0-9A-Fa-f]{16}([0-9A-Fa-f]{24})?$/;

/** Default maintainer line per Debian/Fedora convention. */
const DEFAULT_MAINTAINER = "FrootAI <noreply@frootai.dev>";

/** Default license (matches the rest of the repo). */
const DEFAULT_LICENSE = "CC0-1.0";

/** Default description shown by `dpkg -I` / `rpm -qi`. */
const DEFAULT_DESCRIPTION = "FrootAI CLI — repo-to-solution-play converter";

/** Default upstream URL. */
const DEFAULT_URL = "https://frootai.dev";

/** Error carrying a sysexits exit code. */
class PackageLinuxError extends Error {
  /**
   * @param {string} code @param {string} message
   * @param {{ exitCode?: number, cause?: Error }} [opts]
   */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "PackageLinuxError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : 70;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Pure — validate the GPG secrets in env. Returns `{ok, missing[],
 * present[]}`. Empty-string values count as missing.
 *
 * @param {Record<string,string|undefined>|null|undefined} env
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

/** Pure — true when value matches a 16-char OR 40-char hex key-id. */
function isValidGpgKeyId(keyId) {
  if (typeof keyId !== "string") return false;
  return GPG_KEY_ID_PATTERN.test(keyId);
}

/**
 * Build the canonical Package metadata both .deb + .rpm pipelines
 * consume. Frozen so a single source of truth carries through fpm calls.
 *
 * @param {object} opts — `{name, version, description?, maintainer?, url?, license?}`
 * @returns {Readonly<{name: string, version: string, description: string, maintainer: string, url: string, license: string}>}
 */
function buildPackageMetadata(opts) {
  const o = opts || {};
  if (typeof o.name !== "string" || o.name.length === 0) {
    throw new PackageLinuxError("bad_name", "buildPackageMetadata requires name", { exitCode: 64 });
  }
  if (typeof o.version !== "string" || o.version.length === 0) {
    throw new PackageLinuxError("bad_version", "buildPackageMetadata requires version", { exitCode: 64 });
  }
  return Object.freeze({
    name: o.name,
    version: o.version,
    description: typeof o.description === "string" && o.description.length > 0 ? o.description : DEFAULT_DESCRIPTION,
    maintainer: typeof o.maintainer === "string" && o.maintainer.length > 0 ? o.maintainer : DEFAULT_MAINTAINER,
    url: typeof o.url === "string" && o.url.length > 0 ? o.url : DEFAULT_URL,
    license: typeof o.license === "string" && o.license.length > 0 ? o.license : DEFAULT_LICENSE,
  });
}

/**
 * Find a LINUX_TARGETS entry by arch (Node convention) — case-insensitive.
 *
 * @param {string|null|undefined} arch
 * @returns {object|null}
 */
function findTarget(arch) {
  if (typeof arch !== "string" || arch.length === 0) return null;
  const lc = arch.toLowerCase();
  for (const t of LINUX_TARGETS) {
    if (t.arch.toLowerCase() === lc) return t;
    if (t.fpmArch.toLowerCase() === lc) return t;
    if (t.debArch.toLowerCase() === lc) return t;
    if (t.rpmArch.toLowerCase() === lc) return t;
  }
  return null;
}

/**
 * Build the package filename per format-specific convention:
 *   - .deb: `<name>_<version>_<debArch>.deb`  (underscores; debArch)
 *   - .rpm: `<name>-<version>.<rpmArch>.rpm`  (dashes + dot; rpmArch)
 *
 * @param {object} opts — `{format, name, version, arch}`
 * @returns {string}
 */
function buildPackageFilename(opts) {
  const o = opts || {};
  if (!PACKAGE_FORMATS.includes(o.format)) {
    throw new PackageLinuxError("bad_format",
      `format must be one of: ${PACKAGE_FORMATS.join(", ")} (got "${o.format}")`,
      { exitCode: 64 });
  }
  if (typeof o.name !== "string" || o.name.length === 0) {
    throw new PackageLinuxError("bad_name", "buildPackageFilename requires name", { exitCode: 64 });
  }
  if (typeof o.version !== "string" || o.version.length === 0) {
    throw new PackageLinuxError("bad_version", "buildPackageFilename requires version", { exitCode: 64 });
  }
  const target = findTarget(o.arch);
  if (!target) {
    throw new PackageLinuxError("bad_arch", `unknown arch "${o.arch}"`, { exitCode: 64 });
  }
  if (o.format === "deb") {
    return `${o.name}_${o.version}_${target.debArch}.deb`;
  }
  return `${o.name}-${o.version}.${target.rpmArch}.rpm`;
}

/**
 * Build the `fpm` argv to package a single binary into .deb OR .rpm.
 * Common shape: `fpm -s dir -t <format> -n <name> -v <version> ...
 * --prefix /usr/local/bin --architecture <fpmArch> --package <out>
 * <binary>`. GPG signing is opt-in via `opts.gpgKey` — when present,
 * fpm forwards to `--deb-sign-key` / `--rpm-sign`.
 *
 * Caller MUST set `opts.gpgKey` for production builds (the workflow
 * fails-closed when GPG secrets are present but the flag is missing —
 * we never ship unsigned production packages).
 *
 * @param {object} opts — `{format, binary, metadata, outDir, opts?}`
 * @returns {string[]}
 */
function buildFpmCommand(call) {
  const { format, binary, metadata, outDir, opts } = call || {};
  if (!PACKAGE_FORMATS.includes(format)) {
    throw new PackageLinuxError("bad_format",
      `format must be one of: ${PACKAGE_FORMATS.join(", ")} (got "${format}")`,
      { exitCode: 64 });
  }
  if (typeof binary !== "string" || binary.length === 0) {
    throw new PackageLinuxError("bad_binary", "buildFpmCommand requires binary", { exitCode: 64 });
  }
  if (!metadata || typeof metadata.name !== "string" || typeof metadata.version !== "string") {
    throw new PackageLinuxError("bad_metadata", "buildFpmCommand requires a metadata object with name + version", { exitCode: 64 });
  }
  if (typeof outDir !== "string" || outDir.length === 0) {
    throw new PackageLinuxError("bad_out", "buildFpmCommand requires outDir", { exitCode: 64 });
  }
  const o = opts || {};
  const arch = typeof o.arch === "string" ? o.arch : "x64";
  const target = findTarget(arch);
  if (!target) {
    throw new PackageLinuxError("bad_arch", `unknown arch "${arch}"`, { exitCode: 64 });
  }
  const prefix = typeof o.prefix === "string" && o.prefix.length > 0 ? o.prefix : DEFAULT_INSTALL_PREFIX;
  const outFile = path.posix.join(outDir.replace(/\\/g, "/"), buildPackageFilename({
    format, name: metadata.name, version: metadata.version, arch,
  }));
  /** @type {string[]} */
  const argv = [
    "-s", "dir",
    "-t", format,
    "-n", metadata.name,
    "-v", metadata.version,
    "--description", metadata.description,
    "--maintainer", metadata.maintainer,
    "--url", metadata.url,
    "--license", metadata.license,
    "--architecture", target.fpmArch,
    "--prefix", prefix,
    "--package", outFile,
    "--force",
  ];
  if (typeof o.gpgKey === "string" && o.gpgKey.length > 0) {
    if (format === "deb") argv.push("--deb-sign-key", o.gpgKey);
    else argv.push("--rpm-sign");
    // fpm reads RPM signing key from ~/.rpmmacros (the workflow writes
    // %_gpg_name <keyid> before invoking fpm). We can't pass the key
    // inline for RPM because fpm's --rpm-sign relies on rpmsign.
  }
  if (typeof o.afterInstall === "string" && o.afterInstall.length > 0) {
    argv.push("--after-install", o.afterInstall);
  }
  if (typeof o.beforeRemove === "string" && o.beforeRemove.length > 0) {
    argv.push("--before-remove", o.beforeRemove);
  }
  // Final positional: source=<binary>=<dest> tells fpm "put this file
  // under <prefix>/<dest>". Without `=<dest>`, fpm copies the source
  // path's basename — which would be `frootai-linux-x64` (the artifact
  // name), but the installed command should be `frootai`.
  const installedName = typeof o.installedName === "string" && o.installedName.length > 0
    ? o.installedName
    : metadata.name;
  argv.push(`${binary}=${path.posix.join(prefix.replace(/\\/g, "/"), installedName)}`);
  return argv;
}

/**
 * Build the `gpg --batch --import` argv used to import the private key
 * onto the runner before any signing happens.
 *
 * @param {object} opts — `{keyPath, passphrase?}`
 * @returns {string[]}
 */
function buildGpgImportCommand(opts) {
  const { keyPath } = opts || {};
  if (typeof keyPath !== "string" || keyPath.length === 0) {
    throw new PackageLinuxError("bad_key", "buildGpgImportCommand requires keyPath", { exitCode: 64 });
  }
  return ["--batch", "--yes", "--import", keyPath];
}

/**
 * Build the format-specific GPG-verify argv. For .deb we use
 * `dpkg-sig --verify`; for .rpm `rpm --checksig`.
 *
 * @param {object} opts — `{format, pkgPath}`
 * @returns {{ tool: string, argv: string[] }}
 */
function buildGpgVerifyCommand(opts) {
  const { format, pkgPath } = opts || {};
  if (!PACKAGE_FORMATS.includes(format)) {
    throw new PackageLinuxError("bad_format",
      `format must be one of: ${PACKAGE_FORMATS.join(", ")} (got "${format}")`,
      { exitCode: 64 });
  }
  if (typeof pkgPath !== "string" || pkgPath.length === 0) {
    throw new PackageLinuxError("bad_pkg", "buildGpgVerifyCommand requires pkgPath", { exitCode: 64 });
  }
  if (format === "deb") {
    return { tool: "dpkg-sig", argv: ["--verify", pkgPath] };
  }
  return { tool: "rpm", argv: ["--checksig", pkgPath] };
}

/**
 * Pure — extract the "Created package" path from fpm stdout. fpm's
 * format on success is `Created package {:path=>"/tmp/.../frootai_..._amd64.deb"}`.
 *
 * @param {string|null|undefined} stdout
 * @returns {{ ok: boolean, path: string|null, error: string|null }}
 */
function parseFpmOutput(stdout) {
  if (typeof stdout !== "string" || stdout.length === 0) {
    return { ok: false, path: null, error: "empty fpm output" };
  }
  const m = /Created package\s*\{\s*:path\s*=>\s*"([^"]+)"/.exec(stdout);
  if (!m) {
    return { ok: false, path: null, error: "fpm did not report a 'Created package' line" };
  }
  return { ok: true, path: m[1], error: null };
}

/**
 * Pure — extract the "Verifying" verdict from `dpkg-sig --verify` OR
 * `rpm --checksig` stdout. Accepts either tool's success token.
 *
 *   dpkg-sig output: `<keyid>: GOODSIG <fingerprint>` OR `Processing ... GOODSIG`
 *   rpm output:      `<file>: digests signatures OK`
 *
 * @param {string|null|undefined} stdout @param {string} format
 * @returns {{ ok: boolean, error: string|null }}
 */
function parseGpgVerifyOutput(stdout, format) {
  if (typeof stdout !== "string" || stdout.length === 0) {
    return { ok: false, error: "empty verify output" };
  }
  if (format === "deb") {
    const ok = /\bGOODSIG\b/i.test(stdout);
    return { ok, error: ok ? null : "dpkg-sig did not report GOODSIG" };
  }
  if (format === "rpm") {
    const ok = /\bdigests\s+signatures\s+OK\b/i.test(stdout) ||
               /\bsignatures\s+OK\b/i.test(stdout);
    return { ok, error: ok ? null : "rpm --checksig did not report 'signatures OK'" };
  }
  return { ok: false, error: `unknown format "${format}"` };
}

/**
 * Build the apt-repo includedeb argv. The publish job runs this against
 * a checked-out apt-repo working copy (`reprepro` is the canonical
 * Debian repo-management tool). Returns a 2-step plan:
 *   1. `reprepro --basedir <repoDir> includedeb <suite> <debPath>`
 *   2. `reprepro --basedir <repoDir> export`
 *
 * @param {object} opts — `{repoDir, suite?, debPath}`
 * @returns {Array<{ step: string, tool: string, argv: string[] }>}
 */
function buildAptRepoCommands(opts) {
  const { repoDir, suite, debPath } = opts || {};
  if (typeof repoDir !== "string" || repoDir.length === 0) {
    throw new PackageLinuxError("bad_repo_dir", "buildAptRepoCommands requires repoDir", { exitCode: 64 });
  }
  if (typeof debPath !== "string" || debPath.length === 0) {
    throw new PackageLinuxError("bad_deb_path", "buildAptRepoCommands requires debPath", { exitCode: 64 });
  }
  const s = typeof suite === "string" && suite.length > 0 ? suite : DEFAULT_APT_SUITE;
  return [
    {
      step: "includedeb",
      tool: "reprepro",
      argv: ["--basedir", repoDir, "includedeb", s, debPath],
    },
    {
      step: "export",
      tool: "reprepro",
      argv: ["--basedir", repoDir, "export"],
    },
  ];
}

/**
 * Build the FULL packaging pipeline plan for one binary, one format.
 * The CI runs the returned steps sequentially.
 *
 * Steps: gpg-import (optional) → fpm → gpg-verify (optional).
 *
 * @param {object} opts — `{binary, format, metadata, outDir, gpgKey?, gpgKeyPath?, archOpts?}`
 * @returns {Array<{ step: string, tool: string, argv: string[] }>}
 */
function buildFullPipeline(opts) {
  const o = opts || {};
  if (typeof o.binary !== "string" || o.binary.length === 0) {
    throw new PackageLinuxError("bad_binary", "buildFullPipeline requires binary", { exitCode: 64 });
  }
  if (!PACKAGE_FORMATS.includes(o.format)) {
    throw new PackageLinuxError("bad_format",
      `format must be one of: ${PACKAGE_FORMATS.join(", ")} (got "${o.format}")`,
      { exitCode: 64 });
  }
  if (!o.metadata) {
    throw new PackageLinuxError("bad_metadata", "buildFullPipeline requires metadata", { exitCode: 64 });
  }
  if (typeof o.outDir !== "string" || o.outDir.length === 0) {
    throw new PackageLinuxError("bad_out", "buildFullPipeline requires outDir", { exitCode: 64 });
  }
  /** @type {Array<{ step: string, tool: string, argv: string[] }>} */
  const plan = [];
  if (typeof o.gpgKeyPath === "string" && o.gpgKeyPath.length > 0) {
    plan.push({
      step: "gpg-import",
      tool: "gpg",
      argv: buildGpgImportCommand({ keyPath: o.gpgKeyPath }),
    });
  }
  const fpmArgv = buildFpmCommand({
    format: o.format,
    binary: o.binary,
    metadata: o.metadata,
    outDir: o.outDir,
    opts: { ...(o.archOpts || {}), gpgKey: o.gpgKey },
  });
  plan.push({ step: "fpm", tool: "fpm", argv: fpmArgv });
  if (typeof o.gpgKey === "string" && o.gpgKey.length > 0) {
    // Compute the deterministic pkg path the workflow will probe for
    // verify. fpm puts it at outDir/<filename>.
    const arch = (o.archOpts && o.archOpts.arch) || "x64";
    const pkgPath = path.posix.join(
      o.outDir.replace(/\\/g, "/"),
      buildPackageFilename({ format: o.format, name: o.metadata.name, version: o.metadata.version, arch }),
    );
    const verify = buildGpgVerifyCommand({ format: o.format, pkgPath });
    plan.push({ step: "gpg-verify", tool: verify.tool, argv: verify.argv });
  }
  return plan;
}

/**
 * Pure — emit the user-facing install snippet for apt + rpm. Shown in
 * the GitHub release notes + the docs site.
 *
 * @param {object} [opts] — `{aptHost?, suite?}`
 * @returns {string}
 */
function buildInstallSnippet(opts = {}) {
  const host = typeof opts.aptHost === "string" && opts.aptHost.length > 0 ? opts.aptHost : DEFAULT_APT_HOST;
  const suite = typeof opts.suite === "string" && opts.suite.length > 0 ? opts.suite : DEFAULT_APT_SUITE;
  return [
    "## Debian / Ubuntu (apt)",
    "",
    "```bash",
    `# 1. Import the FrootAI archive keyring`,
    `curl -fsSL https://${host}/keyring.gpg \\`,
    `  | sudo tee /usr/share/keyrings/frootai-archive-keyring.gpg > /dev/null`,
    "",
    `# 2. Add the apt source`,
    `echo "deb [signed-by=/usr/share/keyrings/frootai-archive-keyring.gpg] https://${host} ${suite} main" \\`,
    `  | sudo tee /etc/apt/sources.list.d/frootai.list`,
    "",
    `# 3. Install`,
    `sudo apt update && sudo apt install -y frootai`,
    "```",
    "",
    "## RHEL / Fedora / openSUSE (rpm)",
    "",
    "```bash",
    `# Direct .rpm install from a GitHub Release asset`,
    `sudo rpm --import https://${host}/keyring.gpg`,
    `sudo rpm -Uvh https://github.com/frootai/frootai/releases/latest/download/frootai-<version>.x86_64.rpm`,
    "```",
  ].join("\n");
}

module.exports = {
  LINUX_TARGETS,
  PACKAGE_FORMATS,
  DEFAULT_APT_HOST,
  DEFAULT_APT_SUITE,
  DEFAULT_INSTALL_PREFIX,
  REQUIRED_SECRETS,
  GPG_KEY_ID_PATTERN,
  DEFAULT_MAINTAINER,
  DEFAULT_LICENSE,
  DEFAULT_DESCRIPTION,
  DEFAULT_URL,
  PackageLinuxError,
  validateSecrets,
  isValidGpgKeyId,
  buildPackageMetadata,
  findTarget,
  buildPackageFilename,
  buildFpmCommand,
  buildGpgImportCommand,
  buildGpgVerifyCommand,
  parseFpmOutput,
  parseGpgVerifyOutput,
  buildAptRepoCommands,
  buildFullPipeline,
  buildInstallSnippet,
};
