const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const https = require("https");

// ════════════════════════════════════════════════════════════════════
// FrootAI VS Code Extension v1.0 — Standalone Engine
// From the Roots to the Fruits. The Open Glue for GenAI.
// 22 MCP tools · 18 modules · 200+ terms · 20 solution plays
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
  { id: "04", name: "Call Center Voice AI", icon: "📞", status: "Ready", dir: "04-call-center-voice-ai" },
  { id: "05", name: "IT Ticket Resolution", icon: "🎫", status: "Ready", dir: "05-it-ticket-resolution" },
  { id: "06", name: "Document Intelligence", icon: "📄", status: "Ready", dir: "06-document-intelligence" },
  { id: "07", name: "Multi-Agent Service", icon: "🤖", status: "Ready", dir: "07-multi-agent-service" },
  { id: "08", name: "Copilot Studio Bot", icon: "💬", status: "Ready", dir: "08-copilot-studio-bot" },
  { id: "09", name: "AI Search Portal", icon: "🔎", status: "Ready", dir: "09-ai-search-portal" },
  { id: "10", name: "Content Moderation", icon: "🛡️", status: "Ready", dir: "10-content-moderation" },
  { id: "11", name: "Landing Zone Advanced", icon: "🏔️", status: "Ready", dir: "11-ai-landing-zone-advanced" },
  { id: "12", name: "Model Serving AKS", icon: "⚙️", status: "Ready", dir: "12-model-serving-aks" },
  { id: "13", name: "Fine-Tuning Workflow", icon: "🔬", status: "Ready", dir: "13-fine-tuning-workflow" },
  { id: "14", name: "AI Gateway", icon: "🚪", status: "Ready", dir: "14-cost-optimized-ai-gateway" },
  { id: "15", name: "Multi-Modal DocProc", icon: "🖼️", status: "Ready", dir: "15-multi-modal-docproc" },
  { id: "16", name: "Copilot Teams Ext", icon: "👥", status: "Ready", dir: "16-copilot-teams-extension" },
  { id: "17", name: "AI Observability", icon: "📊", status: "Ready", dir: "17-ai-observability" },
  { id: "18", name: "Prompt Management", icon: "📝", status: "Ready", dir: "18-prompt-management" },
  { id: "19", name: "Edge AI Phi-4", icon: "📱", status: "Ready", dir: "19-edge-ai-phi4" },
  { id: "20", name: "Anomaly Detection", icon: "🚨", status: "Ready", dir: "20-anomaly-detection" },
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
  { name: "list_modules", desc: "Browse 18 modules by FROOT layer", type: "static",
    docs: "Returns all 18 FROOT knowledge modules organized by layer (Foundations, Reasoning, Orchestration, Operations, Transformation). Each module includes ID, name, and description. Use this to discover what knowledge is available.\n\n**Input:** none\n**Output:** Array of layers with modules\n**Example:** `list_modules` → [{layer: 'Foundations', modules: [{id: 'F1', name: 'GenAI Foundations'}, ...]}]" },
  { name: "get_module", desc: "Read any module (F1–T3, F4)", type: "static",
    docs: "Returns the full content of any FROOT knowledge module by ID. Supports F1-F4, R1-R3, O1-O3, O4-O6, T1-T3 (18 modules total).\n\n**Input:** `moduleId` (string) — e.g., 'F1', 'R2', 'T3'\n**Output:** Full markdown content of the module\n**Example:** `get_module({moduleId: 'F4'})` → Full GitHub Agentic OS guide" },
  { name: "lookup_term", desc: "200+ AI/ML term definitions", type: "static",
    docs: "Searches the AI Glossary (200+ terms) for a specific term or phrase. Returns the definition, related terms, and category. Fuzzy matching supported.\n\n**Input:** `term` (string) — e.g., 'RAG', 'temperature', 'embeddings'\n**Output:** Term definition with metadata\n**Example:** `lookup_term({term: 'RAG'})` → {term: 'RAG', definition: 'Retrieval-Augmented Generation...'}" },
  { name: "search_knowledge", desc: "Full-text search all modules", type: "static",
    docs: "Performs full-text search across all 18 knowledge modules. Returns matching excerpts with module IDs and context. Great for finding specific patterns, services, or concepts.\n\n**Input:** `query` (string) — search text\n**Output:** Array of matches with module, context, and relevance\n**Example:** `search_knowledge({query: 'vector database'})` → matches from RAG, AI Search modules" },
  { name: "get_architecture_pattern", desc: "7 decision guides", type: "static",
    docs: "Returns architecture decision guides for common AI patterns. Covers: RAG vs Fine-tuning, Agent frameworks, Model selection, Hosting options, Search strategies, Orchestration choices, Cost optimization.\n\n**Input:** `pattern` (string, optional) — specific pattern name\n**Output:** Decision matrix with pros/cons/when-to-use" },
  { name: "get_froot_overview", desc: "Complete FROOT summary", type: "static",
    docs: "Returns the complete FrootAI platform overview: mission, 6 layers, 20 solution plays list, DevKit/TuneKit model, and getting started guide.\n\n**Input:** none\n**Output:** Platform overview markdown" },
  { name: "fetch_azure_docs", desc: "⛅ Live — Search Azure docs", type: "live",
    docs: "Fetches documentation from Azure Learn. Queries the Azure documentation API for service-specific guidance. Falls back gracefully if offline.\n\n**Input:** `query` (string) — Azure service or topic\n**Output:** Documentation excerpts from learn.microsoft.com\n**Example:** `fetch_azure_docs({query: 'AI Search hybrid'})` → Azure AI Search hybrid query docs" },
  { name: "fetch_external_mcp", desc: "⛅ Live — Find MCP servers", type: "live",
    docs: "Queries external MCP server registries to find available MCP servers for specific tools or domains. Helps discover community MCP servers.\n\n**Input:** `query` (string) — tool or domain name\n**Output:** List of matching MCP servers with install instructions" },
  { name: "list_community_plays", desc: "⛅ Live — List plays from GitHub", type: "live",
    docs: "Fetches the list of solution plays from the FrootAI GitHub repository. Returns play names, statuses, and file counts. Useful for discovering what's available.\n\n**Input:** none\n**Output:** Array of 20 solution plays with metadata" },
  { name: "get_github_agentic_os", desc: "⛅ Live — .github OS guide", type: "live",
    docs: "Returns the complete .github Agentic OS implementation guide: 7 primitives, 4 layers, file structure, and how to implement per solution play.\n\n**Input:** none\n**Output:** Full .github Agentic OS guide" },
  { name: "agent_build", desc: "🔗 Chain — Builder agent guidance", type: "chain",
    docs: "Invokes the Builder agent persona. Returns structured guidance for building a solution: architecture decisions, service selection, code patterns, and implementation steps. Automatically suggests calling agent_review next.\n\n**Input:** `task` (string) — what to build\n**Output:** Builder guidance + suggestion to call agent_review\n**Example:** `agent_build({task: 'RAG pipeline with Azure AI Search'})` → architecture + code patterns + 'Now call agent_review'" },
  { name: "agent_review", desc: "🔗 Chain — Reviewer agent guidance", type: "chain",
    docs: "Invokes the Reviewer agent persona. Reviews architecture and code for: security, performance, cost, compliance, and best practices. Suggests calling agent_tune next.\n\n**Input:** `context` (string) — what to review\n**Output:** Review findings + suggestion to call agent_tune" },
  { name: "agent_tune", desc: "🔗 Chain — Tuner agent guidance", type: "chain",
    docs: "Invokes the Tuner agent persona. Provides AI parameter tuning guidance: temperature, top-k, chunk sizes, model selection, guardrails configuration. Terminal step in the agent chain.\n\n**Input:** `context` (string) — what to tune\n**Output:** Tuning recommendations for production" },
  // ── Ecosystem Tools (3) ──
  { name: "get_model_catalog", desc: "🌐 Ecosystem — Browse Azure AI model catalog", type: "ecosystem",
    docs: "Returns the Azure AI model catalog with GPT, Claude, Llama, Phi, Mistral models. Includes capabilities, pricing tiers, hosted/managed options, and recommended use cases.\n\n**Input:** `filter` (string, optional) — filter by provider or capability\n**Output:** Array of models with metadata\n**Example:** `get_model_catalog({filter: 'code'})` → models optimized for code generation" },
  { name: "get_azure_pricing", desc: "🌐 Ecosystem — Azure AI service pricing", type: "ecosystem",
    docs: "Returns current pricing for 25+ Azure AI services: OpenAI models, AI Search, Cognitive Services, App Service tiers. Includes per-unit costs, free tiers, and cost optimization tips.\n\n**Input:** `service` (string, optional) — specific service name\n**Output:** Pricing table with tiers and rates\n**Example:** `get_azure_pricing({service: 'openai'})` → GPT-4o pricing per 1K tokens" },
  { name: "compare_models", desc: "🌐 Ecosystem — Compare AI models side-by-side", type: "ecosystem",
    docs: "Compares two or more AI models across dimensions: cost, latency, context window, capabilities, and recommended scenarios. Helps pick the right model for a use case.\n\n**Input:** `models` (string[]) — model names to compare\n**Output:** Comparison matrix\n**Example:** `compare_models({models: ['gpt-4o', 'gpt-4o-mini']})` → side-by-side comparison" },
  // ── Compute Tools (6) ──
  { name: "semantic_search_plays", desc: "🧮 Compute — Semantic search across 20 plays", type: "compute",
    docs: "Performs keyword + semantic search across all 20 solution plays. Matches against play names, descriptions, services used, and architecture patterns. Returns ranked results with relevance scores.\n\n**Input:** `query` (string) — what to search for\n**Output:** Ranked matches with play ID, name, relevance, and excerpts\n**Example:** `semantic_search_plays({query: 'voice AI'})` → Play 04 (Call Center Voice AI) ranked first" },
  { name: "estimate_cost", desc: "🧮 Compute — Estimate monthly Azure cost", type: "compute",
    docs: "Calculates estimated monthly Azure costs for any solution play at different scales (small/medium/large). Uses real Azure retail pricing for 25+ services. Returns itemized cost breakdown.\n\n**Input:** `playNumber` (number), `scale` (string: 'small'|'medium'|'large')\n**Output:** Itemized cost breakdown with totals\n**Example:** `estimate_cost({playNumber: 1, scale: 'medium'})` → ~$850/mo breakdown" },
  { name: "validate_config", desc: "🧮 Compute — Validate config files", type: "compute",
    docs: "Validates FrootAI config files (openai.json, guardrails.json, routing.json) against production best practices. Checks for security issues, missing fields, suboptimal settings.\n\n**Input:** `configType` (string), `config` (object)\n**Output:** Array of findings: 🔴 Critical / 🟡 Warning / 🟢 Good\n**Example:** `validate_config({configType: 'openai', config: {...}})` → [{severity: 'warning', message: 'temperature > 0.3'}]" },
  { name: "compare_plays", desc: "🧮 Compute — Compare solution plays", type: "compute",
    docs: "Compares two or more solution plays side-by-side across dimensions: complexity, cost, services used, team size, and deployment time. Great for choosing between similar approaches.\n\n**Input:** `playIds` (number[]) — play numbers to compare\n**Output:** Comparison matrix with recommendations\n**Example:** `compare_plays({playIds: [1, 9]})` → RAG Q&A vs AI Search Portal comparison" },
  { name: "generate_architecture_diagram", desc: "🧮 Compute — Generate Mermaid diagrams", type: "compute",
    docs: "Generates Mermaid.js architecture diagrams for any solution play. Includes Azure services, data flows, and integration points. Renders in VS Code preview.\n\n**Input:** `playNumber` (number), `style` (string: 'flowchart'|'sequence'|'c4')\n**Output:** Mermaid diagram code\n**Example:** `generate_architecture_diagram({playNumber: 5})` → IT Ticket Resolution flowchart" },
  { name: "embedding_playground", desc: "🧮 Compute — Experiment with embeddings", type: "compute",
    docs: "Interactive playground for text embeddings. Compute similarity between texts, visualize embedding dimensions, and understand how vector search works under the hood.\n\n**Input:** `texts` (string[]) — texts to embed and compare\n**Output:** Similarity matrix + dimension analysis\n**Example:** `embedding_playground({texts: ['RAG pipeline', 'search system']})` → similarity: 0.87" },
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
    <a href="https://frootai.dev">Website</a> · 
    <a href="https://github.com/gitpavleenbali/frootai">GitHub</a>
  </p>
</body>
</html>`;
}

// ─── GitHub Download Helper with Cache ─────────────────────────────

let _cacheDir = null; // Set in activate() from context.globalStorageUri
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCachePath(repoPath) {
  if (!_cacheDir) return null;
  // Flatten path separators for filesystem safety
  return path.join(_cacheDir, "downloads", repoPath.replace(/\//g, "__"));
}

function readFromCache(repoPath) {
  const cachePath = getCachePath(repoPath);
  if (!cachePath) return null;
  try {
    if (fs.existsSync(cachePath)) {
      const stats = fs.statSync(cachePath);
      const ageMs = Date.now() - stats.mtimeMs;
      if (ageMs < CACHE_TTL_MS) {
        return fs.readFileSync(cachePath, "utf-8");
      }
    }
  } catch { /* cache miss is fine */ }
  return null;
}

function writeToCache(repoPath, content) {
  const cachePath = getCachePath(repoPath);
  if (!cachePath) return;
  try {
    const dir = path.dirname(cachePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cachePath, content, "utf-8");
  } catch { /* cache write failure is non-critical */ }
}

function downloadFromGitHub(repoPath) {
  // Check cache first
  const cached = readFromCache(repoPath);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const url = `https://raw.githubusercontent.com/gitpavleenbali/frootai/main/${repoPath}`;
    https.get(url, { headers: { "User-Agent": "FrootAI-VSCode" } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        https.get(res.headers.location, (res2) => {
          let data = "";
          res2.on("data", (chunk) => data += chunk);
          res2.on("end", () => { writeToCache(repoPath, data); resolve(data); });
        }).on("error", reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => { writeToCache(repoPath, data); resolve(data); });
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

const LAYER_DESCRIPTIONS = {
  "🌱 Foundations": "Core AI concepts, glossary, .github Agentic OS",
  "🪵 Reasoning": "Prompt engineering, RAG, deterministic patterns",
  "🌿 Orchestration": "Semantic Kernel, agents, MCP tools",
  "🍃 Operations": "Azure AI platform, infrastructure, Copilot",
  "🍎 Transformation": "Fine-tuning, responsible AI, production",
};

class FrootModuleProvider {
  getTreeItem(element) { return element; }
  getChildren(element) {
    if (!element) {
      return FROOT_MODULES.map((layer) => {
        const item = new vscode.TreeItem(layer.layer, vscode.TreeItemCollapsibleState.Expanded);
        item.contextValue = "layer";
        item.description = `${layer.modules.length} modules`;
        item.tooltip = `${layer.layer}\n${LAYER_DESCRIPTIONS[layer.layer] || ""}\n\nColor: ${layer.color}\nModules: ${layer.modules.map(m => m.id + " " + m.name).join(", ")}`;
        item.iconPath = new vscode.ThemeIcon("symbol-folder", new vscode.ThemeColor(getLayerThemeColor(layer.color)));
        return item;
      });
    }
    const layerData = FROOT_MODULES.find((l) => l.layer === element.label);
    if (layerData) {
      return layerData.modules.map((m) => {
        const item = new vscode.TreeItem(`${m.id}: ${m.name}`, vscode.TreeItemCollapsibleState.None);
        item.description = getModuleDescription(m.id);
        item.tooltip = `${m.id}: ${m.name}\n${getModuleDescription(m.id)}\n\nClick to read in a rich panel`;
        item.iconPath = new vscode.ThemeIcon("book", new vscode.ThemeColor(getLayerThemeColor(layerData.color)));
        item.command = { command: "frootai.openModule", title: "Open", arguments: [m] };
        return item;
      });
    }
    return [];
  }
}

function getLayerThemeColor(hexColor) {
  // Map our hex colors to VS Code theme color IDs
  const map = {
    "#f59e0b": "charts.yellow",   // Foundations
    "#10b981": "charts.green",    // Reasoning
    "#06b6d4": "charts.blue",     // Orchestration
    "#6366f1": "charts.purple",   // Operations
    "#7c3aed": "charts.purple",   // Transformation
  };
  return map[hexColor] || "foreground";
}

function getModuleDescription(moduleId) {
  const descriptions = {
    "F1": "Core GenAI concepts & terminology",
    "F2": "GPT-4o, Claude, Llama, Phi — model comparison",
    "F3": "200+ AI/ML terms with definitions",
    "F4": "7 primitives, 4 layers — .github folder evolution",
    "R1": "System prompts, few-shot, chain-of-thought",
    "R2": "Retrieval-Augmented Generation patterns",
    "R3": "temp=0, JSON schema, verification loops",
    "O1": "Plugins, planners, memory, agents",
    "O2": "Supervisor, handoffs, multi-agent systems",
    "O3": "MCP protocol, tool calling, function patterns",
    "O4": "Foundry, endpoints, deployments, RBAC",
    "O5": "GPU, networking, landing zones, scaling",
    "O6": "Copilot Studio, extensions, M365 integration",
    "T1": "LoRA, QLoRA, data prep, MLOps pipelines",
    "T2": "Safety, content filtering, red teaming",
    "T3": "Caching, load balancing, cost optimization",
  };
  return descriptions[moduleId] || "";
}

class McpToolProvider {
  getTreeItem(element) { return element; }
  getChildren() {
    // Group by type
    const groups = [
      { label: "📦 Static Tools (6)", type: "static", icon: "database" },
      { label: "⛅ Live Tools (4)", type: "live", icon: "cloud" },
      { label: "🔗 Agent Chain (3)", type: "chain", icon: "link" },
      { label: "🌐 Ecosystem Tools (3)", type: "ecosystem", icon: "globe" },
      { label: "🧮 Compute Tools (6)", type: "compute", icon: "beaker" },
    ];
    const items = [];
    for (const g of groups) {
      const header = new vscode.TreeItem(g.label, vscode.TreeItemCollapsibleState.None);
      header.description = "";
      header.iconPath = new vscode.ThemeIcon(g.icon);
      items.push(header);
      for (const t of MCP_TOOLS.filter(t => t.type === g.type)) {
        const item = new vscode.TreeItem(`  ${t.name}`, vscode.TreeItemCollapsibleState.None);
        item.description = t.desc;
        item.tooltip = `MCP Tool: ${t.name}\nType: ${t.type}\n${t.desc}\n\nClick for actions (docs, install, start)`;
        item.contextValue = "mcpTool";
        item.command = { command: "frootai.mcpToolAction", title: "MCP Action", arguments: [t] };
        items.push(item);
      }
    }
    return items;
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
  console.log("FrootAI v1.0 Standalone Engine activated");

  // B1: Initialize cache directory for offline downloaded plays
  _cacheDir = context.globalStorageUri.fsPath;
  if (!fs.existsSync(_cacheDir)) {
    fs.mkdirSync(_cacheDir, { recursive: true });
  }

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
        { label: "$(notebook) Read User Guide", description: `Step-by-step setup guide for ${play.name}`, value: "userguide" },
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
      } else if (action.value === "userguide") {
        vscode.env.openExternal(vscode.Uri.parse(`https://frootai.dev/user-guide?play=${play.id}`));
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
      vscode.env.openExternal(vscode.Uri.parse(`https://frootai.dev/docs/${mod.file.replace('.md', '')}`));
    })
  );

  // ── Command: Browse Solution Plays (website) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.browseSolutionPlays", () => {
      vscode.env.openExternal(vscode.Uri.parse("https://frootai.dev/solution-plays"));
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
      vscode.env.openExternal(vscode.Uri.parse("https://frootai.dev/setup-guide"));
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
        vscode.env.openExternal(vscode.Uri.parse("https://frootai.dev/docs/T3-Production-Patterns"));
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
      // Generate play-specific instruction filename  
      const playPatternFile = (playDir.replace(/^\d+-/, "")) + "-patterns.instructions.md";

      // Define all files to download
      const filesToDownload = [
        ".github/copilot-instructions.md",
        ".github/instructions/azure-coding.instructions.md",
        ".github/instructions/security.instructions.md",
        `.github/instructions/${playPatternFile}`,
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
        // Infrastructure (part of DevKit — developer deploys infra)
        "infra/main.bicep",
        "infra/parameters.json",
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
        "config/agents.json",
        "config/model-comparison.json",
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
      vscode.window.showInformationMessage("🔌 FrootAI MCP Server starting... 22 tools (6 static + 4 live + 3 chain + 3 ecosystem + 6 compute).");
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
      const picks = [
        { label: "$(info) View Tool Documentation", description: `Read ${tool.name} docs in VS Code`, value: "docs" },
        { label: "$(package) Install MCP Server globally", description: "npm install -g frootai-mcp", value: "install" },
        { label: "$(play) Start MCP Server (npx)", description: "Launch in terminal — 22 tools ready", value: "start" },
        { label: "$(gear) Configure MCP for this workspace", description: "Add .vscode/mcp.json — auto-connects", value: "config" },
        { label: "$(globe) Open npm page", description: "npmjs.com/package/frootai-mcp", value: "npm" },
        { label: "$(book) Open setup guide", description: "Full MCP setup documentation", value: "guide" },
      ];
      const action = await vscode.window.showQuickPick(picks, { placeHolder: `🔌 ${tool.name} — ${tool.desc}` });

      if (!action) return;

      if (action.value === "docs") {
        // B3: Render tool documentation in a VS Code webview panel
        const typeLabel = { static: "📦 Static", live: "⛅ Live", chain: "🔗 Agent Chain" };
        const docsHtml = `
          <h2>🔌 ${tool.name}</h2>
          <p style="opacity:0.7;">${typeLabel[tool.type] || tool.type} Tool</p>
          <p><strong>${tool.desc}</strong></p>
          <hr/>
          <div style="white-space:pre-wrap;line-height:1.6;">${(tool.docs || "No documentation available.").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code style='background:#333;padding:2px 6px;border-radius:3px;'>$1</code>").replace(/\n/g, "<br/>")}</div>
          <hr/>
          <p style="opacity:0.5;">Part of <strong>frootai-mcp@3.0.1</strong> — 22 tools (6 static + 4 live + 3 chain + 3 ecosystem + 6 compute)</p>
          <p style="opacity:0.5;">Install: <code>npm install -g frootai-mcp</code> | Run: <code>npx frootai-mcp</code></p>
        `;
        const panel = vscode.window.createWebviewPanel("frootai.mcpDocs", `MCP: ${tool.name}`, vscode.ViewColumn.One, {});
        panel.webview.html = `<!DOCTYPE html><html><head><style>body{font-family:var(--vscode-font-family,system-ui);color:#e0e0e0;background:#1a1a2e;padding:24px;max-width:700px;}h2{color:#00C853;}code{font-family:var(--vscode-editor-font-family,monospace);}hr{border:none;border-top:1px solid #333;margin:16px 0;}strong{color:#4fc3f7;}</style></head><body>${docsHtml}</body></html>`;
      } else if (action.value === "install") {
        vscode.commands.executeCommand("frootai.installMcpServer");
      } else if (action.value === "start") {
        vscode.commands.executeCommand("frootai.startMcpServer");
      } else if (action.value === "config") {
        vscode.commands.executeCommand("frootai.configureMcp");
      } else if (action.value === "npm") {
        vscode.env.openExternal(vscode.Uri.parse("https://www.npmjs.com/package/frootai-mcp"));
      } else if (action.value === "guide") {
        vscode.env.openExternal(vscode.Uri.parse("https://frootai.dev/setup-guide"));
      }
    })
  );

  // ── Command: Quick Cost Estimate ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.quickCostEstimate", async () => {
      // Pick a solution play
      const playPick = await vscode.window.showQuickPick(
        SOLUTION_PLAYS.map(p => ({ label: `${p.icon} ${p.id} — ${p.name}`, value: p.id })),
        { placeHolder: "💰 Select a Solution Play to estimate costs" }
      );
      if (!playPick) return;

      // Pick scale
      const scalePick = await vscode.window.showQuickPick([
        { label: "🟢 Small", description: "Dev/PoC — minimal resources", value: "small" },
        { label: "🟡 Medium", description: "Production — standard resources", value: "medium" },
        { label: "🔴 Large", description: "Enterprise — high availability", value: "large" },
      ], { placeHolder: "Select deployment scale" });
      if (!scalePick) return;

      const playNum = parseInt(playPick.value);
      const scale = scalePick.value;

      // Service pricing (mirrors MCP server)
      const SVC_PRICING = {
        "Azure OpenAI (GPT-4o)": { small: 50, medium: 200, large: 800 },
        "Azure OpenAI (GPT-4o-mini)": { small: 10, medium: 50, large: 200 },
        "Azure AI Search (Basic)": { small: 75, medium: 75, large: 75 },
        "Azure AI Search (Standard)": { small: 250, medium: 250, large: 750 },
        "App Service (B1)": { small: 13, medium: 13, large: 13 },
        "App Service (P1v3)": { small: 80, medium: 80, large: 160 },
        "Cosmos DB (Serverless)": { small: 5, medium: 25, large: 100 },
        "Azure Functions (Consumption)": { small: 0, medium: 5, large: 20 },
        "Azure Storage (Blob)": { small: 2, medium: 10, large: 50 },
        "Application Insights": { small: 0, medium: 10, large: 50 },
        "Azure Key Vault": { small: 1, medium: 1, large: 3 },
        "API Management (Consumption)": { small: 3, medium: 3, large: 3 },
        "API Management (Standard)": { small: 680, medium: 680, large: 1360 },
        "Container Apps": { small: 10, medium: 50, large: 200 },
        "AKS (System)": { small: 0, medium: 0, large: 0 },
        "AKS (D4s node)": { small: 140, medium: 280, large: 560 },
        "Azure SQL (Basic)": { small: 5, medium: 5, large: 5 },
        "Azure SQL (Standard S1)": { small: 30, medium: 30, large: 60 },
        "Virtual Network": { small: 0, medium: 0, large: 0 },
        "Azure Front Door": { small: 35, medium: 35, large: 108 },
        "Azure Communication Services": { small: 5, medium: 20, large: 100 },
        "Speech Services": { small: 10, medium: 50, large: 200 },
        "Content Safety": { small: 0, medium: 15, large: 75 },
        "Document Intelligence": { small: 10, medium: 50, large: 200 },
        "Logic Apps": { small: 5, medium: 25, large: 100 },
      };

      // Play-to-services mapping (top plays)
      const PLAY_SERVICES = {
        1: ["Azure OpenAI (GPT-4o)", "Azure AI Search (Basic)", "App Service (B1)", "Azure Storage (Blob)", "Application Insights", "Azure Key Vault"],
        2: ["Virtual Network", "Azure Key Vault", "Application Insights", "Azure Storage (Blob)"],
        3: ["Azure OpenAI (GPT-4o-mini)", "Azure Functions (Consumption)", "Azure Key Vault", "Application Insights"],
        4: ["Azure OpenAI (GPT-4o)", "Speech Services", "Azure Communication Services", "App Service (B1)", "Application Insights"],
        5: ["Azure OpenAI (GPT-4o-mini)", "Azure Functions (Consumption)", "Logic Apps", "Azure Storage (Blob)", "Application Insights"],
        6: ["Document Intelligence", "Azure OpenAI (GPT-4o)", "Azure Storage (Blob)", "Cosmos DB (Serverless)", "Application Insights"],
        7: ["Azure OpenAI (GPT-4o)", "Container Apps", "Cosmos DB (Serverless)", "Azure Key Vault", "Application Insights"],
        8: ["Azure OpenAI (GPT-4o-mini)", "App Service (B1)", "Azure Storage (Blob)", "Application Insights"],
        9: ["Azure AI Search (Standard)", "Azure OpenAI (GPT-4o)", "App Service (P1v3)", "Azure Storage (Blob)", "Application Insights"],
        10: ["Content Safety", "Azure OpenAI (GPT-4o-mini)", "Azure Functions (Consumption)", "Application Insights"],
        11: ["Virtual Network", "Azure Key Vault", "Application Insights", "Azure Storage (Blob)", "Azure Front Door"],
        12: ["AKS (System)", "AKS (D4s node)", "Container Apps", "Azure Key Vault", "Application Insights"],
        13: ["Azure OpenAI (GPT-4o)", "Azure Storage (Blob)", "Azure Functions (Consumption)", "Application Insights"],
        14: ["API Management (Consumption)", "Azure OpenAI (GPT-4o)", "Azure Key Vault", "Application Insights"],
        15: ["Document Intelligence", "Azure OpenAI (GPT-4o)", "Azure Storage (Blob)", "Cosmos DB (Serverless)", "Application Insights"],
        16: ["Azure OpenAI (GPT-4o-mini)", "App Service (B1)", "Azure Storage (Blob)", "Application Insights"],
        17: ["Application Insights", "Azure Functions (Consumption)", "Azure Storage (Blob)", "Cosmos DB (Serverless)"],
        18: ["Azure OpenAI (GPT-4o-mini)", "Cosmos DB (Serverless)", "Azure Functions (Consumption)", "Application Insights"],
        19: ["Azure OpenAI (GPT-4o-mini)", "Container Apps", "Azure Storage (Blob)", "Application Insights"],
        20: ["Azure OpenAI (GPT-4o)", "Azure Functions (Consumption)", "Cosmos DB (Serverless)", "Application Insights"],
      };

      const services = PLAY_SERVICES[playNum] || PLAY_SERVICES[1];
      let total = 0;
      const lines = [];
      for (const svc of services) {
        const price = SVC_PRICING[svc]?.[scale] || 0;
        total += price;
        lines.push(`| ${svc} | $${price}/mo |`);
      }

      const play = SOLUTION_PLAYS.find(p => parseInt(p.id) === playNum);
      const mdContent = `# 💰 Cost Estimate: ${play?.icon || ""} ${play?.name || "Play " + playNum}\n\n` +
        `**Scale:** ${scalePick.label}\n\n` +
        `| Service | Monthly Cost |\n|---|---|\n${lines.join("\n")}\n\n` +
        `**Estimated Total: ~$${total}/month**\n\n` +
        `---\n_Generated by FrootAI Compute Engine · [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/)_`;

      const panel = vscode.window.createWebviewPanel("frootai.costEstimate", `Cost: ${play?.name || "Play " + playNum}`, vscode.ViewColumn.One, {});
      panel.webview.html = markdownToHtml(mdContent, `Cost Estimate: ${play?.name}`);
    })
  );

  // ── Command: Validate Config ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.validateConfig", async () => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsFolder) { vscode.window.showWarningMessage("Open a folder first to validate config files."); return; }

      // Find config files
      const configDir = path.join(wsFolder, "config");
      const configs = [];
      if (fs.existsSync(configDir)) {
        for (const file of fs.readdirSync(configDir)) {
          if (file.endsWith(".json")) configs.push({ label: `config/${file}`, path: path.join(configDir, file), file });
        }
      }
      // Also check root-level config files
      for (const f of ["openai.json", "guardrails.json", "routing.json"]) {
        const p = path.join(wsFolder, f);
        if (fs.existsSync(p) && !configs.find(c => c.file === f)) configs.push({ label: f, path: p, file: f });
      }

      if (configs.length === 0) {
        vscode.window.showWarningMessage("No config/*.json files found. Create config/openai.json to get started.");
        return;
      }

      const pick = await vscode.window.showQuickPick(
        configs.map(c => ({ label: `📄 ${c.label}`, description: "Validate against best practices", value: c })),
        { placeHolder: "🔍 Select a config file to validate" }
      );
      if (!pick) return;

      const configPath = pick.value.path;
      const fileName = pick.value.file;
      let config;
      try {
        config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      } catch (e) {
        vscode.window.showErrorMessage(`Failed to parse ${fileName}: ${e.message}`);
        return;
      }

      // Run validations
      const findings = [];
      const addFinding = (severity, message) => findings.push({ severity, message });

      if (fileName.includes("openai")) {
        // OpenAI config validation
        if (!config.model) addFinding("🔴", "Missing 'model' field — must specify deployment model");
        if (config.temperature !== undefined && config.temperature > 0.3) addFinding("🟡", `temperature=${config.temperature} — consider ≤0.3 for deterministic output`);
        if (config.temperature !== undefined && config.temperature === 0) addFinding("🟢", "temperature=0 — fully deterministic ✓");
        if (!config.max_tokens) addFinding("🟡", "Missing 'max_tokens' — set a limit to control costs");
        if (config.max_tokens && config.max_tokens > 4000) addFinding("🟡", `max_tokens=${config.max_tokens} — high value increases cost`);
        if (config.api_key || config.apiKey) addFinding("🔴", "API key found in config! Use Managed Identity or Key Vault instead");
        if (config.endpoint && !config.endpoint.includes("openai.azure.com")) addFinding("🟡", "Endpoint doesn't look like Azure OpenAI");
        if (!config.system_prompt && !config.systemPrompt) addFinding("🟡", "No system_prompt — consider adding one for consistent behavior");
        if (config.response_format?.type === "json_object") addFinding("🟢", "JSON mode enabled — structured output ✓");
      } else if (fileName.includes("guardrails")) {
        // Guardrails validation
        if (!config.blocked_topics && !config.blockedTopics) addFinding("🟡", "No blocked_topics — consider adding content filters");
        if (!config.pii_filter && !config.piiFilter) addFinding("🟡", "No PII filter — consider enabling for compliance");
        if (!config.max_input_length && !config.maxInputLength) addFinding("🟡", "No max_input_length — vulnerable to prompt injection via long inputs");
        if (config.pii_filter === true || config.piiFilter === true) addFinding("🟢", "PII filter enabled ✓");
        if (config.content_safety || config.contentSafety) addFinding("🟢", "Content safety configured ✓");
      } else if (fileName.includes("routing")) {
        // Routing validation
        if (!config.default_model && !config.defaultModel) addFinding("🟡", "No default_model — requests may fail without fallback");
        if (config.retry_policy || config.retryPolicy) addFinding("🟢", "Retry policy configured ✓");
        if (!config.timeout) addFinding("🟡", "No timeout — long-running requests may hang");
      } else {
        addFinding("🟢", `File parsed successfully — ${Object.keys(config).length} top-level keys found`);
      }

      if (findings.length === 0) {
        findings.push({ severity: "🟢", message: "All checks passed — config looks good!" });
      }

      const criticals = findings.filter(f => f.severity === "🔴").length;
      const warnings = findings.filter(f => f.severity === "🟡").length;
      const goods = findings.filter(f => f.severity === "🟢").length;

      const mdContent = `# 🔍 Config Validation: ${fileName}\n\n` +
        `**Summary:** ${criticals} critical · ${warnings} warnings · ${goods} good\n\n` +
        findings.map(f => `- ${f.severity} ${f.message}`).join("\n") +
        `\n\n---\n_Validated by FrootAI Compute Engine · [Best Practices](https://frootai.dev/ai-nexus/responsible-ai-safety)_`;

      const panel = vscode.window.createWebviewPanel("frootai.validateConfig", `Validate: ${fileName}`, vscode.ViewColumn.One, {});
      panel.webview.html = markdownToHtml(mdContent, `Config Validation: ${fileName}`);

      // Also show notification
      if (criticals > 0) {
        vscode.window.showWarningMessage(`🔴 ${criticals} critical finding(s) in ${fileName}! Open panel for details.`);
      } else if (warnings > 0) {
        vscode.window.showInformationMessage(`🟡 ${warnings} warning(s) in ${fileName}. Open panel for details.`);
      } else {
        vscode.window.showInformationMessage(`🟢 ${fileName} — all checks passed!`);
      }
    })
  );

  // ── Command: Auto-Chain Agents (Build → Review → Tune) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.autoChainAgents", async () => {
      // Step 1: Ask what to build (search bar)
      const task = await vscode.window.showInputBox({
        prompt: "🛠️ BUILDER AGENT — What would you like to build?",
        placeHolder: "e.g., Build me an IT ticket classification API using Logic Apps + OpenAI",
        ignoreFocusOut: true
      });
      if (!task) return;

      // Read agent.md context if available
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      let agentContext = "";
      if (wsFolder) {
        const agentPath = path.join(wsFolder, "agent.md");
        if (fs.existsSync(agentPath)) {
          agentContext = `\n\nContext from agent.md:\n${fs.readFileSync(agentPath, "utf-8").substring(0, 1500)}`;
        }
      }

      // ── STAGE 1: BUILD ──
      const buildPrompt = `🛠️ BUILDER AGENT — ${task}\n\nRules: Use config/*.json values (never hardcode). Use Managed Identity. Include error handling + App Insights logging. Follow .github/instructions/*.instructions.md patterns.${agentContext}\n\nBuild the complete implementation.`;

      await vscode.env.clipboard.writeText(buildPrompt);
      // Auto-open Copilot Chat
      try { await vscode.commands.executeCommand("workbench.action.chat.open"); } catch {}

      // Show stage prompt at search bar level
      const stage1 = await vscode.window.showQuickPick([
        { label: "$(paste) Paste builder prompt in chat (Ctrl+V)", description: "Prompt is on clipboard", value: "paste" },
        { label: "$(arrow-right) Skip to Review", description: "I've already built the code", value: "review" },
        { label: "$(close) Cancel chain", value: "cancel" },
      ], { placeHolder: "🛠️ STAGE 1/3: BUILD — Prompt copied. Paste in Copilot Chat, then come back here.", ignoreFocusOut: true });

      if (!stage1 || stage1.value === "cancel") return;

      // ── STAGE 2: REVIEW ──
      const reviewPrompt = `🔍 REVIEWER AGENT — Review the code above.\n\nCheck: No secrets in code · Managed Identity · Input validation · Error handling + retry · App Insights logging · Config from files (not hardcoded) · Temperature ≤ 0.3\n\nReport: 🔴 Critical / 🟡 Warning / 🟢 Suggestion for each finding.`;

      await vscode.env.clipboard.writeText(reviewPrompt);

      const stage2 = await vscode.window.showQuickPick([
        { label: "$(paste) Paste reviewer prompt in chat (Ctrl+V)", description: "Review prompt on clipboard", value: "paste" },
        { label: "$(arrow-right) Skip to Tune", description: "Review done, proceed to tuning", value: "tune" },
        { label: "$(close) End chain", value: "cancel" },
      ], { placeHolder: "🔍 STAGE 2/3: REVIEW — Prompt copied. Paste in chat to review your code.", ignoreFocusOut: true });

      if (!stage2 || stage2.value === "cancel") return;

      // ── STAGE 3: TUNE ──
      const tunePrompt = `🎛️ TUNER AGENT — Validate TuneKit config for production.\n\nCheck: config/openai.json (temp ≤ 0.3, model set) · config/guardrails.json (PII filter, blocked topics) · infra/main.bicep (valid, tagged) · evaluation/ (test cases exist) · No secrets in code\n\nVerdict: READY FOR PRODUCTION or NEEDS TUNING (specify what to change).`;

      await vscode.env.clipboard.writeText(tunePrompt);

      const stage3 = await vscode.window.showQuickPick([
        { label: "$(paste) Paste tuner prompt in chat (Ctrl+V)", description: "Tuner prompt on clipboard", value: "paste" },
        { label: "$(rocket) Deploy! (/deploy)", description: "Ready to deploy to Azure", value: "deploy" },
        { label: "$(check) Done — chain complete", value: "done" },
      ], { placeHolder: "🎛️ STAGE 3/3: TUNE — Prompt copied. Paste in chat to validate production config.", ignoreFocusOut: true });

      if (stage3?.value === "deploy") {
        await vscode.env.clipboard.writeText("Run the /deploy slash command: validate Bicep → create resource group → deploy infrastructure → smoke test → verify.");
        vscode.window.showInformationMessage("🚀 Deploy prompt copied! Paste in Copilot Chat.");
      }

      vscode.window.showInformationMessage("✅ Auto-Chain complete: Build → Review → Tune. Your solution is ready!");
    })
  );

  // ── Status Bar ──
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = "$(tree-view-icon) FrootAI";
  statusBar.tooltip = `FrootAI — From the Roots to the Fruits\n${knowledgeLoaded ? `${Object.keys(KNOWLEDGE.modules).length} modules · ${Object.keys(GLOSSARY).length} terms · 22 MCP tools` : "Knowledge loading..."}`;
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
