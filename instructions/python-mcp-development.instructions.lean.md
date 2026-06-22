---
description: "Python MCP server development standards — FastMCP patterns, @mcp.tool() decorators, Pydantic parameter types, async handlers, resource definitions, and production deployment with uv and Docker."
applyTo: "**/*.py, **/pyproject.toml"
waf:
  - "security"
  - "reliability"
  - "performance-efficiency"
---

# Python MCP Server Development — FAI Standards

## FastMCP Server Setup

```python
from mcp.server.fastmcp import FastMCP
mcp = FastMCP("my-server", dependencies=["httpx", "pydantic"])
```

Lifespan pattern for startup/shutdown resources (DB pools, HTTP clients):

```python
from contextlib import asynccontextmanager
from mcp.server.fastmcp import FastMCP

@asynccontextmanager
async def lifespan(server: FastMCP):
    async with httpx.AsyncClient() as client:
        yield {"http": client}  # available via ctx.request_context.lifespan_context

mcp = FastMCP("my-server", lifespan=lifespan)
```

## Tool Decorators & Type Hints

Type hints on parameters drive automatic JSON Schema generation — no manual schema needed:

```python
from pydantic import BaseModel, Field

class SearchParams(BaseModel):
    query: str = Field(description="Search query text")
    top_k: int = Field(default=5, ge=1, le=50, description="Number of results")

@mcp.tool()
async def search_documents(params: SearchParams) -> str:
    """Search the knowledge base. Docstring becomes the tool description."""
    results = await index.search(params.query, top=params.top_k)
    return "\n".join(f"- {r.title}: {r.snippet}" for r in results)
```

For simple tools, inline parameters work — each param type hint generates schema:

```python
@mcp.tool()
async def get_weather(city: str, units: str = "metric") -> str:
    """Get current weather for a city."""
    resp = await ctx.request_context.lifespan_context["http"].get(
        f"https://api.weather.com/{city}?units={units}"
    )
    return resp.text
```

## Context Parameter

Inject `ctx: Context` to access logging, progress, and resource reading:

```python
from mcp.server.fastmcp import Context

@mcp.tool()
async def analyze(query: str, ctx: Context) -> str:
    ctx.info(f"Analyzing: {query}")         # logs to stderr, visible to client
    ctx.debug("Loading config")             # debug-level log
    await ctx.report_progress(0, 100)       # progress notification to client

    config = await ctx.read_resource("config://settings")
    await ctx.report_progress(50, 100)

    result = process(config, query)
    await ctx.report_progress(100, 100)
    return result
```

## Resources & Prompts

```python
@mcp.resource("docs://{topic}")
async def get_docs(topic: str) -> str:
    """Dynamic resource with URI template."""
    return load_markdown(f"docs/{topic}.md")

@mcp.prompt()
async def review_code(code: str, language: str = "python") -> str:
    return f"Review this {language} code for bugs and security issues:\n```{language}\n{code}\n```"
```

## Error Handling

Raise `McpError` with standard error codes — never return raw exceptions:

```python
from mcp.shared.exceptions import McpError
from mcp.types import INVALID_PARAMS, INTERNAL_ERROR

@mcp.tool()
async def delete_item(item_id: str) -> str:
    if not item_id.strip():
        raise McpError(INVALID_PARAMS, "item_id must be non-empty")
    try:
        await db.delete(item_id)
        return f"Deleted {item_id}"
    except ItemNotFoundError:
        raise McpError(INVALID_PARAMS, f"Item {item_id} not found")
    except Exception as e:
        raise McpError(INTERNAL_ERROR, f"Delete failed: {e}")
```

## Logging — stderr Only

MCP uses stdout for JSON-RPC transport. All logging MUST go to stderr:

```python
import logging, sys
logging.basicConfig(stream=sys.stderr, level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("my-server")
# NEVER: print(), sys.stdout.write() — breaks JSON-RPC framing
```

## Returning Binary/Image Content

```python
from mcp.server.fastmcp.utilities.types import Image

@mcp.tool()
async def generate_chart(data: str) -> Image:
    buf = render_chart(data)  # returns PNG bytes
    return Image(data=buf, format="png")  # base64-encodes automatically
```

## Stdio Transport Entry Point

```python
if __name__ == "__main__":
    mcp.run(transport="stdio")  # default; use "sse" for HTTP
```

## Testing with pytest

```python
import pytest
from mcp import ClientSession
from mcp.client.stdio import stdio_client, StdioServerParameters

@pytest.fixture
async def session():
    params = StdioServerParameters(command="python", args=["server.py"])
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as s:
            await s.initialize()
            yield s

@pytest.mark.asyncio
async def test_search(session):
    result = await session.call_tool("search_documents",
                                     {"params": {"query": "test", "top_k": 3}})
    assert result.content[0].text
    assert "error" not in result.content[0].text.lower()

@pytest.mark.asyncio
async def test_list_tools(session):
    tools = await session.list_tools()
    names = [t.name for t in tools.tools]
    assert "search_documents" in names
```

## Packaging (pyproject.toml)

```toml
[project]
name = "my-mcp-server"
version = "1.0.0"
requires-python = ">=3.10"
dependencies = ["mcp[cli]>=1.2.0", "httpx>=0.27", "pydantic>=2.0"]

[project.scripts]
my-mcp-server = "my_mcp_server:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

Client config in `.vscode/mcp.json`:
```json
{ "servers": { "my-server": { "command": "uvx", "args": ["my-mcp-server"] } } }
```

## Anti-Patterns

- ❌ `print()` or `sys.stdout.write()` in server code — corrupts JSON-RPC transport
- ❌ Sync blocking calls in async handlers — use `asyncio.to_thread()` for CPU work
- ❌ Returning raw tracebacks to client — expose internal paths and secrets
- ❌ Missing type hints on tool params — client sees `{}` schema, no auto-complete
- ❌ Hardcoding secrets in tool handlers — use env vars or `ctx.read_resource("secret://")`
- ❌ Global mutable state between requests — use lifespan context for shared resources
- ❌ Skipping input validation — Pydantic models with `Field(ge=, le=, pattern=)` are free
- ❌ Using SSE transport for local CLI tools — stdio is simpler and more reliable

## WAF Alignment

| Pillar | Practice |
|--------|----------|
| **Security** | Validate all inputs via Pydantic; never log secrets; use `McpError` not raw exceptions; env vars for credentials |
| **Reliability** | Lifespan for connection management; structured error codes; graceful shutdown via async context managers |
| **Performance** | Async handlers with `httpx.AsyncClient`; connection pooling in lifespan; progress notifications for long ops |
| **Cost** | Lightweight stdio transport; lazy resource loading; batch operations in tool handlers |
| **Operational Excellence** | stderr-only logging; pytest integration tests; `pyproject.toml` entry points; `uvx` distribution |
| **Responsible AI** | Content validation before returning; descriptive tool docstrings for safe model invocation |

### Operational Excellence
- Structured JSON logging with Application Insights + correlation IDs
- Custom metrics: latency p50/p95/p99, token usage, quality scores
- Automated Bicep deployment via GitHub Actions (staging → prod)
- Feature flags for gradual rollout, incident runbooks
