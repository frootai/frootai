import * as vscode from "vscode";
import { MCP_TOOLS, McpTool } from "../data/tools";

interface ToolGroup {
  label: string;
  type: string;
  icon: string;
  desc: string;
}

interface ToolGroupItem extends vscode.TreeItem {
  _groupType?: string;
}

const READ_ONLY_TYPES = new Set(["static", "live", "ecosystem"]);

const GROUPS: ToolGroup[] = [
  {
    label: "Knowledge (6)",
    type: "static",
    icon: "database",
    desc: "Offline knowledge lookups",
  },
  {
    label: "Live (4)",
    type: "live",
    icon: "cloud",
    desc: "Azure + GitHub API calls",
  },
  {
    label: "Agent Chain (3)",
    type: "chain",
    icon: "link",
    desc: "Build → Review → Tune workflow",
  },
  {
    label: "Ecosystem (3)",
    type: "ecosystem",
    icon: "globe",
    desc: "Model catalog, pricing, compare",
  },
  {
    label: "Compute (10)",
    type: "compute",
    icon: "circuit-board",
    desc: "Search, cost, eval, diagrams, embeddings",
  },
  {
    label: "Engine (6)",
    type: "engine",
    icon: "zap",
    desc: "FAI Engine bridge tools",
  },
  {
    label: "Scaffold (3)",
    type: "scaffold",
    icon: "file-add",
    desc: "Play + primitive scaffolding",
  },
  {
    label: "Marketplace (13)",
    type: "marketplace",
    icon: "extensions",
    desc: "Plugin install, compose, publish",
  },
];

const TYPE_ICONS: Record<string, string> = {
  static: "book",
  live: "cloud-upload",
  chain: "debug-disconnect",
  ecosystem: "graph-scatter",
  compute: "symbol-ruler",
  engine: "zap",
  scaffold: "new-file",
  marketplace: "extensions",
};

export class McpToolProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (!element) {
      return GROUPS.map((g) => {
        const count = MCP_TOOLS.filter((t) => t.type === g.type).length;
        const item: ToolGroupItem = new vscode.TreeItem(
          count > 0 ? `${g.label.replace(/\(\d+\)/, `(${count})`)}` : g.label,
          vscode.TreeItemCollapsibleState.Collapsed
        );
        item.description = g.desc;
        item.iconPath = new vscode.ThemeIcon(g.icon);
        item.contextValue = "toolGroup";
        item._groupType = g.type;
        return item;
      });
    }

    const groupItem = element as ToolGroupItem;
    const groupType =
      GROUPS.find((g) => g.label === element.label)?.type ||
      groupItem._groupType;
    if (groupType) {
      return MCP_TOOLS.filter((t: McpTool) => t.type === groupType).map(
        (t: McpTool) => {
          const readOnly = READ_ONLY_TYPES.has(t.type);
          const item = new vscode.TreeItem(
            t.name,
            vscode.TreeItemCollapsibleState.None
          );
          item.description = readOnly ? "read-only" : "read-write";
          item.tooltip = new vscode.MarkdownString(
            `**${t.name}**\n\n${t.desc}\n\nType: \`${t.type}\` · ${readOnly ? "Read-only" : "Read-write"}\n\n_Click to view documentation_`
          );
          item.iconPath = new vscode.ThemeIcon(
            TYPE_ICONS[t.type] || "symbol-method"
          );
          item.contextValue = "mcpTool";
          item.command = {
            command: "frootai.viewToolDocs",
            title: "View Docs",
            arguments: [t],
          };
          return item;
        }
      );
    }
    return [];
  }
}
