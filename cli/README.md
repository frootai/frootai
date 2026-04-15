# frootai

> **Alias package** for [`frootai-mcp`](https://www.npmjs.com/package/frootai-mcp) — the FrootAI AI Primitive Unification Ecosystem.

This package lets you use the shorter `npx frootai` command instead of `npx frootai-mcp`.

## Usage

```bash
# CLI commands
npx frootai help                    # Show all commands
npx frootai info 01                 # Play details + cost estimate
npx frootai list                    # Browse all 100 solution plays
npx frootai scaffold 01             # Download play to current directory
npx frootai deploy                  # Guided Azure deployment

# MCP Server (same as npx frootai-mcp)
npx frootai                         # Starts MCP server on stdin/stdout
```

## MCP Configuration

```json
{
  "mcpServers": {
    "frootai": {
      "command": "npx",
      "args": ["frootai"]
    }
  }
}
```

## Links

- **Website**: [frootai.dev](https://frootai.dev)
- **GitHub**: [github.com/frootai/frootai](https://github.com/frootai/frootai)
- **Core package**: [frootai-mcp on npm](https://www.npmjs.com/package/frootai-mcp)
