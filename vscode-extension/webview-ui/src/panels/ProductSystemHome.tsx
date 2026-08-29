import { useState } from "react";
import {
  ArrowRight, Bot, Boxes, CircleDollarSign, CloudCog, Code2, Compass,
  FlaskConical, GitFork, Layers3, Package, Search, Settings2,
  ShieldCheck, Sparkles, Sprout, Workflow, BookOpen,
} from "lucide-react";
import { vscode } from "../vscode";
import type { AccountView } from "../types";

const STAGES = [
  { id: "discover", number: "01", label: "Discover", summary: "Configurator + Accelerator", detail: "Turn an outcome into a bounded starting point, then inspect implementation evidence.", handoff: "A grounded direction", color: "var(--fai-emerald)", Icon: Search, actions: [{ label: "FAI Configurator", command: "configurator" }, { label: "Solution Accelerators", command: "solutionAccelerator" }, { label: "Repository Intelligence", command: "repositoryIntelligence" }] },
  { id: "define", number: "02", label: "Define", summary: "Solution Plays", detail: "Choose a complete architecture contract with services, patterns, cost direction, and quality gates.", handoff: "An architecture contract", color: "var(--fai-amber)", Icon: Compass, actions: [{ label: "FAI Solution Plays", command: "browsePlays" }] },
  { id: "develop", number: "03", label: "Develop", summary: "Primitives + MCP + delivery", detail: "Compose reusable behavior and trusted tools without losing provenance or local control.", handoff: "An inspectable system", color: "var(--fai-cyan)", Icon: Code2, actions: [{ label: "FAI Primitives", command: "openPrimitives" }, { label: "FAI MCP", command: "mcpExplorer" }, { label: "Initialize Toolkit", command: "scaffold" }] },
  { id: "govern", number: "04", label: "Govern", summary: "FAI Orchard + Studio", detail: "Convert source into governed artifacts with explicit ownership, evidence, and controlled handoffs.", handoff: "A governed artifact", color: "var(--fai-violet)", Icon: ShieldCheck, actions: [{ label: "FAI Orchard", command: "orchard" }, { label: "FAI Studio", command: "studio" }] },
  { id: "verify", number: "05", label: "Verify & improve", summary: "Engine + Lab + Lean mode", detail: "Verify the exact artifact, inspect reproducible evidence, then optimize only against measured fidelity.", handoff: "A defensible, efficient system", color: "var(--fai-pink)", Icon: FlaskConical, actions: [{ label: "Evaluation", command: "evaluation" }, { label: "FAI Engine", command: "openProtocol" }, { label: "FAI Lab", command: "lab" }, { label: "FAI Lean Mode", command: "lean" }] },
] as const;

const PRODUCTS = [
  { label: "FAI Configurator", stage: "Discover", Icon: Settings2, command: "configurator" },
  { label: "FAI Solution Accelerator", stage: "Discover", Icon: Boxes, command: "solutionAccelerator" },
  { label: "FAI Repo Intelligence", stage: "Discover", Icon: Search, command: "repositoryIntelligence" },
  { label: "FAI Solution Plays", stage: "Define", Icon: Compass, command: "browsePlays" },
  { label: "FAI Primitives", stage: "Develop", Icon: Layers3, command: "openPrimitives" },
  { label: "FAI MCP", stage: "Develop", Icon: GitFork, command: "mcpExplorer" },
  { label: "Plugin Marketplace", stage: "Develop", Icon: Package, command: "openMarketplace" },
  { label: "FAI Orchard", stage: "Govern", Icon: Sprout, command: "orchard" },
  { label: "FAI Studio", stage: "Govern", Icon: Workflow, command: "studio" },
  { label: "FAI Engine", stage: "Verify", Icon: CloudCog, command: "openProtocol" },
  { label: "FAI Lab", stage: "Verify", Icon: FlaskConical, command: "lab" },
  { label: "FAI Lean Mode", stage: "Verify", Icon: Sparkles, command: "lean" },
  { label: "Evaluation & Cost", stage: "Verify", Icon: CircleDollarSign, command: "evaluation" },
  { label: "FAI Docs", stage: "Learn", Icon: BookOpen, command: "docs" },
  { label: "AI Glossary A–Z", stage: "Learn", Icon: BookOpen, command: "glossary" },
] as const;

export default function ProductSystemHome({ account }: { account?: AccountView }) {
  const [activeStage, setActiveStage] = useState(0);
  const logoUri = (window as any).panelData?.logoUri as string | undefined;
  const run = (command: string) => vscode.postMessage({ command });
  const stage = STAGES[activeStage];
  const moveStage = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % STAGES.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + STAGES.length) % STAGES.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = STAGES.length - 1;
    else return;
    event.preventDefault(); setActiveStage(next); requestAnimationFrame(() => document.getElementById(`fai-stage-tab-${STAGES[next].id}`)?.focus());
  };

  return (
    <main className="container fai-home">
      <section className="fai-home-hero">
        <div className="fai-home-identity">
          <div className="fai-home-emblem">{logoUri ? <img src={logoUri} alt="FrootAI" /> : <span className="fai-brand-mark" />}</div>
          <div>
            <p className="fai-eyebrow">From the roots to the fruits</p>
            <h1>Froot<span>AI</span></h1>
            <p className="fai-home-tagline">Unified Fabric for AI</p>
          </div>
        </div>
        <aside className="fai-terminal-card" aria-label="FAI system trace">
          <div>› FAI / SYSTEM TRACE</div>
          <p><span>◉ discover</span> source evidence</p>
          <p><span>◉ define</span> architecture contract</p>
          <p><span>◉ develop</span> composed behavior</p>
          <p><span>◉ govern</span> controlled artifact</p>
          <p><span>◉ verify</span> evidence + fidelity</p>
        </aside>
      </section>

      <div className="fai-home-actions">
        <button className="btn fai-home-primary" onClick={() => run("account")}><ShieldCheck size={14} /> {account?.configured ? `Account · ${account.status}` : "Connect Account"}</button>
        <button className="btn fai-home-primary" onClick={() => run("openProtocol")}>What is FrootAI? <ArrowRight size={13} /></button>
        <button className="btn fai-home-primary" onClick={() => run("openAgentFai")}><Bot size={14} /> Ask Agent FAI</button>
        <button className="btn fai-home-primary" onClick={() => run("browsePlays")}><Compass size={14} /> Solution Plays</button>
        <button className="btn btn-secondary" onClick={() => run("searchAll")}><Search size={14} /> Search FAI</button>
        <button className="btn btn-secondary" onClick={() => run("configurator")}><Settings2 size={14} /> Start Configurator</button>
        <button className="btn btn-secondary" onClick={() => run("docs")}><BookOpen size={14} /> Browse Docs</button>
        <button className="btn btn-secondary" onClick={() => run("glossary")}><BookOpen size={14} /> AI Glossary</button>
      </div>

      <section className="fai-system-map">
        <header><span className="fai-eyebrow">FAI System Map</span><span>Infrastructure · Platform · Applications</span></header>
        <div className="fai-system-stage-grid">
          <div className="fai-system-stage-tabs" role="tablist" aria-label="FrootAI delivery stages">
            {STAGES.map((item, index) => <button key={item.id} id={`fai-stage-tab-${item.id}`} role="tab" tabIndex={index === activeStage ? 0 : -1} aria-selected={index === activeStage} aria-controls={`fai-stage-${item.id}`} onClick={() => setActiveStage(index)} onKeyDown={(event) => moveStage(event, index)} className={index === activeStage ? "active" : ""} style={{ "--stage-color": item.color } as React.CSSProperties}><span>{item.number}</span><item.Icon size={14} /><small>{item.label}</small><strong>{item.summary}</strong></button>)}
          </div>
          <div className="fai-stage-panel" data-stage-index={activeStage} id={`fai-stage-${stage.id}`} role="tabpanel" aria-labelledby={`fai-stage-tab-${stage.id}`} style={{ "--stage-color": stage.color } as React.CSSProperties}>
            <div className="fai-stage-detail">
              <div><span className="fai-eyebrow">Stage {stage.number}</span><h2>{stage.label}</h2></div>
              <p>{stage.detail}</p>
              <div><span className="fai-eyebrow">Handoff</span><strong>{stage.handoff}</strong></div>
            </div>
            <div className="fai-stage-actions">{stage.actions.map(action => <button key={action.label} className="btn btn-secondary" onClick={() => run(action.command)}>{action.label}</button>)}</div>
          </div>
        </div>
        <footer><span className="fai-eyebrow">Delivery surfaces</span><span>Web · VS Code · MCP · npm · PyPI · CLI · Docker</span></footer>
      </section>

      <section className="fai-product-directory">
        <div><p className="fai-eyebrow">FAI Products</p><h2>One system. Native surfaces.</h2><p>Use the same product language and delivery stages in VS Code without turning the editor into an embedded website.</p></div>
        <div className="fai-product-grid">{PRODUCTS.map(product => <button key={product.label} onClick={() => run(product.command)}><product.Icon size={16} /><span><strong>{product.label}</strong><small>{product.stage}</small></span><ArrowRight size={12} /></button>)}</div>
      </section>
    </main>
  );
}
