// @ts-check
/**
 * M5.27 — Visual regression for FederationExplorer webview (pure core).
 *
 * Row literal: visual regression: webview screenshots golden + on
 * every PR touching `webviews/FederationExplorer.tsx`.
 *
 * Pure: zero `vscode` imports + zero IO. Hosts the canonical
 * golden-screenshot roster + a workflow-yaml drift detector + a
 * manifest validator the gate uses.
 *
 * Operational interpretation of the row literal: a full visual-diff
 * pipeline (Playwright Component Testing + pixelmatch / SSIM
 * comparison) is multi-step infrastructure that depends on
 * (a) a Storybook-style component harness for the React webview,
 * (b) a deterministic browser version pinned across CI runners,
 * (c) golden PNGs baselined in-tree under `__screenshots__/`.
 * M5.27's pragmatic ship establishes:
 *   - The CANONICAL golden roster (5 named screenshot states the
 *     diff pipeline targets — pinned here so a future ship adding
 *     baseline PNGs knows exactly what to capture).
 *   - The `__screenshots__/federation-explorer/manifest.json` shape
 *     listing each golden with caption + expected resolution + dark/
 *     light variant marker.
 *   - The CI workflow path-filter on `FederationExplorer.tsx` so
 *     every PR touching the row-literal file triggers the visual-
 *     regression job (today: builds the webview + asserts the
 *     manifest matches the canonical roster; future: full pixel
 *     diff against golden PNGs).
 *
 * Decisions:
 *   - 5 golden states pinned in row-literal order matching the
 *     M5.12 React component's tab + filter affordances:
 *       1. catalog-empty           — no marketplace entries yet
 *       2. catalog-filtered        — tier filter applied
 *       3. attached-empty          — no areas attached
 *       4. attached-list           — one or more areas with idle timer
 *       5. warning-state           — at least one area near idle-disconnect
 *     Renaming or reordering trips the manifest validator (gate case 6).
 *   - Each golden ships dark + light variants (gate case 8) because
 *     the VS Code webview inherits the user's theme — a golden
 *     captured under one theme would false-positive against the other.
 *   - The workflow's path-filter is pinned to `FederationExplorer.tsx`
 *     PLUS the React component's own sibling test files + the
 *     `federation-explorer-core.js` pure-core (whose changes can
 *     affect the rendered state without touching the .tsx file).
 *     Row literal mandates "on every PR touching `FederationExplorer.tsx`"
 *     so the .tsx anchor is necessary; the additional surface is
 *     additive safety, NOT a deviation.
 */
"use strict";

/** Row-literal anchor — the file path that triggers the workflow. */
const TARGET_WEBVIEW_FILE = "webview-ui/src/panels/FederationExplorer.tsx";

/** Canonical golden directory (workspace-root-relative). */
const GOLDEN_DIR = "frootai-core/vscode-extension/webview-ui/__screenshots__/federation-explorer";

/** Canonical manifest filename inside the golden directory. */
const MANIFEST_FILENAME = "manifest.json";

/** Canonical workflow filename. */
const WORKFLOW_FILENAME = "vscode-federation-visual-regression.yml";

/** Canonical workflow job name. */
const WORKFLOW_JOB_NAME = "federation-explorer-visual-regression";

/** Theme variants each golden ships. */
const THEME_VARIANTS = Object.freeze(["dark", "light"]);

/** Expected golden resolution (logical px, before DPR scaling). */
const GOLDEN_WIDTH_PX = 800;
const GOLDEN_HEIGHT_PX = 600;

/** Manifest schema version. Bump on breaking shape changes. */
const MANIFEST_VERSION = 1;

/**
 * @typedef {object} GoldenScreenshot
 * @property {string} id
 * @property {string} caption
 * @property {string} state    Brief one-line description of the captured state.
 *
 * @typedef {object} GoldenManifest
 * @property {number} version
 * @property {string} component   Anchor to the row-literal target file.
 * @property {{ width: number, height: number }} resolution
 * @property {ReadonlyArray<string>} themes
 * @property {ReadonlyArray<GoldenScreenshot>} screenshots
 */

/**
 * Pure: build the canonical 5-state golden roster.
 *
 * @returns {ReadonlyArray<Readonly<GoldenScreenshot>>}
 */
function buildGoldenScreenshotList() {
  return Object.freeze([
    Object.freeze({
      id: "catalog-empty",
      caption: "Catalog tab — no marketplace entries",
      state: "explorer just opened, marketplace fetch in flight, area list empty",
    }),
    Object.freeze({
      id: "catalog-filtered",
      caption: "Catalog tab — tier filter applied",
      state: "marketplace populated, first-party-ms tier filter active, 3 entries visible",
    }),
    Object.freeze({
      id: "attached-empty",
      caption: "Attached tab — no areas attached",
      state: "Attached tab active, empty-state copy rendered with discover affordance",
    }),
    Object.freeze({
      id: "attached-list",
      caption: "Attached tab — two areas with idle timer",
      state: "azure + playwright attached, fresh idle timers, tool counts populated",
    }),
    Object.freeze({
      id: "warning-state",
      caption: "Attached tab — area near idle-disconnect",
      state: "azure attached at 9.5min / 10min idle, amber warning badge visible per M5.19 doctrine",
    }),
  ]);
}

/**
 * Pure: build the canonical manifest body the
 * `__screenshots__/federation-explorer/manifest.json` file ships.
 *
 * @returns {Readonly<GoldenManifest>}
 */
function buildGoldenManifest() {
  return Object.freeze({
    version: MANIFEST_VERSION,
    component: TARGET_WEBVIEW_FILE,
    resolution: Object.freeze({ width: GOLDEN_WIDTH_PX, height: GOLDEN_HEIGHT_PX }),
    themes: THEME_VARIANTS,
    screenshots: buildGoldenScreenshotList(),
  });
}

/**
 * Pure: validate that a parsed manifest object matches the canonical
 * golden roster + resolution + theme variants. Returns per-field
 * status so the gate reports exactly which anchor drifted.
 *
 * @param {unknown} parsed
 * @returns {{
 *   ok: boolean,
 *   versionOk: boolean,
 *   componentOk: boolean,
 *   resolutionOk: boolean,
 *   themesOk: boolean,
 *   screenshotsOk: boolean,
 *   missingIds: string[],
 *   extraIds: string[],
 * }}
 */
function checkGoldenManifest(parsed) {
  const expected = buildGoldenManifest();
  const p = parsed && typeof parsed === "object" ? /** @type {any} */ (parsed) : {};
  const versionOk = p.version === expected.version;
  const componentOk = p.component === expected.component;
  const resolutionOk =
    p.resolution &&
    p.resolution.width === expected.resolution.width &&
    p.resolution.height === expected.resolution.height;
  const themesOk =
    Array.isArray(p.themes) &&
    expected.themes.every((t) => p.themes.includes(t));
  const expectedIds = expected.screenshots.map((s) => s.id);
  const actualIds = Array.isArray(p.screenshots)
    ? p.screenshots.filter((s) => s && typeof s.id === "string").map((s) => s.id)
    : [];
  const missingIds = expectedIds.filter((id) => !actualIds.includes(id));
  const extraIds = actualIds.filter((id) => !expectedIds.includes(id));
  // Order matters too — screenshots in row-literal order so the
  // visual-diff pipeline produces a deterministic baseline.
  const orderOk =
    actualIds.length === expectedIds.length &&
    expectedIds.every((id, i) => actualIds[i] === id);
  const screenshotsOk = missingIds.length === 0 && extraIds.length === 0 && orderOk;
  return {
    ok: !!(versionOk && componentOk && resolutionOk && themesOk && screenshotsOk),
    versionOk: !!versionOk,
    componentOk: !!componentOk,
    resolutionOk: !!resolutionOk,
    themesOk: !!themesOk,
    screenshotsOk: !!screenshotsOk,
    missingIds,
    extraIds,
  };
}

/**
 * Pure: validate that a workflow YAML body contains the required
 * row-literal anchors (path-filter targets `FederationExplorer.tsx`
 * + job runs the manifest validator + targets the golden directory).
 *
 * @param {string} yaml
 * @returns {{
 *   ok: boolean,
 *   hasTargetFile: boolean,
 *   hasGoldenDir: boolean,
 *   hasManifestStep: boolean,
 *   hasPullRequestTrigger: boolean,
 * }}
 */
function checkWorkflowContribution(yaml) {
  const src = typeof yaml === "string" ? yaml : "";
  const hasTargetFile = src.includes("FederationExplorer.tsx");
  // Workflow may reference the golden dir by full path OR by the
  // last segment (`__screenshots__/federation-explorer`).
  const hasGoldenDir = src.includes("__screenshots__/federation-explorer");
  // The manifest validation step is the M5.27 ship's core check.
  const hasManifestStep = src.includes("manifest.json") || src.includes("checkGoldenManifest");
  const hasPullRequestTrigger = /pull_request:/.test(src);
  return {
    ok: hasTargetFile && hasGoldenDir && hasManifestStep && hasPullRequestTrigger,
    hasTargetFile,
    hasGoldenDir,
    hasManifestStep,
    hasPullRequestTrigger,
  };
}

module.exports = {
  TARGET_WEBVIEW_FILE,
  GOLDEN_DIR,
  MANIFEST_FILENAME,
  WORKFLOW_FILENAME,
  WORKFLOW_JOB_NAME,
  THEME_VARIANTS,
  GOLDEN_WIDTH_PX,
  GOLDEN_HEIGHT_PX,
  MANIFEST_VERSION,
  buildGoldenScreenshotList,
  buildGoldenManifest,
  checkGoldenManifest,
  checkWorkflowContribution,
};
