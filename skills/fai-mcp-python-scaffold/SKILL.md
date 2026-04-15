---
name: fai-mcp-python-scaffold
description: |
  Scaffold Python MCP servers with FastMCP, typed tools, resource endpoints,
  and Docker deployment. Use when creating MCP servers for Python-based AI
  tooling with production-ready structure.
---

# Python MCP Server Scaffold

Scaffold production MCP servers in Python with FastMCP and typed tools.

## When to Use

- Creating a new MCP server for Python-based tools
- Exposing Python functions to AI agents via MCP protocol
- Building MCP servers with resource and prompt capabilities

---

## Project Structure

```
my-mcp-server/
├── src/
│   ├── __init__.py
│   ├── server.py          # FastMCP server definition
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── search.py      # Search tool
│   │   └── analyze.py     # Analysis tool
│   └── resources/
│       └── config.py      # MCP resources
├── tests/
│   └── test_tools.py
├── pyproject.toml
├── Dockerfile
└── README.md
```

## Server Definition

```python
from mcp.server.fastmcp import FastMCP
import json

mcp = FastMCP("my-tools", version="1.0.0")

@mcp.tool()
async def search_knowledge(query: str, limit: int = 5) -> str:
    """Search the knowledge base for relevant documents.

    Args:
        query: Natural language search query
        limit: Maximum results to return
    """
    results = await kb.search(query, top_k=limit)
    return json.dumps([{"title": r.title, "snippet": r.content[:200]}
                       for r in results])

@mcp.resource("config://models")
async def available_models() -> str:
    """List available AI models and their capabilities."""
    return json.dumps({"models": ["gpt-4o", "gpt-4o-mini"]})

@mcp.prompt("summarize")
async def summarize_prompt(text: str) -> str:
    """Generate a summarization prompt for the given text."""
    return f"Summarize the following in 3 bullet points:\n\n{text}"
```

## Testing

```python
import pytest
from src.server import search_knowledge

@pytest.mark.asyncio
async def test_search_returns_results():
    result = await search_knowledge("retry pattern", limit=3)
    data = json.loads(result)
    assert len(data) <= 3
    assert all("title" in r for r in data)
```

## VS Code MCP Config

```json
{
  "servers": {
    "my-tools": {
      "command": "python",
      "args": ["-m", "src.server"],
      "env": { "AZURE_OPENAI_ENDPOINT": "${input:endpoint}" }
    }
  }
}
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Tool not found by agent | Missing @mcp.tool() | Add decorator with docstring |
| Type error on arguments | Complex type annotations | Use str, int, float, bool only |
| Server won't start | Import error | Check pyproject.toml dependencies |
| Resource not loading | Missing @mcp.resource() | Add decorator with URI scheme |
