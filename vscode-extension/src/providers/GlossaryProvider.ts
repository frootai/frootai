import * as vscode from "vscode";
import { getGlossary } from "../utils/knowledge";

export class GlossaryProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.TreeItem[] {
    const glossary = getGlossary();
    const entries = Object.entries(glossary);
    const terms = entries.slice(0, 50).map(([_key, val]) => {
      const item = new vscode.TreeItem(
        val.term,
        vscode.TreeItemCollapsibleState.None
      );
      item.description = val.definition.substring(0, 60) + "...";
      item.tooltip = `${val.term}\n\n${val.definition.substring(0, 200)}`;
      item.command = {
        command: "frootai.lookupTerm",
        title: "Lookup",
        arguments: [val.term],
      };
      return item;
    });

    if (entries.length > 50) {
      const more = new vscode.TreeItem(
        `... ${entries.length - 50} more terms`,
        vscode.TreeItemCollapsibleState.None
      );
      more.description = "Use Ctrl+Shift+P → Look Up AI Term";
      terms.push(more);
    }
    return terms;
  }
}
