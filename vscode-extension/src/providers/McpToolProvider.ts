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
    label: "Ecosystem (10)",
    type: "ecosystem",
    icon: "globe",
    desc: "Model catalog, pricing, compare, embed",
  },
  {
    label: "Engine (6)",
    type: "engine",
    icon: "circuit-board",
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
        const item: ToolGroupItem = new vscode.TreeItem(
          g.label,
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
          const item = new vscode.TreeItem(
            t.name,
            vscode.TreeItemCollapsibleState.None
          );
          item.description = t.desc;
          item.tooltip = `${t.name}\n${t.desc}\n\nType: ${t.type}\n\nClick to view documentation`;
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
