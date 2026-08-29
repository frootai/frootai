import { useState } from "react";
import { BarChart3, BookOpen, Bot, Boxes, ChevronDown, Code2, Compass, Gauge, GitFork, Home, KeyRound, Layers3, Search, Settings2, ShieldCheck, Sparkles, Sprout, Workflow } from "lucide-react";

interface VsCodeApi { postMessage(message: unknown): void }
declare function acquireVsCodeApi(): VsCodeApi;
const vscode = acquireVsCodeApi();

const STAGES = [
  { id: "discover", number: "01", label: "Discover", summary: "Find grounded direction", color: "#10b981", Icon: Search, items: [
    ["Solution Configurator", "Turn an outcome into a starting point", Settings2, "/configurator"],
    ["Solution Accelerator", "1,083 source-backed implementations", Boxes, "/solution-accelerator"],
    ["Repository Intelligence", "Map this codebase and rank Plays", BarChart3, "/repository-intelligence"],
  ] },
  { id: "define", number: "02", label: "Define", summary: "Choose an architecture contract", color: "#f59e0b", Icon: Compass, items: [
    ["Solution Plays", "101 delivery contracts", Compass, "/solution-plays"],
    ["FROOT Modules", "16 modules across five layers", Layers3, "/docs"],
    ["AI Glossary A–Z", "200+ terms with FROOT context", BookOpen, "/glossary"],
  ] },
  { id: "develop", number: "03", label: "Develop", summary: "Compose behavior and trusted tools", color: "#06b6d4", Icon: Code2, items: [
    ["Agents", "Native personas and handoffs", Bot, "/primitives/agents"],
    ["Skills", "Reusable capability modules", Sparkles, "/primitives/skills"],
    ["Instructions", "Scoped behavioral directives", BookOpen, "/primitives/instructions"],
    ["Hooks", "Policy and lifecycle gates", ShieldCheck, "/primitives/hooks"],
    ["FAI MCP", "Federated trusted tool router", GitFork, "/mcp-tooling"],
    ["Scaffold a Project", "Create a preserving canonical DevKit", Code2, "/scaffold"],
  ] },
  { id: "govern", number: "04", label: "Govern", summary: "Control artifacts and handoffs", color: "#a78bfa", Icon: ShieldCheck, items: [
    ["FAI Orchard", "Govern source intelligence", Sprout, "/orchard"],
    ["FrootAI Studio", "Compose inspectable systems", Workflow, "/studio"],
    ["FAI Protocol", "Understand primitive wiring", Layers3, "/about"],
  ] },
  { id: "verify", number: "05", label: "Verify & improve", summary: "Measure evidence and fidelity", color: "#ec4899", Icon: Gauge, items: [
    ["Evaluation & Cost", "Quality gates and cost evidence", BarChart3, "/evaluation"],
    ["FAI TokenOps", "Local token and usage evidence", Gauge, "tokenops"],
    ["FAI Lab", "Evaluate exact artifacts", Sparkles, "/lab"],
    ["FAI Lean Mode", "Optimize measured fidelity", Gauge, "/lean"],
  ] },
] as const;

const PRIMARY_ACTIONS = [
  ["Home", "Open the FrootAI Workbench", Home, "/"],
  ["Connect Account", "Sign in and connect Agent FAI", KeyRound, "/account"],
  ["Ask Agent FAI", "Grounded ecosystem assistant", Bot, "/agent-fai"],
  ["Solution Plays", "101 complete delivery contracts", Compass, "/solution-plays"],
  ["Search FAI", "Search Plays, primitives, Docs, and Glossary", Search, "search"],
] as const;

export default function Sidebar() {
  const [open, setOpen] = useState<Set<string>>(() => {
    try { const raw = localStorage.getItem("fai-sidebar-stages-v2"); if (raw === null) return new Set(); const saved = JSON.parse(raw); return new Set(Array.isArray(saved) ? saved : []); }
    catch { return new Set(); }
  });
  const navigate = (route: string) => route === "tokenops" ? vscode.postMessage({ command: "frootai.tokenOps.openDashboard" }) : route === "search" ? vscode.postMessage({ command: "frootai.searchAll" }) : vscode.postMessage({ command: "frootai.openWelcome", args: [route] });
  const toggle = (id: string) => setOpen((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    localStorage.setItem("fai-sidebar-stages-v2", JSON.stringify([...next]));
    return next;
  });

  return <main className="stage-sidebar">
    <header>{(window as any).sidebarData?.logoUri ? <img className="stage-logo" src={(window as any).sidebarData.logoUri} alt="FrootAI" /> : <div className="stage-mark" />}<span><strong>Froot<span>AI</span></strong><small>Unified Fabric for AI</small></span></header>
    <nav className="stage-primary" aria-label="FrootAI primary actions">{PRIMARY_ACTIONS.map(([label, detail, Icon, route]) => <button key={label} onClick={() => navigate(route)}><Icon size={16} /><span><strong>{label}</strong><small>{detail}</small></span></button>)}</nav>
    <div className="stage-controls"><button onClick={() => { const all = new Set(STAGES.map((stage) => stage.id)); setOpen(all); localStorage.setItem("fai-sidebar-stages-v2", JSON.stringify([...all])); }}>Expand all</button><button onClick={() => { setOpen(new Set()); localStorage.setItem("fai-sidebar-stages-v2", "[]"); }}>Collapse all</button></div>
    <div className="stage-list">{STAGES.map((stage) => <section key={stage.id} style={{ "--stage-color": stage.color } as React.CSSProperties}>
      <button className="stage-header" aria-expanded={open.has(stage.id)} onClick={() => toggle(stage.id)}><span>{stage.number}</span><stage.Icon size={15} /><span><strong>{stage.label}</strong><small>{stage.summary}</small></span><ChevronDown size={13} /></button>
      <div className="stage-items" hidden={!open.has(stage.id)}>{stage.items.map(([label, detail, Icon, route]) => <button key={label} onClick={() => navigate(route)}><Icon size={15} /><span><strong>{label}</strong><small>{detail}</small></span></button>)}</div>
    </section>)}</div>
  </main>;
}
