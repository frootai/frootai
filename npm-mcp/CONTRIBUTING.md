# Contributing to FrootAI MCP Server

Thank you for your interest in contributing! This guide helps you get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/frootai/frootai.git
cd frootai/mcp-server

# Install dependencies
npm install

# Run in stdio mode (default)
node index.js

# Run in HTTP mode
node index.js http

# Run TypeScript checks
npx tsc --noEmit

# Run tests
npx vitest run

# Run engine tests
cd .. && node engine/test.js
```

## Project Structure

```
mcp-server/
├── index.js              ← Main server (all tools, resources, prompts)
├── src/                  ← TypeScript modules (knowledge, middleware, types)
│   ├── types/            ← TypeScript interfaces
│   ├── knowledge/        ← Knowledge loader, glossary, search
│   └── middleware/       ← LRU cache, rate limiter, error handling
├── tests/                ← Vitest test suite
│   └── unit/             ← Unit tests for knowledge + middleware
├── knowledge.json        ← Bundled knowledge base (682KB)
├── cli.js                ← CLI interface (npx frootai)
├── tsconfig.json         ← TypeScript configuration
└── vitest.config.ts      ← Test configuration
```

## Adding a New Tool

1. Add the tool registration in `index.js` within `createConfiguredServer()`
2. Use proper Zod schemas for input validation
3. Add tool annotations (`readOnlyHint`, `destructiveHint`, etc.)
4. Use `mcpError()` for error responses with `isError: true`
5. Add caching via `LRUCache` for expensive operations
6. Add rate limiting via `RateLimiter` for external API calls

## Code Style

- ES Modules (`import/export`) — no CommonJS
- TypeScript for new modules in `src/` (strict mode)
- Use `mcpError()` / `mcpNotFound()` for error responses
- Add tool annotations on every tool registration
- No hardcoded secrets — use environment variables

## Testing

```bash
# Run all tests
npx vitest run

# Run with coverage
npx vitest run --coverage

# Watch mode
npx vitest
```

## Architecture

The MCP server has 5 layers:

1. **MCP Protocol Features** — Resources (`fai://`), Prompts, Annotations
2. **Knowledge Tools** — search, lookup, browse FROOT modules
3. **FAI Engine Tools** — wire_play, validate_manifest, evaluate_quality, inspect_wiring
4. **Scaffold Tools** — scaffold_play, create_primitive, smart_scaffold
5. **Marketplace Tools** — search, browse, install, validate plugins

The server supports two transports:
- **stdio** (default) — for local use with VS Code, Claude Desktop, Cursor
- **Streamable HTTP** — for remote deployment with multi-client sessions

## FAI Engine

The `engine/` directory contains the FAI Protocol runtime:
- `manifest-reader.js` — loads + validates fai-manifest.json
- `context-resolver.js` — resolves FROOT knowledge + WAF instructions
- `primitive-wirer.js` — connects primitives with shared context
- `evaluator.js` — quality gates (groundedness, coherence, safety, cost)
- `hook-runner.js` — executes lifecycle hooks
- `mcp-bridge.js` — exposes engine as MCP tools
