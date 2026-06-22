---
description: "PHP MCP server development — attributes, typed properties, Composer."
applyTo: "**/*.php"
waf:
  - "reliability"
  - "security"
---

# PHP MCP Server Development — FAI Standards

## Core Rules

- Require PHP 8.2+ — use `readonly` properties, enums, named arguments, fibers
- Use `logiscape/mcp-sdk-php` (or `modelcontextprotocol/php-sdk`) for protocol compliance
- Stdio transport ONLY for MCP servers — never HTTP. All logging to `stderr` via PSR-3
- Composer autoloading (`PSR-4`) for all classes — no manual `require` chains
- Validate every tool input with typed DTOs before processing — reject at boundary
- Never echo/print to stdout outside JSON-RPC — stdout IS the transport
- Config from `config/*.json` — temperatures, thresholds, model names. Never hardcode

## Server Bootstrap

```php
<?php
// bin/server.php — MCP server entry point
declare(strict_types=1);
require __DIR__ . '/../vendor/autoload.php';

use Logiscape\Mcp\Server\McpServer;
use Logiscape\Mcp\Transport\StdioTransport;
use Logiscape\Mcp\Server\ServerCapabilities;
use Monolog\Logger;
use Monolog\Handler\StreamHandler;

$logger = new Logger('mcp', [new StreamHandler('php://stderr', Logger::DEBUG)]);
$transport = new StdioTransport();
$server = new McpServer(
    name: 'my-mcp-server',
    version: '1.0.0',
    capabilities: new ServerCapabilities(tools: true, resources: true, prompts: true),
    logger: $logger,
);
$server->registerToolHandler(new \App\Tools\SearchToolHandler());
$server->registerResourceHandler(new \App\Resources\ConfigResourceHandler());
$server->registerPromptHandler(new \App\Prompts\ReviewPromptHandler());
$server->listen($transport);
```

## Tool Registration

```php
use Logiscape\Mcp\Server\ToolHandlerInterface;
use Logiscape\Mcp\Types\{Tool, ToolResult, CallToolRequest, McpError, ErrorCode};

final readonly class SearchToolHandler implements ToolHandlerInterface
{
    public function getTools(): array
    {
        return [new Tool(
            name: 'search_docs',
            description: 'Search documentation by query',
            inputSchema: [
                'type' => 'object',
                'properties' => [
                    'query' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 500],
                    'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 50, 'default' => 10],
                ],
                'required' => ['query'],
            ],
        )];
    }

    public function callTool(CallToolRequest $request): ToolResult
    {
        $query = $request->params['query'] ?? throw new McpError(
            ErrorCode::INVALID_PARAMS, 'Missing required parameter: query'
        );
        // Input validation at boundary
        if (!is_string($query) || mb_strlen($query) > 500) {
            throw new McpError(ErrorCode::INVALID_PARAMS, 'query must be string ≤500 chars');
        }
        $results = $this->searchService->search($query, (int)($request->params['limit'] ?? 10));
        return new ToolResult(content: json_encode($results, JSON_THROW_ON_ERROR));
    }
}
```

## Resource & Prompt Handlers

```php
// Resource handler — expose config files as readable resources
final readonly class ConfigResourceHandler implements ResourceHandlerInterface
{
    public function listResources(): array
    {
        return [new Resource(
            uri: 'config://openai',
            name: 'OpenAI Configuration',
            mimeType: 'application/json',
        )];
    }

    public function readResource(string $uri): ResourceContent
    {
        return match ($uri) {
            'config://openai' => new ResourceContent(
                text: file_get_contents(__DIR__ . '/../../config/openai.json')
            ),
            default => throw new McpError(ErrorCode::RESOURCE_NOT_FOUND, "Unknown: $uri"),
        };
    }
}

// Prompt handler — reusable prompt templates
final readonly class ReviewPromptHandler implements PromptHandlerInterface
{
    public function getPrompts(): array
    {
        return [new Prompt(
            name: 'code_review',
            description: 'Review code for security and quality issues',
            arguments: [new PromptArgument(name: 'code', required: true)],
        )];
    }

    public function getPromptMessages(string $name, array $args): array
    {
        return [new PromptMessage(
            role: Role::User,
            content: "Review this code for OWASP issues:\n```\n{$args['code']}\n```",
        )];
    }
}
```

## JSON-RPC & Error Handling

- MCP uses JSON-RPC 2.0 over stdio — one JSON object per line, delimited by `\n`
- Throw `McpError` with proper `ErrorCode` — SDK serializes to JSON-RPC error response
- Never catch `McpError` in tool handlers — let it propagate to the transport layer
- Use `ErrorCode::INTERNAL_ERROR` for unexpected failures, `INVALID_PARAMS` for bad input
- Wrap external calls in try/catch — convert exceptions to `McpError` with sanitized messages

## Async with ReactPHP

```php
use React\EventLoop\Loop;
use React\Promise\Deferred;

// Non-blocking I/O for concurrent tool calls
$loop = Loop::get();
$server->onToolCall('batch_search', function (CallToolRequest $req) use ($loop) {
    $queries = $req->params['queries'];
    $promises = array_map(fn(string $q) => $this->asyncSearch($q, $loop), $queries);
    return \React\Promise\all($promises)->then(
        fn(array $results) => new ToolResult(content: json_encode($results))
    );
});
```

## Testing with PHPUnit

```php
final class SearchToolHandlerTest extends TestCase
{
    public function testCallToolReturnsResults(): void
    {
        $handler = new SearchToolHandler(searchService: $this->createMock(SearchService::class));
        $request = new CallToolRequest(name: 'search_docs', params: ['query' => 'MCP']);
        $result = $handler->callTool($request);
        self::assertJson($result->content);
    }

    public function testRejectsMissingQuery(): void
    {
        $handler = new SearchToolHandler(searchService: $this->createStub(SearchService::class));
        $this->expectException(McpError::class);
        $handler->callTool(new CallToolRequest(name: 'search_docs', params: []));
    }

    public function testRejectsOversizedInput(): void
    {
        $handler = new SearchToolHandler(searchService: $this->createStub(SearchService::class));
        $this->expectException(McpError::class);
        $handler->callTool(new CallToolRequest(
            name: 'search_docs', params: ['query' => str_repeat('x', 501)]
        ));
    }
}
```

## Anti-Patterns

- ❌ `echo`/`print`/`var_dump` to stdout — corrupts JSON-RPC transport
- ❌ Catching `McpError` inside tool handlers — breaks protocol error propagation
- ❌ Using `$_GET`/`$_POST`/`$_SERVER` — MCP servers are NOT web apps
- ❌ Manual JSON-RPC framing — use the SDK transport layer
- ❌ Global state or `static` mutable properties — use constructor DI
- ❌ Ignoring `inputSchema` validation — lets malformed input reach business logic
- ❌ Logging to stdout via `error_log()` default — must redirect to stderr
- ❌ Blocking I/O in async handlers — use ReactPHP streams or fibers

## WAF Alignment

| Pillar | PHP MCP Practice |
|--------|-----------------|
| **Security** | Validate all tool inputs via schema + typed DTOs; sanitize `McpError` messages (no stack traces); `readonly` classes prevent mutation; no secrets in tool responses |
| **Reliability** | `McpError` with typed `ErrorCode` for structured failures; graceful `SIGTERM` via `pcntl_signal`; enum-based state machines prevent invalid transitions |
| **Cost** | Config-driven `max_tokens`; OPcache for repeated script loads; batch tool calls via ReactPHP `Promise\all` to reduce round-trips |
| **Ops** | PSR-3 logging to stderr with correlation IDs; Composer scripts for CI (`composer test`, `composer analyse`); PHPStan level 9 in pipeline |
| **Performance** | Fibers for concurrent I/O; ReactPHP event loop for non-blocking transport; `readonly` properties eliminate defensive copies |
| **Responsible AI** | Prompt template handlers enforce guardrails; input length caps prevent token abuse; tool descriptions are transparent about capabilities |
