# Recipe 5: Build an MCP Server

> Create a Python MCP server with FrootAI patterns: typed tools, resources, error handling, testing, deployment.

## What You'll Build

A working MCP server with custom tools Copilot and Claude can call. You'll implement a tool, register it in the manifest, test with MCP Inspector, and prep for Docker and npm deployment.

## What Is MCP?

**Model Context Protocol (MCP)** is an open standard for connecting AI models to external tools/data. An MCP server exposes:

| Primitive | Purpose | Direction | Example |
|-----------|---------|---------|---------|
| **Tools** | Actions the AI can invoke | AI → Server | `search_knowledge`, `deploy_play` |
| **Resources** | Read-only data the AI can access | Server → AI | `config://version`, `plays://list` |
| **Prompts** | Pre-built prompt templates | Server → AI | `system://rag-context` |

The FrootAI MCP server (`mcp-server/` and `python-mcp/`) exposes 25 tools for searching knowledge, comparing models, estimating costs, and validating configs.

## Prerequisites

- Python 3.11+ with `uv`
- FrootAI repo cloned
- VS Code with Copilot Chat
- Docker (optional)

## Steps

### 1. Set up the project

```bash
mkdir my-mcp-server && cd my-mcp-server
uv init
uv add "mcp[cli]" pydantic httpx
```

This gives you:
- `mcp` — MCP SDK with FastMCP server
- `pydantic` — typed tool params with validation
- `httpx` — async HTTP client for external APIs

### 2. Create the server skeleton

**server.py:**

```python
from mcp.server.fastmcp import FastMCP
import json

mcp = FastMCP(
    "my-mcp-server",
    version="1.0.0",
    description="Custom FrootAI MCP server with domain-specific tools"
)


@mcp.tool()
async def health_check() -> str:
    """Check if the server is running and all dependencies are available."""
    return json.dumps({"status": "healthy", "version": "1.0.0"})


if __name__ == "__main__":
    mcp.run()
```

### 3. Implement a real tool

Add a tool that searches solution play metadata:

```python
import os
from pathlib import Path
from typing import Optional

PLAYS_DIR = Path(os.environ.get("PLAYS_DIR", "../solution-plays"))


@mcp.tool()
async def search_plays(
    query: str,
    max_results: int = 5,
    complexity: Optional[str] = None
) -> str:
    """Search FrootAI solution plays by keyword.

    Use when the user asks about available plays, architectures,
    or wants to find a play for a specific use case.

    Args:
        query: Natural language search (e.g., 'RAG chatbot', 'document processing')
        max_results: Maximum plays to return (1-20, default 5)
        complexity: Filter by complexity: 'Low', 'Medium', 'High' (optional)
    """
    if not query or len(query) > 500:
        return json.dumps({"error": "Query must be 1-500 characters"})
    max_results = max(1, min(20, max_results))

    results = []
    if not PLAYS_DIR.exists():
        return json.dumps({"error": f"Plays directory not found: {PLAYS_DIR}"})

    for play_dir in sorted(PLAYS_DIR.iterdir()):
        froot_json = play_dir / "froot.json"
        if not froot_json.exists():
            continue

        try:
            meta = json.loads(froot_json.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue

        # Simple keyword matching (production would use embeddings)
        title = meta.get("title", "").lower()
        desc = meta.get("description", "").lower()
        tags = [t.lower() for t in meta.get("tags", [])]
        query_lower = query.lower()

        if query_lower in title or query_lower in desc or any(query_lower in t for t in tags):
            if complexity and meta.get("complexity") != complexity:
                continue
            results.append({
                "play": meta.get("name"),
                "title": meta.get("title"),
                "description": meta.get("description"),
                "complexity": meta.get("complexity"),
                "tags": meta.get("tags", [])
            })

        if len(results) >= max_results:
            break

    return json.dumps({"results": results, "total": len(results)})
```

**Why this matters:**
- **Clear docstring** — model uses it to decide when to call the tool
- **Typed parameters** — `Optional[str]` and defaults keep it flexible
- **Input validation** — validate before logic runs
- **Structured JSON output** — machine-parseable, not free-text

### 4. Add a resource

Resources are read-only data the AI can discover:

```python
@mcp.resource("plays://count")
async def get_play_count() -> str:
    """Total number of solution plays available."""
    if not PLAYS_DIR.exists():
        return "0"
    count = sum(1 for d in PLAYS_DIR.iterdir() if (d / "froot.json").exists())
    return str(count)


@mcp.resource("config://server")
async def get_server_config() -> str:
    """Server configuration and capabilities."""
    return json.dumps({
        "name": "my-mcp-server",
        "version": "1.0.0",
        "plays_dir": str(PLAYS_DIR),
        "tools": ["search_plays", "health_check"]
    })
```

### 5. Add robust error handling

Wrap tools that call external services:

```python
import httpx

TIMEOUT = httpx.Timeout(30.0, connect=10.0)


@mcp.tool()
async def fetch_azure_status(service: str) -> str:
    """Check the health status of an Azure service.

    Args:
        service: Azure service name (e.g., 'openai', 'ai-search', 'cosmos-db')
    """
    allowed_services = {"openai", "ai-search", "cosmos-db", "container-apps"}
    service = service.lower().strip()
    if service not in allowed_services:
        return json.dumps({
            "error": f"Unknown service '{service}'",
            "allowed": sorted(allowed_services)
        })

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                f"https://status.azure.com/api/services/{service}"
            )
            resp.raise_for_status()
            return resp.text
    except httpx.TimeoutException:
        return json.dumps({"error": f"Timeout checking {service} status"})
    except httpx.HTTPStatusError as e:
        return json.dumps({"error": f"HTTP {e.response.status_code} from Azure status API"})
    except httpx.RequestError as e:
        return json.dumps({"error": f"Connection failed: {type(e).__name__}"})
```

### 6. Test with MCP Inspector

Use the browser-based MCP Inspector:

```bash
# Launch the inspector (opens a browser UI)
uv run mcp dev server.py

# In the inspector:
# 1. Click "Tools" tab — verify all tools appear with descriptions
# 2. Click "search_plays" → enter {"query": "RAG"} → Execute
# 3. Click "Resources" tab — verify resources are listed
# 4. Check "Prompts" tab if you added any
```

Command-line testing:

```bash
# List available tools
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | uv run server.py

# Call a specific tool
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_plays","arguments":{"query":"RAG","max_results":3}}}' | uv run server.py
```

### 7. Configure for VS Code Copilot

Create `.vscode/mcp.json` in the project that will use your server:

```json
{
  "servers": {
    "my-mcp-server": {
      "command": "uv",
      "args": ["run", "server.py"],
      "cwd": "${workspaceFolder}/my-mcp-server",
      "env": {
        "PLAYS_DIR": "${workspaceFolder}/solution-plays"
      }
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
      "args": ["run", "server.py"],
      "cwd": "/path/to/my-mcp-server",
      "env": {
        "PLAYS_DIR": "/path/to/solution-plays"
      }
    }
  }
}
```

### 8. Register in knowledge.json (FrootAI ecosystem)

If part of FrootAI, add it to the ecosystem manifest:

```json
{
  "mcp_servers": [
    {
      "name": "my-mcp-server",
      "description": "Custom domain tools for solution plays",
      "tools": ["search_plays", "health_check", "fetch_azure_status"],
      "transport": "stdio",
      "install": "uv add my-mcp-server"
    }
  ]
}
```

### 9. Dockerize for deployment

**Dockerfile:**

```dockerfile
FROM python:3.12-slim AS base
WORKDIR /app

RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY server.py .

EXPOSE 8080
ENV PLAYS_DIR=/data/solution-plays

# Use streamable-http transport for containerized deployment
CMD ["uv", "run", "server.py", "--transport", "streamable-http", "--port", "8080"]
```

```bash
docker build -t my-mcp-server:1.0.0 .
docker run -p 8080:8080 -v /path/to/plays:/data/solution-plays my-mcp-server:1.0.0
```

### 10. Validate the complete server

```bash
# Check Python syntax
python -m py_compile server.py && echo "✅ Syntax OK"

# Run unit tests (if you have them)
uv run pytest tests/ -v

# Verify all tools have docstrings
uv run python -c "
import server
import inspect
for name, obj in inspect.getmembers(server):
    if hasattr(obj, '__wrapped__') and callable(obj):
        doc = inspect.getdoc(obj)
        status = '✅' if doc and len(doc) > 10 else '❌ MISSING'
        print(f'{status} {name}: {(doc or \"no docstring\")[:60]}')
"
```

## Debugging Tips

| Symptom | Cause | Fix |
|---------|-------|-----|
| Tool not appearing in Copilot | Server not started or `mcp.json` path wrong | Check `cwd` resolves, run `uv run mcp dev server.py` to verify |
| "Tool execution failed" | Unhandled exception in tool | Wrap in try/except, return JSON error — never raise |
| Tool called but wrong arguments | Docstring unclear to the model | Rewrite docstring to describe *when* to use, not just *what* it does |
| Timeout on tool call | External API slow or hanging | Set `httpx.Timeout(30.0)`, add circuit breaker for repeated failures |
| Import error on startup | Missing dependency | Run `uv add <package>`, check `pyproject.toml` |
| Inspector shows empty tool list | `mcp.run()` not at end of file | Ensure `if __name__ == "__main__": mcp.run()` is last |

## Best Practices

1. **Clear docstrings** — model uses them to decide *when* to call tools, not just how
2. **Typed parameters** — use Pydantic models or typed args with defaults
3. **Validate at the boundary** — check inputs in the tool function, not deeper
4. **Return JSON always** — structured output the model can parse; never bare strings for complex data
5. **Handle errors gracefully** — return `{"error": "..."}` JSON, never let exceptions propagate
6. **Set explicit timeouts** — 30s default, 10s connect; tools must not hang
7. **One tool, one job** — `search_plays` searches, `deploy_play` deploys; don't combine
8. **Allowlist external calls** — validate service names against a known set before HTTP requests
9. **Use environment variables** — paths and API keys come from env, not hardcoded
10. **Test with Inspector first** — verify tools in MCP Inspector before wiring to Copilot
