---
description: "ASP.NET Core 9 standards — Minimal APIs, DI, middleware pipeline, Entra ID auth, EF Core, health checks, rate limiting, output caching, and Azure-native integration."
applyTo: "**/*.cs, **/*.cshtml, **/*.razor"
waf:
  - "security"
  - "reliability"
  - "operational-excellence"
  - "performance-efficiency"
  - "cost-optimization"
---

# ASP.NET Core WAF — FAI Standards

When writing or reviewing ASP.NET Core code, enforce these WAF-aligned standards.

## Rules

### Minimal APIs & Routing
1. Use Minimal APIs for simple CRUD endpoints; reserve MVC Controllers for complex view-based flows or areas with heavy model binding.
2. Group related endpoints with `app.MapGroup("/api/v1/orders")` and apply shared filters per group.
3. Use `TypedResults` return types (`Results<Ok<T>, NotFound, ValidationProblem>`) for compile-time OpenAPI accuracy.
4. Apply `[FromBody]`, `[FromQuery]`, `[FromRoute]` explicitly — never rely on implicit binding for public APIs.
5. Version APIs via URL path (`/api/v1/`) or header (`api-version`). Use `Asp.Versioning.Http` package.

### Dependency Injection
6. Register services with the correct lifetime: `AddSingleton` for stateless/thread-safe, `AddScoped` for per-request (DbContext, auth context), `AddTransient` for lightweight stateless.
7. Never inject `IServiceProvider` directly — use constructor injection or `[FromServices]` in Minimal API handlers.
8. Use `IOptions<T>` / `IOptionsSnapshot<T>` for configuration; bind sections in `Program.cs` with `builder.Services.Configure<T>(builder.Configuration.GetSection("Key"))`.
9. Validate options at startup with `ValidateDataAnnotations().ValidateOnStart()` to fail fast on misconfiguration.

### Middleware Pipeline
10. Order middleware correctly: `UseExceptionHandler` → `UseHsts` → `UseHttpsRedirection` → `UseCors` → `UseRateLimiter` → `UseOutputCache` → `UseAuthentication` → `UseAuthorization` → `MapEndpoints`.
11. Write custom middleware as classes implementing `IMiddleware` for scoped DI, or as inline `app.Use()` for simple concerns.
12. Use `UseExceptionHandler("/error")` with a ProblemDetails handler — never expose stack traces in production.

### Authentication & Authorization
13. Use Microsoft Entra ID (Azure AD) for all authentication. Configure with `AddMicrosoftIdentityWebApi` from `Microsoft.Identity.Web`.
14. Apply policy-based authorization: `builder.Services.AddAuthorizationBuilder().AddPolicy("AdminOnly", p => p.RequireRole("Admin"))`.
15. Use `[Authorize(Policy = "...")]` on route groups or individual endpoints — never leave endpoints unprotected by default.
16. Store no secrets in code or config files. Use Azure Key Vault with `builder.Configuration.AddAzureKeyVault()` and Managed Identity.

### Entity Framework Core
17. Register `DbContext` as scoped: `builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlServer(conn))`.
18. Use `AsNoTracking()` for read-only queries. Use `ExecuteUpdateAsync` / `ExecuteDeleteAsync` for bulk operations.
19. Always use parameterized queries via LINQ — never interpolate user input into raw SQL.
20. Apply migrations via CI/CD pipeline (`dotnet ef migrations bundle`), never at application startup in production.
21. Configure connection resiliency: `o.UseSqlServer(conn, sql => sql.EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: TimeSpan.FromSeconds(30), errorNumbersToAdd: null))`.

### Health Checks
22. Register health checks for all dependencies: `builder.Services.AddHealthChecks().AddSqlServer(conn).AddAzureBlobStorage(blobConn).AddCheck<CustomHealthCheck>("custom")`.
23. Map separate liveness and readiness endpoints: `/healthz/live` (self-check) and `/healthz/ready` (dependency check).
24. Return `Degraded` status when non-critical dependencies fail; `Unhealthy` only for critical failures.

### OpenAPI & Documentation
25. Use `builder.Services.AddOpenApi()` (ASP.NET Core 9 built-in) or Swashbuckle for OpenAPI spec generation.
26. Annotate endpoints with `WithName()`, `WithTags()`, `WithSummary()`, and `Produces<T>()` for accurate specs.
27. Disable Swagger UI in production: `if (app.Environment.IsDevelopment()) app.MapOpenApi()`.

### Rate Limiting & Caching
28. Configure rate limiting with `builder.Services.AddRateLimiter(o => { o.AddFixedWindowLimiter("fixed", opt => { opt.Window = TimeSpan.FromMinutes(1); opt.PermitLimit = 100; }); })`.
29. Use output caching for read-heavy endpoints: `app.MapGet("/products", GetProducts).CacheOutput(p => p.Expire(TimeSpan.FromMinutes(5)).Tag("products"))`.
30. Invalidate cache by tag when data changes: `cache.EvictByTagAsync("products")`.

### CORS & Security Headers
31. Configure CORS per environment — restrict origins in production: `builder.Services.AddCors(o => o.AddPolicy("prod", p => p.WithOrigins("https://app.contoso.com").AllowCredentials()))`.
32. Add security headers via middleware: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Content-Security-Policy`.
33. Enforce HTTPS: `app.UseHsts()` + `app.UseHttpsRedirection()`. Set HSTS max-age to 1 year in production.

### Logging & Observability
34. Use Serilog with structured logging: `builder.Host.UseSerilog((ctx, lc) => lc.ReadFrom.Configuration(ctx.Configuration))`.
35. Log with message templates, not string interpolation: `Log.Information("Order {OrderId} placed by {UserId}", orderId, userId)`.
36. Export telemetry to Azure Monitor: `builder.Services.AddOpenTelemetry().UseAzureMonitor()`. Trace HTTP requests, EF queries, and custom spans.
37. Never log PII, tokens, connection strings, or request bodies containing sensitive data.

### Model Validation & Error Handling
38. Use `FluentValidation` or `DataAnnotations` on request DTOs. Return `ValidationProblem()` (RFC 9457) for invalid input.
39. Use a global exception handler that returns `ProblemDetails` with correlation IDs in production and stack traces only in development.
40. Use `Results.Problem()` for domain errors with consistent error codes: `Results.Problem("Insufficient balance", statusCode: 422, extensions: new Dictionary<string, object?> { ["code"] = "BALANCE_LOW" })`.

## Patterns

```csharp
// Minimal API with typed results, validation, and auth
app.MapGroup("/api/v1/orders")
   .RequireAuthorization("OrderManager")
   .AddEndpointFilter<ValidationFilter<CreateOrderRequest>>()
   .MapPost("/", async (CreateOrderRequest req, IOrderService svc) =>
   {
       var result = await svc.CreateAsync(req);
       return result.Match<IResult>(
           order => TypedResults.Created($"/api/v1/orders/{order.Id}", order),
           error => TypedResults.Problem(error.Message, statusCode: 422));
   })
   .WithName("CreateOrder")
   .Produces<OrderDto>(201)
   .ProducesValidationProblem();
```

```csharp
// Health check with liveness and readiness
app.MapHealthChecks("/healthz/live", new HealthCheckOptions
{
    Predicate = _ => false // liveness: no dependency checks
});
app.MapHealthChecks("/healthz/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});
```

```csharp
// Rate limiter + output cache composition
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.AddTokenBucketLimiter("api", opt =>
    {
        opt.TokenLimit = 100;
        opt.ReplenishmentPeriod = TimeSpan.FromMinutes(1);
        opt.TokensPerPeriod = 50;
    });
});

app.MapGet("/api/catalog", GetCatalog)
   .RequireRateLimiting("api")
   .CacheOutput(p => p.Expire(TimeSpan.FromMinutes(10)));
```

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|---|---|---|
| `app.UseDeveloperExceptionPage()` in production | Leaks stack traces and internal paths | Use `UseExceptionHandler` with ProblemDetails |
| Injecting `DbContext` as singleton | Not thread-safe, causes data corruption | Register as scoped via `AddDbContext` |
| `string.Format` with user input in raw SQL | SQL injection vulnerability | Use LINQ or parameterized `FromSqlInterpolated` |
| Hardcoded connection strings in `appsettings.json` | Secrets exposed in source control | Use Azure Key Vault + Managed Identity |
| Catch-all `try/catch` in every endpoint | Duplicated error handling, inconsistent responses | Global exception handler middleware |
| `AllowAnyOrigin().AllowCredentials()` in CORS | Browser rejects this combination, security risk | Explicit origin allowlist with credentials |
| Missing `ValidateOnStart()` for options | Bad config discovered at runtime under load | Fail fast at startup with validation |
| `Task.Result` or `.Wait()` in async pipeline | Thread pool starvation, deadlocks | Always `await` async methods end-to-end |

## Testing

- Unit test Minimal API handlers by calling them directly with mocked services.
- Use `WebApplicationFactory<Program>` for integration tests with real middleware pipeline.
- Test rate limiting by sending `PermitLimit + 1` requests and asserting 429 response.
- Test health check endpoints return `Healthy`, `Degraded`, and `Unhealthy` states.
- Validate OpenAPI spec with `Microsoft.AspNetCore.OpenApi.Tests` or schema diff in CI.
- Use `Respawn` or `Testcontainers` for database integration tests — never share state between tests.

## WAF Alignment

| Pillar | Implementation |
|---|---|
| **Security** | Entra ID auth, Key Vault secrets, HTTPS enforcement, security headers, parameterized queries, CORS allowlists |
| **Reliability** | EF Core retry policies, health checks (liveness + readiness), graceful shutdown with `IHostApplicationLifetime`, circuit breaker via Polly |
| **Operational Excellence** | Structured logging (Serilog), OpenTelemetry traces, CI/CD migrations, ProblemDetails error responses, feature flags with `Microsoft.FeatureManagement` |
| **Performance Efficiency** | Output caching, response compression, `AsNoTracking` reads, bulk EF operations, connection pooling, minimal API over MVC for throughput |
| **Cost Optimization** | Rate limiting to prevent abuse, right-sized App Service plans, Azure SQL serverless tier, cache to reduce database load |
