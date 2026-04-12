---
name: deploy-mcp-gateway
description: "Deploy MCP Gateway — build MCP server with tool definitions, resource handlers, transport (stdio/HTTP/SSE), input validation, sandboxing. Use when: deploy, build MCP server."
---

# Deploy MCP Gateway

## When to Use
- Build a custom MCP server wrapping your APIs as AI-callable tools
- Configure transport (stdio for local, HTTP for remote)
- Define tool schemas with input validation
- Expose resources and prompts via MCP protocol
- Deploy as reusable AI tooling service

## Prerequisites
1. Node.js 18+ or Python 3.10+ (MCP runtime)
2. Target APIs/services to wrap as MCP tools
3. MCP SDK: `npm install @modelcontextprotocol/sdk`

## Step 1: Define Server Structure
```
mcp-gateway/
├── src/
│   ├── index.ts          # Server entry point
│   ├── tools/            # Tool handlers
│   ├── resources/        # Resource providers
│   └── prompts/          # Prompt templates
├── package.json
└── tsconfig.json
```

## Step 2: Implement Tool Definitions
```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "search_knowledge_base",
    description: "Search internal KB for documents matching query",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        top_k: { type: "number", default: 5 }
      },
      required: ["query"]
    }
  }]
}));
```

## Step 3: Configure Transport
| Transport | Use Case | Config |
|-----------|----------|--------|
| stdio | Local dev, VS Code | `"type": "stdio"` |
| HTTP Stream | Remote servers | `"type": "http", "url": "..."` |
| SSE | Legacy clients | `"type": "sse"` |

## Step 4: Input Validation & Security
| Check | Purpose |
|-------|---------|
| JSON Schema validation | Prevent malformed requests |
| Input sanitization | Prevent injection attacks |
| Rate limiting (60/min) | Prevent abuse |
| Domain allowlist | Limit API scope |
| Output size limit (10KB) | Prevent context overflow |

## Step 5: Expose Resources
```typescript
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [{ uri: "config://settings", name: "Config", mimeType: "application/json" }]
}));
```

## Step 6: Deploy
```bash
# Local: npx ts-node src/index.ts
# Remote: docker build + az containerapp create
```

## Step 7: Register in VS Code
```json
{ "servers": { "myGateway": { "command": "npx", "args": ["ts-node", "src/index.ts"] } } }
```

## Post-Deployment Verification
- [ ] Server lists tools correctly
- [ ] Tool invocations return expected results
- [ ] Input validation blocks malformed requests
- [ ] Resources accessible via MCP
- [ ] Transport working (stdio or HTTP)
- [ ] Errors return structured responses

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Tools not appearing | Server not in mcp.json | Add to .vscode/mcp.json |
| Tool fails silently | No error handler | Add try/catch with MCP error |
| LLM calls wrong tool | Description unclear | Improve tool description |
| Response too large | No output limit | Truncate to 10KB |
| Transport drops | HTTP timeout | Add keepalive |
| Input injection | No validation | Add JSON Schema |
