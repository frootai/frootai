## Connect MCP Server

FrootAI MCP server provides **45 architecture tools** for any MCP-compatible AI assistant.

### Quick Setup

Add to `.vscode/mcp.json`:
```json
{
  "servers": {
    "frootai": {
      "command": "npx",
      "args": ["frootai-mcp@latest"]
    }
  }
}
```

### Tool Categories

| Category | Tools | Highlights |
|----------|-------|-----------|
| Knowledge | 5 | search_knowledge, get_module, lookup_term |
| Plays | 4 | get_play_detail, list_plays, semantic_search |
| Architecture | 3 | get_architecture_pattern, compare_plays |
| Models | 2 | get_model_catalog, compare_models |
| Cost | 2 | estimate_cost, get_azure_pricing |

### Alternative Installation

- **pip**: `pip install frootai-mcp`
- **Docker**: `docker run -p 3000:3000 frootai/mcp`

> **Tip**: Use the MCP Tool Explorer panel to browse and try tools interactively.
