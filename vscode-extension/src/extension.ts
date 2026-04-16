// FrootAI VS Code Extension v6.2.1
// Legacy extension.js handles tree views + 25 commands.
// This TS entry point adds React webview panel commands on top.

import * as vscode from "vscode";
import { searchAll } from "./commands/search";
import { createReactPanel } from "./webviews/reactHost";
import { SOLUTION_PLAYS } from "./data/plays";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const legacy = require("./extension.js");

let _activated = false;

export function activate(context: vscode.ExtensionContext): void {
  if (_activated) return;
  _activated = true;

  // Legacy handles tree views + existing commands
  legacy.activate(context);

  // New React panel commands — safe registration (skip if already exists)
  const safeRegister = (id: string, fn: (...args: any[]) => any) => {
    try { context.subscriptions.push(vscode.commands.registerCommand(id, fn)); }
    catch { /* already registered by legacy — OK */ }
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
    });
  });

  safeRegister("frootai.openEvaluationDashboard", () => {
    const panel = createReactPanel(context.extensionUri, "frootai.evaluation", "Evaluation Dashboard", { panel: "evaluation" });
    panel.webview.onDidReceiveMessage((msg: any) => {
      if (msg.command === "runEvaluation") vscode.commands.executeCommand("frootai.runEvaluation");
      if (msg.command === "exportJson") vscode.env.clipboard.writeText(JSON.stringify(msg.scores, null, 2)).then(() => vscode.window.showInformationMessage("Scores copied to clipboard as JSON"));
      if (msg.command === "exportCsv") {
        const header = "metric,score,threshold,status\n";
        const rows = Object.entries(msg.scores as Record<string, number>).map(([k, v]) => `${k},${v},4.0,${v >= 4.0 ? "PASS" : "FAIL"}`).join("\n");
        vscode.env.clipboard.writeText(header + rows).then(() => vscode.window.showInformationMessage("Scores copied to clipboard as CSV"));
      }
    });
  });

  safeRegister("frootai.openScaffoldWizard", () => {
    const panel = createReactPanel(context.extensionUri, "frootai.scaffold", "Scaffold Wizard", { panel: "scaffold", plays: SOLUTION_PLAYS });
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
          vscode.window.showInformationMessage(`MCP Tool "${msg.toolName}" — connect an MCP server to execute live. Params: ${JSON.stringify(msg.params)}`);
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
        case "openUrl": if (msg.url) vscode.env.openExternal(vscode.Uri.parse(msg.url)); break;
      }
    });
  });

  // ─── First Install: Show Welcome panel ───
  const CURRENT_VERSION = "9.0.0";
  const lastVersion = context.globalState.get<string>("frootai.lastVersion");

  if (!lastVersion) {
    // First install — show Welcome panel
    vscode.commands.executeCommand("frootai.openWelcome");
    context.globalState.update("frootai.lastVersion", CURRENT_VERSION);
  } else if (lastVersion !== CURRENT_VERSION) {
    // Version update — show What's New
    context.globalState.update("frootai.lastVersion", CURRENT_VERSION);
    const CHANGELOG: string[] = [
      "🧪 MCP Tool Explorer with Try It — test tools inline with schema-aware forms",
      "📊 Evaluation trends with sparklines and delta badges",
      "⏱️ Recently Used section in Solution Plays tree",
      "📋 Enhanced walkthrough guides with tables and tips",
      "🎉 Welcome panel for new users",
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
}

// ─── File Decoration Provider ───
class FaiFileDecorationProvider implements vscode.FileDecorationProvider {
  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    const name = uri.path.split("/").pop() || "";
    if (name === "fai-manifest.json") {
      return { badge: "⚡", tooltip: "FAI Protocol Manifest — wiring context for this play", color: new vscode.ThemeColor("charts.green") };
    }
    if (name.endsWith(".agent.md")) {
      return { badge: "🤖", tooltip: "FAI Agent definition" };
    }
    if (name.endsWith(".instructions.md")) {
      return { badge: "📋", tooltip: "FAI Instructions file" };
    }
    if (name === "fai-context.json") {
      return { badge: "🧩", tooltip: "FAI Context — LEGO block wiring" };
    }
    if (name === "SKILL.md") {
      return { badge: "⚙️", tooltip: "FAI Skill definition" };
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
      title: "$(zap) Validate Manifest",
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
