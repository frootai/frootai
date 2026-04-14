import * as vscode from "vscode";
import { SOLUTION_PLAYS } from "../data/plays";
import { MCP_TOOLS } from "../data/tools";
import { getGlossary } from "../utils/knowledge";

export async function searchAll(): Promise<void> {
  const input = await vscode.window.showInputBox({
    prompt: "Search FrootAI — plays, tools, glossary, modules",
    placeHolder: "e.g., RAG, security, embeddings...",
  });
  if (!input) return;

  const query = input.toLowerCase();
  const results: vscode.QuickPickItem[] = [];

  // Search plays
  for (const p of SOLUTION_PLAYS) {
    if (
      p.name.toLowerCase().includes(query) ||
      p.dir.toLowerCase().includes(query)
    ) {
      results.push({
        label: `$(rocket) ${p.id} — ${p.name}`,
        description: `Play • ${p.layer}`,
        detail: p.dir,
      });
    }
  }

  // Search MCP tools
  for (const t of MCP_TOOLS) {
    if (
      t.name.toLowerCase().includes(query) ||
      t.desc.toLowerCase().includes(query)
    ) {
      results.push({
        label: `$(tools) ${t.name}`,
        description: `MCP Tool • ${t.type}`,
        detail: t.desc,
      });
    }
  }

  // Search glossary
  const glossary = getGlossary();
  for (const [key, entry] of Object.entries(glossary)) {
    if (
      key.includes(query) ||
      entry.definition?.toLowerCase().includes(query)
    ) {
      results.push({
        label: `$(book) ${entry.term}`,
        description: "Glossary",
        detail: (entry.definition ?? "").substring(0, 100) + "...",
      });
    }
  }

  if (results.length === 0) {
    vscode.window.showInformationMessage(`No results for "${input}"`);
    return;
  }

  const picked = await vscode.window.showQuickPick(results, {
    title: `FrootAI Search — ${results.length} results for "${input}"`,
    placeHolder: "Select a result...",
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (picked) {
    vscode.window.showInformationMessage(`Selected: ${picked.label}`);
  }
}
