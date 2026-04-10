---
description: "MCP Gateway domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# MCP Gateway — Domain Knowledge

This workspace implements an MCP (Model Context Protocol) gateway — a centralized server that exposes tools, resources, and prompts to MCP-compatible clients (VS Code, Claude, Cursor, etc.).

## MCP Architecture (What the Model Gets Wrong)

### MCP Server Structure (stdio transport)
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "enterprise-tools", version: "1.0.0" });

// Register a tool
server.tool("lookup_customer", { customerId: z.string() }, async ({ customerId }) => {
  const customer = await db.query("SELECT * FROM customers WHERE id = $1", [customerId]);
  return { content: [{ type: "text", text: JSON.stringify(customer) }] };
});

// Register a resource (data the client can read)
server.resource("config://settings", async () => ({
  contents: [{ uri: "config://settings", text: JSON.stringify(appConfig) }],
}));

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

### Tool Design Principles
| Principle | Description | Example |
|-----------|------------|---------|
| Single responsibility | One tool = one action | `lookup_customer` not `manage_customers` |
| Typed parameters | Zod schema for all inputs | `{ id: z.string().uuid() }` |
| Structured response | Always return `{ content: [{ type: "text", text: "..." }] }` | Not raw strings |
| Idempotent reads | GET-like tools safe to retry | `lookup_customer` = safe |
| Confirmation for writes | Destructive tools require user approval | `delete_customer` = confirm first |

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| HTTP transport in VS Code | VS Code uses stdio, not HTTP | Use StdioServerTransport for VS Code |
| No input validation | LLM sends malformed params | Zod schemas on all tool inputs |
| Tools that do too much | "manage_users" = ambiguous | Split: create_user, get_user, delete_user |
| No error handling | Crash kills MCP connection | Try/catch in every tool handler |
| Returning raw errors | LLM sees stack trace | Return user-friendly error messages |
| No rate limiting | LLM calls tool in loop | Track call count, limit per session |
| Hardcoded secrets | Secrets in tool code | Read from env vars or Key Vault |
| No tool descriptions | LLM can't decide which tool to use | Detailed description + parameter docs |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | Model for tool selection heuristics |
| `config/guardrails.json` | Rate limits, allowed tools per role, audit settings |
| `config/agents.json` | Tool registration, permission model |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement MCP server, tools, resources, transport |
| `@reviewer` | Audit tool security, input validation, error handling |
| `@tuner` | Optimize tool descriptions, response format, performance |

## Slash Commands
`/deploy` — Deploy MCP server | `/test` — Test tools | `/review` — Audit security | `/evaluate` — Measure tool reliability
