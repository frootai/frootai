// @ts-check
/**
 * [H8.23] winget-manifest.js — Microsoft winget manifest renderer +
 * winget-pkgs PR submission helper.
 *
 * Contract (verbatim from masterplan §3 row [H8.23]):
 *   Winget manifest: submit `frootai.frootai.yaml` to winget-pkgs;
 *   `winget install frootai.frootai`
 *
 * Pure rendering library (no shelling out, no side effects). Sixth
 * release lib after H8.18–H8.22. The CI workflow runs the H8.18
 * Windows binary build + the H8.20 EV sign first; this library then
 * renders the 3-file multi-manifest set referencing the GitHub
 * Release URL + sha256 digest, and the publish job submits a PR to
 * `microsoft/winget-pkgs` via the `wingetcreate` tool.
 *
 * **Winget multi-file manifest format** (per Microsoft.WingetCreate
 * specs, ManifestVersion 1.6.0). Each package version has 3 YAML
 * files under
 *   `manifests/<first-letter>/<publisher>/<package>/<version>/`:
 *   1. `<PackageIdentifier>.yaml`                — version manifest
 *   2. `<PackageIdentifier>.installer.yaml`      — installer manifest
 *   3. `<PackageIdentifier>.locale.<defaultLocale>.yaml` — locale manifest
 *
 * For `frootai.frootai` (masterplan-pinned identifier):
 *   `manifests/f/frootai/frootai/<version>/frootai.frootai.yaml`
 *   `manifests/f/frootai/frootai/<version>/frootai.frootai.installer.yaml`
 *   `manifests/f/frootai/frootai/<version>/frootai.frootai.locale.en-US.yaml`
 *
 * **InstallerType doctrine:** the H8.18 ships a single `.exe` binary
 * (not an MSI/Inno/Nullsoft installer). Winget supports this via
 * `InstallerType: portable` — the package manager downloads the .exe
 * and creates a symlink/alias at install time, so `winget install
 * frootai.frootai` exposes the binary as `frootai` in PATH. Per-arch
 * (`Architecture: x64`) entry under `Installers` carries the URL +
 * sha256.
 *
 * **Public API:**
 *   - `DEFAULT_PACKAGE_IDENTIFIER` — `"frootai.frootai"` per masterplan
 *   - `DEFAULT_PUBLISHER` — `"FrootAI"`
 *   - `DEFAULT_PACKAGE_NAME` — `"frootai"`
 *   - `DEFAULT_LOCALE` — `"en-US"`
 *   - `DEFAULT_AUTHOR` — `"FrootAI"`
 *   - `DEFAULT_LICENSE_URL` — `"https://frootai.dev/license"`
 *   - `DEFAULT_HOMEPAGE` — `"https://frootai.dev"`
 *   - `MANIFEST_VERSION` — `"1.6.0"`
 *   - `DEFAULT_WINGET_REPO` — `"microsoft/winget-pkgs"`
 *   - `parsePackageIdentifier(id)` → `{publisher, package, first}`
 *   - `buildManifestRelDir({packageIdentifier, version})` →
 *      `manifests/<first>/<publisher>/<package>/<version>`
 *   - `buildManifestFilenames({packageIdentifier, locale?})` → 3-entry
 *      `{versionFile, installerFile, localeFile}` map
 *   - `renderVersionManifest({packageIdentifier, packageVersion, defaultLocale?})`
 *   - `renderInstallerManifest({packageIdentifier, packageVersion,
 *      installerUrl, installerSha256, architecture?, installerType?,
 *      releaseDate?})`
 *   - `renderDefaultLocaleManifest({packageIdentifier, packageVersion,
 *      packageName?, publisher?, author?, license?, licenseUrl?,
 *      homepage?, shortDescription?, description?, tags?, defaultLocale?})`
 *   - `renderManifestSet(opts)` → `{[filename]: yamlContent}` map
 *   - `buildWingetcreateSubmitCommand({manifestsDir, prTitle?, token?,
 *      replace?, dryRun?})` — argv for `wingetcreate submit`
 *   - `parseWingetcreatePrUrl(stdout)` — extracts the PR URL from
 *      stdout (the operator-visible side-effect of a successful submit)
 *   - `buildInstallSnippet({packageIdentifier?})` — release-notes blurb
 *
 * License: CC0-1.0.
 */
"use strict";

const path = require("node:path");

const DEFAULT_PACKAGE_IDENTIFIER = "frootai.frootai";
const DEFAULT_PUBLISHER = "FrootAI";
const DEFAULT_PACKAGE_NAME = "frootai";
const DEFAULT_LOCALE = "en-US";
const DEFAULT_AUTHOR = "FrootAI";
const DEFAULT_LICENSE = "CC0-1.0";
const DEFAULT_LICENSE_URL = "https://frootai.dev/license";
const DEFAULT_HOMEPAGE = "https://frootai.dev";
const DEFAULT_SHORT_DESCRIPTION =
  "FrootAI CLI — repo-to-solution-play converter";
const DEFAULT_DESCRIPTION =
  "FrootAI CLI for harvesting upstream repos into solution plays, " +
  "with deterministic infra composition + LLM-grounded scaffolding.";
const DEFAULT_TAGS = Object.freeze([
  "ai", "agents", "azure", "bicep", "cli", "devtools",
  "infrastructure-as-code", "openai", "scaffolding", "terraform",
]);

const MANIFEST_VERSION = "1.6.0";
const DEFAULT_WINGET_REPO = "microsoft/winget-pkgs";
const DEFAULT_INSTALLER_TYPE = "portable";
const DEFAULT_ARCHITECTURE = "x64";
const DEFAULT_INSTALLER_LOCALE = "en-US";
const DEFAULT_PR_TITLE_PREFIX = "Add ";

/** Allowed installer types per winget schema (subset; portable is what
 *  we ship today). */
const INSTALLER_TYPES = Object.freeze([
  "portable", "exe", "msi", "msix", "nullsoft", "wix", "inno", "zip", "burn",
]);

/** Allowed architectures (winget canonical list). */
const ARCHITECTURES = Object.freeze([
  "x64", "x86", "arm64", "arm", "neutral",
]);

/** Locale-tag pattern: BCP 47-ish two/three-letter language + optional
 *  region tag (`en-US`, `pt-BR`, `de`, `zh-Hans`). */
const LOCALE_PATTERN = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8}){0,2}$/;

/** Sha256 pattern: 64 hex chars. winget accepts uppercase OR lowercase;
 *  we emit UPPERCASE for visual consistency with the winget-pkgs corpus
 *  (Microsoft's published manifests are uppercase). */
const SHA256_PATTERN = /^[0-9A-Fa-f]{64}$/;

/** Semver-ish version pattern: 1.2.3 with optional v-prefix, prerelease,
 *  build metadata. winget tolerates any non-empty string in the
 *  `PackageVersion` field but our publish flow uses semver. */
const SEMVER_PATTERN = /^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

/** Package identifier pattern: `Publisher.Package` per winget convention.
 *  Microsoft accepts up to 4 dot-separated segments; we require at
 *  least one dot. Each segment must start with a letter; subsequent
 *  chars allow letters, digits, and dots-within-segment-no, but
 *  hyphens are NOT allowed. */
const PACKAGE_IDENTIFIER_PATTERN =
  /^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*){1,3}$/;

/** Error carrying a sysexits exit code. */
class WingetManifestError extends Error {
  /**
   * @param {string} code @param {string} message
   * @param {{ exitCode?: number, cause?: Error }} [opts]
   */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "WingetManifestError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : 70;
    if (opts.cause) this.cause = opts.cause;
  }
}

/** Pure — true when value matches the winget Publisher.Package identifier
 *  shape. */
function isValidPackageIdentifier(id) {
  if (typeof id !== "string") return false;
  return PACKAGE_IDENTIFIER_PATTERN.test(id);
}

/** Pure — true when value is a 64-hex sha256. */
function isValidSha256(sha) {
  if (typeof sha !== "string") return false;
  return SHA256_PATTERN.test(sha);
}

/** Pure — true when value is semver-ish. */
function isValidVersion(version) {
  if (typeof version !== "string") return false;
  return SEMVER_PATTERN.test(version);
}

/** Pure — true when value is a BCP 47-ish locale tag. */
function isValidLocale(locale) {
  if (typeof locale !== "string") return false;
  return LOCALE_PATTERN.test(locale);
}

/** Pure — strip leading `v` from a version string. */
function stripVPrefix(version) {
  if (typeof version !== "string") return version;
  return version.replace(/^v/i, "");
}

/**
 * Pure — parse `Publisher.Package` into its parts + the lowercase first
 * letter of the publisher (used in the manifest-dir path).
 *
 * @param {string} packageIdentifier
 * @returns {{ publisher: string, package: string, first: string, segments: string[] }}
 */
function parsePackageIdentifier(packageIdentifier) {
  if (!isValidPackageIdentifier(packageIdentifier)) {
    throw new WingetManifestError(
      "bad_identifier",
      `package identifier must match Publisher.Package shape (got "${packageIdentifier}")`,
      { exitCode: 64 },
    );
  }
  const segments = packageIdentifier.split(".");
  const publisher = segments[0];
  // The "package" name per winget convention is everything AFTER the
  // first segment, dot-joined (so `Foo.Bar.Baz` → publisher Foo,
  // package Bar.Baz). For the canonical 2-segment `frootai.frootai`,
  // package = "frootai".
  const pkg = segments.slice(1).join(".");
  return {
    publisher,
    package: pkg,
    first: publisher.charAt(0).toLowerCase(),
    segments,
  };
}

/**
 * Build the relative manifests/ path winget-pkgs uses for one
 * package-version: `manifests/<first>/<publisher>/<package>/<version>`.
 *
 * @param {object} opts — `{packageIdentifier, version}`
 * @returns {string}
 */
function buildManifestRelDir(opts) {
  const o = opts || {};
  const parts = parsePackageIdentifier(o.packageIdentifier);
  if (!isValidVersion(o.version)) {
    throw new WingetManifestError("bad_version", `bad version "${o.version}"`, { exitCode: 64 });
  }
  const v = stripVPrefix(o.version);
  return path.posix.join("manifests", parts.first, parts.publisher, parts.package, v);
}

/**
 * Build the 3 canonical filenames the multi-manifest publish writes.
 *
 * @param {object} opts — `{packageIdentifier, locale?}`
 * @returns {{ versionFile: string, installerFile: string, localeFile: string }}
 */
function buildManifestFilenames(opts) {
  const o = opts || {};
  if (!isValidPackageIdentifier(o.packageIdentifier)) {
    throw new WingetManifestError(
      "bad_identifier",
      `bad packageIdentifier "${o.packageIdentifier}"`,
      { exitCode: 64 },
    );
  }
  const loc = typeof o.locale === "string" && o.locale.length > 0 ? o.locale : DEFAULT_LOCALE;
  if (!isValidLocale(loc)) {
    throw new WingetManifestError(
      "bad_locale",
      `bad locale "${loc}" (BCP 47 tag expected)`,
      { exitCode: 64 },
    );
  }
  return {
    versionFile: `${o.packageIdentifier}.yaml`,
    installerFile: `${o.packageIdentifier}.installer.yaml`,
    localeFile: `${o.packageIdentifier}.locale.${loc}.yaml`,
  };
}

/**
 * Pure — quote a value for YAML output. winget manifests are simple
 * scalar-only YAML; we double-quote strings + escape backslashes and
 * inner double quotes. Numbers + booleans are emitted unquoted.
 *
 * @param {string|number|boolean|null|undefined} v
 * @returns {string}
 */
function yamlScalar(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  const s = String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${s}"`;
}

/**
 * Render the version manifest YAML. Format pinned at winget
 * ManifestVersion 1.6.0.
 *
 * @param {object} opts — `{packageIdentifier, packageVersion, defaultLocale?}`
 * @returns {string}
 */
function renderVersionManifest(opts) {
  const o = opts || {};
  if (!isValidPackageIdentifier(o.packageIdentifier)) {
    throw new WingetManifestError("bad_identifier", `bad packageIdentifier`, { exitCode: 64 });
  }
  if (!isValidVersion(o.packageVersion)) {
    throw new WingetManifestError("bad_version", `bad packageVersion`, { exitCode: 64 });
  }
  const locale = typeof o.defaultLocale === "string" && o.defaultLocale.length > 0
    ? o.defaultLocale : DEFAULT_LOCALE;
  if (!isValidLocale(locale)) {
    throw new WingetManifestError("bad_locale", `bad defaultLocale "${locale}"`, { exitCode: 64 });
  }
  const v = stripVPrefix(o.packageVersion);
  return [
    `# Created by H8.23 renderVersionManifest (frootai-core/cli/commands/release/winget-manifest.js)`,
    `# yaml-language-server: $schema=https://aka.ms/winget-manifest.version.${MANIFEST_VERSION}.schema.json`,
    ``,
    `PackageIdentifier: ${yamlScalar(o.packageIdentifier)}`,
    `PackageVersion: ${yamlScalar(v)}`,
    `DefaultLocale: ${yamlScalar(locale)}`,
    `ManifestType: version`,
    `ManifestVersion: ${MANIFEST_VERSION}`,
    ``,
  ].join("\n");
}

/**
 * Render the installer manifest YAML. Today we ship a single-arch
 * portable .exe; the `installers` field is a 1-entry array. Multi-arch
 * follow-up would push more entries (each with its own URL + sha).
 *
 * @param {object} opts — `{packageIdentifier, packageVersion, installerUrl, installerSha256, architecture?, installerType?, installerLocale?, releaseDate?, commands?}`
 * @returns {string}
 */
function renderInstallerManifest(opts) {
  const o = opts || {};
  if (!isValidPackageIdentifier(o.packageIdentifier)) {
    throw new WingetManifestError("bad_identifier", `bad packageIdentifier`, { exitCode: 64 });
  }
  if (!isValidVersion(o.packageVersion)) {
    throw new WingetManifestError("bad_version", `bad packageVersion`, { exitCode: 64 });
  }
  if (typeof o.installerUrl !== "string" || o.installerUrl.length === 0) {
    throw new WingetManifestError("bad_url", "renderInstallerManifest requires installerUrl", { exitCode: 64 });
  }
  if (!isValidSha256(o.installerSha256)) {
    throw new WingetManifestError(
      "bad_sha",
      `installerSha256 must be 64 hex chars (got "${o.installerSha256}")`,
      { exitCode: 64 },
    );
  }
  const arch = typeof o.architecture === "string" && o.architecture.length > 0
    ? o.architecture : DEFAULT_ARCHITECTURE;
  if (!ARCHITECTURES.includes(arch)) {
    throw new WingetManifestError(
      "bad_arch",
      `architecture must be one of: ${ARCHITECTURES.join(", ")} (got "${arch}")`,
      { exitCode: 64 },
    );
  }
  const installerType = typeof o.installerType === "string" && o.installerType.length > 0
    ? o.installerType : DEFAULT_INSTALLER_TYPE;
  if (!INSTALLER_TYPES.includes(installerType)) {
    throw new WingetManifestError(
      "bad_type",
      `installerType must be one of: ${INSTALLER_TYPES.join(", ")} (got "${installerType}")`,
      { exitCode: 64 },
    );
  }
  const installerLocale = typeof o.installerLocale === "string" && o.installerLocale.length > 0
    ? o.installerLocale : DEFAULT_INSTALLER_LOCALE;
  if (!isValidLocale(installerLocale)) {
    throw new WingetManifestError("bad_locale", `bad installerLocale "${installerLocale}"`, { exitCode: 64 });
  }
  const v = stripVPrefix(o.packageVersion);
  const sha = o.installerSha256.toUpperCase();
  const commands = Array.isArray(o.commands) && o.commands.length > 0
    ? o.commands.filter((c) => typeof c === "string" && c.length > 0)
    : [DEFAULT_PACKAGE_NAME];
  const lines = [
    `# Created by H8.23 renderInstallerManifest`,
    `# yaml-language-server: $schema=https://aka.ms/winget-manifest.installer.${MANIFEST_VERSION}.schema.json`,
    ``,
    `PackageIdentifier: ${yamlScalar(o.packageIdentifier)}`,
    `PackageVersion: ${yamlScalar(v)}`,
    `InstallerType: ${installerType}`,
    `InstallerLocale: ${yamlScalar(installerLocale)}`,
    `Commands:`,
  ];
  for (const c of commands) lines.push(`  - ${yamlScalar(c)}`);
  if (typeof o.releaseDate === "string" && o.releaseDate.length > 0) {
    lines.push(`ReleaseDate: ${yamlScalar(o.releaseDate)}`);
  }
  lines.push(`Installers:`);
  lines.push(`  - Architecture: ${arch}`);
  lines.push(`    InstallerUrl: ${yamlScalar(o.installerUrl)}`);
  lines.push(`    InstallerSha256: ${yamlScalar(sha)}`);
  // Portable installers benefit from explicit PortableCommandAlias so
  // `winget install frootai.frootai` symlinks `frootai` not the awkward
  // filename `frootai-windows-x64`.
  if (installerType === "portable") {
    lines.push(`    PortableCommandAlias:`);
    for (const c of commands) lines.push(`      - ${yamlScalar(c)}`);
  }
  lines.push(`ManifestType: installer`);
  lines.push(`ManifestVersion: ${MANIFEST_VERSION}`);
  lines.push(``);
  return lines.join("\n");
}

/**
 * Render the default-locale manifest YAML.
 *
 * @param {object} opts — `{packageIdentifier, packageVersion, packageName?, publisher?, author?, license?, licenseUrl?, homepage?, shortDescription?, description?, tags?, defaultLocale?, moniker?}`
 * @returns {string}
 */
function renderDefaultLocaleManifest(opts) {
  const o = opts || {};
  if (!isValidPackageIdentifier(o.packageIdentifier)) {
    throw new WingetManifestError("bad_identifier", `bad packageIdentifier`, { exitCode: 64 });
  }
  if (!isValidVersion(o.packageVersion)) {
    throw new WingetManifestError("bad_version", `bad packageVersion`, { exitCode: 64 });
  }
  const locale = typeof o.defaultLocale === "string" && o.defaultLocale.length > 0
    ? o.defaultLocale : DEFAULT_LOCALE;
  if (!isValidLocale(locale)) {
    throw new WingetManifestError("bad_locale", `bad defaultLocale "${locale}"`, { exitCode: 64 });
  }
  const v = stripVPrefix(o.packageVersion);
  const packageName = typeof o.packageName === "string" && o.packageName.length > 0
    ? o.packageName : DEFAULT_PACKAGE_NAME;
  const publisher = typeof o.publisher === "string" && o.publisher.length > 0
    ? o.publisher : DEFAULT_PUBLISHER;
  const author = typeof o.author === "string" && o.author.length > 0 ? o.author : DEFAULT_AUTHOR;
  const license = typeof o.license === "string" && o.license.length > 0 ? o.license : DEFAULT_LICENSE;
  const licenseUrl = typeof o.licenseUrl === "string" && o.licenseUrl.length > 0
    ? o.licenseUrl : DEFAULT_LICENSE_URL;
  const homepage = typeof o.homepage === "string" && o.homepage.length > 0 ? o.homepage : DEFAULT_HOMEPAGE;
  const shortDescription = typeof o.shortDescription === "string" && o.shortDescription.length > 0
    ? o.shortDescription : DEFAULT_SHORT_DESCRIPTION;
  const description = typeof o.description === "string" && o.description.length > 0
    ? o.description : DEFAULT_DESCRIPTION;
  const tags = Array.isArray(o.tags) && o.tags.length > 0
    ? o.tags.filter((t) => typeof t === "string" && t.length > 0)
    : DEFAULT_TAGS;
  const moniker = typeof o.moniker === "string" && o.moniker.length > 0 ? o.moniker : packageName;

  const lines = [
    `# Created by H8.23 renderDefaultLocaleManifest`,
    `# yaml-language-server: $schema=https://aka.ms/winget-manifest.defaultLocale.${MANIFEST_VERSION}.schema.json`,
    ``,
    `PackageIdentifier: ${yamlScalar(o.packageIdentifier)}`,
    `PackageVersion: ${yamlScalar(v)}`,
    `PackageLocale: ${yamlScalar(locale)}`,
    `Publisher: ${yamlScalar(publisher)}`,
    `PublisherUrl: ${yamlScalar(homepage)}`,
    `Author: ${yamlScalar(author)}`,
    `PackageName: ${yamlScalar(packageName)}`,
    `PackageUrl: ${yamlScalar(homepage)}`,
    `License: ${yamlScalar(license)}`,
    `LicenseUrl: ${yamlScalar(licenseUrl)}`,
    `ShortDescription: ${yamlScalar(shortDescription)}`,
    `Description: ${yamlScalar(description)}`,
    `Moniker: ${yamlScalar(moniker)}`,
    `Tags:`,
  ];
  for (const t of tags) lines.push(`  - ${yamlScalar(t)}`);
  lines.push(`ManifestType: defaultLocale`);
  lines.push(`ManifestVersion: ${MANIFEST_VERSION}`);
  lines.push(``);
  return lines.join("\n");
}

/**
 * Render all 3 manifest files at once. Returns a `{filename: content}`
 * map the caller writes to disk.
 *
 * @param {object} opts — combined options for the 3 renderers
 * @returns {Record<string, string>}
 */
function renderManifestSet(opts) {
  const o = opts || {};
  const filenames = buildManifestFilenames({
    packageIdentifier: o.packageIdentifier,
    locale: o.defaultLocale,
  });
  return {
    [filenames.versionFile]: renderVersionManifest({
      packageIdentifier: o.packageIdentifier,
      packageVersion: o.packageVersion,
      defaultLocale: o.defaultLocale,
    }),
    [filenames.installerFile]: renderInstallerManifest({
      packageIdentifier: o.packageIdentifier,
      packageVersion: o.packageVersion,
      installerUrl: o.installerUrl,
      installerSha256: o.installerSha256,
      architecture: o.architecture,
      installerType: o.installerType,
      installerLocale: o.installerLocale,
      releaseDate: o.releaseDate,
      commands: o.commands,
    }),
    [filenames.localeFile]: renderDefaultLocaleManifest({
      packageIdentifier: o.packageIdentifier,
      packageVersion: o.packageVersion,
      packageName: o.packageName,
      publisher: o.publisher,
      author: o.author,
      license: o.license,
      licenseUrl: o.licenseUrl,
      homepage: o.homepage,
      shortDescription: o.shortDescription,
      description: o.description,
      tags: o.tags,
      defaultLocale: o.defaultLocale,
      moniker: o.moniker,
    }),
  };
}

/**
 * Build the `wingetcreate submit` argv. `wingetcreate` is Microsoft's
 * official manifest CLI (Microsoft.WingetCreate package); it takes
 * either a manifests dir or individual files via `-m`. We always pass
 * the dir form since renderManifestSet emits all 3 files at once.
 *
 * Required: `--token <gh-pat>` with write access to the operator's
 * fork of `microsoft/winget-pkgs` (wingetcreate forks + opens PR
 * back to upstream).
 *
 * @param {object} opts — `{manifestsDir, token, prTitle?, replace?, dryRun?}`
 * @returns {string[]}
 */
function buildWingetcreateSubmitCommand(opts) {
  const o = opts || {};
  if (typeof o.manifestsDir !== "string" || o.manifestsDir.length === 0) {
    throw new WingetManifestError("bad_dir", "buildWingetcreateSubmitCommand requires manifestsDir", { exitCode: 64 });
  }
  if (typeof o.token !== "string" || o.token.length === 0) {
    throw new WingetManifestError("bad_token", "buildWingetcreateSubmitCommand requires token", { exitCode: 64 });
  }
  /** @type {string[]} */
  const argv = ["submit", o.manifestsDir, "--token", o.token];
  if (typeof o.prTitle === "string" && o.prTitle.length > 0) {
    argv.push("--prtitle", o.prTitle);
  }
  if (o.replace === true) argv.push("--replace");
  if (o.dryRun === true) argv.push("--no-submit");
  return argv;
}

/**
 * Build the canonical PR title for a winget submission.
 *
 *   "Add frootai.frootai version 1.2.3"
 *
 * The phrasing matches the existing winget-pkgs PR convention so
 * Microsoft's reviewers can auto-approve via their label heuristics.
 *
 * @param {object} opts — `{packageIdentifier, packageVersion, action?}`
 * @returns {string}
 */
function buildPrTitle(opts) {
  const o = opts || {};
  if (!isValidPackageIdentifier(o.packageIdentifier)) {
    throw new WingetManifestError("bad_identifier", `bad packageIdentifier`, { exitCode: 64 });
  }
  if (!isValidVersion(o.packageVersion)) {
    throw new WingetManifestError("bad_version", `bad packageVersion`, { exitCode: 64 });
  }
  const action = typeof o.action === "string" && o.action.length > 0 ? o.action : DEFAULT_PR_TITLE_PREFIX;
  const v = stripVPrefix(o.packageVersion);
  // Trim trailing space defensively in case caller passes "Add " etc.
  const a = action.trim();
  return `${a} ${o.packageIdentifier} version ${v}`;
}

/**
 * Pure — extract the GitHub PR URL from `wingetcreate submit` stdout.
 * Format on success:
 *   Pull request created: https://github.com/microsoft/winget-pkgs/pull/12345
 *
 * Falls back to a more permissive regex if the exact phrase isn't
 * found (wingetcreate output strings have shifted across versions).
 *
 * @param {string|null|undefined} stdout
 * @returns {{ ok: boolean, prUrl: string|null, error: string|null }}
 */
function parseWingetcreatePrUrl(stdout) {
  if (typeof stdout !== "string" || stdout.length === 0) {
    return { ok: false, prUrl: null, error: "empty wingetcreate output" };
  }
  // Preferred: explicit "Pull request created:" line.
  const explicit = /Pull request created:?\s*(https:\/\/github\.com\/[^\s]+\/pull\/\d+)/i.exec(stdout);
  if (explicit) return { ok: true, prUrl: explicit[1], error: null };
  // Fallback: any winget-pkgs pull URL in the output.
  const generic = /https:\/\/github\.com\/[A-Za-z0-9_.\/-]*winget-pkgs[A-Za-z0-9_.\/-]*\/pull\/\d+/i.exec(stdout);
  if (generic) return { ok: true, prUrl: generic[0], error: null };
  return { ok: false, prUrl: null, error: "no winget-pkgs PR URL found in wingetcreate output" };
}

/**
 * Build the user-facing install snippet for release notes / docs.
 *
 * @param {object} [opts] — `{packageIdentifier?}`
 * @returns {string}
 */
function buildInstallSnippet(opts = {}) {
  const id = typeof opts.packageIdentifier === "string" && opts.packageIdentifier.length > 0
    ? opts.packageIdentifier : DEFAULT_PACKAGE_IDENTIFIER;
  return [
    "## Windows (winget)",
    "",
    "```powershell",
    `winget install ${id}`,
    "```",
    "",
    `Upgrade with \`winget upgrade ${id}\`.`,
    `Uninstall with \`winget uninstall ${id}\`.`,
  ].join("\n");
}

/**
 * Build the FULL publish-winget pipeline plan: render the 3 manifest
 * files inline (tool='node') + submit via wingetcreate. Returns an
 * array of `{step, tool, [argv|path|content]}` entries the workflow
 * executes sequentially.
 *
 * @param {object} opts — `{outDir, packageIdentifier, packageVersion, installerUrl, installerSha256, ..., token, prTitle?, replace?, dryRun?}`
 * @returns {Array<{ step: string, tool: string, argv?: string[], path?: string, content?: string }>}
 */
function buildPublishPipeline(opts) {
  const o = opts || {};
  if (typeof o.outDir !== "string" || o.outDir.length === 0) {
    throw new WingetManifestError("bad_dir", "buildPublishPipeline requires outDir", { exitCode: 64 });
  }
  if (typeof o.token !== "string" || o.token.length === 0) {
    throw new WingetManifestError("bad_token", "buildPublishPipeline requires token", { exitCode: 64 });
  }
  const files = renderManifestSet(o);
  const filenames = buildManifestFilenames({
    packageIdentifier: o.packageIdentifier,
    locale: o.defaultLocale,
  });
  /** @type {Array<{ step: string, tool: string, argv?: string[], path?: string, content?: string }>} */
  const plan = [];
  for (const name of [filenames.versionFile, filenames.installerFile, filenames.localeFile]) {
    plan.push({
      step: `write-${name}`,
      tool: "node",
      path: path.posix.join(o.outDir.replace(/\\/g, "/"), name),
      content: files[name],
    });
  }
  const prTitle = typeof o.prTitle === "string" && o.prTitle.length > 0
    ? o.prTitle
    : buildPrTitle({ packageIdentifier: o.packageIdentifier, packageVersion: o.packageVersion });
  plan.push({
    step: "wingetcreate-submit",
    tool: "wingetcreate",
    argv: buildWingetcreateSubmitCommand({
      manifestsDir: o.outDir,
      token: o.token,
      prTitle,
      replace: o.replace,
      dryRun: o.dryRun,
    }),
  });
  return plan;
}

module.exports = {
  DEFAULT_PACKAGE_IDENTIFIER,
  DEFAULT_PUBLISHER,
  DEFAULT_PACKAGE_NAME,
  DEFAULT_LOCALE,
  DEFAULT_AUTHOR,
  DEFAULT_LICENSE,
  DEFAULT_LICENSE_URL,
  DEFAULT_HOMEPAGE,
  DEFAULT_SHORT_DESCRIPTION,
  DEFAULT_DESCRIPTION,
  DEFAULT_TAGS,
  DEFAULT_INSTALLER_TYPE,
  DEFAULT_ARCHITECTURE,
  DEFAULT_INSTALLER_LOCALE,
  DEFAULT_PR_TITLE_PREFIX,
  DEFAULT_WINGET_REPO,
  MANIFEST_VERSION,
  INSTALLER_TYPES,
  ARCHITECTURES,
  LOCALE_PATTERN,
  SHA256_PATTERN,
  SEMVER_PATTERN,
  PACKAGE_IDENTIFIER_PATTERN,
  WingetManifestError,
  isValidPackageIdentifier,
  isValidSha256,
  isValidVersion,
  isValidLocale,
  stripVPrefix,
  yamlScalar,
  parsePackageIdentifier,
  buildManifestRelDir,
  buildManifestFilenames,
  renderVersionManifest,
  renderInstallerManifest,
  renderDefaultLocaleManifest,
  renderManifestSet,
  buildWingetcreateSubmitCommand,
  buildPrTitle,
  parseWingetcreatePrUrl,
  buildInstallSnippet,
  buildPublishPipeline,
};
