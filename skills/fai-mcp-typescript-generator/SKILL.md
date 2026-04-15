---
name: fai-mcp-typescript-generator
description: |
  Generate TypeScript MCP servers with the @modelcontextprotocol/sdk, Zod
  validation, and npm packaging. Use when building MCP servers in TypeScript
  for Node.js-based AI tool integration.
---

# TypeScript MCP Server Generator

Build MCP servers in TypeScript with SDK, Zod validation, and npm packaging.

## When to Use

- Building MCP servers for Node.js environments
- Creating type-safe tools with Zod schema validation
- Publishing MCP servers to npm for distribution
- Integrating with VS Code Copilot or Claude Desktop

---

## Project Setup

```bash
mkdir my-mcp-server && cd my-mcp-server
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install -D typescript @types/node tsx
```

## Server Implementation

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "my-tools", version: "1.0.0" });

server.tool(
  "search_documents",
  "Search knowledge base documents by query",
  { query: z.string().describe("Search query text"),
    limit: z.number().default(5).describe("Max results") },
  async ({ query, limit }) => {
    const results = await searchService.search(query, limit);
    return { content: [{ type: "text",
      text: JSON.stringify(results.map(r => ({
        id: r.id, title: r.title, score: r.score
      }))) }] };
  }
);

server.resource("config://models", "Available models", async () => ({
  contents: [{ uri: "config://models", mimeType: "application/json",
    text: JSON.stringify({ models: ["gpt-4o", "gpt-4o-mini"] }) }],
}));

const transport = new StdioServerTransport();
await server.connect(transport);
```

## package.json

```json
{
  "name": "my-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "bin": { "my-mcp-server": "./dist/index.js" },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

## VS Code MCP Config

```json
{
  "servers": {
    "my-tools": {
      "command": "npx",
      "args": ["my-mcp-server@latest"]
    }
  }
}
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Tool not discovered | Missing server.tool() call | Register tool before connect() |
| Zod validation error | Wrong argument type | Check z.string() vs z.number() |
| ESM import error | Missing "type": "module" | Add to package.json |
| npx not finding binary | Missing bin field | Add bin entry in package.json |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Type all tool parameters | Agent understands expected inputs |
| Write descriptive tool docstrings | Agent matches tasks to tools |
| Validate inputs before processing | Prevent injection and crashes |
| Return structured JSON strings | Consistent parsing by consumers |
| Add error messages in results | Agent can report failures to user |
| Test tools independently | Verify behavior before server integration |

## MCP Transport Options

| Transport | Use Case | Config |
|-----------|----------|--------|
| stdio | VS Code Copilot, Claude Desktop | Default — no setup needed |
| SSE | Web clients, remote access | Add HTTP server endpoint |
| WebSocket | Real-time bidirectional | For streaming-heavy tools |

## Related Skills

- `fai-mcp-python-generator` — Python MCP with FastMCP
- `fai-mcp-typescript-generator` — TypeScript MCP with SDK
- `fai-mcp-csharp-scaffold` — C# MCP with ModelContextProtocol
