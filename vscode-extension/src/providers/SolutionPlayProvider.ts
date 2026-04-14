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

export class SolutionPlayProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _onDidChange = new vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChange.event;

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (!element) {
      return SOLUTION_PLAYS.map((p: SolutionPlay) => {
        const item = new vscode.TreeItem(
          `${p.id} ${p.name}`,
          vscode.TreeItemCollapsibleState.None
        );
        item.description = LAYER_NAMES[p.layer] || p.layer;
        item.tooltip = `${p.name}\nFROOT Layer: ${LAYER_NAMES[p.layer] || p.layer}\nStatus: ${p.status}\n\nClick to open actions`;
        item.contextValue = "solutionPlay";
        item.iconPath = new vscode.ThemeIcon(
          LAYER_ICONS[p.layer] || "package",
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
