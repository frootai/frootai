// @ts-check
/**
 * FAI MCP CLI — case-floor source of truth (M4.22 ship).
 *
 * Ratchet contract (mirrors M2.25 federation case-floor): the gate
 * script asserts the live test counts are >= these floors. Floors
 * MAY ratchet UP as new tests land; they MUST NOT be lowered without
 * a deliberate ship row that documents which tests were retired.
 *
 * Pinned at the M4.22 baseline (well above the row-spec literal "≥ 50
 * unit cases"). Increase a floor when a follow-on row adds tests.
 */
"use strict";

/**
 * Aggregate floor: total `await test(` invocations across the whole
 * `cli-mcp-*.test.js` suite. Spec literal: ≥ 50. Ratcheted to the
 * post-M4.30 baseline of 440 (M4.29 = 425, plus the M4.30 phase-close
 * gate's 15 cases). Phase M4 close — final ratchet of the M4 arc.
 */
const TOTAL_CASE_FLOOR = 440;

/**
 * Per-subcommand floor: each of the 8 `frootai mcp` subcommands has
 * dedicated coverage in at least one gate file. A subcommand's count
 * is the SUM of cases across every gate that exercises it (e.g.
 * `discover` aggregates cli-mcp-discover + cli-mcp-cache-refresh +
 * cli-mcp-bundled-snapshot since the latter two are discover-driven).
 *
 * @type {Readonly<Record<string, number>>}
 */
const PER_SUBCOMMAND_FLOOR = Object.freeze({
  list: 26,
  discover: 42,
  attach: 27,
  detach: 26,
  trust: 37,
  test: 21,
  invoke: 40,
  publish: 20,
});

/**
 * Map subcommand name → array of gate-file basenames (without
 * `.test.js`) that contribute to that subcommand's case count.
 *
 * @type {Readonly<Record<string, ReadonlyArray<string>>>}
 */
const SUBCOMMAND_TO_FILES = Object.freeze({
  list: ["cli-mcp-list", "cli-mcp-lifecycle"],
  discover: ["cli-mcp-discover", "cli-mcp-cache-refresh", "cli-mcp-bundled-snapshot"],
  attach: ["cli-mcp-attach", "cli-mcp-lifecycle"],
  detach: ["cli-mcp-detach", "cli-mcp-lifecycle"],
  trust: ["cli-mcp-trust-list", "cli-mcp-trust-set", "cli-mcp-trust-unset"],
  test: ["cli-mcp-test", "cli-mcp-test-all"],
  invoke: ["cli-mcp-invoke", "cli-mcp-invoke-persist", "cli-mcp-lifecycle"],
  publish: ["cli-mcp-publish"],
});

/**
 * Per-error-code floor: every error code emitted by M4.3-M4.21 must be
 * exercised by at least N test files. The counter scans for the LITERAL
 * `"<code>"` string in every test body, so a single test that asserts
 * `caught.code === "user_error"` counts as one hit.
 *
 * Floor of `1` means "at least one test must reference this code". Codes
 * with broader coverage get higher floors to lock the ratchet.
 *
 * @type {Readonly<Record<string, number>>}
 */
const PER_ERROR_CODE_FLOOR = Object.freeze({
  user_error: 10,
  network: 1,
  network_blocked: 1,
  trust_block: 3,
  attach_failed: 1,
  upstream_failure: 2,
  not_yet_implemented: 1,
  state_read_failed: 1,
  marketplace_cache_read_failed: 1,
  trust_shipped_read_failed: 1,
  trust_user_read_failed: 1,
  trust_write_verification_failed: 1,
});

/**
 * State-persistence round-trip test names. Each named test must exist
 * in the corresponding gate file — proves attach → readState round
 * trips, detach → readState round trips, etc.
 *
 * @type {ReadonlyArray<{ file: string, namePattern: RegExp }>}
 */
const ROUNDTRIP_REQUIREMENTS = Object.freeze([
  { file: "cli-mcp-detach", namePattern: /attach then detach returns to clean state/ },
  { file: "cli-mcp-test",   namePattern: /testing a SECOND area appends/ },
  { file: "cli-mcp-test",   namePattern: /REPLACES the lastHealthCheck entry/ },
  { file: "cli-mcp-trust-unset", namePattern: /set then unset restores shipped value/ },
  { file: "cli-mcp-state-schema", namePattern: /writeState output validates clean/ },
  { file: "cli-mcp-lifecycle", namePattern: /attach then detach returns to clean state via dispatch round-trip/ },
]);

module.exports = {
  TOTAL_CASE_FLOOR,
  PER_SUBCOMMAND_FLOOR,
  SUBCOMMAND_TO_FILES,
  PER_ERROR_CODE_FLOOR,
  ROUNDTRIP_REQUIREMENTS,
};
