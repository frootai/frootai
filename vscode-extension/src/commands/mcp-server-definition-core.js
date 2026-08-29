// @ts-check
/**
 * M5.21 — Federated MCP Server Definition Provider (pure core).
 *
 * Row literal: second MCP Server Definition Provider id
 * `frootai-federated`: exposes the kernel's federated tool list to
 * other VS Code MCP consumers without re-spawning; documented in
 * extension README.
 *
 * Pure: zero `vscode` imports + zero IO. Builds the array of MCP
 * server-definition descriptors the .ts wrapper hands to
 * `vscode.lm.registerMcpServerDefinitionProvider`. The wrapper
 * converts each descriptor to an actual `vscode.McpStdioServerDefinition`
 * at registration time — keeping the conversion in the wrapper means
 * the pure-core can be gate-tested without the `vscode` global.
 *
 * Decisions:
 *   - Provider id is `frootai-federated` per the row literal — pinned
 *     byte-for-byte, NOT paraphrased. Other VS Code MCP consumers may
 *     resolve us by id; renaming would break their config.
 *   - Existing `frootai` provider (declared in package.json) covers
 *     the BUILT-IN MCP server. The `frootai-federated` provider is
 *     STRICTLY ADDITIVE: it never returns the built-in's definition,
 *     never overrides it, and never re-spawns the kernel. The kernel
 *     spawn is owned by the M5.22+ federation runtime.
 *   - When no kernel command is resolvable (PIN_ONE_AHEAD: M5.22+
 *     wires command resolution from the M5.14/M5.15 env-block),
 *     `buildFederatedServerDefinitions` returns an empty array. The
 *     VS Code MCP host treats an empty array as "this provider has
 *     nothing to contribute today" — the right empty-state.
 *   - Per-area separate definitions (one per attached area) would
 *     bloat the MCP host's server list with N entries that all point
 *     at the same kernel process. Instead we ship ONE definition per
 *     active kernel; the kernel itself dispatches to the federated
 *     areas via tool-name prefix (`<area>.<tool>` per M4 doctrine).
 *     Gate case 12 pins this single-definition shape.
 */
"use strict";

/** Row-literal provider id. NEVER paraphrase. */
const FEDERATED_PROVIDER_ID = "frootai-federated";

/** Row-literal display label for the provider in the MCP host UI. */
const FEDERATED_PROVIDER_LABEL = "FrootAI Federated";

/** Per-server definition label (shown in the MCP host's server list). */
const FEDERATED_SERVER_LABEL = "FrootAI Federation Kernel";

/** Server-definition kind — only stdio is supported today (M5.22+ may add http). */
const SERVER_KIND_STDIO = "stdio";

/**
 * @typedef {object} FederatedServerInput
 * @property {string} [kernelCommand]    Resolved path to the `frootai-mcp` binary.
 *                                        Empty / missing = nothing to expose (PIN_ONE_AHEAD).
 * @property {ReadonlyArray<string>} [kernelArgs]   Argv tail. Default: ["serve", "--federation"].
 * @property {Readonly<Record<string, string>>} [env]   Env-block from M5.14/M5.15 builder.
 * @property {ReadonlyArray<{name: string}>} [attached] Currently-attached areas (empty allowed).
 *                                                       Used for `version` field so other MCP
 *                                                       consumers can detect "tool list changed".
 *
 * @typedef {object} StdioServerDefinitionDescriptor
 * @property {"stdio"} kind
 * @property {string} label
 * @property {string} command
 * @property {ReadonlyArray<string>} args
 * @property {Readonly<Record<string, string>>} env
 * @property {string} version       // ISO timestamp or attached-area-set hash
 */

const DEFAULT_KERNEL_ARGS = Object.freeze(["serve", "--federation"]);

/**
 * Pure: build a deterministic version string from the attached-area
 * list. Two MCP host queries with the same attached set return the
 * same version, so VS Code's MCP host can cache + invalidate cleanly.
 *
 * @param {ReadonlyArray<{name: string}> | null | undefined} attached
 * @returns {string}
 */
function buildFederationVersionTag(attached) {
  if (!Array.isArray(attached) || attached.length === 0) return "fed-empty";
  const names = attached
    .filter((a) => a && typeof a.name === "string" && a.name.length > 0)
    .map((a) => a.name.trim())
    .sort();
  if (names.length === 0) return "fed-empty";
  return `fed-${names.join("|")}`;
}

/**
 * Pure: build the array of server-definition descriptors for the
 * `frootai-federated` provider. PIN_ONE_AHEAD: returns `[]` when no
 * kernel command is resolvable.
 *
 * @param {FederatedServerInput | null | undefined} input
 * @returns {ReadonlyArray<Readonly<StdioServerDefinitionDescriptor>>}
 */
function buildFederatedServerDefinitions(input) {
  const inp = input || /** @type {FederatedServerInput} */ ({});
  const command = (typeof inp.kernelCommand === "string" && inp.kernelCommand.trim().length > 0)
    ? inp.kernelCommand.trim()
    : "";
  if (command.length === 0) {
    // PIN_ONE_AHEAD: M5.22+ resolves the kernel binary path from
    // settings / shipped binary / npx fallback. Until then, expose
    // nothing — better than fabricating a path that doesn't exist.
    return Object.freeze([]);
  }
  const args = Array.isArray(inp.kernelArgs) && inp.kernelArgs.length > 0
    ? Object.freeze(inp.kernelArgs.slice().filter((a) => typeof a === "string"))
    : DEFAULT_KERNEL_ARGS;
  const env = Object.freeze({ ...(inp.env && typeof inp.env === "object" ? inp.env : {}) });
  const version = buildFederationVersionTag(inp.attached);

  return Object.freeze([
    Object.freeze({
      kind: SERVER_KIND_STDIO,
      label: FEDERATED_SERVER_LABEL,
      command,
      args,
      env,
      version,
    }),
  ]);
}

/**
 * Pure: validate that a package.json `mcpServerDefinitionProviders`
 * array contains both the existing built-in `frootai` provider AND
 * the new `frootai-federated` provider. Used by the gate to detect
 * a missing contribution.
 *
 * @param {Array<{id?: string, label?: string}> | null | undefined} declared
 * @returns {{ ok: boolean, builtin: boolean, federated: boolean }}
 */
function checkProviderContributions(declared) {
  const arr = Array.isArray(declared) ? declared : [];
  const builtin = arr.some((p) => p && p.id === "frootai");
  const federated = arr.some((p) => p && p.id === FEDERATED_PROVIDER_ID);
  return { ok: builtin && federated, builtin, federated };
}

module.exports = {
  FEDERATED_PROVIDER_ID,
  FEDERATED_PROVIDER_LABEL,
  FEDERATED_SERVER_LABEL,
  SERVER_KIND_STDIO,
  DEFAULT_KERNEL_ARGS,
  buildFederationVersionTag,
  buildFederatedServerDefinitions,
  checkProviderContributions,
};
