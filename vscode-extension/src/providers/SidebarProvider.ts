import * as vscode from "vscode";

/**
 * WebviewViewProvider for the FrootAI sidebar.
 * Renders the React sidebar app inside the VS Code sidebar panel.
 */
export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "frootai.sidebarView";
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, "out", "webview"),
        vscode.Uri.joinPath(this._extensionUri, "media"),
      ],
    };

    webviewView.webview.html = this._getHtml(webviewView.webview);

    // Handle messages from the React sidebar
    webviewView.webview.onDidReceiveMessage((msg: unknown) => {
      if (!msg || typeof msg !== "object") return;
      const value = msg as { command?: unknown; args?: unknown };
      const command = typeof value.command === "string" ? value.command : "";
      const allowed = new Set(["frootai.openWelcome", "frootai.tokenOps.openDashboard", "frootai.searchAll"]);
      if (!allowed.has(command)) return;
      const args = Array.isArray(value.args) ? value.args.filter((arg): arg is string => typeof arg === "string").slice(0, 2) : [];
      void vscode.commands.executeCommand(command, ...args);
    });
  }

  private _getHtml(webview: vscode.Webview): string {
    const webviewDir = vscode.Uri.joinPath(this._extensionUri, "out", "webview");
    const sidebarJs = webview.asWebviewUri(vscode.Uri.joinPath(webviewDir, "sidebar.js"));
    const sidebarCss = webview.asWebviewUri(vscode.Uri.joinPath(webviewDir, "sidebar.css"));
    const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "frootai-mark.png"));
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource}; font-src ${webview.cspSource};">
  <link rel="stylesheet" href="${sidebarCss}">
  <title>FrootAI</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">window.sidebarData = ${JSON.stringify({ logoUri: logoUri.toString() })};</script>
  <script nonce="${nonce}" src="${sidebarJs}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
