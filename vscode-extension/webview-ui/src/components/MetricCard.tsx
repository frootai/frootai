import type { ReactNode } from "react";

interface MetricCardProps {
  name: string;
  icon: ReactNode;
  score: number;
  threshold: number;
}

export default function MetricCard({ name, icon, score, threshold }: MetricCardProps) {
  const passed = score >= threshold;
  const pct = Math.min((score / 5) * 100, 100);
  const color = score >= 4.0 ? "#10b981" : score >= 3.0 ? "#f59e0b" : "#ef4444";

  return (
    <div className="card">
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        <span className="badge" style={{ background: passed ? "#10b981" : "#ef4444" }}>
          {passed ? "PASS" : "FAIL"}
        </span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, textTransform: "capitalize" }}>
        {name}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color, marginBottom: 8 }}>
        {score.toFixed(1)}
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
        Threshold: {threshold.toFixed(1)}
      </div>
    </div>
  );
}
