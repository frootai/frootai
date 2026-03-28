import type { Metadata } from "next";
import { Container, Zap, Package, Plug, HelpCircle } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeader } from "@/components/ui/section-header";
import { CodeBlock } from "@/components/ui/code-block";
import { Card } from "@/components/ui/card";
import { GlowPill } from "@/components/ui/glow-pill";

export const metadata: Metadata = {
  title: "Docker",
  description: "Run FrootAI MCP Server as a Docker container. Multi-arch (amd64 + arm64), 22 tools, zero install.",
};

const imageDetails = [
  { label: "Registry", value: "ghcr.io" },
  { label: "Image", value: "gitpavleenbali/frootai-mcp" },
  { label: "Architectures", value: "amd64 + arm64" },
  { label: "Tools", value: "22 MCP tools" },
  { label: "Knowledge", value: "682KB, 18 modules" },
  { label: "Size", value: "~45MB compressed" },
];

const whyDocker = [
  { bold: "Zero Node.js required", text: "No npm, no npx, just Docker" },
  { bold: "Consistent environment", text: "Same image everywhere (CI, cloud, local)" },
  { bold: "Multi-arch", text: "Works on Apple Silicon (arm64) and Intel/AMD (amd64)" },
  { bold: "Pinnable versions", text: "Tag specific versions for reproducibility" },
  { bold: "Kubernetes-ready", text: "Deploy as a sidecar or standalone service" },
];

export default function DockerPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 lg:px-6 py-12 sm:py-16">
      <SectionHeader
        title="Docker — FrootAI MCP Server"
        subtitle="Run FrootAI anywhere. Multi-arch container with all 22 MCP tools. Zero install."
      />

      {/* Quick Start */}
      <FadeIn>
        <h2 className="flex items-center gap-2 text-lg font-bold mb-3"><Zap className="h-5 w-5 text-amber" /> Quick Start</h2>
        <CodeBlock label="Terminal" labelColor="#10b981" code={`# Pull & run (auto-selects amd64 or arm64)
docker run -i --rm ghcr.io/gitpavleenbali/frootai-mcp:latest

# Pin a specific version
docker run -i --rm ghcr.io/gitpavleenbali/frootai-mcp:3.1.2`} className="mb-10" />
      </FadeIn>

      {/* Image Details */}
      <FadeIn delay={0.05}>
        <h2 className="flex items-center gap-2 text-lg font-bold mb-4"><Package className="h-5 w-5 text-cyan" /> Image Details</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10">
          {imageDetails.map((item) => (
            <div key={item.label} className="rounded-xl border border-border bg-bg-surface p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-fg-dim mb-1">{item.label}</div>
              <div className="text-sm font-bold">{item.value}</div>
            </div>
          ))}
        </div>
      </FadeIn>

      {/* Client Configs */}
      <FadeIn delay={0.1}>
        <h2 className="flex items-center gap-2 text-lg font-bold mb-4"><Plug className="h-5 w-5 text-indigo" /> Client Configuration</h2>

        <h3 className="text-sm font-bold mb-2">Claude Desktop / Cursor</h3>
        <CodeBlock label="claude_desktop_config.json" labelColor="#6366f1" className="mb-5" code={`{
  "mcpServers": {
    "frootai": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "ghcr.io/gitpavleenbali/frootai-mcp:latest"]
    }
  }
}`} />

        <h3 className="text-sm font-bold mb-2">VS Code Copilot</h3>
        <CodeBlock label=".vscode/mcp.json" labelColor="#6366f1" className="mb-5" code={`{
  "servers": {
    "frootai": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "ghcr.io/gitpavleenbali/frootai-mcp:latest"],
      "type": "stdio"
    }
  }
}`} />

        <h3 className="text-sm font-bold mb-2">Docker Compose (sidecar)</h3>
        <CodeBlock label="docker-compose.yml" labelColor="#06b6d4" className="mb-10" code={`services:
  frootai-mcp:
    image: ghcr.io/gitpavleenbali/frootai-mcp:latest
    stdin_open: true
    restart: unless-stopped`} />
      </FadeIn>

      {/* Why Docker */}
      <FadeIn delay={0.15}>
        <h2 className="flex items-center gap-2 text-lg font-bold mb-4"><HelpCircle className="h-5 w-5 text-violet" /> Why Docker?</h2>
        <Card className="mb-10">
          <ul className="space-y-2 text-[13px] text-fg-muted">
            {whyDocker.map((item) => (
              <li key={item.bold}>
                <strong className="text-fg">{item.bold}</strong> — {item.text}
              </li>
            ))}
          </ul>
        </Card>
      </FadeIn>

      {/* Bottom nav */}
      <div className="flex flex-wrap justify-center gap-2">
        <GlowPill href="https://github.com/gitpavleenbali/frootai/pkgs/container/frootai-mcp" color="#10b981" external>
          GitHub Container Registry →
        </GlowPill>
        <GlowPill href="/setup-guide" color="#6366f1">Full Setup Guide</GlowPill>
        <GlowPill href="/mcp-tooling" color="#7c3aed">MCP Server</GlowPill>
        <GlowPill href="/" color="#f59e0b">Back to FrootAI</GlowPill>
      </div>
    </div>
  );
}
