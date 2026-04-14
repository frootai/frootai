import * as vscode from "vscode";
import { SOLUTION_PLAYS, SolutionPlay } from "../data/plays";

const LAYER_COLORS: Record<string, string> = {
  F: "charts.yellow",
  R: "charts.green",
  O: "charts.blue",
  T: "charts.purple",
};

const LAYER_NAMES: Record<string, string> = {
  F: "Foundations",
  R: "Reasoning",
  O: "Orchestration",
  T: "Transformation",
};

const LAYER_ICONS: Record<string, string> = {
  F: "server-process",
  R: "lightbulb",
  O: "extensions",
  T: "rocket",
};

/** Derive complexity from play number ranges and layer */
function getComplexity(p: SolutionPlay): string {
  const num = parseInt(p.id, 10);
  if (p.layer === "F") return "High";
  if (num <= 10) return "Medium";
  if (num <= 30) return "High";
  return "Very High";
}

export class SolutionPlayProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _onDidChange = new vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChange.event;

  private _filter = "";

  setFilter(query: string): void {
    this._filter = query.toLowerCase();
    this._onDidChange.fire();
  }

  refresh(): void {
    this._onDidChange.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (!element) {
      let plays = SOLUTION_PLAYS;
      if (this._filter) {
        plays = plays.filter(
          (p) =>
            p.name.toLowerCase().includes(this._filter) ||
            p.dir.toLowerCase().includes(this._filter) ||
            p.id.includes(this._filter)
        );
      }

      return plays.map((p: SolutionPlay) => {
        const complexity = getComplexity(p);
        const item = new vscode.TreeItem(
          `${p.id} ${p.name}`,
          vscode.TreeItemCollapsibleState.None
        );
        item.description = complexity;
        item.tooltip = new vscode.MarkdownString(
          `**${p.name}**\n\nFROOT Layer: ${LAYER_NAMES[p.layer] || p.layer}\n\nStatus: ${p.status}\n\nComplexity: ${complexity}\n\nPath: \`solution-plays/${p.dir}/\`\n\n_Click to open actions_`
        );
        item.contextValue = "solutionPlay";
        item.iconPath = new vscode.ThemeIcon(
          p.status === "Ready" ? "check" : "circle-outline",
          new vscode.ThemeColor(LAYER_COLORS[p.layer] || "charts.blue")
        );
        item.command = {
          command: "frootai.openSolutionPlay",
          title: "Open",
          arguments: [p],
        };
        return item;
      });
    }
    return [];
  }
}
