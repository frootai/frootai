import * as vscode from "vscode";

/** Panel data passed to the React webview app. */
export interface PanelData {
  panel: "playDetail" | "evaluation" | "scaffold" | "mcpExplorer";
  play?: { id: string; name: string; icon: string; status: string; dir: string; layer: string };
  scores?: Record<string, number>;
  tools?: Array<{ name: string; description: string; category: string; readOnly: boolean }>;
  plays?: Array<{ id: string; name: string; icon: string; status: string; dir: string; layer: string }>;
}

/**
 * Creates a webview panel that loads the React app from out/webview/.
 * Injects panelData as a global variable so the React app knows which panel to render.
 */
export function createReactPanel(
  extensionUri: vscode.Uri,
  viewType: string,
  title: string,
  panelData: PanelData,
): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    viewType,
    title,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, "out", "webview"),
      ],
    },
  );

  const webviewDir = vscode.Uri.joinPath(extensionUri, "out", "webview");
  const mainJs = panel.webview.asWebviewUri(vscode.Uri.joinPath(webviewDir, "main.js"));
  const mainCss = panel.webview.asWebviewUri(vscode.Uri.joinPath(webviewDir, "style.css"));
  const nonce = getNonce();

  // Discover chunk files (React shared code) — load them before main.js
  const fs = require("fs");
  const path = require("path");
  const webviewPath = vscode.Uri.joinPath(extensionUri, "out", "webview").fsPath;
  const chunkFiles: string[] = [];
  try {
    const files = fs.readdirSync(webviewPath) as string[];
    for (const f of files) {
      if (f.endsWith("-chunk.js")) {
        chunkFiles.push(f);
      }
    }
  } catch { /* no chunks — fine */ }

  const chunkScripts = chunkFiles
    .map(f => `<script nonce="${nonce}" src="${panel.webview.asWebviewUri(vscode.Uri.joinPath(webviewDir, f))}"></script>`)
    .join("\n  ");

  panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${panel.webview.cspSource};">
  <link rel="stylesheet" href="${mainCss}">
  <title>${title}</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    window.panelData = ${JSON.stringify(panelData)};
  </script>
  ${chunkScripts}
  <script nonce="${nonce}" src="${mainJs}"></script>
</body>
</html>`;

  return panel;
}

/** Send updated data to an existing React panel. */
export function updateReactPanel(panel: vscode.WebviewPanel, data: PanelData): void {
  panel.webview.postMessage({ type: "update", data });
}

function getNonce(): string {
  let text = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
