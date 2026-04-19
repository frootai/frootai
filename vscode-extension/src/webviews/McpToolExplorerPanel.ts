import * as vscode from "vscode";

interface McpTool {
  name: string;
  description: string;
  category: string;
  readOnly: boolean;
}

const MCP_TOOLS: McpTool[] = [
  { name: "list_modules", description: "List all FrootAI modules by FROOT layer", category: "Knowledge", readOnly: true },
  { name: "get_module", description: "Get full content of a module by ID", category: "Knowledge", readOnly: true },
  { name: "search_knowledge", description: "Search across all 17 modules", category: "Knowledge", readOnly: true },
  { name: "lookup_term", description: "Look up an AI/ML term in the glossary", category: "Knowledge", readOnly: true },
  { name: "get_froot_overview", description: "Get complete FROOT framework overview", category: "Knowledge", readOnly: true },
  { name: "list_community_plays", description: "List all 101 solution plays", category: "Plays", readOnly: true },
  { name: "get_play_detail", description: "Deep dive into a specific play", category: "Plays", readOnly: true },
  { name: "semantic_search_plays", description: "Natural language play search", category: "Plays", readOnly: true },
  { name: "compare_plays", description: "Side-by-side play comparison", category: "Plays", readOnly: true },
  { name: "estimate_cost", description: "Calculate Azure costs for a play", category: "Cost", readOnly: true },
  { name: "get_azure_pricing", description: "Estimate monthly Azure AI costs", category: "Cost", readOnly: true },
  { name: "generate_architecture_diagram", description: "Generate Mermaid.js diagram", category: "Architecture", readOnly: true },
  { name: "get_architecture_pattern", description: "Get guidance for a scenario", category: "Architecture", readOnly: true },
  { name: "compare_models", description: "Side-by-side AI model comparison", category: "Models", readOnly: true },
  { name: "get_model_catalog", description: "List Azure OpenAI models", category: "Models", readOnly: true },
  { name: "agent_build", description: "Builder agent — create solutions", category: "Agents", readOnly: false },
  { name: "agent_review", description: "Reviewer agent — security + quality", category: "Agents", readOnly: false },
  { name: "agent_tune", description: "Tuner agent — production readiness", category: "Agents", readOnly: false },
  { name: "run_evaluation", description: "Check AI quality scores", category: "Evaluation", readOnly: false },
  { name: "validate_config", description: "Validate TuneKit config files", category: "Evaluation", readOnly: true },
  { name: "list_primitives", description: "Browse 860+ FrootAI primitives", category: "Primitives", readOnly: true },
  { name: "embedding_playground", description: "Compare texts for similarity", category: "Tools", readOnly: true },
  { name: "fetch_azure_docs", description: "Fetch latest Azure documentation", category: "Docs", readOnly: true },
  { name: "fetch_external_mcp", description: "Search external MCP servers", category: "Tools", readOnly: true },
  { name: "get_github_agentic_os", description: "GitHub Copilot agentic OS guide", category: "Docs", readOnly: true },
  { name: "list_avm_metadata", description: "List Azure Verified Modules metadata", category: "Architecture", readOnly: true },
  { name: "get_az_resource_type_schema", description: "Get Azure resource type schema", category: "Architecture", readOnly: true },
  { name: "list_az_resource_types_for_provider", description: "List resource types for provider", category: "Architecture", readOnly: true },
  { name: "get_bicep_best_practices", description: "Bicep best practices guide", category: "Architecture", readOnly: true },
  { name: "get_bicep_file_diagnostics", description: "Analyze Bicep file diagnostics", category: "Architecture", readOnly: true },
  { name: "format_bicep_file", description: "Format a Bicep file", category: "Architecture", readOnly: false },
  { name: "decompile_arm_template", description: "Convert ARM to Bicep", category: "Architecture", readOnly: false },
  { name: "decompile_arm_parameters", description: "Convert ARM params to Bicep", category: "Architecture", readOnly: false },
  { name: "get_deployment_snapshot", description: "Preview deployment resources", category: "Architecture", readOnly: true },
  { name: "get_file_references", description: "List Bicep file references", category: "Architecture", readOnly: true },
  { name: "search_code", description: "Search code across GitHub repos", category: "GitHub", readOnly: true },
  { name: "search_issues", description: "Search GitHub issues", category: "GitHub", readOnly: true },
  { name: "search_pull_requests", description: "Search GitHub pull requests", category: "GitHub", readOnly: true },
  { name: "get_file_contents", description: "Get file contents from GitHub", category: "GitHub", readOnly: true },
  { name: "list_commits", description: "List commits in a repository", category: "GitHub", readOnly: true },
  { name: "get_commit", description: "Get details for a commit", category: "GitHub", readOnly: true },
  { name: "list_issues", description: "List issues in a repository", category: "GitHub", readOnly: true },
  { name: "list_pull_requests", description: "List pull requests in a repo", category: "GitHub", readOnly: true },
  { name: "run_secret_scanning", description: "Scan files for secrets", category: "Security", readOnly: true },
  { name: "get_copilot_job_status", description: "Check Copilot agent job status", category: "GitHub", readOnly: true },
];

export class McpToolExplorerPanel {
  public static currentPanel: McpToolExplorerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(): void {
    const column =
      vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (McpToolExplorerPanel.currentPanel) {
      McpToolExplorerPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "frootai.mcpToolExplorer",
      "FAI MCP Tool Explorer",
      column,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    McpToolExplorerPanel.currentPanel = new McpToolExplorerPanel(panel);
  }

  private constructor(panel: vscode.WebviewPanel) {
    this._panel = panel;
    this._panel.webview.html = this._getHtml();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      (msg) => {
        if (msg.command === "copyConfig") {
          const snippet = JSON.stringify(
            { name: msg.toolName, type: "mcp", server: "frootai-mcp" },
            null,
            2
          );
          vscode.env.clipboard.writeText(snippet).then(() => {
            vscode.window.showInformationMessage(
              `Copied config for ${msg.toolName}`
            );
          });
        }
      },
      null,
      this._disposables
    );
  }

  public dispose(): void {
    McpToolExplorerPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
  }

  private _getHtml(): string {
    const categories = [...new Set(MCP_TOOLS.map((t) => t.category))];
    const catColors: Record<string, string> = {
      Knowledge: "#3b82f6", Plays: "#7c3aed", Cost: "#10b981",
      Architecture: "#f59e0b", Models: "#ec4899", Agents: "#ef4444",
      Evaluation: "#8b5cf6", Primitives: "#06b6d4", Tools: "#6b7280",
      Docs: "#0ea5e9", GitHub: "#f97316", Security: "#dc2626",
    };

    const toolsJson = JSON.stringify(MCP_TOOLS).replace(/</g, "\\u003c");
    const catJson = JSON.stringify(catColors).replace(/</g, "\\u003c");

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:20px;margin:0;line-height:1.6}
  h1{font-size:22px;margin-bottom:4px}.subtitle{opacity:0.7;margin-bottom:16px;font-size:13px}
  .search{width:100%;padding:8px 12px;border:1px solid var(--vscode-input-border);background:var(--vscode-input-background);color:var(--vscode-input-foreground);border-radius:6px;font-size:13px;margin-bottom:8px;box-sizing:border-box}
  .filters{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}
  .filter-btn{padding:4px 10px;border:1px solid var(--vscode-widget-border);background:transparent;color:var(--vscode-foreground);border-radius:12px;font-size:11px;cursor:pointer}
  .filter-btn.active{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-color:var(--vscode-button-background)}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
  .tool-card{background:var(--vscode-editor-inactiveSelectionBackground);border:1px solid var(--vscode-widget-border);border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:6px}
  .tool-card.hidden{display:none}
  .tool-name{font-weight:700;font-size:13px;font-family:var(--vscode-editor-font-family)}
  .tool-desc{font-size:12px;opacity:0.8;flex:1}
  .tool-meta{display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap}
  .cat-badge{padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;color:#fff}
  .ro-badge{font-size:10px;opacity:0.6}
  .copy-btn{padding:4px 10px;border:1px solid var(--vscode-widget-border);background:transparent;color:var(--vscode-foreground);border-radius:4px;font-size:11px;cursor:pointer}
  .copy-btn:hover{background:var(--vscode-button-secondaryBackground)}
  .count{font-size:12px;opacity:0.6;margin-bottom:12px}
</style></head><body>
  <h1>🔌 FAI MCP Tool Explorer</h1>
  <p class="subtitle">${MCP_TOOLS.length} tools available via <code>npx frootai-mcp@latest</code></p>
  <input class="search" id="search" placeholder="Search tools..." oninput="filter()">
  <div class="filters" id="filters">
    <button class="filter-btn active" onclick="setCat('')">All</button>
    ${categories.map((c) => `<button class="filter-btn" onclick="setCat('${c}')">${c}</button>`).join("")}
  </div>
  <div class="count" id="count">${MCP_TOOLS.length} tools</div>
  <div class="grid" id="grid"></div>
  <script>
    const vscode=acquireVsCodeApi();
    const tools=${toolsJson};
    const colors=${catJson};
    let activeCat='';

    function render(list){
      document.getElementById('grid').innerHTML=list.map(t=>{
        const bg=colors[t.category]||'#6b7280';
        return '<div class="tool-card"><div class="tool-name">'+t.name+'</div>'
          +'<div class="tool-desc">'+t.description+'</div>'
          +'<div class="tool-meta"><span class="cat-badge" style="background:'+bg+'">'+t.category+'</span>'
          +(t.readOnly?'<span class="ro-badge">read-only</span>':'<span class="ro-badge">read-write</span>')
          +'<button class="copy-btn" onclick="copy(\\''+t.name+'\\')">📋 Copy</button></div></div>';
      }).join('');
      document.getElementById('count').textContent=list.length+' tools';
    }

    function filter(){
      const q=document.getElementById('search').value.toLowerCase();
      render(tools.filter(t=>(activeCat===''||t.category===activeCat)&&(t.name.toLowerCase().includes(q)||t.description.toLowerCase().includes(q)||t.category.toLowerCase().includes(q))));
    }

    function setCat(c){
      activeCat=c;
      document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
      event.target.classList.add('active');
      filter();
    }

    function copy(name){vscode.postMessage({command:'copyConfig',toolName:name});}

    render(tools);
  </script>
</body></html>`;
  }
}
