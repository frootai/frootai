# FrootAI MCP Server — Glama.ai Listing

## Name
FrootAI MCP Server

## Tagline
The open glue for the GenAI ecosystem — 45 MCP tools, 104 solution plays, 860+ AI primitives

## Description

FrootAI is the missing binding layer for AI development. While MCP handles tool calling, A2A handles delegation, and AG-UI handles rendering, FrootAI handles **wiring** — declaring how AI primitives (agents, instructions, skills, hooks, plugins) connect, share context, and enforce quality gates via the FAI Protocol.

### Key Capabilities

- **45 MCP Tools** — Architecture guidance, solution plays, model comparison, cost estimation, AI evaluation, primitive management, FAI Protocol orchestration, IaC export
- **104 Solution Plays** — Production-ready AI architectures (Enterprise RAG, Multi-Agent, Voice AI, Document Intelligence, Agentic RAG, Edge AI, and more)
- **860+ Primitives** — 238 agents, 176 instructions, 333 skills, 10 hooks, 77 plugins, 12 workflows, 16 cookbook recipes
- **FAI Protocol** — Declarative context-wiring standard (`fai-manifest.json` v2.0) — the Dockerfile for AI systems, with 10 moonshot contract types for cross-platform agent orchestration
- **24 Knowledge Modules** — Covering GenAI foundations, RAG, agents, infrastructure, responsible AI, and production operations
- **Infrastructure as Code** — Bicep + Terraform templates for every Azure-based solution play

### Framework Adapters

FrootAI primitives are framework-agnostic. Built-in adapters translate FAI Protocol manifests into native configurations:

| Framework | Adapter | What It Does |
|-----------|---------|-------------|
| **Semantic Kernel** | `get_adapter_config` | Generates SK plugin registrations, planner configs, and kernel setup from fai-manifest.json |
| **LangChain** | `get_adapter_config` | Produces LCEL chain definitions, tool bindings, and LangSmith tracing configs |

### Moonshot Contracts (FAI Protocol v2.0)

The FAI Protocol v2.0 introduces 10 contract types in `fai-manifest.json` for declarative agent orchestration:

1. **ContextContract** — Shared memory and knowledge scope between primitives
2. **GuardrailContract** — Quality thresholds (groundedness ≥ 0.8, relevance ≥ 0.7)
3. **RoutingContract** — Model selection rules (GPT-4o for complex, GPT-4o-mini for simple)
4. **HandoffContract** — Agent-to-agent delegation with pre-filled prompts
5. **EvaluationContract** — Automated eval pipeline triggers and threshold gates
6. **CostContract** — Token budgets and spend limits per request/session
7. **SecurityContract** — Content safety filters, RBAC scopes, prompt injection defense
8. **ObservabilityContract** — Tracing, metrics, and log correlation configuration
9. **DeploymentContract** — IaC binding (Bicep/Terraform), region, SKU mapping
10. **LifecycleContract** — Versioning, deprecation, and migration path definitions

### Installation

```bash
# stdio transport (recommended)
npx frootai-mcp@5.2.0

# Streamable HTTP transport
npx frootai-mcp@5.2.0 --transport http --port 3001

# Docker
docker run -p 3001:3001 ghcr.io/frootai/mcp-server:5.2.0

# Python
pip install frootai-mcp
python -m frootai_mcp

# GitHub Actions
- uses: frootai/frootai@v5
  with:
    command: validate
```

### Distribution Channels

| Channel | Package | Install |
|---------|---------|---------|
| npm | `frootai-mcp` | `npx frootai-mcp@5.2.0` |
| PyPI | `frootai-mcp` | `pip install frootai-mcp` |
| VS Code | `frootai.frootai` | Search "FrootAI" in Extensions |
| Docker | `ghcr.io/frootai/mcp-server` | `docker pull ghcr.io/frootai/mcp-server:5.2.0` |
| GitHub Actions | `frootai/frootai@v5` | Add to workflow YAML |
| CLI | `frootai` | `npx frootai` |

### Links

- **Website**: https://frootai.dev
- **GitHub**: https://github.com/frootai/frootai
- **npm**: https://www.npmjs.com/package/frootai-mcp
- **PyPI**: https://pypi.org/project/frootai-mcp/
- **VS Code**: https://marketplace.visualstudio.com/items?itemName=frootai.frootai
- **Docker**: https://github.com/frootai/frootai/pkgs/container/mcp-server

## Category
Developer Tools, AI/ML, Infrastructure

## Tags
mcp, ai, agents, rag, architecture, azure, evaluation, primitives, fai-protocol, bicep, terraform, semantic-kernel, langchain
