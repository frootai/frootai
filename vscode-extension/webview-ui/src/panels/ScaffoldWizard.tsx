import { useState, useMemo } from "react";
import type { SolutionPlay } from "../types";
import PlayCard from "../components/PlayCard";
import SearchInput from "../components/SearchInput";
import { vscode } from "../vscode";
import { FolderPlus, FileText, CheckCircle } from "lucide-react";

const DEVKIT_FILES = [
  ".github/copilot-instructions.md",
  ".github/agents/builder.agent.md",
  ".github/agents/reviewer.agent.md",
  ".github/agents/tuner.agent.md",
  "config/openai.json",
  "config/guardrails.json",
  "spec/fai-manifest.json",
];

interface Props { plays: SolutionPlay[]; initialPlay?: SolutionPlay | null; }

export default function ScaffoldWizard({ plays, initialPlay }: Props) {
  const [step, setStep] = useState(initialPlay ? 2 : 1);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SolutionPlay | null>(initialPlay || null);
  const [projectName, setProjectName] = useState("");

  const filtered = useMemo(() => {
    if (!search) return plays;
    const q = search.toLowerCase();
    return plays.filter((p) => p.name.toLowerCase().includes(q) || p.id.includes(q) || p.dir.includes(q));
  }, [plays, search]);

  const name = projectName || selected?.dir || "my-ai-project";

  return (
    <div className="container">
      <div className="hero">
        <span className="hero-icon"><FolderPlus size={48} /></span>
        <h1>Scaffold Wizard</h1>
        <p style={{ opacity: 0.7 }}>Bootstrap a new AI project in 4 steps</p>
      </div>

      <div className="steps">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className={`step-dot ${step === s ? "active" : step > s ? "done" : ""}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="section">
          <div className="section-title">Step 1 — Select a Solution Play</div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search plays..." resultCount={filtered.length} />
          <div className="grid grid-2">
            {filtered.slice(0, 20).map((p) => (
              <PlayCard key={p.id} play={p} selected={selected?.id === p.id} onClick={() => setSelected(p)} />
            ))}
          </div>
          {filtered.length > 20 && <p className="text-center" style={{ marginTop: 12, opacity: 0.6 }}>+ {filtered.length - 20} more</p>}
          <div className="flex justify-between" style={{ marginTop: 16 }}>
            <div />
            <button className="btn" disabled={!selected} onClick={() => setStep(2)}>Next →</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="section">
          <div className="section-title">Step 2 — Project Name</div>
          <input className="input" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder={selected?.dir ?? "my-ai-project"} />
          <p style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>Leave empty to use: {selected?.dir}</p>
          <div className="flex justify-between" style={{ marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
            <button className="btn" onClick={() => setStep(3)}>Next →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="section">
          <div className="section-title">Step 3 — Preview</div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{selected?.icon} {selected?.name}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Project: {name}</div>
          </div>
          <div className="section-title" style={{ fontSize: 14 }}>Files to create:</div>
          {DEVKIT_FILES.map((f) => (
            <div key={f} className="info-row">
              <span><FileText size={14} style={{ verticalAlign: -2, marginRight: 4 }} /></span><span style={{ fontFamily: "monospace", fontSize: 12 }}>{name}/{f}</span>
            </div>
          ))}
          <div className="flex justify-between" style={{ marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={() => setStep(2)}>← Back</button>
            <button className="btn" onClick={() => { vscode.postMessage({ command: "scaffold", playId: selected?.id, projectName: name }); setStep(4); }}>
              Create Project
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="section text-center" style={{ padding: 40 }}>
          <span style={{ fontSize: 64 }}><CheckCircle size={48} color="#10b981" /></span>
          <h2 style={{ marginTop: 16 }}>Project Scaffolded!</h2>
          <p style={{ opacity: 0.7, marginTop: 8 }}>Open the folder and start coding with Copilot.</p>
          <div className="flex gap-2" style={{ justifyContent: "center", marginTop: 20 }}>
            <button className="btn" onClick={() => vscode.postMessage({ command: "openFolder", path: name })}>Open Folder</button>
            <button className="btn btn-secondary" onClick={() => { setStep(1); setSelected(null); setProjectName(""); }}>Scaffold Another</button>
          </div>
        </div>
      )}
    </div>
  );
}
