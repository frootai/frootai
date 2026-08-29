// @ts-check
/**
 * M5.30 — Phase M5 close (pure core).
 *
 * Row literal: Phase M5 close: tag `federation-vscode-v0.5.0`; retro;
 * verify-phase-close.js `--phase M5`; Phase M6 kickoff doc.
 *
 * Pure: zero `vscode` imports + zero IO. Hosts the canonical tag
 * literal + retro/kickoff path anchors + a thin wrapper around the
 * shared `verifyPhaseM5Close` so the gate can drive the same
 * verifier the operator runs at tag-time.
 *
 * Decisions:
 *   - Tag literal pinned to `federation-vscode-v0.5.0` byte-for-byte.
 *     The verifier in `phase-close-verify.js` uses the same constant
 *     under a separate `PHASE_M5_TAG` declaration; gate case 11
 *     cross-row asserts the two literals match so a future ship that
 *     renames one trips both.
 *   - Retro path mirrors the M4 convention (`retros/federation-phaseN.md`).
 *   - Kickoff path mirrors the M5 convention
 *     (`fai-mcp-expansion/0N-phase-mN-kickoff.md` — the same
 *     directory the masterplan + tracker live in).
 *   - This pure-core does NOT re-implement the verifier — it
 *     delegates to the shared `phase-close-verify.js` module so a
 *     single verification entry point exists. Gate case 5 invokes
 *     the verifier through this delegation to confirm the wiring
 *     works end-to-end.
 */
"use strict";

/** Row-literal tag. */
const PHASE_M5_TAG = "federation-vscode-v0.5.0";

/** Phase number (informational — operators see "M5" in the tracker). */
const PHASE_NUMBER = "M5";

/** Retro doc path (workspace-root-relative). */
const PHASE_M5_RETRO_RELPATH = "frootai-planning/planning/retros/federation-phase5.md";

/** Phase M6 kickoff doc path (workspace-root-relative). */
const PHASE_M6_KICKOFF_RELPATH = "frootai-planning/planning/fai-mcp-expansion/08-phase-m6-kickoff.md";

/** Verifier module path (relative to this file's parent dirs). */
const VERIFIER_MODULE_RELPATH = "frootai-core/scripts/orchard/lib/release/phase-close-verify";

/**
 * Pure: load the shared verifier module + invoke its M5 close check.
 * Returns the verifier's report unchanged. The gate drives this so
 * the same code path the operator runs at tag-time is exercised.
 *
 * @param {{ repoRoot?: string }} [opts]
 * @returns {Promise<{ phase: string, tag: string, ok: boolean, total: number, passed: number, failed: number, checks: Array<{name: string, ok: boolean, message?: string}>, failed_check_names: string[] }>}
 */
async function runVerifier(opts) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const verifier = require("../../../scripts/orchard/lib/release/phase-close-verify");
  if (typeof verifier.verifyPhaseM5Close !== "function") {
    throw new Error("phase-close-verify.js does not export verifyPhaseM5Close");
  }
  return await verifier.verifyPhaseM5Close(opts || {});
}

/**
 * Pure: build the canonical tag-push doctrine string the operator
 * runs after the verifier passes. Includes the row-literal tag +
 * push command + final summary anchor.
 *
 * @returns {string}
 */
function formatTagDoctrine() {
  return [
    "# Phase M5 close doctrine",
    "",
    `1. Run \`node frootai-core/scripts/orchard/verify-phase-close.js --phase ${PHASE_NUMBER}\` — must exit 0.`,
    `2. Tag: \`git tag -a ${PHASE_M5_TAG} -m "Phase M5 close — VS Code federation surface"\``,
    `3. Push: \`git push origin ${PHASE_M5_TAG}\``,
    `4. Retro: ${PHASE_M5_RETRO_RELPATH}`,
    `5. Phase M6 kickoff: ${PHASE_M6_KICKOFF_RELPATH}`,
  ].join("\n");
}

module.exports = {
  PHASE_M5_TAG,
  PHASE_NUMBER,
  PHASE_M5_RETRO_RELPATH,
  PHASE_M6_KICKOFF_RELPATH,
  VERIFIER_MODULE_RELPATH,
  runVerifier,
  formatTagDoctrine,
};
