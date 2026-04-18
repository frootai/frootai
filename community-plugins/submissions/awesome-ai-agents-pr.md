# awesome-ai-agents PR Entry

Add this entry under the appropriate section (Frameworks / Platforms / Open Source):

---

### FrootAI

> Open-source AI primitive unification platform — the missing glue layer for AI agent ecosystems. Context-wires agents, instructions, skills, hooks, and plugins into deployable AI systems via the FAI Protocol.

- **862+ Primitives**: 238 agents, 176 instructions, 333 skills, 10 hooks, 77 plugins, 12 workflows, 16 cookbook recipes
- **104 Solution Plays**: Production-ready architectures (Enterprise RAG, Agentic RAG, Multi-Agent, Voice AI, Document Intelligence, Edge AI, Browser Agents, and 97 more)
- **FAI Protocol v2.0**: Declarative standard for wiring AI primitives with 10 moonshot contract types — the Dockerfile equivalent for AI systems
- **Framework Adapters**: Semantic Kernel, LangChain native adapters for cross-framework portability
- **45 MCP Tools**: Full MCP server (v5.2.0) for AI architecture guidance, primitive management, and evaluation
- **Infrastructure as Code**: Bicep + Terraform templates for every Azure-based solution play
- **6 Distribution Channels**: npm, PyPI, VS Code Marketplace, Docker (ghcr.io), GitHub Actions, CLI
- **24 Knowledge Modules**: Covering GenAI foundations through production operations

**Links**: [Website](https://frootai.dev) · [GitHub](https://github.com/frootai/frootai) · [MCP Server](https://www.npmjs.com/package/frootai-mcp) · [Docker](https://github.com/frootai/frootai/pkgs/container/mcp-server)

---

## PR Template

**Title**: Add FrootAI — AI primitive unification platform (862+ primitives, 104 plays, 45 MCP tools)

**Body**:

This PR adds [FrootAI](https://frootai.dev) — an open-source platform for unifying AI primitives (agents, instructions, skills, hooks, plugins) via the FAI Protocol.

**Key differentiators:**
- **FAI Protocol v2.0** (`fai-manifest.json`) — declarative context-wiring standard with 10 moonshot contract types. While MCP handles tool calling and A2A handles delegation, FAI handles how primitives share context, enforce quality gates, and wire into deployable systems.
- **104 solution plays** — each is a self-contained, deployable AI architecture with agents, infrastructure (Bicep + Terraform), evaluation pipelines, and quality guardrails.
- **862+ reusable primitives** cataloged with WAF (Well-Architected Framework) alignment across 6 pillars.
- **45 MCP tools** (v5.2.0) — architecture guidance, play discovery, model comparison, cost estimation, evaluation, and primitive management via stdio and Streamable HTTP transports.
- **Cross-framework**: native adapters for Semantic Kernel and LangChain.
- **6 distribution channels**: npm, PyPI, VS Code Marketplace, Docker, GitHub Actions, CLI.

**License:** MIT
