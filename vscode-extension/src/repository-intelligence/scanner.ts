import * as path from "node:path";
import * as vscode from "vscode";
import type { RepositoryInput } from "./analyzer";
import { shouldRead } from "./scanPolicy";

const MAX_FILES = 5_000;
const MAX_TEXT_FILES = 80;
const MAX_TEXT_BYTES = 20_000;
const EXCLUDE = "**/{.git,node_modules,.next,out,dist,build,coverage,.venv,venv,vendor,target,bin,obj}/**";

export async function scanRepository(folder: vscode.WorkspaceFolder): Promise<RepositoryInput> {
  const uris = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, "**/*"), EXCLUDE, MAX_FILES + 1);
  const selected = uris.slice(0, MAX_FILES);
  const files = selected.map((uri) => path.relative(folder.uri.fsPath, uri.fsPath).replace(/\\/g, "/"));
  const text: Record<string, string> = {};
  const readable = selected.filter((uri) => shouldRead(path.relative(folder.uri.fsPath, uri.fsPath))).slice(0, MAX_TEXT_FILES);
  await Promise.all(readable.map(async (uri) => {
    const relative = path.relative(folder.uri.fsPath, uri.fsPath).replace(/\\/g, "/");
    try { const bytes = await vscode.workspace.fs.readFile(uri); text[relative] = Buffer.from(bytes).toString("utf8", 0, MAX_TEXT_BYTES); } catch { /* Path evidence remains. */ }
  }));
  return { name: folder.name, files, text, truncated: uris.length > MAX_FILES };
}