<p align="center">
  <img src="frootai-mark.png" width="100" alt="FrootAI">
</p>

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
- Python SDK: [pypi.org/project/frootai](https://pypi.org/project/frootai/)
- npm (Node.js): `npx frootai-mcp` · [npmjs.com](https://www.npmjs.com/package/frootai-mcp)
- Docker: `docker run -i ghcr.io/frootai/frootai-mcp` · [GHCR](https://github.com/frootai/frootai/pkgs/container/frootai-mcp)
- VS Code: [pavleenbali.frootai](https://marketplace.visualstudio.com/items?itemName=pavleenbali.frootai)
- GitHub: [github.com/frootai/frootai](https://github.com/frootai/frootai)
- Contact: [info@frootai.dev](mailto:info@frootai.dev)

---

*From the Roots to the Fruits. It's simply Frootful.* 🌳
