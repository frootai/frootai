---
name: fai-mcp-php-scaffold
description: |
  Scaffold PHP MCP servers with typed tool handlers, JSON-RPC processing,
  and Composer project structure. Use when building MCP servers in PHP
  for web application or CMS integration.
---

# PHP MCP Server Scaffold

Build MCP servers in PHP with typed handlers and Composer packaging.

## When to Use

- Building MCP tools for WordPress, Laravel, or PHP applications
- Exposing PHP service logic as AI agent tools
- Creating lightweight MCP servers with minimal dependencies

---

## Project Setup

```bash
mkdir my-mcp-server && cd my-mcp-server
composer init --name=org/mcp-server --type=project
composer require modelcontextprotocol/php-sdk
```

## Tool Definition

```php
<?php
use ModelContextProtocol\Tool;
use ModelContextProtocol\ToolResult;

class SearchDocumentsTool extends Tool
{
    public function getName(): string { return 'search_documents'; }
    public function getDescription(): string { return 'Search knowledge base documents'; }

    public function getInputSchema(): array {
        return [
            'type' => 'object',
            'properties' => [
                'query' => ['type' => 'string', 'description' => 'Search query'],
                'top_k' => ['type' => 'integer', 'description' => 'Results count', 'default' => 5],
            ],
            'required' => ['query'],
        ];
    }

    public function execute(array $args): ToolResult {
        $query = $args['query'];
        $topK = $args['top_k'] ?? 5;
        $results = $this->searchService->search($query, $topK);
        return ToolResult::text(json_encode($results));
    }
}
```

## Server Entry Point

```php
<?php
require __DIR__ . '/vendor/autoload.php';

use ModelContextProtocol\Server;

$server = new Server('my-mcp-server', '1.0.0');
$server->addTool(new SearchDocumentsTool($searchService));
$server->serveStdio();
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Tool not found | Not registered with addTool | Register before serveStdio() |
| JSON decode error | Invalid input schema | Validate schema matches spec |
| Memory limit | Large result sets | Paginate results, limit response size |
| Autoload fails | Composer not run | Run composer install / dump-autoload |

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
