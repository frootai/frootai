---
description: "MCP integration patterns — tool description quality, parameter design, error handling, transport selection."
applyTo: "**/*.py, **/*.ts, **/*.cs"
waf:
  - "reliability"
  - "security"
---

# MCP Integration Patterns — FAI Standards

## Tool Design

- Name tools with `verb_noun` pattern: `search_documents`, `create_embedding`, `list_indexes`
- Write descriptions as imperative sentences: "Search documents by semantic query" not "This tool searches documents"
- Define parameters with full JSON Schema — `type`, `description`, `enum` constraints, `default` values
- Mark parameters `required` only when the tool cannot function without them; prefer sensible defaults
- Return structured JSON objects, not stringified blobs — clients parse tool results programmatically

```typescript
// ✅ Preferred: precise schema, verb_noun name, clear descriptions
server.tool("search_documents", {
  query: { type: "string", description: "Natural language search query" },
  top_k: { type: "number", description: "Max results to return (1-100)", default: 10 },
  filter: { type: "string", description: "OData filter expression", optional: true }
}, async ({ query, top_k, filter }) => {
  const results = await index.search(query, { top: top_k, filter });
  return { content: [{ type: "text", text: JSON.stringify(results) }] };
});
```

```python
# ✅ Preferred: FastMCP with typed parameters and docstrings
@mcp.tool()
async def search_documents(query: str, top_k: int = 10, filter: str | None = None) -> list[dict]:
    """Search documents by semantic query. Returns ranked results with scores."""
    results = await index.search(query, top=top_k, filter=filter)
    return [{"id": r.id, "score": r.score, "text": r.text} for r in results]
```

## Resource Templates

- Expose data via resources when content is read-only and URI-addressable
- Use URI templates (RFC 6570) for parameterized resources: `docs://{collection}/{doc_id}`
- Set MIME types explicitly — `application/json` for structured data, `text/plain` for text

```typescript
server.resource("document", new ResourceTemplate("docs://{collection}/{doc_id}", {
  list: async () => ({ resources: collections.flatMap(c => c.docs.map(d => ({
    uri: `docs://${c.name}/${d.id}`, name: d.title, mimeType: "application/json"
  })))}),
  read: async (uri, { collection, doc_id }) => ({
    contents: [{ uri: uri.href, mimeType: "application/json",
      text: JSON.stringify(await getDoc(collection, doc_id)) }]
  })
}));
```

## Prompt Templates

- Define prompt templates for common multi-step workflows the LLM should follow
- Include `arguments` with descriptions so the client can collect inputs before invoking

```python
@mcp.prompt()
def review_code(language: str, code: str) -> list[PromptMessage]:
    """Review code for security, performance, and correctness."""
    return [PromptMessage(role="user", content=TextContent(
        type="text",
        text=f"Review this {language} code for OWASP issues and performance:\n```{language}\n{code}\n```"
    ))]
```

## Transport Selection

- **stdio**: Default for local integrations (VS Code, CLI). Zero config, process lifecycle tied to client
- **Streamable HTTP**: Use for remote/shared servers. Supports multi-tenant, auth headers, horizontal scaling
- SSE transport is deprecated — migrate to Streamable HTTP for new servers
- Never expose stdio servers on a network; never use Streamable HTTP for single-user local tools

## Error Handling

- Throw `McpError` with standard JSON-RPC codes: `InvalidParams` (-32602), `MethodNotFound` (-32601), `InternalError` (-32603)
- Set `isRetryable: true` on transient errors (rate limits, timeouts) so clients can retry
- Return partial results with an error flag rather than failing completely on degraded backends
- Never expose stack traces, secrets, or internal paths in error messages

```typescript
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

if (!query) throw new McpError(ErrorCode.InvalidParams, "query parameter is required");
if (results === null) throw new McpError(ErrorCode.InternalError, "Search backend unavailable", { retryable: true });
```

## Pagination

- For tools returning large result sets, accept `cursor` / `page_token` as optional string parameter
- Return `nextCursor` in the result object; omit it on the final page
- Default page size 20-50 items — never return unbounded results
- Document max page size in the tool description

## Sampling (createMessage)

- Use `server.requestSampling()` / `request_context.session.create_message()` sparingly — only when the server genuinely needs LLM reasoning mid-tool-execution
- Always set `maxTokens` to bound cost; include a descriptive `systemPrompt` for context
- Respect that clients may reject or modify sampling requests — handle `null`/error responses

## Progress Notifications

- For long-running tools (>2s), send progress tokens via `meta.progressToken`
- Report incremental progress: `await server.notification({ method: "notifications/progress", params: { progressToken, progress: i, total: n } })`
- Always send a final progress update when the tool completes

## Tool Composition

- Break complex operations into focused tools — `ingest_document`, `chunk_text`, `create_embedding` — not one monolith
- Let the LLM orchestrate multi-tool workflows; don't hide sequential logic inside a single tool
- Cross-reference tools in descriptions: "Use after `ingest_document` to generate embeddings"

## Security

- Secrets via environment variables or `inputs` in MCP config — never hardcoded, never in tool parameters
- Validate and sanitize all tool inputs at the boundary — reject path traversal, SQL injection, oversized payloads
- Scope file access to an explicit allowlist of directories; reject absolute paths outside the sandbox
- Use `inputs` field in `.vscode/mcp.json` for secrets that prompt the user at connect time
- Audit tool invocations — log tool name, sanitized params, caller identity, timestamp

```jsonc
// .vscode/mcp.json — secrets via inputs, never hardcoded
{
  "servers": {
    "my-search": {
      "command": "npx", "args": ["my-mcp-search"],
      "env": { "SEARCH_KEY": "${input:searchKey}", "SEARCH_ENDPOINT": "${input:searchEndpoint}" },
      "inputs": [
        { "id": "searchKey", "type": "promptString", "description": "Azure AI Search API key", "password": true },
        { "id": "searchEndpoint", "type": "promptString", "description": "Search endpoint URL" }
      ]
    }
  }
}
```

## Testing MCP Servers

- Use `@modelcontextprotocol/inspector` for interactive testing during development
- Write integration tests that spin up the server via stdio, send JSON-RPC requests, assert responses
- Test error paths: missing required params, invalid types, backend failures, oversized inputs
- Validate tool list schema: every tool has `description`, every required param has `description`
- CI: run `npx @modelcontextprotocol/inspector --cli server.js --method tools/list` to verify tool registration

```typescript
// Integration test pattern — spawn server, call tool, assert
const transport = new StdioClientTransport({ command: "node", args: ["server.js"] });
const client = new Client({ name: "test", version: "1.0.0" });
await client.connect(transport);
const result = await client.callTool({ name: "search_documents", arguments: { query: "test" } });
assert(result.content[0].type === "text");
await client.close();
```

## Anti-Patterns

- ❌ Tool names like `doStuff`, `handleRequest`, `process` — use specific `verb_noun` names
- ❌ Single mega-tool with 15+ parameters — decompose into focused tools
- ❌ Returning raw HTML or unstructured prose from tools — return structured JSON
- ❌ Hardcoding API keys in server source or passing secrets as tool parameters
- ❌ Missing `description` on tools or parameters — LLMs cannot choose tools without them
- ❌ Unbounded result sets without pagination — causes context window overflow
- ❌ Using `PreToolUse` hooks for validation (5s delay per call) — validate inside the tool
- ❌ Exposing stdio servers over HTTP without auth — use Streamable HTTP with proper auth
- ❌ Swallowing errors silently — always return `McpError` or `isError: true` in content
- ❌ Logging full user prompts or tool arguments containing PII

## WAF Alignment

| Pillar | MCP Patterns |
|--------|-------------|
| **Reliability** | `McpError` with `isRetryable`, progress notifications for long ops, graceful degradation on backend failure, connection health monitoring |
| **Security** | Secrets via env/inputs (never in code), input validation at tool boundary, scoped file access, audit logging, no PII in error messages |
| **Cost Optimization** | Pagination to limit token usage, `maxTokens` on sampling requests, tool decomposition (invoke only what's needed), cache resource reads |
| **Operational Excellence** | MCP Inspector for dev testing, CI tool-list validation, structured JSON logging with correlation IDs, version-pinned `npx` commands |
| **Performance Efficiency** | Streaming transport for remote, stdio for local, progress tokens for UX, async tool handlers, batch parameters where applicable |
| **Responsible AI** | Content safety checks in tools returning LLM output, transparency via tool descriptions, human-in-the-loop via sampling approval |
