---
description: "Go MCP server development — go-sdk/mcp, struct-based I/O, context handling."
applyTo: "**/*.go"
waf:
  - "performance-efficiency"
  - "reliability"
---

# Go MCP Server Development — FAI Standards

> Building MCP servers in Go using `mark3labs/mcp-go` — tool registration, resource handlers, stdio transport, structured logging, and production patterns.

## Go Module Structure

```
my-mcp-server/
├── go.mod                    # module github.com/org/my-mcp-server
├── main.go                   # entry point — server bootstrap + signal handling
├── tools/                    # one file per tool domain
│   ├── search.go
│   └── documents.go
├── resources/                # resource + template handlers
│   └── configs.go
├── prompts/                  # prompt template definitions
│   └── templates.go
├── internal/                 # unexported helpers — validation, clients
│   ├── validate.go
│   └── client.go
└── tools_test.go             # test file co-located or in _test package
```

- One `tools.AddTool()` call per tool — never register tools in `init()`
- Group related tools in domain files, keep `main.go` as pure wiring

## Server Bootstrap (stdio Transport)

```go
package main

import (
"context"
"log/slog"
"os"
"os/signal"
"syscall"

"github.com/mark3labs/mcp-go/mcp"
"github.com/mark3labs/mcp-go/server"
)

func main() {
logger := slog.New(slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo}))
slog.SetDefault(logger)

s := server.NewMCPServer("my-server", "1.0.0",
server.WithLogging(),
)
registerTools(s)
registerResources(s)
registerPrompts(s)

ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
defer stop()

if err := server.ServeStdio(s, server.WithContext(ctx)); err != nil {
slog.Error("server exited", "error", err)
os.Exit(1)
}
}
```

- Always log to `os.Stderr` — stdout is the MCP JSON-RPC transport
- Use `signal.NotifyContext` for graceful shutdown — never `os.Exit` in handlers
- Pass `context.Context` through every handler for cancellation propagation

## Tool Registration with JSON Schema Validation

```go
func registerTools(s *server.MCPServer) {
searchTool := mcp.NewTool("search_docs",
mcp.WithDescription("Search documents by query and optional filters"),
mcp.WithString("query",
mcp.Required(),
mcp.Description("Search query string"),
mcp.MaxLength(500),
),
mcp.WithNumber("limit",
mcp.Description("Max results to return"),
mcp.DefaultNumber(10),
mcp.Min(1),
mcp.Max(100),
),
)
s.AddTool(searchTool, handleSearchDocs)
}
```

- Define input schemas declaratively — mcp-go generates JSON Schema from `mcp.With*` helpers
- Always set `mcp.Required()` on mandatory params, `mcp.Description()` on all params
- Use `mcp.Min/Max/MaxLength/Enum` constraints — reject bad input at the schema level

## Tool Handler Pattern

```go
func handleSearchDocs(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
query, _ := req.Params.Arguments["query"].(string)
if query == "" {
return mcp.NewToolResultError("query is required"), nil
}
limit := 10
if v, ok := req.Params.Arguments["limit"].(float64); ok {
limit = int(v)
}

results, err := doSearch(ctx, query, limit)
if err != nil {
slog.ErrorContext(ctx, "search failed", "query", query, "error", err)
return mcp.NewToolResultError("internal search error"), nil
}

out, _ := json.Marshal(results)
return mcp.NewToolResultText(string(out)), nil
}
```

- Return `(*mcp.CallToolResult, error)` — return `mcp.NewToolResultError()` for user-facing errors, Go `error` only for transport failures
- Extract arguments via type assertion from `req.Params.Arguments` map — JSON numbers decode as `float64`
- Always pass `ctx` to downstream calls for timeout/cancellation propagation
- Log with `slog.ErrorContext` — never `fmt.Println` or `log.Fatal` inside handlers

## Resource Handlers

```go
func registerResources(s *server.MCPServer) {
s.AddResource(mcp.NewResource(
"config://app/settings",
"Application settings",
mcp.WithMIMEType("application/json"),
), handleGetSettings)

s.AddResourceTemplate(mcp.NewResourceTemplate(
"docs://articles/{id}",
"Article by ID",
), handleGetArticle)
}

func handleGetSettings(ctx context.Context, req mcp.ReadResourceRequest) ([]mcp.ResourceContents, error) {
data, err := os.ReadFile("config/settings.json")
if err != nil {
return nil, fmt.Errorf("read settings: %w", err)
}
return []mcp.ResourceContents{mcp.NewTextResourceContents(req.Params.URI, "application/json", string(data))}, nil
}
```

## Prompt Templates

```go
func registerPrompts(s *server.MCPServer) {
s.AddPrompt(mcp.NewPrompt("summarize",
mcp.WithPromptDescription("Summarize a document"),
mcp.WithArgument("content", mcp.ArgumentDescription("Text to summarize"), mcp.RequiredArgument()),
mcp.WithArgument("style", mcp.ArgumentDescription("Summary style: brief|detailed")),
), handleSummarizePrompt)
}

func handleSummarizePrompt(ctx context.Context, req mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
content := req.Params.Arguments["content"]
style := req.Params.Arguments["style"]
if style == "" {
style = "brief"
}
return mcp.NewGetPromptResult(
"Summarize the following document",
mcp.NewPromptMessage(mcp.RoleUser, mcp.NewTextContent(
fmt.Sprintf("Summarize this text in a %s style:\n\n%s", style, content),
)),
), nil
}
```

## Structured Logging (slog)

- Use `log/slog` with `slog.NewJSONHandler(os.Stderr, ...)` — JSON to stderr, never stdout
- Add request context: `slog.With("tool", toolName, "request_id", rid)`
- Log levels: `Info` for tool invocations, `Error` for failures, `Debug` for argument details
- Never log full user prompts or PII — redact before logging

## Error Handling

- Schema validation errors → mcp-go rejects automatically before handler runs
- Business logic errors → return `mcp.NewToolResultError("descriptive message"), nil`
- Infrastructure errors → return `nil, fmt.Errorf("context: %w", err)` (transport-level failure)
- Never panic in handlers — recover at server level if needed
- Wrap errors with `%w` for unwrapping; include operation context in message

## Testing MCP Tools

```go
func TestHandleSearchDocs(t *testing.T) {
ctx := context.Background()
req := mcp.CallToolRequest{}
req.Params.Arguments = map[string]any{
"query": "kubernetes",
"limit": float64(5), // JSON number = float64
}
result, err := handleSearchDocs(ctx, req)
if err != nil {
t.Fatalf("unexpected error: %v", err)
}
if result.IsError {
t.Fatalf("tool returned error: %v", result.Content)
}
}
```

- Test handlers directly — they are plain functions with `(context.Context, mcp.CallToolRequest) → (*mcp.CallToolResult, error)`
- Use table-driven tests for input validation edge cases (missing required, invalid types, boundary values)
- For integration tests, use `server.NewTestClient(s)` to exercise the full JSON-RPC flow
- Mock external dependencies via interfaces — inject via struct fields, not globals

## Anti-Patterns

- ❌ Logging to stdout — corrupts the MCP JSON-RPC transport
- ❌ Using `log.Fatal`/`os.Exit` inside tool handlers — kills server on single request failure
- ❌ Global mutable state shared across tool handlers without synchronization
- ❌ Ignoring `context.Context` — breaks cancellation, timeout, and tracing propagation
- ❌ Returning Go `error` for business validation — use `mcp.NewToolResultError` instead
- ❌ Registering tools in `init()` — makes testing and conditional registration impossible
- ❌ Raw string argument extraction without type assertion guards — panics on missing keys
- ❌ Blocking the handler goroutine with unbounded operations — always use `ctx.Done()` checks

## WAF Alignment

| Pillar | Go MCP Server Practice |
|--------|----------------------|
| **Reliability** | `signal.NotifyContext` graceful shutdown; `context.Context` propagation; error wrapping with `%w`; no panics in handlers |
| **Security** | Schema-level input validation via `mcp.Required/Max/Enum`; never log PII; secrets from env vars or Key Vault; sanitize all user input before downstream calls |
| **Performance** | Stdio transport is zero-overhead; reuse HTTP clients via `sync.Pool` or struct fields; stream large results; keep handlers non-blocking |
| **Cost Optimization** | Limit result sizes via schema `Max` constraints; cache expensive lookups; batch downstream API calls where possible |
| **Operational Excellence** | Structured JSON logging to stderr with `slog`; correlation IDs in log attributes; `go vet`/`staticcheck` in CI; version in `server.NewMCPServer` for client discovery |
| **Responsible AI** | Validate and sanitize LLM inputs in tool handlers; Content Safety checks before returning AI-generated content; document tool descriptions accurately for model grounding |