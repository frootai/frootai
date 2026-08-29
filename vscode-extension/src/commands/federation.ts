/**
 * FAI VS Code — federation command surface (M5.4 ship).
 *
 * Thin VS Code wiring layer over `federation-core.js`. The pure exec
 * logic + the `FederationClient` PIN_ONE_AHEAD stub live in the .js
 * sibling so they can be unit-tested without the VS Code module being
 * resolvable. This file ONLY:
 *
 *   - imports `vscode`,
 *   - wraps `vscode.window.showQuickPick` / `showInformationMessage`
 *     into the `AttachUx` shape `federation-core` expects,
 *   - reads `frootai.federation.enabled` from settings (M5.1),
 *   - registers `frootai.federation.attach` (M5.4 row) via
 *     `vscode.commands.registerCommand`.
 *
 * Future M5 rows extend this file with:
 *   - registration of the other 5 commands from M5.2 (M5.5-M5.9)
 *   - the real `FederationClient` impl pointing at the running kernel
 *     subprocess (M5.14/M5.15)
 *   - the attached-view refresh hook (M5.10)
 */
import * as vscode from "vscode";

// Pure-core is plain JS so its own gates can require() it without
// pulling in the `vscode` module (which isn't resolvable in unit tests).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const federationCore = require("./federation-core") as typeof import("./federation-core");

export function createDefaultFederationClient(): ReturnType<typeof federationCore.buildPendingFederationClient> {
  return federationCore.buildPendingFederationClient();
}
// M5.18 — Play-open auto-attach pure-core (gate-tested in plain Node).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const playAutoAttachCore = require("./play-auto-attach-core") as {
  AUTO_ATTACH_PROMPT_PREFIX: string;
  ATTACH_BUTTON_LABEL: string;
  formatAutoAttachPrompt(areas: ReadonlyArray<string>): string;
  executePlayAutoAttach(deps: {
    client: { listAttached: () => Promise<Array<{ name: string }>>; attach: (args: { name: string; trustOverride?: boolean }) => Promise<{ attached: boolean; blocked?: boolean; reason?: string; humanMessage?: string }> };
    ux: {
      showAutoAttachPrompt(prompt: string, button: string): Promise<"attach" | "dismiss" | undefined>;
      showInfo(message: string): void;
      showError(message: string): void;
      refreshAttachedView?: () => void | Promise<void>;
    };
    settings: { enabled?: boolean; autoAttachFromPlayManifest?: boolean };
    manifest: unknown;
  }): Promise<{ status: string; [key: string]: unknown }>;
};
// M5.19 — Status bar pure-core (gate-tested in plain Node).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const statusBarCore = require("./federation-status-bar-core") as {
  IDLE_WARNING_THRESHOLD_MIN: number;
  DEFAULT_IDLE_DISCONNECT_MIN: number;
  STATUS_BAR_COMMAND: string;
  STATUS_BAR_ALIGNMENT: string;
  STATUS_BAR_PRIORITY: number;
  formatStatusBarText(count: number): string;
  computeStatusBarState(input: {
    attached: ReadonlyArray<{ name: string; toolCount?: number; idleMinutes?: number }> | null | undefined;
    idleDisconnectMinutes?: number;
  }): Readonly<{
    text: string;
    tooltip: string;
    color: "none" | "warning";
    count: number;
    warningAreas: ReadonlyArray<string>;
  }>;
};
// M5.20 — Trust elicitation pure-core (gate-tested in plain Node).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const trustElicitationCore = require("./trust-elicitation-core") as {
  BUTTON_ALLOW: string;
  BUTTON_ALLOW_ONCE: string;
  BUTTON_BLOCK: string;
  TIER_ALLOWED: string;
  TIER_BLOCKED: string;
  TRUST_FILE_VERSION: number;
  formatTrustPrompt(areaName: string, reason?: string): string;
  decodeButtonResponse(response: string | undefined | null): "allow" | "allow-once" | "block" | "cancelled";
  executeTrustElicitation(deps: {
    areaName: string;
    reason?: string;
    ux: {
      showTrustPrompt(opts: { areaName: string; prompt: string; buttons: ReadonlyArray<string> }): Promise<string | undefined>;
      showInfo(message: string): void;
      showError(message: string): void;
    };
    trustStore: {
      read(): Promise<{ version: number; overrides: Record<string, { tier: string; decidedAt?: string }> }>;
      write(file: { version: number; overrides: Record<string, { tier: string; decidedAt?: string }> }): Promise<void>;
    };
    now?: () => string;
  }): Promise<{ status: string; persisted?: boolean; retry?: boolean; code?: string; message?: string }>;
};
// M5.21 — Federated MCP server-definition pure-core (gate-tested in plain Node).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mcpServerDefinitionCore = require("./mcp-server-definition-core") as {
  FEDERATED_PROVIDER_ID: string;
  FEDERATED_PROVIDER_LABEL: string;
  FEDERATED_SERVER_LABEL: string;
  SERVER_KIND_STDIO: string;
  DEFAULT_KERNEL_ARGS: ReadonlyArray<string>;
  buildFederationVersionTag(attached: ReadonlyArray<{ name: string }> | null | undefined): string;
  buildFederatedServerDefinitions(input: {
    kernelCommand?: string;
    kernelArgs?: ReadonlyArray<string>;
    env?: Readonly<Record<string, string>>;
    attached?: ReadonlyArray<{ name: string }>;
  } | null | undefined): ReadonlyArray<Readonly<{
    kind: "stdio";
    label: string;
    command: string;
    args: ReadonlyArray<string>;
    env: Readonly<Record<string, string>>;
    version: string;
  }>>;
};
// M5.24 — Federation command telemetry pure-core (gate-tested in plain Node).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const federationTelemetryCore = require("./federation-telemetry-core") as {
  FEDERATION_TELEMETRY_EVENT: string;
  withFederationTelemetry<F extends (...args: unknown[]) => Promise<unknown>>(
    fullCmd: string,
    handler: F,
    emit: (eventName: string, subcommand: string, extra: Record<string, string>) => void | Promise<void>,
  ): F;
};
// M5.24 — Existing extension telemetry sink (per row literal "existing
// extension telemetry sink"). Re-uses the A5.24 orchard telemetry path
// — same EVENT_ENUM, same ALLOWED_PROP_KEYS, same anon-id + opt-in.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const telemetryEmit = require("../orchard-client/telemetry-emit.js") as {
  emitVscodeEvent(
    eventName: string,
    vscodeSubcommand: string,
    extra?: Record<string, string>,
  ): Promise<{ sent: boolean; decision?: string }>;
};

/**
 * M5.24 — wrap a federation command handler so each invocation emits
 * `(command, durationMs, error?)` to the existing `emitVscodeEvent`
 * telemetry sink. Re-used at every `vscode.commands.registerCommand`
 * site for `frootai.federation.*` commands.
 */
function wrapFedCmd<F extends (...args: unknown[]) => Promise<unknown>>(fullCmd: string, handler: F): F {
  return federationTelemetryCore.withFederationTelemetry(
    fullCmd,
    handler,
    (eventName, subcommand, extra) => {
      void telemetryEmit.emitVscodeEvent(eventName, subcommand, extra);
    },
  );
}

type MarketplaceEntry = {
  name: string;
  slug: string;
  owner?: string;
  desc?: string;
  trust?: string;
  installs?: number;
};

type AttachedAreaEntry = {
  name: string;
  trust?: string;
  toolCount?: number;
  idleMinutes?: number;
  attachedAt?: string;
};

type TrustDecision = "yes" | "yes-override" | "no" | undefined;

/**
 * Build the default `AttachUx` adapter from the supplied output channel.
 * Pure-construction (no side-effects); the closures only fire when the
 * command runs.
 */
function buildDefaultAttachUx(output: vscode.OutputChannel) {
  return {
    async pickArea(items: MarketplaceEntry[]): Promise<MarketplaceEntry | undefined> {
      const pickItems: (vscode.QuickPickItem & { _entry: MarketplaceEntry })[] = items.map((e) => ({
        label: e.name || e.slug,
        description: e.trust ? `[${e.trust}]` : undefined,
        detail: e.desc || "",
        _entry: e,
      }));
      const picked = await vscode.window.showQuickPick(pickItems, {
        title: "Federation — pick an area to attach",
        placeHolder: "Search the MCP marketplace…",
        matchOnDescription: true,
        matchOnDetail: true,
      });
      return picked ? picked._entry : undefined;
    },
    async confirmTrust(area: MarketplaceEntry): Promise<TrustDecision> {
      // First-party / verified publishers attach without a prompt.
      const tier = (area.trust || "unknown").toLowerCase();
      if (tier === "first-party-ms" || tier === "verified-publisher") return "yes";
      const message =
        `Area "${area.slug}" resolves to trust tier "${tier}". ` +
        `Attach to the federation kernel now?`;
      const choice = await vscode.window.showWarningMessage(
        message, { modal: true }, "Attach", "Attach (skip future prompts)", "Cancel",
      );
      if (choice === "Attach") return "yes";
      if (choice === "Attach (skip future prompts)") return "yes-override";
      if (choice === "Cancel") return "no";
      return undefined;  // dialog dismissed
    },
    showInfo(message: string): void {
      void vscode.window.showInformationMessage(message);
      output.appendLine(`[${new Date().toISOString()}] [federation] info: ${message}`);
    },
    showError(message: string): void {
      void vscode.window.showErrorMessage(message);
      output.appendLine(`[${new Date().toISOString()}] [federation] error: ${message}`);
    },
    async refreshAttachedView(): Promise<void> {
      // M5.10 will wire this to the real FederatedMcpProvider tree.
      try {
        await vscode.commands.executeCommand("frootai.federation.attached.refresh");
      } catch { /* tree provider not yet registered; safe to swallow until M5.10 */ }
    },
  };
}

/**
 * Default `DetachUx` adapter. Mirrors `buildDefaultAttachUx` but the
 * picker iterates attached areas (returned by `fai_list_attached`) and
 * there is NO trust prompt — detach is operator-initiated state
 * cleanup, not a privilege escalation.
 */
function buildDefaultDetachUx(output: vscode.OutputChannel) {
  return {
    async pickAttached(items: AttachedAreaEntry[]): Promise<AttachedAreaEntry | undefined> {
      const pickItems: (vscode.QuickPickItem & { _entry: AttachedAreaEntry })[] = items.map((e) => ({
        label: e.name,
        description: e.trust ? `[${e.trust}]` : undefined,
        detail: [
          typeof e.toolCount === "number" ? `${e.toolCount} tools` : null,
          typeof e.idleMinutes === "number" ? `idle ${e.idleMinutes}m` : null,
        ].filter(Boolean).join(" • "),
        _entry: e,
      }));
      const picked = await vscode.window.showQuickPick(pickItems, {
        title: "Federation — pick an attached area to detach",
        placeHolder: "Select an attached area…",
        matchOnDescription: true,
        matchOnDetail: true,
      });
      return picked ? picked._entry : undefined;
    },
    showInfo(message: string): void {
      void vscode.window.showInformationMessage(message);
      output.appendLine(`[${new Date().toISOString()}] [federation] info: ${message}`);
    },
    showError(message: string): void {
      void vscode.window.showErrorMessage(message);
      output.appendLine(`[${new Date().toISOString()}] [federation] error: ${message}`);
    },
    async refreshAttachedView(): Promise<void> {
      try {
        await vscode.commands.executeCommand("frootai.federation.attached.refresh");
      } catch { /* tree provider not yet registered; safe to swallow until M5.10 */ }
    },
  };
}

/**
 * Default `TrustQueryUx` adapter for M5.8. Surfaces the publisher input
 * box via `vscode.window.showInputBox` and shows the resolved tier via
 * `vscode.window.showInformationMessage`.
 */
function buildDefaultTrustQueryUx(output: vscode.OutputChannel) {
  return {
    async promptPublisherName(): Promise<string | undefined> {
      const input = await vscode.window.showInputBox({
        title: "Federation — query publisher trust",
        prompt: "Publisher / area name (e.g. azure, github, microsoft)",
        placeHolder: "Enter publisher name",
        ignoreFocusOut: true,
        validateInput: (v) => {
          const t = (v || "").trim();
          if (t.length === 0) return null; // allow empty (cancel-ish)
          if (t.length > 64) return "Name longer than 64 chars.";
          if (!/^[a-zA-Z0-9_-]+$/.test(t)) {
            return "Allowed: letters / digits / underscore / hyphen (no dots or spaces).";
          }
          return null;
        },
      });
      return input;
    },
    showResult(result: { name: string; tier: string; source?: string; notes?: string }): void {
      const parts = [`Trust tier for "${result.name}": ${result.tier}`];
      if (result.source) parts.push(`(source: ${result.source})`);
      if (result.notes) parts.push(`— ${result.notes}`);
      const message = parts.join(" ");
      void vscode.window.showInformationMessage(message);
      output.appendLine(`[${new Date().toISOString()}] [federation.trustQuery] ${message}`);
    },
    showError(message: string): void {
      void vscode.window.showErrorMessage(message);
      output.appendLine(`[${new Date().toISOString()}] [federation.trustQuery] error: ${message}`);
    },
  };
}

/**
 * Read the M5.1 `frootai.federation.enabled` master switch.
 */
function isFederationEnabled(): boolean {
  const cfg = vscode.workspace.getConfiguration("frootai.federation");
  return cfg.get<boolean>("enabled", true) !== false;
}

/**
 * Default `ManifestReader` for M5.9. Resolves `fai-manifest.json` in
 * the first workspace folder. Returns `null` when no folder is open
 * (with `workspaceMissing = true` sentinel so the core exec can
 * distinguish no-workspace from no-manifest) OR when the file is
 * absent (no sentinel). Throws structured errors on IO / parse fail.
 */
function buildDefaultManifestReader(): {
  workspaceMissing: boolean;
  read: () => Promise<{ path: string; content: unknown } | null>;
} {
  const folders = vscode.workspace.workspaceFolders;
  const noWorkspace = !folders || folders.length === 0;
  const reader = {
    workspaceMissing: noWorkspace,
    async read() {
      if (noWorkspace) return null;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const root = folders![0].uri;
      const target = vscode.Uri.joinPath(root, "fai-manifest.json");
      let buf: Uint8Array;
      try {
        buf = await vscode.workspace.fs.readFile(target);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/ENOENT|not found|does not exist/i.test(msg)) return null;
        throw federationCore._asMcpFederationError(err, "manifest_read_failed");
      }
      let content: unknown;
      try {
        content = JSON.parse(Buffer.from(buf).toString("utf8"));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const wrapped = new Error(`fai-manifest.json invalid JSON: ${msg}`);
        throw federationCore._asMcpFederationError(wrapped, "manifest_parse_failed");
      }
      return { path: target.fsPath, content };
    },
  };
  return reader;
}

/**
 * Default `BulkAttachUx` adapter for M5.9. Shows ONE modal listing
 * every area in the manifest + its trust tier so the operator approves
 * the bulk operation in a single click.
 */
function buildDefaultBulkAttachUx(output: vscode.OutputChannel) {
  return {
    async confirmBatch(items: { name: string; trust?: string }[], manifestPath: string): Promise<boolean | undefined> {
      const lines = items.map((it) => `  • ${it.name} [${it.trust || "unknown"}]`).join("\n");
      const detail = `Manifest: ${manifestPath}\n\nThe following areas will be attached:\n${lines}`;
      const choice = await vscode.window.showWarningMessage(
        `Federation — attach ${items.length} area${items.length === 1 ? "" : "s"} from fai-manifest.json?`,
        { modal: true, detail },
        "Attach all", "Cancel",
      );
      if (choice === "Attach all") return true;
      if (choice === "Cancel") return false;
      return undefined;
    },
    showInfo(message: string): void {
      void vscode.window.showInformationMessage(message);
      output.appendLine(`[${new Date().toISOString()}] [federation.attachFromManifest] info: ${message}`);
    },
    showError(message: string): void {
      void vscode.window.showErrorMessage(message);
      output.appendLine(`[${new Date().toISOString()}] [federation.attachFromManifest] error: ${message}`);
    },
    async refreshAttachedView(): Promise<void> {
      try {
        await vscode.commands.executeCommand("frootai.federation.attached.refresh");
      } catch { /* tree provider not yet registered; safe to swallow until M5.10 */ }
    },
  };
}

type ExplorerTab = "attached" | "catalog";

/**
 * Build the singleton-panel explorer opener. The actual React UI lands
 * at M5.12; until then we render a placeholder body that surfaces the
 * requested tab + a one-line status so the operator sees something
 * non-empty when they run the M5.6 / M5.7 commands. The opener:
 *   - lazily creates ONE `vscode.WebviewPanel`,
 *   - reveals it on subsequent calls,
 *   - posts `{type:"setActiveTab", tab}` on every call so the M5.12
 *     React app can switch tabs in-place,
 *   - clears the cached panel reference on dispose so a fresh panel is
 *     created the next time.
 */
// CommonJS interop with the pure-core (used by M5.13 state persistence).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const explorerCore = require("../webviews/federation-explorer-core") as typeof import("../webviews/federation-explorer-core");

/**
 * M5.13 — abstract handle the explorer opener uses to persist the
 * last-search + last-tab + last-tiers shape between sessions. The
 * default implementation wraps `vscode.ExtensionContext.workspaceState`;
 * tests pass an in-memory fake.
 */
interface ExplorerStateStore {
  get(): unknown;
  set(state: unknown): Promise<void> | void;
}

function buildDefaultExplorerStateStore(workspaceState: vscode.Memento): ExplorerStateStore {
  return {
    get(): unknown {
      try { return workspaceState.get(explorerCore.WORKSPACE_STATE_KEY); } catch { return undefined; }
    },
    async set(state: unknown): Promise<void> {
      try { await Promise.resolve(workspaceState.update(explorerCore.WORKSPACE_STATE_KEY, state)); } catch { /* best-effort */ }
    },
  };
}

function buildDefaultExplorerOpener(
  output: vscode.OutputChannel,
  extensionUri?: vscode.Uri,
  stateStore?: ExplorerStateStore,
) {
  let panel: vscode.WebviewPanel | null = null;
  return {
    async openExplorer(opts: { tab: ExplorerTab; focus?: boolean; focusSearch?: boolean }): Promise<{ revealed: boolean; tab: ExplorerTab; searchFocused?: boolean }> {
      const focus = opts.focus !== false;
      const focusSearch = opts.focusSearch === true;
      if (panel) {
        panel.reveal(undefined, !focus);
      } else {
        // M5.12: when the React webview bundle has been built (out/webview/
        // main.js exists), mount the React Federation Explorer panel; fall
        // back to the M5.6/M5.7 placeholder HTML when the bundle is absent
        // (CI / dev where `npm run build:webview` hasn't run). The
        // placeholder still honours the postMessage protocol so the M5.6/M5.7
        // gates keep passing without a build step.
        const builtMain = extensionUri
          ? vscode.Uri.joinPath(extensionUri, "out", "webview", "main.js")
          : null;
        const hasBundle = builtMain !== null && _bundleExistsSync(builtMain.fsPath);
        if (hasBundle && extensionUri) {
          panel = vscode.window.createWebviewPanel(
            "frootai.federation.explorer",
            "FAI Federation Explorer",
            { viewColumn: vscode.ViewColumn.Active, preserveFocus: !focus },
            {
              enableScripts: true,
              retainContextWhenHidden: true,
              localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, "out", "webview"),
                vscode.Uri.joinPath(extensionUri, "media"),
              ],
            },
          );
          panel.onDidDispose(() => { panel = null; });
          panel.webview.html = _renderExplorerReactHtml(panel.webview, extensionUri, opts.tab);
        } else {
          panel = vscode.window.createWebviewPanel(
            "frootai.federation.explorer",
            "FAI Federation Explorer",
            { viewColumn: vscode.ViewColumn.Active, preserveFocus: !focus },
            { enableScripts: true, retainContextWhenHidden: true },
          );
          panel.onDidDispose(() => { panel = null; });
          panel.webview.html = renderExplorerPlaceholderHtml(opts.tab);
        }
        // M5.13 — PANEL JUST CREATED. Hook the inbound `stateChange`
        // postMessage so every operator interaction (search keystroke,
        // tab switch, tier toggle) merges + persists into workspaceState.
        // Then replay the previously-persisted state to the webview via
        // `restoreState` so the panel re-mounts at the right tab/query.
        if (stateStore) {
          const disposable = panel.webview.onDidReceiveMessage((raw) => {
            const result = explorerCore.validateOutboundMessage(raw);
            if (!result.valid || result.kind !== "stateChange") return;
            const current = explorerCore.normaliseExplorerState(stateStore.get());
            const merged = explorerCore.mergeExplorerState(current, result.payload || {});
            void stateStore.set(merged);
            output.appendLine(
              `[${new Date().toISOString()}] [federation.explorer] stateChange persisted tab=${merged.tab} tiers=${merged.tiers.join(",")} searchLen=${merged.search.length}`,
            );
          });
          panel.onDidDispose(() => { disposable.dispose(); });
          const restored = explorerCore.normaliseExplorerState(stateStore.get());
          if (restored) {
            try {
              panel.webview.postMessage({
                type: "restoreState",
                search: restored.search,
                tab: restored.tab,
                tiers: restored.tiers,
              });
            } catch { /* webview disposed mid-call */ }
          }
        }
      }
      // Post the tab message regardless of new-vs-revealed so M5.12 React
      // can switch tabs in-place on subsequent invocations.
      try { panel.webview.postMessage({ type: "setActiveTab", tab: opts.tab }); } catch { /* webview disposed mid-call */ }
      // M5.7: focus the search box inside the webview (e.g. discoverMcp).
      if (focusSearch) {
        try { panel.webview.postMessage({ type: "focusSearch" }); } catch { /* webview disposed mid-call */ }
      }
      output.appendLine(`[${new Date().toISOString()}] [federation.explorer] openExplorer tab=${opts.tab} focus=${focus} focusSearch=${focusSearch}`);
      return { revealed: true, tab: opts.tab, searchFocused: focusSearch };
    },
  };
}

function _bundleExistsSync(absPath: string): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs") as typeof import("fs");
    return fs.existsSync(absPath);
  } catch { return false; }
}

function _renderExplorerReactHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  activeTab: ExplorerTab,
): string {
  const webviewDir = vscode.Uri.joinPath(extensionUri, "out", "webview");
  const mainJs = webview.asWebviewUri(vscode.Uri.joinPath(webviewDir, "main.js"));
  const mainCss = webview.asWebviewUri(vscode.Uri.joinPath(webviewDir, "main.css"));
  const nonce = _getNonce();
  const bust = `?v=${nonce.substring(0, 8)}-${Date.now()}`;
  const panelData = JSON.stringify({
    panel: "federationExplorer",
    federationInitialTab: activeTab,
    federationMarketplace: [],
    federationAttached: [],
  });
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource}; font-src ${webview.cspSource};">
  <link rel="stylesheet" href="${mainCss}${bust}">
  <title>FAI Federation Explorer</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">window.panelData = ${panelData};</script>
  <script nonce="${nonce}" src="${mainJs}${bust}"></script>
</body>
</html>`;
}

function _getNonce(): string {
  let text = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
  return text;
}

function renderExplorerPlaceholderHtml(activeTab: ExplorerTab): string {
  // Placeholder until M5.12 ships `webviews/FederationExplorer.tsx`. The
  // operator-visible body surfaces the requested tab so they know the
  // command fired with the right argument; the inline script forwards
  // the `setActiveTab` + `focusSearch` postMessages for M5.12 to consume.
  const safeTab = activeTab === "catalog" ? "catalog" : "attached";
  return [
    "<!doctype html><html><head><meta charset=\"utf-8\"></head><body>",
    "<h1>FAI Federation Explorer</h1>",
    `<p>Active tab: <strong id=\"active-tab\">${safeTab}</strong></p>`,
    "<p>Search: <input id=\"federation-search\" type=\"search\" placeholder=\"Search marketplace…\" /></p>",
    "<p><em>Placeholder — M5.12 ships the React content (search, tier filter, cards, attached pane).</em></p>",
    "<script>",
    "window.addEventListener('message', function (event) {",
    "  if (!event || !event.data) return;",
    "  if (event.data.type === 'setActiveTab' && typeof event.data.tab === 'string') {",
    "    var el = document.getElementById('active-tab');",
    "    if (el) el.textContent = event.data.tab;",
    "  } else if (event.data.type === 'focusSearch') {",
    "    var search = document.getElementById('federation-search');",
    "    if (search && typeof search.focus === 'function') search.focus();",
    "  }",
    "});",
    "</script>",
    "</body></html>",
  ].join("\n");
}

/**
 * Public extension API: register every M5 federation command on the
 * supplied context. Currently registers `frootai.federation.attach`
 * (the M5.4 row); subsequent rows extend the registration block.
 *
 * @param context the activated extension context
 * @param overrides optional deps overrides — tests / future rows can
 *                  inject a real `FederationClient` here.
 */
export function registerFederationCommands(
  context: vscode.ExtensionContext,
  overrides?: Partial<{
    client: ReturnType<typeof federationCore.buildPendingFederationClient>;
    output: vscode.OutputChannel;
  }>,
): vscode.Disposable {
  const output =
    (overrides && overrides.output) ||
    vscode.window.createOutputChannel("FrootAI Federation");
  context.subscriptions.push(output);

  const client = (overrides && overrides.client) || createDefaultFederationClient();
  const ux = buildDefaultAttachUx(output);
  const detachUx = buildDefaultDetachUx(output);
  const trustQueryUx = buildDefaultTrustQueryUx(output);
  const explorer = buildDefaultExplorerOpener(
    output,
    context.extensionUri,
    buildDefaultExplorerStateStore(context.workspaceState),
  );
  const explorerUx = {
    showInfo(message: string): void {
      void vscode.window.showInformationMessage(message);
      output.appendLine(`[${new Date().toISOString()}] [federation.explorer] info: ${message}`);
    },
    showError(message: string): void {
      void vscode.window.showErrorMessage(message);
      output.appendLine(`[${new Date().toISOString()}] [federation.explorer] error: ${message}`);
    },
  };

  const attachDisposable = vscode.commands.registerCommand(
    "frootai.federation.attach",
    wrapFedCmd("frootai.federation.attach", async () => {
      const outcome = await federationCore.executeAttach({
        enabled: isFederationEnabled(),
        client,
        ux,
      });
      output.appendLine(
        `[${new Date().toISOString()}] [federation.attach] outcome=${outcome.status}`,
      );
      return outcome;
    }),
  );
  context.subscriptions.push(attachDisposable);

  const detachDisposable = vscode.commands.registerCommand(
    "frootai.federation.detach",
    wrapFedCmd("frootai.federation.detach", async () => {
      const outcome = await federationCore.executeDetach({
        enabled: isFederationEnabled(),
        client,
        ux: detachUx,
      });
      output.appendLine(
        `[${new Date().toISOString()}] [federation.detach] outcome=${outcome.status}`,
      );
      return outcome;
    }),
  );
  context.subscriptions.push(detachDisposable);

  const listAttachedDisposable = vscode.commands.registerCommand(
    "frootai.federation.listAttached",
    wrapFedCmd("frootai.federation.listAttached", async () => {
      const outcome = await federationCore.executeListAttached({
        enabled: isFederationEnabled(),
        explorer,
        ux: explorerUx,
      });
      output.appendLine(
        `[${new Date().toISOString()}] [federation.listAttached] outcome=${outcome.status}`,
      );
      return outcome;
    }),
  );
  context.subscriptions.push(listAttachedDisposable);

  const discoverMcpDisposable = vscode.commands.registerCommand(
    "frootai.federation.discoverMcp",
    wrapFedCmd("frootai.federation.discoverMcp", async () => {
      const outcome = await federationCore.executeDiscoverMcp({
        enabled: isFederationEnabled(),
        explorer,
        ux: explorerUx,
      });
      output.appendLine(
        `[${new Date().toISOString()}] [federation.discoverMcp] outcome=${outcome.status}`,
      );
      return outcome;
    }),
  );
  context.subscriptions.push(discoverMcpDisposable);

  const trustQueryDisposable = vscode.commands.registerCommand(
    "frootai.federation.trustQuery",
    wrapFedCmd("frootai.federation.trustQuery", async () => {
      const outcome = await federationCore.executeTrustQuery({
        enabled: isFederationEnabled(),
        client,
        ux: trustQueryUx,
      });
      output.appendLine(
        `[${new Date().toISOString()}] [federation.trustQuery] outcome=${outcome.status}`,
      );
      return outcome;
    }),
  );
  context.subscriptions.push(trustQueryDisposable);

  const attachFromManifestDisposable = vscode.commands.registerCommand(
    "frootai.federation.attachFromManifest",
    wrapFedCmd("frootai.federation.attachFromManifest", async () => {
      const reader = buildDefaultManifestReader();
      const bulkUx = buildDefaultBulkAttachUx(output);
      const outcome = await federationCore.executeAttachFromManifest({
        enabled: isFederationEnabled(),
        client,
        reader,
        ux: bulkUx,
      });
      output.appendLine(
        `[${new Date().toISOString()}] [federation.attachFromManifest] outcome=${outcome.status}`,
      );
      return outcome;
    }),
  );
  context.subscriptions.push(attachFromManifestDisposable);

  return attachDisposable;
}

/**
 * Read the M5.1 `frootai.federation.autoAttachFromPlayManifest` opt-in
 * setting. Default `false` (per M5.1 schema) so the toast NEVER fires
 * unless the operator explicitly turns it on.
 */
function isAutoAttachOnPlayOpenEnabled(): boolean {
  const cfg = vscode.workspace.getConfiguration("frootai.federation");
  return cfg.get<boolean>("autoAttachFromPlayManifest", false) === true;
}

/**
 * Default M5.18 auto-attach UX: non-modal toast notification with a
 * single "Attach" button. `vscode.window.showInformationMessage` with
 * a button list is the right primitive here — it surfaces the toast
 * in the lower-right corner WITHOUT consuming focus (modal would
 * block the operator opening the Play, which is the OPPOSITE of the
 * row literal's UX intent).
 */
function buildDefaultAutoAttachUx(output: vscode.OutputChannel): {
  showAutoAttachPrompt(prompt: string, button: string): Promise<"attach" | "dismiss" | undefined>;
  showInfo(message: string): void;
  showError(message: string): void;
  refreshAttachedView: () => void | Promise<void>;
} {
  return {
    async showAutoAttachPrompt(prompt: string, button: string): Promise<"attach" | "dismiss" | undefined> {
      const picked = await vscode.window.showInformationMessage(prompt, button);
      if (picked === button) return "attach";
      // showInformationMessage returns undefined on dismiss/timeout —
      // we surface "dismiss" only for an explicit non-Attach selection,
      // which the single-button form can't produce. Map undefined →
      // undefined (toast timeout) rather than fabricating "dismiss".
      return undefined;
    },
    showInfo(message: string): void {
      void vscode.window.showInformationMessage(message);
      output.appendLine(`[${new Date().toISOString()}] [federation.playOpenAutoAttach] info: ${message}`);
    },
    showError(message: string): void {
      void vscode.window.showErrorMessage(message);
      output.appendLine(`[${new Date().toISOString()}] [federation.playOpenAutoAttach] error: ${message}`);
    },
    async refreshAttachedView(): Promise<void> {
      try {
        await vscode.commands.executeCommand("frootai.federation.attached.refresh");
      } catch {
        // best-effort
      }
    },
  };
}

/**
 * M5.18 — register the auto-attach-on-Play-open command.
 *
 * Row literal: when `frootai.federation.autoAttachFromPlayManifest =
 * true` and the user opens a Play with `mcp_scope.attached`, show
 * notification "This Play requires: azure. Attach now?" with an Attach
 * button.
 *
 * Implementation: a dispatchable command `frootai.federation.playOpenAutoAttach`
 * accepts a manifest object as its single argument and runs the pure
 * `executePlayAutoAttach` flow. Any caller that opens a Play (M5.17
 * OrchardTreeProvider FRUIT click; future Play-open events) fires this
 * command via `vscode.commands.executeCommand("frootai.federation.playOpenAutoAttach", manifest)`.
 *
 * The command is registered in a SEPARATE function from the rest of
 * the federation surface so the dispatchable point is grep-discoverable
 * and the M5.19+ kernel-spawn wiring can override the client without
 * touching `registerFederationCommands`.
 *
 * @param context the activated extension context
 * @param overrides optional deps overrides — tests / future rows can
 *                  inject a real `FederationClient` here.
 */
export function registerPlayOpenAutoAttach(
  context: vscode.ExtensionContext,
  overrides?: Partial<{
    client: ReturnType<typeof federationCore.buildPendingFederationClient>;
    output: vscode.OutputChannel;
  }>,
): vscode.Disposable {
  const output =
    (overrides && overrides.output) ||
    vscode.window.createOutputChannel("FrootAI Federation");
  const client = (overrides && overrides.client) || federationCore.buildPendingFederationClient();
  const ux = buildDefaultAutoAttachUx(output);

  const disposable = vscode.commands.registerCommand(
    "frootai.federation.playOpenAutoAttach",
    wrapFedCmd("frootai.federation.playOpenAutoAttach", async (manifest: unknown) => {
      const outcome = await playAutoAttachCore.executePlayAutoAttach({
        client,
        ux,
        settings: {
          enabled: isFederationEnabled(),
          autoAttachFromPlayManifest: isAutoAttachOnPlayOpenEnabled(),
        },
        manifest,
      });
      output.appendLine(
        `[${new Date().toISOString()}] [federation.playOpenAutoAttach] outcome=${outcome.status}`,
      );
      return outcome;
    }),
  );
  context.subscriptions.push(disposable);
  return disposable;
}

/**
 * Read `frootai.federation.idleDisconnectMinutes` from M5.1 settings,
 * falling back to the M5.19 pure-core default (10 — matches M5.1 schema).
 */
function getIdleDisconnectMinutes(): number {
  const cfg = vscode.workspace.getConfiguration("frootai.federation");
  const v = cfg.get<number>("idleDisconnectMinutes", statusBarCore.DEFAULT_IDLE_DISCONNECT_MIN);
  return typeof v === "number" && Number.isFinite(v) && v > 0
    ? v
    : statusBarCore.DEFAULT_IDLE_DISCONNECT_MIN;
}

/**
 * M5.19 — register the federation status bar item.
 *
 * Row literal: status bar item: shows currently attached count +
 * idle-disconnect-warning amber when any area is < 1 min from
 * idle-timeout.
 *
 * Implementation:
 *   - Right-aligned status bar item created at activation, ALWAYS
 *     visible (count=0 still renders to give operators a fixed
 *     glance-target — see pure-core decision notes).
 *   - Periodic refresh via `setInterval` polls `client.listAttached()`
 *     every 30 seconds (frequent enough to catch a < 1m idle warning
 *     before it expires; infrequent enough to not stress the kernel).
 *   - `frootai.federation.statusBar.refresh` command dispatched by the
 *     M5.10 attached-tree refresh hook so attach / detach updates the
 *     bar immediately rather than waiting for the next poll tick.
 *   - Click → fires `frootai.federation.listAttached` (M5.6 row
 *     literal: opening the federation explorer / attached panel is
 *     the right next-action when the bar shows attached count).
 *
 * @param context the activated extension context
 * @param overrides optional deps overrides — tests / future rows can
 *                  inject a real `FederationClient` + a manual tick
 *                  function.
 */
export function registerFederationStatusBar(
  context: vscode.ExtensionContext,
  overrides?: Partial<{
    client: ReturnType<typeof federationCore.buildPendingFederationClient>;
    output: vscode.OutputChannel;
    pollIntervalMs: number;
  }>,
): vscode.Disposable {
  const output =
    (overrides && overrides.output) ||
    vscode.window.createOutputChannel("FrootAI Federation");
  const client = (overrides && overrides.client) || federationCore.buildPendingFederationClient();

  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    statusBarCore.STATUS_BAR_PRIORITY,
  );
  item.command = statusBarCore.STATUS_BAR_COMMAND;
  // Initialise with a 0-count placeholder so the bar appears
  // immediately; the first poll tick will overwrite with real data.
  item.text = statusBarCore.formatStatusBarText(0);
  item.tooltip = "FrootAI Federation — initialising\u2026";
  item.show();
  context.subscriptions.push(item);

  const tick = async (): Promise<void> => {
    /** @type {Array<{ name: string, toolCount?: number, idleMinutes?: number }>} */
    let list: Array<{ name: string; toolCount?: number; idleMinutes?: number }> = [];
    try {
      list = (await client.listAttached()) as Array<{ name: string; toolCount?: number; idleMinutes?: number }>;
      if (!Array.isArray(list)) list = [];
    } catch {
      // PIN_ONE_AHEAD: M5.4's pending stub throws kernel_connection_pending
      // until M5.20+ wires the real kernel. Render the empty-state
      // status bar without surfacing the error; the M5.6 attached-list
      // command is the authoritative error channel.
      list = [];
    }
    const state = statusBarCore.computeStatusBarState({
      attached: list,
      idleDisconnectMinutes: getIdleDisconnectMinutes(),
    });
    item.text = state.text;
    item.tooltip = new vscode.MarkdownString(state.tooltip);
    item.backgroundColor = state.color === "warning"
      ? new vscode.ThemeColor("statusBarItem.warningBackground")
      : undefined;
  };

  // Manual refresh dispatchable by M5.10 attach / detach hooks so the
  // status bar updates immediately rather than waiting for the poll tick.
  const refreshCommand = vscode.commands.registerCommand(
    "frootai.federation.statusBar.refresh",
    wrapFedCmd("frootai.federation.statusBar.refresh", async () => {
      try { await tick(); } catch (err) {
        output.appendLine(`[${new Date().toISOString()}] [federation.statusBar.refresh] error: ${(err as Error).message || String(err)}`);
      }
    }),
  );
  context.subscriptions.push(refreshCommand);

  // Kick off the initial tick + start polling.
  void tick();
  const pollMs = (overrides && typeof overrides.pollIntervalMs === "number" && overrides.pollIntervalMs > 0)
    ? overrides.pollIntervalMs
    : 30_000;
  const handle = setInterval(() => { void tick(); }, pollMs);
  const cleanup = new vscode.Disposable(() => clearInterval(handle));
  context.subscriptions.push(cleanup);

  return cleanup;
}

/**
 * M5.20 — resolve the trust file path. Honors the M5.1
 * `frootai.federation.trustFile` setting; when empty, falls back to
 * `<globalStorage>/trust.json` so user-decided overrides survive
 * across workspaces but never accidentally leak into a workspace
 * folder (operators expect "trust" to be a per-user concept).
 */
function resolveTrustFilePath(context: vscode.ExtensionContext): vscode.Uri {
  const cfg = vscode.workspace.getConfiguration("frootai.federation");
  const setting = cfg.get<string>("trustFile", "");
  const trimmed = (typeof setting === "string" ? setting.trim() : "");
  if (trimmed.length > 0) {
    return vscode.Uri.file(trimmed);
  }
  return vscode.Uri.joinPath(context.globalStorageUri, "trust.json");
}

/**
 * M5.20 — default trust-store implementation reading / writing the
 * JSON trust file via VS Code's `workspace.fs` (works across remote
 * SSH / WSL / VS Code for Web). Read returns a fresh empty file when
 * absent / corrupt; write is best-effort and may throw on permission
 * errors (the pure-core surfaces that as `persisted: false`).
 */
function buildDefaultTrustStore(context: vscode.ExtensionContext): {
  read(): Promise<{ version: number; overrides: Record<string, { tier: string; decidedAt?: string }> }>;
  write(file: { version: number; overrides: Record<string, { tier: string; decidedAt?: string }> }): Promise<void>;
} {
  const path = resolveTrustFilePath(context);
  return {
    async read() {
      try {
        const bytes = await vscode.workspace.fs.readFile(path);
        const text = new TextDecoder("utf-8").decode(bytes);
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object" && parsed.overrides && typeof parsed.overrides === "object") {
          return parsed;
        }
      } catch {
        // Missing / corrupt — return empty.
      }
      return { version: trustElicitationCore.TRUST_FILE_VERSION, overrides: {} };
    },
    async write(file) {
      // Ensure the parent directory exists before writing — globalStorageUri
      // may not exist on first run.
      try {
        const parent = vscode.Uri.joinPath(path, "..");
        await vscode.workspace.fs.createDirectory(parent);
      } catch {
        // best-effort
      }
      const text = JSON.stringify(file, null, 2);
      const bytes = new TextEncoder().encode(text);
      await vscode.workspace.fs.writeFile(path, bytes);
    },
  };
}

/**
 * M5.20 — register trust elicitation. Row literal: when
 * `fai_attach_mcp` returns `requiresApproval: true`, render a
 * `vscode.window.showWarningMessage` with `Allow` / `Allow once` /
 * `Block` buttons; persist choice to user trust file.
 *
 * Implementation: a dispatchable command
 * `frootai.federation.elicitTrust` accepts `{areaName, reason}` and
 * runs the pure `executeTrustElicitation` flow. The attach path
 * (M5.4 + M5.21+) fires this command via
 * `vscode.commands.executeCommand("frootai.federation.elicitTrust",
 * { areaName, reason })` when the kernel response carries
 * `requiresApproval: true`. The dispatchable shape keeps the
 * elicitation surface independent of the attach surface — a future
 * row can fire the same command from a different trigger (e.g. a
 * Settings UI "review trust decisions" panel) without coupling.
 *
 * @param context the activated extension context
 * @param overrides optional deps overrides — tests inject a fake
 *                  trustStore + ux.
 */
export function registerTrustElicitation(
  context: vscode.ExtensionContext,
  overrides?: Partial<{
    trustStore: ReturnType<typeof buildDefaultTrustStore>;
    output: vscode.OutputChannel;
  }>,
): vscode.Disposable {
  const output =
    (overrides && overrides.output) ||
    vscode.window.createOutputChannel("FrootAI Federation");
  const trustStore = (overrides && overrides.trustStore) || buildDefaultTrustStore(context);

  const ux = {
    async showTrustPrompt(opts: { areaName: string; prompt: string; buttons: ReadonlyArray<string> }): Promise<string | undefined> {
      // Use showWarningMessage per row literal — the amber icon
      // matches the "this is a security decision" gravity. Modal:false
      // (default) so the warning slides in as a non-blocking toast
      // but the 3 buttons still demand an explicit pick.
      const [b0, b1, b2] = opts.buttons;
      return await vscode.window.showWarningMessage(opts.prompt, b0, b1, b2);
    },
    showInfo(message: string): void {
      void vscode.window.showInformationMessage(message);
      output.appendLine(`[${new Date().toISOString()}] [federation.elicitTrust] info: ${message}`);
    },
    showError(message: string): void {
      void vscode.window.showErrorMessage(message);
      output.appendLine(`[${new Date().toISOString()}] [federation.elicitTrust] error: ${message}`);
    },
  };

  const disposable = vscode.commands.registerCommand(
    "frootai.federation.elicitTrust",
    wrapFedCmd("frootai.federation.elicitTrust", async (rawArgs: unknown) => {
      const args = rawArgs as { areaName?: string; reason?: string } | undefined;
      const areaName = args && typeof args.areaName === "string" ? args.areaName : "";
      const reason = args && typeof args.reason === "string" ? args.reason : undefined;
      const outcome = await trustElicitationCore.executeTrustElicitation({
        areaName,
        reason,
        ux,
        trustStore,
      });
      output.appendLine(
        `[${new Date().toISOString()}] [federation.elicitTrust] outcome=${outcome.status} persisted=${outcome.persisted ?? "n/a"} retry=${outcome.retry ?? "n/a"}`,
      );
      return outcome;
    }),
  );
  context.subscriptions.push(disposable);
  return disposable;
}

/**
 * M5.21 — read federation env-block from settings via the M5.14/M5.15
 * pure-core. Returns frozen Record. Wrapper-internal so the
 * provider's `provideMcpServerDefinitions` can hand the kernel-spawn
 * env to other VS Code MCP consumers (they may inherit the same
 * pre-attach + trust-file + idle-disconnect posture).
 */
function _readFederationEnv(): Record<string, string> {
  const cfg = vscode.workspace.getConfiguration("frootai.federation");
  const settings = {
    enabled: cfg.get<boolean>("enabled", true),
    preAttach: cfg.get<string[]>("preAttach", []),
    trustFile: cfg.get<string>("trustFile", ""),
    idleDisconnectMinutes: cfg.get<number>("idleDisconnectMinutes", 10),
    autoAttachFromPlayManifest: cfg.get<boolean>("autoAttachFromPlayManifest", false),
  };
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const envCore = require("./federation-env-mapping") as {
    buildFederationEnv(s: typeof settings): Readonly<Record<string, string>>;
  };
  return envCore.buildFederationEnv(settings);
}

/**
 * M5.21 — register the SECOND MCP Server Definition Provider with id
 * `frootai-federated`. Row literal: exposes the kernel's federated
 * tool list to other VS Code MCP consumers without re-spawning;
 * documented in extension README.
 *
 * The provider is STRICTLY ADDITIVE to the existing `frootai`
 * provider (built-in MCP server, declared in package.json
 * `mcpServerDefinitionProviders`). Other VS Code MCP consumers (e.g.
 * GitHub Copilot, third-party agents) can discover the federation
 * kernel via this provider id and connect to it WITHOUT spawning
 * their own copy — preserving idle-disconnect timers + trust state +
 * already-attached areas.
 *
 * PIN_ONE_AHEAD: until M5.22+ resolves the kernel binary path from
 * the M5.14/M5.15 env-block + shipped binary / npx fallback,
 * `kernelCommand` is empty and the provider returns `[]`. The MCP
 * host treats an empty array as "this provider has nothing to
 * contribute today" — the right empty-state for a not-yet-spawned
 * kernel.
 *
 * @param context the activated extension context
 * @param overrides optional deps overrides — tests / future rows
 *                  inject a resolved kernel command + env-block.
 */
export function registerFederatedMcpServerDefinitionProvider(
  context: vscode.ExtensionContext,
  overrides?: Partial<{
    client: ReturnType<typeof federationCore.buildPendingFederationClient>;
    output: vscode.OutputChannel;
    /** Resolved kernel binary path. PIN_ONE_AHEAD: empty until M5.22+. */
    resolveKernelCommand: () => string | undefined;
  }>,
): vscode.Disposable {
  const output =
    (overrides && overrides.output) ||
    vscode.window.createOutputChannel("FrootAI Federation");
  const client = (overrides && overrides.client) || federationCore.buildPendingFederationClient();
  const resolveKernelCommand = (overrides && overrides.resolveKernelCommand) || (() => undefined);

  // The VS Code MCP server-definition provider API surface lives
  // under `vscode.lm` (Language Model namespace) per the proposed API.
  // Until the API stabilises, `(vscode as any).lm` lets us register
  // gracefully in environments where the proposed API isn't enabled.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lm = (vscode as any).lm;
  if (!lm || typeof lm.registerMcpServerDefinitionProvider !== "function") {
    output.appendLine(
      `[${new Date().toISOString()}] [federation.mcpDefinitionProvider] skipped: vscode.lm.registerMcpServerDefinitionProvider unavailable in this VS Code build`,
    );
    return new vscode.Disposable(() => { /* no-op */ });
  }

  const provider = {
    async provideMcpServerDefinitions(): Promise<unknown[]> {
      let attached: Array<{ name: string }> = [];
      try {
        const list = (await client.listAttached()) as Array<{ name: string }>;
        if (Array.isArray(list)) attached = list;
      } catch {
        // PIN_ONE_AHEAD: M5.4 stub — render empty
      }
      const env = _readFederationEnv();
      const descriptors = mcpServerDefinitionCore.buildFederatedServerDefinitions({
        kernelCommand: resolveKernelCommand(),
        env,
        attached,
      });
      // Map descriptors → real vscode.McpStdioServerDefinition. The
      // class lives on `vscode` (or `(vscode as any)`) depending on
      // VS Code's API enable state; fall back to the descriptor object
      // shape if the constructor isn't present (the host accepts the
      // structural shape too).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const McpStdio = (vscode as any).McpStdioServerDefinition;
      return descriptors.map((d) => {
        if (typeof McpStdio === "function") {
          return new McpStdio(d.label, d.command, d.args, d.env, d.version);
        }
        return d;
      });
    },
    async resolveMcpServerDefinition(definition: unknown): Promise<unknown> {
      // No additional resolution needed — the descriptor already
      // carries command + args + env. Future rows may augment this
      // with on-demand kernel spawn / health check.
      return definition;
    },
  };

  const disposable = lm.registerMcpServerDefinitionProvider(
    mcpServerDefinitionCore.FEDERATED_PROVIDER_ID,
    provider,
  );
  context.subscriptions.push(disposable);
  output.appendLine(
    `[${new Date().toISOString()}] [federation.mcpDefinitionProvider] registered id=${mcpServerDefinitionCore.FEDERATED_PROVIDER_ID}`,
  );
  return disposable;
}
