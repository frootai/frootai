// FrootAI VS Code Extension v6.0.0 — TypeScript entry point
// Legacy JS handles existing 25 commands.
// New TypeScript modules add: searchAll, React webview panels.

import * as vscode from "vscode";
import { searchAll } from "./commands/search";
import { createReactPanel } from "./webviews/reactHost";
import { SidebarProvider } from "./providers/SidebarProvider";
import { SOLUTION_PLAYS } from "./data/plays";

// Legacy extension handles existing commands + tree views
// eslint-disable-next-line @typescript-eslint/no-var-requires
const legacy = require("./extension.js");

export function activate(context: vscode.ExtensionContext): void {
  // Activate legacy (existing 25 commands, MCP provider)
  legacy.activate(context);

  // ─── React Sidebar ───
  const sidebarProvider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, sidebarProvider),
  );

  // ─── New Commands — React Webview Panels ───

  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.searchAll", () => searchAll()),

    vscode.commands.registerCommand("frootai.openPlayDetail", (playOrId?: any) => {
      let play = playOrId;
      if (typeof playOrId === "string") {
        play = SOLUTION_PLAYS.find(p => p.id === playOrId) ?? SOLUTION_PLAYS[0];
      }
      if (!play) { play = SOLUTION_PLAYS[0]; }

      const panel = createReactPanel(context.extensionUri, "frootai.playDetail", `Play ${play.id} — ${play.name}`, {
        panel: "playDetail",
        play,
      });
      panel.webview.onDidReceiveMessage((msg: any) => {
        if (msg.command === "initDevKit") { vscode.commands.executeCommand("frootai.initDevKit"); }
        else if (msg.command === "initTuneKit") { vscode.commands.executeCommand("frootai.initTuneKit"); }
        else if (msg.command === "cost") { vscode.commands.executeCommand("frootai.quickCostEstimate"); }
        else if (msg.command === "website") { vscode.env.openExternal(vscode.Uri.parse(`https://frootai.dev/solution-plays/${play.dir}`)); }
      });
    }),

    vscode.commands.registerCommand("frootai.openEvaluationDashboard", () => {
      const panel = createReactPanel(context.extensionUri, "frootai.evaluation", "Evaluation Dashboard", {
        panel: "evaluation",
      });
      panel.webview.onDidReceiveMessage((msg: any) => {
        if (msg.command === "runEvaluation") { vscode.commands.executeCommand("frootai.runEvaluation"); }
      });
    }),

    vscode.commands.registerCommand("frootai.openScaffoldWizard", () => {
      const panel = createReactPanel(context.extensionUri, "frootai.scaffold", "Scaffold Wizard", {
        panel: "scaffold",
        plays: SOLUTION_PLAYS,
      });
      panel.webview.onDidReceiveMessage((msg: any) => {
        if (msg.command === "scaffold") {
          vscode.commands.executeCommand("frootai.initDevKit");
        }
      });
    }),

    vscode.commands.registerCommand("frootai.openMcpExplorer", () => {
      createReactPanel(context.extensionUri, "frootai.mcpExplorer", "MCP Tool Explorer", {
        panel: "mcpExplorer",
      });
    }),
  );
}

export function deactivate(): void {
  legacy.deactivate();
}
