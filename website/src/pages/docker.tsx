import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import styles from "./index.module.css";

const configs = [
  {
    title: "Claude Desktop / Cursor",
    lang: "json",
    code: `{
  "mcpServers": {
    "frootai": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "ghcr.io/gitpavleenbali/frootai-mcp:latest"]
    }
  }
}`,
  },
  {
    title: "VS Code Copilot (.vscode/mcp.json)",
    lang: "json",
    code: `{
  "servers": {
    "frootai": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "ghcr.io/gitpavleenbali/frootai-mcp:latest"],
      "type": "stdio"
    }
  }
}`,
  },
];

export default function DockerPage(): JSX.Element {
  return (
    <Layout title="Docker — FrootAI MCP Server" description="Run FrootAI MCP Server as a Docker container. Multi-arch (amd64 + arm64), 23 tools, zero install.">
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 24px 80px" }}>

        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>🐳 Docker — FrootAI MCP Server</h1>
          <p style={{ fontSize: "0.95rem", color: "var(--ifm-color-emphasis-500)", maxWidth: "600px", margin: "0 auto" }}>
            Run FrootAI anywhere. Multi-arch container with all 23 MCP tools. Zero install.
          </p>
        </div>

        {/* Quick Start */}
        <section style={{ marginBottom: "36px" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "12px" }}>⚡ Quick Start</h2>
          <pre style={{ padding: "16px", borderRadius: "12px", background: "rgba(16, 185, 129, 0.06)", border: "1px solid rgba(16, 185, 129, 0.2)", fontSize: "0.85rem", overflowX: "auto" }}>
{`# Pull & run (auto-selects amd64 or arm64)
docker run -i --rm ghcr.io/gitpavleenbali/frootai-mcp:latest

# Pin a specific version
docker run -i --rm ghcr.io/gitpavleenbali/frootai-mcp:3.1.2`}
          </pre>
        </section>

        {/* Image Details */}
        <section style={{ marginBottom: "36px" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "12px" }}>📦 Image Details</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
            {[
              { label: "Registry", value: "ghcr.io" },
              { label: "Image", value: "gitpavleenbali/frootai-mcp" },
              { label: "Architectures", value: "amd64 + arm64" },
              { label: "Tools", value: "23 MCP tools" },
              { label: "Knowledge", value: "682KB, 16 modules" },
              { label: "Size", value: "~45MB compressed" },
            ].map((item) => (
              <div key={item.label} style={{ padding: "12px 16px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--ifm-color-emphasis-400)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.label}</div>
                <div style={{ fontSize: "0.9rem", fontWeight: 700, marginTop: "4px" }}>{item.value}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Client Configs */}
        <section style={{ marginBottom: "36px" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "12px" }}>🔌 Client Configuration</h2>
          {configs.map((cfg) => (
            <div key={cfg.title} style={{ marginBottom: "20px" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "8px" }}>{cfg.title}</h3>
              <pre style={{ padding: "14px", borderRadius: "10px", background: "rgba(99, 102, 241, 0.06)", border: "1px solid rgba(99, 102, 241, 0.15)", fontSize: "0.82rem", overflowX: "auto" }}>
                {cfg.code}
              </pre>
            </div>
          ))}
        </section>

        {/* Why Docker */}
        <section style={{ marginBottom: "36px" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "12px" }}>🤔 Why Docker?</h2>
          <ul style={{ fontSize: "0.88rem", lineHeight: 1.8, paddingLeft: "20px" }}>
            <li><strong>Zero Node.js required</strong> — No npm, no npx, just Docker</li>
            <li><strong>Consistent environment</strong> — Same image everywhere (CI, cloud, local)</li>
            <li><strong>Multi-arch</strong> — Works on Apple Silicon (arm64) and Intel/AMD (amd64)</li>
            <li><strong>Pinnable versions</strong> — Tag specific versions for reproducibility</li>
            <li><strong>Kubernetes-ready</strong> — Deploy as a sidecar or standalone service</li>
          </ul>
        </section>

        {/* Links */}
        <div style={{ textAlign: "center", display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link className={styles.glowPill} style={{ "--pill-color": "#10b981" } as React.CSSProperties}
            href="https://github.com/gitpavleenbali/frootai/pkgs/container/frootai-mcp">
            GitHub Container Registry →
          </Link>
          <Link className={styles.glowPill} style={{ "--pill-color": "#6366f1" } as React.CSSProperties}
            to="/setup-guide">
            Full Setup Guide →
          </Link>
          <Link className={styles.glowPill} style={{ "--pill-color": "#f59e0b" } as React.CSSProperties}
            to="/ecosystem">
            Ecosystem Overview →
          </Link>
        </div>

      </div>
    </Layout>
  );
}
