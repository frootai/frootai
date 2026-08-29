// @ts-check
/**
 * FAI MCP CLI — deterministic exit-code taxonomy (M4.21 ship).
 *
 * The M4.21 row pins the operator-facing exit-code contract:
 *
 *   0  ok
 *   1  user-error      operator typed something the CLI couldn't honour
 *                      (missing arg, invalid flag, malformed file, etc.)
 *   2  network         fetch / HTTP / DNS failure — transient + retryable
 *   3  trust-block     the federation trust manifest rejected the attach
 *                      (no operator action besides updating trust.json)
 *   4  upstream-failure kernel spawn / RPC / tool crash — non-CLI fault
 *
 * Each `McpCliError.code` shipped across M4.3-M4.20 maps to exactly one
 * exit code via {@link CODE_TO_EXIT_MAP}. Codes the CLI invents in
 * future rows MUST be added to the map to lock the contract; unknown
 * codes default to USER_ERROR (1) so an accidental new code surfaces
 * as a benign operator-input problem rather than a silent exit 0.
 *
 * Non-`McpCliError` throws (an unexpected JS exception escaping a
 * subcommand) map to `UPSTREAM_FAILURE` (4) — the CLI itself crashed,
 * which the operator should treat as a transient kernel-tier fault
 * rather than user input they can fix.
 */
"use strict";

const { McpCliError } = require("./cli-error");

const EXIT_CODES = Object.freeze({
  OK: 0,
  USER_ERROR: 1,
  NETWORK: 2,
  TRUST_BLOCK: 3,
  UPSTREAM_FAILURE: 4,
});

/**
 * Frozen map from `McpCliError.code` literal → exit code. Adding a new
 * row is the explicit operator-contract acknowledgement that the new
 * code's failure semantic falls into one of the four documented buckets.
 *
 * @type {Readonly<Record<string, number>>}
 */
const CODE_TO_EXIT_MAP = Object.freeze({
  // ── user-error (1): operator input / config the operator can fix ──
  "user_error": EXIT_CODES.USER_ERROR,
  "state_read_failed": EXIT_CODES.USER_ERROR,
  "state_write_failed": EXIT_CODES.USER_ERROR,
  "marketplace_cache_read_failed": EXIT_CODES.USER_ERROR,
  "marketplace_cache_write_failed": EXIT_CODES.USER_ERROR,
  "trust_user_read_failed": EXIT_CODES.USER_ERROR,
  "trust_user_write_failed": EXIT_CODES.USER_ERROR,
  "session_lock_read_failed": EXIT_CODES.USER_ERROR,
  "session_lock_write_failed": EXIT_CODES.USER_ERROR,
  "session_lock_clear_failed": EXIT_CODES.USER_ERROR,

  // ── network (2): transient HTTP / DNS / timeout ────────────────────
  "network": EXIT_CODES.NETWORK,
  // M4.26: --no-network refusal — the operator opted out of any remote
  // calls; the CLI must NOT mask this as a user-error since the cause
  // is environmental (air-gap) rather than typed input.
  "network_blocked": EXIT_CODES.NETWORK,

  // ── trust-block (3): the trust manifest rejected the attach ────────
  "trust_block": EXIT_CODES.TRUST_BLOCK,

  // ── upstream-failure (4): kernel / federated tool / packaging ──────
  "attach_failed": EXIT_CODES.UPSTREAM_FAILURE,
  "upstream_failure": EXIT_CODES.UPSTREAM_FAILURE,
  "trust_shipped_read_failed": EXIT_CODES.UPSTREAM_FAILURE,
  "trust_write_verification_failed": EXIT_CODES.UPSTREAM_FAILURE,
  "not_yet_implemented": EXIT_CODES.UPSTREAM_FAILURE,
});

/**
 * Map an error to its deterministic exit code.
 *
 *  - `McpCliError` with a known code → mapped via {@link CODE_TO_EXIT_MAP}
 *  - `McpCliError` with an unknown code → `USER_ERROR` (safer default —
 *    a new error code is more likely a validation gap than a kernel crash)
 *  - any other thrown value → `UPSTREAM_FAILURE` (the CLI itself blew up)
 *
 * @param {unknown} err
 * @returns {number}
 */
function mapErrorToExitCode(err) {
  if (err instanceof McpCliError) {
    if (typeof err.code === "string" && Object.prototype.hasOwnProperty.call(CODE_TO_EXIT_MAP, err.code)) {
      return CODE_TO_EXIT_MAP[err.code];
    }
    return EXIT_CODES.USER_ERROR;
  }
  return EXIT_CODES.UPSTREAM_FAILURE;
}

/**
 * Format an `McpCliError` for the operator. Spec literal from the M4.21
 * row: `frootai mcp: <code>: <msg>`, optionally followed by a remediation
 * hint indented two spaces. Non-`McpCliError` throws get a generic shape.
 *
 * Pure — no IO. The dispatcher writes the returned string to stderr.
 *
 * @param {unknown} err
 * @returns {string}
 */
function formatErrorReport(err) {
  if (err instanceof McpCliError) {
    const lines = [`frootai mcp: ${err.code}: ${err.message}`];
    if (err.context && typeof err.context === "object" && typeof err.context.hint === "string") {
      lines.push(`  Hint: ${err.context.hint}`);
    }
    return lines.join("\n");
  }
  const message = err instanceof Error ? err.message : String(err);
  return `frootai mcp: unexpected_error: ${message}`;
}

module.exports = {
  EXIT_CODES,
  CODE_TO_EXIT_MAP,
  mapErrorToExitCode,
  formatErrorReport,
};
