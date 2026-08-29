// @ts-check
/**
 * FAI MCP CLI — typed error class with `.code` + `.context`.
 *
 * Mirrors the per-module error pattern used by `frootai orchard` (see
 * `cli/lib/orchard/cli-error.js`). Lifted into its own type so failure modes
 * raised by the `frootai mcp` family can be distinguished from orchard CLI
 * failures at the top-level dispatcher / test harness.
 *
 * Stable error codes (Doctrine #2 — auditable from outside):
 *   - `not_yet_implemented` — sub-command stub during the M4 ship arc.
 *   - `unknown_subcommand` — surfaced by the dispatcher before command exec.
 *   - `user_error` / `network` / `trust_block` / `upstream_failure`
 *     — categories the M4.21 reporter maps to deterministic exit codes
 *       (1 / 2 / 3 / 4 respectively). Sub-commands raise these as they land.
 */
"use strict";

class McpCliError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {object} [context]
   */
  constructor(code, message, context) {
    super(message);
    this.name = "McpCliError";
    this.code = code;
    this.context = context || {};
  }
}

module.exports = { McpCliError };
