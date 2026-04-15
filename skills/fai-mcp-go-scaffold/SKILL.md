---
name: fai-mcp-go-scaffold
description: |
  Scaffold Go MCP servers with the mcp-go SDK, typed tool handlers, middleware,
  and production deployment. Use when building high-performance MCP servers
  in Go for AI agent tool access.
---

# Go MCP Server Scaffold

Build high-performance MCP servers in Go with typed handlers and middleware.

## When to Use

- Building MCP servers needing low latency and high concurrency
- Exposing Go services as AI agent tools
- Creating MCP servers for infrastructure or DevOps tooling

---

## Project Setup

```bash
mkdir my-mcp-server && cd my-mcp-server
go mod init github.com/org/my-mcp-server
go get github.com/mark3labs/mcp-go
```

## Tool Definition

```go
package main

import (
    "context"
    "encoding/json"
    "github.com/mark3labs/mcp-go/mcp"
    "github.com/mark3labs/mcp-go/server"
)

func searchDocsTool() mcp.Tool {
    return mcp.NewTool("search_documents",
        mcp.WithDescription("Search knowledge base documents by query"),
        mcp.WithString("query", mcp.Required(), mcp.Description("Search query")),
        mcp.WithNumber("top_k", mcp.Description("Results to return")),
    )
}

func searchDocsHandler(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
    query := req.Params.Arguments["query"].(string)
    topK := int(req.Params.Arguments["top_k"].(float64))
    if topK == 0 { topK = 5 }

    results, err := searchService.Search(ctx, query, topK)
    if err != nil {
        return nil, err
    }
    data, _ := json.Marshal(results)
    return mcp.NewToolResultText(string(data)), nil
}
```

## Server Setup

```go
func main() {
    s := server.NewMCPServer("my-mcp-server", "1.0.0")
    s.AddTool(searchDocsTool(), searchDocsHandler)
    s.AddTool(calculateCostTool(), calculateCostHandler)

    if err := server.ServeStdio(s); err != nil {
        log.Fatal(err)
    }
}
```

## Dockerfile

```dockerfile
FROM golang:1.22 AS build
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /mcp-server .

FROM gcr.io/distroless/static
COPY --from=build /mcp-server /mcp-server
ENTRYPOINT ["/mcp-server"]
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Tool not found | Not registered with AddTool | Register tool + handler pair |
| Panic on type assertion | Missing parameter | Check for nil before asserting type |
| High memory under load | No request limits | Add context timeout middleware |
| Binary too large | CGO enabled | Build with CGO_ENABLED=0 |

