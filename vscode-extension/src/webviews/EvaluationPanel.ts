import * as vscode from "vscode";

const DEFAULT_SCORES: Record<string, number> = {
  groundedness: 4.5,
  relevance: 3.8,
  coherence: 4.2,
  fluency: 4.6,
  safety: 4.9,
};

const DEFAULT_THRESHOLD = 4.0;

export class EvaluationPanel {
  public static currentPanel: EvaluationPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(scores?: Record<string, number>): void {
    const column =
      vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (EvaluationPanel.currentPanel) {
      EvaluationPanel.currentPanel._panel.reveal(column);
      EvaluationPanel.currentPanel._update(scores);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "frootai.evaluation",
      "FAI Evaluation Dashboard",
      column,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    EvaluationPanel.currentPanel = new EvaluationPanel(panel, scores);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    scores?: Record<string, number>
  ) {
    this._panel = panel;
    this._update(scores);
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      (msg) => {
        switch (msg.command) {
          case "runEvaluation":
            vscode.commands.executeCommand("frootai.runEvaluation");
            break;
          case "exportJson":
            vscode.commands.executeCommand("frootai.exportEvaluation", msg.scores);
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public dispose(): void {
    EvaluationPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
  }

  private _update(scores?: Record<string, number>): void {
    this._panel.webview.html = this._getHtml(scores ?? DEFAULT_SCORES);
  }

  private _getHtml(scores: Record<string, number>): string {
    const threshold = DEFAULT_THRESHOLD;
    const entries = Object.entries(scores);
    const allPass = entries.every(([, v]) => v >= threshold);
    const bannerColor = allPass ? "#10b981" : "#ef4444";
    const bannerText = allPass ? "✅ ALL METRICS PASS" : "❌ SOME METRICS BELOW THRESHOLD";

    const icons: Record<string, string> = {
      groundedness: "🎯", relevance: "🔍", coherence: "🔗",
      fluency: "💬", safety: "🛡️",
    };

    const cards = entries
      .map(([name, score]) => {
        const color = score >= 4.0 ? "#10b981" : score >= 3.0 ? "#f59e0b" : "#ef4444";
        const status = score >= threshold ? "PASS" : "FAIL";
        const icon = icons[name] || "📊";
        return `<div class="metric-card">
        <div class="metric-icon">${icon}</div>
        <div class="metric-name">${name}</div>
        <div class="metric-score" style="color:${color}">${score.toFixed(1)}</div>
        <div class="metric-bar"><div class="bar-fill" style="width:${(score / 5) * 100}%;background:${color}"></div></div>
        <div class="metric-meta"><span>Threshold: ${threshold.toFixed(1)}</span>
          <span class="status" style="color:${color}">${status}</span></div></div>`;
      })
      .join("\n    ");

    const scoresJson = JSON.stringify(scores).replace(/'/g, "\\'");

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:20px;margin:0;line-height:1.6}
  .banner{text-align:center;padding:16px;border-radius:8px;font-size:18px;font-weight:700;margin-bottom:24px;color:#fff}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;margin-bottom:24px}
  .metric-card{background:var(--vscode-editor-inactiveSelectionBackground);border:1px solid var(--vscode-widget-border);border-radius:8px;padding:16px;text-align:center}
  .metric-icon{font-size:28px;margin-bottom:6px}
  .metric-name{font-size:13px;font-weight:600;text-transform:capitalize;margin-bottom:4px}
  .metric-score{font-size:32px;font-weight:700;margin:4px 0}
  .metric-bar{height:6px;background:var(--vscode-widget-border);border-radius:3px;overflow:hidden;margin:8px 0}
  .bar-fill{height:100%;border-radius:3px;transition:width .3s}
  .metric-meta{display:flex;justify-content:space-between;font-size:11px;opacity:0.8}
  .status{font-weight:700}
  .actions{display:flex;gap:10px;flex-wrap:wrap}
  .btn{padding:10px 20px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
  .btn:hover{background:var(--vscode-button-hoverBackground)}
  .btn-secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
</style></head><body>
  <div class="banner" style="background:${bannerColor}">${bannerText}</div>
  <div class="grid">${cards}</div>
  <div class="actions">
    <button class="btn" onclick="run()">▶ Run Evaluation</button>
    <button class="btn btn-secondary" onclick="exportJson()">📥 Export JSON</button>
  </div>
  <script>
    const vscode=acquireVsCodeApi();
    function run(){vscode.postMessage({command:'runEvaluation'});}
    function exportJson(){vscode.postMessage({command:'exportJson',scores:${scoresJson}});}
  </script>
</body></html>`;
  }
}
