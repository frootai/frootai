// @ts-check
/**
 * M5.29 — VS Code Marketplace publish (pure core).
 *
 * Row literal: publish `frootai-vscode@6.0.0-alpha.1` to VS Code
 * Marketplace via existing pipeline (pre-release channel); ensure
 * `frootai-vscode@5.1.8` users on `stable` channel still see no update.
 *
 * Pure: zero `vscode` imports + zero IO. Hosts the canonical
 * publish-version + publisher + workflow-yaml drift detectors.
 *
 * Decisions:
 *   - Pre-release detection: any version with a SemVer pre-release
 *     suffix (`-alpha`, `-beta`, `-rc`, `-dev`, `-preview`, plus any
 *     dot-separated numeric like `-alpha.1`). The vsce CLI itself
 *     does NOT auto-detect — `vsce publish` ships to STABLE by
 *     default, which would push `6.0.0-alpha.1` to stable users
 *     unexpectedly. The workflow MUST add `--pre-release` when the
 *     local version has a pre-release suffix; gate case 9 statically
 *     asserts the regex match.
 *   - VS Code Marketplace stable-channel preservation: the
 *     Marketplace serves the LATEST stable-channel version to users
 *     who haven't opted into pre-release. `vsce publish --pre-release`
 *     never updates the stable channel; the most recent stable
 *     remains `5.1.8`. Operators on stable see no update — exactly
 *     the row literal. Gate case 4 pins STABLE_VERSION_PRESERVED so
 *     a future ship that bumps the stable line tracks both anchors.
 *   - Open VSX (`ovsx publish`) does NOT have a pre-release channel
 *     concept. The existing workflow's `ovsx publish` step is wrapped
 *     in `continue-on-error` so a pre-release alpha builds publishes
 *     a regular release to Open VSX (acceptable per the row literal
 *     focus on VS Code Marketplace; gate case 11 pins this).
 */
"use strict";

/** Publish version anchor — matches M5.28 RELEASE_VERSION. */
const EXTENSION_VERSION = "6.1.0";

/** VS Code Marketplace publisher.extension identifier. */
const PUBLISHER = "frootai";
const EXTENSION_NAME = "frootai-vscode";
const MARKETPLACE_ID = `${PUBLISHER}.${EXTENSION_NAME}`;

/** Most recent STABLE-channel version. */
const STABLE_VERSION_PRESERVED = "5.1.8";

/** vsce CLI pre-release flag. */
const PRE_RELEASE_FLAG = "--pre-release";

/** Workflow filename (the existing vsce-publish pipeline). */
const WORKFLOW_FILENAME = "vsce-publish.yml";

/**
 * SemVer pre-release suffix patterns recognised as the pre-release
 * channel signal. Any version matching one of these ships via
 * `vsce publish --pre-release`.
 */
const PRE_RELEASE_SUFFIX_RE = /-(?:alpha|beta|rc|dev|preview)(?:\.\d+)?(?:\+[0-9A-Za-z.-]+)?$/;

/**
 * Pure: detect whether a version string ships to the pre-release
 * channel. Returns true when the SemVer has a pre-release suffix.
 *
 * @param {string} version
 * @returns {boolean}
 */
function isPreReleaseVersion(version) {
  if (typeof version !== "string" || version.length === 0) return false;
  return PRE_RELEASE_SUFFIX_RE.test(version);
}

/**
 * Pure: build the vsce publish argv for a given version. Returns
 * an array of strings ready for `spawn`/`exec`.
 *
 *   buildPublishCommand("6.0.0-alpha.1") → ["vsce", "publish", "--pre-release"]
 *   buildPublishCommand("5.1.8")         → ["vsce", "publish"]
 *
 * @param {string} version
 * @returns {ReadonlyArray<string>}
 */
function buildPublishCommand(version) {
  /** @type {string[]} */
  const argv = ["vsce", "publish"];
  if (isPreReleaseVersion(version)) {
    argv.push(PRE_RELEASE_FLAG);
  }
  return Object.freeze(argv);
}

/**
 * Pure: validate that a parsed `package.json` body declares the
 * canonical M5.29 publish version + publisher + extension name.
 *
 * @param {object | null | undefined} pkg
 * @returns {{
 *   ok: boolean,
 *   versionOk: boolean,
 *   nameOk: boolean,
 *   publisherOk: boolean,
 *   isPreRelease: boolean,
 * }}
 */
function checkPackageJsonVersion(pkg) {
  const p = pkg && typeof pkg === "object" ? /** @type {any} */ (pkg) : {};
  const versionOk = p.version === EXTENSION_VERSION;
  const nameOk = p.name === EXTENSION_NAME;
  const publisherOk = p.publisher === PUBLISHER;
  const isPreRelease = versionOk && isPreReleaseVersion(p.version);
  return {
    // Stable GA: `ok` no longer requires a pre-release suffix. `isPreRelease`
    // is still reported (false for the 6.1.0 stable line) so the workflow can
    // conditionally add `--pre-release` for any FUTURE prerelease build.
    ok: versionOk && nameOk && publisherOk,
    versionOk,
    nameOk,
    publisherOk,
    isPreRelease,
  };
}

/**
 * Pure: validate that the vsce-publish workflow YAML contains the
 * pre-release detection logic (either an `isPreRelease` step that
 * adds the flag, OR an inline `--pre-release` conditional on the
 * version string). Returns per-anchor status so the gate reports
 * exactly which anchor drifted.
 *
 * @param {string} yaml
 * @returns {{
 *   ok: boolean,
 *   hasVsceInstall: boolean,
 *   hasPreReleaseDetection: boolean,
 *   hasPreReleaseFlag: boolean,
 *   hasOpenVsxContinueOnError: boolean,
 *   hasMarketplaceShowCheck: boolean,
 * }}
 */
function checkWorkflowPreReleaseSupport(yaml) {
  const src = typeof yaml === "string" ? yaml : "";
  const hasVsceInstall = /@vscode\/vsce/i.test(src);
  // Pre-release detection: workflow must compute `pre_release=true`
  // (or equivalent) conditional on the version having a SemVer
  // pre-release suffix.
  const hasPreReleaseDetection =
    /pre[_-]?release/i.test(src) &&
    (/-alpha|-beta|-rc|-dev|-preview/.test(src) || /isPreRelease|is_pre_release/i.test(src));
  const hasPreReleaseFlag = /--pre-release/.test(src);
  // Open VSX step is wrapped in continue-on-error since it doesn't
  // have a pre-release channel concept.
  const hasOpenVsxContinueOnError = /ovsx publish[\s\S]*?continue-on-error:\s*true/i.test(src);
  // Existing `vsce show <id>` marketplace skip-check.
  const hasMarketplaceShowCheck = src.includes(`vsce show ${MARKETPLACE_ID}`) ||
                                  src.includes("vsce show frootai.frootai-vscode");
  return {
    ok: hasVsceInstall && hasPreReleaseDetection && hasPreReleaseFlag &&
        hasOpenVsxContinueOnError && hasMarketplaceShowCheck,
    hasVsceInstall,
    hasPreReleaseDetection,
    hasPreReleaseFlag,
    hasOpenVsxContinueOnError,
    hasMarketplaceShowCheck,
  };
}

module.exports = {
  EXTENSION_VERSION,
  PUBLISHER,
  EXTENSION_NAME,
  MARKETPLACE_ID,
  STABLE_VERSION_PRESERVED,
  PRE_RELEASE_FLAG,
  WORKFLOW_FILENAME,
  PRE_RELEASE_SUFFIX_RE,
  isPreReleaseVersion,
  buildPublishCommand,
  checkPackageJsonVersion,
  checkWorkflowPreReleaseSupport,
};
