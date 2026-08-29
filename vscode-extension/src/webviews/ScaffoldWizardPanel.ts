import * as vscode from "vscode";

interface PlayEntry {
  id: string;
  name: string;
  icon?: string;
  codicon?: string;
  desc?: string;
  cx?: string;
  infra?: string;
}

const PLAYS: PlayEntry[] = Array.from({ length: 101 }, (_, i) => {
  const id = String(i).padStart(2, "0");
  return { id, name: `Play ${id}`, icon: "🎯" };
});

export class ScaffoldWizardPanel {
  public static currentPanel: ScaffoldWizardPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(plays?: PlayEntry[]): void {
    const column =
      vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (ScaffoldWizardPanel.currentPanel) {
      ScaffoldWizardPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "frootai.scaffoldWizard",
      "FAI Scaffold Wizard",
      column,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    ScaffoldWizardPanel.currentPanel = new ScaffoldWizardPanel(panel, plays);
  }

  private constructor(panel: vscode.WebviewPanel, plays?: PlayEntry[]) {
    this._panel = panel;
    this._panel.webview.html = this._getHtml(plays ?? PLAYS);
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      (msg) => {
        if (msg.command === "create") {
          vscode.commands.executeCommand(
            "frootai.scaffoldPlay",
            msg.playId,
            msg.projectName
          );
        }
      },
      null,
      this._disposables
    );
  }

  public dispose(): void {
    ScaffoldWizardPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
  }

  private _getHtml(plays: PlayEntry[]): string {
    const playsJson = JSON.stringify(plays).replace(/</g, "\\u003c");

    const devkitFiles = [
      ".github/copilot-instructions.md",
      ".github/agents/builder.agent.md",
      ".github/agents/reviewer.agent.md",
      ".github/agents/tuner.agent.md",
      "config/openai.json",
      "config/guardrails.json",
      "fai-manifest.json",
    ];
    const filesHtml = devkitFiles
      .map((f) => `<div class="file-row">📄 <span>\${projectName}/${f}</span></div>`)
      .join("\n          ");

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:20px;margin:0;line-height:1.6}
  h1{font-size:22px;margin-bottom:4px}
  .subtitle{opacity:0.7;margin-bottom:24px;font-size:13px}
  .steps{display:flex;gap:6px;margin-bottom:24px}
  .step-dot{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;border:2px solid var(--vscode-widget-border);color:var(--vscode-foreground);opacity:0.5}
  .step-dot.active{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-color:var(--vscode-button-background);opacity:1}
  .step-dot.done{background:#10b981;color:#fff;border-color:#10b981;opacity:1}
  .panel{display:none}.panel.active{display:block}
  .search{width:100%;padding:8px 12px;border:1px solid var(--vscode-input-border);background:var(--vscode-input-background);color:var(--vscode-input-foreground);border-radius:6px;font-size:13px;margin-bottom:12px;box-sizing:border-box}
  .play-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;max-height:320px;overflow-y:auto}
  .play-card{background:var(--vscode-editor-inactiveSelectionBackground);border:1px solid var(--vscode-widget-border);border-radius:6px;padding:10px;cursor:pointer;text-align:center;font-size:12px}
  .play-card:hover,.play-card.selected{border-color:var(--vscode-focusBorder);background:var(--vscode-list-activeSelectionBackground)}
  .play-card .pid{font-weight:700;font-size:14px}
  .field{margin-bottom:16px}
  .field label{display:block;font-weight:600;margin-bottom:4px;font-size:13px}
  .field input{width:100%;padding:8px 12px;border:1px solid var(--vscode-input-border);background:var(--vscode-input-background);color:var(--vscode-input-foreground);border-radius:6px;font-size:13px;box-sizing:border-box}
  .file-row{padding:4px 8px;font-size:12px;font-family:var(--vscode-editor-font-family);border-bottom:1px solid var(--vscode-widget-border)}
  .nav{display:flex;gap:10px;margin-top:20px}
  .btn{padding:8px 16px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
  .btn:hover{background:var(--vscode-button-hoverBackground)}
  .btn-secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
  .btn:disabled{opacity:0.5;cursor:default}
  .summary{background:var(--vscode-editor-inactiveSelectionBackground);border:1px solid var(--vscode-widget-border);border-radius:8px;padding:16px;margin-bottom:16px}
  .summary h3{margin:0 0 8px;font-size:15px}
</style></head><body>
  <h1>🚀 FAI Scaffold Wizard</h1>
  <p class="subtitle">Create a new solution play project in 4 steps</p>
  <div class="steps" id="stepDots"></div>

  <div class="panel active" id="step1">
    <h2>Step 1: Select a Play</h2>
    <input class="search" id="playSearch" placeholder="Search plays..." oninput="filterPlays()">
    <div class="play-grid" id="playGrid"></div>
  </div>

  <div class="panel" id="step2">
    <h2>Step 2: Project Name</h2>
    <div class="field"><label>Project Name</label>
      <input id="projectName" placeholder="my-rag-project" oninput="updatePreview()"></div>
  </div>

  <div class="panel" id="step3">
    <h2>Step 3: Preview</h2>
    <div class="summary" id="previewSummary"></div>
    <div id="fileList"></div>
  </div>

  <div class="panel" id="step4">
    <h2>Step 4: Done!</h2>
    <p>Click <strong>Create Project</strong> to scaffold your play.</p>
  </div>

  <div class="nav">
    <button class="btn btn-secondary" id="prevBtn" onclick="go(-1)" disabled>← Back</button>
    <button class="btn" id="nextBtn" onclick="go(1)" disabled>Next →</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const plays = ${playsJson};
    let step = 0, selectedPlay = null, projectName = '';

    function renderDots() {
      const c = document.getElementById('stepDots');
      c.innerHTML = [1,2,3,4].map(i => {
        const cls = i-1 === step ? 'active' : i-1 < step ? 'done' : '';
        return '<div class="step-dot '+cls+'">'+(i-1<step?'✓':i)+'</div>';
      }).join('');
    }

    function renderPlays(list) {
      document.getElementById('playGrid').innerHTML = list.map(p =>
        '<div class="play-card'+(selectedPlay&&selectedPlay.id===p.id?' selected':'')+'" onclick="pickPlay(\\''+p.id+'\\')"><div class="pid">'+p.icon+' '+p.id+'</div>'+p.name+'</div>'
      ).join('');
    }

    function pickPlay(id) {
      selectedPlay = plays.find(p => p.id === id) || null;
      renderPlays(plays);
      updateNav();
    }

    function filterPlays() {
      const q = document.getElementById('playSearch').value.toLowerCase();
      renderPlays(plays.filter(p => p.id.includes(q) || p.name.toLowerCase().includes(q)));
    }

    function updatePreview() {
      projectName = document.getElementById('projectName').value.trim();
      updateNav();
    }

    function showPreview() {
      const s = document.getElementById('previewSummary');
      s.innerHTML = '<h3>'+selectedPlay.icon+' Play '+selectedPlay.id+' — '+selectedPlay.name+'</h3><p>Project: <strong>'+(projectName||'unnamed')+'</strong></p>';
      const files = ${JSON.stringify(devkitFiles)};
      document.getElementById('fileList').innerHTML = files.map(f => '<div class="file-row">📄 '+(projectName||'project')+'/'+f+'</div>').join('');
    }

    function go(dir) {
      document.getElementById('step'+(step+1)).classList.remove('active');
      step += dir;
      if (step < 0) step = 0;
      if (step > 3) step = 3;
      document.getElementById('step'+(step+1)).classList.add('active');
      if (step === 2) showPreview();
      if (step === 3) {
        vscode.postMessage({command:'create',playId:selectedPlay.id,projectName:projectName});
      }
      renderDots();
      updateNav();
    }

    function updateNav() {
      const prev = document.getElementById('prevBtn');
      const next = document.getElementById('nextBtn');
      prev.disabled = step === 0;
      if (step === 0) next.disabled = !selectedPlay;
      else if (step === 1) next.disabled = !projectName;
      else if (step === 3) next.disabled = true;
      else next.disabled = false;
      next.textContent = step === 2 ? 'Create Project' : step === 3 ? 'Done' : 'Next →';
    }

    renderDots();
    renderPlays(plays);
  </script>
</body></html>`;
  }
}
