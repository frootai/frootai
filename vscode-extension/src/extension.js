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
  // Extract mermaid blocks before processing
  const mermaidBlocks = [];
  let processed = markdown.replace(/```mermaid\n([\s\S]*?)```/g, (match, code) => {
    mermaidBlocks.push(code.trim());
    return `%%MERMAID_${mermaidBlocks.length - 1}%%`;
  });

  // Basic markdown → HTML conversion
  let html = processed
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
      if (match.match(/^\|[\s-:|]+\|$/)) return ''; // skip separator row
      const cells = match.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`);
      return `<tr>${cells.join('')}</tr>`;
    })
    // Paragraphs (wrap remaining lines)
    .replace(/^(?!<[hblutpra]|<\/|<hr|<li|<tr|%%MERMAID)(.+)$/gm, '<p>$1</p>')
    // Clean up consecutive blockquotes
    .replace(/<\/blockquote>\n<blockquote>/g, '<br>');

  // Wrap lists
  html = html.replace(/(<li>.+<\/li>\n?)+/g, '<ul>$&</ul>');
  // Wrap tables
  html = html.replace(/(<tr>.+<\/tr>\n?)+/g, '<table>$&</table>');

  // Re-insert mermaid blocks as rendered divs
  mermaidBlocks.forEach((code, i) => {
    html = html.replace(`%%MERMAID_${i}%%`, `<div class="mermaid">${code}</div>`);
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <script>mermaid.initialize({ startOnLoad: true, theme: 'dark', themeVariables: { primaryColor: '#1a1a2e', primaryTextColor: '#e0e0e0', primaryBorderColor: '#6366f1', lineColor: '#818cf8', background: 'transparent' } });</script>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 16px 28px; line-height: 1.65; color: #d0d0d0;
      background: #1a1a2e; max-width: 860px; margin: 0 auto;
      font-size: 13px;
    }
    h1 { color: #10b981; font-size: 1.3rem; border-bottom: 2px solid #10b98133; padding-bottom: 6px; margin-top: 0; }
    h2 { color: #06b6d4; font-size: 1.05rem; margin-top: 1.5rem; }
    h3 { color: #6366f1; font-size: 0.92rem; }
    h4 { color: #f59e0b; font-size: 0.85rem; }
    p { font-size: 0.88rem; margin: 6px 0; }
    a { color: #10b981; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { background: #2a2a3e; padding: 1px 5px; border-radius: 3px; font-size: 0.82rem; color: #a5b4fc; }
    pre { background: #0d0d14; border: 1px solid #25253a; border-radius: 6px; padding: 10px; overflow-x: auto; font-size: 0.82rem; }
    pre code { background: none; padding: 0; color: #d0d0d0; }
    blockquote { border-left: 3px solid #6366f1; padding: 6px 14px; margin: 10px 0; background: #6366f108; color: #a0a0b0; font-size: 0.85rem; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 0.82rem; }
    td, th { padding: 6px 10px; border: 1px solid #25253a; text-align: left; }
    tr:first-child td { font-weight: 600; background: #1a1a3e; }
    ul, ol { padding-left: 20px; }
    li { margin: 3px 0; font-size: 0.86rem; }
    hr { border: none; border-top: 1px solid #25253a; margin: 20px 0; }
    .mermaid { margin: 16px 0; background: transparent; }
    .mermaid svg { max-width: 100%; }
  </style>
</head>
<body>
  ${html}
  <hr>
  <p style="font-size:0.72rem;color:#555;">
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
        item.tooltip = `${p.name}\nStatus: ${p.status}\n\nRight-click for:\n• Init DevKit (.github Agentic OS)\n• Init TuneKit (config + infra + eval)\n• Init Hooks (guardrails)\n• Init Prompts (slash commands)\n\nClick to read details.`;
        item.contextValue = "solutionPlay";
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
      item.tooltip = `MCP Tool: ${t.name}\n${t.desc}\n\nLeft-click: action menu\nRight-click: Install / Start / Configure`;
      item.contextValue = "mcpTool";
      item.command = { command: "frootai.mcpToolAction", title: "MCP Action", arguments: [t] };
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

  // ── Command: Open Solution Play (action picker) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.openSolutionPlay", async (play) => {
      // Show action picker
      const action = await vscode.window.showQuickPick([
        { label: "$(book) Read Documentation", description: "View solution play README in rich panel", value: "read" },
        { label: "$(tools) Init DevKit", description: ".github Agentic OS (19 files) + agent.md + MCP", value: "devkit" },
        { label: "$(settings-gear) Init TuneKit", description: "config/*.json + infra/main.bicep + evaluation/", value: "tunekit" },
        { label: "$(shield) Init Hooks", description: "guardrails.json (preToolUse policy gates)", value: "hooks" },
        { label: "$(terminal) Init Prompts", description: "4 slash commands (/deploy, /test, /review, /evaluate)", value: "prompts" },
        { label: "$(github) Open on GitHub", description: `github.com/.../solution-plays/${play.dir}`, value: "github" },
      ], { placeHolder: `${play.icon} ${play.name} — What would you like to do?` });

      if (!action) return;

      if (action.value === "read") {
        // Read documentation
        if (root) {
          const readmePath = path.join(root, "solution-plays", play.dir, "README.md");
          if (fs.existsSync(readmePath)) {
            createModuleWebview(context, play.dir, `${play.icon} ${play.name}`, fs.readFileSync(readmePath, "utf-8"));
            return;
          }
        }
        try {
          await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Loading ${play.name}...` }, async () => {
            const content = await downloadFromGitHub(`solution-plays/${play.dir}/README.md`);
            createModuleWebview(context, play.dir, `${play.icon} ${play.name}`, content);
          });
        } catch {
          vscode.env.openExternal(vscode.Uri.parse(`https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/${play.dir}`));
        }
      } else if (action.value === "devkit") {
        vscode.commands.executeCommand("frootai.initDevKit", play);
      } else if (action.value === "tunekit") {
        vscode.commands.executeCommand("frootai.initTuneKit", play);
      } else if (action.value === "hooks") {
        vscode.commands.executeCommand("frootai.initHooks", play);
      } else if (action.value === "prompts") {
        vscode.commands.executeCommand("frootai.initPrompts", play);
      } else if (action.value === "github") {
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
    vscode.commands.registerCommand("frootai.initDevKit", async (preSelectedPlay) => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsFolder) {
        vscode.window.showWarningMessage("Open a folder first, then run Init DevKit.");
        return;
      }

      let selectedPlay = preSelectedPlay;
      if (!selectedPlay) {
        const plays = SOLUTION_PLAYS.map(p => ({ label: `${p.icon} ${p.id} — ${p.name}`, description: p.status, value: p }));
        const pick = await vscode.window.showQuickPick(plays, { placeHolder: "Which solution play's DevKit?" });
        if (!pick) return;
        selectedPlay = pick.value;
      }

      const playDir = selectedPlay.dir;

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
          vscode.window.showInformationMessage(`✅ DevKit initialized for ${selectedPlay.name}! ${copied} files from local repo.`);
          return;
        }
      }

      // STANDALONE: Download from GitHub
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Downloading DevKit for ${selectedPlay.name}...`, cancellable: false },
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
            `✅ DevKit downloaded for ${selectedPlay.name}! ${downloaded} files from GitHub.` +
            (failed > 0 ? ` (${failed} files not available)` : "")
          );
        }
      );
    })
  );

  // ── Command: Init Hooks (standalone: downloads from GitHub) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.initHooks", async (preSelectedPlay) => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsFolder) { vscode.window.showWarningMessage("Open a folder first."); return; }

      let selectedPlay = preSelectedPlay;
      if (!selectedPlay) {
        const plays = SOLUTION_PLAYS.map(p => ({ label: `${p.icon} ${p.id} — ${p.name}`, description: p.status, value: p }));
        const pick = await vscode.window.showQuickPick(plays, { placeHolder: "Initialize hooks from which play?" });
        if (!pick) return;
        selectedPlay = pick.value;
      }

      const localPath = root ? path.join(root, "solution-plays", selectedPlay.dir, ".github", "hooks", "guardrails.json") : null;
      const dstDir = path.join(wsFolder, ".github", "hooks");
      if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });

      if (localPath && fs.existsSync(localPath)) {
        fs.copyFileSync(localPath, path.join(dstDir, "guardrails.json"));
      } else {
        try {
          const content = await downloadFromGitHub(`solution-plays/${selectedPlay.dir}/.github/hooks/guardrails.json`);
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
    vscode.commands.registerCommand("frootai.initPrompts", async (preSelectedPlay) => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsFolder) { vscode.window.showWarningMessage("Open a folder first."); return; }

      let selectedPlay = preSelectedPlay;
      if (!selectedPlay) {
        const plays = SOLUTION_PLAYS.map(p => ({ label: `${p.icon} ${p.id} — ${p.name}`, description: p.status, value: p }));
        const pick = await vscode.window.showQuickPick(plays, { placeHolder: "Initialize prompts from which play?" });
        if (!pick) return;
        selectedPlay = pick.value;
      }

      const promptFiles = ["deploy.prompt.md", "test.prompt.md", "review.prompt.md", "evaluate.prompt.md"];
      const dstDir = path.join(wsFolder, ".github", "prompts");
      if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });

      let copied = 0;
      for (const f of promptFiles) {
        const localPath = root ? path.join(root, "solution-plays", selectedPlay.dir, ".github", "prompts", f) : null;
        if (localPath && fs.existsSync(localPath)) {
          fs.copyFileSync(localPath, path.join(dstDir, f));
          copied++;
        } else {
          try {
            const content = await downloadFromGitHub(`solution-plays/${selectedPlay.dir}/.github/prompts/${f}`);
            fs.writeFileSync(path.join(dstDir, f), content, "utf-8");
            copied++;
          } catch { /* skip */ }
        }
      }
      vscode.window.showInformationMessage(`✅ ${copied} prompt files initialized! Slash commands ready.`);
    })
  );

  // ── Command: Init TuneKit (config + evaluation + infra) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.initTuneKit", async (preSelectedPlay) => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsFolder) { vscode.window.showWarningMessage("Open a folder first."); return; }

      let selectedPlay = preSelectedPlay;
      if (!selectedPlay) {
        const plays = SOLUTION_PLAYS.map(p => ({ label: `${p.icon} ${p.id} — ${p.name}`, description: p.status, value: p }));
        const pick = await vscode.window.showQuickPick(plays, { placeHolder: "Initialize TuneKit from which solution play?" });
        if (!pick) return;
        selectedPlay = pick.value;
      }

      const tuneKitFiles = [
        "config/openai.json",
        "config/guardrails.json",
        "config/search.json",
        "config/chunking.json",
        "infra/main.bicep",
        "infra/parameters.json",
        "evaluation/test-set.jsonl",
        "evaluation/eval.py",
      ];

      let copied = 0;
      for (const f of tuneKitFiles) {
        const localPath = root ? path.join(root, "solution-plays", selectedPlay.dir, f) : null;
        if (localPath && fs.existsSync(localPath)) {
          const dstPath = path.join(wsFolder, f);
          const dir = path.dirname(dstPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.copyFileSync(localPath, dstPath);
          copied++;
        } else {
          try {
            const content = await downloadFromGitHub(`solution-plays/${selectedPlay.dir}/${f}`);
            const dstPath = path.join(wsFolder, f);
            const dir = path.dirname(dstPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(dstPath, content, "utf-8");
            copied++;
          } catch { /* file may not exist for this play */ }
        }
      }
      vscode.window.showInformationMessage(
        `✅ TuneKit initialized for ${selectedPlay.name}! ${copied} files copied:\n` +
        `• config/*.json (AI parameters)\n• infra/ (Bicep IaC)\n• evaluation/ (test set + scoring)`
      );
    })
  );

  // ── Command: Install MCP Server ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.installMcpServer", async () => {
      const choice = await vscode.window.showQuickPick([
        { label: "$(package) Install globally", description: "npm install -g frootai-mcp", value: "global" },
        { label: "$(play) Run directly (npx)", description: "npx frootai-mcp — zero install", value: "npx" },
        { label: "$(gear) Add to .vscode/mcp.json", description: "Configure MCP for this workspace", value: "config" },
      ], { placeHolder: "How do you want to set up the FrootAI MCP Server?" });
      if (!choice) return;

      if (choice.value === "global") {
        const terminal = vscode.window.createTerminal("FrootAI MCP Install");
        terminal.sendText("npm install -g frootai-mcp");
        terminal.show();
        vscode.window.showInformationMessage("Installing frootai-mcp globally. After install, run: frootai-mcp");
      } else if (choice.value === "npx") {
        const terminal = vscode.window.createTerminal("FrootAI MCP Server");
        terminal.sendText("npx frootai-mcp");
        terminal.show();
      } else if (choice.value === "config") {
        const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!wsFolder) { vscode.window.showWarningMessage("Open a folder first."); return; }
        const mcpConfig = {
          servers: {
            frootai: {
              type: "stdio",
              command: "npx",
              args: ["frootai-mcp"]
            }
          }
        };
        const configDir = path.join(wsFolder, ".vscode");
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(path.join(configDir, "mcp.json"), JSON.stringify(mcpConfig, null, 2), "utf-8");
        vscode.window.showInformationMessage("✅ MCP config added to .vscode/mcp.json. Reload VS Code to activate.");
      }
    })
  );

  // ── Command: Start MCP Server ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.startMcpServer", () => {
      const terminal = vscode.window.createTerminal("FrootAI MCP Server");
      terminal.sendText("npx frootai-mcp");
      terminal.show();
      vscode.window.showInformationMessage("🔌 FrootAI MCP Server starting... 10 tools (6 static + 4 live).");
    })
  );

  // ── Command: Configure MCP (add .vscode/mcp.json) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.configureMcp", () => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsFolder) { vscode.window.showWarningMessage("Open a folder first."); return; }
      const mcpConfig = {
        servers: {
          frootai: {
            type: "stdio",
            command: "npx",
            args: ["frootai-mcp"]
          }
        }
      };
      const configDir = path.join(wsFolder, ".vscode");
      if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "mcp.json"), JSON.stringify(mcpConfig, null, 2), "utf-8");
      vscode.window.showInformationMessage("✅ .vscode/mcp.json created! FrootAI MCP auto-connects when you reload VS Code.");
    })
  );

  // ── Command: MCP Tool Action (left-click action picker) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.mcpToolAction", async (tool) => {
      const action = await vscode.window.showQuickPick([
        { label: "$(package) Install MCP Server globally", description: "npm install -g frootai-mcp", value: "install" },
        { label: "$(play) Start MCP Server (npx)", description: "Launch in terminal — 10 tools ready", value: "start" },
        { label: "$(gear) Configure MCP for this workspace", description: "Add .vscode/mcp.json — auto-connects", value: "config" },
        { label: "$(globe) Open npm page", description: "npmjs.com/package/frootai-mcp", value: "npm" },
        { label: "$(book) Open setup guide", description: "Full MCP setup documentation", value: "guide" },
      ], { placeHolder: `🔌 ${tool.name} — ${tool.desc}` });

      if (!action) return;

      if (action.value === "install") {
        vscode.commands.executeCommand("frootai.installMcpServer");
      } else if (action.value === "start") {
        vscode.commands.executeCommand("frootai.startMcpServer");
      } else if (action.value === "config") {
        vscode.commands.executeCommand("frootai.configureMcp");
      } else if (action.value === "npm") {
        vscode.env.openExternal(vscode.Uri.parse("https://www.npmjs.com/package/frootai-mcp"));
      } else if (action.value === "guide") {
        vscode.env.openExternal(vscode.Uri.parse("https://gitpavleenbali.github.io/frootai/setup-guide"));
      }
    })
  );

  // ── Status Bar ──
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = "$(tree-view-icon) FrootAI";
  statusBar.tooltip = `FrootAI — From the Roots to the Fruits\n${knowledgeLoaded ? `${Object.keys(KNOWLEDGE.modules).length} modules · ${Object.keys(GLOSSARY).length} terms · 10 MCP tools` : "Knowledge loading..."}`;
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
