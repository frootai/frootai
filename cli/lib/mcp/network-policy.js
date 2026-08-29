// @ts-check
/**
 * FAI MCP CLI — `--no-network` policy gate (M4.26 ship).
 *
 * Default-permissive: when the operator does NOT pass `--no-network`,
 * the policy is a frozen no-op singleton so every `assertAllowed(...)`
 * call falls through with zero cost. When `--no-network` IS passed,
 * the policy throws a structured `McpCliError("network_blocked")` from
 * the canonical surfaces that would otherwise reach the network:
 *
 *   1. `kernel-client.defaultSpawnClient` — `npx -y frootai-mcp@<v>`
 *      pulls from the npm registry on first run. With `--no-network`
 *      we REQUIRE an explicit `binPath` / `FROOTAI_MCP_BIN` (a kernel
 *      that the operator has already installed locally) and refuse to
 *      fall back to `npx`. If the binary is set, the spawn proceeds —
 *      the air-gapped operator is still able to drive the kernel.
 *
 *   2. `marketplace-cache.refreshMarketplaceCache` — `fetch(<URL>)` is
 *      short-circuited. The reader still falls through to the bundled
 *      offline snapshot (the M4.17 doctrine), so `frootai mcp discover`
 *      keeps working without ever reaching the network.
 *
 * The policy itself doesn't decide WHICH surfaces are remote — each
 * surface calls `assertAllowed(label)` where `label` is a free-form
 * string used in the verbose telemetry envelope (`network.blocked`
 * event) and the operator-facing error hint.
 *
 * Mirrors the `verbose-reporter.js` (M4.25) pattern: frozen no-op
 * singleton when disabled, factory when enabled, behavior is contract-
 * locked by `cli-mcp-no-network.test.js` (M4.26 gate).
 */
"use strict";

const { McpCliError } = require("./cli-error");

/**
 * @typedef {object} NetworkPolicy
 * @property {boolean} enabled
 * @property {(label: string, hint?: string) => void} assertAllowed
 *           Throws `McpCliError("network_blocked")` when enabled.
 *           When disabled, returns silently.
 */

/**
 * Frozen no-op policy used when `--no-network` is off. Returned by the
 * factory when `enabled` is falsy so callers can rely on a stable
 * identity for the disabled case.
 *
 * @type {NetworkPolicy}
 */
const NOOP_POLICY = Object.freeze({
  enabled: false,
  assertAllowed: () => {},
});

/**
 * Build a network policy. When `enabled` is false, returns the frozen
 * no-op singleton. When true, returns a frozen object whose
 * `assertAllowed(label, hint?)` throws a structured error.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.enabled]
 * @returns {NetworkPolicy}
 */
function createNetworkPolicy(opts) {
  const o = opts || {};
  if (!o.enabled) return NOOP_POLICY;
  return Object.freeze({
    enabled: true,
    assertAllowed(label, hint) {
      const why = (typeof label === "string" && label.length > 0)
        ? label
        : "remote network access";
      throw new McpCliError(
        "network_blocked",
        `--no-network blocks ${why}`,
        {
          hint: typeof hint === "string" && hint.length > 0
            ? hint
            : "Re-run without --no-network, or provide a local fallback (FROOTAI_MCP_BIN / bundled snapshot).",
          label: why,
        },
      );
    },
  });
}

module.exports = {
  NOOP_POLICY,
  createNetworkPolicy,
};
