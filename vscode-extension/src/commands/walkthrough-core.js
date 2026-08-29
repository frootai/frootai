// @ts-check
/**
 * M5.23 — "Try federation" walkthrough section (pure core).
 *
 * Row literal: extend the welcome walkthrough with a 3-step "Try
 * federation" section (open Federation Explorer → attach Markitdown
 * → convert a file).
 *
 * Pure: zero `vscode` imports + zero IO. Hosts the canonical step
 * descriptors + a validator the gate uses to drift-detect the
 * package.json declaration.
 *
 * Decisions:
 *   - Steps land at the END of the existing `frootai.gettingStarted`
 *     walkthrough (Browse → Search → Init → MCP → Evaluate →
 *     [federation steps]) — the federation surface is an extension of
 *     the core flow, NOT the entry point. Reordering steps would
 *     break operators mid-walkthrough.
 *   - Step ids are prefixed `tryFederation_` so they're grep-distinct
 *     from the pre-M5.23 steps + so a future Group-D walkthrough
 *     section can be authored without id collision.
 *   - The 3-step ordering matches the row literal exactly:
 *       1. tryFederation_openExplorer  → frootai.federation.discoverMcp (M5.7)
 *       2. tryFederation_attachMarkitdown → frootai.federation.attach (M5.4)
 *       3. tryFederation_convertFile   → no extension command (operator
 *          invokes the MCP tool from chat); description text guides them.
 *   - "Markitdown" is referenced because Microsoft ships a public
 *     `microsoft/markitdown-mcp` area that's a known-good first-time
 *     federation attach target. The walkthrough does NOT pre-fill the
 *     attach quickpick — operators learn the search affordance.
 *   - Each step ships its own walkthrough media markdown matching the
 *     existing `media/walkthrough-*.md` naming convention; gate case 13
 *     statically asserts both the package.json `media.markdown` field
 *     AND the file existence on disk.
 */
"use strict";

/** Existing walkthrough id we extend (NEVER replace). */
const TARGET_WALKTHROUGH_ID = "frootai.gettingStarted";

/** Section title (informational — VS Code doesn't render section headers
 *  inline today, but the term grounds the row-literal "Try federation"
 *  identifier for grep + future authors). */
const SECTION_TITLE = "Try federation";

const STEP_OPEN_EXPLORER = "tryFederation_openExplorer";
const STEP_ATTACH_MARKITDOWN = "tryFederation_attachMarkitdown";
const STEP_CONVERT_FILE = "tryFederation_convertFile";

const STEP_IDS = Object.freeze([
  STEP_OPEN_EXPLORER,
  STEP_ATTACH_MARKITDOWN,
  STEP_CONVERT_FILE,
]);

/**
 * @typedef {object} WalkthroughStep
 * @property {string} id
 * @property {string} title
 * @property {string} description    Markdown — may include `[Label](command:...)` links
 * @property {{ markdown?: string, image?: { dark: string, light: string, altText: string } }} [media]
 */

/**
 * Pure: build the 3 federation walkthrough steps.
 *
 * @returns {ReadonlyArray<Readonly<WalkthroughStep>>}
 */
function buildFederationWalkthroughSteps() {
  return Object.freeze([
    Object.freeze({
      id: STEP_OPEN_EXPLORER,
      title: "Open Federation Explorer",
      description:
        "Discover MCP areas published to the FrootAI Marketplace and attach them to your kernel.\n\n[Open Federation Explorer](command:frootai.federation.discoverMcp)",
      media: Object.freeze({ markdown: "media/walkthrough-fed-explorer.md" }),
    }),
    Object.freeze({
      id: STEP_ATTACH_MARKITDOWN,
      title: "Attach Markitdown",
      description:
        "Try federation by attaching Microsoft's `markitdown` MCP area — it converts files (PDF, DOCX, PPTX, images) to clean Markdown.\n\n[Attach an MCP Area](command:frootai.federation.attach)",
      media: Object.freeze({ markdown: "media/walkthrough-fed-attach-markitdown.md" }),
    }),
    Object.freeze({
      id: STEP_CONVERT_FILE,
      title: "Convert a File with Markitdown",
      description:
        "From the FrootAI chat or any MCP-aware agent, ask: _\"Convert `quarterly-report.pdf` to Markdown.\"_ The federated `markitdown.*` tools will route to the kernel automatically.\n\n[See Attached Areas](command:frootai.federation.listAttached)",
      media: Object.freeze({ markdown: "media/walkthrough-fed-convert-file.md" }),
    }),
  ]);
}

/**
 * Pure: validate that a package.json `walkthroughs` array contains
 * the 3 M5.23 federation steps appended (NOT replacing) to the
 * existing `frootai.gettingStarted` walkthrough.
 *
 * Returns per-step status so the gate reports exactly which step is
 * missing / re-ordered.
 *
 * @param {Array<{id?: string, steps?: Array<{id?: string, title?: string, description?: string, media?: object}>}> | null | undefined} declared
 * @returns {{
 *   ok: boolean,
 *   walkthroughFound: boolean,
 *   stepsAppended: boolean,
 *   byStep: Record<string, { present: boolean, indexFromEnd: number }>
 * }}
 */
function checkFederationStepsContribution(declared) {
  const arr = Array.isArray(declared) ? declared : [];
  const wt = arr.find((w) => w && w.id === TARGET_WALKTHROUGH_ID);
  if (!wt || !Array.isArray(wt.steps)) {
    return {
      ok: false,
      walkthroughFound: false,
      stepsAppended: false,
      byStep: {
        [STEP_OPEN_EXPLORER]: { present: false, indexFromEnd: -1 },
        [STEP_ATTACH_MARKITDOWN]: { present: false, indexFromEnd: -1 },
        [STEP_CONVERT_FILE]: { present: false, indexFromEnd: -1 },
      },
    };
  }
  const steps = wt.steps;
  const total = steps.length;
  /** @type {Record<string, {present: boolean, indexFromEnd: number}>} */
  const byStep = {};
  for (const id of STEP_IDS) {
    const idx = steps.findIndex((s) => s && s.id === id);
    byStep[id] = {
      present: idx > -1,
      indexFromEnd: idx > -1 ? (total - 1 - idx) : -1,
    };
  }
  const allPresent = STEP_IDS.every((id) => byStep[id].present);
  // "Appended" means the 3 steps occupy the last 3 slots in the SAME
  // row-literal order (open → attach → convert).
  const lastThreeIds = steps.slice(-3).map((s) => s && s.id);
  const stepsAppended =
    lastThreeIds.length === 3 &&
    lastThreeIds[0] === STEP_OPEN_EXPLORER &&
    lastThreeIds[1] === STEP_ATTACH_MARKITDOWN &&
    lastThreeIds[2] === STEP_CONVERT_FILE;
  return {
    ok: allPresent && stepsAppended,
    walkthroughFound: true,
    stepsAppended,
    byStep,
  };
}

module.exports = {
  TARGET_WALKTHROUGH_ID,
  SECTION_TITLE,
  STEP_OPEN_EXPLORER,
  STEP_ATTACH_MARKITDOWN,
  STEP_CONVERT_FILE,
  STEP_IDS,
  buildFederationWalkthroughSteps,
  checkFederationStepsContribution,
};
