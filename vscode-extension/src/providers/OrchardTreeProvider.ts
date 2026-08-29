/**
 * A5.20 — Orchard Tree Provider (thin VSCode wrapper).
 *
 * Pure data + sort logic lives in `../orchard-client/tree-model.js`. This
 * file only does two things:
 *   1. Maps NODE_KIND-shaped pure-data nodes → vscode.TreeItem
 *   2. Wires the TreeDataProvider event surface (refresh, click → command)
 *
 * Why the split:
 *   - The pure tree-model is testable in plain Node (see
 *     scripts/orchard/test/vscode-orchard-client.test.js)
 *   - The TreeItem mapping here is trivial + cosmetic; bugs in it surface
 *     as visual glitches, not functional drift
 *   - If a future product decision is "use a webview instead of the native
 *     tree", we drop this file + replace the mapping; the data model stays.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
import * as vscode from "vscode";

// CommonJS interop — these are .js modules.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const treeModel = require("../orchard-client/tree-model.js");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildOrchardClient } = require("../orchard-client/index.js");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { readAuthSnapshot } = require("../orchard-client/shared-auth.js");
// M5.17 — MCP-requires chip helpers (pure, gate-testable).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MCP_CHIP = require("./orchard-mcp-chip-core.js") as {
  MCP_REQUIRES_PREFIX: string;
  extractMcpRequires(fruit: unknown): ReadonlyArray<string>;
  formatMcpRequiresChip(fruit: unknown): string;
  joinDescriptionWithChip(existing: string | null | undefined, chip: string | null | undefined): string;
};

interface PureNode {
  kind: string;
  id: string;
  label: string;
  description?: string;
  contextValue?: string;
  scope?: string;
  variety?: string;
  snapshot?: unknown;
  fruit?: unknown;
  tier_class?: string;
}

const RIPENESS_ICONS: Record<string, string> = {
  Mature: "verified",
  Bearing: "circle-filled",
  Sapling: "circle-outline",
  Seedling: "circle-small-outline",
};

const VARIETY_ICONS: Record<string, string> = {
  azure: "cloud",
  gcp: "cloud-upload",
  aws: "cloud-download",
  oss: "github",
  hybrid: "globe",
};

export class OrchardTreeProvider implements vscode.TreeDataProvider<PureNode> {
  private _onDidChange = new vscode.EventEmitter<PureNode | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _client: any;
  // Cache the auth snapshot so root rebuild after a refresh shows latest state.
  private _authSnapshot: unknown = null;

  constructor(opts?: { client?: unknown; log?: (s: string) => void; err?: (s: string) => void }) {
    const o = opts || {};
    this._client = o.client || buildOrchardClient({
      onLog: typeof o.log === "function" ? o.log : undefined,
      onErr: typeof o.err === "function" ? o.err : undefined,
    });
  }

  /** Public: force a tree rebuild (also re-reads auth snapshot). */
  async refresh(): Promise<void> {
    try {
      this._authSnapshot = await readAuthSnapshot();
    } catch {
      this._authSnapshot = null;
    }
    this._onDidChange.fire();
  }

  getTreeItem(node: PureNode): vscode.TreeItem {
    return this._toTreeItem(node);
  }

  async getChildren(element?: PureNode): Promise<PureNode[]> {
    if (!element) {
      if (this._authSnapshot === null) {
        try { this._authSnapshot = await readAuthSnapshot(); } catch { /* keep null */ }
      }
      return treeModel.buildRootNodes(this._authSnapshot);
    }
    switch (element.kind) {
      case treeModel.NODE_KIND.VARIETY:
        return treeModel.buildVarietyChildren(this._client, element.variety);
      case treeModel.NODE_KIND.BUSHEL:
        return treeModel.buildBushelChildren(this._client);
      default:
        return [];
    }
  }

  private _toTreeItem(node: PureNode): vscode.TreeItem {
    const collapsibleState = this._collapsibleStateFor(node);
    const item = new vscode.TreeItem(node.label, collapsibleState);
    if (node.description) item.description = node.description;
    item.contextValue = node.contextValue;

    // M5.17 — when a FRUIT carries an `mcp_scope.attached` manifest list,
    // append a `requires: azure, playwright` chip to its description so
    // operators can see the federation pre-attach surface inline. The
    // chip is computed via the pure-core; here we only do the join.
    if (node.kind === treeModel.NODE_KIND.FRUIT) {
      const chip = MCP_CHIP.formatMcpRequiresChip(node.fruit);
      if (chip) {
        item.description = MCP_CHIP.joinDescriptionWithChip(
          typeof item.description === "string" ? item.description : "",
          chip,
        );
      }
    }

    // Icon mapping by kind
    switch (node.kind) {
      case treeModel.NODE_KIND.AUTH_BADGE: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const snap = node.snapshot as any;
        if (snap && snap.signed_in) item.iconPath = new vscode.ThemeIcon("verified-filled");
        else if (snap && snap.expired) item.iconPath = new vscode.ThemeIcon("warning");
        else item.iconPath = new vscode.ThemeIcon("account");
        item.tooltip = new vscode.MarkdownString(
          snap && snap.signed_in
            ? `**Signed in** as \`${snap.email || snap.subject || "user"}\` · tier: \`${snap.tier}\`\n\nEntitlements: ${(snap.entitlements || []).join(", ") || "(none)"}`
            : "Run `frootai login` in a terminal to sign in."
        );
        item.command = {
          command: "frootai.orchard.signIn",
          title: "Sign in",
        };
        break;
      }
      case treeModel.NODE_KIND.VARIETY: {
        const v = node.variety || "";
        item.iconPath = new vscode.ThemeIcon(VARIETY_ICONS[v] || "folder");
        break;
      }
      case treeModel.NODE_KIND.BUSHEL: {
        item.iconPath = new vscode.ThemeIcon("inbox");
        break;
      }
      case treeModel.NODE_KIND.FRUIT: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fruit = node.fruit as any;
        const ripeness = (fruit && fruit.ripeness) || "";
        item.iconPath = new vscode.ThemeIcon(RIPENESS_ICONS[ripeness] || "circle-outline");
        // Click → open detail (handled by the orchard-real command surface)
        item.command = {
          command: "frootai.orchard.show",
          title: "Show details",
          arguments: [node.id],
        };
        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`**${node.label}**\n\n`);
        if (fruit && fruit.tagline) tooltip.appendMarkdown(`${fruit.tagline}\n\n`);
        if (fruit && fruit.id) tooltip.appendMarkdown(`\`${fruit.id}\`\n\n`);
        tooltip.appendMarkdown(`Ripeness: \`${ripeness || "?"}\`\n\n`);
        // M5.17 — surface the MCP-requires chip in the tooltip too so
        // operators don't have to widen the tree column to read it.
        const chipAreas = MCP_CHIP.extractMcpRequires(fruit);
        if (chipAreas.length > 0) {
          tooltip.appendMarkdown(`Requires MCP areas: ${chipAreas.map((a) => `\`${a}\``).join(", ")}\n\n`);
        }
        if (node.tier_class === "paid") tooltip.appendMarkdown(`💎 _Paid layered install path (requires Pro tier)_`);
        item.tooltip = tooltip;
        break;
      }
      case treeModel.NODE_KIND.BUSHEL_ITEM: {
        item.iconPath = new vscode.ThemeIcon("bookmark");
        item.command = {
          command: "frootai.orchard.show",
          title: "Show details",
          arguments: [node.label],
        };
        break;
      }
      case treeModel.NODE_KIND.EMPTY: {
        item.iconPath = new vscode.ThemeIcon("info");
        break;
      }
      case treeModel.NODE_KIND.ERROR: {
        item.iconPath = new vscode.ThemeIcon("error");
        break;
      }
    }

    return item;
  }

  private _collapsibleStateFor(node: PureNode): vscode.TreeItemCollapsibleState {
    if (node.kind === treeModel.NODE_KIND.VARIETY) return vscode.TreeItemCollapsibleState.Collapsed;
    if (node.kind === treeModel.NODE_KIND.BUSHEL) return vscode.TreeItemCollapsibleState.Collapsed;
    return vscode.TreeItemCollapsibleState.None;
  }
}
