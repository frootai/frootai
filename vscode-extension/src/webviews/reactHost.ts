import * as vscode from "vscode";

/** Panel data passed to the React webview app. */
export interface PanelData {
  panel: "playDetail" | "evaluation" | "scaffold" | "mcpExplorer";
  play?: { id: string; name: string; icon?: string; codicon?: string; status: string; dir: string; layer: string; desc?: string; cx?: string; infra?: string };
  scores?: Record<string, number>;
  tools?: Array<{ name: string; description: string; category: string; readOnly: boolean }>;
  plays?: Array<{ id: string; name: string; icon?: string; codicon?: string; status: string; dir: string; layer: string; desc?: string; cx?: string; infra?: string }>;
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
        vscode.Uri.joinPath(extensionUri, "media"),
      ],
    },
  );

  const webviewDir = vscode.Uri.joinPath(extensionUri, "out", "webview");
  const mediaDir = vscode.Uri.joinPath(extensionUri, "media");
  const mainJs = panel.webview.asWebviewUri(vscode.Uri.joinPath(webviewDir, "main.js"));
  const mainCss = panel.webview.asWebviewUri(vscode.Uri.joinPath(webviewDir, "main.css"));
  const logoUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaDir, "frootai-mark.png"));
  const nonce = getNonce();

  // Add logoUri to panelData so React can use it
  const dataWithLogo = { ...panelData, logoUri: logoUri.toString() };

  panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${panel.webview.cspSource}; font-src ${panel.webview.cspSource};">
  <link rel="stylesheet" href="${mainCss}">
  <title>${title}</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    window.panelData = ${JSON.stringify(dataWithLogo)};
  </script>
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
