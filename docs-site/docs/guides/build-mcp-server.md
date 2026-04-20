---
sidebar_position: 7
title: Build an MCP Server
description: Create a Python MCP server with FrootAI patterns — typed tools, resources, error handling, testing, and deployment.
---

# Build an MCP Server

Create a working MCP server with custom tools that Copilot and Claude can call, test with MCP Inspector, and deploy via Docker.

## What Is MCP?

The **Model Context Protocol** (MCP) is an open standard for connecting AI models to external tools and data. An MCP server exposes:

| Primitive | Purpose | Example |
|-----------|---------|---------|
| **Tools** | Actions the AI can invoke | `search_knowledge`, `deploy_play` |
| **Resources** | Read-only data | `config://version`, `plays://list` |
| **Prompts** | Pre-built templates | `system://rag-context` |

## Step 1: Set Up the Project

```bash
mkdir my-mcp-server && cd my-mcp-server
uv init
uv add "mcp[cli]" pydantic httpx
```

## Step 2: Create the Server

```python title="server.py"
from mcp.server.fastmcp import FastMCP
import json

mcp = FastMCP(
    "my-mcp-server",
    version="1.0.0",
    description="Custom FrootAI MCP server"
)

@mcp.tool()
async def health_check() -> str:
    """Check if the server is running."""
    return json.dumps({"status": "healthy", "version": "1.0.0"})

if __name__ == "__main__":
    mcp.run()
```

## Step 3: Implement a Real Tool

```python
from pathlib import Path
from typing import Optional

@mcp.tool()
async def search_plays(
    query: str,
    max_results: int = 5,
    complexity: Optional[str] = None
) -> str:
    """Search FrootAI solution plays by keyword.

    Args:
        query: Natural language search (e.g., 'RAG chatbot')
        max_results: Maximum plays to return (1-20)
        complexity: Filter: 'Low', 'Medium', 'High'
    """
    if not query or len(query) > 500:
        return json.dumps({"error": "Query must be 1-500 characters"})
    max_results = max(1, min(20, max_results))

    results = []
    # ... search implementation ...
    return json.dumps({"results": results, "total": len(results)})
```

:::tip Clear Docstrings
The model reads the docstring to decide **when** to call your tool. Describe the use case, not just the function signature.
:::

## Step 4: Add Error Handling

```python
import httpx

TIMEOUT = httpx.Timeout(30.0, connect=10.0)

@mcp.tool()
async def fetch_azure_status(service: str) -> str:
    """Check health status of an Azure service."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(f"https://status.azure.com/api/{service}")
            resp.raise_for_status()
            return resp.text
    except httpx.TimeoutException:
        return json.dumps({"error": f"Timeout checking {service}"})
    except httpx.HTTPStatusError as e:
        return json.dumps({"error": f"HTTP {e.response.status_code}"})
```

:::warning Never Raise Exceptions
MCP tools must always return JSON — never let exceptions propagate. Return `{"error": "..."}` instead.
:::

## Step 5: Test with MCP Inspector

```bash
uv run mcp dev server.py
```

In the browser UI:
1. Click "Tools" — verify all tools appear
2. Execute `search_plays` with `{"query": "RAG"}`
3. Check "Resources" tab

## Step 6: Configure for VS Code

```json title=".vscode/mcp.json"
{
  "servers": {
    "my-mcp-server": {
      "command": "uv",
      "args": ["run", "server.py"],
      "cwd": "${workspaceFolder}/my-mcp-server"
    }
  }
}
```

For Claude Desktop — `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "my-mcp-server": {
      "command": "uv",
      "args": ["run", "server.py"]
    }
  }
}
```

## Step 7: Dockerize

```dockerfile title="Dockerfile"
FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY server.py .
EXPOSE 8080
CMD ["uv", "run", "server.py", "--transport", "streamable-http", "--port", "8080"]
```

## Best Practices

1. **Clear docstrings** — the model reads them to decide when to call your tool
2. **Typed parameters** — use Pydantic or typed args with defaults
3. **Validate at the boundary** — check inputs in the tool function
4. **Return JSON always** — structured output, not free-text
5. **Set explicit timeouts** — 30s default, 10s connect
6. **One tool, one job** — don't combine multiple operations

## See Also

- [MCP Server Distribution](/distribution/mcp-server) — FrootAI's MCP server
- [Error Handling](/guides/error-handling) — error patterns
