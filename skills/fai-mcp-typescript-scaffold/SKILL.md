---
name: fai-mcp-typescript-scaffold
description: |
  Scaffold TypeScript MCP server projects with SDK integration, typed tools,
  resource handlers, and deployment configuration. Use when creating MCP
  servers with full project structure and build pipeline.
---

# TypeScript MCP Scaffold

Scaffold complete MCP server projects with TypeScript, build pipeline, and deployment.

## When to Use

- Starting a new MCP server project from scratch
- Setting up project structure with tests and CI
- Creating MCP servers with multiple tools and resources
- Publishing to npm as an executable package

---

## Project Structure

```
my-mcp-server/
├── src/
│   ├── index.ts           # Server entry + transport
│   ├── tools/
│   │   ├── search.ts      # Search tool
│   │   └── analyze.ts     # Analysis tool
│   └── resources/
│       └── config.ts      # Resource handlers
├── tests/
│   └── tools.test.ts
├── tsconfig.json
├── package.json
├── Dockerfile
└── README.md
```

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true
  },
  "include": ["src"]
}
```

## Tool Module Pattern

```typescript
// src/tools/search.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerSearchTools(server: McpServer) {
  server.tool(
    "search_docs",
    "Search documentation by query",
    { query: z.string(), limit: z.number().default(5) },
    async ({ query, limit }) => {
      const results = await doSearch(query, limit);
      return { content: [{ type: "text", text: JSON.stringify(results) }] };
    }
  );
}
```

## Entry Point

```typescript
// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSearchTools } from "./tools/search.js";

const server = new McpServer({ name: "my-tools", version: "1.0.0" });
registerSearchTools(server);

await server.connect(new StdioServerTransport());
```

## Dockerfile

```dockerfile
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
RUN npm ci --production
ENTRYPOINT ["node", "dist/index.js"]
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Import errors | Wrong moduleResolution | Use NodeNext for ESM |
| Build fails | Missing type declarations | Add "declaration": true |
| Docker image large | Dev deps in production | Use npm ci --production |
| Tool registration order | Tools added after connect | Register before server.connect() |
