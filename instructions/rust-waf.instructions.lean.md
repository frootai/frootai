---
description: "Rust coding standards — ownership, lifetimes, Result<T,E>, serde, tokio async, and memory safety patterns."
applyTo: "**/*.rs"
waf:
  - "security"
  - "performance-efficiency"
  - "reliability"
---

# Rust — FAI Standards

## Ownership & Borrowing

- Prefer borrowing (`&T`, `&mut T`) over cloning — clone only when ownership transfer is truly needed
- Use `Cow<'_, str>` when a function may or may not need to allocate
- Keep borrow scopes as short as possible — drop locks and refs before awaiting
- Avoid `Rc<RefCell<T>>` spaghetti — redesign with channels or owned data if borrow checker fights you

```rust
// ✅ Borrow instead of clone — zero-copy where possible
fn process(data: &[u8]) -> Result<Report> {
    let header = parse_header(data)?; // borrows slice
    validate(&header)?;
    Ok(Report::from(header))
}

// ✅ Cow for conditional allocation
fn normalize(input: &str) -> Cow<'_, str> {
    if input.contains('\t') {
        Cow::Owned(input.replace('\t', "    "))
    } else {
        Cow::Borrowed(input)
    }
}
```

## Error Handling

- Libraries: use `thiserror` for typed, enum-based errors with `#[error("...")]`
- Applications: use `anyhow` with `.context("what failed")` for rich backtraces
- Propagate with `?` — never `.unwrap()` in library code or production paths
- Reserve `.expect("reason")` for truly impossible states with an explaining message

```rust
// Library error — callers can match variants
#[derive(Debug, thiserror::Error)]
pub enum IngestError {
    #[error("document too large: {size} bytes (max {max})")]
    TooLarge { size: usize, max: usize },
    #[error("unsupported format: {0}")]
    UnsupportedFormat(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

// Application error — context chain for debugging
async fn index_document(path: &Path) -> anyhow::Result<()> {
    let bytes = tokio::fs::read(path)
        .await
        .with_context(|| format!("reading {}", path.display()))?;
    let doc = parse(&bytes).context("parsing document")?;
    store(doc).await.context("storing in search index")
}
```

## Result & Option Patterns

- Use `Option::ok_or_else` to convert missing values into errors with context
- Chain with `.map()`, `.and_then()`, `.unwrap_or_default()` — avoid nested `match`
- Return `Result` from `main()` for clean exit-code propagation

## Traits & Generics

- Prefer generics (`impl Trait` / `<T: Trait>`) for zero-cost static dispatch
- Use `dyn Trait` only when you need runtime polymorphism (plugin systems, heterogeneous collections)
- Implement `Display` for user-facing output, `Debug` for developer diagnostics
- Derive `Clone`, `Debug`, `Serialize`, `Deserialize` only when actually needed

```rust
// Static dispatch — monomorphized, zero overhead
fn embed(encoder: &impl Encoder, text: &str) -> Vec<f32> {
    encoder.encode(text)
}

// Dynamic dispatch — when types are decided at runtime
fn load_plugins(dir: &Path) -> Vec<Box<dyn Plugin>> {
    // heterogeneous collection requires trait objects
}
```

## Async with Tokio

- Use `#[tokio::main]` for binaries, `#[tokio::test]` for async tests
- Prefer `tokio::spawn` for CPU-light concurrent tasks; use `spawn_blocking` for CPU-heavy or blocking I/O
- Use `tokio::select!` for racing futures (timeouts, graceful shutdown)
- Channels: `mpsc` for fan-in, `broadcast` for fan-out, `watch` for config reload

```rust
use tokio::signal;
use tokio::sync::mpsc;

async fn run(mut rx: mpsc::Receiver<Job>) -> anyhow::Result<()> {
    loop {
        tokio::select! {
            Some(job) = rx.recv() => process(job).await?,
            _ = signal::ctrl_c() => {
                tracing::info!("shutting down gracefully");
                break;
            }
        }
    }
    Ok(())
}
```

## Serialization with Serde

- Derive `Serialize`/`Deserialize` — use `#[serde(rename_all = "camelCase")]` for JSON APIs
- `#[serde(deny_unknown_fields)]` on config structs to catch typos at load time
- `#[serde(default)]` for optional fields with sensible defaults
- Validate after deserialization — serde parses structure, your code validates semantics

```rust
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ModelConfig {
    pub model_name: String,
    #[serde(default = "default_temperature")]
    pub temperature: f32,
    pub max_tokens: Option<u32>,
}
fn default_temperature() -> f32 { 0.0 }
```

## Code Quality & Clippy

- Run `cargo clippy -- -D warnings` in CI — treat all warnings as errors
- Enable `#![warn(clippy::pedantic)]` for libraries, selectively allow noisy lints
- `cargo fmt --check` in CI — no style debates, rustfmt decides
- `cargo deny check` for license and vulnerability auditing of dependencies

## Unsafe Usage

- Default: **no `unsafe`**. Reach for safe abstractions first
- When unavoidable: isolate in a dedicated module, wrap in a safe public API
- Every `unsafe` block gets a `// SAFETY:` comment explaining the invariant
- Audit all `unsafe` with `cargo geiger` — track count, review in PRs

## Testing

- `#[test]` for unit tests in the same file (`#[cfg(test)] mod tests`)
- `proptest` or `quickcheck` for property-based testing on parsers and serializers
- Integration tests in `tests/` directory — test public API, not internals
- `cargo tarpaulin` or `llvm-cov` for coverage in CI (80%+ target)

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn roundtrip_serialization(input in "\\PC{1,256}") {
            let encoded = encode(&input);
            let decoded = decode(&encoded).unwrap();
            prop_assert_eq!(input, decoded);
        }
    }
}
```

## Documentation

- `///` on all public items — include a one-line summary, then details
- Add `# Examples` with compilable code blocks (enforced by `cargo test --doc`)
- `//!` at crate root for module-level documentation
- `#![warn(missing_docs)]` for libraries to catch undocumented public API

## Module & Workspace Organization

- `lib.rs` re-exports public API; internal modules stay `pub(crate)`
- Cargo workspaces for monorepos — shared dependencies in root `Cargo.toml`
- Feature flags for optional functionality: `default = []`, gate with `#[cfg(feature = "...")]`
- Keep `Cargo.lock` in version control for applications, not for libraries

## Logging with Tracing

- Use `tracing` crate — structured spans and events, not `println!` or `log`
- Instrument async functions with `#[tracing::instrument(skip(sensitive_param))]`
- `tracing-subscriber` with JSON formatter for production, pretty formatter for dev
- Include correlation IDs via span fields for distributed tracing

```rust
#[tracing::instrument(skip(client), fields(correlation_id = %uuid::Uuid::new_v4()))]
async fn call_model(client: &Client, prompt: &str) -> anyhow::Result<String> {
    let resp = client.complete(prompt).await.context("model call failed")?;
    tracing::info!(tokens = resp.usage.total, "completion finished");
    Ok(resp.text)
}
```

## `no_std` Considerations

- For embedded / WASM targets: `#![no_std]` with `alloc` crate when heap is available
- Use `core::fmt::Write` instead of `std::io::Write`
- Gate std-dependent code behind `#[cfg(feature = "std")]`

## Anti-Patterns

- ❌ `.unwrap()` / `.expect()` in library code or request handlers
- ❌ `Arc<Mutex<Vec<T>>>` shared state — use channels or actor patterns
- ❌ Blocking the tokio runtime (`std::thread::sleep`, synchronous I/O without `spawn_blocking`)
- ❌ `unsafe` without a `// SAFETY:` comment and isolated safe wrapper
- ❌ `String` parameters when `&str` suffices — forces callers to allocate
- ❌ Ignoring clippy lints instead of fixing the underlying issue
- ❌ `#[allow(unused)]` on production code — dead code should be removed
- ❌ Logging secrets, tokens, or PII — even at `TRACE` level

## WAF Alignment

| Pillar | Rust Practice |
|---|---|
| **Security** | Memory safety by default, no GC exploits. `cargo deny` + `cargo audit` in CI. Secrets via env vars / Key Vault — never embedded. `unsafe` audited with `cargo geiger`. |
| **Reliability** | `Result<T,E>` everywhere — no panics in production. Graceful shutdown via `tokio::select!` + signal handlers. Retry with backoff via `backoff` crate. |
| **Performance** | Zero-cost abstractions. Borrow instead of clone. `tokio` async runtime with work-stealing scheduler. Profile with `criterion` benchmarks, `flamegraph` for hot paths. |
| **Cost Optimization** | Minimal binary size (`strip`, `lto`, `opt-level = "z"` for WASM). Feature flags to exclude unused deps. Compile-time computation with `const fn`. |
| **Operational Excellence** | `tracing` for structured observability. `cargo fmt` + `clippy` enforced in CI. `cargo workspace` for consistent dependency versions across crates. |
| **Responsible AI** | Validate and sanitize all LLM inputs/outputs at system boundary. Content safety checks before returning AI responses to users. |
