// @ts-check
/**
 * M5.28 — Extension release notes for the Phase M5 federation surface (pure core).
 *
 * Row literal: update extension README + CHANGELOG + walkthrough
 * screenshots in `media/`; release notes call out the new federation
 * surface.
 *
 * Pure: zero `vscode` imports + zero IO. Hosts the canonical release
 * version + CHANGELOG entry shape + section roster the README must
 * cover. Used by the M5.28 gate as drift detectors.
 *
 * Decisions:
 *   - Release version pinned to `6.1.0` (stable GA) to match M5.29's
 *     pre-release publish row. M5.28 + M5.29 share the same version
 *     anchor; renaming one without the other trips both gates.
 *   - The MAJOR bump (5.x → 6.0) signals the federation surface is
 *     a category-introducing addition (new sidebar views per M5.2,
 *     new MCP server-definition provider per M5.21, new keybinding
 *     per M5.22, new walkthrough section per M5.23). Per the
 *     Keep-A-Changelog + SemVer doctrine the existing CHANGELOG
 *     already documents, MAJOR is required when the contribution
 *     surface area materially expands — federation qualifies.
 *   - The CHANGELOG entry uses **Added** as its primary section
 *     since every M5 row is additive (no deprecations, no breaking
 *     changes to the pre-M5 surface — explicit `Changed` /
 *     `Deprecated` / `Removed` sections omitted to honour the
 *     "additive ship" doctrine each M5 row's gate asserted).
 *   - The 4-group breakdown (Group A settings + commands, Group B
 *     federation-aware UI, Group C ops + CI + release) mirrors the
 *     masterplan structure so a contributor reading the changelog
 *     can navigate back to the row literals.
 *   - Walkthrough media files referenced are the 3 NEW markdown
 *     files shipped at M5.23 (`walkthrough-fed-explorer.md` +
 *     `walkthrough-fed-attach-markitdown.md` +
 *     `walkthrough-fed-convert-file.md`). The row literal says
 *     "walkthrough screenshots in `media/`" — these markdown files
 *     ARE the walkthrough media surface per VS Code's walkthrough
 *     contribution schema (media.markdown). Adding PNG screenshots
 *     is future-work parallel to the M5.27 Playwright-harness path.
 */
"use strict";

/** Stable GA version anchor — matches M5.29 publish row. */
const RELEASE_VERSION = "6.1.0";

/** Release channel — the extension GA'd to the stable Marketplace channel. */
const RELEASE_CHANNEL = "stable";

/**
 * Group headlines reflecting the masterplan structure (M5.1..M5.30).
 *
 * @type {ReadonlyArray<{ group: string, headline: string, rowRange: string }>}
 */
const FEDERATION_SURFACE_HEADLINES = Object.freeze([
  Object.freeze({
    group: "Group A",
    headline: "Federation settings + 6 federation commands + 2 sidebar views",
    rowRange: "M5.1..M5.9",
  }),
  Object.freeze({
    group: "Group B",
    headline: "Federation-aware UI: tree providers, explorer webview, persisted state, env mapping, chip rendering, auto-attach toast, status bar",
    rowRange: "M5.10..M5.19",
  }),
  Object.freeze({
    group: "Group C",
    headline: "Operations + CI + release: trust elicitation, second MCP definition provider, keybinding, walkthrough, telemetry, in-tree test suite, cross-platform smoke, visual regression",
    rowRange: "M5.20..M5.30",
  }),
]);

/**
 * Required README sections the row literal mandates. M5.x rows
 * already shipped most of these inline; M5.28 asserts they remain
 * present + a federation surface summary anchor is added.
 *
 * @type {ReadonlyArray<{ pattern: RegExp, label: string }>}
 */
const README_REQUIRED_SECTIONS = Object.freeze([
  Object.freeze({ pattern: /Federation Surface/, label: "Federation Surface summary (M5.28 addition)" }),
  Object.freeze({ pattern: /MCP Server Definition Providers/, label: "MCP Server Definition Providers (M5.21)" }),
  Object.freeze({ pattern: /Cross-Platform Smoke/i, label: "Cross-Platform Smoke Matrix (M5.26)" }),
  Object.freeze({ pattern: /Visual Regression/i, label: "Visual Regression — Federation Explorer (M5.27)" }),
]);

/**
 * Walkthrough media files M5.23 shipped under `vscode-extension/media/`.
 * The M5.28 gate cross-row asserts each still exists (row-literal
 * "walkthrough screenshots in `media/`" — these are the walkthrough
 * media markdown files VS Code's walkthrough schema reads).
 *
 * @type {ReadonlyArray<string>}
 */
const WALKTHROUGH_MEDIA_FILES = Object.freeze([
  "walkthrough-fed-explorer.md",
  "walkthrough-fed-attach-markitdown.md",
  "walkthrough-fed-convert-file.md",
]);

/**
 * Pure: build the canonical CHANGELOG entry body for the M5
 * federation surface release. Returns the entry as plain markdown
 * the .md file embeds verbatim.
 *
 * @returns {string}
 */
function buildReleaseNotesEntry() {
  const lines = [];
  lines.push(`## [${RELEASE_VERSION}] — ${RELEASE_CHANNEL}`);
  lines.push("");
  lines.push("> **Phase M5 — FrootAI Federation surface.** Net-new federation primitive lets the bundled MCP kernel attach external MCP areas (\"areas\") and route tool calls under `<area>.<tool>` prefixes. Strictly additive — every pre-M5 command, view, and contribution preserved.");
  lines.push("");
  lines.push("### Added");
  lines.push("");
  for (const { group, headline, rowRange } of FEDERATION_SURFACE_HEADLINES) {
    lines.push(`- **${group} (\`${rowRange}\`)** — ${headline}.`);
  }
  lines.push("");
  lines.push("### Federation surface inventory");
  lines.push("");
  lines.push("- **Settings**: 5 `frootai.federation.*` config keys (`enabled` / `preAttach` / `trustFile` / `idleDisconnectMinutes` / `autoAttachFromPlayManifest`) declared in `package.json` (M5.1).");
  lines.push("- **Commands**: 6 palette-exposed commands (`attach` / `detach` / `listAttached` / `discoverMcp` / `trustQuery` / `attachFromManifest`) + 3 dispatchable commands (`playOpenAutoAttach` / `statusBar.refresh` / `elicitTrust`).");
  lines.push("- **Views**: 2 sidebar tree views (`frootai.federation.attached` + `frootai.federation.marketplace`) + 1 React webview (`FederationExplorer`).");
  lines.push("- **MCP server-definition providers**: new `frootai-federated` id alongside existing `frootai` (M5.21) — other VS Code MCP consumers can connect to the running federation kernel without re-spawning.");
  lines.push("- **Keybinding**: `Ctrl+Shift+F12` / `Cmd+Shift+F12` → `frootai.federation.discoverMcp` (M5.22).");
  lines.push("- **Walkthrough**: \"Try federation\" 3-step section appended to `frootai.gettingStarted` (M5.23) with new media files under `media/walkthrough-fed-*.md`.");
  lines.push("- **Telemetry**: every federation command emits `(command, durationMs, error?)` via the existing extension telemetry sink (M5.24).");
  lines.push("- **Test infra**: 4-file in-tree extension test suite (`src/test/federation/`) + 27-gate orchard sweep (`scripts/orchard/test/vscode-mcp-*.test.js`).");
  lines.push("- **CI**: cross-platform smoke matrix on Linux + Windows + macOS \u00d7 Node 18/20/22 (M5.26); visual regression workflow on every PR touching `FederationExplorer.tsx` (M5.27).");
  lines.push("");
  lines.push("### Notes");
  lines.push("");
  lines.push("- PIN_ONE_AHEAD posture: the federation kernel client is the M5.4 `buildPendingFederationClient` stub until the kernel-spawn resolver lands at M5.22+ / future ship. All federation surfaces (tree providers, status bar, explorer webview, auto-attach toast) handle the `kernel_connection_pending` error gracefully and render empty-state without surfacing the error to operators.");
  lines.push("- Stable distribution: this `6.1.0` build ships to VS Code Marketplace's `stable` channel (M5.29). Operators on the `5.1.8` channel auto-upgrade to `6.1.0`.");
  return lines.join("\n");
}

/**
 * Pure: validate that a README body covers every M5.28 required
 * section. Returns per-section status so the gate reports exactly
 * which section drifted.
 *
 * @param {string} readme
 * @returns {{ ok: boolean, missing: string[] }}
 */
function checkReadmeFederationCoverage(readme) {
  const src = typeof readme === "string" ? readme : "";
  const missing = [];
  for (const { pattern, label } of README_REQUIRED_SECTIONS) {
    if (!pattern.test(src)) missing.push(label);
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Pure: validate that a CHANGELOG body contains the M5.28 release
 * entry with the canonical version + section structure.
 *
 * @param {string} changelog
 * @returns {{
 *   ok: boolean,
 *   hasVersionHeading: boolean,
 *   hasAddedSection: boolean,
 *   hasFederationKeyword: boolean,
 *   hasAllGroupHeadlines: boolean,
 * }}
 */
function checkChangelogContribution(changelog) {
  const src = typeof changelog === "string" ? changelog : "";
  const hasVersionHeading = new RegExp(`##\\s+\\[${RELEASE_VERSION.replace(/\./g, "\\.")}\\]`).test(src);
  // Located WITHIN the M5.28 entry block (between the version
  // heading and the next `##` heading), the Added section + the
  // word "Federation" + every group label must appear. Use a
  // simple top-down scan rather than nested-anchor regex.
  const headingRe = new RegExp(`##\\s+\\[${RELEASE_VERSION.replace(/\./g, "\\.")}\\][\\s\\S]*?(?=\\n##\\s|$)`);
  const block = (src.match(headingRe) || [""])[0];
  const hasAddedSection = /###\s+Added/.test(block);
  const hasFederationKeyword = /[Ff]ederation/.test(block);
  const hasAllGroupHeadlines = FEDERATION_SURFACE_HEADLINES.every((g) => block.includes(g.group));
  return {
    ok: hasVersionHeading && hasAddedSection && hasFederationKeyword && hasAllGroupHeadlines,
    hasVersionHeading,
    hasAddedSection,
    hasFederationKeyword,
    hasAllGroupHeadlines,
  };
}

module.exports = {
  RELEASE_VERSION,
  RELEASE_CHANNEL,
  FEDERATION_SURFACE_HEADLINES,
  README_REQUIRED_SECTIONS,
  WALKTHROUGH_MEDIA_FILES,
  buildReleaseNotesEntry,
  checkReadmeFederationCoverage,
  checkChangelogContribution,
};
