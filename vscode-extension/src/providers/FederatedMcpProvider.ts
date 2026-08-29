/**
 * M5.10 — FederatedMcpProvider (TreeDataProvider for
 * `frootai.federation.attached` view declared at M5.3).
 *
 * Mirrors the OrchardTreeProvider split: pure data in
 * `federated-mcp-tree-model.js` (testable in plain Node), this file
 * only maps `TreeNode` → `vscode.TreeItem` + wires the
 * `onDidChangeTreeData` event so the M5.4/M5.5/M5.6/M5.9 refresh
 * delegates work in-process.
 *
 * Per the M5.10 row literal: tree shape is `area → tools`; clicking a
 * tool fires the M5.16 invoke command (registered separately) — until
 * M5.16 ships the command, the click is wired BUT the command is a
 * placeholder (the catch in `executeCommand` keeps the click harmless).
 *
 * Data source: a `FederationClient` (the M5.4 PIN_ONE_AHEAD stub by
 * default; M5.14/M5.15 swaps in the real kernel connection). New
 * client method needed:
 *   `listAreaTools({name}) → ToolEntry[]` — fetches tools for a single
 *   area. Lands here as a typedef extension; the pending stub throws
 *   `kernel_connection_pending` like the other client methods.
 */
import * as vscode from "vscode";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const treeModel = require("./federated-mcp-tree-model.js") as typeof import("./federated-mcp-tree-model");

type TreeNode =
  | { kind: "empty"; id: string; label: string; description?: string }
  | {
      kind: "area"; id: string; label: string; description: string;
      areaName: string; toolCount: number; idleMinutes: number | null; trust: string | null;
    }
  | { kind: "tool"; id: string; label: string; description?: string; areaName: string; toolName: string }
  | { kind: "no-tools"; id: string; label: string; areaName: string };

type AttachedAreaEntry = {
  name: string;
  trust?: string;
  toolCount?: number;
  idleMinutes?: number;
  attachedAt?: string;
};

type ToolEntry = { name: string; description?: string };

export interface FederatedMcpClient {
  listAttached(): Promise<AttachedAreaEntry[]>;
  listAreaTools(args: { name: string }): Promise<ToolEntry[]>;
}

export class FederatedMcpProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChange = new vscode.EventEmitter<TreeNode | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  private _client: FederatedMcpClient;
  private _output: vscode.OutputChannel;
  private _attached: AttachedAreaEntry[] = [];
  private _toolsByArea: Record<string, ToolEntry[]> = {};

  constructor(opts: { client: FederatedMcpClient; output: vscode.OutputChannel }) {
    this._client = opts.client;
    this._output = opts.output;
  }

  /**
   * Re-fetch attached areas + their tools, then fire the tree refresh.
   * Best-effort: client errors are logged + the tree falls back to its
   * current cached state (NOT cleared), so a transient kernel hiccup
   * doesn't blank the operator's view.
   */
  async refresh(): Promise<void> {
    try {
      const areas = await this._client.listAttached();
      this._attached = Array.isArray(areas) ? areas : [];
      this._toolsByArea = {};
      // Pre-fetch tools for every area so the tree expansion is instant.
      // M5.14/M5.15 may later add a lazy variant; for now we eagerly
      // populate so the tree doesn't show "(loading…)" on expand.
      for (const area of this._attached) {
        if (!area || typeof area.name !== "string" || area.name.length === 0) continue;
        try {
          const tools = await this._client.listAreaTools({ name: area.name });
          this._toolsByArea[area.name] = Array.isArray(tools) ? tools : [];
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this._output.appendLine(
            `[${new Date().toISOString()}] [federated-tree] listAreaTools "${area.name}" failed: ${msg}`,
          );
          this._toolsByArea[area.name] = [];
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this._output.appendLine(
        `[${new Date().toISOString()}] [federated-tree] listAttached failed: ${msg}`,
      );
      // Keep prior state on transient failures.
    }
    this._onDidChange.fire();
  }

  getTreeItem(node: TreeNode): vscode.TreeItem {
    return this._toTreeItem(node);
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    const state = { attachedAreas: this._attached, toolsByArea: this._toolsByArea };
    if (!element) return treeModel.buildAttachedTreeRoot(state);
    if (element.kind === "area") return treeModel.buildAttachedTreeChildren(element.areaName, state);
    return [];
  }

  private _toTreeItem(node: TreeNode): vscode.TreeItem {
    if (node.kind === "empty") {
      const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
      item.description = node.description;
      item.contextValue = "federation.empty";
      item.iconPath = new vscode.ThemeIcon("info");
      return item;
    }
    if (node.kind === "area") {
      const collapsible = node.toolCount > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;
      const item = new vscode.TreeItem(node.label, collapsible);
      item.description = node.description;
      item.contextValue = `federation.area${node.trust ? `.${node.trust}` : ""}`;
      item.tooltip = `Federated area "${node.areaName}"${node.trust ? ` (trust: ${node.trust})` : ""}`;
      item.iconPath = new vscode.ThemeIcon(node.trust === "first-party-ms" ? "verified" : "plug");
      return item;
    }
    if (node.kind === "tool") {
      const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
      item.description = node.description;
      item.contextValue = "federation.tool";
      item.tooltip = `${treeModel.formatToolInvocation(node.areaName, node.toolName)}${node.description ? `\n${node.description}` : ""}`;
      item.iconPath = new vscode.ThemeIcon("symbol-method");
      // Click → open VS Code's MCP tool inspector (M5.10 row literal).
      // M5.16 wires the real invoke surface; for now we delegate to
      // VS Code's built-in MCP tool view if present, otherwise the
      // command is a no-op (best-effort catch).
      item.command = {
        command: "frootai.federation.openToolInspector",
        title: "Open MCP tool",
        arguments: [{ areaName: node.areaName, toolName: node.toolName }],
      };
      return item;
    }
    // no-tools
    const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
    item.contextValue = "federation.area.no-tools";
    item.iconPath = new vscode.ThemeIcon("circle-slash");
    return item;
  }
}

/**
 * Wire the M5.10 surface into the extension:
 *   - register the TreeDataProvider against the `frootai.federation.attached` view
 *     (declared at M5.3),
 *   - register the `frootai.federation.attached.refresh` command (referenced by
 *     M5.4/M5.5/M5.6/M5.9 refreshAttachedView hooks),
 *   - register the `frootai.federation.openToolInspector` command as a thin
 *     delegate to VS Code's built-in MCP tool view (M5.16 will replace this
 *     with the real invoke surface).
 *
 * Returns the provider so the caller (extension.ts) can keep a reference for
 * cross-row wiring (e.g. M5.18 auto-attach forces a refresh after attaching).
 */
export function registerFederatedMcpProvider(
  context: vscode.ExtensionContext,
  opts: { client: FederatedMcpClient; output: vscode.OutputChannel },
): FederatedMcpProvider {
  const provider = new FederatedMcpProvider(opts);

  const treeView = vscode.window.createTreeView("frootai.federation.attached", {
    treeDataProvider: provider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  const refreshCmd = vscode.commands.registerCommand(
    "frootai.federation.attached.refresh",
    async () => { await provider.refresh(); },
  );
  context.subscriptions.push(refreshCmd);

  const inspectorCmd = vscode.commands.registerCommand(
    "frootai.federation.openToolInspector",
    async (args?: { areaName?: string; toolName?: string }) => {
      const namespaced = args && args.areaName && args.toolName
        ? `${args.areaName}.${args.toolName}`
        : undefined;
      opts.output.appendLine(
        `[${new Date().toISOString()}] [federation.openToolInspector] tool=${namespaced || "(none)"}`,
      );
      // Best-effort: try VS Code's built-in MCP tools view; M5.16 will
      // replace this with the federation-specific invoke surface.
      try {
        await vscode.commands.executeCommand("workbench.mcp.showInstalledTools");
      } catch {
        // No built-in MCP view available — fall back to a friendly toast
        // so the click never feels broken.
        void vscode.window.showInformationMessage(
          namespaced
            ? `Tool "${namespaced}" — built-in MCP inspector unavailable; full invoke UX ships at M5.16.`
            : "MCP tool inspector unavailable; full invoke UX ships at M5.16.",
        );
      }
    },
  );
  context.subscriptions.push(inspectorCmd);

  // Initial population — best-effort + non-blocking so extension activation
  // doesn't wait on the kernel.
  void provider.refresh();

  return provider;
}
