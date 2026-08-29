// @ts-check
/**
 * FAI MCP CLI — per-row case-count floor source-of-truth (M4.22 ship).
 *
 * Mirrors the M2.25 federation `_floors.{mjs,py}` pattern: every counter
 * is a ratchet, never bump it DOWN. The companion CI script at
 * `cli/scripts/check-mcp-case-floor.mjs` reads these constants, walks the
 * `cli-mcp-*.test.js` files, and exits non-zero on any per-file regression
 * (a test was removed without an explicit floor adjustment).
 *
 * Path-location note: the M4.22 row spec language is `tests/mcp/*`. The
 * actual gate files live at `frootai-core/scripts/orchard/test/cli-mcp-*`
 * for parity with the orchard CLI test convention (M4.1-M4.21 all ship
 * there). THIS floors file lives at the spec-literal `cli/tests/mcp/`
 * path so the canonical M4.22 surface still exists at the documented
 * location and the script's walk target is the single source of truth.
 */
"use strict";

/** The M4.22 row-spec literal: ≥ 50 cases. Floor is the current count. */
const TOTAL_CASE_FLOOR = 300;

/**
 * Per-test-file case floors. Adding a NEW gate file = add it here.
 * Bumping an existing floor UP = ratchet (welcome).
 * Bumping DOWN = forbidden (the gate exits non-zero).
 */
const PER_FILE_FLOORS = Object.freeze({
  "cli-mcp-attach.test.js": 13,
  "cli-mcp-bin-routing.test.js": 16,
  "cli-mcp-bundled-snapshot.test.js": 8,
  "cli-mcp-cache-refresh.test.js": 17,
  "cli-mcp-completion-bash.test.js": 18,
  "cli-mcp-completion-powershell.test.js": 14,
  "cli-mcp-completion-zsh.test.js": 16,
  "cli-mcp-detach.test.js": 12,
  "cli-mcp-discover.test.js": 17,
  "cli-mcp-dispatch.test.js": 12,
  "cli-mcp-exit-codes.test.js": 21,
  "cli-mcp-invoke-persist.test.js": 11,
  "cli-mcp-invoke.test.js": 15,
  "cli-mcp-list.test.js": 12,
  "cli-mcp-publish.test.js": 20,
  "cli-mcp-state-schema.test.js": 20,
  "cli-mcp-test-all.test.js": 8,
  "cli-mcp-test.test.js": 13,
  "cli-mcp-trust-list.test.js": 14,
  "cli-mcp-trust-set.test.js": 12,
  "cli-mcp-trust-unset.test.js": 11,
});

/**
 * Subcommand → list of gate files that explicitly exercise it. The gate
 * asserts each of the 8 spec subcommands has AT LEAST one dedicated file
 * present + each entry passes its own floor. Meta-gates (dispatcher,
 * bin-routing, completion, state-schema, exit-codes, bundled-snapshot,
 * cache-refresh) are excluded from per-subcommand attribution since they
 * cover orthogonal infrastructure rather than a single subcommand.
 */
const SUBCOMMAND_GATES = Object.freeze({
  list:     ["cli-mcp-list.test.js"],
  discover: ["cli-mcp-discover.test.js"],
  attach:   ["cli-mcp-attach.test.js"],
  detach:   ["cli-mcp-detach.test.js"],
  trust:    ["cli-mcp-trust-list.test.js", "cli-mcp-trust-set.test.js", "cli-mcp-trust-unset.test.js"],
  test:     ["cli-mcp-test.test.js", "cli-mcp-test-all.test.js"],
  invoke:   ["cli-mcp-invoke.test.js", "cli-mcp-invoke-persist.test.js"],
  publish:  ["cli-mcp-publish.test.js"],
});

/**
 * State-roundtrip coverage floor — pairs of operations that must be
 * exercised together by at least one test in the suite. The gate
 * substring-greps the test bodies for these markers (lower-cased).
 */
const ROUNDTRIP_MARKERS = Object.freeze([
  "attach then detach",         // M4.6
  "set then unset",             // M4.9
  "single-area test followed by --all",   // M4.11
  "set followed by --all",      // alias
]);

/** Minimum unique roundtrip-marker hits required across the suite. */
const ROUNDTRIP_FLOOR = 3;

module.exports = {
  TOTAL_CASE_FLOOR,
  PER_FILE_FLOORS,
  SUBCOMMAND_GATES,
  ROUNDTRIP_MARKERS,
  ROUNDTRIP_FLOOR,
};
