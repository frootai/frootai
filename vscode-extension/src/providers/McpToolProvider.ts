import * as vscode from "vscode";
import { MCP_TOOLS, McpTool } from "../data/tools";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PROVIDER_CORE = require("./mcp-tool-provider-core") as {
  BUILTIN_HEADER_ID: string;
  FEDERATED_HEADER_PREFIX: string;
  TYPE_ICONS: Record<string, string>;
  READ_ONLY_TYPES: ReadonlySet<string>;
  buildBuiltinGroupCounts(
    tools: ReadonlyArray<{ name: string; type: string }>,
  ): ReadonlyArray<{ label: string; type: string; icon: string; desc: string; count: number }>;
  buildRootSections(input: {
    builtinToolCount: number;
    attachedAreas: Array<{ name: string; toolCount?: number }> | null | undefined;
  }): ReadonlyArray<
    | { kind: "builtin"; id: string; label: string; description: string; toolCount: number }
    | {
        kind: "federated";
        id: string;
        label: string;
        description: string;
        areaName: string;
        toolCount: number;
      }
  >;
};

interface AttachedAreaEntry {
  name: string;
  toolCount?: number;
}

interface McpToolProviderOpts {
  /**
   * M5.16 PIN_ONE_AHEAD injection point. The federation kernel client
   * isn't wired until M5.17+; until then `listAttached` is undefined
   * and the tree renders only the "Built-in (N)" root section. Once
   * M5.17 lands, wire a real `client.listAttached()` here so the tree
   * renders "Federated → Azure (N)" / etc. siblings.
   */
  listAttached?: () => Promise<AttachedAreaEntry[]>;
}

interface ToolGroupItem extends vscode.TreeItem {
  _kind?: "builtin-section" | "builtin-group" | "federated-section";
  _groupType?: string;
  _areaName?: string;
}

export class McpToolProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private readonly listAttached?: () => Promise<AttachedAreaEntry[]>;

  constructor(opts: McpToolProviderOpts = {}) {
    this.listAttached = opts.listAttached;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    // ─── Root: Built-in + per-area Federated sections ─────────
    if (!element) {
      const attached = await this._safeListAttached();
      const sections = PROVIDER_CORE.buildRootSections({
        builtinToolCount: MCP_TOOLS.length,
        attachedAreas: attached,
      });
      return sections.map((s) => {
        const item: ToolGroupItem = new vscode.TreeItem(
          s.label,
          vscode.TreeItemCollapsibleState.Collapsed,
        );
        item.description = s.description;
        if (s.kind === "builtin") {
          item._kind = "builtin-section";
          item.iconPath = new vscode.ThemeIcon("package");
          item.contextValue = "mcpBuiltinSection";
        } else {
          item._kind = "federated-section";
          item._areaName = s.areaName;
          item.iconPath = new vscode.ThemeIcon("plug");
          item.contextValue = "mcpFederatedSection";
        }
        return item;
      });
    }

    const node = element as ToolGroupItem;

    // ─── Built-in section → 8 builtin groups ──────────────────
    if (node._kind === "builtin-section") {
      const groups = PROVIDER_CORE.buildBuiltinGroupCounts(MCP_TOOLS);
      return groups.map((g) => {
        const item: ToolGroupItem = new vscode.TreeItem(
          g.label,
          vscode.TreeItemCollapsibleState.Collapsed,
        );
        item.description = g.desc;
        item.iconPath = new vscode.ThemeIcon(g.icon);
        item.contextValue = "toolGroup";
        item._kind = "builtin-group";
        item._groupType = g.type;
        return item;
      });
    }

    // ─── Built-in group → individual tools (pre-M5.16 surface) ─
    if (node._kind === "builtin-group" && node._groupType) {
      return MCP_TOOLS.filter((t: McpTool) => t.type === node._groupType).map((t: McpTool) => {
        const readOnly = PROVIDER_CORE.READ_ONLY_TYPES.has(t.type);
        const item = new vscode.TreeItem(t.name, vscode.TreeItemCollapsibleState.None);
        item.description = readOnly ? "read-only" : "read-write";
        item.tooltip = new vscode.MarkdownString(
          `**${t.name}**\n\n${t.desc}\n\nType: \`${t.type}\` · ${readOnly ? "Read-only" : "Read-write"}\n\n_Click to view documentation_`,
        );
        item.iconPath = new vscode.ThemeIcon(
          PROVIDER_CORE.TYPE_ICONS[t.type] || "symbol-method",
        );
        item.contextValue = "mcpTool";
        item.command = {
          command: "frootai.viewToolDocs",
          title: "View Docs",
          arguments: [t],
        };
        return item;
      });
    }

    // ─── Federated section children — placeholder until M5.17 ─
    if (node._kind === "federated-section") {
      const stub = new vscode.TreeItem(
        "kernel client pending (wires at M5.17)",
        vscode.TreeItemCollapsibleState.None,
      );
      stub.iconPath = new vscode.ThemeIcon("circle-large-outline");
      stub.contextValue = "mcpFederatedPending";
      return [stub];
    }

    return [];
  }

  /**
   * PIN_ONE_AHEAD: when the kernel client isn't wired (default) or its
   * `listAttached` rejects (e.g. `kernel_connection_pending` from the
   * M5.4 stub), surface no federated sections — never throw out of the
   * tree provider.
   */
  private async _safeListAttached(): Promise<AttachedAreaEntry[]> {
    if (typeof this.listAttached !== "function") return [];
    try {
      const list = await this.listAttached();
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }
}
