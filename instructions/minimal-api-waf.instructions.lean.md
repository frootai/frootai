---
description: "ASP.NET Minimal API standards — endpoint routing, DI, filters, OpenAPI, rate limiting."
applyTo: "**/*.cs"
waf:
  - "performance-efficiency"
  - "security"
---

# ASP.NET Minimal APIs — FAI Standards

## Route Organization with MapGroup

Structure endpoints using `MapGroup` and `IEndpointRouteBuilder` extensions — never scatter `app.Map*` calls in `Program.cs`.

```csharp
// Program.cs — clean top-level
app.MapGroup("/api/products").MapProductEndpoints();
app.MapGroup("/api/orders").MapOrderEndpoints().RequireAuthorization();

// ProductEndpoints.cs — extension method pattern
public static class ProductEndpoints
{
    public static RouteGroupBuilder MapProductEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/", GetAll).WithName("GetProducts").WithTags("Products");
        group.MapGet("/{id:int}", GetById).WithName("GetProductById");
        group.MapPost("/", Create).AddEndpointFilter<ValidationFilter<CreateProductRequest>>();
        group.MapPut("/{id:int}", Update).RequireAuthorization("AdminPolicy");
        group.MapDelete("/{id:int}", Delete).RequireAuthorization("AdminPolicy");
        return group;
    }
}
```

## Typed Results

Always return `TypedResults` — never raw objects. Enables compile-time checking and correct OpenAPI schema generation.

```csharp
static async Task<Results<Ok<ProductDto>, NotFound, ValidationProblem>> GetById(
    int id, ProductDbContext db, CancellationToken ct)
{
    var product = await db.Products.FindAsync([id], ct);
    return product is null
        ? TypedResults.NotFound()
        : TypedResults.Ok(product.ToDto());
}

static async Task<Results<Created<ProductDto>, ValidationProblem>> Create(
    [FromBody] CreateProductRequest req, ProductDbContext db, CancellationToken ct)
{
    var product = req.ToEntity();
    db.Products.Add(product);
    await db.SaveChangesAsync(ct);
    return TypedResults.Created($"/api/products/{product.Id}", product.ToDto());
}
```

## Parameter Binding

Use `[AsParameters]` for complex parameter groups. Explicit `[FromBody]`, `[FromQuery]`, `[FromRoute]` on non-trivial bindings.

```csharp
static async Task<Ok<PagedResult<ProductDto>>> GetAll(
    [AsParameters] ProductQueryParams query, ProductDbContext db, CancellationToken ct)
{
    var result = await db.Products
        .Where(p => query.Category == null || p.Category == query.Category)
        .OrderBy(p => p.Name)
        .Skip(query.Offset).Take(query.Limit)
        .Select(p => p.ToDto())
        .ToListAsync(ct);
    return TypedResults.Ok(new PagedResult<ProductDto>(result, query.Offset, query.Limit));
}

public record ProductQueryParams(
    [FromQuery] string? Category,
    [FromQuery] int Offset = 0,
    [FromQuery] int Limit = 20);
```

## Endpoint Filters (Validation)

Implement `IEndpointFilter` for cross-cutting concerns. Use MiniValidation or FluentValidation — never manual if-chains.

```csharp
public class ValidationFilter<T> : IEndpointFilter where T : class
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext ctx,
        EndpointFilterDelegate next)
    {
        var arg = ctx.Arguments.OfType<T>().FirstOrDefault();
        if (arg is null)
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
                { ["body"] = ["Request body is required."] });

        if (!MiniValidator.TryValidate(arg, out var errors))
            return TypedResults.ValidationProblem(errors);

        return await next(ctx);
    }
}
```

## OpenAPI Metadata

Every endpoint must have `WithName`, `WithTags`, and `Produces` annotations. Call `WithOpenApi()` on the group or individual endpoints.

```csharp
group.MapGet("/{id:int}", GetById)
    .WithName("GetProductById")
    .WithTags("Products")
    .Produces<ProductDto>(200)
    .Produces(404)
    .WithOpenApi(op => { op.Summary = "Get product by ID"; return op; });
```

## Rate Limiting & Output Caching

```csharp
// Program.cs — service registration
builder.Services.AddRateLimiter(opts =>
{
    opts.AddFixedWindowLimiter("standard", c => { c.PermitLimit = 60; c.Window = TimeSpan.FromMinutes(1); });
    opts.AddFixedWindowLimiter("burst", c => { c.PermitLimit = 10; c.Window = TimeSpan.FromSeconds(10); });
    opts.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});
builder.Services.AddOutputCache(opts =>
{
    opts.AddPolicy("Products", b => b.Expire(TimeSpan.FromMinutes(5)).Tag("products"));
});

// Endpoint application
group.MapGet("/", GetAll).RequireRateLimiting("standard").CacheOutput("Products");
group.MapPost("/", Create).RequireRateLimiting("burst");
```

## Authentication & Authorization

```csharp
builder.Services.AddAuthentication().AddJwtBearer();
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("AdminPolicy", p => p.RequireRole("Admin"))
    .AddPolicy("ReadPolicy", p => p.RequireAuthenticatedUser());

// Apply per-group or per-endpoint
app.MapGroup("/api/admin").RequireAuthorization("AdminPolicy").MapAdminEndpoints();
app.MapGroup("/api/public").AllowAnonymous().MapPublicEndpoints();
```

## Global Error Handling

Use `IExceptionHandler` (not middleware try-catch) for structured ProblemDetails responses.

```csharp
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();
app.UseExceptionHandler();

public class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)
    {
        logger.LogError(ex, "Unhandled exception for {Path}", ctx.Request.Path);
        ctx.Response.StatusCode = ex switch
        {
            ValidationException => 400,
            KeyNotFoundException => 404,
            _ => 500
        };
        await ctx.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = ctx.Response.StatusCode,
            Title = "An error occurred",
            Instance = ctx.Request.Path
        }, ct);
        return true;
    }
}
```

## CORS & Health Checks

```csharp
builder.Services.AddCors(opts => opts.AddPolicy("Allowed", b =>
    b.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>()!)
     .WithMethods("GET", "POST", "PUT", "DELETE")
     .WithHeaders("Authorization", "Content-Type")));

builder.Services.AddHealthChecks()
    .AddDbContextCheck<ProductDbContext>("database")
    .AddCheck("self", () => HealthCheckResult.Healthy());
app.MapHealthChecks("/health", new() { ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse });
```

## Integration Testing

```csharp
public class ProductApiTests(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    [Fact]
    public async Task GetById_ReturnsNotFound_WhenProductMissing()
    {
        var client = factory.CreateClient();
        var response = await client.GetAsync("/api/products/999");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Create_ReturnsValidationProblem_WhenBodyInvalid()
    {
        var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/products", new { });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.NotEmpty(body!.Errors);
    }
}
```

## Anti-Patterns

- ❌ Defining all endpoints inline in `Program.cs` — use `MapGroup` + extension methods
- ❌ Returning anonymous objects — always use `TypedResults` for correct OpenAPI schemas
- ❌ Manual validation with if-chains — use `IEndpointFilter` + MiniValidation/FluentValidation
- ❌ `AllowAnonymous()` on groups without explicit intent — default to `RequireAuthorization`
- ❌ Missing `CancellationToken` on async handlers — always accept and forward to EF/HTTP calls
- ❌ `AddCors(o => o.AddDefaultPolicy(b => b.AllowAnyOrigin()))` — explicit origins only
- ❌ Catching exceptions in every handler — use `IExceptionHandler` globally
- ❌ Skipping `WithName`/`WithTags` — breaks OpenAPI client generation

## WAF Alignment

| Pillar | Practice |
| --- | --- |
| **Security** | `RequireAuthorization` + JWT + policy-based RBAC, CORS allowlist, input validation filters |
| **Reliability** | Health checks with dependency probes, `CancellationToken` propagation, `IExceptionHandler` |
| **Performance** | Output caching with tag-based invalidation, `[AsParameters]` zero-alloc binding, async I/O |
| **Cost Optimization** | Rate limiting per tier, output cache reduces DB load, right-sized response DTOs |
| **Operational Excellence** | Structured logging via `ILogger`, OpenAPI-first with `WithOpenApi`, `WebApplicationFactory` tests |
