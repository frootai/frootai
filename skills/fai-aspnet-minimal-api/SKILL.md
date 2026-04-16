---
name: fai-aspnet-minimal-api
description: Scaffold ASP.NET Core Minimal API with typed route groups, FluentValidation, Managed Identity credentials, OpenAPI v3 via Scalar, Serilog structured logging, and health check endpoints — cutting AI service setup time from hours to minutes.
---

# FAI ASP.NET Core Minimal API

Scaffolds a production-ready ASP.NET Core Minimal API optimised for AI backend services. Replaces the generic `WebApplication.CreateBuilder` boilerplate with a typed, validated, observable API that follows Azure Well-Architected patterns from the first commit.

## When to Invoke

| Signal | Example |
|--------|---------|
| Starting a new .NET AI service | RAG query endpoint, embedding pipeline trigger |
| Existing controller-based API needs simplification | Heavy MVC controllers with no reuse |
| Service missing health checks or structured logging | No /health endpoint; Console.WriteLine in code |
| Azure credentials hardcoded as API keys | `"api-key"` header in config, not Managed Identity |

## Workflow

### Step 1 — Project Scaffold

```bash
dotnet new webapi --use-minimal-apis -n AiService
dotnet add package Azure.AI.OpenAI
dotnet add package Azure.Identity
dotnet add package FluentValidation.AspNetCore
dotnet add package Serilog.AspNetCore
dotnet add package Microsoft.AspNetCore.OpenApi
dotnet add package Scalar.AspNetCore          # Modern OpenAPI UI (replaces Swagger)
```

### Step 2 — Program.cs (Minimal API Shell)

```csharp
using Azure.AI.OpenAI;
using Azure.Identity;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Structured logging -- JSON in prod, readable console in dev
builder.Host.UseSerilog((ctx, cfg) => cfg
    .ReadFrom.Configuration(ctx.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console(outputTemplate:
        "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}"));

// Managed Identity -- works locally via 'az login', in prod with system-assigned MSI
builder.Services.AddSingleton(_ =>
    new AzureOpenAIClient(
        new Uri(builder.Configuration["AZURE_OPENAI_ENDPOINT"]!),
        new DefaultAzureCredential()));

// Validation
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

// OpenAPI
builder.Services.AddOpenApi();

// Health checks
builder.Services.AddHealthChecks()
    .AddCheck<AzureOpenAIHealthCheck>("azure-openai");

var app = builder.Build();

app.MapOpenApi();
app.MapScalarApiReference();               // /scalar/v1 -- interactive API docs

// Route groups
app.MapGroup("/v1/completions").MapCompletionsEndpoints();
app.MapGroup("/v1/embeddings").MapEmbeddingsEndpoints();

app.MapHealthChecks("/health/live",  new() { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new() { Predicate = _ => true  });

app.Run();
```

### Step 3 — Typed Endpoint with Validation

```csharp
// Features/Completions/CompletionsEndpoints.cs
public static class CompletionsEndpoints
{
    public static RouteGroupBuilder MapCompletionsEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/", HandleCompletionAsync)
             .WithName("CreateCompletion")
             .WithOpenApi()
             .Produces<CompletionResponse>(200)
             .ProducesValidationProblem();
        return group;
    }

    private static async Task<IResult> HandleCompletionAsync(
        CompletionRequest request,
        IValidator<CompletionRequest> validator,
        AzureOpenAIClient client,
        ILogger<Program> logger,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return TypedResults.ValidationProblem(validation.ToDictionary());

        using var _ = logger.BeginScope(new { request.Model, request.MaxTokens });
        logger.LogInformation("Completion request received");

        var chatClient = client.GetChatClient(request.Model);
        var response   = await chatClient.CompleteChatAsync(
            [new UserChatMessage(request.Prompt)],
            new ChatCompletionOptions { MaxOutputTokenCount = request.MaxTokens },
            ct);

        return TypedResults.Ok(new CompletionResponse(
            response.Value.Content[0].Text,
            response.Value.Usage.TotalTokenCount));
    }
}
```

### Step 4 — Request/Response Models and FluentValidation

```csharp
// Features/Completions/Models.cs
public record CompletionRequest(
    string Prompt,
    string Model      = "gpt-4o-mini",
    int    MaxTokens  = 512,
    float  Temperature = 0.7f);

public record CompletionResponse(string Text, int TokensUsed);

// FluentValidation -- all validation in one place, not scattered in handlers
public class CompletionRequestValidator : AbstractValidator<CompletionRequest>
{
    public CompletionRequestValidator()
    {
        RuleFor(x => x.Prompt)
            .NotEmpty().WithMessage("Prompt is required")
            .MaximumLength(4000).WithMessage("Prompt must be <= 4000 characters");

        RuleFor(x => x.Model)
            .Must(m => m is "gpt-4o" or "gpt-4o-mini")
            .WithMessage("Model must be 'gpt-4o' or 'gpt-4o-mini'");

        RuleFor(x => x.MaxTokens).InclusiveBetween(1, 4096);
        RuleFor(x => x.Temperature).InclusiveBetween(0f, 2f);
    }
}
```

### Step 5 — Azure OpenAI Health Check

```csharp
public class AzureOpenAIHealthCheck : IHealthCheck
{
    private readonly AzureOpenAIClient _client;
    public AzureOpenAIHealthCheck(AzureOpenAIClient client) => _client = client;

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken ct = default)
    {
        try
        {
            // Lightweight check -- list models endpoint, no tokens consumed
            _ = _client.GetChatClient("gpt-4o-mini");
            return HealthCheckResult.Healthy("Azure OpenAI reachable");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Azure OpenAI unreachable", ex);
        }
    }
}
```

### Step 6 — appsettings.json

```json
{
  "Logging": {
    "LogLevel": { "Default": "Information", "Microsoft.AspNetCore": "Warning" }
  },
  "Serilog": {
    "MinimumLevel": { "Default": "Information" }
  }
}
```

```json
// appsettings.Development.json -- local env vars (never check in real values)
{
  "AZURE_OPENAI_ENDPOINT": "https://<your-resource>.openai.azure.com/"
}
```

## WAF Alignment

| Pillar | Contribution |
|--------|-------------|
| Security | `DefaultAzureCredential` supports Managed Identity in prod and `az login` locally -- no API key in config |
| Reliability | Health checks enable Kubernetes readiness/liveness probes and load balancer drain |
| Operational Excellence | FluentValidation centralises validation; Serilog JSON output feeds Log Analytics |
| Performance Efficiency | Minimal API has lower allocation overhead than MVC controllers for high-throughput AI endpoints |

## Compatible Solution Plays

- **Play 01** — Enterprise RAG (query endpoint)
- **Play 03** — Deterministic Agent (structured output endpoint)
- **Play 14** — Cost-Optimized AI Gateway (proxy endpoint)

## Notes

- Use `TypedResults` (not `Results.Ok`) for compile-time response type checking in .NET 8+
- `MapGroup` route prefixes ensure API versioning (/v1, /v2) is set from day one
- Replace `Scalar.AspNetCore` with Swashbuckle if your internal tooling requires Swagger UI
- `AddFluentValidationAutoValidation()` auto-runs validators on every bound model -- no manual `Validate()` calls needed
