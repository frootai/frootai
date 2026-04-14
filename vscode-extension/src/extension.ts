// FrootAI VS Code Extension — TypeScript entry point
// This file will be the compiled entry point via esbuild.
// During migration, we re-export from the original extension.js.

import * as vscode from "vscode";

// Re-export from the original JS file during migration
// eslint-disable-next-line @typescript-eslint/no-var-requires
const legacy = require("./extension.js");

export function activate(context: vscode.ExtensionContext): void {
  legacy.activate(context);
}

export function deactivate(): void {
  legacy.deactivate();
}
