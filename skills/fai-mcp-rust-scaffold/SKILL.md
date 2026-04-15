---
name: fai-mcp-rust-scaffold
description: |
  Scaffold Rust MCP servers with the mcp-rust SDK, async tool handlers,
  and zero-copy JSON processing. Use when building high-performance MCP
  servers with memory safety guarantees.
---

# Rust MCP Server Scaffold

Build high-performance MCP servers in Rust with async handlers.

## When to Use

- Building MCP servers needing maximum performance
- Memory-safe tool handlers with zero-copy JSON
- Systems-level MCP integration (CLI tools, infrastructure)

---

## Project Setup

```bash
cargo new my-mcp-server
cd my-mcp-server
cargo add mcp-rust tokio serde serde_json
```

## Tool Handler

```rust
use mcp_rust::{Tool, ToolResult, McpServer};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Deserialize)]
struct SearchArgs {
    query: String,
    #[serde(default = "default_limit")]
    limit: usize,
}

fn default_limit() -> usize { 5 }

#[derive(Serialize)]
struct SearchResult {
    id: String,
    title: String,
    score: f64,
}

async fn search_handler(args: SearchArgs) -> Result<ToolResult, Box<dyn std::error::Error>> {
    let results = search_service::search(&args.query, args.limit).await?;
    let json = serde_json::to_string(&results)?;
    Ok(ToolResult::text(json))
}
```

## Server Setup

```rust
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut server = McpServer::new("my-mcp-server", "1.0.0");

    server.add_tool(Tool::new(
        "search_documents",
        "Search knowledge base documents",
        json!({
            "type": "object",
            "properties": {
                "query": { "type": "string", "description": "Search query" },
                "limit": { "type": "integer", "description": "Max results" }
            },
            "required": ["query"]
        }),
        search_handler,
    ));

    server.serve_stdio().await
}
```

## Cargo.toml

```toml
[dependencies]
mcp-rust = "0.3"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Compile error on async | Missing tokio runtime | Add `#[tokio::main]` and tokio dependency |
| Deserialization fails | Field name mismatch | Use `#[serde(rename)]` for JSON field names |
| Binary too large | Debug symbols | Build with `--release` |
| Lifetime errors | Borrowed data in handler | Use owned types (String, not &str) |
