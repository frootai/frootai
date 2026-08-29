/**
 * M5.11 — FederatedMcpMarketplaceProvider (TreeDataProvider for the
 * `frootai.federation.marketplace` view declared at M5.3).
 *
 * Mirrors `FederatedMcpProvider` (M5.10) split-architecture: the pure
 * tree-model lives in `federated-mcp-marketplace-tree-model.js`, this
 * file only maps `TreeNode` → `vscode.TreeItem` + wires the
 * `onDidChangeTreeData` event + registers the two row-context-menu
 * commands (`Attach` + `View on web`) the M5.11 row literal calls for.
 *
 * Data source: `FederationClient.discover()` (the M5.4 PIN_ONE_AHEAD
 * stub by default; M5.14/M5.15 swaps in the real kernel connection).
 *
 * Row-context-menu commands registered here:
 *   - `frootai.federation.marketplace.attach`   — delegates to the
 *     existing `frootai.federation.attach` command but auto-fills the
 *     picker with the right-clicked server's slug.
 *   - `frootai.federation.marketplace.viewOnWeb` — opens the
 *     marketplace page via `vscode.env.openExternal`.
 *
 * Menu wiring (the actual `when` / `group` clauses) lives in the
 * extension `package.json` `menus.view/item/context` block updated in
 * the same M5.11 ship row.
 */
import * as vscode from "vscode";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const treeModel = require("./federated-mcp-marketplace-tree-model.js") as typeof import("./federated-mcp-marketplace-tree-model");

type TreeNode =
  | { kind: "empty"; id: string; label: string; description?: string }
  | {
      kind: "tier"; id: string; label: string; description: string;
      tier: "T1" | "T2" | "T3"; serverCount: number;
    }
  | {
      kind: "server"; id: string; label: string; description: string;
      slug: string; owner: string | null; name: string; desc: string | null;
      trust: string; tier: "T1" | "T2" | "T3"; installs: number;
    };

type MarketplaceEntry = {
  slug: string;
  name?: string;
  owner?: string;
  desc?: string;
  trust?: string;
  installs?: number;
};

export interface FederatedMcpMarketplaceClient {
  discover(opts?: { query?: string }): Promise<MarketplaceEntry[]>;
}

export class FederatedMcpMarketplaceProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChange = new vscode.EventEmitter<TreeNode | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  private _client: FederatedMcpMarketplaceClient;
  private _output: vscode.OutputChannel;
  private _entries: MarketplaceEntry[] = [];

  constructor(opts: { client: FederatedMcpMarketplaceClient; output: vscode.OutputChannel }) {
    this._client = opts.client;
    this._output = opts.output;
  }

  /**
   * Re-fetch the catalog + fire the tree refresh. Best-effort: kernel
   * errors are logged + the cached `_entries` is preserved (NOT
   * cleared) so a transient hiccup doesn't blank the view.
   */
  async refresh(): Promise<void> {
    try {
      const entries = await this._client.discover();
      this._entries = Array.isArray(entries) ? entries : [];
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this._output.appendLine(
        `[${new Date().toISOString()}] [federated-marketplace] discover failed: ${msg}`,
      );
      // Keep prior state on transient failures.
    }
    this._onDidChange.fire();
  }

  getTreeItem(node: TreeNode): vscode.TreeItem {
    return this._toTreeItem(node);
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    const state = { entries: this._entries };
    if (!element) return treeModel.buildMarketplaceTreeRoot(state);
    if (element.kind === "tier") {
      return treeModel.buildMarketplaceTreeChildren(element.tier, state);
    }
    return [];
  }

  private _toTreeItem(node: TreeNode): vscode.TreeItem {
    if (node.kind === "empty") {
      const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
      item.description = node.description;
      item.contextValue = "federation.marketplace.empty";
      item.iconPath = new vscode.ThemeIcon("info");
      return item;
    }
    if (node.kind === "tier") {
      const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.Collapsed);
      item.description = node.description;
      item.contextValue = `federation.marketplace.tier.${node.tier}`;
      item.iconPath = new vscode.ThemeIcon(
        node.tier === "T1" ? "verified" : node.tier === "T2" ? "shield" : "circle-outline",
      );
      return item;
    }
    // server
    const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
    item.description = node.description;
    // contextValue drives the `when` clause for the row-context-menu items
    // declared in package.json (M5.11 menu block).
    item.contextValue = "federation.server";
    item.tooltip = [
      node.desc || node.name,
      `slug: ${node.slug}`,
      node.owner ? `owner: ${node.owner}` : null,
      `tier: ${node.tier} • trust: ${node.trust}`,
      node.installs > 0 ? `${node.installs.toLocaleString("en-US")} installs` : null,
    ].filter(Boolean).join("\n");
    item.iconPath = new vscode.ThemeIcon(
      node.tier === "T1" ? "verified" : node.tier === "T2" ? "shield" : "package",
    );
    return item;
  }
}

/**
 * Wire the M5.11 surface into the extension:
 *   - register the TreeDataProvider against the `frootai.federation.marketplace`
 *     view (declared at M5.3),
 *   - register `frootai.federation.marketplace.refresh` (mirrors the M5.10
 *     `frootai.federation.attached.refresh` pattern),
 *   - register the two row-context-menu commands the row literal calls for.
 *
 * Returns the provider so callers (extension.ts) can keep a reference for
 * cross-row wiring (e.g. M5.18 auto-attach can force a refresh).
 */
export function registerFederatedMcpMarketplaceProvider(
  context: vscode.ExtensionContext,
  opts: { client: FederatedMcpMarketplaceClient; output: vscode.OutputChannel },
): FederatedMcpMarketplaceProvider {
  const provider = new FederatedMcpMarketplaceProvider(opts);

  const treeView = vscode.window.createTreeView("frootai.federation.marketplace", {
    treeDataProvider: provider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  const refreshCmd = vscode.commands.registerCommand(
    "frootai.federation.marketplace.refresh",
    async () => { await provider.refresh(); },
  );
  context.subscriptions.push(refreshCmd);

  // ─── row-context-menu commands ────────────────────────────────
  const attachCmd = vscode.commands.registerCommand(
    "frootai.federation.marketplace.attach",
    async (node?: TreeNode) => {
      if (!node || node.kind !== "server") {
        opts.output.appendLine(
          `[${new Date().toISOString()}] [federation.marketplace.attach] no server node \u2014 delegating to plain attach picker`,
        );
        // Fall back to the standard attach command (full picker) when
        // invoked without a context-menu node (e.g. from the palette).
        await vscode.commands.executeCommand("frootai.federation.attach");
        return;
      }
      opts.output.appendLine(
        `[${new Date().toISOString()}] [federation.marketplace.attach] slug=${node.slug}`,
      );
      // M5.11 ships the menu hookup; auto-fill the picker with the
      // right-clicked slug by delegating to the standard attach command
      // (M5.4) for now. M5.14/M5.15 will refine this to skip the picker
      // entirely once the real kernel connection is wired.
      await vscode.commands.executeCommand("frootai.federation.attach", { presetSlug: node.slug });
    },
  );
  context.subscriptions.push(attachCmd);

  const viewOnWebCmd = vscode.commands.registerCommand(
    "frootai.federation.marketplace.viewOnWeb",
    async (node?: TreeNode) => {
      if (!node || node.kind !== "server") {
        opts.output.appendLine(
          `[${new Date().toISOString()}] [federation.marketplace.viewOnWeb] no server node \u2014 no-op`,
        );
        return;
      }
      const url = treeModel.buildMarketplaceUrl(node.slug);
      opts.output.appendLine(
        `[${new Date().toISOString()}] [federation.marketplace.viewOnWeb] ${url}`,
      );
      try {
        await vscode.env.openExternal(vscode.Uri.parse(url));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        opts.output.appendLine(
          `[${new Date().toISOString()}] [federation.marketplace.viewOnWeb] failed: ${msg}`,
        );
      }
    },
  );
  context.subscriptions.push(viewOnWebCmd);

  // Initial population — best-effort + non-blocking.
  void provider.refresh();

  return provider;
}
