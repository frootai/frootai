---
description: "TypeScript MCP server development standards — @modelcontextprotocol/sdk patterns, Zod parameter schemas, McpServer class, stdio/SSE transports, and npm publishing for distribution."
applyTo: "**/*.ts, **/*.mts"
waf:
  - "security"
  - "reliability"
  - "performance-efficiency"
---

# TypeScript MCP Server Development — FAI Standards

## Server Bootstrap & Transport

Initialize with `Server` class, declare capabilities, connect via `StdioServerTransport`:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema, ListToolsRequestSchema,
  ListResourcesRequestSchema, ReadResourceRequestSchema,
  ListPromptsRequestSchema, GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "my-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {}, resources: {}, prompts: {} } }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[mcp] server started"); // stderr — never stdout
```

- `ServerCapabilities` keys: `tools`, `resources`, `prompts`, `logging` — only declare what you implement
- All user-visible logging goes to `console.error` (stderr) — stdout is reserved for JSON-RPC

## Tool Registration with Zod Validation

Register tools via paired `ListTools` + `CallTool` handlers. Use `zod` for input schemas:

```typescript
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

const SearchSchema = z.object({
  query: z.string().min(1).max(500).describe("Search query text"),
  top_k: z.number().int().min(1).max(50).default(10),
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "search_documents",
    description: "Search indexed documents by semantic similarity",
    inputSchema: zodToJsonSchema(SearchSchema),
  }],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "search_documents") {
    const parsed = SearchSchema.safeParse(request.params.arguments);
    if (!parsed.success) {
      throw new McpError(ErrorCode.InvalidParams, parsed.error.message);
    }
    const results = await searchIndex(parsed.data.query, parsed.data.top_k);
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  }
  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
});
```

- Always `safeParse` — never `parse` (throw-on-error leaks internal schema details)
- One `CallToolRequestSchema` handler dispatches all tools — use switch/map for >3 tools
- Return `isError: true` in content for recoverable failures the LLM should see

## Resource Handlers

Expose files, DB records, or API data as browsable resources:

```typescript
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [{
    uri: "config://openai",
    name: "OpenAI Configuration",
    mimeType: "application/json",
  }],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  if (uri === "config://openai") {
    const config = await fs.readFile("config/openai.json", "utf8");
    return { contents: [{ uri, mimeType: "application/json", text: config }] };
  }
  throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
});
```

For binary/image content, return base64 with `blob` field instead of `text`:

```typescript
return { contents: [{ uri, mimeType: "image/png", blob: buffer.toString("base64") }] };
```

## Prompt Templates

Expose reusable prompt templates that clients can discover and fill:

```typescript
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [{
    name: "review_code",
    description: "Security-focused code review prompt",
    arguments: [{ name: "language", description: "Programming language", required: true }],
  }],
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name === "review_code") {
    return {
      messages: [{
        role: "user",
        content: { type: "text", text: `Review this ${request.params.arguments?.language} code for OWASP Top 10 vulnerabilities.` },
      }],
    };
  }
  throw new McpError(ErrorCode.InvalidRequest, `Unknown prompt: ${request.params.name}`);
});
```

## Error Handling

Use `McpError` with specific `ErrorCode` values — never throw raw `Error`:

```typescript
// ErrorCode enum: InvalidRequest, MethodNotFound, InvalidParams, InternalError
throw new McpError(ErrorCode.InvalidParams, "query must be non-empty");
throw new McpError(ErrorCode.InternalError, "upstream API unavailable");
```

Wrap external calls with try/catch — surface actionable messages, never stack traces:

```typescript
try {
  return await externalApi.call(params);
} catch (err) {
  console.error("[mcp] external call failed:", (err as Error).message);
  throw new McpError(ErrorCode.InternalError, "Service temporarily unavailable");
}
```

## Progress Notifications

For long-running tools, send progress updates via the `server.notification` method:

```typescript
const { progressToken } = request.params._meta ?? {};
if (progressToken !== undefined) {
  for (let i = 0; i < chunks.length; i++) {
    await server.notification({ method: "notifications/progress", params: { progressToken, progress: i + 1, total: chunks.length } });
    await processChunk(chunks[i]);
  }
}
```

## Testing with Vitest

Test tools using in-memory client/server transport pairs:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, it, expect } from "vitest";

describe("search_documents tool", () => {
  it("returns results for valid query", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: "test", version: "1.0.0" });
    await client.connect(clientTransport);

    const result = await client.callTool({ name: "search_documents", arguments: { query: "test" } });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
  });

  it("rejects empty query with InvalidParams", async () => {
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await server.connect(st);
    const client = new Client({ name: "test", version: "1.0.0" });
    await client.connect(ct);
    await expect(client.callTool({ name: "search_documents", arguments: { query: "" } }))
      .rejects.toMatchObject({ code: -32602 }); // InvalidParams
  });
});
```

## Distribution — npx Pattern

Configure `package.json` for `npx` execution and npm publishing:

```jsonc
{
  "name": "my-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "bin": { "my-mcp-server": "./dist/index.js" },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  }
}
```

- Add `#!/usr/bin/env node` as first line of entry file
- Users install via: `npx my-mcp-server@latest` or `npm i -g my-mcp-server`
- MCP client config: `{ "command": "npx", "args": ["-y", "my-mcp-server@latest"] }`
- Use `inputs` for secrets in `.vscode/mcp.json` — never hardcode API keys

## Anti-Patterns

- ❌ Writing to `stdout` for logging — breaks JSON-RPC framing, use `console.error`
- ❌ Using `z.parse()` instead of `z.safeParse()` — leaks schema internals in error messages
- ❌ Throwing raw `Error` instead of `McpError` — clients can't distinguish error categories
- ❌ Declaring unused capabilities (e.g., `prompts: {}` with no prompt handlers)
- ❌ Hardcoding secrets in source — use `process.env` + `inputs` in MCP client config
- ❌ Skipping `bin` field in `package.json` — `npx` execution fails silently
- ❌ Returning unbounded results without pagination — context window overflow
- ❌ Missing shebang (`#!/usr/bin/env node`) — cross-platform execution fails

## WAF Alignment

| Pillar | MCP Server Practice |
|--------|-------------------|
| **Security** | `safeParse` all inputs, `McpError` for controlled errors, env vars for secrets, validate URIs in resource handlers |
| **Reliability** | Try/catch on all external calls, `ErrorCode.InternalError` with actionable messages, graceful `SIGTERM` handling |
| **Performance** | Progress notifications for long ops, streaming where supported, in-memory caching with TTL, batch tool results |
| **Cost** | Token-aware responses (truncate large results), model routing via config, cache repeated lookups |
| **Ops Excellence** | Structured stderr logging, vitest coverage in CI, `npx` distribution, semver versioning |
| **Responsible AI** | Content safety before returning LLM outputs, PII redaction in logs, rate limiting per client |
