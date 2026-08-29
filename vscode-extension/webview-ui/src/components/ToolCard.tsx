import type { McpTool } from "../types";
import Badge from "./Badge";

const CATEGORY_COLORS: Record<string, string> = {
  Knowledge: "#3b82f6",
  Plays: "#7c3aed",
  Cost: "#10b981",
  Architecture: "#f59e0b",
  Models: "#ec4899",
  Agents: "#ef4444",
  Evaluation: "#8b5cf6",
  Primitives: "#06b6d4",
  Tools: "#6b7280",
  Docs: "#0ea5e9",
  GitHub: "#f97316",
  Security: "#dc2626",
};

interface ToolCardProps {
  tool: McpTool;
  onTryIt?: () => void;
}

export default function ToolCard({ tool, onTryIt }: ToolCardProps) {
  const color = CATEGORY_COLORS[tool.category] ?? "#6b7280";
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <code style={{ fontSize: 13, fontWeight: 600 }}>{tool.name}</code>
          <Badge label={tool.readOnly ? "Read" : "Write"} color={tool.readOnly ? "#10b981" : "#f59e0b"} />
        </div>
        <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>{tool.description}</p>
        <Badge label={tool.category} color={color} />
      </div>
      {onTryIt && (
        <div style={{ marginTop: 12, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <button onClick={onTryIt}
            style={{ background: "none", border: "1px solid var(--vscode-button-border, rgba(255,255,255,0.15))", color: "var(--vscode-button-foreground, inherit)", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 11, opacity: 0.8, width: "100%" }}>
            🧪 Try It
          </button>
        </div>
      )}
    </div>
  );
}
