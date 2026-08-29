// @ts-check
/**
 * FAI VS Code — federation command core logic (M5.4 ship).
 *
 * Pure deps-injected exec helpers for the `frootai.federation.*`
 * commands. Lives in `.js` (NOT `.ts`) so unit tests can `require()` it
 * directly without the VS Code module being resolvable — the `vscode`
 * import lives ONLY in the sibling `federation.ts` wrapper.
 *
 * Doctrine alignment (carried over from the M4 CLI surface):
 *   - PIN_ONE_AHEAD per M5.14/M5.15: the default `FederationClient`
 *     throws `kernel_connection_pending` so VS Code activation doesn't
 *     blow up before the kernel-connection rows ship. Tests inject a
 *     fake client.
 *   - Default-off invariant: `enabled === false` short-circuits every
 *     command with a friendly info message; no kernel RPC, no state IO.
 *   - Cancellation is first-class: every QuickPick / confirm prompt
 *     returns `undefined` on dismissal, and the exec function resolves
 *     to `{ status: "cancelled" }` so the registered command exits
 *     cleanly with no side-effects.
 *   - The `auth.loaded` / `kernel.spawn` doctrines from M4.25/M4.27
 *     extend here: NEVER include a bearer token or tool argument blob
 *     in any operator-facing toast or output channel line.
 *
 * Exports the row-by-row exec functions (M5.4 ships only
 * `executeAttach`; later rows add `executeDetach` / `executeListAttached`
 * / `executeDiscover` / `executeTrustQuery` / `executeAttachFromManifest`
 * to the same module so the wrapper file stays thin).
 */
"use strict";

const { McpFederationError } = require("./federation-errors");

/**
 * @typedef {object} MarketplaceEntry
 * @property {string} name        Display name (e.g. "Microsoft Azure")
 * @property {string} slug        Area name used by `fai_attach_mcp`
 * @property {string} [owner]     Publisher (e.g. "microsoft")
 * @property {string} [desc]      One-line description
 * @property {string} [trust]     Resolved trust tier
 * @property {number} [installs]  Parsed install count
 *
 * @typedef {object} AttachedAreaEntry
 * @property {string} name        Area slug as returned by `fai_list_attached`
 * @property {string} [trust]     Resolved trust tier
 * @property {number} [toolCount] Number of federated tools currently exposed
 * @property {number} [idleMinutes] Minutes since last activity (kernel-side)
 * @property {string} [attachedAt]  ISO timestamp
 *
 * @typedef {object} AttachInvocation
 * @property {string} name                  Area slug to attach
 * @property {boolean} [trustOverride]      Skip the kernel-side prompt
 *
 * @typedef {object} AttachInvocationResult
 * @property {boolean} attached
 * @property {boolean} [blocked]            kernel-side trust gate refused
 * @property {string} [reason]
 * @property {string} [humanMessage]
 *
 * @typedef {object} DetachInvocation
 * @property {string} name        Area slug to detach
 *
 * @typedef {object} DetachInvocationResult
 * @property {boolean} detached
 * @property {boolean} [alreadyDetached]
 * @property {string} [reason]
 * @property {string} [humanMessage]
 *
 * @typedef {object} TrustQueryInvocation
 * @property {string} name        Publisher / area slug to look up.
 *
 * @typedef {object} TrustQueryResult
 * @property {string} name        Echoed publisher name (lowercased canonical form).
 * @property {string} tier        Resolved tier: "first-party-ms" | "verified-publisher"
 *                                | "community" | "unknown" | other.
 * @property {string} [source]    Where the tier was resolved from: "shipped" | "override" | etc.
 * @property {string} [notes]     Optional one-line human note (e.g. "override expires 2026-12-31").
 *
 * @typedef {object} ToolEntry
 * @property {string} name        Tool name (no `<area>.` prefix).
 * @property {string} [description] One-line human description.
 *
 * @typedef {object} FederationClient
 * @property {(opts?: { query?: string }) => Promise<MarketplaceEntry[]>} discover
 * @property {() => Promise<AttachedAreaEntry[]>} listAttached
 * @property {(args: { name: string }) => Promise<ToolEntry[]>} listAreaTools
 * @property {(args: AttachInvocation) => Promise<AttachInvocationResult>} attach
 * @property {(args: DetachInvocation) => Promise<DetachInvocationResult>} detach
 * @property {(args: TrustQueryInvocation) => Promise<TrustQueryResult>} trustQuery
 *
 * @typedef {object} AttachUx
 * @property {(items: MarketplaceEntry[]) => Promise<MarketplaceEntry | undefined>} pickArea
 *           Show a QuickPick over marketplace entries. Returns undefined on cancel.
 * @property {(area: MarketplaceEntry) => Promise<"yes" | "yes-override" | "no" | undefined>} confirmTrust
 *           Ask the operator to confirm the trust tier. `undefined` = cancel,
 *           `"no"` = explicit refusal, `"yes"` = standard attach,
 *           `"yes-override"` = attach with --trust-override semantics.
 * @property {(message: string) => void} showInfo
 * @property {(message: string) => void} showError
 * @property {() => void | Promise<void>} refreshAttachedView
 *
 * @typedef {object} AttachDeps
 * @property {FederationClient} client
 * @property {AttachUx} ux
 * @property {boolean} [enabled]   Default: true. When false, command is a no-op.
 * @property {string} [presetQuery]  Skip the marketplace fetch + use a single-item picker
 *                                    over the supplied slug (used by M5.9 attachFromManifest)
 *
 * @typedef {{ status: "ok",        name: string, alreadyAttached?: boolean } |
 *           { status: "cancelled", at: "pickArea" | "confirmTrust" } |
 *           { status: "disabled" } |
 *           { status: "no-results" } |
 *           { status: "refused",   name: string } |
 *           { status: "blocked",   name: string, reason?: string } |
 *           { status: "error",     code: string, message: string }} AttachOutcome
 *
 * @typedef {object} DetachUx
 * @property {(items: AttachedAreaEntry[]) => Promise<AttachedAreaEntry | undefined>} pickAttached
 *           Show a QuickPick over attached areas. Returns undefined on cancel.
 * @property {(message: string) => void} showInfo
 * @property {(message: string) => void} showError
 * @property {() => void | Promise<void>} refreshAttachedView
 *
 * @typedef {object} DetachDeps
 * @property {FederationClient} client
 * @property {DetachUx} ux
 * @property {boolean} [enabled]   Default: true. When false, command is a no-op.
 *
 * @typedef {{ status: "ok",        name: string, alreadyDetached?: boolean } |
 *           { status: "cancelled", at: "pickAttached" } |
 *           { status: "disabled" } |
 *           { status: "none-attached" } |
 *           { status: "error",     code: string, message: string }} DetachOutcome
 *
 * @typedef {"attached" | "catalog"} ExplorerTab
 *
 * @typedef {object} OpenExplorerOptions
 * @property {ExplorerTab} tab        Tab to pre-select inside the webview.
 * @property {boolean} [focus]        Whether to focus the panel (default true).
 * @property {boolean} [focusSearch]  Whether to focus the search box inside
 *                                    the webview (default false; M5.7 sets
 *                                    this for the `discoverMcp` command).
 *
 * @typedef {object} OpenExplorerResult
 * @property {boolean} revealed       True iff the panel was created or revealed.
 * @property {ExplorerTab} tab        Tab the webview was told to activate.
 * @property {boolean} [searchFocused] True iff the webview was told to
 *                                     focus the search box (M5.7).
 *
 * @typedef {object} FederationExplorerOpener
 * @property {(opts: OpenExplorerOptions) => Promise<OpenExplorerResult>} openExplorer
 *           Create-or-reveal a singleton Federation Explorer webview
 *           pre-selecting the supplied tab. Implementations must:
 *             - reuse the same panel on subsequent invocations,
 *             - post a `{type:"setActiveTab", tab}` message so the
 *               React app (M5.12) can switch tabs in-place,
 *             - honour `opts.focus !== false` for panel focus.
 *
 * @typedef {object} ListAttachedDeps
 * @property {FederationExplorerOpener} explorer
 * @property {{ showInfo: (m: string) => void, showError: (m: string) => void }} ux
 * @property {boolean} [enabled]   Default: true. When false, command is a no-op.
 *
 * @typedef {{ status: "ok",        tab: ExplorerTab } |
 *           { status: "disabled" } |
 *           { status: "error",     code: string, message: string }} OpenExplorerOutcome
 *
 * @typedef {object} TrustQueryUx
 * @property {() => Promise<string | undefined>} promptPublisherName
 *           Prompt the operator for a publisher / area name. Returns
 *           undefined on cancel; empty string is treated as cancel.
 * @property {(result: TrustQueryResult) => void} showResult
 *           Surface the resolved tier via vscode.window.showInformationMessage.
 * @property {(message: string) => void} showError
 *
 * @typedef {object} TrustQueryDeps
 * @property {FederationClient} client
 * @property {TrustQueryUx} ux
 * @property {boolean} [enabled]   Default: true. When false, command is a no-op.
 *
 * @typedef {{ status: "ok",        name: string, tier: string } |
 *           { status: "cancelled", at: "promptPublisherName" } |
 *           { status: "disabled" } |
 *           { status: "error",     code: string, message: string }} TrustQueryOutcome
 *
 * @typedef {object} ManifestContent
 * @property {object} [mcp_scope]
 * @property {string[]} [mcp_scope.attached]
 *
 * @typedef {object} ManifestReader
 * @property {() => Promise<{ path: string, content: unknown } | null>} read
 *           Resolve the active-workspace `fai-manifest.json`. Returns
 *           null when no workspace folder is open OR no manifest file
 *           exists; both states are operator-friendly (NOT errors).
 *           Throws `McpFederationError("manifest_read_failed")` on IO
 *           failure and `McpFederationError("manifest_parse_failed")`
 *           on malformed JSON.
 *
 * @typedef {object} BulkAttachUx
 * @property {(items: { name: string, trust?: string }[], manifestPath: string) => Promise<boolean | undefined>} confirmBatch
 *           Show a single confirmation listing every area in the
 *           manifest + its inferred trust tier. Returns true=attach
 *           all, false=cancel, undefined=dismissed.
 * @property {(message: string) => void} showInfo
 * @property {(message: string) => void} showError
 * @property {() => void | Promise<void>} refreshAttachedView
 *
 * @typedef {object} AttachFromManifestDeps
 * @property {FederationClient} client
 * @property {ManifestReader} reader
 * @property {BulkAttachUx} ux
 * @property {(name: string) => string} [resolveTrust]
 *           Optional pure resolver from area-name → trust tier (used
 *           only to render the confirmation list). Default: `() => "unknown"`.
 * @property {boolean} [enabled]   Default: true. When false, command is a no-op.
 *
 * @typedef {{ status: "ok",        manifestPath: string,
 *             attached: string[], failed: Array<{ name: string, code: string, message: string }> } |
 *           { status: "cancelled", at: "confirmBatch", manifestPath: string } |
 *           { status: "disabled" } |
 *           { status: "no-workspace" } |
 *           { status: "no-manifest" } |
 *           { status: "no-areas",   manifestPath: string } |
 *           { status: "error",      code: string, message: string }} AttachFromManifestOutcome
 */

/**
 * Execute the M5.4 `frootai.federation.attach` command. Pure (deps
 * injected), returns a discriminated outcome the registered command
 * wrapper turns into toasts / output-channel lines.
 *
 * @param {AttachDeps} deps
 * @returns {Promise<AttachOutcome>}
 */
async function executeAttach(deps) {
  if (!deps || !deps.client || !deps.ux) {
    throw new McpFederationError("user_error", "executeAttach: deps.client + deps.ux are required");
  }
  // Default-off invariant: short-circuit when the feature flag is off.
  if (deps.enabled === false) {
    deps.ux.showInfo("FrootAI Federation is disabled (frootai.federation.enabled = false).");
    return { status: "disabled" };
  }

  // ── Step 1: gather marketplace entries ────────────────────────────
  /** @type {MarketplaceEntry[]} */
  let entries = [];
  try {
    entries = await deps.client.discover({ query: deps.presetQuery });
  } catch (err) {
    const e = _asMcpFederationError(err, "discover_failed");
    deps.ux.showError(`Federation discover failed: ${e.message}`);
    return { status: "error", code: e.code, message: e.message };
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    deps.ux.showInfo("Federation marketplace returned no results. Re-run `frootai mcp discover --refresh` once online.");
    return { status: "no-results" };
  }

  // ── Step 2: QuickPick over marketplace entries ──────────────────
  let picked;
  try {
    picked = await deps.ux.pickArea(entries);
  } catch (err) {
    const e = _asMcpFederationError(err, "ux_pickArea_failed");
    deps.ux.showError(`QuickPick failed: ${e.message}`);
    return { status: "error", code: e.code, message: e.message };
  }
  if (!picked) return { status: "cancelled", at: "pickArea" };
  if (typeof picked.slug !== "string" || picked.slug.length === 0) {
    return { status: "error", code: "user_error", message: "picked entry missing area slug" };
  }

  // ── Step 3: confirm trust ───────────────────────────────────────
  let trustDecision;
  try {
    trustDecision = await deps.ux.confirmTrust(picked);
  } catch (err) {
    const e = _asMcpFederationError(err, "ux_confirmTrust_failed");
    deps.ux.showError(`Trust prompt failed: ${e.message}`);
    return { status: "error", code: e.code, message: e.message };
  }
  if (trustDecision === undefined) return { status: "cancelled", at: "confirmTrust" };
  if (trustDecision === "no") {
    deps.ux.showInfo(`Attach for "${picked.slug}" refused at trust prompt.`);
    return { status: "refused", name: picked.slug };
  }

  // ── Step 4: invoke fai_attach_mcp via the MCP client connection ──
  /** @type {AttachInvocationResult} */
  let attachResult;
  try {
    attachResult = await deps.client.attach({
      name: picked.slug,
      trustOverride: trustDecision === "yes-override",
    });
  } catch (err) {
    const e = _asMcpFederationError(err, "attach_failed");
    deps.ux.showError(`Failed to attach "${picked.slug}": ${e.message}`);
    return { status: "error", code: e.code, message: e.message };
  }

  if (attachResult && attachResult.blocked === true) {
    const reason = attachResult.humanMessage || attachResult.reason || "trust gate refused";
    deps.ux.showError(`Attach blocked for "${picked.slug}": ${reason}`);
    return { status: "blocked", name: picked.slug, reason };
  }
  if (!attachResult || attachResult.attached !== true) {
    const reason = (attachResult && (attachResult.humanMessage || attachResult.reason))
      || "kernel returned attached:false without a reason";
    deps.ux.showError(`Attach failed for "${picked.slug}": ${reason}`);
    return { status: "error", code: "attach_failed", message: reason };
  }

  // ── Step 5: refresh the attached view (M5.10 wires the real tree) ─
  try { await deps.ux.refreshAttachedView(); } catch { /* best-effort */ }

  deps.ux.showInfo(`Attached "${picked.slug}" to the federation kernel.`);
  return { status: "ok", name: picked.slug };
}

/**
 * Execute the M5.5 `frootai.federation.detach` command. Pure (deps
 * injected). Flow per the row literal: `listAttached → pickAttached
 * QuickPick → client.detach({name}) → refreshAttachedView`. No trust
 * gate — detach is operator-initiated state cleanup, not a privilege
 * escalation.
 *
 * @param {DetachDeps} deps
 * @returns {Promise<DetachOutcome>}
 */
async function executeDetach(deps) {
  if (!deps || !deps.client || !deps.ux) {
    throw new McpFederationError("user_error", "executeDetach: deps.client + deps.ux are required");
  }
  if (deps.enabled === false) {
    deps.ux.showInfo("FrootAI Federation is disabled (frootai.federation.enabled = false).");
    return { status: "disabled" };
  }

  // ── Step 1: list attached areas ─────────────────────────────────
  /** @type {AttachedAreaEntry[]} */
  let entries = [];
  try {
    entries = await deps.client.listAttached();
  } catch (err) {
    const e = _asMcpFederationError(err, "list_attached_failed");
    deps.ux.showError(`Federation list-attached failed: ${e.message}`);
    return { status: "error", code: e.code, message: e.message };
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    deps.ux.showInfo("No federated areas are currently attached. Run \"FrootAI: Federation — Attach MCP Area\" first.");
    return { status: "none-attached" };
  }

  // ── Step 2: QuickPick over attached areas ───────────────────────
  let picked;
  try {
    picked = await deps.ux.pickAttached(entries);
  } catch (err) {
    const e = _asMcpFederationError(err, "ux_pickAttached_failed");
    deps.ux.showError(`QuickPick failed: ${e.message}`);
    return { status: "error", code: e.code, message: e.message };
  }
  if (!picked) return { status: "cancelled", at: "pickAttached" };
  if (typeof picked.name !== "string" || picked.name.length === 0) {
    return { status: "error", code: "user_error", message: "picked entry missing area name" };
  }

  // ── Step 3: invoke fai_detach_mcp via the MCP client connection ──
  /** @type {DetachInvocationResult} */
  let detachResult;
  try {
    detachResult = await deps.client.detach({ name: picked.name });
  } catch (err) {
    const e = _asMcpFederationError(err, "detach_failed");
    deps.ux.showError(`Failed to detach "${picked.name}": ${e.message}`);
    return { status: "error", code: e.code, message: e.message };
  }

  if (!detachResult || detachResult.detached !== true) {
    const reason = (detachResult && (detachResult.humanMessage || detachResult.reason))
      || "kernel returned detached:false without a reason";
    deps.ux.showError(`Detach failed for "${picked.name}": ${reason}`);
    return { status: "error", code: "detach_failed", message: reason };
  }

  // ── Step 4: refresh the attached view (M5.10 wires the real tree) ─
  try { await deps.ux.refreshAttachedView(); } catch { /* best-effort */ }

  const wasAlready = detachResult.alreadyDetached === true;
  deps.ux.showInfo(
    wasAlready
      ? `"${picked.name}" was not attached (no-op).`
      : `Detached "${picked.name}" from the federation kernel.`,
  );
  return {
    status: "ok",
    name: picked.name,
    ...(wasAlready ? { alreadyDetached: true } : {}),
  };
}

/**
 * Shared helper used by both `executeListAttached` (M5.6) and
 * `executeDiscoverMcp` (M5.7). Calls the injected `explorer.openExplorer`
 * with the requested tab + focus, validates the result, and returns a
 * discriminated outcome. Pure (deps injected).
 *
 * @param {ListAttachedDeps} deps
 * @param {OpenExplorerOptions} opts
 * @returns {Promise<OpenExplorerOutcome>}
 */
async function executeOpenExplorer(deps, opts) {
  if (!deps || !deps.explorer || !deps.ux) {
    throw new McpFederationError("user_error", "executeOpenExplorer: deps.explorer + deps.ux are required");
  }
  if (!opts || (opts.tab !== "attached" && opts.tab !== "catalog")) {
    throw new McpFederationError("user_error", "executeOpenExplorer: opts.tab must be \"attached\" or \"catalog\"");
  }
  if (deps.enabled === false) {
    deps.ux.showInfo("FrootAI Federation is disabled (frootai.federation.enabled = false).");
    return { status: "disabled" };
  }
  /** @type {OpenExplorerResult} */
  let result;
  try {
    result = await deps.explorer.openExplorer({
      tab: opts.tab,
      focus: opts.focus !== false,
      focusSearch: opts.focusSearch === true,
    });
  } catch (err) {
    const e = _asMcpFederationError(err, "explorer_open_failed");
    deps.ux.showError(`Failed to open Federation Explorer: ${e.message}`);
    return { status: "error", code: e.code, message: e.message };
  }
  if (!result || result.revealed !== true) {
    return {
      status: "error",
      code: "explorer_open_failed",
      message: "explorer.openExplorer returned revealed:false without throwing",
    };
  }
  // M5.13 webview persists last-tab in workspaceState; M5.12 React app
  // honours the `setActiveTab` postMessage. Both rows verify their wiring
  // against this exec's contract.
  return {
    status: "ok",
    tab: result.tab,
    ...(opts.focusSearch === true ? { searchFocused: result.searchFocused === true } : {}),
  };
}

/**
 * Execute the M5.6 `frootai.federation.listAttached` command. Pure
 * (deps injected). Per the row literal: opens the Federation Explorer
 * webview with the "Attached" tab pre-selected. Thin wrapper around
 * `executeOpenExplorer` so M5.7 (`discoverMcp` → "Catalog" tab) reuses
 * the same code path.
 *
 * @param {ListAttachedDeps} deps
 * @returns {Promise<OpenExplorerOutcome>}
 */
async function executeListAttached(deps) {
  return executeOpenExplorer(deps, { tab: "attached", focus: true });
}

/**
 * Execute the M5.7 `frootai.federation.discoverMcp` command. Pure
 * (deps injected). Per the row literal: opens the Federation Explorer
 * webview with the "Catalog" tab pre-selected AND the search box
 * focused. Thin wrapper around `executeOpenExplorer({tab:"catalog",
 * focus:true, focusSearch:true})` so the M5.6 + M5.7 commands share
 * one code path — only the option block differs.
 *
 * @param {ListAttachedDeps} deps
 * @returns {Promise<OpenExplorerOutcome>}
 */
async function executeDiscoverMcp(deps) {
  return executeOpenExplorer(deps, { tab: "catalog", focus: true, focusSearch: true });
}

/**
 * Validate a publisher / area name string. Mirrors the M4.5 area-name
 * regex (`^[a-zA-Z0-9_-]+$`) so the trust query rejects the same
 * Doctrine #5-forbidden shapes the kernel would reject anyway. Pure.
 *
 * @param {string | undefined | null} raw
 * @returns {{ valid: true, name: string } | { valid: false, reason: string }}
 */
function _normalisePublisherName(raw) {
  if (typeof raw !== "string") return { valid: false, reason: "name must be a string" };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { valid: false, reason: "name is empty" };
  if (trimmed.length > 64) return { valid: false, reason: "name longer than 64 chars" };
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { valid: false, reason: "allowed: letters / digits / underscore / hyphen (no dots or spaces)" };
  }
  return { valid: true, name: trimmed };
}

/**
 * Execute the M5.8 `frootai.federation.trustQuery` command. Pure (deps
 * injected). Per the row literal: input box for publisher name → calls
 * `fai_trust_query` → shows result in `vscode.window.showInformationMessage`.
 *
 * @param {TrustQueryDeps} deps
 * @returns {Promise<TrustQueryOutcome>}
 */
async function executeTrustQuery(deps) {
  if (!deps || !deps.client || !deps.ux) {
    throw new McpFederationError("user_error", "executeTrustQuery: deps.client + deps.ux are required");
  }
  if (deps.enabled === false) {
    deps.ux.showError("FrootAI Federation is disabled (frootai.federation.enabled = false).");
    return { status: "disabled" };
  }

  // ── Step 1: prompt for publisher name ────────────────────────────
  let raw;
  try {
    raw = await deps.ux.promptPublisherName();
  } catch (err) {
    const e = _asMcpFederationError(err, "ux_promptPublisher_failed");
    deps.ux.showError(`Publisher prompt failed: ${e.message}`);
    return { status: "error", code: e.code, message: e.message };
  }
  if (raw === undefined || raw === null || raw === "") {
    return { status: "cancelled", at: "promptPublisherName" };
  }
  const norm = _normalisePublisherName(raw);
  if (!norm.valid) {
    deps.ux.showError(`Invalid publisher name: ${norm.reason}`);
    return { status: "error", code: "user_error", message: norm.reason };
  }

  // ── Step 2: invoke fai_trust_query via the MCP client connection ──
  /** @type {TrustQueryResult} */
  let result;
  try {
    result = await deps.client.trustQuery({ name: norm.name });
  } catch (err) {
    const e = _asMcpFederationError(err, "trust_query_failed");
    deps.ux.showError(`Trust query failed for "${norm.name}": ${e.message}`);
    return { status: "error", code: e.code, message: e.message };
  }
  if (!result || typeof result.tier !== "string" || result.tier.length === 0) {
    const msg = "kernel returned a trust result without a tier";
    deps.ux.showError(`Trust query for "${norm.name}" returned an empty tier.`);
    return { status: "error", code: "trust_query_failed", message: msg };
  }

  // ── Step 3: surface via showInformationMessage ───────────────────
  try { deps.ux.showResult(result); } catch { /* best-effort — never let a toast throw break the command */ }
  return { status: "ok", name: norm.name, tier: result.tier };
}

/**
 * Extract a deduplicated, validated array of area names from a parsed
 * `fai-manifest.json` body. Pure. Invalid entries (non-string, dotted,
 * spaced, too long, empty) are silently dropped — the caller decides
 * what to do with the surviving list.
 *
 * @param {unknown} content
 * @returns {string[]}
 */
function _extractManifestAreas(content) {
  if (!content || typeof content !== "object") return [];
  const scope = /** @type {any} */ (content).mcp_scope;
  if (!scope || typeof scope !== "object") return [];
  const raw = scope.attached;
  if (!Array.isArray(raw)) return [];
  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  for (const entry of raw) {
    const norm = _normalisePublisherName(entry);
    if (!norm.valid) continue;
    if (seen.has(norm.name)) continue;
    seen.add(norm.name);
    out.push(norm.name);
  }
  return out;
}

/**
 * Execute the M5.9 `frootai.federation.attachFromManifest` command.
 * Pure (deps injected). Per the row literal: reads `fai-manifest.json`
 * in the active workspace → bulk-attaches every area in
 * `mcp_scope.attached`.
 *
 * Flow:
 *   1. `reader.read()` returns `{path, content}` or `null` (no workspace
 *      or no manifest = friendly empty-state outcome, not error).
 *   2. `_extractManifestAreas` validates + dedupes the list.
 *   3. ONE `confirmBatch` modal shows every area + its trust tier so
 *      the operator approves the bulk operation in one click.
 *   4. Per area, call `client.attach({name, trustOverride: true})`
 *      sequentially (the operator already consented to the batch).
 *      Per-area errors are collected, NOT thrown — the command never
 *      aborts a partial batch.
 *   5. `refreshAttachedView` once at the end.
 *
 * @param {AttachFromManifestDeps} deps
 * @returns {Promise<AttachFromManifestOutcome>}
 */
async function executeAttachFromManifest(deps) {
  if (!deps || !deps.client || !deps.reader || !deps.ux) {
    throw new McpFederationError("user_error", "executeAttachFromManifest: deps.client + deps.reader + deps.ux are required");
  }
  if (deps.enabled === false) {
    deps.ux.showInfo("FrootAI Federation is disabled (frootai.federation.enabled = false).");
    return { status: "disabled" };
  }

  // ── Step 1: read manifest ──────────────────────────────────────
  let manifest;
  try {
    manifest = await deps.reader.read();
  } catch (err) {
    const e = _asMcpFederationError(err, "manifest_read_failed");
    deps.ux.showError(`Manifest read failed: ${e.message}`);
    return { status: "error", code: e.code, message: e.message };
  }
  if (manifest === null) {
    // Distinguish no-workspace vs no-manifest via the reader contract:
    // the default reader returns `null` for both. The Ux info string is
    // different so we read the reader's intent from a small marker on
    // the returned value — BUT for the pure-core path we surface
    // "no-workspace" only when reader.read.workspaceMissing === true.
    /** @type {any} */
    const r = deps.reader;
    if (r && r.workspaceMissing === true) {
      deps.ux.showInfo("No active workspace folder. Open a folder containing fai-manifest.json first.");
      return { status: "no-workspace" };
    }
    deps.ux.showInfo("No fai-manifest.json in the active workspace.");
    return { status: "no-manifest" };
  }
  const areas = _extractManifestAreas(manifest.content);
  if (areas.length === 0) {
    deps.ux.showInfo(`fai-manifest.json has no mcp_scope.attached entries (${manifest.path}).`);
    return { status: "no-areas", manifestPath: manifest.path };
  }

  // ── Step 2: confirm the batch ──────────────────────────────────
  const resolveTrust = typeof deps.resolveTrust === "function" ? deps.resolveTrust : () => "unknown";
  const items = areas.map((name) => ({ name, trust: String(resolveTrust(name) || "unknown") }));
  let confirmed;
  try {
    confirmed = await deps.ux.confirmBatch(items, manifest.path);
  } catch (err) {
    const e = _asMcpFederationError(err, "ux_confirmBatch_failed");
    deps.ux.showError(`Batch confirmation failed: ${e.message}`);
    return { status: "error", code: e.code, message: e.message };
  }
  if (confirmed !== true) {
    return { status: "cancelled", at: "confirmBatch", manifestPath: manifest.path };
  }

  // ── Step 3: per-area attach (sequential, errors collected) ────
  /** @type {string[]} */
  const attached = [];
  /** @type {Array<{ name: string, code: string, message: string }>} */
  const failed = [];
  for (const name of areas) {
    /** @type {AttachInvocationResult} */
    let result;
    try {
      result = await deps.client.attach({ name, trustOverride: true });
    } catch (err) {
      const e = _asMcpFederationError(err, "attach_failed");
      failed.push({ name, code: e.code, message: e.message });
      continue;
    }
    if (!result || result.attached !== true) {
      const code = (result && result.blocked === true) ? "trust_block" : "attach_failed";
      const message = (result && (result.humanMessage || result.reason)) || "kernel returned attached:false";
      failed.push({ name, code, message });
      continue;
    }
    attached.push(name);
  }

  // ── Step 4: refresh view (best-effort) ────────────────────────
  try { await deps.ux.refreshAttachedView(); } catch { /* best-effort */ }

  // ── Step 5: aggregate report ──────────────────────────────────
  if (failed.length === 0) {
    deps.ux.showInfo(`Attached ${attached.length} area${attached.length === 1 ? "" : "s"} from manifest: ${attached.join(", ")}.`);
  } else if (attached.length === 0) {
    deps.ux.showError(`Failed to attach all ${failed.length} area${failed.length === 1 ? "" : "s"} from manifest.`);
  } else {
    deps.ux.showError(`Attached ${attached.length} — ${failed.length} failed (${failed.map((f) => f.name).join(", ")}).`);
  }
  return { status: "ok", manifestPath: manifest.path, attached, failed };
}

/**
 * Default FederationClient. Throws `kernel_connection_pending` from
 * every call until M5.14/M5.15 wire the real `mcp-server.ts` connection.
 * Mirrors the M4.1 dispatcher's `_notYetImplemented` PIN_ONE_AHEAD shape
 * so the extension activation path doesn't blow up before the kernel
 * connection rows ship.
 *
 * @returns {FederationClient}
 */
function buildPendingFederationClient() {
  return Object.freeze({
    discover: async () => {
      throw new McpFederationError(
        "kernel_connection_pending",
        "federation kernel connection lands at M5.14/M5.15",
        { hint: "Wait for the next M5 ship rows or run `frootai mcp discover` in a terminal." },
      );
    },
    listAttached: async () => {
      throw new McpFederationError(
        "kernel_connection_pending",
        "federation kernel connection lands at M5.14/M5.15",
        { hint: "Wait for the next M5 ship rows or run `frootai mcp list` in a terminal." },
      );
    },
    listAreaTools: async () => {
      throw new McpFederationError(
        "kernel_connection_pending",
        "federation kernel connection lands at M5.14/M5.15",
        { hint: "Wait for the next M5 ship rows or run `frootai mcp invoke <area>.<tool>` in a terminal." },
      );
    },
    attach: async () => {
      throw new McpFederationError(
        "kernel_connection_pending",
        "federation kernel connection lands at M5.14/M5.15",
        { hint: "Wait for the next M5 ship rows or run `frootai mcp attach` in a terminal." },
      );
    },
    detach: async () => {
      throw new McpFederationError(
        "kernel_connection_pending",
        "federation kernel connection lands at M5.14/M5.15",
        { hint: "Wait for the next M5 ship rows or run `frootai mcp detach` in a terminal." },
      );
    },
    trustQuery: async () => {
      throw new McpFederationError(
        "kernel_connection_pending",
        "federation kernel connection lands at M5.14/M5.15",
        { hint: "Wait for the next M5 ship rows or run `frootai mcp trust list` in a terminal." },
      );
    },
  });
}

/**
 * Convert any thrown value into a structured `McpFederationError`. Pure.
 *
 * @param {unknown} err
 * @param {string} defaultCode
 * @returns {InstanceType<typeof McpFederationError>}
 */
function _asMcpFederationError(err, defaultCode) {
  if (err instanceof McpFederationError) return err;
  const anyErr = /** @type {any} */ (err);
  const msg = (anyErr && anyErr.message) ? anyErr.message : String(err);
  return new McpFederationError(defaultCode, msg);
}

module.exports = {
  executeAttach,
  executeDetach,
  executeListAttached,
  executeDiscoverMcp,
  executeOpenExplorer,
  executeTrustQuery,
  executeAttachFromManifest,
  _extractManifestAreas,
  buildPendingFederationClient,
  _asMcpFederationError,
};
