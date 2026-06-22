---
description: "C# reliability standards — Polly retry/circuit breaker, health checks, exception handling, resilience."
applyTo: "**/*.cs"
waf:
  - "reliability"
---

# C# Reliability Patterns — FAI Standards

## Polly v8 Resilience Pipelines

```csharp
// Compose retry + circuit breaker + timeout + hedging in a single pipeline
var pipeline = new ResiliencePipelineBuilder<HttpResponseMessage>()
    .AddRetry(new RetryStrategyOptions<HttpResponseMessage>
    {
        MaxRetryAttempts = 3,
        BackoffType = DelayBackoffType.Exponential,
        UseJitter = true,
        Delay = TimeSpan.FromSeconds(1),
        ShouldHandle = new PredicateBuilder<HttpResponseMessage>()
            .Handle<HttpRequestException>()
            .HandleResult(r => r.StatusCode == HttpStatusCode.TooManyRequests
                            || r.StatusCode >= HttpStatusCode.InternalServerError)
    })
    .AddCircuitBreaker(new CircuitBreakerStrategyOptions<HttpResponseMessage>
    {
        FailureRatio = 0.5,
        SamplingDuration = TimeSpan.FromSeconds(30),
        MinimumThroughput = 10,
        BreakDuration = TimeSpan.FromSeconds(15)
    })
    .AddTimeout(TimeSpan.FromSeconds(10))
    .Build();

// Rate limiter — token bucket shared across requests
services.AddResiliencePipeline("ai-gateway", builder =>
    builder.AddRateLimiter(new TokenBucketRateLimiterOptions
    {
        TokenLimit = 60, ReplenishmentPeriod = TimeSpan.FromMinutes(1),
        TokensPerPeriod = 60, QueueLimit = 10
    }));

// Hedging — parallel speculative execution for latency-sensitive calls
builder.AddHedging(new HedgingStrategyOptions<HttpResponseMessage>
{
    MaxHedgedAttempts = 2,
    Delay = TimeSpan.FromMilliseconds(500) // fire hedge after 500ms
});
```

## IHttpClientFactory + Polly Integration

```csharp
services.AddHttpClient("openai-client", c =>
    { c.BaseAddress = new Uri(config["OpenAI:Endpoint"]); })
    .AddStandardResilienceHandler()           // Polly v8 defaults: retry+CB+timeout
    .ConfigureHttpClient((sp, client) =>
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer",
                sp.GetRequiredService<IConfiguration>()["OpenAI:Key"]));
```

## Health Checks

```csharp
public class AzureOpenAIHealthCheck(OpenAIClient client) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext ctx, CancellationToken ct = default)
    {
        try
        {
            await client.GetChatCompletionsAsync(new ChatCompletionsOptions
            {
                DeploymentName = "gpt-4o-mini",
                Messages = { new ChatRequestUserMessage("ping") },
                MaxTokens = 1
            }, ct);
            return HealthCheckResult.Healthy();
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("OpenAI unreachable", ex);
        }
    }
}
// Registration
services.AddHealthChecks()
    .AddCheck<AzureOpenAIHealthCheck>("openai", tags: ["ready"])
    .AddAzureBlobStorage(config.GetConnectionString("Storage")!, tags: ["ready"])
    .AddNpgSql(config.GetConnectionString("Postgres")!);
app.MapHealthChecks("/health/live", new() { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new() { Predicate = c => c.Tags.Contains("ready") });
```

## Graceful Shutdown & Resource Cleanup

```csharp
public class IngestWorker(
    IHostApplicationLifetime lifetime, ILogger<IngestWorker> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        lifetime.ApplicationStopping.Register(() => log.LogInformation("Draining..."));
        await foreach (var msg in channel.Reader.ReadAllAsync(ct))
        {
            try { await ProcessAsync(msg, ct); }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex) { log.LogError(ex, "Msg {Id} failed", msg.Id); }
        }
    }
}

// IAsyncDisposable for deterministic cleanup
public sealed class EmbeddingBatch : IAsyncDisposable
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    public async ValueTask DisposeAsync()
    {
        await FlushAsync();
        _gate.Dispose();
    }
}
```

## Distributed Locking & Idempotency

```csharp
// Redis distributed lock via StackExchange.Redis
await using var locker = await db.LockTakeAsync($"lock:doc:{docId}",
    Environment.MachineName, TimeSpan.FromSeconds(30));
if (!locker) throw new ConcurrencyException($"Doc {docId} locked");

// Azure Blob lease lock (no Redis dependency)
var lease = blobClient.GetBlobLeaseClient();
await lease.AcquireAsync(TimeSpan.FromSeconds(30), cancellationToken: ct);

// Idempotency key — prevent duplicate processing
public async Task<bool> TryClaimAsync(string idempotencyKey)
{
    var added = await db.StringSetAsync($"idem:{idempotencyKey}", "1",
        TimeSpan.FromHours(24), When.NotExists);
    return added; // false = already processed
}
```

## Outbox Pattern & Connection Resiliency

```csharp
// Outbox — write domain event + message atomically, relay separately
await using var tx = await dbContext.Database.BeginTransactionAsync(ct);
dbContext.Orders.Add(order);
dbContext.OutboxMessages.Add(new OutboxMessage
{
    Id = Guid.NewGuid(), Type = "OrderCreated",
    Payload = JsonSerializer.Serialize(order), CreatedAt = DateTime.UtcNow
});
await dbContext.SaveChangesAsync(ct);
await tx.CommitAsync(ct);

// EF Core retry-on-transient
services.AddDbContext<AppDbContext>(o =>
    o.UseNpgsql(connStr, npgsql =>
        npgsql.EnableRetryOnFailure(maxRetryCount: 3,
            maxRetryDelay: TimeSpan.FromSeconds(10), errorCodesToAdd: null)));
```

## Structured Exception Hierarchy

```csharp
public abstract class DomainException(string message, string code)
    : Exception(message) { public string Code { get; } = code; }

public class TransientServiceException(string svc, Exception inner)
    : DomainException($"Transient failure calling {svc}", "TRANSIENT") { }

public class ContentFilteredException(string category)
    : DomainException($"Content blocked: {category}", "CONTENT_FILTERED") { }

public class ConcurrencyException(string msg)
    : DomainException(msg, "CONCURRENCY") { }

// Middleware maps hierarchy to HTTP status codes
app.UseExceptionHandler(err => err.Run(async ctx =>
{
    var ex = ctx.Features.Get<IExceptionHandlerFeature>()?.Error;
    ctx.Response.StatusCode = ex switch
    {
        TransientServiceException => 503,
        ContentFilteredException  => 451,
        ConcurrencyException      => 409,
        _ => 500
    };
    await ctx.Response.WriteAsJsonAsync(new { error = ex?.Message });
}));
```

## Anti-Patterns

- ❌ `new HttpClient()` per request — use `IHttpClientFactory` to avoid socket exhaustion
- ❌ Catching `Exception` and swallowing — always log, always rethrow or map to domain type
- ❌ `Task.Result` or `.Wait()` — causes threadpool starvation; use `await` throughout
- ❌ Retry without jitter — thundering herd on recovery; always `UseJitter = true`
- ❌ No `CancellationToken` propagation — shutdown hangs; pass `ct` to every async call
- ❌ Fire-and-forget `Task.Run` in request pipeline — lost exceptions, no backpressure
- ❌ Inline transaction + message publish — use outbox; broker publish can silently fail
- ❌ Health check that returns `Healthy` without testing downstream dependencies

## WAF Alignment

| Pillar | Patterns Applied |
|--------|-----------------|
| **Reliability** | Polly v8 pipelines (retry+CB+timeout+hedging), health probes (live/ready), graceful shutdown, outbox, EF Core retry, distributed locks |
| **Security** | `DefaultAzureCredential`, Key Vault refs, no secrets in code, content-filtered exception hierarchy |
| **Cost Optimization** | Rate limiter (token bucket), hedging with bounded attempts, right-sized health probe (1 token) |
| **Operational Excellence** | Structured logging with correlation IDs, domain exception codes, `/health/ready` for orchestrators |
| **Performance Efficiency** | `IAsyncDisposable` cleanup, `SemaphoreSlim` concurrency gates, channel-based `BackgroundService` |
| **Responsible AI** | `ContentFilteredException` propagation, safety checks before response delivery |
