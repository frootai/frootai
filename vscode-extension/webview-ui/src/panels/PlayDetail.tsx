import Badge from "../components/Badge";
import WafPills from "../components/WafPills";
import { vscode } from "../vscode";
import { FileText, LayoutList, Shield, Zap, BookOpen, Puzzle, Layers, Link2, Package, Wrench, BarChart3, ChevronRight, ExternalLink } from "lucide-react";

const LAYER_NAMES: Record<string, string> = { F: "Foundations", R: "Reasoning", O: "Orchestration", T: "Transformation" };
const CX_COLORS: Record<string, string> = { Foundation: "#0ea5e9", Low: "#10b981", Medium: "#f59e0b", High: "#ef4444", "Very High": "#7c3aed" };

const Icon = ({ children }: { children: React.ReactNode }) => (
  <span style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 6, opacity: 0.7 }}>{children}</span>
);

interface Play {
  id: string; name: string; codicon?: string; icon?: string; dir: string;
  layer: string; status?: string; desc?: string; cx?: string; infra?: string;
}
interface Props { play?: Play; }

export default function PlayDetail({ play }: Props) {
  const p = play ?? { id: "01", name: "Enterprise RAG Q&A", dir: "01-enterprise-rag", layer: "R", desc: "Production RAG pipeline", cx: "Medium", infra: "AI Search · Azure OpenAI" };
  const layerName = LAYER_NAMES[p.layer] ?? p.layer;
  const cx = p.cx ?? "Medium";
  const cxColor = CX_COLORS[cx] ?? "#6b7280";
  const logoUri = (window as any).panelData?.logoUri;
  const cmd = (command: string) => vscode.postMessage({ command, playId: p.id, playDir: p.dir });
  const openUrl = (url: string) => vscode.postMessage({ command: "openUrl", url });

  return (
    <div className="container">
      {/* FrootAI branding */}
      <div style={{ textAlign: "center", padding: "16px 16px 8px" }}>
        {logoUri && <img src={logoUri} alt="FrootAI" style={{ width: 48, height: 48, marginBottom: 8 }} />}
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>
          <span style={{ color: "var(--vscode-foreground)" }}>Froot</span><span style={{ color: "#10b981" }}>AI</span>
        </div>
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>From the Roots to the Fruits — The Open Glue for GenAI</div>
        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>We unify agents, instructions, skills, hooks, and guardrails into connected solution plays</div>
      </div>

      {/* Hero */}
      <div className="hero">
        <h1>Play {p.id} — {p.name}</h1>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
          <Badge label={cx} color={cxColor} />
          <Badge label={layerName} color="#6b7280" />
        </div>
      </div>

      {/* Description */}
      <div className="section">
        <div className="section-title"><Icon><FileText size={16} /></Icon> What This Play Does</div>
        <p style={{ fontSize: 13, lineHeight: 1.8, opacity: 0.9 }}>{p.desc || "A pre-architected AI solution ready to scaffold and deploy on Azure."}</p>
        {p.infra && (
          <div style={{ marginTop: 10 }}>
            <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 600, display: "block", marginBottom: 6 }}>Azure Services</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {p.infra.split("·").map((s: string) => (
                <span key={s.trim()} style={{ padding: "3px 10px", borderRadius: 4, fontSize: 11, fontWeight: 500, background: "var(--vscode-badge-background, #333)", color: "var(--vscode-badge-foreground, #ccc)" }}>{s.trim()}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Play Details — compact card with pipes */}
      <div className="section">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "12px 14px", borderRadius: 8, background: "var(--vscode-editor-inactiveSelectionBackground, #2a2d2e)", border: "1px solid var(--vscode-widget-border, #454545)" }}>
          <Chip label="Play" value={p.id} /><Pipe />
          <Chip label="" value={p.dir} mono /><Pipe />
          <Chip label="Layer" value={layerName} /><Pipe />
          <Chip label="Complexity" value={cx} color={cxColor} /><Pipe />
          <Chip label="" value={p.status ?? "Ready"} color="#10b981" dot />
        </div>
      </div>

      {/* FAI Pillars */}
      <div className="section">
        <div className="section-title"><Icon><Shield size={16} /></Icon> FAI Pillars</div>
        <WafPills />
      </div>

      {/* What's Inside — AFTER FAI Pillars */}
      <div className="section">
        <div className="section-title"><Icon><Puzzle size={16} /></Icon> What's Inside Play {p.id}</div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", fontSize: 12, lineHeight: 1.6 }}>
            <code>agents/</code><span style={{ opacity: 0.8 }}>AI personas — @builder builds, @reviewer audits, @tuner optimizes</span>
            <code>instructions/</code><span style={{ opacity: 0.8 }}>Coding standards auto-applied to matching files via glob patterns</span>
            <code>skills/</code><span style={{ opacity: 0.8 }}>Reusable LEGO blocks for specific tasks (deploy, evaluate, scaffold)</span>
            <code>hooks/</code><span style={{ opacity: 0.8 }}>Policy gates — secrets scanning, PII redaction, cost limits, safety</span>
            <code>prompts/</code><span style={{ opacity: 0.8 }}>Slash commands — /deploy, /test, /review, /evaluate</span>
            <code>workflows/</code><span style={{ opacity: 0.8 }}>CI/CD GitHub Actions for automated testing and deployment</span>
            <code>copilot-instructions.md</code><span style={{ opacity: 0.8 }}>The knowledge hub — Copilot reads this for domain context</span>
            <code>fai-manifest.json</code><span style={{ opacity: 0.8 }}>The wiring spec — connects all primitives with shared context</span>
          </div>
        </div>
      </div>

      {/* Quick Start Guide */}
      <div className="section">
        <div className="section-title"><Icon><BookOpen size={16} /></Icon> Quick Start Guide</div>
        <div className="card" style={{ padding: 16 }}>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 2.2 }}>
            <li><strong>Init DevKit</strong> — scaffolds the project with agents, config, infra, and fai-manifest.json</li>
            <li><strong>Open Copilot Chat</strong> — auto-reads agent.md and copilot-instructions.md (the hub)</li>
            <li>Use agents: <code>@agent</code> (auto-chains), <code>@builder</code> (build), <code>@reviewer</code> (audit), <code>@tuner</code> (optimize)</li>
            <li><strong>Run Evaluation</strong> — validate quality metrics (all must score ≥ 4.0)</li>
            <li>Use <strong>/deploy</strong> in Copilot Chat for guided Azure deployment via Bicep IaC</li>
          </ol>
        </div>
      </div>

      {/* Quick Actions — Categorized */}
      <div className="section">
        <div className="section-title"><Icon><Zap size={16} /></Icon> Quick Actions <span style={{ fontSize: 11, opacity: 0.5, fontWeight: 400 }}>(click to execute)</span></div>

        <div style={{ marginBottom: 12, background: "rgba(59,130,246,0.05)", borderLeft: "3px solid #3b82f6", borderRadius: "0 6px 6px 0", padding: "10px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.5, marginBottom: 6 }}><Icon><Package size={12} /></Icon> Full Packages</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <ActionItem label="Initialize DevKit" desc="Complete package — .github Agentic OS (agents, instructions, skills, hooks, prompts, MCP), copilot-instructions.md, fai-manifest.json, and infra/main.bicep." onClick={() => cmd("initDevKit")} />
            <ActionItem label="Initialize TuneKit" desc="AI parameters — config/openai.json, guardrails.json, search.json, chunking.json, evaluation/eval.py, test-set.jsonl." onClick={() => cmd("initTuneKit")} />
            <ActionItem label="Initialize SpecKit" desc="Architecture spec — play-spec.json with alignment scores and evaluation thresholds." onClick={() => cmd("initSpecKit")} />
          </div>
        </div>

        <div style={{ marginBottom: 12, background: "rgba(107,114,128,0.05)", borderLeft: "3px solid #6b7280", borderRadius: "0 6px 6px 0", padding: "10px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.5, marginBottom: 6 }}><Icon><Wrench size={12} /></Icon> Standalone</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <ActionItem label="Initialize Hooks" desc="Download guardrails.json only — policy gates for secrets, PII, cost, safety." onClick={() => cmd("initHooks")} />
            <ActionItem label="Initialize Prompts" desc="Download 4 slash commands only — /deploy, /test, /review, /evaluate." onClick={() => cmd("initPrompts")} />
            <ActionItem label="Install as Plugin" desc="Pre-built bundle — creates agents, instructions, config, plugin.json in workspace." onClick={() => cmd("installPlugin")} />
          </div>
        </div>

        <div style={{ background: "rgba(16,185,129,0.05)", borderLeft: "3px solid #10b981", borderRadius: "0 6px 6px 0", padding: "10px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.5, marginBottom: 6 }}><Icon><BarChart3 size={12} /></Icon> Analyze & Evaluate</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <ActionItem label="Estimate Cost" desc={`Itemized monthly Azure cost breakdown for ${p.name} across dev, production, and enterprise tiers.`} onClick={() => cmd("cost")} />
            <ActionItem label="Run Evaluation" desc="Steps: 1) Init TuneKit to get eval.py + test-set.jsonl. 2) Edit test-set.jsonl with your Q&A pairs. 3) Run: python evaluation/eval.py. 4) Scores appear in dashboard (groundedness, relevance, coherence, fluency, safety — all must ≥ 4.0)." onClick={() => cmd("runEvaluation")} />
            <ActionItem label="Architecture Diagram" desc={`View the architecture diagram for ${p.name} — service roles, data flow, security.`} onClick={() => cmd("diagram")} />
          </div>
        </div>
      </div>

      {/* FAI Protocol */}
      <div className="section">
        <div className="section-title"><Icon><Layers size={16} /></Icon> FAI Protocol — How Wiring Works</div>
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 13, lineHeight: 1.8, margin: 0 }}>
            When you <strong>Init DevKit</strong>, a <code style={{ padding: "1px 6px", borderRadius: 3, margin: "0 3px", background: "var(--vscode-textCodeBlock-background, #2a2d2e)" }}>fai-manifest.json</code> is auto-generated. This manifest connects your agents, instructions, skills, hooks, and guardrails — so they all share the same context.
          </p>
          <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>Each primitive works standalone. Inside a play, fai-manifest.json auto-wires them together.</p>
        </div>
      </div>

      {/* Resources */}
      <div className="section">
        <div className="section-title"><Icon><Link2 size={16} /></Icon> Resources</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <LinkItem label="Full Play Documentation" url={`https://frootai.dev/solution-plays/${p.dir}`} onClick={openUrl} color="#3b82f6" />
          <LinkItem label="Step-by-Step User Guide" url={`https://frootai.dev/user-guide?play=${p.id}`} onClick={openUrl} color="#10b981" />
          <LinkItem label="View Source on GitHub" url={`https://github.com/frootai/frootai/tree/main/solution-plays/${p.dir}`} onClick={openUrl} color="#f97316" />
          <LinkItem label="FrootAI Website" url="https://frootai.dev" onClick={openUrl} color="#10b981" />
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value, mono, color, dot }: { label: string; value: string; mono?: boolean; color?: string; dot?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      {label && <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.5, fontWeight: 600 }}>{label}:</span>}
      <span style={{ fontSize: 12, fontWeight: 500, fontFamily: mono ? "monospace" : "inherit", color: color || "inherit" }}>
        {dot && <span style={{ marginRight: 3 }}>●</span>}{value}
      </span>
    </div>
  );
}

function Pipe() { return <span style={{ opacity: 0.2, fontSize: 14, margin: "0 2px" }}>|</span>; }

function ActionItem({ label, desc, onClick }: { label: string; desc: string; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ display: "flex", gap: 12, padding: "10px 14px", borderRadius: 6, cursor: "pointer", border: "1px solid var(--vscode-widget-border, #454545)", background: "var(--vscode-editor-inactiveSelectionBackground, #2a2d2e)", transition: "border-color 0.15s" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--vscode-focusBorder, #007fd4)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--vscode-widget-border, #454545)"; }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 3, lineHeight: 1.5 }}>{desc}</div>
      </div>
      <span style={{ alignSelf: "center" }}><ChevronRight size={14} opacity={0.3} /></span>
    </div>
  );
}

function LinkItem({ label, url, onClick, color }: { label: string; url: string; onClick: (url: string) => void; color?: string }) {
  return (
    <div onClick={() => onClick(url)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 4, cursor: "pointer", fontSize: 13, transition: "background 0.1s" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--vscode-list-hoverBackground, #2a2d2e)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
      <ExternalLink size={12} color={color} /><span>{label}</span>
      <span style={{ opacity: 0.4, marginLeft: "auto", fontSize: 11 }}>↗</span>
    </div>
  );
}
