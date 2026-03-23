const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const https = require("https");

// ════════════════════════════════════════════════════════════════════
// FrootAI VS Code Extension v3 — Standalone Engine
// From the Roots to the Fruits. The Open Glue for GenAI.
// Works from ANY workspace — no clone needed.
// ════════════════════════════════════════════════════════════════════

// ─── Bundled Knowledge Engine ──────────────────────────────────────

let KNOWLEDGE = null;
let GLOSSARY = {};

function loadBundledKnowledge() {
  try {
    const bundlePath = path.join(__dirname, "..", "knowledge.json");
    if (fs.existsSync(bundlePath)) {
      KNOWLEDGE = JSON.parse(fs.readFileSync(bundlePath, "utf-8"));
      // Build glossary from F3 module
      const f3 = KNOWLEDGE.modules?.F3;
      if (f3) {
        const lines = f3.content.split("\n");
        let currentTerm = null;
        let currentDef = [];
        for (const line of lines) {
          const match = line.match(/^### (.+)/);
          if (match) {
            if (currentTerm) {
              GLOSSARY[currentTerm.toLowerCase()] = { term: currentTerm, definition: currentDef.join("\n").trim() };
            }
            currentTerm = match[1].replace(/\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]+\s*$/u, "").trim();
            currentDef = [];
          } else if (currentTerm) {
            currentDef.push(line);
          }
        }
        if (currentTerm) {
          GLOSSARY[currentTerm.toLowerCase()] = { term: currentTerm, definition: currentDef.join("\n").trim() };
        }
      }
      console.log(`FrootAI: Loaded ${Object.keys(KNOWLEDGE.modules).length} modules, ${Object.keys(GLOSSARY).length} glossary terms`);
      return true;
    }
  } catch (e) {
    console.error("FrootAI: Failed to load knowledge bundle", e);
  }
  return false;
}

// ─── Data ──────────────────────────────────────────────────────────

const SOLUTION_PLAYS = [
  { id: "01", name: "Enterprise RAG Q&A", icon: "🔍", status: "Ready", dir: "01-enterprise-rag" },
  { id: "02", name: "AI Landing Zone", icon: "⛰️", status: "Ready", dir: "02-ai-landing-zone" },
  { id: "03", name: "Deterministic Agent", icon: "🎯", status: "Ready", dir: "03-deterministic-agent" },
  { id: "04", name: "Call Center Voice AI", icon: "📞", status: "Skeleton", dir: "04-call-center-voice-ai" },
  { id: "05", name: "IT Ticket Resolution", icon: "🎫", status: "Skeleton", dir: "05-it-ticket-resolution" },
  { id: "06", name: "Document Intelligence", icon: "📄", status: "Skeleton", dir: "06-document-intelligence" },
  { id: "07", name: "Multi-Agent Service", icon: "🤖", status: "Skeleton", dir: "07-multi-agent-service" },
  { id: "08", name: "Copilot Studio Bot", icon: "💬", status: "Skeleton", dir: "08-copilot-studio-bot" },
  { id: "09", name: "AI Search Portal", icon: "🔎", status: "Skeleton", dir: "09-ai-search-portal" },
  { id: "10", name: "Content Moderation", icon: "🛡️", status: "Skeleton", dir: "10-content-moderation" },
  { id: "11", name: "Landing Zone Advanced", icon: "🏔️", status: "Skeleton", dir: "11-ai-landing-zone-advanced" },
  { id: "12", name: "Model Serving AKS", icon: "⚙️", status: "Skeleton", dir: "12-model-serving-aks" },
  { id: "13", name: "Fine-Tuning Workflow", icon: "🔬", status: "Skeleton", dir: "13-fine-tuning-workflow" },
  { id: "14", name: "AI Gateway", icon: "🚪", status: "Skeleton", dir: "14-cost-optimized-ai-gateway" },
  { id: "15", name: "Multi-Modal DocProc", icon: "🖼️", status: "Skeleton", dir: "15-multi-modal-docproc" },
  { id: "16", name: "Copilot Teams Ext", icon: "👥", status: "Skeleton", dir: "16-copilot-teams-extension" },
  { id: "17", name: "AI Observability", icon: "📊", status: "Skeleton", dir: "17-ai-observability" },
  { id: "18", name: "Prompt Management", icon: "📝", status: "Skeleton", dir: "18-prompt-management" },
  { id: "19", name: "Edge AI Phi-4", icon: "📱", status: "Skeleton", dir: "19-edge-ai-phi4" },
  { id: "20", name: "Anomaly Detection", icon: "🚨", status: "Skeleton", dir: "20-anomaly-detection" },
];

const FROOT_MODULES = [
  { layer: "🌱 Foundations", color: "#f59e0b", modules: [
    { id: "F1", name: "GenAI Foundations", file: "GenAI-Foundations.md" },
    { id: "F2", name: "LLM Landscape", file: "LLM-Landscape.md" },
    { id: "F3", name: "AI Glossary A–Z", file: "F3-AI-Glossary-AZ.md" },
    { id: "F4", name: ".github Agentic OS", file: "F4-GitHub-Agentic-OS.md" },
  ]},
  { layer: "🪵 Reasoning", color: "#10b981", modules: [
    { id: "R1", name: "Prompt Engineering", file: "Prompt-Engineering.md" },
    { id: "R2", name: "RAG Architecture", file: "RAG-Architecture.md" },
    { id: "R3", name: "Deterministic AI", file: "R3-Deterministic-AI.md" },
  ]},
  { layer: "🌿 Orchestration", color: "#06b6d4", modules: [
    { id: "O1", name: "Semantic Kernel", file: "Semantic-Kernel.md" },
    { id: "O2", name: "AI Agents", file: "AI-Agents-Deep-Dive.md" },
    { id: "O3", name: "MCP & Tools", file: "O3-MCP-Tools-Functions.md" },
  ]},
  { layer: "🍃 Operations", color: "#6366f1", modules: [
    { id: "O4", name: "Azure AI Platform", file: "Azure-AI-Foundry.md" },
    { id: "O5", name: "AI Infrastructure", file: "AI-Infrastructure.md" },
    { id: "O6", name: "Copilot Ecosystem", file: "Copilot-Ecosystem.md" },
  ]},
  { layer: "🍎 Transformation", color: "#7c3aed", modules: [
    { id: "T1", name: "Fine-Tuning", file: "T1-Fine-Tuning-MLOps.md" },
    { id: "T2", name: "Responsible AI", file: "Responsible-AI-Safety.md" },
    { id: "T3", name: "Production Patterns", file: "T3-Production-Patterns.md" },
  ]},
];

const MCP_TOOLS = [
  { name: "list_modules", desc: "Browse 18 modules by FROOT layer" },
  { name: "get_module", desc: "Read any module (F1–T3, F4)" },
  { name: "lookup_term", desc: "200+ AI/ML term definitions" },
  { name: "search_knowledge", desc: "Full-text search all modules" },
  { name: "get_architecture_pattern", desc: "7 decision guides" },
  { name: "get_froot_overview", desc: "Complete FROOT summary" },
  { name: "fetch_azure_docs", desc: "⛅ Live — Search Azure docs" },
  { name: "fetch_external_mcp", desc: "⛅ Live — Find MCP servers" },
  { name: "list_community_plays", desc: "⛅ Live — List plays from GitHub" },
  { name: "get_github_agentic_os", desc: "⛅ Live — .github OS guide" },
];

// ─── Webview Panel: Render Modules as Rich HTML ────────────────────

function createModuleWebview(context, moduleId, title, content) {
  const panel = vscode.window.createWebviewPanel(
    "frootai.module",
    `FrootAI: ${title}`,
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  // Convert markdown to simple HTML (basic renderer)
  const htmlContent = markdownToHtml(content, title);
  panel.webview.html = htmlContent;
  return panel;
}

function markdownToHtml(markdown, title) {
  // Basic markdown → HTML conversion for webview
  let html = markdown
    // Headers
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold + Italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // List items
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    // Tables (basic)
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`);
      return `<tr>${cells.join('')}</tr>`;
    })
    // Paragraphs (wrap remaining lines)
    .replace(/^(?!<[hblutpra]|<\/|<hr|<li|<tr)(.+)$/gm, '<p>$1</p>')
    // Clean up consecutive blockquotes
    .replace(/<\/blockquote>\n<blockquote>/g, '<br>');

  // Wrap lists
  html = html.replace(/(<li>.+<\/li>\n?)+/g, '<ul>$&</ul>');
  // Wrap tables
  html = html.replace(/(<tr>.+<\/tr>\n?)+/g, '<table>$&</table>');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 20px 32px; line-height: 1.7; color: #e0e0e0;
      background: #1a1a2e; max-width: 900px; margin: 0 auto;
    }
    h1 { color: #10b981; font-size: 1.8rem; border-bottom: 2px solid #10b98133; padding-bottom: 8px; }
    h2 { color: #06b6d4; font-size: 1.4rem; margin-top: 2rem; }
    h3 { color: #6366f1; font-size: 1.1rem; }
    h4 { color: #f59e0b; font-size: 1rem; }
    a { color: #10b981; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { background: #2a2a3e; padding: 2px 6px; border-radius: 4px; font-size: 0.88rem; color: #a5b4fc; }
    pre { background: #0d0d14; border: 1px solid #25253a; border-radius: 8px; padding: 14px; overflow-x: auto; }
    pre code { background: none; padding: 0; color: #e0e0e0; }
    blockquote { border-left: 3px solid #6366f1; padding: 8px 16px; margin: 12px 0; background: #6366f108; color: #a0a0b0; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    td, th { padding: 8px 12px; border: 1px solid #25253a; text-align: left; font-size: 0.88rem; }
    tr:first-child td { font-weight: 600; background: #1a1a3e; }
    li { margin: 4px 0; }
    hr { border: none; border-top: 1px solid #25253a; margin: 24px 0; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 600; }
    .badge-green { background: #10b98120; color: #10b981; }
    .badge-purple { background: #7c3aed20; color: #7c3aed; }
  </style>
</head>
<body>
  ${html}
  <hr>
  <p style="font-size:0.78rem;color:#666;">
    <strong>FrootAI</strong> — From the Roots to the Fruits · 
    <a href="https://gitpavleenbali.github.io/frootai/">Website</a> · 
    <a href="https://github.com/gitpavleenbali/frootai">GitHub</a>
  </p>
</body>
</html>`;
}

// ─── GitHub Download Helper ────────────────────────────────────────

function downloadFromGitHub(repoPath) {
  return new Promise((resolve, reject) => {
    const url = `https://raw.githubusercontent.com/gitpavleenbali/frootai/main/${repoPath}`;
    https.get(url, { headers: { "User-Agent": "FrootAI-VSCode" } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        https.get(res.headers.location, (res2) => {
          let data = "";
          res2.on("data", (chunk) => data += chunk);
          res2.on("end", () => resolve(data));
        }).on("error", reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

// ─── Tree Data Providers ───────────────────────────────────────────

class SolutionPlayProvider {
  constructor() { this._onDidChange = new vscode.EventEmitter(); this.onDidChangeTreeData = this._onDidChange.event; }
  getTreeItem(element) { return element; }
  getChildren(element) {
    if (!element) {
      return SOLUTION_PLAYS.map((p) => {
        const item = new vscode.TreeItem(`${p.icon} ${p.id} — ${p.name}`, vscode.TreeItemCollapsibleState.None);
        item.description = p.status;
        item.tooltip = `${p.name}\nStatus: ${p.status}\nClick to view details`;
        item.command = { command: "frootai.openSolutionPlay", title: "Open", arguments: [p] };
        return item;
      });
    }
    return [];
  }
}

class FrootModuleProvider {
  getTreeItem(element) { return element; }
  getChildren(element) {
    if (!element) {
      return FROOT_MODULES.map((layer) => {
        const item = new vscode.TreeItem(layer.layer, vscode.TreeItemCollapsibleState.Expanded);
        item.contextValue = "layer";
        item.description = `${layer.modules.length} modules`;
        return item;
      });
    }
    const layerData = FROOT_MODULES.find((l) => l.layer === element.label);
    if (layerData) {
      return layerData.modules.map((m) => {
        const item = new vscode.TreeItem(`${m.id}: ${m.name}`, vscode.TreeItemCollapsibleState.None);
        item.tooltip = `Click to read ${m.name} in a rich panel`;
        item.command = { command: "frootai.openModule", title: "Open", arguments: [m] };
        return item;
      });
    }
    return [];
  }
}

class McpToolProvider {
  getTreeItem(element) { return element; }
  getChildren() {
    return MCP_TOOLS.map((t) => {
      const item = new vscode.TreeItem(`🔌 ${t.name}`, vscode.TreeItemCollapsibleState.None);
      item.description = t.desc;
      item.tooltip = `MCP Tool: ${t.name}\n${t.desc}\n\nInstall: npx frootai-mcp`;
      return item;
    });
  }
}

class GlossaryProvider {
  getTreeItem(element) { return element; }
  getChildren() {
    const terms = Object.entries(GLOSSARY).slice(0, 50).map(([key, val]) => {
      const item = new vscode.TreeItem(val.term, vscode.TreeItemCollapsibleState.None);
      item.description = val.definition.substring(0, 60) + "...";
      item.tooltip = `${val.term}\n\n${val.definition.substring(0, 200)}`;
      item.command = { command: "frootai.lookupTerm", title: "Lookup", arguments: [val.term] };
      return item;
    });
    if (Object.keys(GLOSSARY).length > 50) {
      const more = new vscode.TreeItem(`... ${Object.keys(GLOSSARY).length - 50} more terms`, vscode.TreeItemCollapsibleState.None);
      more.description = "Use Ctrl+Shift+P → Look Up AI Term";
      terms.push(more);
    }
    return terms;
  }
}

// ─── Activate ──────────────────────────────────────────────────────

function activate(context) {
  console.log("FrootAI v3 Standalone Engine activated");

  // Load bundled knowledge — works without any repo clone
  const knowledgeLoaded = loadBundledKnowledge();
  if (knowledgeLoaded) {
    console.log(`FrootAI: Knowledge engine ready (${Object.keys(KNOWLEDGE.modules).length} modules, ${Object.keys(GLOSSARY).length} terms)`);
  }

  // Optional: find local repo if available (enhances but not required)
  const root = findFrootAIRoot();

  // Register tree views
  vscode.window.registerTreeDataProvider("frootai.solutionPlays", new SolutionPlayProvider());
  vscode.window.registerTreeDataProvider("frootai.frootModules", new FrootModuleProvider());
  vscode.window.registerTreeDataProvider("frootai.mcpTools", new McpToolProvider());
  if (knowledgeLoaded) {
    vscode.window.registerTreeDataProvider("frootai.glossary", new GlossaryProvider());
  }

  // ── Command: Open Solution Play (standalone: opens webview or website) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.openSolutionPlay", async (play) => {
      // Try local first
      if (root) {
        const readmePath = path.join(root, "solution-plays", play.dir, "README.md");
        if (fs.existsSync(readmePath)) {
          const content = fs.readFileSync(readmePath, "utf-8");
          createModuleWebview(context, play.dir, `${play.icon} ${play.name}`, content);
          return;
        }
      }
      // Standalone: try downloading from GitHub
      try {
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Loading ${play.name}...` }, async () => {
          const content = await downloadFromGitHub(`solution-plays/${play.dir}/README.md`);
          createModuleWebview(context, play.dir, `${play.icon} ${play.name}`, content);
        });
      } catch {
        // Final fallback: open on website
        vscode.env.openExternal(vscode.Uri.parse(`https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/${play.dir}`));
      }
    })
  );

  // ── Command: Open Module (standalone: renders from bundled knowledge) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.openModule", async (mod) => {
      // Try bundled knowledge first (STANDALONE — no repo needed)
      if (KNOWLEDGE?.modules) {
        const moduleData = Object.values(KNOWLEDGE.modules).find(m => m.file === mod.file || m.id === mod.id);
        if (moduleData) {
          createModuleWebview(context, mod.id, `${mod.id}: ${mod.name}`, moduleData.content);
          return;
        }
      }
      // Try local file
      if (root) {
        const filePath = path.join(root, "docs", mod.file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf-8");
          createModuleWebview(context, mod.id, `${mod.id}: ${mod.name}`, content);
          return;
        }
      }
      // Fallback: website
      vscode.env.openExternal(vscode.Uri.parse(`https://gitpavleenbali.github.io/frootai/docs/${mod.file.replace('.md', '')}`));
    })
  );

  // ── Command: Browse Solution Plays (website) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.browseSolutionPlays", () => {
      vscode.env.openExternal(vscode.Uri.parse("https://gitpavleenbali.github.io/frootai/solution-plays"));
    })
  );

  // ── Command: Lookup Term (standalone: inline from bundled glossary) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.lookupTerm", async (prefilledTerm) => {
      const term = prefilledTerm || await vscode.window.showInputBox({
        prompt: "Enter an AI/ML term to look up (200+ terms available)",
        placeHolder: "e.g., temperature, RAG, LoRA, MCP, embeddings, hallucination"
      });
      if (!term) return;

      const key = term.toLowerCase().trim();

      // Search bundled glossary (STANDALONE)
      if (GLOSSARY[key]) {
        const g = GLOSSARY[key];
        createModuleWebview(context, `term-${key}`, `📖 ${g.term}`,
          `# ${g.term}\n\n${g.definition}\n\n---\n*Source: FrootAI Glossary A–Z (Module F3)*`
        );
        return;
      }

      // Fuzzy match
      const matches = Object.entries(GLOSSARY)
        .filter(([k, v]) => k.includes(key) || v.term.toLowerCase().includes(key))
        .slice(0, 10);

      if (matches.length > 0) {
        const pick = await vscode.window.showQuickPick(
          matches.map(([k, v]) => ({ label: v.term, description: v.definition.substring(0, 80) + "...", value: v })),
          { placeHolder: `Found ${matches.length} matching terms for "${term}"` }
        );
        if (pick) {
          createModuleWebview(context, `term-${key}`, `📖 ${pick.value.term}`,
            `# ${pick.value.term}\n\n${pick.value.definition}\n\n---\n*Source: FrootAI Glossary A–Z (Module F3)*`
          );
        }
        return;
      }

      vscode.window.showInformationMessage(`Term "${term}" not found. Try a different spelling or use Search Knowledge Base.`);
    })
  );

  // ── Command: Search Knowledge (standalone: searches bundled content) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.searchKnowledge", async () => {
      const query = await vscode.window.showInputBox({
        prompt: "Search across all 18 FrootAI modules",
        placeHolder: "e.g., how to reduce hallucination, RAG pipeline, agent hosting"
      });
      if (!query) return;

      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
      const results = [];

      // Search bundled knowledge (STANDALONE)
      if (KNOWLEDGE?.modules) {
        for (const [modId, mod] of Object.entries(KNOWLEDGE.modules)) {
          const lines = mod.content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineLower = line.toLowerCase();
            if (queryWords.some(w => lineLower.includes(w))) {
              results.push({
                moduleId: modId,
                moduleTitle: mod.title,
                line: i + 1,
                text: line.trim().substring(0, 120),
                file: mod.file,
              });
              if (results.length >= 20) break;
            }
          }
          if (results.length >= 20) break;
        }
      }

      if (results.length > 0) {
        const pick = await vscode.window.showQuickPick(
          results.map(r => ({
            label: `${r.moduleId}: ${r.text}`,
            description: r.moduleTitle,
            detail: `Line ${r.line}`,
            value: r,
          })),
          { placeHolder: `Found ${results.length} results for "${query}"` }
        );
        if (pick) {
          // Open the module in webview
          const mod = KNOWLEDGE.modules[pick.value.moduleId];
          if (mod) {
            createModuleWebview(context, pick.value.moduleId, `${pick.value.moduleId}: ${mod.title}`, mod.content);
          }
        }
      } else {
        vscode.window.showInformationMessage(`No results for "${query}". Try broader terms.`);
      }
    })
  );

  // ── Command: Open Setup Guide ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.openSetupGuide", () => {
      vscode.env.openExternal(vscode.Uri.parse("https://gitpavleenbali.github.io/frootai/setup-guide"));
    })
  );

  // ── Command: Show Architecture Pattern (standalone: from bundled knowledge) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.showArchitecturePattern", async () => {
      const patterns = [
        { label: "RAG Pipeline", description: "Design decisions for retrieval-augmented generation", value: "rag_pipeline" },
        { label: "Agent Hosting", description: "Container Apps vs AKS vs App Service vs Functions", value: "agent_hosting" },
        { label: "Model Selection", description: "GPT-4o vs Claude vs Llama vs Phi — when to use what", value: "model_selection" },
        { label: "Cost Optimization", description: "Token economics, caching, batching, model routing", value: "cost_optimization" },
        { label: "Deterministic AI", description: "5-layer defense against hallucination", value: "deterministic_ai" },
        { label: "Multi-Agent", description: "Supervisor vs pipeline vs swarm patterns", value: "multi_agent" },
        { label: "Fine-Tuning Decision", description: "When to fine-tune vs RAG vs prompting", value: "fine_tuning_decision" },
      ];
      const pick = await vscode.window.showQuickPick(patterns, { placeHolder: "Select an architecture pattern" });
      if (!pick) return;

      // Try to show from bundled T3 module
      if (KNOWLEDGE?.modules?.T3) {
        createModuleWebview(context, "T3-pattern", `🏗️ ${pick.label}`, KNOWLEDGE.modules.T3.content);
      } else {
        vscode.env.openExternal(vscode.Uri.parse("https://gitpavleenbali.github.io/frootai/docs/T3-Production-Patterns"));
      }
    })
  );

  // ── Command: Init DevKit (GitHub-powered: downloads on-demand) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.initDevKit", async () => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsFolder) {
        vscode.window.showWarningMessage("Open a folder first, then run Init DevKit.");
        return;
      }

      const plays = SOLUTION_PLAYS.map(p => ({ label: `${p.icon} ${p.id} — ${p.name}`, description: p.status, value: p }));
      const pick = await vscode.window.showQuickPick(plays, { placeHolder: "Which solution play's DevKit?" });
      if (!pick) return;

      const playDir = pick.value.dir;

      // Define all files to download
      const filesToDownload = [
        ".github/copilot-instructions.md",
        ".github/instructions/azure-coding.instructions.md",
        ".github/instructions/security.instructions.md",
        ".github/prompts/deploy.prompt.md",
        ".github/prompts/test.prompt.md",
        ".github/prompts/review.prompt.md",
        ".github/prompts/evaluate.prompt.md",
        ".github/agents/builder.agent.md",
        ".github/agents/reviewer.agent.md",
        ".github/agents/tuner.agent.md",
        ".github/skills/deploy-azure/SKILL.md",
        ".github/skills/evaluate/SKILL.md",
        ".github/skills/tune/SKILL.md",
        ".github/hooks/guardrails.json",
        ".github/workflows/ai-review.md",
        ".github/workflows/ai-deploy.md",
        "agent.md",
        "instructions.md",
        ".vscode/mcp.json",
        "plugin.json",
      ];

      // Try local repo first
      if (root) {
        const localPlayDir = path.join(root, "solution-plays", playDir);
        if (fs.existsSync(localPlayDir)) {
          let copied = 0;
          for (const f of filesToDownload) {
            const srcPath = path.join(localPlayDir, f);
            const dstPath = path.join(wsFolder, f);
            if (fs.existsSync(srcPath)) {
              const dir = path.dirname(dstPath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.copyFileSync(srcPath, dstPath);
              copied++;
            }
          }
          // Also copy play-specific instructions
          const instrDir = path.join(localPlayDir, ".github", "instructions");
          if (fs.existsSync(instrDir)) {
            for (const f of fs.readdirSync(instrDir)) {
              if (f.endsWith(".instructions.md") && !filesToDownload.some(c => c.endsWith(f))) {
                const dstPath = path.join(wsFolder, ".github", "instructions", f);
                const dir = path.dirname(dstPath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.copyFileSync(path.join(instrDir, f), dstPath);
                copied++;
              }
            }
          }
          vscode.window.showInformationMessage(`✅ DevKit initialized for ${pick.value.name}! ${copied} files from local repo.`);
          return;
        }
      }

      // STANDALONE: Download from GitHub
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Downloading DevKit for ${pick.value.name}...`, cancellable: false },
        async (progress) => {
          let downloaded = 0;
          let failed = 0;
          for (const f of filesToDownload) {
            progress.report({ message: `${downloaded}/${filesToDownload.length} files...`, increment: (100 / filesToDownload.length) });
            try {
              const content = await downloadFromGitHub(`solution-plays/${playDir}/${f}`);
              const dstPath = path.join(wsFolder, f);
              const dir = path.dirname(dstPath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(dstPath, content, "utf-8");
              downloaded++;
            } catch {
              failed++;
            }
          }
          vscode.window.showInformationMessage(
            `✅ DevKit downloaded for ${pick.value.name}! ${downloaded} files from GitHub.` +
            (failed > 0 ? ` (${failed} files not available)` : "")
          );
        }
      );
    })
  );

  // ── Command: Init Hooks (standalone: downloads from GitHub) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.initHooks", async () => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsFolder) { vscode.window.showWarningMessage("Open a folder first."); return; }

      const plays = SOLUTION_PLAYS.map(p => ({ label: `${p.icon} ${p.id} — ${p.name}`, description: p.status, value: p }));
      const pick = await vscode.window.showQuickPick(plays, { placeHolder: "Initialize hooks from which play?" });
      if (!pick) return;

      // Try local, then GitHub
      const localPath = root ? path.join(root, "solution-plays", pick.value.dir, ".github", "hooks", "guardrails.json") : null;
      const dstDir = path.join(wsFolder, ".github", "hooks");
      if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });

      if (localPath && fs.existsSync(localPath)) {
        fs.copyFileSync(localPath, path.join(dstDir, "guardrails.json"));
      } else {
        try {
          const content = await downloadFromGitHub(`solution-plays/${pick.value.dir}/.github/hooks/guardrails.json`);
          fs.writeFileSync(path.join(dstDir, "guardrails.json"), content, "utf-8");
        } catch {
          vscode.window.showWarningMessage("Could not download hooks. Check network connection.");
          return;
        }
      }
      vscode.window.showInformationMessage("✅ Hooks initialized! .github/hooks/guardrails.json ready.");
    })
  );

  // ── Command: Init Prompts (standalone: downloads from GitHub) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.initPrompts", async () => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsFolder) { vscode.window.showWarningMessage("Open a folder first."); return; }

      const plays = SOLUTION_PLAYS.map(p => ({ label: `${p.icon} ${p.id} — ${p.name}`, description: p.status, value: p }));
      const pick = await vscode.window.showQuickPick(plays, { placeHolder: "Initialize prompts from which play?" });
      if (!pick) return;

      const promptFiles = ["deploy.prompt.md", "test.prompt.md", "review.prompt.md", "evaluate.prompt.md"];
      const dstDir = path.join(wsFolder, ".github", "prompts");
      if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });

      let copied = 0;
      for (const f of promptFiles) {
        const localPath = root ? path.join(root, "solution-plays", pick.value.dir, ".github", "prompts", f) : null;
        if (localPath && fs.existsSync(localPath)) {
          fs.copyFileSync(localPath, path.join(dstDir, f));
          copied++;
        } else {
          try {
            const content = await downloadFromGitHub(`solution-plays/${pick.value.dir}/.github/prompts/${f}`);
            fs.writeFileSync(path.join(dstDir, f), content, "utf-8");
            copied++;
          } catch { /* skip */ }
        }
      }
      vscode.window.showInformationMessage(`✅ ${copied} prompt files initialized! Slash commands ready.`);
    })
  );

  // ── Status Bar ──
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = "$(tree-view-icon) FrootAI v3";
  statusBar.tooltip = `FrootAI — From the Roots to the Fruits\n${knowledgeLoaded ? `${Object.keys(KNOWLEDGE.modules).length} modules · ${Object.keys(GLOSSARY).length} terms` : "Knowledge loading..."}`;
  statusBar.command = "frootai.browseSolutionPlays";
  statusBar.show();
  context.subscriptions.push(statusBar);
}

// ─── Find FrootAI Root (optional enhancement, not required) ────────

function findFrootAIRoot() {
  const config = vscode.workspace.getConfiguration("frootai");
  const customPath = config.get("solutionPlaysPath");
  if (customPath) return customPath;
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) return null;
  for (const folder of folders) {
    if (fs.existsSync(path.join(folder.uri.fsPath, "solution-plays", "01-enterprise-rag"))) return folder.uri.fsPath;
    if (fs.existsSync(path.join(folder.uri.fsPath, "agent.md")) && fs.existsSync(path.join(folder.uri.fsPath, "config"))) return path.join(folder.uri.fsPath, "..", "..");
  }
  return null;
}

function deactivate() {}
module.exports = { activate, deactivate };
