import * as vscode from "vscode";

export class PlayDetailPanel {
  public static currentPanel: PlayDetailPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(play: {
    id: string;
    name: string;
    icon?: string;
    codicon?: string;
    dir: string;
    layer: string;
    status?: string;
    desc?: string;
    cx?: string;
    infra?: string;
  }): void {
    const column =
      vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (PlayDetailPanel.currentPanel) {
      PlayDetailPanel.currentPanel._panel.reveal(column);
      PlayDetailPanel.currentPanel._update(play);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "frootai.playDetail",
      `Play ${play.id} — ${play.name}`,
      column,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    PlayDetailPanel.currentPanel = new PlayDetailPanel(panel, play);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    play: { id: string; name: string; icon?: string; codicon?: string; dir: string; layer: string; status?: string; desc?: string; cx?: string; infra?: string }
  ) {
    this._panel = panel;
    this._update(play);
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      (msg) => {
        switch (msg.command) {
          case "initDevKit":
            vscode.commands.executeCommand("frootai.initDevKit", msg.playDir);
            break;
          case "initTuneKit":
            vscode.commands.executeCommand("frootai.initTuneKit", msg.playDir);
            break;
          case "cost":
            vscode.commands.executeCommand("frootai.estimateCost", msg.playId);
            break;
          case "diagram":
            vscode.commands.executeCommand("frootai.viewDiagram", msg.playId);
            break;
          case "website":
            vscode.env.openExternal(
              vscode.Uri.parse(`https://frootai.dev/solution-plays/${msg.playId}`)
            );
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public dispose(): void {
    PlayDetailPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
  }

  private _update(play: {
    id: string; name: string; icon?: string; codicon?: string; dir: string; layer: string; status?: string; desc?: string; cx?: string; infra?: string;
  }): void {
    this._panel.title = `Play ${play.id} — ${play.name}`;
    this._panel.webview.html = this._getHtml(play);
  }

  private _getHtml(play: {
    id: string; name: string; icon?: string; codicon?: string; dir: string; layer: string; status?: string; desc?: string; cx?: string; infra?: string;
  }): string {
    const complexityColors: Record<string, string> = {
      Low: "#10b981", Medium: "#f59e0b", High: "#ef4444",
      "Very High": "#7c3aed", Foundation: "#0ea5e9",
    };
    const complexity = play.cx || (play.layer === "F" ? "Foundation" : "Medium");
    const badgeColor = complexityColors[complexity] || "#6b7280";

    const wafPillars = [
      { name: "Reliability", icon: "🔄", color: "#3b82f6" },
      { name: "Security", icon: "🔒", color: "#ef4444" },
      { name: "Cost Optimization", icon: "💰", color: "#10b981" },
      { name: "Operational Excellence", icon: "⚙️", color: "#f59e0b" },
      { name: "Performance", icon: "⚡", color: "#8b5cf6" },
      { name: "Responsible AI", icon: "🤖", color: "#ec4899" },
    ];

    const pills = wafPillars
      .map(
        (p) =>
          `<span class="pill" style="background:${p.color}22;color:${p.color};border:1px solid ${p.color}44">${p.icon} ${p.name}</span>`
      )
      .join("\n      ");

    const escDir = play.dir.replace(/\\/g, "\\\\");

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:20px;margin:0;line-height:1.6}
  .hero{text-align:center;padding:30px 0;border-bottom:1px solid var(--vscode-widget-border);margin-bottom:24px}
  .hero h1{font-size:28px;margin:0 0 8px}.hero .icon{font-size:48px;margin-bottom:12px;display:block}
  .badge{display:inline-block;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;color:#fff}
  .section{margin:24px 0}.section h2{font-size:18px;margin-bottom:12px;border-bottom:1px solid var(--vscode-widget-border);padding-bottom:6px}
  .pills{display:flex;flex-wrap:wrap;gap:8px}.pill{padding:6px 14px;border-radius:16px;font-size:12px;font-weight:500}
  .actions{display:flex;gap:10px;margin-top:20px;flex-wrap:wrap}
  .btn{padding:8px 16px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
  .btn:hover{background:var(--vscode-button-hoverBackground)}
  .btn-secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
  .card{background:var(--vscode-editor-inactiveSelectionBackground);border:1px solid var(--vscode-widget-border);border-radius:8px;padding:16px}
  .card h3{margin:0 0 4px;font-size:14px}.card p{margin:0;font-size:12px;opacity:0.8}
  .info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--vscode-widget-border)}
  .info-label{font-weight:600;opacity:0.7;font-size:13px}.info-value{font-size:13px}
</style></head><body>
  <div class="hero"><span class="icon">${play.icon || ""}</span><h1>Play ${play.id} — ${play.name}</h1>
    <span class="badge" style="background:${badgeColor}">${complexity}</span></div>
  <div class="section"><h2>📋 Details</h2>
    ${play.desc ? `<div class="info-row"><span class="info-label">Description</span><span class="info-value">${play.desc}</span></div>` : ""}
    <div class="info-row"><span class="info-label">Play ID</span><span class="info-value">${play.id}</span></div>
    <div class="info-row"><span class="info-label">Directory</span><span class="info-value">${play.dir}</span></div>
    <div class="info-row"><span class="info-label">FROOT Layer</span><span class="info-value">${play.layer}</span></div>
    ${play.infra ? `<div class="info-row"><span class="info-label">Infrastructure</span><span class="info-value">${play.infra}</span></div>` : ""}
    <div class="info-row"><span class="info-label">Status</span><span class="info-value">${play.status || "Ready"}</span></div></div>
  <div class="section"><h2>🏗️ WAF Alignment</h2><div class="pills">${pills}</div></div>
  <div class="section"><h2>⚡ Quick Actions</h2><div class="actions">
    <button class="btn" onclick="action('initDevKit')">Initialize DevKit</button>
    <button class="btn btn-secondary" onclick="action('initTuneKit')">Initialize TuneKit</button>
    <button class="btn btn-secondary" onclick="action('cost')">Estimate Cost</button>
    <button class="btn btn-secondary" onclick="action('diagram')">View Diagram</button>
    <button class="btn btn-secondary" onclick="action('website')">Open on Website</button></div></div>
  <div class="section"><h2>🔌 FAI Protocol</h2><div class="card"><h3>fai-manifest.json</h3>
    <p>Wire this play with <code>frootai wire ${play.id}</code> to generate the manifest.</p></div></div>
  <script>const vscode=acquireVsCodeApi();function action(t){vscode.postMessage({command:t,playId:'${play.id}',playDir:'${escDir}'});}</script>
</body></html>`;
  }
}
