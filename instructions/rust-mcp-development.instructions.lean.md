---
description: "Rust MCP server development — rmcp SDK, tokio, proc macros, serde, and high-performance tool serving."
applyTo: "**/*.rs"
waf:
  - "performance-efficiency"
  - "security"
---

# Rust MCP Server Development — FAI Standards

## Cargo.toml Dependencies

```toml
[dependencies]
rmcp = { version = "0.1", features = ["server", "transport-io"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "2"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["json", "env-filter"] }

[dev-dependencies]
tokio-test = "0.4"
```

## Server Struct & Tool Registration

```rust
use rmcp::{ServerHandler, model::*, tool, Error as McpError};
use serde::{Deserialize, Serialize};

#[derive(Clone)]
pub struct MyMcpServer {
    config: AppConfig,
}

#[derive(Clone, Deserialize)]
struct AppConfig {
    max_results: usize,
    timeout_ms: u64,
}

// Tool input — serde handles JSON schema generation via rmcp macros
#[derive(Deserialize, schemars::JsonSchema)]
struct SearchInput {
    query: String,
    #[serde(default = "default_limit")]
    limit: usize,
}
fn default_limit() -> usize { 10 }

#[tool(tool_box)]
impl MyMcpServer {
    #[tool(description = "Search documents by semantic query")]
    async fn search(&self, #[tool(aggr)] input: SearchInput) -> Result<CallToolResult, McpError> {
        // Validate at system boundary — reject before processing
        if input.query.trim().is_empty() {
            return Err(McpError::invalid_params("query must not be empty", None));
        }
        let limit = input.limit.min(self.config.max_results);
        let results = do_search(&input.query, limit).await?;
        Ok(CallToolResult::success(vec![Content::text(
            serde_json::to_string(&results)?,
        )]))
    }
}

#[tool(tool_box)]
impl ServerHandler for MyMcpServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            name: "my-mcp-server".into(),
            version: env!("CARGO_PKG_VERSION").into(),
            ..Default::default()
        }
    }
}
```

## Entrypoint — Stdio Transport + Graceful Shutdown

```rust
use rmcp::transport::io::stdio;
use tokio::signal;
use tracing_subscriber::{fmt, EnvFilter};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Logs to stderr — stdout reserved for MCP JSON-RPC
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .with_writer(std::io::stderr)
        .json()
        .init();

    let config: AppConfig = serde_json::from_str(
        &std::fs::read_to_string("config/server.json")
            .expect("config/server.json required"),
    )?;

    let server = MyMcpServer { config };
    let transport = stdio();
    let handle = server.serve(transport).await?;

    // Graceful shutdown on SIGINT/SIGTERM
    tokio::select! {
        _ = signal::ctrl_c() => {
            tracing::info!("shutdown signal received");
            handle.shutdown().await?;
        }
        res = handle.waiting() => {
            if let Err(e) = res {
                tracing::error!(error = %e, "server error");
            }
        }
    }
    Ok(())
}
```

## Error Handling — thiserror + McpError

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("search failed: {0}")]
    SearchFailed(String),
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

// Convert domain errors into MCP-level errors
impl From<AppError> for McpError {
    fn from(e: AppError) -> Self {
        tracing::error!(error = %e, "tool execution failed");
        McpError::internal_error(e.to_string(), None)
    }
}
```

## Resource Handlers

```rust
#[tool(tool_box)]
impl ServerHandler for MyMcpServer {
    async fn read_resource(
        &self,
        ReadResourceRequest { uri, .. }: ReadResourceRequest,
    ) -> Result<ReadResourceResult, McpError> {
        let path = uri.path();
        let content = tokio::fs::read_to_string(path)
            .await
            .map_err(|e| McpError::invalid_params(format!("cannot read {path}: {e}"), None))?;
        Ok(ReadResourceResult {
            contents: vec![ResourceContents::text(content, uri)],
        })
    }
}
```

## Prompt Templates

```rust
#[tool(tool_box)]
impl ServerHandler for MyMcpServer {
    async fn list_prompts(&self) -> Result<ListPromptsResult, McpError> {
        Ok(ListPromptsResult {
            prompts: vec![Prompt::new("summarize", "Summarize a document")
                .arg("text", true, "The text to summarize")],
        })
    }

    async fn get_prompt(&self, req: GetPromptRequest) -> Result<GetPromptResult, McpError> {
        let text = req.argument("text")
            .ok_or_else(|| McpError::invalid_params("missing 'text' argument", None))?;
        Ok(GetPromptResult::new(vec![PromptMessage::user(Content::text(
            format!("Summarize the following:\n\n{text}"),
        ))]))
    }
}
```

## Testing

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> AppConfig {
        AppConfig { max_results: 5, timeout_ms: 1000 }
    }

    #[tokio::test]
    async fn search_rejects_empty_query() {
        let server = MyMcpServer { config: test_config() };
        let input = SearchInput { query: "".into(), limit: 10 };
        let result = server.search(input).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn search_clamps_limit_to_max() {
        let server = MyMcpServer { config: test_config() };
        let input = SearchInput { query: "test".into(), limit: 999 };
        // limit should be clamped to config.max_results (5)
        let result = server.search(input).await;
        assert!(result.is_ok());
    }
}
```

## Anti-Patterns

- ❌ `println!` in MCP servers — stdout is the JSON-RPC transport; use `tracing` to stderr
- ❌ `unwrap()` / `expect()` in tool handlers — panics crash the server; return `McpError`
- ❌ Blocking I/O in async context — use `tokio::fs` / `tokio::task::spawn_blocking`
- ❌ Unbounded `Vec` collection without input limits — always clamp with `.min(max)`
- ❌ Hardcoded secrets in source — load from env vars or config files, never compile in
- ❌ Missing `#[derive(Deserialize)]` validation — raw strings bypass type safety
- ❌ Ignoring `SIGTERM` — container orchestrators expect graceful drain within 30s
- ❌ `String` error types instead of `thiserror` enums — loses context and match-ability

## WAF Alignment

| Pillar | Rust MCP Implementation |
|--------|------------------------|
| **Security** | Input validation via serde + custom checks at handler boundary; secrets from env/config only; no `unsafe` without audit; `cargo audit` in CI |
| **Reliability** | `thiserror` enums for typed errors; `tokio::select!` graceful shutdown; structured `Result<T, McpError>` propagation; no panics in handlers |
| **Performance** | Zero-copy serde deserialization; async I/O via tokio; bounded concurrency with `tokio::sync::Semaphore`; connection reuse |
| **Cost Optimization** | Config-driven limits (`max_results`, `timeout_ms`); early rejection of invalid input; batch-capable tool design |
| **Operational Excellence** | `tracing` structured JSON logs to stderr; `RUST_LOG` env filter; `env!("CARGO_PKG_VERSION")` in ServerInfo; `cargo test` + `cargo clippy` in CI |
| **Responsible AI** | Validate and sanitize all user input before LLM forwarding; log tool invocations without PII; document tool descriptions accurately |
