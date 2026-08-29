// @ts-check
/**
 * FAI VS Code — federation command error taxonomy (M5.4 ship).
 *
 * Mirrors the M4 `cli/lib/mcp/cli-error.js` shape. Codes (extensible —
 * additions append, never reuse a code for a different semantic):
 *
 *   user_error                    operator typed something wrong
 *   kernel_connection_pending     M5.14/M5.15 wires the real connection
 *   discover_failed               fai_discover_mcp RPC failed
 *   list_attached_failed          fai_list_attached RPC failed
 *   list_area_tools_failed        fai_list_area_tools RPC failed (M5.10)
 *   attach_failed                 fai_attach_mcp RPC failed
 *   detach_failed                 fai_detach_mcp RPC failed
 *   trust_query_failed            fai_trust_query RPC failed
 *   manifest_read_failed          fai-manifest.json IO error (M5.9)
 *   manifest_parse_failed         fai-manifest.json JSON / shape error (M5.9)
 *   no_workspace                  no active workspace folder (M5.9)
 *   explorer_open_failed          createWebviewPanel / reveal threw
 *   ux_pickArea_failed            VS Code QuickPick host threw
 *   ux_pickAttached_failed        VS Code QuickPick host threw (detach UX)
 *   ux_promptPublisher_failed     VS Code input-box host threw (trustQuery)
 *   ux_confirmBatch_failed        VS Code modal host threw (bulk attach)
 *   ux_confirmTrust_failed        VS Code info-message host threw
 */
"use strict";

class McpFederationError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {object} [context]
   */
  constructor(code, message, context) {
    super(message);
    this.name = "McpFederationError";
    this.code = code;
    this.context = context && typeof context === "object" ? context : {};
  }
}

module.exports = { McpFederationError };
