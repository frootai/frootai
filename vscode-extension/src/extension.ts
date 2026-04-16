// FrootAI VS Code Extension v6.2.1
// Legacy extension.js handles tree views + 25 commands.
// This TS entry point adds React webview panel commands on top.

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { searchAll } from "./commands/search";
import { createReactPanel } from "./webviews/reactHost";
import { SOLUTION_PLAYS } from "./data/plays";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const legacy = require("./legacy.js");

let _activated = false;

/** E2: Scan workspace for evaluation data files */
function scanWorkspaceEvalData(): {
  hasRealData: boolean;
  scores: Record<string, number>;
  thresholds: Record<string, number>;
  history: Array<{ label: string; date?: string; scores: Record<string, number> }>;
  configPath?: string;
  hasEvalPy?: boolean;
  hasTestSet?: boolean;
  resultFiles?: string[];
} {
  const ws = vscode.workspace.workspaceFolders?.[0];
  if (!ws) return { hasRealData: false, scores: {}, thresholds: {}, history: [] };

  const wsRoot = ws.uri.fsPath;
  const evalDir = path.join(wsRoot, "evaluation");
  const configPath = path.join(evalDir, "eval-config.json");
  const resultsPath = path.join(evalDir, "eval-results.json");
  const evalPy = path.join(evalDir, "eval.py");
  const testSet = path.join(evalDir, "test-set.jsonl");
  const resultsDir = path.join(evalDir, "results");

  // Load config
  let thresholds: Record<string, number> = { groundedness: 4.0, relevance: 4.0, coherence: 4.0, fluency: 4.0, safety: 4.0 };
  let hasConfig = false;
  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (cfg.thresholds) thresholds = cfg.thresholds;
      hasConfig = true;
    } catch {}
  }

  // Collect result files
  const resultFiles: string[] = [];
  const allResults: Array<{ label: string; date?: string; scores: Record<string, number> }> = [];

  // Check eval-results.json (latest)
  if (fs.existsSync(resultsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
      if (data.scores && typeof data.scores === "object") {
        resultFiles.push("eval-results.json");
        allResults.push({ label: "Latest", date: data.timestamp, scores: data.scores });
      }
    } catch {}
  }

  // Check results/ subdirectory for historical runs
  if (fs.existsSync(resultsDir)) {
    try {
      const files = fs.readdirSync(resultsDir).filter((f: string) => f.endsWith(".json")).sort().reverse();
      for (const f of files.slice(0, 20)) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(resultsDir, f), "utf-8"));
          if (data.scores && typeof data.scores === "object") {
            resultFiles.push(`results/${f}`);
            const label = f.replace(".json", "").replace(/^run-/, "Run ");
            allResults.push({ label, date: data.timestamp, scores: data.scores });
          }
        } catch {}
      }
    } catch {}
  }

  const hasRealData = allResults.length > 0;
  const latestScores = hasRealData ? allResults[0].scores : {};

  return {
    hasRealData,
    scores: latestScores,
    thresholds,
    history: allResults,
    configPath: hasConfig ? "evaluation/eval-config.json" : undefined,
    hasEvalPy: fs.existsSync(evalPy),
    hasTestSet: fs.existsSync(testSet),
    resultFiles,
  };
}

export function activate(context: vscode.ExtensionContext): void {
  if (_activated) return;
  _activated = true;

  // Legacy handles tree views + existing commands
  try {
    legacy.activate(context);
  } catch (e: any) {
    console.error(`FrootAI: legacy activation error — ${e.message}`);
    vscode.window.showWarningMessage(`FrootAI: Partial activation — ${e.message}`);
  }

  // New React panel commands — safe registration (skip if already exists)
  const safeRegister = (id: string, fn: (...args: any[]) => any) => {
    try { context.subscriptions.push(vscode.commands.registerCommand(id, fn)); }
    catch (e: any) { console.warn(`FrootAI: skipped ${id} — ${e.message}`); }
  };

  safeRegister("frootai.searchAll", () => searchAll());

  safeRegister("frootai.openPlayDetail", (playOrId?: any) => {
    let play = playOrId;
    if (typeof playOrId === "string") {
      play = SOLUTION_PLAYS.find(p => p.id === playOrId) ?? SOLUTION_PLAYS[0];
    }
    if (!play) play = SOLUTION_PLAYS[0];
    const panel = createReactPanel(context.extensionUri, "frootai.playDetail", `Play ${play.id} — ${play.name}`, { panel: "playDetail", play });
    panel.webview.onDidReceiveMessage(async (msg: any) => {
      const fs = require("fs");
      const path = require("path");

      try {
      switch (msg.command) {
        case "initDevKit": vscode.commands.executeCommand("frootai.initDevKit", play); break;
        case "initTuneKit": vscode.commands.executeCommand("frootai.initTuneKit", play); break;
        case "initSpecKit": vscode.commands.executeCommand("frootai.initSpecKit", play); break;
        case "initHooks": vscode.commands.executeCommand("frootai.initHooks", play); break;
        case "initPrompts": vscode.commands.executeCommand("frootai.initPrompts", play); break;
        case "createManifest": vscode.commands.executeCommand("frootai.createManifest"); break;
        case "openUrl": if (msg.url) vscode.env.openExternal(vscode.Uri.parse(msg.url)); break;

        // F1: Install Plugin — creates REAL files (same as legacy but no dropdown)
        case "installPlugin": {
          const folders = vscode.workspace.workspaceFolders;
          if (!folders) { vscode.window.showWarningMessage("Open a workspace folder first."); return; }
          const wsRoot = folders[0].uri.fsPath;
          const dirs = [".github/agents", ".github/instructions", "config", "spec"];
          for (const d of dirs) {
            const dp = path.join(wsRoot, d);
            if (!fs.existsSync(dp)) fs.mkdirSync(dp, { recursive: true });
          }
          fs.writeFileSync(path.join(wsRoot, ".github/agents/builder.agent.md"),
            `---\ndescription: "Builder agent for ${play.name}"\ntools: ["frootai"]\n---\n# Builder Agent\nUse FrootAI MCP for architecture patterns and best practices for ${play.name}.\n`);
          fs.writeFileSync(path.join(wsRoot, ".github/agents/reviewer.agent.md"),
            `---\ndescription: "Reviewer agent for ${play.name}"\ntools: ["frootai"]\n---\n# Reviewer Agent\nAudit for security, quality, and compliance.\n`);
          fs.writeFileSync(path.join(wsRoot, ".github/agents/tuner.agent.md"),
            `---\ndescription: "Tuner agent for ${play.name}"\ntools: ["frootai"]\n---\n# Tuner Agent\nValidate production readiness and optimize configuration.\n`);
          fs.writeFileSync(path.join(wsRoot, ".github/instructions/waf-security.instructions.md"),
            `---\napplyTo: "**/*.{ts,js,py,bicep,json}"\n---\n# Security\n- Use Managed Identity\n- Store secrets in Key Vault\n- Enable Content Safety\n`);
          fs.writeFileSync(path.join(wsRoot, "config/openai.json"),
            JSON.stringify({ model: "gpt-4o-mini", temperature: 0.1, max_tokens: 4096 }, null, 2));
          fs.writeFileSync(path.join(wsRoot, "config/guardrails.json"),
            JSON.stringify({ max_tokens_per_request: 4096, blocked_categories: ["hate", "violence", "self-harm", "sexual"], pii_detection: true, grounding_check: true }, null, 2));
          fs.writeFileSync(path.join(wsRoot, "spec/play-spec.json"),
            JSON.stringify({ name: play.dir, version: "0.1.0", play: play.id }, null, 2));
          fs.writeFileSync(path.join(wsRoot, "plugin.json"),
            JSON.stringify({ name: play.dir, version: "1.0.0", description: play.desc || play.name, layers: { agents: [".github/agents/*.md"], instructions: [".github/instructions/*.md"], config: ["config/*.json"], spec: ["spec/*.json"] } }, null, 2));
          vscode.window.showInformationMessage(`✅ Plugin "${play.name}" installed — agents, instructions, config, spec, plugin.json created.`);
          break;
        }

        // F2: Estimate Cost — loads from cost.json (local → GitHub download → fallback)
        case "cost": {
          let costData: any = null;

          // Try 1: Local workspace
          const wsFolders = vscode.workspace.workspaceFolders;
          if (wsFolders) {
            const localPath = path.join(wsFolders[0].uri.fsPath, "solution-plays", play.dir, "cost.json");
            try { if (fs.existsSync(localPath)) { costData = JSON.parse(fs.readFileSync(localPath, "utf-8")); } } catch {}
          }

          // Try 2: GitHub download with cache
          if (!costData) {
            try {
              const ghUrl = `https://raw.githubusercontent.com/frootai/frootai/main/solution-plays/${play.dir}/cost.json`;
              const res = await fetch(ghUrl, { headers: { "User-Agent": "FrootAI-VSCode" } });
              if (res.ok) { costData = JSON.parse(await res.text()); }
            } catch {}
          }

          // Build HTML from cost.json data
          let servicesHtml = "";
          let totals = { dev: 0, prod: 0, ent: 0 };
          let tips: string[] = [];
          const catColors: Record<string, string> = { "AI Services": "#10b981", "Compute": "#3b82f6", "Storage": "#f59e0b", "Security": "#7c3aed", "Monitoring": "#0ea5e9" };

          if (costData?.services) {
            // Group by category
            const groups: Record<string, any[]> = {};
            for (const svc of costData.services) {
              const cat = svc.category || "Other";
              if (!groups[cat]) groups[cat] = [];
              groups[cat].push(svc);
            }
            totals = costData.totals || { dev: 0, prod: 0, ent: 0 };
            tips = costData.optimization_tips || [];
            const maxProd = Math.max(...costData.services.map((s: any) => s.tiers?.prod?.cost || 0), 1);

            for (const [catName, svcs] of Object.entries(groups)) {
              const color = catColors[catName] || "#6b7280";
              const catTotal = (svcs as any[]).reduce((a: number, s: any) => a + (s.tiers?.prod?.cost || 0), 0);
              const rows = (svcs as any[]).map((s: any) => {
                const d = s.tiers?.dev?.cost || 0, p = s.tiers?.prod?.cost || 0, e = s.tiers?.enterprise?.cost || 0;
                const barW = Math.max(Math.round((p / maxProd) * 100), 4);
                return `<tr>
                  <td style="padding:8px 12px"><strong>${s.name}</strong><div style="font-size:10px;opacity:0.5;margin-top:2px">${s.purpose || ""}</div></td>
                  <td style="padding:8px 12px;text-align:right">$${d}<div style="font-size:9px;opacity:0.4">${s.tiers?.dev?.sku || ""}</div></td>
                  <td style="padding:8px 12px;text-align:right">$${p}<div style="font-size:9px;opacity:0.4">${s.tiers?.prod?.sku || ""}</div></td>
                  <td style="padding:8px 12px;text-align:right">$${e}<div style="font-size:9px;opacity:0.4">${s.tiers?.enterprise?.sku || ""}</div></td>
                  <td style="padding:8px 12px;width:100px"><div style="height:6px;border-radius:3px;background:#333"><div style="height:100%;width:${barW}%;background:${color};border-radius:3px"></div></div></td>
                </tr>`;
              }).join("");
              servicesHtml += `<div style="margin-bottom:20px">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:${color}15;border-left:3px solid ${color};border-radius:0 6px 6px 0;margin-bottom:4px">
                  <span style="font-size:13px;font-weight:700">${catName}</span>
                  <span style="font-size:12px;opacity:0.7">Subtotal: <span style="color:${color};font-weight:600">$${catTotal}/mo</span></span>
                </div>
                <table><tr><th>Service</th><th style="text-align:right">Dev</th><th style="text-align:right">Prod</th><th style="text-align:right">Enterprise</th><th></th></tr>${rows}</table>
              </div>`;
            }
          } else {
            // Fallback: simple list from play.infra
            const infra = play.infra || "Azure OpenAI · Container Apps";
            servicesHtml = `<p>Services: ${infra}</p><p style="opacity:0.6">Detailed cost.json not found for this play. Use <code>estimate_cost</code> MCP tool for pricing.</p>`;
            totals = { dev: 150, prod: 700, ent: 2500 };
          }

          const tipsHtml = tips.map((t: string) => `<div class="tip"><span>•</span><span>${t}</span></div>`).join("");

          const costPanel = vscode.window.createWebviewPanel(
            "frootai.costEstimate", `Cost — ${play.name}`, vscode.ViewColumn.One, { enableScripts: false }
          );
          costPanel.webview.html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{background:#1e1e1e;color:#ccc;font-family:system-ui;padding:24px;line-height:1.6}
h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:24px 0 12px;border-bottom:1px solid #454545;padding-bottom:6px}
table{width:100%;border-collapse:collapse;margin:4px 0}th{text-align:left;padding:6px 12px;border-bottom:1px solid #444;font-size:11px;text-transform:uppercase;opacity:0.5}
td{border-bottom:1px solid #2a2d2e;font-size:13px}tr:hover{background:#2a2d2e}
.total-bar{display:flex;gap:16px;padding:16px;background:#2a2d2e;border-radius:8px;margin:16px 0;justify-content:space-around;text-align:center}
.total-item{flex:1}.total-label{font-size:11px;text-transform:uppercase;opacity:0.5;margin-bottom:4px}
.total-value{font-size:22px;font-weight:800}
.tip{display:flex;align-items:flex-start;gap:8px;padding:8px 0;font-size:12px;border-bottom:1px solid #333}.tip:last-child{border:none}
.link-btn{display:inline-block;margin-top:16px;padding:8px 16px;background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600}
.note{font-size:11px;opacity:0.5;margin-top:16px}
</style></head><body>
<h1>Cost Estimate — ${play.name}</h1>
<p style="opacity:0.7;font-size:13px">${play.desc || ""}</p>
<div class="total-bar">
  <div class="total-item"><div class="total-label">Dev / PoC</div><div class="total-value" style="color:#10b981">$${totals.dev}<span style="font-size:13px;opacity:0.6">/mo</span></div></div>
  <div class="total-item"><div class="total-label">Production</div><div class="total-value" style="color:#f59e0b">$${totals.prod}<span style="font-size:13px;opacity:0.6">/mo</span></div></div>
  <div class="total-item"><div class="total-label">Enterprise</div><div class="total-value" style="color:#ef4444">$${totals.ent}<span style="font-size:13px;opacity:0.6">/mo</span></div></div>
</div>
<h2>Breakdown by Category</h2>
${servicesHtml}
${tips.length ? `<h2>Cost Optimization Tips</h2><div style="background:#2a2d2e;padding:16px;border-radius:8px">${tipsHtml}</div>` : ""}
<a class="link-btn" href="https://azure.microsoft.com/pricing/calculator/" target="_blank">Open Azure Pricing Calculator ↗</a>
<p class="note">Source: solution-plays/${play.dir}/cost.json — single source of truth for GitHub, VS Code, and website.</p>
</body></html>`;
          break;
        }

        // F3: Architecture Diagram — loads from architecture.md (local → GitHub download → fallback)
        case "diagram": {
          let archContent = "";

          // Try 1: Local workspace
          const wsFoldersArch = vscode.workspace.workspaceFolders;
          if (wsFoldersArch) {
            const localPath = path.join(wsFoldersArch[0].uri.fsPath, "solution-plays", play.dir, "architecture.md");
            try { if (fs.existsSync(localPath)) { archContent = fs.readFileSync(localPath, "utf-8"); } } catch {}
          }

          // Try 2: GitHub download
          if (!archContent) {
            try {
              const ghUrl = `https://raw.githubusercontent.com/frootai/frootai/main/solution-plays/${play.dir}/architecture.md`;
              const res = await fetch(ghUrl, { headers: { "User-Agent": "FrootAI-VSCode" } });
              if (res.ok) { archContent = await res.text(); }
            } catch {}
          }

          // Convert markdown to HTML — replace Mermaid with visual HTML diagram
          let bodyHtml = "";
          if (archContent) {
            // Extract mermaid block and convert to styled HTML
            const mermaidMatch = archContent.match(/```mermaid[\r\n]+([\s\S]*?)```/);
            let mermaidHtml = "";
            if (mermaidMatch) {
              const mermaidSrc = mermaidMatch[1];
              // Parse nodes from mermaid source
              const nodes: {id:string, label:string, group:string}[] = [];
              const links: {from:string, to:string, label:string}[] = [];
              const styles: Record<string, string> = {};
              let currentGroup = "";

              for (const line of mermaidSrc.split(/\r?\n/)) {
                const trimmed = line.trim();
                const subMatch = trimmed.match(/subgraph\s+(.+)/);
                if (subMatch) { currentGroup = subMatch[1]; continue; }
                if (trimmed === "end") { currentGroup = ""; continue; }
                const nodeMatch = trimmed.match(/(\w+)\[(.+?)\]/);
                if (nodeMatch && !trimmed.includes("-->")) {
                  nodes.push({ id: nodeMatch[1], label: nodeMatch[2].replace(/<br\/>/g, " — "), group: currentGroup });
                }
                const linkMatch = trimmed.match(/(\w+)\s*-->(?:\|(.+?)\|)?\s*(\w+)/);
                if (linkMatch) {
                  links.push({ from: linkMatch[1], to: linkMatch[3], label: linkMatch[2] || "" });
                }
                const styleMatch = trimmed.match(/style\s+(\w+)\s+fill:(#\w+)/);
                if (styleMatch) { styles[styleMatch[1]] = styleMatch[2]; }
              }

              // Group nodes by subgraph
              const groups: Record<string, typeof nodes> = {};
              for (const n of nodes) {
                const g = n.group || "Other";
                if (!groups[g]) groups[g] = [];
                groups[g].push(n);
              }

              const groupColors: Record<string, string> = {
                "User Layer": "#3b82f6", "Application Layer": "#06b6d4",
                "AI Layer": "#10b981", "Data Layer": "#f59e0b", "Monitoring": "#0ea5e9",
              };

              let groupsHtml = "";
              for (const [gName, gNodes] of Object.entries(groups)) {
                const color = groupColors[gName] || "#6b7280";
                const nodesHtml = gNodes.map(n =>
                  `<div style="padding:8px 14px;border-radius:6px;border:1px solid ${styles[n.id] || color};background:${(styles[n.id] || color)}18;font-size:12px;text-align:center;min-width:120px">
                    <div style="font-weight:600;color:${styles[n.id] || color}">${n.label.split(" — ")[0]}</div>
                    ${n.label.includes(" — ") ? `<div style="font-size:10px;opacity:0.7;margin-top:2px">${n.label.split(" — ")[1]}</div>` : ""}
                  </div>`
                ).join("");
                groupsHtml += `<div style="padding:12px;border:1px solid ${color}30;border-radius:8px;background:${color}08;margin-bottom:8px">
                  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${color};margin-bottom:8px">${gName}</div>
                  <div style="display:flex;flex-wrap:wrap;gap:8px">${nodesHtml}</div>
                </div>`;
              }

              // Build connections list
              const connectionsHtml = links.map(l => {
                const fromNode = nodes.find(n => n.id === l.from);
                const toNode = nodes.find(n => n.id === l.to);
                return `<div style="font-size:11px;padding:3px 0;opacity:0.8">${fromNode?.label.split(" — ")[0] || l.from} → ${toNode?.label.split(" — ")[0] || l.to}${l.label ? ` <span style="opacity:0.5">(${l.label})</span>` : ""}</div>`;
              }).join("");

              mermaidHtml = `<div style="margin:16px 0">
                <div style="background:#252526;padding:16px;border-radius:8px">${groupsHtml}</div>
                <details style="margin-top:12px"><summary style="cursor:pointer;font-size:12px;opacity:0.7">Show ${links.length} connections</summary>
                <div style="padding:8px 12px;background:#252526;border-radius:6px;margin-top:4px">${connectionsHtml}</div></details>
                <details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px;opacity:0.7">Mermaid source (copy to mermaid.live)</summary>
                <pre style="padding:12px;background:#252526;border-radius:6px;font-size:10px;margin-top:4px;overflow-x:auto">${mermaidSrc}</pre></details>
              </div>`;
            }

            // Convert rest of markdown (skip mermaid block)
            const mdWithoutMermaid = archContent.replace(/```mermaid[\r\n]+[\s\S]*?```/, "MERMAID_PLACEHOLDER");
            bodyHtml = mdWithoutMermaid
              .replace(/^### (.+)$/gm, '<h3>$1</h3>')
              .replace(/^## (.+)$/gm, '<h2>$1</h2>')
              .replace(/^# (.+)$/gm, '<h1>$1</h1>')
              .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
              .replace(/`([^`]+)`/g, '<code>$1</code>')
              .replace(/^- (.+)$/gm, '<li>$1</li>')
              .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
              .replace(/\n\n/g, '</p><p>')
              .replace(/\|(.+)\|/g, (match: string) => {
                const cells = match.split('|').filter((c: string) => c.trim()).map((c: string) => c.trim());
                if (cells.every((c: string) => /^[-:]+$/.test(c))) return '';
                return '<tr>' + cells.map((c: string) => `<td style="padding:6px 10px;border-bottom:1px solid #333">${c}</td>`).join('') + '</tr>';
              })
              .replace(/```\w*\n([\s\S]*?)```/g, '<pre style="background:#252526;padding:12px;border-radius:6px;font-size:11px;overflow-x:auto;margin:8px 0">$1</pre>')
              .replace("MERMAID_PLACEHOLDER", mermaidHtml);
          } else {
            // Fallback: show services from play.infra
            const svcs = (play.infra || "Azure OpenAI · Container Apps").split("·").map((s: string) => s.trim());
            bodyHtml = `<p>Architecture details not found for this play.</p>
              <h2>Services (${svcs.length})</h2>
              <ul>${svcs.map((s: string) => `<li>${s}</li>`).join("")}</ul>
              <p style="opacity:0.6">Create <code>architecture.md</code> in the solution play folder for detailed architecture documentation.</p>`;
          }

          const diagramPanel = vscode.window.createWebviewPanel(
            "frootai.diagram", `Architecture — ${play.name}`, vscode.ViewColumn.One,
            { enableScripts: false }
          );
          diagramPanel.webview.html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
body{background:#1e1e1e;color:#ccc;font-family:system-ui;padding:24px;line-height:1.7;max-width:900px;margin:0 auto}
h1{font-size:22px;margin:0 0 8px;border-bottom:2px solid #454545;padding-bottom:8px}
h2{font-size:17px;margin:28px 0 12px;border-bottom:1px solid #454545;padding-bottom:6px;color:#e0e0e0}
h3{font-size:14px;margin:20px 0 8px;color:#ccc}
p{margin:8px 0;font-size:13px}
code{background:#2a2d2e;padding:1px 5px;border-radius:3px;font-size:12px}
li{margin:4px 0;font-size:13px}
ul,ol{padding-left:20px;margin:8px 0}
table{width:100%;border-collapse:collapse;margin:8px 0}
tr:hover{background:#2a2d2e}
strong{color:#e8e8e8}
.note{font-size:11px;opacity:0.5;margin-top:24px;border-top:1px solid #333;padding-top:12px}
</style></head><body>
${bodyHtml}
<a class="link-btn" href="https://github.com/frootai/frootai/blob/main/solution-plays/${play.dir}/README.md" target="_blank">View rendered Mermaid diagram on GitHub ↗</a>
<p class="note">Source: solution-plays/${play.dir}/architecture.md — single source of truth for GitHub, VS Code, and website.</p>
</body></html>`;
          break;
        }

        // Evaluation: use legacy command
        case "runEvaluation": vscode.commands.executeCommand("frootai.runEvaluation"); break;
      }
      } catch (e: any) {
        console.error(`FrootAI PlayDetail error: ${e.message}`);
        vscode.window.showErrorMessage(`FrootAI: ${msg.command} failed — ${e.message}`);
      }
    });
  });

  safeRegister("frootai.openEvaluationDashboard", () => {
    // E2: Scan workspace for real evaluation data
    const evalData = scanWorkspaceEvalData();
    const panel = createReactPanel(context.extensionUri, "frootai.evaluation", "Evaluation Dashboard", { panel: "evaluation", evalData } as any);
    panel.webview.onDidReceiveMessage((msg: any) => {
      switch (msg.command) {
        case "runEvaluation":
          vscode.commands.executeCommand("frootai.runEvaluation");
          break;
        case "scanWorkspace": {
          const refreshed = scanWorkspaceEvalData();
          panel.webview.postMessage({ type: "update", data: { panel: "evaluation", evalData: refreshed } });
          vscode.window.showInformationMessage(refreshed.hasRealData
            ? `Found evaluation data: ${refreshed.resultFiles?.length ?? 0} result file(s)`
            : "No evaluation data found. Create evaluation/eval-config.json to get started.");
          break;
        }
        case "viewDemo": {
          panel.webview.postMessage({ type: "update", data: { panel: "evaluation", evalData: undefined } });
          break;
        }
        case "createEvalConfig": {
          const ws = vscode.workspace.workspaceFolders?.[0];
          if (!ws) { vscode.window.showWarningMessage("Open a workspace first."); break; }
          const evalDir = path.join(ws.uri.fsPath, "evaluation");
          if (!fs.existsSync(evalDir)) fs.mkdirSync(evalDir, { recursive: true });
          const configFile = path.join(evalDir, "eval-config.json");
          if (!fs.existsSync(configFile)) {
            fs.writeFileSync(configFile, JSON.stringify({
              metrics: ["groundedness", "relevance", "coherence", "fluency", "safety"],
              thresholds: { groundedness: 4.0, relevance: 4.0, coherence: 4.0, fluency: 4.0, safety: 4.0 },
              dataset: "evaluation/test-data.jsonl"
            }, null, 2));
          }
          vscode.window.showTextDocument(vscode.Uri.file(configFile));
          // Refresh panel
          const r = scanWorkspaceEvalData();
          panel.webview.postMessage({ type: "update", data: { panel: "evaluation", evalData: r } });
          break;
        }
        case "createEvalResults": {
          const ws = vscode.workspace.workspaceFolders?.[0];
          if (!ws) { vscode.window.showWarningMessage("Open a workspace first."); break; }
          const evalDir = path.join(ws.uri.fsPath, "evaluation");
          if (!fs.existsSync(evalDir)) fs.mkdirSync(evalDir, { recursive: true });
          const resultsFile = path.join(evalDir, "eval-results.json");
          if (!fs.existsSync(resultsFile)) {
            fs.writeFileSync(resultsFile, JSON.stringify({
              timestamp: new Date().toISOString(),
              scores: { groundedness: 4.5, relevance: 4.2, coherence: 4.3, fluency: 4.6, safety: 4.9 }
            }, null, 2));
          }
          vscode.window.showTextDocument(vscode.Uri.file(resultsFile));
          const r2 = scanWorkspaceEvalData();
          panel.webview.postMessage({ type: "update", data: { panel: "evaluation", evalData: r2 } });
          break;
        }
        case "exportJson":
          if (msg.scores) vscode.env.clipboard.writeText(JSON.stringify(msg.scores, null, 2)).then(() =>
            vscode.window.showInformationMessage("Scores copied to clipboard as JSON"));
          break;
        case "exportCsv":
          if (msg.scores) {
            const header = "metric,score,threshold,status\n";
            const rows = Object.entries(msg.scores as Record<string, number>).map(([k, v]) =>
              `${k},${v},4.0,${v >= 4.0 ? "PASS" : "FAIL"}`).join("\n");
            vscode.env.clipboard.writeText(header + rows).then(() =>
              vscode.window.showInformationMessage("Scores copied to clipboard as CSV"));
          }
          break;
      }
    });
  });

  safeRegister("frootai.openScaffoldWizard", (initialPlay?: any) => {
    const panel = createReactPanel(context.extensionUri, "frootai.scaffold", "Scaffold Wizard", { panel: "scaffold", plays: SOLUTION_PLAYS, initialPlay: initialPlay || null });
    panel.webview.onDidReceiveMessage((msg: any) => {
      if (msg.command === "scaffold") vscode.commands.executeCommand("frootai.initDevKit");
      if (msg.command === "openFolder") vscode.commands.executeCommand("vscode.openFolder");
    });
  });

  safeRegister("frootai.openMcpExplorer", () => {
    const panel = createReactPanel(context.extensionUri, "frootai.mcpExplorer", "MCP Tool Explorer", { panel: "mcpExplorer" });
    panel.webview.onDidReceiveMessage((msg: any) => {
      switch (msg.command) {
        case "copyToClipboard":
          vscode.env.clipboard.writeText(msg.text).then(() =>
            vscode.window.showInformationMessage("Copied to clipboard!"));
          break;
        case "tryTool":
          vscode.window.showInformationMessage(
            `MCP Tool "${msg.toolName}" — Run \`npx frootai-mcp@latest\` to start the server, then use @fai in Copilot Chat.`,
            "Copy Command"
          ).then(sel => {
            if (sel === "Copy Command") vscode.env.clipboard.writeText("npx frootai-mcp@latest");
          });
          break;
        case "openUrl":
          if (msg.url) vscode.env.openExternal(vscode.Uri.parse(msg.url));
          break;
      }
    });
  });

  // ─── Play Browser: browse all plays with search, categories, pagination ───
  safeRegister("frootai.browsePlays", () => {
    const panel = createReactPanel(context.extensionUri, "frootai.playBrowser", "Solution Plays", { panel: "playBrowser", plays: SOLUTION_PLAYS });
    setupNavigationHandler(panel, context);
  });

  // ─── Solution Configurator: 3-question wizard ───
  safeRegister("frootai.openConfigurator", () => {
    const panel = createReactPanel(context.extensionUri, "frootai.configurator", "Solution Configurator", { panel: "configurator", plays: SOLUTION_PLAYS });
    setupNavigationHandler(panel, context);
  });

  // ─── Welcome Panel ───
  safeRegister("frootai.openWelcome", () => {
    const panel = createReactPanel(context.extensionUri, "frootai.welcome", "Welcome to FrootAI", { panel: "welcome" });
    panel.webview.onDidReceiveMessage((msg: any) => {
      switch (msg.command) {
        case "browsePlays": vscode.commands.executeCommand("frootai.browsePlays"); break;
        case "searchAll": vscode.commands.executeCommand("frootai.searchAll"); break;
        case "mcpExplorer": vscode.commands.executeCommand("frootai.openMcpExplorer"); break;
        case "evaluation": vscode.commands.executeCommand("frootai.openEvaluationDashboard"); break;
        case "scaffold": vscode.commands.executeCommand("frootai.openScaffoldWizard"); break;
        case "configurator": vscode.commands.executeCommand("frootai.openConfigurator"); break;
        case "primitivesCatalog": vscode.commands.executeCommand("frootai.openPrimitivesCatalog"); break;
        case "openPrimitives": vscode.commands.executeCommand("frootai.openPrimitivesCatalog"); break;
        case "openAgentFai": vscode.commands.executeCommand("frootai.openAgentFai"); break;
        case "openMarketplace": vscode.commands.executeCommand("frootai.openMarketplace"); break;
        case "openProtocol": vscode.commands.executeCommand("frootai.openProtocolExplainer"); break;
        case "openUrl": if (msg.url) vscode.env.openExternal(vscode.Uri.parse(msg.url)); break;
      }
    });
  });

  // ─── Primitives Catalog Panel ───
  safeRegister("frootai.openPrimitivesCatalog", () => {
    const dataDir = path.join(context.extensionPath, "data");
    const loadJSON = (name: string) => {
      try { return JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf-8")); }
      catch { return []; }
    };
    const primitives = {
      agents: loadJSON("agents.json"),
      skills: loadJSON("skills.json"),
      instructions: loadJSON("instructions.json"),
      hooks: loadJSON("hooks.json"),
      plugins: loadJSON("plugins.json"),
    };
    const total = Object.values(primitives).reduce((s: number, a: any[]) => s + a.length, 0);
    const panel = createReactPanel(context.extensionUri, "frootai.primitivesCatalog", `FAI Primitives (${total})`, { panel: "primitivesCatalog" as any, primitives });
    panel.webview.onDidReceiveMessage(async (msg: any) => {
      if (msg.command === "openUrl" && msg.url) {
        vscode.env.openExternal(vscode.Uri.parse(msg.url));
      }
      if (msg.command === "installPrimitive" && msg.primitiveType && msg.primitiveId) {
        // Download primitive file(s) from GitHub into workspace
        const folders = vscode.workspace.workspaceFolders;
        if (!folders) {
          vscode.window.showWarningMessage("Open a workspace folder first to install primitives.");
          return;
        }
        const wsRoot = folders[0].uri.fsPath;
        const typeConfig: Record<string, { destDir: string; repoPath: string; ext: string }> = {
          agents:       { destDir: ".github/agents",       repoPath: "agents",       ext: ".agent.md" },
          instructions: { destDir: ".github/instructions", repoPath: "instructions", ext: ".instructions.md" },
          skills:       { destDir: ".github/skills",       repoPath: "skills",       ext: "" },
          hooks:        { destDir: ".github/hooks",        repoPath: "hooks",        ext: "" },
          plugins:      { destDir: ".github/plugins",       repoPath: "plugins",           ext: "" },
        };
        const cfg = typeConfig[msg.primitiveType];
        if (!cfg) return;

        const destDir = path.join(wsRoot, cfg.destDir);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: `Installing ${msg.primitiveType.slice(0, -1)}: ${msg.primitiveId}...`, cancellable: false },
          async () => {
            try {
              // For single-file primitives (agents, instructions)
              if (cfg.ext) {
                const file = msg.file || `${cfg.repoPath}/${msg.primitiveId}${cfg.ext}`;
                const url = `https://raw.githubusercontent.com/frootai/frootai/main/${file}`;
                const resp = await fetch(url, { headers: { "User-Agent": "FrootAI-VSCode" } });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const content = await resp.text();
                const destFile = path.join(destDir, `${msg.primitiveId}${cfg.ext}`);
                fs.writeFileSync(destFile, content, "utf-8");
                vscode.window.showInformationMessage(`✅ Installed ${msg.primitiveId}${cfg.ext} → ${cfg.destDir}/`);
                vscode.commands.executeCommand("frootai.trackRecentPrimitive", msg.primitiveType, msg.primitiveId, msg.primitiveId);
              } else {
                // For folder-based primitives (skills, hooks, plugins) — download primary file
                const primaryFiles: Record<string, string> = {
                  skills: "SKILL.md",
                  hooks: "hooks.json",
                  plugins: "plugin.json",
                };
                const primaryFile = primaryFiles[msg.primitiveType] || "README.md";
                const folderName = msg.folder ? path.basename(msg.folder) : msg.primitiveId;
                // Use folder field as repo path if available (handles plugins/ vs community-plugins/)
                const repoFolder = msg.folder ? msg.folder.replace(/\/+$/, "") : `${cfg.repoPath}/${folderName}`;
                const repoFile = `${repoFolder}/${primaryFile}`;
                const url = `https://raw.githubusercontent.com/frootai/frootai/main/${repoFile}`;
                const resp = await fetch(url, { headers: { "User-Agent": "FrootAI-VSCode" } });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const content = await resp.text();
                const primDir = path.join(destDir, folderName);
                if (!fs.existsSync(primDir)) fs.mkdirSync(primDir, { recursive: true });
                fs.writeFileSync(path.join(primDir, primaryFile), content, "utf-8");
                vscode.window.showInformationMessage(`✅ Installed ${folderName}/${primaryFile} → ${cfg.destDir}/${folderName}/`);
                vscode.commands.executeCommand("frootai.trackRecentPrimitive", msg.primitiveType, msg.primitiveId, folderName);
              }
            } catch (err: any) {
              vscode.window.showErrorMessage(`Failed to install ${msg.primitiveId}: ${err.message}`);
            }
          }
        );
      }
    });
  });

  // ─── Aliases for backward-compatible commands ───
  safeRegister("frootai.browsePrimitives", () => vscode.commands.executeCommand("frootai.openPrimitivesCatalog"));

  // ─── Install Agent via vscode:// protocol ───
  safeRegister("frootai.installAgent", async () => {
    const agents = (() => {
      try { return JSON.parse(fs.readFileSync(path.join(context.extensionPath, "data", "agents.json"), "utf-8")); } catch { return []; }
    })();
    const picked = await vscode.window.showQuickPick(
      agents.map((a: any) => ({ label: a.name || a.id, description: a.description, id: a.id, file: a.file })),
      { placeHolder: "Select an agent to install in VS Code Copilot Chat", matchOnDescription: true }
    );
    if (picked) {
      const rawUrl = `https://raw.githubusercontent.com/frootai/frootai/main/${(picked as any).file || `agents/${(picked as any).id}.agent.md`}`;
      const uri = `vscode://github.copilot-chat/createAgent?url=${encodeURIComponent(rawUrl)}`;
      vscode.env.openExternal(vscode.Uri.parse(uri));
    }
  });

  // ─── Install Instruction via vscode:// protocol ───
  safeRegister("frootai.installInstruction", async () => {
    const instructions = (() => {
      try { return JSON.parse(fs.readFileSync(path.join(context.extensionPath, "data", "instructions.json"), "utf-8")); } catch { return []; }
    })();
    const picked = await vscode.window.showQuickPick(
      instructions.map((i: any) => ({ label: i.name || i.id, description: i.description, id: i.id, file: i.file })),
      { placeHolder: "Select an instruction to install", matchOnDescription: true }
    );
    if (picked) {
      const rawUrl = `https://raw.githubusercontent.com/frootai/frootai/main/${(picked as any).file || `instructions/${(picked as any).id}.instructions.md`}`;
      const uri = `vscode://github.copilot-chat/createAgent?url=${encodeURIComponent(rawUrl)}`;
      vscode.env.openExternal(vscode.Uri.parse(uri));
    }
  });

  // ─── Agent FAI Chat Panel ───
  safeRegister("frootai.openAgentFai", () => {
    const panel = createReactPanel(context.extensionUri, "frootai.agentFai", "Agent FAI", { panel: "agentFai" as any });
    panel.webview.onDidReceiveMessage((msg: any) => {
      switch (msg.command) {
        case "openPlay": {
          const play = SOLUTION_PLAYS.find(p => p.id === msg.playId || p.id.startsWith(msg.playId));
          if (play) vscode.commands.executeCommand("frootai.openPlayDetail", play);
          break;
        }
        case "openConfigurator": vscode.commands.executeCommand("frootai.openConfigurator"); break;
        case "browsePlays": vscode.commands.executeCommand("frootai.browsePlays"); break;
        case "openSetup": vscode.commands.executeCommand("frootai.openSetupGuide"); break;
        case "openPrimitives": vscode.commands.executeCommand("frootai.openPrimitivesCatalog"); break;
        case "openMarketplace": vscode.commands.executeCommand("frootai.openMarketplace"); break;
        case "openUrl": if (msg.url) vscode.env.openExternal(vscode.Uri.parse(msg.url)); break;
      }
    });
  });

  // ─── Marketplace → redirect to Primitives Catalog ───
  safeRegister("frootai.openMarketplace", () => {
    vscode.commands.executeCommand("frootai.openPrimitivesCatalog");
  });

  // ─── FAI Protocol & Architecture Panel (D1-D3) ───
  safeRegister("frootai.openProtocolExplainer", () => {
    const panel = createReactPanel(context.extensionUri, "frootai.protocolExplainer", "FAI Ecosystem", { panel: "protocolExplainer" as any });
    panel.webview.onDidReceiveMessage((msg: any) => {
      switch (msg.command) {
        case "openUrl":
          if (msg.url) vscode.env.openExternal(vscode.Uri.parse(msg.url));
          break;
        case "openSchema": {
          const schemaPath = path.join(context.extensionPath, "..", "..", "..", "schemas", `${msg.schema}.schema.json`);
          // Try workspace first, then fallback to GitHub
          const ws = vscode.workspace.workspaceFolders?.[0];
          const localSchema = ws ? path.join(ws.uri.fsPath, "schemas", `${msg.schema}.schema.json`) : "";
          if (localSchema && fs.existsSync(localSchema)) {
            vscode.window.showTextDocument(vscode.Uri.file(localSchema));
          } else {
            vscode.env.openExternal(vscode.Uri.parse(`https://github.com/frootai/frootai/blob/main/schemas/${msg.schema}.schema.json`));
          }
          break;
        }
        case "openModule": {
          // Open knowledge module via Agent FAI
          vscode.commands.executeCommand("frootai.openAgentFai");
          break;
        }
      }
    });
  });

  // ─── Agent FAI Chat Participant ───
  try {
    const knowledgePath = path.join(context.extensionPath, "knowledge.json");
    let knowledge: any = {};
    try { knowledge = JSON.parse(fs.readFileSync(knowledgePath, "utf-8")); } catch {}

    const participant = vscode.chat.createChatParticipant("frootai.fai", async (request, chatContext, stream, token) => {
      const query = request.prompt.toLowerCase();

      stream.markdown("*Searching FrootAI knowledge base...*\n\n");

      // Search plays
      const matchedPlays = SOLUTION_PLAYS.filter(p => {
        const text = `${p.id} ${p.name} ${p.desc || ""} ${p.infra || ""} ${p.cat || ""}`.toLowerCase();
        return query.split(/\s+/).filter(w => w.length >= 2).some(w => text.includes(w));
      }).slice(0, 5);

      // Search modules
      const matchedModules: { id: string; name: string; snippet: string }[] = [];
      if (knowledge.modules) {
        for (const [id, mod] of Object.entries(knowledge.modules) as [string, any][]) {
          const text = `${mod.title || ""} ${(mod.content || "").substring(0, 500)}`.toLowerCase();
          if (query.split(/\s+/).filter((w: string) => w.length >= 2).some((w: string) => text.includes(w))) {
            matchedModules.push({ id, name: mod.title || id, snippet: (mod.content || "").substring(0, 200) });
          }
        }
      }

      // Build response
      if (matchedPlays.length > 0) {
        stream.markdown("## 🎯 Matching Solution Plays\n\n");
        for (const p of matchedPlays) {
          stream.markdown(`**${p.id} — ${p.name}** (${p.cx || "N/A"} complexity)\n`);
          stream.markdown(`> ${p.desc || p.tagline || ""}\n`);
          stream.markdown(`> Infrastructure: ${p.infra || "N/A"}\n\n`);
        }
      }

      if (matchedModules.length > 0) {
        stream.markdown("## 📚 Knowledge Modules\n\n");
        for (const m of matchedModules.slice(0, 3)) {
          stream.markdown(`**${m.id} — ${m.name}**\n`);
          stream.markdown(`> ${m.snippet.replace(/\n/g, " ")}...\n\n`);
        }
      }

      if (matchedPlays.length === 0 && matchedModules.length === 0) {
        stream.markdown("I couldn't find specific matches. Here are some things I can help with:\n\n");
        stream.markdown("- **Solution Plays**: Ask about RAG, agents, voice AI, security, infrastructure\n");
        stream.markdown("- **Architecture**: Ask about patterns, cost optimization, model selection\n");
        stream.markdown("- **Getting Started**: Ask how to scaffold, deploy, or evaluate\n");
        stream.markdown("- **MCP Tools**: Ask about the 45 available tools\n\n");
        stream.markdown("Try: *Which play should I use for a RAG pipeline?*\n");
      }

      stream.markdown("\n---\n*Powered by FrootAI Knowledge Engine — 18 modules, 101 plays, 200+ glossary terms*");
    });

    participant.iconPath = vscode.Uri.joinPath(context.extensionUri, "media", "frootai-mark.png");
    context.subscriptions.push(participant);
  } catch (e: any) {
    console.warn(`FrootAI: Chat participant not available — ${e.message}`);
  }

  // ─── First Install: Show Welcome panel ───
  const CURRENT_VERSION = "9.2.0";
  const lastVersion = context.globalState.get<string>("frootai.lastVersion");

  if (!lastVersion) {
    // First install — show Welcome panel
    vscode.commands.executeCommand("frootai.openWelcome");
    context.globalState.update("frootai.lastVersion", CURRENT_VERSION);
  } else if (lastVersion !== CURRENT_VERSION) {
    // Version update — show What's New
    context.globalState.update("frootai.lastVersion", CURRENT_VERSION);
    const CHANGELOG: string[] = [
      "🧩 Primitives Catalog — 823 primitives in a rich searchable webview with WAF & domain filters",
      "🔍 Domain filtering — 10 sub-categories (RAG, Azure, Security, Agent, DevOps, ...)",
      "⚡ One-click agent install — agents install directly into VS Code via protocol link",
      "📂 Detail view — full metadata, CLI command, GitHub link for every primitive",
    ];
    vscode.window.showInformationMessage(
      `FrootAI updated to v${CURRENT_VERSION}! ${CHANGELOG[0]}`,
      "View All Changes", "Open Welcome"
    ).then(choice => {
      if (choice === "View All Changes") {
        vscode.window.showInformationMessage(CHANGELOG.join("\n"), { modal: true });
      } else if (choice === "Open Welcome") {
        vscode.commands.executeCommand("frootai.openWelcome");
      }
    });
  }
  // ─── File Decorations for FAI files ───
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(new FaiFileDecorationProvider())
  );

  // ─── CodeLens for fai-manifest.json ───
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { pattern: "**/fai-manifest.json" },
      new FaiManifestCodeLensProvider()
    )
  );

  // ─── Workspace Play Detection — Status Bar ───
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusItem.command = "frootai.openDetectedPlay";
  context.subscriptions.push(statusItem);

  async function detectWorkspacePlay() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) { statusItem.hide(); return; }
    for (const folder of folders) {
      const manifestUri = vscode.Uri.joinPath(folder.uri, "fai-manifest.json");
      try {
        const raw = await vscode.workspace.fs.readFile(manifestUri);
        const manifest = JSON.parse(Buffer.from(raw).toString("utf-8"));
        const playId = manifest.play?.replace(/^(\d+).*/, "$1") || "";
        const play = SOLUTION_PLAYS.find(p => p.id === playId);
        statusItem.text = `$(zap) FAI Play ${playId}${play ? `: ${play.name}` : ""}`;
        statusItem.tooltip = play
          ? `${play.name} — ${play.desc}\nClick to open play detail`
          : `Play ${manifest.play} detected\nClick to open play detail`;
        statusItem.show();
        return;
      } catch { /* no manifest */ }
    }
    statusItem.hide();
  }

  detectWorkspacePlay();
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => detectWorkspacePlay()),
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (doc.fileName.endsWith("fai-manifest.json")) detectWorkspacePlay();
    })
  );

  safeRegister("frootai.openDetectedPlay", async () => {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return;
    for (const folder of folders) {
      const manifestUri = vscode.Uri.joinPath(folder.uri, "fai-manifest.json");
      try {
        const raw = await vscode.workspace.fs.readFile(manifestUri);
        const manifest = JSON.parse(Buffer.from(raw).toString("utf-8"));
        const playId = manifest.play?.replace(/^(\d+).*/, "$1") || "";
        const play = SOLUTION_PLAYS.find(p => p.id === playId);
        if (play) vscode.commands.executeCommand("frootai.openPlayDetail", play);
        else vscode.window.showInformationMessage(`Play ${manifest.play} detected but no detail available.`);
        return;
      } catch { /* no manifest */ }
    }
    vscode.window.showInformationMessage("No fai-manifest.json found in workspace.");
  });

  // ─── Diagnostics Provider for fai-manifest.json ───
  const diagCollection = vscode.languages.createDiagnosticCollection("frootai");
  context.subscriptions.push(diagCollection);

  const VALID_WAF_PILLARS = ["reliability", "security", "cost-optimization", "operational-excellence", "performance-efficiency", "responsible-ai"];

  function validateManifestDocument(doc: vscode.TextDocument) {
    if (!doc.fileName.endsWith("fai-manifest.json")) return;
    const diagnostics: vscode.Diagnostic[] = [];
    const text = doc.getText();

    let json: any;
    try {
      json = JSON.parse(text);
    } catch (e: any) {
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 1),
        `Invalid JSON: ${e.message}`,
        vscode.DiagnosticSeverity.Error
      ));
      diagCollection.set(doc.uri, diagnostics);
      return;
    }

    // Helper to find line of a key
    const findKeyLine = (key: string): number => {
      for (let i = 0; i < doc.lineCount; i++) {
        if (doc.lineAt(i).text.includes(`"${key}"`)) return i;
      }
      return 0;
    };

    // Required top-level fields
    for (const field of ["play", "version", "context", "primitives"]) {
      if (json[field] === undefined) {
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 1),
          `Missing required field: "${field}"`,
          vscode.DiagnosticSeverity.Error
        ));
      }
    }

    // Validate play format (NN-kebab-case)
    if (json.play && !/^\d{2}-[a-z0-9-]+$/.test(json.play)) {
      const line = findKeyLine("play");
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(line, 0, line, doc.lineAt(line).text.length),
        `Play ID should be NN-kebab-case (e.g., "01-enterprise-rag"), got "${json.play}"`,
        vscode.DiagnosticSeverity.Warning
      ));
    }

    // Validate version (semver)
    if (json.version && !/^\d+\.\d+\.\d+/.test(json.version)) {
      const line = findKeyLine("version");
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(line, 0, line, doc.lineAt(line).text.length),
        `Version should be semver (e.g., "1.0.0"), got "${json.version}"`,
        vscode.DiagnosticSeverity.Warning
      ));
    }

    // Validate WAF pillars
    const wafValues: string[] = json.context?.waf || [];
    const wafLine = findKeyLine("waf");
    for (const w of wafValues) {
      if (!VALID_WAF_PILLARS.includes(w)) {
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(wafLine, 0, wafLine, doc.lineAt(wafLine).text.length),
          `Invalid WAF pillar: "${w}". Valid: ${VALID_WAF_PILLARS.join(", ")}`,
          vscode.DiagnosticSeverity.Warning
        ));
      }
    }

    // Validate guardrails thresholds (0-1)
    const guardrails = json.guardrails || {};
    const guardLine = findKeyLine("guardrails");
    for (const [key, val] of Object.entries(guardrails)) {
      if (typeof val === "number" && (val < 0 || val > 1)) {
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(guardLine, 0, guardLine, doc.lineAt(guardLine).text.length),
          `Guardrail "${key}" threshold must be 0-1, got ${val}`,
          vscode.DiagnosticSeverity.Error
        ));
      }
    }

    // Validate primitives file references exist
    if (json.primitives && vscode.workspace.workspaceFolders?.[0]) {
      const wsRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const primLine = findKeyLine("primitives");
      for (const [primType, refs] of Object.entries(json.primitives)) {
        if (Array.isArray(refs)) {
          for (const ref of refs) {
            if (typeof ref === "string" && ref.startsWith("./")) {
              const fs = require("fs");
              const path = require("path");
              const fullPath = path.resolve(path.dirname(doc.fileName), ref);
              if (!fs.existsSync(fullPath)) {
                diagnostics.push(new vscode.Diagnostic(
                  new vscode.Range(primLine, 0, primLine, doc.lineAt(primLine).text.length),
                  `${primType}: referenced file not found — ${ref}`,
                  vscode.DiagnosticSeverity.Warning
                ));
              }
            }
          }
        }
      }
    }

    diagCollection.set(doc.uri, diagnostics);
  }

  // Run on open + save + change
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(validateManifestDocument),
    vscode.workspace.onDidSaveTextDocument(validateManifestDocument),
    vscode.workspace.onDidChangeTextDocument(e => validateManifestDocument(e.document))
  );
  // Validate already-open documents
  vscode.workspace.textDocuments.forEach(validateManifestDocument);

  // ─── Validate Manifest Command ───
  safeRegister("frootai.validateManifest", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith("fai-manifest.json")) {
      const uris = await vscode.workspace.findFiles("**/fai-manifest.json", "**/node_modules/**", 5);
      if (uris.length === 0) {
        vscode.window.showWarningMessage("No fai-manifest.json found in workspace.");
        return;
      }
      const pick = uris.length === 1 ? uris[0] : await vscode.window.showQuickPick(
        uris.map(u => ({ label: vscode.workspace.asRelativePath(u), uri: u })),
        { placeHolder: "Select manifest to validate" }
      ).then(p => p ? (p as any).uri : undefined);
      if (pick) {
        const doc = await vscode.workspace.openTextDocument(pick);
        await vscode.window.showTextDocument(doc);
        validateManifestDocument(doc);
      }
      return;
    }
    validateManifestDocument(editor.document);
    const diags = diagCollection.get(editor.document.uri);
    if (!diags || diags.length === 0) {
      vscode.window.showInformationMessage("✅ fai-manifest.json is valid — no issues found.");
    } else {
      const errors = diags.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
      const warnings = diags.filter(d => d.severity === vscode.DiagnosticSeverity.Warning).length;
      vscode.window.showWarningMessage(`fai-manifest.json: ${errors} error(s), ${warnings} warning(s). Check Problems panel.`);
    }
  });

  // ─── Context Menu: Open Play from fai-manifest.json ───
  safeRegister("frootai.openPlayFromManifest", async (fileUri?: vscode.Uri) => {
    const uri = fileUri || vscode.window.activeTextEditor?.document.uri;
    if (!uri) return;
    try {
      const raw = await vscode.workspace.fs.readFile(uri);
      const manifest = JSON.parse(Buffer.from(raw).toString("utf-8"));
      const playId = manifest.play?.replace(/^(\d+).*/, "$1") || "";
      const play = SOLUTION_PLAYS.find(p => p.id === playId);
      if (play) vscode.commands.executeCommand("frootai.openPlayDetail", play);
      else vscode.window.showInformationMessage(`Play "${manifest.play}" not found in catalog.`);
    } catch { vscode.window.showErrorMessage("Failed to parse fai-manifest.json"); }
  });

  // ─── Context Menu: Peek Agent/Skill definition ───
  safeRegister("frootai.peekFaiFile", async (fileUri?: vscode.Uri) => {
    const uri = fileUri || vscode.window.activeTextEditor?.document.uri;
    if (!uri) return;
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: true });
  });
}

// ─── File Decoration Provider ───
class FaiFileDecorationProvider implements vscode.FileDecorationProvider {
  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    const name = uri.path.split("/").pop() || "";
    const dir = uri.path.split("/").slice(-2, -1)[0] || "";

    // FAI Protocol files
    if (name === "fai-manifest.json") {
      return { badge: "FM", tooltip: "FAI Protocol Manifest — wiring context for this play", color: new vscode.ThemeColor("charts.green") };
    }
    if (name === "fai-context.json") {
      return { badge: "FC", tooltip: "FAI Context — LEGO block wiring", color: new vscode.ThemeColor("charts.blue") };
    }

    // Primitives
    if (name.endsWith(".agent.md")) {
      return { badge: "AG", tooltip: "FAI Agent definition", color: new vscode.ThemeColor("charts.green") };
    }
    if (name.endsWith(".instructions.md")) {
      return { badge: "IN", tooltip: "FAI Instructions file", color: new vscode.ThemeColor("charts.blue") };
    }
    if (name === "SKILL.md") {
      return { badge: "SK", tooltip: "FAI Skill definition", color: new vscode.ThemeColor("charts.purple") };
    }
    if (name === "hooks.json" && (dir === "hooks" || uri.path.includes(".github/hooks"))) {
      return { badge: "HK", tooltip: "FAI Hook definition", color: new vscode.ThemeColor("charts.orange") };
    }
    if (name.endsWith(".prompt.md") || (dir === "prompts" && name.endsWith(".md"))) {
      return { badge: "PR", tooltip: "FAI Prompt template", color: new vscode.ThemeColor("charts.yellow") };
    }
    if (name.endsWith(".yml") && dir === "workflows") {
      return { badge: "WF", tooltip: "FAI Workflow definition", color: new vscode.ThemeColor("charts.red") };
    }

    // Configuration & Infrastructure
    if ((name === "openai.json" || name === "guardrails.json") && dir === "config") {
      return { badge: "TK", tooltip: "TuneKit configuration", color: new vscode.ThemeColor("charts.orange") };
    }
    if (name.endsWith(".bicep") && dir === "infra") {
      return { badge: "IaC", tooltip: "Infrastructure as Code (Bicep)", color: new vscode.ThemeColor("charts.blue") };
    }

    // Evaluation
    if (dir === "evaluation" && (name.endsWith(".json") || name.endsWith(".py") || name.endsWith(".yaml"))) {
      return { badge: "EV", tooltip: "Evaluation pipeline file", color: new vscode.ThemeColor("charts.yellow") };
    }

    return undefined;
  }
}

// ─── CodeLens for fai-manifest.json ───
class FaiManifestCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];
    const topRange = new vscode.Range(0, 0, 0, 0);

    lenses.push(new vscode.CodeLens(topRange, {
      title: "$(checklist) Validate Manifest",
      command: "frootai.validateManifest",
      tooltip: "Validate this fai-manifest.json against the FAI Protocol schema",
    }));

    // Parse to show wiring summary
    try {
      const json = JSON.parse(document.getText());
      const playId = json.play || "unknown";
      const primCount = Object.values(json.primitives || {}).reduce((a: number, v: any) => a + (Array.isArray(v) ? v.length : 0), 0);
      const wafCount = (json.context?.waf || []).length;
      lenses.push(new vscode.CodeLens(topRange, {
        title: `$(info) Play: ${playId} · ${primCount} primitives · ${wafCount} WAF pillars`,
        command: "",
        tooltip: `Manifest for play ${playId}`,
      }));
    } catch {
      lenses.push(new vscode.CodeLens(topRange, {
        title: "$(warning) Invalid JSON — cannot parse manifest",
        command: "",
      }));
    }

    // Find "primitives" key for a lens on that line
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i).text;
      if (line.includes('"primitives"')) {
        lenses.push(new vscode.CodeLens(new vscode.Range(i, 0, i, 0), {
          title: "$(symbol-structure) View Wiring",
          command: "frootai.openWelcome",
          tooltip: "Open FrootAI to explore wired primitives",
        }));
        break;
      }
    }

    return lenses;
  }
}

/** Shared message handler for panels that support navigation between views */
function setupNavigationHandler(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
  panel.webview.onDidReceiveMessage(async (msg: any) => {
    switch (msg.command) {
      case "navigate":
        if (msg.panel === "playDetail" && msg.play) {
          // Update the panel to show play detail
          panel.title = `Play ${msg.play.id} — ${msg.play.name}`;
          panel.webview.postMessage({ type: "update", data: { panel: "playDetail", play: msg.play } });
        } else if (msg.panel === "playBrowser") {
          panel.title = "Solution Plays";
          panel.webview.postMessage({ type: "update", data: { panel: "playBrowser", plays: SOLUTION_PLAYS } });
        } else if (msg.panel === "configurator") {
          panel.title = "Solution Configurator";
          panel.webview.postMessage({ type: "update", data: { panel: "configurator", plays: SOLUTION_PLAYS } });
        }
        break;
      case "initDevKit":
        vscode.commands.executeCommand("frootai.initDevKit", msg.playId ? SOLUTION_PLAYS.find(p => p.id === msg.playId) : undefined);
        break;
      case "initTuneKit":
        vscode.commands.executeCommand("frootai.initTuneKit", msg.playId ? SOLUTION_PLAYS.find(p => p.id === msg.playId) : undefined);
        break;
      case "initSpecKit":
        vscode.commands.executeCommand("frootai.initSpecKit", msg.playId ? SOLUTION_PLAYS.find(p => p.id === msg.playId) : undefined);
        break;
      case "openUrl":
        if (msg.url) vscode.env.openExternal(vscode.Uri.parse(msg.url));
        break;
    }
  });
}

export function deactivate(): void {
  legacy.deactivate();
}
