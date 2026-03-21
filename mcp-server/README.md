# frootai-mcp

> **AI architecture knowledge as an agent skill.** 6 tools, 17 modules, 200+ terms, 7 decision guides.

## Install & Run

```bash
npx frootai-mcp
```

Or install globally:

```bash
npm install -g frootai-mcp
frootai-mcp
```

## MCP Config

**Claude Desktop** / **Cursor**:
```json
{
  "mcpServers": {
    "frootai": { "command": "npx", "args": ["frootai-mcp"] }
  }
}
```

**VS Code** (`.vscode/mcp.json`):
```json
{
  "servers": {
    "frootai": { "command": "npx", "args": ["frootai-mcp"] }
  }
}
```

## 6 Tools

| Tool | Description |
|------|------------|
| `list_modules` | Browse 17 modules by FROOT layer |
| `get_module` | Read module content (F1–T3) |
| `lookup_term` | 200+ AI/ML term definitions |
| `search_knowledge` | Full-text search all modules |
| `get_architecture_pattern` | 7 decision guides (RAG, agents, hosting, cost, etc.) |
| `get_froot_overview` | Complete FROOT framework summary |

## Links

- **Website**: https://gitpavleenbali.github.io/frootai/
- **GitHub**: https://github.com/gitpavleenbali/frootai
- **Setup Guide**: https://gitpavleenbali.github.io/frootai/setup-guide

---

**FrootAI** — Know the roots. Ship the fruit.
