const vscode = require("vscode");

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
  { layer: "🌱 Foundations", modules: [
    { id: "F1", name: "GenAI Foundations", file: "GenAI-Foundations.md" },
    { id: "F2", name: "LLM Landscape", file: "LLM-Landscape.md" },
    { id: "F3", name: "AI Glossary A–Z", file: "F3-AI-Glossary-AZ.md" },
  ]},
  { layer: "🪵 Reasoning", modules: [
    { id: "R1", name: "Prompt Engineering", file: "Prompt-Engineering.md" },
    { id: "R2", name: "RAG Architecture", file: "RAG-Architecture.md" },
    { id: "R3", name: "Deterministic AI", file: "R3-Deterministic-AI.md" },
  ]},
  { layer: "🌿 Orchestration", modules: [
    { id: "O1", name: "Semantic Kernel", file: "Semantic-Kernel.md" },
    { id: "O2", name: "AI Agents", file: "AI-Agents-Deep-Dive.md" },
    { id: "O3", name: "MCP & Tools", file: "O3-MCP-Tools-Functions.md" },
  ]},
  { layer: "🍃 Operations", modules: [
    { id: "O4", name: "Azure AI Platform", file: "Azure-AI-Foundry.md" },
    { id: "O5", name: "AI Infrastructure", file: "AI-Infrastructure.md" },
    { id: "O6", name: "Copilot Ecosystem", file: "Copilot-Ecosystem.md" },
  ]},
  { layer: "🍎 Transformation", modules: [
    { id: "T1", name: "Fine-Tuning", file: "T1-Fine-Tuning-MLOps.md" },
    { id: "T2", name: "Responsible AI", file: "Responsible-AI-Safety.md" },
    { id: "T3", name: "Production Patterns", file: "T3-Production-Patterns.md" },
  ]},
];

const MCP_TOOLS = [
  { name: "list_modules", desc: "Browse 17 modules by FROOT layer" },
  { name: "get_module", desc: "Read any module (F1–T3)" },
  { name: "lookup_term", desc: "200+ AI/ML term definitions" },
  { name: "search_knowledge", desc: "Full-text search all modules" },
  { name: "get_architecture_pattern", desc: "7 decision guides" },
  { name: "get_froot_overview", desc: "Complete FROOT summary" },
];

// ─── Tree Data Providers ───────────────────────────────────────────

class SolutionPlayProvider {
  constructor() { this._onDidChange = new vscode.EventEmitter(); this.onDidChangeTreeData = this._onDidChange.event; }
  getTreeItem(element) { return element; }
  getChildren(element) {
    if (!element) {
      return SOLUTION_PLAYS.map((p) => {
        const item = new vscode.TreeItem(`${p.icon} ${p.id} — ${p.name}`, vscode.TreeItemCollapsibleState.None);
        item.description = p.status;
        item.tooltip = `Solution Play ${p.id}: ${p.name}\nStatus: ${p.status}\nDir: solution-plays/${p.dir}`;
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
        return item;
      });
    }
    const layerData = FROOT_MODULES.find((l) => l.layer === element.label);
    if (layerData) {
      return layerData.modules.map((m) => {
        const item = new vscode.TreeItem(`${m.id}: ${m.name}`, vscode.TreeItemCollapsibleState.None);
        item.tooltip = m.file;
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
      item.tooltip = `MCP Tool: ${t.name}\n${t.desc}`;
      return item;
    });
  }
}

// ─── Find FrootAI Root ─────────────────────────────────────────────

function findFrootAIRoot() {
  const config = vscode.workspace.getConfiguration("frootai");
  const customPath = config.get("solutionPlaysPath");
  if (customPath) return customPath;
  
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) return null;
  
  const path = require("path");
  const fs = require("fs");
  
  for (const folder of folders) {
    // Check if we're in frootai root
    if (fs.existsSync(path.join(folder.uri.fsPath, "solution-plays", "01-enterprise-rag"))) {
      return folder.uri.fsPath;
    }
    // Check if we're inside a solution play
    if (fs.existsSync(path.join(folder.uri.fsPath, "agent.md")) && fs.existsSync(path.join(folder.uri.fsPath, "config"))) {
      return path.join(folder.uri.fsPath, "..", "..");
    }
  }
  return null;
}

// ─── Activate ──────────────────────────────────────────────────────

function activate(context) {
  console.log("FrootAI extension activated");
  
  const root = findFrootAIRoot();
  const path = require("path");
  const fs = require("fs");

  // Register tree views
  vscode.window.registerTreeDataProvider("frootai.solutionPlays", new SolutionPlayProvider());
  vscode.window.registerTreeDataProvider("frootai.frootModules", new FrootModuleProvider());
  vscode.window.registerTreeDataProvider("frootai.mcpTools", new McpToolProvider());

  // Command: Open Solution Play
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.openSolutionPlay", async (play) => {
      if (!root) {
        vscode.window.showWarningMessage("FrootAI root not found. Clone the repo first.");
        return;
      }
      const readmePath = path.join(root, "solution-plays", play.dir, "README.md");
      if (fs.existsSync(readmePath)) {
        const doc = await vscode.workspace.openTextDocument(readmePath);
        await vscode.window.showTextDocument(doc);
        // Also offer to open the full folder
        const choice = await vscode.window.showInformationMessage(
          `Opened ${play.name}. Open the full solution play folder?`,
          "Open Folder", "Just README"
        );
        if (choice === "Open Folder") {
          const folderUri = vscode.Uri.file(path.join(root, "solution-plays", play.dir));
          vscode.commands.executeCommand("vscode.openFolder", folderUri, { forceNewWindow: false });
        }
      } else {
        vscode.window.showWarningMessage(`README not found at: ${readmePath}`);
      }
    })
  );

  // Command: Open Module
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.openModule", async (mod) => {
      if (!root) return;
      const filePath = path.join(root, "docs", mod.file);
      if (fs.existsSync(filePath)) {
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
      }
    })
  );

  // Command: Browse Solution Plays
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.browseSolutionPlays", () => {
      vscode.env.openExternal(vscode.Uri.parse("https://gitpavleenbali.github.io/frootai/solution-plays"));
    })
  );

  // Command: Lookup Term
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.lookupTerm", async () => {
      const term = await vscode.window.showInputBox({
        prompt: "Enter an AI/ML term to look up",
        placeHolder: "e.g., temperature, RAG, LoRA, MCP, embeddings"
      });
      if (!term) return;
      
      // Try to find in glossary file
      if (root) {
        const glossaryPath = path.join(root, "docs", "F3-AI-Glossary-AZ.md");
        if (fs.existsSync(glossaryPath)) {
          const content = fs.readFileSync(glossaryPath, "utf-8");
          const regex = new RegExp(`### ${term}`, "i");
          const match = content.match(regex);
          if (match) {
            const doc = await vscode.workspace.openTextDocument(glossaryPath);
            const editor = await vscode.window.showTextDocument(doc);
            const pos = doc.positionAt(match.index);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.AtTop);
            return;
          }
        }
      }
      
      // Fallback: open website
      vscode.env.openExternal(vscode.Uri.parse(`https://gitpavleenbali.github.io/frootai/docs/F3-AI-Glossary-AZ#${term.toLowerCase().replace(/\s+/g, "-")}`));
    })
  );

  // Command: Search Knowledge
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.searchKnowledge", async () => {
      const query = await vscode.window.showInputBox({
        prompt: "Search FrootAI knowledge base",
        placeHolder: "e.g., how to reduce hallucination, RAG pipeline design"
      });
      if (!query) return;
      
      if (root) {
        // Search across all doc files
        const docsDir = path.join(root, "docs");
        const results = [];
        const files = fs.readdirSync(docsDir).filter((f) => f.endsWith(".md"));
        const queryLower = query.toLowerCase();
        
        for (const file of files) {
          const content = fs.readFileSync(path.join(docsDir, file), "utf-8");
          if (content.toLowerCase().includes(queryLower)) {
            const lines = content.split("\n");
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].toLowerCase().includes(queryLower)) {
                results.push({ file, line: i + 1, text: lines[i].trim().substring(0, 100) });
                if (results.length >= 10) break;
              }
            }
          }
          if (results.length >= 10) break;
        }
        
        if (results.length > 0) {
          const pick = await vscode.window.showQuickPick(
            results.map((r) => ({ label: `${r.file}:${r.line}`, description: r.text, detail: r.file, line: r.line })),
            { placeHolder: `Found ${results.length} results for "${query}"` }
          );
          if (pick) {
            const doc = await vscode.workspace.openTextDocument(path.join(docsDir, pick.detail));
            const editor = await vscode.window.showTextDocument(doc);
            const pos = new vscode.Position(pick.line - 1, 0);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos));
          }
        } else {
          vscode.window.showInformationMessage(`No results for "${query}" in local docs. Try the website.`);
        }
      }
    })
  );

  // Command: Open Setup Guide
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.openSetupGuide", () => {
      vscode.env.openExternal(vscode.Uri.parse("https://gitpavleenbali.github.io/frootai/setup-guide"));
    })
  );

  // Command: Show Architecture Pattern
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.showArchitecturePattern", async () => {
      const patterns = [
        { label: "RAG Pipeline", description: "Design decisions for RAG", value: "rag_pipeline" },
        { label: "Agent Hosting", description: "Container Apps vs AKS vs App Service", value: "agent_hosting" },
        { label: "Model Selection", description: "Which model for which use case", value: "model_selection" },
        { label: "Cost Optimization", description: "Token economics and savings", value: "cost_optimization" },
        { label: "Deterministic AI", description: "5-layer defense against hallucination", value: "deterministic_ai" },
        { label: "Multi-Agent", description: "Supervisor vs pipeline vs swarm", value: "multi_agent" },
        { label: "Fine-Tuning Decision", description: "Fine-tune vs RAG vs prompting", value: "fine_tuning_decision" },
      ];
      const pick = await vscode.window.showQuickPick(patterns, { placeHolder: "Select an architecture pattern" });
      if (pick) {
        vscode.env.openExternal(vscode.Uri.parse(`https://gitpavleenbali.github.io/frootai/docs/T3-Production-Patterns`));
      }
    })
  );

  // Command: Init DevKit
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.initDevKit", async () => {
      const plays = SOLUTION_PLAYS.map((p) => ({ label: `${p.icon} ${p.id} — ${p.name}`, description: p.status, value: p }));
      const pick = await vscode.window.showQuickPick(plays, { placeHolder: "Which solution play's DevKit do you want to initialize?" });
      if (!pick || !root) return;
      
      const playDir = path.join(root, "solution-plays", pick.value.dir);
      if (!fs.existsSync(playDir)) {
        vscode.window.showWarningMessage(`Solution play not found: ${playDir}`);
        return;
      }
      
      // Copy DevKit files to current workspace
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsFolder) return;
      
      const devkitFiles = [
        { src: "agent.md", dst: "agent.md" },
        { src: "instructions.md", dst: "instructions.md" },
        { src: ".github/copilot-instructions.md", dst: ".github/copilot-instructions.md" },
        { src: ".vscode/mcp.json", dst: ".vscode/mcp.json" },
      ];
      
      for (const f of devkitFiles) {
        const srcPath = path.join(playDir, f.src);
        const dstPath = path.join(wsFolder, f.dst);
        if (fs.existsSync(srcPath)) {
          const dir = path.dirname(dstPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.copyFileSync(srcPath, dstPath);
        }
      }
      
      vscode.window.showInformationMessage(`DevKit initialized for ${pick.value.name}! agent.md, instructions.md, MCP config copied to your workspace.`);
    })
  );

  // Status bar
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = "$(tree-view-icon) FrootAI";
  statusBar.tooltip = "FrootAI — Know the roots. Ship the fruit.";
  statusBar.command = "frootai.browseSolutionPlays";
  statusBar.show();
  context.subscriptions.push(statusBar);
}

function deactivate() {}

module.exports = { activate, deactivate };
