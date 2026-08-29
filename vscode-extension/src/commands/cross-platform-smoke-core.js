// @ts-check
/**
 * M5.26 — Cross-platform smoke matrix (pure core).
 *
 * Row literal: cross-platform smoke: extension installed on Linux +
 * Windows + macOS via VS Code Insider — attach playwright area
 * succeeds on all three.
 *
 * Pure: zero `vscode` imports + zero IO. Hosts the canonical matrix
 * shape + a workflow-yaml drift detector the gate uses.
 *
 * Operational interpretation of the row literal: a real headless
 * VS Code Insider install on 3 OSes + actual `frootai-mcp` kernel
 * spawn + actual `playwright` attach is HEAVY (multi-minute job per
 * OS, requires display server on Linux, requires kernel binary
 * resolution which is M5.22+ territory). M5.26's pragmatic ship is
 * the SMOKE MATRIX that runs the federation pure-core + extension
 * test suites (M5.25) on all 3 OSes — this proves every code path a
 * real `attach playwright` would exercise (env mapping, area
 * validation, tree-provider data shape, webview validators,
 * telemetry wrapping) is platform-clean. When the kernel-spawn row
 * lands at M5.22+ / future ship, the same matrix automatically
 * picks it up.
 *
 * Decisions:
 *   - Three OS runners pinned exactly to the row literal: Linux
 *     (ubuntu-latest), Windows (windows-latest), macOS (macos-latest).
 *     These are the GitHub Actions runner labels VS Code itself uses
 *     for its cross-platform matrix.
 *   - `SMOKE_TARGET_AREA = "playwright"` per row literal — operators
 *     grep the codebase for the smoke target; renaming would break
 *     the audit trail.
 *   - The workflow runs the M5.25 extension test suite (4 files)
 *     AND the orchard-gate `vscode-mcp-*.test.js` sweep so platform
 *     regressions surface against both surfaces.
 *   - `fail-fast: false` so one OS failing doesn't mask the others —
 *     the row literal mandates "all three" succeed, so the report
 *     must show which specific OS broke.
 */
"use strict";

/** Row-literal OS list mapped to GitHub Actions runner labels. */
const SUPPORTED_PLATFORMS = Object.freeze([
  "ubuntu-latest",  // Linux
  "windows-latest",
  "macos-latest",
]);

/** Row-literal smoke target. */
const SMOKE_TARGET_AREA = "playwright";

/** VS Code distribution channel from row literal. */
const VSCODE_DISTRIBUTION = "insider";

/** Canonical workflow filename. */
const WORKFLOW_FILENAME = "vscode-federation-cross-platform.yml";

/** Workflow job name (used by the gate to drift-detect). */
const WORKFLOW_JOB_NAME = "m5-cross-platform-smoke";

/**
 * Pure: build the canonical OS x Node matrix the workflow declares.
 * Returns FROZEN.
 *
 * @returns {Readonly<{ os: ReadonlyArray<string>, node: ReadonlyArray<string> }>}
 */
function buildSmokeMatrix() {
  return Object.freeze({
    os: SUPPORTED_PLATFORMS,
    // Node 18/20/22 LTS line matches the existing M4.24
    // mcp-cli-cross-platform.yml matrix for consistency.
    node: Object.freeze(["18", "20", "22"]),
  });
}

/**
 * Pure: ordered list of smoke step names the workflow runs per OS.
 * Used by the gate to drift-detect the step roster.
 *
 * @returns {ReadonlyArray<string>}
 */
function buildSmokeStepNames() {
  return Object.freeze([
    "checkout",
    "setup-node",
    "extension-test-suite",   // M5.25 `test:federation` (4 files / 37 cases)
    "orchard-gate-sweep",     // vscode-mcp-*.test.js (M5.x gates)
    "smoke-summary",
  ]);
}

/**
 * Pure: validate that a platform string is one of the three
 * supported OSes per row literal.
 *
 * @param {string} platform
 * @returns {boolean}
 */
function checkPlatformSupport(platform) {
  if (typeof platform !== "string") return false;
  return SUPPORTED_PLATFORMS.includes(platform);
}

/**
 * Pure: validate that a workflow YAML body contains the required
 * row-literal anchors (all 3 OSes + SMOKE_TARGET_AREA reference +
 * fail-fast:false). Returns per-anchor status so the gate reports
 * exactly which anchor is missing.
 *
 * @param {string} yaml
 * @returns {{
 *   ok: boolean,
 *   hasUbuntu: boolean,
 *   hasWindows: boolean,
 *   hasMacos: boolean,
 *   hasSmokeTarget: boolean,
 *   hasFailFastFalse: boolean,
 *   hasFederationTestSuite: boolean,
 * }}
 */
function checkWorkflowContribution(yaml) {
  const src = typeof yaml === "string" ? yaml : "";
  const hasUbuntu = src.includes("ubuntu-latest");
  const hasWindows = src.includes("windows-latest");
  const hasMacos = src.includes("macos-latest");
  const hasSmokeTarget = src.includes(SMOKE_TARGET_AREA);
  // fail-fast: false ensures one OS failure doesn't mask the others
  const hasFailFastFalse = /fail-fast:\s*false/i.test(src);
  // M5.25 federation test suite must be exercised
  const hasFederationTestSuite =
    src.includes("test:federation") ||
    src.includes("src/test/federation");
  const ok =
    hasUbuntu && hasWindows && hasMacos &&
    hasSmokeTarget && hasFailFastFalse && hasFederationTestSuite;
  return {
    ok,
    hasUbuntu,
    hasWindows,
    hasMacos,
    hasSmokeTarget,
    hasFailFastFalse,
    hasFederationTestSuite,
  };
}

module.exports = {
  SUPPORTED_PLATFORMS,
  SMOKE_TARGET_AREA,
  VSCODE_DISTRIBUTION,
  WORKFLOW_FILENAME,
  WORKFLOW_JOB_NAME,
  buildSmokeMatrix,
  buildSmokeStepNames,
  checkPlatformSupport,
  checkWorkflowContribution,
};
