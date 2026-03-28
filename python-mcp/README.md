# FrootAI MCP Server — Python

> 🐍 Python implementation of the FrootAI MCP Server. Same 23 tools, 16 modules, 200+ terms.

## Install

```bash
pip install frootai-mcp
```

## Usage

### As MCP Server (stdio)
```bash
frootai-mcp-py
```

### In Python
```python
from frootai_mcp import FrootAIMCP

server = FrootAIMCP()
# Use tools programmatically
result = server._search_knowledge({"query": "RAG architecture"})
print(result)
```

### With Claude Desktop
```json
{
  "mcpServers": {
    "frootai": {
      "command": "frootai-mcp-py"
    }
  }
}
```

## Links

- Website: [frootai.dev](https://frootai.dev)
- npm (Node.js): `npx frootai-mcp`
- Docker: `docker run -i ghcr.io/gitpavleenbali/frootai-mcp`
- VS Code: Search "FrootAI" in Extensions

---

*From the Roots to the Fruits. It's simply Frootful.* 🌳
