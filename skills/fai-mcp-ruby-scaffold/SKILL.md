---
name: fai-mcp-ruby-scaffold
description: |
  Scaffold Ruby MCP servers with typed tool handlers, JSON-RPC processing,
  and gem packaging. Use when building MCP servers in Ruby for Rails or
  Sinatra-based tool integration.
---

# Ruby MCP Server Scaffold

Build MCP servers in Ruby with typed tool handlers and gem packaging.

## When to Use

- Building MCP tools for Ruby/Rails applications
- Exposing Ruby service logic as AI agent tools
- Creating MCP servers with gem-based distribution

---

## Project Setup

```bash
mkdir my-mcp-server && cd my-mcp-server
bundle init
# Add to Gemfile:
# gem 'mcp-ruby'
bundle install
```

## Tool Definition

```ruby
require 'mcp'

class SearchTool < MCP::Tool
  name 'search_documents'
  description 'Search knowledge base documents by query'

  param :query, type: :string, required: true, description: 'Search query'
  param :limit, type: :integer, default: 5, description: 'Max results'

  def execute(query:, limit: 5)
    results = KnowledgeBase.search(query, limit: limit)
    results.map { |r| { id: r.id, title: r.title, score: r.score } }.to_json
  end
end
```

## Server Entry

```ruby
require 'mcp'

server = MCP::Server.new(name: 'my-mcp-server', version: '1.0.0')
server.add_tool(SearchTool.new)
server.serve_stdio
```

## Gemspec

```ruby
Gem::Specification.new do |s|
  s.name = 'my-mcp-server'
  s.version = '1.0.0'
  s.summary = 'MCP server for knowledge base tools'
  s.executables = ['my-mcp-server']
  s.add_dependency 'mcp-ruby', '~> 0.5'
end
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Tool not registered | Not added to server | Call server.add_tool() |
| JSON parse error | Non-serializable return | Always return .to_json |
| Gem not found | Bundle not installed | Run `bundle install` |
| Encoding issues | Non-UTF8 input | Force UTF-8 encoding on input |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Type all tool parameters | Agent understands expected inputs |
| Write descriptive tool docstrings | Agent matches tasks to tools |
| Validate inputs before processing | Prevent injection and crashes |
| Return structured JSON strings | Consistent parsing by consumers |
| Add error messages in results | Agent can report failures to user |
| Test tools independently | Verify behavior before server integration |

## MCP Transport Options

| Transport | Use Case | Config |
|-----------|----------|--------|
| stdio | VS Code Copilot, Claude Desktop | Default — no setup needed |
| SSE | Web clients, remote access | Add HTTP server endpoint |
| WebSocket | Real-time bidirectional | For streaming-heavy tools |

## Related Skills

- `fai-mcp-python-generator` — Python MCP with FastMCP
- `fai-mcp-typescript-generator` — TypeScript MCP with SDK
- `fai-mcp-csharp-scaffold` — C# MCP with ModelContextProtocol
