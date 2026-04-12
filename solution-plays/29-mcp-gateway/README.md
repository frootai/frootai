# Play 29 — MCP Gateway 🔌

> Build a Model Context Protocol server that exposes your APIs as AI-callable tools.

Create an MCP server that wraps your existing APIs, databases, and services as tools that any AI agent can invoke. Define tool schemas with input validation, expose resources for context, and deploy via stdio (local) or HTTP (remote).

## Quick Start
```bash
cd solution-plays/29-mcp-gateway
npm install @modelcontextprotocol/sdk
npx ts-node src/index.ts  # Start MCP server
code .  # Use @builder for tools/transport, @reviewer for security audit, @tuner for descriptions
```

## Architecture
| Component | Purpose |
|-----------|---------|
| MCP Server (Node.js/Python) | Tool definitions + resource handlers |
| Transport Layer | stdio (local) / HTTP (remote) / SSE |
| Input Validation | JSON Schema per tool input |
| Backend APIs | The services your tools wrap |

## MCP Capabilities
| Capability | What It Provides |
|-----------|-----------------|
| **Tools** | Executable functions the AI agent can call |
| **Resources** | Read-only data attached to chat context |
| **Prompts** | Pre-configured prompt templates |

## Key Metrics
- Tool selection accuracy: ≥90% · Input validation: 100% · Response time: <500ms · Uptime: ≥99.9%

## DevKit (MCP Protocol-Focused)
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (tools/resources/transport), Reviewer (security/validation/injection), Tuner (descriptions/schemas/caching) |
| 3 skills | Deploy (101 lines), Evaluate (103 lines), Tune (100 lines) |
| 4 prompts | `/deploy` (MCP server), `/test` (tool calling), `/review` (security), `/evaluate` (invocation accuracy) |

**Note:** This is a developer tooling/protocol play. TuneKit covers tool description optimization for LLM invocation accuracy, response schema design, transport configuration, caching strategy, and rate limiting — not AI model parameters.

## Cost
| Dev | Prod |
|-----|------|
| $0 (local stdio) | $30–100/mo (Container Apps hosting) |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/29-mcp-gateway](https://frootai.dev/solution-plays/29-mcp-gateway)
