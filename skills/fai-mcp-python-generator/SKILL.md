---
name: fai-mcp-python-generator
description: |
  Generate Python MCP servers with FastMCP decorators, typed tool definitions,
  async handlers, and uvicorn hosting. Use when building MCP servers in Python
  for AI agent tool access.
---

# Python MCP Server Generator

Build MCP servers in Python with FastMCP decorators and async handlers.

## When to Use

- Building MCP servers for Python-based AI tools
- Exposing Python functions as AI agent tools
- Creating MCP servers with async/await patterns
- Deploying MCP servers with Docker

---

## Quick Start

```bash
pip install mcp
```

## Server with FastMCP

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("my-mcp-server")

@mcp.tool()
async def search_documents(query: str, top_k: int = 5) -> str:
    """Search knowledge base documents by query.

    Args:
        query: Search query text
        top_k: Number of results to return (default: 5)
    """
    results = await search_service.search(query, top_k)
    return json.dumps([{"id": r.id, "title": r.title, "score": r.score}
                       for r in results])

@mcp.tool()
async def calculate_cost(prompt_tokens: int, completion_tokens: int,
                          model: str = "gpt-4o") -> str:
    """Estimate API cost for given token counts.

    Args:
        prompt_tokens: Number of input tokens
        completion_tokens: Number of output tokens
        model: Model name (gpt-4o or gpt-4o-mini)
    """
    rates = {"gpt-4o": (2.50, 10.00), "gpt-4o-mini": (0.15, 0.60)}
    p_rate, c_rate = rates.get(model, (2.50, 10.00))
    cost = (prompt_tokens * p_rate + completion_tokens * c_rate) / 1_000_000
    return json.dumps({"model": model, "cost_usd": round(cost, 4)})

@mcp.resource("config://settings")
async def get_settings() -> str:
    """Return server configuration."""
    return json.dumps({"version": "1.0.0", "models": ["gpt-4o", "gpt-4o-mini"]})
```

## Run Server

```bash
# Stdio transport (for Copilot, Claude Desktop)
python -m my_server

# SSE transport (for web clients)
uvicorn my_server:mcp.sse_app --host 0.0.0.0 --port 8080
```

## MCP Config (for VS Code)

```json
{
  "servers": {
    "my-tools": {
      "command": "python",
      "args": ["-m", "my_server"],
      "env": { "AZURE_OPENAI_ENDPOINT": "${input:endpoint}" }
    }
  }
}
```

## Dockerfile

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "-m", "my_server"]
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Tool not discovered | Missing @mcp.tool() decorator | Add decorator with docstring |
| Type error on args | Wrong type annotation | Use str, int, float, bool — not complex types |
| Server hangs | Blocking sync call in async handler | Use await for all I/O operations |
| SSE connection drops | No keep-alive | Configure uvicorn timeout settings |
