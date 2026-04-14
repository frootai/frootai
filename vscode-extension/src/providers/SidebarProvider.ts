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
      ],
    };

    webviewView.webview.html = this._getHtml(webviewView.webview);

    // Handle messages from the React sidebar
    webviewView.webview.onDidReceiveMessage((msg: any) => {
      if (msg.command) {
        if (msg.command === "frootai.openPlayDetail" && msg.playId) {
          vscode.commands.executeCommand("frootai.openPlayDetail", msg.playId);
        } else {
          vscode.commands.executeCommand(msg.command);
        }
      }
    });
  }

  private _getHtml(webview: vscode.Webview): string {
    const webviewDir = vscode.Uri.joinPath(this._extensionUri, "out", "webview");
    const sidebarJs = webview.asWebviewUri(vscode.Uri.joinPath(webviewDir, "sidebar.js"));
    const sidebarCss = webview.asWebviewUri(vscode.Uri.joinPath(webviewDir, "sidebar.css"));
    // Also load the shared chunk (SearchInput, Badge components)
    const sharedJs = webview.asWebviewUri(vscode.Uri.joinPath(webviewDir, "SearchInput.js"));
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <link rel="stylesheet" href="${sidebarCss}">
  <title>FrootAI</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${sharedJs}"></script>
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
