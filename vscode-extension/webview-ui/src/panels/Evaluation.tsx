import { useState } from "react";
import MetricCard from "../components/MetricCard";
import { vscode } from "../vscode";
import type { EvalData } from "../types";
import {
  Target, Search, Link2, MessageSquare, Shield,
  CheckCircle, AlertTriangle, TrendingUp,
  FileJson, FileSpreadsheet, Play, FolderSearch, BookOpen,
  Terminal, RefreshCw, Info, Copy, FileCode2, Beaker
} from "lucide-react";
import type { ComponentType } from "react";

const METRIC_ICONS: Record<string, ComponentType<{ size?: number }>> = {
  groundedness: Target,
  relevance: Search,
  coherence: Link2,
  fluency: MessageSquare,
  safety: Shield,
};

const DEFAULT_THRESHOLDS: Record<string, number> = {
  groundedness: 4.0, relevance: 4.0, coherence: 4.0, fluency: 4.0, safety: 4.0,
};

const DEMO_SCORES: Record<string, number> = {
  groundedness: 4.5, relevance: 3.8, coherence: 4.2, fluency: 4.6, safety: 4.9,
};

const DEMO_HISTORY: Array<{ label: string; scores: Record<string, number> }> = [
  { label: "Run 5 (latest)", scores: { groundedness: 4.5, relevance: 3.8, coherence: 4.2, fluency: 4.6, safety: 4.9 } },
  { label: "Run 4", scores: { groundedness: 4.3, relevance: 3.6, coherence: 4.0, fluency: 4.5, safety: 4.8 } },
  { label: "Run 3", scores: { groundedness: 4.1, relevance: 3.9, coherence: 3.8, fluency: 4.4, safety: 4.7 } },
  { label: "Run 2", scores: { groundedness: 3.8, relevance: 3.5, coherence: 3.7, fluency: 4.3, safety: 4.6 } },
  { label: "Run 1", scores: { groundedness: 3.5, relevance: 3.2, coherence: 3.5, fluency: 4.1, safety: 4.5 } },
];

const EVAL_CONFIG_TEMPLATE = `{
  "metrics": ["groundedness", "relevance", "coherence", "fluency", "safety"],
  "thresholds": {
    "groundedness": 4.0,
    "relevance": 4.0,
    "coherence": 4.0,
    "fluency": 4.0,
    "safety": 4.0
  },
  "dataset": "evaluation/test-data.jsonl"
}`;

const EVAL_RESULTS_TEMPLATE = `{
  "timestamp": "2026-04-16T12:00:00Z",
  "scores": {
    "groundedness": 4.5,
    "relevance": 4.2,
    "coherence": 4.3,
    "fluency": 4.6,
    "safety": 4.9
  }
}`;

interface Props {
  evalData?: EvalData;
}

function TrendBar({ values, threshold, color }: { values: number[]; threshold: number; color: string }) {
  const max = 5;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 40 }}>
      {values.map((v, i) => {
        const h = (v / max) * 100;
        const isLatest = i === values.length - 1;
        const pass = v >= threshold;
        return (
          <div key={i} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                width: isLatest ? 14 : 10,
                height: `${h}%`,
                minHeight: 4,
                background: pass ? color : "#ef4444",
                borderRadius: 2,
                opacity: isLatest ? 1 : 0.5 + (i * 0.1),
                transition: "all 0.3s ease",
              }}
              title={`${v.toFixed(1)} / 5.0`}
            />
          </div>
        );
      })}
    </div>
  );
}

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  const delta = current - previous;
  if (Math.abs(delta) < 0.05) return <span style={{ fontSize: 11, opacity: 0.5 }}>—</span>;
  const up = delta > 0;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: up ? "#10b981" : "#ef4444" }}>
      {up ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}
    </span>
  );
}

function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ position: "relative", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 11, opacity: 0.5, textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
        <button
          className="btn btn-secondary"
          style={{ fontSize: 10, padding: "2px 8px" }}
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        >
          <Copy size={10} style={{ verticalAlign: -1, marginRight: 3 }} />
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="card" style={{ padding: 12, fontSize: 12, lineHeight: 1.5, overflow: "auto", margin: 0 }}>{code}</pre>
    </div>
  );
}

/* ─── Empty State: Setup Guide ─── */
function EmptyState() {
  return (
    <div className="container">
      <div className="hero">
        <span className="hero-icon"><Beaker size={48} color="#7c3aed" /></span>
        <h1>Evaluation Dashboard</h1>
        <p style={{ opacity: 0.6, maxWidth: 520 }}>
          No evaluation data detected in this workspace. Set up an evaluation pipeline to track AI quality metrics.
        </p>
      </div>

      {/* Quick setup cards */}
      <h2 style={{ fontSize: 16, marginBottom: 12 }}>
        <BookOpen size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
        Quick Setup Guide
      </h2>

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <div className="glow-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div className="icon-box" style={{ background: "rgba(16,185,129,0.15)" }}>
              <FileCode2 size={18} color="#10b981" />
            </div>
            <div>
              <strong>Step 1: Create eval-config.json</strong>
              <div style={{ fontSize: 11, opacity: 0.5 }}>evaluation/eval-config.json</div>
            </div>
          </div>
          <p style={{ fontSize: 12, opacity: 0.7, margin: "0 0 10px" }}>
            Define which metrics to track and their pass/fail thresholds.
          </p>
          <button className="btn" style={{ fontSize: 11 }} onClick={() => vscode.postMessage({ command: "createEvalConfig" })}>
            <FileCode2 size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Create Config File
          </button>
        </div>

        <div className="glow-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div className="icon-box" style={{ background: "rgba(124,58,237,0.15)" }}>
              <FileJson size={18} color="#7c3aed" />
            </div>
            <div>
              <strong>Step 2: Add eval results</strong>
              <div style={{ fontSize: 11, opacity: 0.5 }}>evaluation/eval-results.json</div>
            </div>
          </div>
          <p style={{ fontSize: 12, opacity: 0.7, margin: "0 0 10px" }}>
            Run your evaluation pipeline and save results. The dashboard auto-detects them.
          </p>
          <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => vscode.postMessage({ command: "createEvalResults" })}>
            <FileJson size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Create Sample Results
          </button>
        </div>
      </div>

      {/* File structure reference */}
      <h2 style={{ fontSize: 16, marginBottom: 12 }}>
        <FolderSearch size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
        Expected File Structure
      </h2>
      <CodeBlock label="evaluation folder" code={`your-project/
├── evaluation/
│   ├── eval-config.json       ← Metrics & thresholds
│   ├── eval-results.json      ← Latest scores (auto-detected)
│   ├── eval.py                ← Optional: evaluation script
│   ├── test-set.jsonl         ← Optional: test dataset
│   └── results/               ← Optional: historical runs
│       ├── run-2026-04-01.json
│       └── run-2026-04-15.json`} />

      <CodeBlock label="eval-config.json" code={EVAL_CONFIG_TEMPLATE} />
      <CodeBlock label="eval-results.json" code={EVAL_RESULTS_TEMPLATE} />

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <button className="btn" onClick={() => vscode.postMessage({ command: "runEvaluation" })}>
          <Terminal size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Run Evaluation
        </button>
        <button className="btn btn-secondary" onClick={() => vscode.postMessage({ command: "scanWorkspace" })}>
          <RefreshCw size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Scan Workspace
        </button>
        <button className="btn btn-secondary" onClick={() => vscode.postMessage({ command: "viewDemo" })}>
          <Beaker size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> View Demo Dashboard
        </button>
      </div>
    </div>
  );
}

/* ─── Main Dashboard (real or demo data) ─── */
export default function Evaluation({ evalData }: Props) {
  const [viewMode, setViewMode] = useState<"live" | "demo">(
    evalData?.hasRealData ? "live" : "demo"
  );
  const [showTrends, setShowTrends] = useState(true);

  // If no evalData at all and not demo mode, show empty state
  if (!evalData && viewMode !== "demo") return <EmptyState />;

  const isDemo = !evalData?.hasRealData || viewMode === "demo";
  const scores = isDemo ? DEMO_SCORES : evalData!.scores;
  const thresholds = isDemo ? DEFAULT_THRESHOLDS : evalData!.thresholds;
  const history = isDemo ? DEMO_HISTORY : evalData!.history;

  const metricKeys = Object.keys(scores);
  const metrics = metricKeys.map(key => ({
    key,
    Icon: METRIC_ICONS[key] || Target,
    threshold: thresholds[key] ?? 4.0,
  }));

  const allPass = metrics.every(m => (scores[m.key] ?? 0) >= m.threshold);
  const passCount = metrics.filter(m => (scores[m.key] ?? 0) >= m.threshold).length;
  const avg = metrics.reduce((sum, m) => sum + (scores[m.key] ?? 0), 0) / metrics.length;
  const prevRun: Record<string, number> | null = history.length >= 2 ? history[1].scores : null;

  return (
    <div className="container">
      {/* Hero */}
      <div className="hero">
        <span className="hero-icon">
          {allPass ? <CheckCircle size={48} color="#10b981" /> : <AlertTriangle size={48} color="#ef4444" />}
        </span>
        <h1>Evaluation Dashboard</h1>
        <span className="badge" style={{
          background: allPass ? "#10b981" : "#ef4444",
          fontSize: 14, padding: "6px 16px"
        }}>
          {allPass ? "ALL METRICS PASS" : `${passCount}/${metrics.length} METRICS PASS`}
        </span>
      </div>

      {/* Demo mode banner */}
      {isDemo && (
        <div className="card" style={{
          padding: "10px 16px", marginBottom: 16,
          border: "1px solid rgba(245,158,11,0.3)",
          background: "rgba(245,158,11,0.05)",
          display: "flex", alignItems: "center", gap: 8
        }}>
          <Info size={16} color="#f59e0b" />
          <span style={{ fontSize: 12, flex: 1 }}>
            <strong>Demo Mode</strong> — Showing sample data.
            {evalData?.hasRealData
              ? <> <a href="#" style={{ color: "#10b981" }} onClick={(e) => { e.preventDefault(); setViewMode("live"); }}>Switch to live data →</a></>
              : <> Set up <code>evaluation/</code> in your workspace to see real metrics.</>
            }
          </span>
          {!evalData?.hasRealData && (
            <button className="btn btn-secondary" style={{ fontSize: 10, padding: "3px 8px" }}
              onClick={() => vscode.postMessage({ command: "scanWorkspace" })}>
              <RefreshCw size={10} style={{ verticalAlign: -1, marginRight: 3 }} /> Scan
            </button>
          )}
        </div>
      )}

      {/* Live data source info */}
      {!isDemo && evalData?.configPath && (
        <div className="card" style={{
          padding: "8px 16px", marginBottom: 16,
          border: "1px solid rgba(16,185,129,0.2)",
          background: "rgba(16,185,129,0.03)",
          display: "flex", alignItems: "center", gap: 8
        }}>
          <CheckCircle size={14} color="#10b981" />
          <span style={{ fontSize: 11, flex: 1, opacity: 0.7 }}>
            Source: <code>{evalData.configPath}</code>
            {evalData.resultFiles && evalData.resultFiles.length > 0 &&
              <> · {evalData.resultFiles.length} result file{evalData.resultFiles.length > 1 ? "s" : ""} detected</>
            }
          </span>
          <button className="btn btn-secondary" style={{ fontSize: 10, padding: "3px 8px" }}
            onClick={() => vscode.postMessage({ command: "scanWorkspace" })}>
            <RefreshCw size={10} style={{ verticalAlign: -1, marginRight: 3 }} /> Refresh
          </button>
          <button className="btn btn-secondary" style={{ fontSize: 10, padding: "3px 8px" }}
            onClick={() => setViewMode("demo")}>Demo</button>
        </div>
      )}

      {/* Summary stats */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div className="card" style={{ flex: 1, minWidth: 120, textAlign: "center", padding: 12 }}>
          <div style={{ fontSize: 11, opacity: 0.6, textTransform: "uppercase" }}>Average Score</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: avg >= 4 ? "#10b981" : avg >= 3 ? "#f59e0b" : "#ef4444" }}>
            {avg.toFixed(2)}
          </div>
          {prevRun && <DeltaBadge current={avg} previous={metrics.reduce((sum, m) => sum + (prevRun[m.key] ?? 0), 0) / metrics.length} />}
        </div>
        <div className="card" style={{ flex: 1, minWidth: 120, textAlign: "center", padding: 12 }}>
          <div style={{ fontSize: 11, opacity: 0.6, textTransform: "uppercase" }}>Pass Rate</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: allPass ? "#10b981" : "#f59e0b" }}>
            {Math.round((passCount / metrics.length) * 100)}%
          </div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 120, textAlign: "center", padding: 12 }}>
          <div style={{ fontSize: 11, opacity: 0.6, textTransform: "uppercase" }}>Total Runs</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{history.length}</div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        {metrics.map(m => (
          <MetricCard key={m.key} name={m.key} icon={<m.Icon size={24} />} score={scores[m.key] ?? 0} threshold={m.threshold} />
        ))}
      </div>

      {/* Trends */}
      {history.length > 1 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>
              <TrendingUp size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Metric Trends
            </h2>
            <button className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 10px" }}
              onClick={() => setShowTrends(!showTrends)}>
              {showTrends ? "Hide" : "Show"} Trends
            </button>
          </div>
          {showTrends && (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 60px 60px", gap: 8, alignItems: "center" }}>
                <div style={{ fontSize: 11, opacity: 0.5, fontWeight: 600 }}>METRIC</div>
                <div style={{ fontSize: 11, opacity: 0.5, fontWeight: 600 }}>LAST {history.length} RUNS</div>
                <div style={{ fontSize: 11, opacity: 0.5, fontWeight: 600, textAlign: "right" }}>CURRENT</div>
                <div style={{ fontSize: 11, opacity: 0.5, fontWeight: 600, textAlign: "right" }}>DELTA</div>
                {metrics.map(m => {
                  const trendValues = [...history].reverse().map(h => h.scores[m.key] ?? 0);
                  const scoreColor = (scores[m.key] ?? 0) >= 4 ? "#10b981" : (scores[m.key] ?? 0) >= 3 ? "#f59e0b" : "#ef4444";
                  return (
                    <div key={m.key} style={{ display: "contents" }}>
                      <div style={{ fontSize: 13, textTransform: "capitalize" }}><m.Icon size={14} /> {m.key}</div>
                      <div style={{ position: "relative" }}>
                        <TrendBar values={trendValues} threshold={m.threshold} color={scoreColor} />
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: scoreColor, textAlign: "right" }}>{(scores[m.key] ?? 0).toFixed(1)}</div>
                      <div style={{ textAlign: "right" }}>
                        {prevRun && <DeltaBadge current={scores[m.key] ?? 0} previous={prevRun[m.key] ?? 0} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Workspace status (live mode only) */}
      {!isDemo && evalData && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>
            <FolderSearch size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Workspace Status
          </h2>
          <div className="grid grid-3">
            <StatusPill label="eval-config.json" found={!!evalData.configPath} />
            <StatusPill label="eval.py" found={!!evalData.hasEvalPy} />
            <StatusPill label="test-set.jsonl" found={!!evalData.hasTestSet} />
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn" onClick={() => vscode.postMessage({ command: "runEvaluation" })}>
          <Play size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Run Evaluation
        </button>
        <button className="btn btn-secondary" onClick={() => vscode.postMessage({ command: "scanWorkspace" })}>
          <RefreshCw size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Scan Workspace
        </button>
        <button className="btn btn-secondary" onClick={() => vscode.postMessage({ command: "exportJson", scores })}>
          <FileJson size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Export JSON
        </button>
        <button className="btn btn-secondary" onClick={() => vscode.postMessage({ command: "exportCsv", scores })}>
          <FileSpreadsheet size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Export CSV
        </button>
      </div>
    </div>
  );
}

function StatusPill({ label, found }: { label: string; found: boolean }) {
  return (
    <div className="card" style={{
      padding: "8px 12px", display: "flex", alignItems: "center", gap: 8,
      border: `1px solid ${found ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.08)"}`
    }}>
      {found
        ? <CheckCircle size={14} color="#10b981" />
        : <AlertTriangle size={14} color="#666" />}
      <code style={{ fontSize: 11 }}>{label}</code>
      <span style={{ fontSize: 10, opacity: 0.5, marginLeft: "auto" }}>
        {found ? "Detected" : "Not found"}
      </span>
    </div>
  );
}
