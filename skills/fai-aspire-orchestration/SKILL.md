---
name: fai-aspire-orchestration
description: |
  Configure .NET Aspire app host for distributed AI services with health dependencies,
  OpenTelemetry wiring, and environment-aware secret management. Use when building
  multi-service .NET solutions with Aspire orchestration.
---

# .NET Aspire Orchestration

Configure .NET Aspire to orchestrate distributed services with health checks, telemetry, and secrets.

## When to Use

- Building multi-service .NET applications (API + workers + cache + AI)
- Setting up local development with service discovery
- Configuring OpenTelemetry for distributed tracing
- Wiring Azure services (OpenAI, AI Search, Storage) into local dev

---

## App Host Configuration

```csharp
// AppHost/Program.cs
var builder = DistributedApplication.CreateBuilder(args);

// Infrastructure
var cache = builder.AddRedis("cache");
var storage = builder.AddAzureStorage("storage");
var blobs = storage.AddBlobs("documents");

// AI Services
var openai = builder.AddConnectionString("openai");
var search = builder.AddConnectionString("search");

// API Service
var api = builder.AddProject<Projects.Api>("api")
    .WithReference(cache)
    .WithReference(openai)
    .WithReference(search)
    .WithExternalHttpEndpoints();

// Background Worker
builder.AddProject<Projects.Worker>("worker")
    .WithReference(cache)
    .WithReference(blobs)
    .WithReference(openai)
    .WaitFor(cache)          // Health dependency
    .WaitFor(api);           // Start after API is ready

builder.Build().Run();
```

## Health Dependency Ordering

Use `WaitFor` to enforce startup order based on health checks:

```csharp
// Worker waits for cache AND search to be healthy before starting
var worker = builder.AddProject<Projects.Worker>("worker")
    .WaitFor(cache)
    .WaitFor(search);

// API waits only for cache (search is optional/degraded)
var api = builder.AddProject<Projects.Api>("api")
    .WaitFor(cache);
```

## OpenTelemetry Wiring

```csharp
// ServiceDefaults/Extensions.cs — shared across all services
public static IHostApplicationBuilder AddServiceDefaults(this IHostApplicationBuilder builder)
{
    builder.ConfigureOpenTelemetry();
    builder.AddDefaultHealthChecks();
    return builder;
}

public static IHostApplicationBuilder ConfigureOpenTelemetry(this IHostApplicationBuilder builder)
{
    builder.Logging.AddOpenTelemetry(logging =>
    {
        logging.IncludeFormattedMessage = true;
        logging.IncludeScopes = true;
    });

    builder.Services.AddOpenTelemetry()
        .WithMetrics(metrics =>
        {
            metrics.AddAspNetCoreInstrumentation()
                   .AddHttpClientInstrumentation()
                   .AddRuntimeInstrumentation();
        })
        .WithTracing(tracing =>
        {
            tracing.AddAspNetCoreInstrumentation()
                   .AddHttpClientInstrumentation()
                   .AddSource("Azure.AI.OpenAI");
        });

    builder.AddOpenTelemetryExporters();
    return builder;
}
```

## Secret Management

```csharp
// In AppHost — wire Key Vault connection strings
var openai = builder.AddConnectionString("openai");

// In service — consume via DI (never hardcode)
builder.Services.AddAzureOpenAI(builder.Configuration.GetConnectionString("openai"));
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Service startup flakiness | Missing WaitFor dependencies | Add WaitFor for all required services |
| Telemetry not appearing | Missing OTLP exporter config | Ensure AddOpenTelemetryExporters is called |
| Connection string missing | Secret not configured in AppHost | Add via AddConnectionString or user-secrets |
| Port conflicts | Multiple services binding same port | Let Aspire assign ports automatically |
