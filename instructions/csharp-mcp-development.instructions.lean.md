---
description: "C#/.NET MCP server development standards — ModelContextProtocol NuGet patterns, [McpServerTool] attributes, dependency injection, IHostedService lifecycle, and Azure Managed Identity integration."
applyTo: "**/*.cs"
waf:
  - "security"
  - "reliability"
  - "performance-efficiency"
---

# C# MCP Server Development — FAI Standards

## Package & Project Setup

- Use `ModelContextProtocol` NuGet package (≥1.0) — the official C# SDK for MCP
- Target `net8.0` or later — MCP SDK requires modern .NET for `IAsyncEnumerable` and hosting APIs
- Register MCP services via `builder.Services.AddMcpServer()` then chain `.WithStdioTransport()` or `.WithSseTransport()`
- Use the `Microsoft.Extensions.Hosting` generic host — MCP server runs as an `IHostedService`

```csharp
var builder = Host.CreateApplicationBuilder(args);
builder.Services
    .AddMcpServer(options => options.ServerInfo = new() { Name = "fai-server", Version = "1.0.0" })
    .WithStdioTransport()
    .WithToolsFromAssembly(typeof(Program).Assembly);
await builder.Build().RunAsync();
```

## Tool Registration

- Prefer `[McpServerTool]` attribute on static methods for simple tools — auto-discovered via `WithToolsFromAssembly()`
- Use `[Description]` on parameters and methods — MCP SDK generates JSON schema from these attributes
- For tools requiring DI services, use `[McpServerTool]` on instance methods and register the class with `WithTools<T>()`
- Return `string` or `McpToolResponse` — never `void`. Always provide an actionable result

```csharp
[McpServerTool("search_documents")]
[Description("Search indexed documents by semantic query")]
public static async Task<string> SearchDocuments(
    IMcpToolContext context,
    [Description("Natural language search query")] string query,
    [Description("Max results to return (1-50)")] int maxResults = 10)
{
    ArgumentException.ThrowIfNullOrWhiteSpace(query);
    ArgumentOutOfRangeException.ThrowIfLessThan(maxResults, 1);
    ArgumentOutOfRangeException.ThrowIfGreaterThan(maxResults, 50);

    var searchClient = context.Services!.GetRequiredService<SearchClient>();
    var results = await searchClient.SearchAsync<SearchDocument>(query, new() { Size = maxResults });
    return JsonSerializer.Serialize(results.Value.GetResults().Select(r => r.Document));
}
```

## Resource & Prompt Handlers

- Implement `IResourceHandler` for exposing data sources — return `McpResource` with MIME type and UTF-8 content
- Implement `IPromptHandler` for reusable prompt templates — accept `Dictionary<string, string>` arguments
- Register handlers via `.WithResources<T>()` and `.WithPrompts<T>()` on the MCP builder
- Resource URIs must follow the `scheme://authority/path` format — e.g., `db://inventory/products`

## Dependency Injection

- Register all external clients (`SearchClient`, `OpenAIClient`, `CosmosClient`) in the DI container
- Access services in tools via `IMcpToolContext.Services.GetRequiredService<T>()`
- Use `IOptions<T>` pattern for configuration — bind from `appsettings.json` or environment variables
- Register `DefaultAzureCredential` as a singleton — never instantiate per-request

```csharp
builder.Services.AddSingleton<TokenCredential>(new DefaultAzureCredential());
builder.Services.AddSingleton(sp =>
{
    var cred = sp.GetRequiredService<TokenCredential>();
    var config = sp.GetRequiredService<IOptions<AzureOpenAIConfig>>().Value;
    return new OpenAIClient(new Uri(config.Endpoint), cred);
});
```

## Error Handling

- Throw `McpException` with meaningful messages for tool-level failures — SDK serializes these to MCP error responses
- Validate all tool inputs at entry with `ArgumentException.ThrowIfNullOrWhiteSpace` and range checks
- Catch `RequestFailedException` from Azure SDK calls and re-throw as `McpException` with context
- Never swallow exceptions — log with `ILogger<T>` then rethrow or return error content
- Use `CancellationToken` from `IMcpToolContext` — respect client cancellation on long operations

```csharp
catch (RequestFailedException ex) when (ex.Status == 429)
{
    logger.LogWarning(ex, "Rate limited calling {Service}", serviceName);
    throw new McpException("Service temporarily unavailable — retry after a few seconds");
}
```

## Logging & Observability

- Inject `ILogger<T>` — never use `Console.WriteLine` (stdout is the MCP stdio transport channel)
- Configure logging to write to stderr for stdio transport: `builder.Logging.AddConsole(o => o.LogToStandardErrorThreshold = LogLevel.Trace)`
- Use structured log templates: `logger.LogInformation("Tool {ToolName} executed in {ElapsedMs}ms", name, sw.ElapsedMilliseconds)`
- Add `ActivitySource` tracing for tool execution spans — correlate with Application Insights

## Transport Configuration

- **stdio**: Default for CLI and VS Code integrations — use `WithStdioTransport()`. No HTTP server needed
- **SSE**: For remote/web clients — use `WithSseTransport()` which adds `/sse` and `/message` endpoints
- SSE transport requires `builder.Services.AddControllers()` and Kestrel configuration
- For SSE, bind to `localhost` only in dev; use reverse proxy (YARP/nginx) with TLS in production
- Never expose SSE transport on `0.0.0.0` without authentication middleware

## Input Validation & JSON Schema

- MCP SDK auto-generates JSON schema from `[Description]` attributes and parameter types
- Use `enum` parameters for constrained choices — SDK generates `enum` in the schema automatically
- Apply `[Range]`, `[StringLength]`, `[RegularExpression]` data annotations for additional constraints
- Validate complex object inputs with `System.ComponentModel.DataAnnotations.Validator.TryValidateObject`

## Testing MCP Tools

- Test tools as regular async methods — call directly with mocked `IMcpToolContext`
- Mock `IMcpToolContext.Services` with a real `ServiceCollection` containing test doubles
- Use `Verify` or `Shouldly` for snapshot testing tool JSON responses
- Integration test the full server by spawning the process and communicating via stdio protocol

```csharp
[Fact]
public async Task SearchDocuments_ValidQuery_ReturnsResults()
{
    var mockSearch = Substitute.For<SearchClient>();
    var services = new ServiceCollection().AddSingleton(mockSearch).BuildServiceProvider();
    var context = Substitute.For<IMcpToolContext>();
    context.Services.Returns(services);

    var result = await MyTools.SearchDocuments(context, "test query", maxResults: 5);

    result.Should().NotBeNullOrEmpty();
    var docs = JsonSerializer.Deserialize<List<SearchDocument>>(result);
    docs.Should().NotBeNull();
}
```

## Anti-Patterns

- ❌ Writing to `Console.Out` in stdio mode — corrupts the MCP JSON-RPC message stream
- ❌ Registering tools with side effects in constructors — use async factory methods or lazy initialization
- ❌ Returning raw exception stack traces in tool responses — leaks internals to the LLM client
- ❌ Blocking async calls with `.Result` or `.GetAwaiter().GetResult()` — causes deadlocks in the hosting pipeline
- ❌ Ignoring `CancellationToken` — tool keeps running after client disconnects, wasting resources
- ❌ Using `HttpClient` directly instead of `IHttpClientFactory` — socket exhaustion under load
- ❌ Hardcoding tool names — use `nameof` or constants for refactor safety
- ❌ Skipping input validation because "the LLM will send valid data" — LLMs hallucinate parameters
- ❌ Deploying SSE transport without auth — any network client can invoke your tools

## WAF Alignment

| Pillar | C# MCP Implementation |
|--------|----------------------|
| **Security** | `DefaultAzureCredential` for Azure auth; validate all tool inputs at entry; never expose secrets in tool responses; SSE behind auth middleware; TLS 1.2+ enforced |
| **Reliability** | `CancellationToken` propagation; retry with Polly on transient Azure SDK failures; health check via `/health` on SSE transport; graceful shutdown via `IHostApplicationLifetime` |
| **Performance** | Async/await throughout — no blocking calls; `IHttpClientFactory` for connection pooling; `IMemoryCache` for repeated lookups; streaming results via `IAsyncEnumerable<T>` |
| **Cost Optimization** | Token budgets in config; model routing (gpt-4o-mini for simple tools, gpt-4o for complex); cache tool results with TTL; right-size Kestrel thread pool |
| **Operational Excellence** | Structured logging to stderr/Application Insights; `ActivitySource` tracing per tool; CI with `dotnet test` + coverage; publish as single-file or container |
| **Responsible AI** | Content Safety check on tool outputs containing LLM text; PII redaction before logging; tool descriptions include capability boundaries |
