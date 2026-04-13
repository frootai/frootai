---
description: "C#/.NET coding standards aligned with Azure WAF pillars — Managed Identity, async patterns, dependency injection, structured logging, Pydantic-like validation with FluentValidation, and production-ready testing with xUnit."
applyTo: "**/*.cs, **/*.csproj, **/*.sln"
waf:
  - "security"
  - "reliability"
  - "performance-efficiency"
---

# C# / .NET — FAI Standards

## Async / Await

- All I/O-bound methods MUST be `async Task<T>` — never `.Result`, `.Wait()`, or `.GetAwaiter().GetResult()`
- Use `await using` for `IAsyncDisposable` resources (DbContext, HttpClient streams, Azure SDK clients)
- Prefer `ValueTask<T>` for hot paths that often complete synchronously
- Cancel long-running work with `CancellationToken` — propagate through entire call chain
- Use `Task.WhenAll` for independent parallel calls, never sequential `await` in a loop

```csharp
// ✅ Correct — async disposal + cancellation
await using var stream = await blobClient.OpenReadAsync(cancellationToken: ct);
var results = await Task.WhenAll(ids.Select(id => GetAsync(id, ct)));

// ❌ Avoid — sync-over-async deadlock risk
var data = client.GetAsync(url).Result;
```

## Nullable Reference Types

- Enable `<Nullable>enable</Nullable>` in every `.csproj` — treat warnings as errors
- Use `string?` only when null is a valid domain concept, not for laziness
- Guard public API boundaries with `ArgumentNullException.ThrowIfNull(param)`
- Prefer `required` modifier on properties over null-check constructors

## Records and Pattern Matching

- Use `record` / `record struct` for DTOs, API responses, value objects — immutable by default
- Prefer `switch` expressions with pattern matching over `if/else` chains
- Use `is not null` instead of `!= null` for clarity

```csharp
// ✅ Record + pattern matching
public record ChatRequest(string Prompt, string Model = "gpt-4o", int MaxTokens = 1024);

var tier = tokens switch
{
    < 100   => PricingTier.Low,
    < 1000  => PricingTier.Standard,
    _       => PricingTier.Premium
};
```

## Dependency Injection and Configuration

- Register services in `Program.cs` — constructor injection only, no service locator
- Bind configuration sections with `IOptions<T>` / `IOptionsSnapshot<T>` — never read raw `IConfiguration` in services
- Validate options at startup with `ValidateDataAnnotations().ValidateOnStart()`
- Use `IHttpClientFactory` — never `new HttpClient()` (socket exhaustion)

```csharp
// ✅ Options pattern with validation
builder.Services.AddOptions<OpenAISettings>()
    .BindConfiguration("OpenAI")
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddHttpClient<ISearchService, SearchService>(client =>
    client.BaseAddress = new Uri(builder.Configuration["Search:Endpoint"]!));
```

## Azure Identity and Security

- `DefaultAzureCredential` for ALL Azure SDK auth — zero connection strings or API keys in code
- Store secrets in Key Vault, reference via `AddAzureKeyVault()` or App Configuration
- Use `Azure.Identity` with `ManagedIdentityCredential` in Dockerfile / production overrides
- Set `AZURE_CLIENT_ID` env var for user-assigned managed identity

```csharp
// ✅ Managed identity — works local (az login) and deployed (MI)
var credential = new DefaultAzureCredential();
builder.Services.AddSingleton(new OpenAIClient(
    new Uri(settings.Endpoint), credential));
```

## Minimal APIs and Endpoints

- Group endpoints with `MapGroup` + `TypedResults` for OpenAPI schema generation
- Return `Results<Ok<T>, NotFound, BadRequest<ProblemDetails>>` — explicit union return types
- Add `.RequireAuthorization()` on groups, `.AllowAnonymous()` on health endpoints
- Request body validation with `[FromBody]` + FluentValidation or `DataAnnotations`

```csharp
var api = app.MapGroup("/api/chat").RequireAuthorization();
api.MapPost("/completions", async (ChatRequest req, IChatService svc, CancellationToken ct) =>
{
    var result = await svc.CompleteAsync(req, ct);
    return TypedResults.Ok(result);
});
```

## Serialization

- Use `System.Text.Json` source generators for AOT-safe, allocation-free serialization
- Annotate DTOs with `[JsonSerializable]` context — avoids reflection at runtime
- Set `PropertyNamingPolicy = JsonNamingPolicy.CamelCase` globally in `JsonSerializerOptions`
- Never deserialize untrusted JSON without a concrete target type

```csharp
[JsonSerializable(typeof(ChatRequest))]
[JsonSerializable(typeof(ChatResponse))]
internal partial class AppJsonContext : JsonSerializerContext;

builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.TypeInfoResolverChain.Add(AppJsonContext.Default));
```

## Resilience

- Use `Microsoft.Extensions.Http.Resilience` (Polly v8) — `AddStandardResilienceHandler()` on HttpClient
- Retry: 3 attempts, exponential backoff (1s base, 30s max) with jitter
- Circuit breaker: break after 50% failure rate in 30s sampling window
- Health checks via `AddHealthChecks().AddAzureBlobStorage().AddNpgSql()` — expose at `/health`

```csharp
builder.Services.AddHttpClient<IOpenAIService, OpenAIService>()
    .AddStandardResilienceHandler();

builder.Services.AddHealthChecks()
    .AddAzureBlobStorage(sp => sp.GetRequiredService<BlobServiceClient>())
    .AddCheck<ModelHealthCheck>("openai-model");
```

## Structured Logging

- Use `ILogger<T>` with high-performance `LoggerMessage.Define` source generators
- Log correlation IDs, operation names, durations — never raw user input or PII
- Enable Application Insights with `AddOpenTelemetry()` for traces, metrics, and logs
- Use log scopes for request correlation: `using (_logger.BeginScope(...))`

```csharp
// ✅ Source-generated high-perf logging
public static partial class Log
{
    [LoggerMessage(1, LogLevel.Information, "Chat completed in {ElapsedMs}ms, tokens={Tokens}")]
    public static partial void ChatCompleted(ILogger logger, long elapsedMs, int tokens);
}
```

## Anti-Patterns

- ❌ `async void` — unobservable exceptions crash the process; only valid for event handlers
- ❌ `new HttpClient()` in a `using` — causes socket exhaustion; use `IHttpClientFactory`
- ❌ `.Result` / `.Wait()` — deadlocks in ASP.NET synchronization context
- ❌ `catch (Exception) { }` — swallowing all exceptions hides bugs; always log or rethrow
- ❌ `IConfiguration["Key"]` deep in services — use `IOptions<T>` for testability and validation
- ❌ `DateTime.Now` — use `DateTimeOffset.UtcNow` or `TimeProvider` for testability
- ❌ String concatenation in hot paths — use `string.Create`, `StringBuilder`, or interpolated string handlers
- ❌ `Thread.Sleep` — use `await Task.Delay(ts, ct)` with cancellation
- ❌ Logging PII, full user prompts, or secret values — even at `Debug` level

## WAF Alignment

| Pillar | Practices |
|--------|-----------|
| **Security** | `DefaultAzureCredential`, Key Vault refs, `RequireAuthorization()`, Content Safety API, input validation, PII redaction |
| **Reliability** | Polly v8 retry + circuit breaker, health checks at `/health`, `CancellationToken` propagation, graceful shutdown via `IHostApplicationLifetime` |
| **Performance** | Source-gen JSON, `ValueTask<T>`, `IHttpClientFactory` connection pooling, response caching, async streaming with `IAsyncEnumerable<T>` |
| **Cost** | `IOptions<T>` for model routing (gpt-4o-mini vs gpt-4o), `max_tokens` from config, semantic caching, right-sized App Service SKUs |
| **Operations** | `ILogger<T>` + OpenTelemetry, Application Insights, custom metrics (latency p95, token usage), Bicep IaC via GitHub Actions |
| **Responsible AI** | Content Safety middleware, groundedness checks, fairness logging, human escalation hooks |
