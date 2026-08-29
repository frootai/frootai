import { useState, useMemo, useEffect } from "react";
import type { SolutionPlay } from "../types";
import PlayCard from "../components/PlayCard";
import SearchInput from "../components/SearchInput";
import { vscode } from "../vscode";
import { FolderPlus, FileText, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";

const DEVKIT_FILES = [
  ".github/copilot-instructions.md",
  ".github/agents/builder.agent.md",
  ".github/agents/reviewer.agent.md",
  ".github/agents/tuner.agent.md",
  "config/openai.json",
  "config/guardrails.json",
  "spec/fai-manifest.json",
];

const PLAYS_PER_PAGE = 20;

interface Props { plays: SolutionPlay[]; initialPlay?: SolutionPlay | null; }

export default function ScaffoldWizard({ plays, initialPlay }: Props) {
  const [step, setStep] = useState(initialPlay ? 2 : 1);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SolutionPlay | null>(initialPlay || null);
  const [projectName, setProjectName] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<{ state: "idle" | "running" | "failed" | "succeeded"; message: string; path?: string }>({ state: "idle", message: "" });

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const message = event.data;
      if (message?.type !== "scaffoldStatus") return;
      setStatus({ state: message.status, message: message.message ?? message.status, path: message.path });
      if (message.status === "succeeded") setStep(4);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);

  const logoUri = (window as any).panelData?.logoUri;

  const filtered = useMemo(() => {
    if (!search) return plays;
    const q = search.toLowerCase();
    return plays.filter((p) => p.name.toLowerCase().includes(q) || p.id.includes(q) || p.dir.includes(q));
  }, [plays, search]);

  const totalPages = Math.ceil(filtered.length / PLAYS_PER_PAGE);
  const paged = filtered.slice((page - 1) * PLAYS_PER_PAGE, page * PLAYS_PER_PAGE);

  const name = projectName || selected?.dir || "my-ai-project";

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };

  return (
    <div className="container">
      <div className="hero">
        {logoUri && <img src={logoUri} alt="FrootAI" style={{ width: 48, height: 48, marginBottom: 8 }} />}
        <h1>FAI Scaffold Wizard</h1>
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
          <SearchInput value={search} onChange={handleSearch} placeholder="Search plays..." resultCount={filtered.length} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "8px 0", fontSize: 12, opacity: 0.6 }}>
            <span>Showing {(page - 1) * PLAYS_PER_PAGE + 1}–{Math.min(page * PLAYS_PER_PAGE, filtered.length)} of {filtered.length}</span>
            {totalPages > 1 && <span>Page {page} of {totalPages}</span>}
          </div>
          <div className="grid grid-2">
            {paged.map((p) => (
              <PlayCard key={p.id} play={p} selected={selected?.id === p.id} onClick={() => setSelected(p)} />
            ))}
          </div>
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 20, marginBottom: 12 }}>
              <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ opacity: page <= 1 ? 0.3 : 1 }}>
                <ChevronLeft size={14} /> Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .map((p, idx, arr) => (
                  <span key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && <span style={{ opacity: 0.3 }}>…</span>}
                    <button className={`btn btn-sm ${p === page ? "" : "btn-secondary"}`} onClick={() => setPage(p)} style={{ minWidth: 32 }}>{p}</button>
                  </span>
                ))}
              <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={{ opacity: page >= totalPages ? 0.3 : 1 }}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
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
            <button className="btn" disabled={status.state === "running"} onClick={() => { setStatus({ state: "running", message: "Preparing canonical DevKit…" }); vscode.postMessage({ command: "scaffold", playId: selected?.id, projectName: name }); }}>
              {status.state === "running" ? "Creating…" : "Create Project"}
            </button>
          </div>
          {status.message && <p role="status" className={`fai-inline-status ${status.state}`}>{status.message}</p>}
        </div>
      )}

      {step === 4 && (
        <div className="section text-center" style={{ padding: 40 }}>
          <span style={{ fontSize: 64 }}><CheckCircle size={48} color="#10b981" /></span>
          <h2 style={{ marginTop: 16 }}>Project Scaffolded!</h2>
          <p style={{ opacity: 0.7, marginTop: 8 }}>{status.message || "Open the folder and start coding with Copilot."}</p>
          <div className="flex gap-2" style={{ justifyContent: "center", marginTop: 20 }}>
            <button className="btn" onClick={() => vscode.postMessage({ command: "openFolder", path: status.path ?? name })}>Open Folder</button>
            <button className="btn btn-secondary" onClick={() => { setStep(1); setSelected(null); setProjectName(""); }}>Scaffold Another</button>
          </div>
        </div>
      )}
    </div>
  );
}
