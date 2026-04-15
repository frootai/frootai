import { RefreshCw, ShieldCheck, Wallet, Settings, Gauge, Brain } from "lucide-react";

const WAF_PILLARS = [
  { name: "Reliability", Icon: RefreshCw, color: "#3b82f6" },
  { name: "Security", Icon: ShieldCheck, color: "#ef4444" },
  { name: "Cost Efficiency", Icon: Wallet, color: "#10b981" },
  { name: "Operational Excellence", Icon: Settings, color: "#f59e0b" },
  { name: "Performance", Icon: Gauge, color: "#8b5cf6" },
  { name: "Responsible AI", Icon: Brain, color: "#ec4899" },
];

export default function WafPills() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {WAF_PILLARS.map((p) => (
        <span
          key={p.name}
          className="pill"
          style={{
            background: `${p.color}18`,
            color: p.color,
            borderColor: `${p.color}40`,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <p.Icon size={13} /> {p.name}
        </span>
      ))}
    </div>
  );
}
