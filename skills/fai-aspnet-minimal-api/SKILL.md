---
name: fai-aspnet-minimal-api
description: |
  Build ASP.NET Minimal API endpoints with typed validation, auth policies, Problem Details
  error responses, rate limiting, and OpenAPI spec generation. Use when scaffolding
  .NET HTTP APIs or standardizing endpoint patterns.
---

# ASP.NET Minimal API Patterns

Production patterns for ASP.NET Minimal APIs with validation, auth, and observability.

## When to Use

- Creating new HTTP APIs in .NET 8+
- Migrating from controller-based to minimal APIs
- Standardizing error response formats across an API
- Adding rate limiting, auth policies, or OpenAPI generation

---

## Pattern 1: Endpoint with Validation

```csharp
using FluentValidation;

public record CreateItemRequest(string Name, string Category, decimal Price);

public class CreateItemValidator : AbstractValidator<CreateItemRequest>
{
    public CreateItemValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Category).Matches("^[a-z-]+$");
        RuleFor(x => x.Price).GreaterThan(0).LessThan(1_000_000);
    }
}

// Registration
app.MapPost("/items", async (CreateItemRequest req,
    IValidator<CreateItemRequest> validator, AppDbContext db) =>
{
    var result = await validator.ValidateAsync(req);
    if (!result.IsValid)
        return Results.ValidationProblem(result.ToDictionary());

    var item = new Item { Id = Guid.NewGuid(), Name = req.Name,
                          Category = req.Category, Price = req.Price };
    db.Items.Add(item);
    await db.SaveChangesAsync();
    return Results.Created($"/items/{item.Id}", item);
})
.WithName("CreateItem")
.Produces<Item>(201)
.ProducesValidationProblem()
.RequireAuthorization("api-write");
```

## Pattern 2: Global Problem Details

```csharp
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = ctx =>
    {
        ctx.ProblemDetails.Instance = ctx.HttpContext.Request.Path;
        ctx.ProblemDetails.Extensions["traceId"] =
            ctx.HttpContext.TraceIdentifier;
    };
});

app.UseStatusCodePages();
app.UseExceptionHandler();
```

## Pattern 3: Rate Limiting

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("per-user", opt =>
    {
        opt.PermitLimit = 100;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueLimit = 0;
    });
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = 429;
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { type = "/errors/rate-limit", title = "Too Many Requests",
                  status = 429, retryAfter = 60 }, token);
    };
});

app.UseRateLimiter();
```

## Pattern 4: Endpoint Groups with Auth

```csharp
var items = app.MapGroup("/items")
    .RequireAuthorization("api-read")
    .RequireRateLimiting("per-user")
    .AddEndpointFilter<LoggingFilter>();

items.MapGet("/", async (AppDbContext db) =>
    await db.Items.Take(100).ToListAsync());

items.MapGet("/{id:guid}", async (Guid id, AppDbContext db) =>
    await db.Items.FindAsync(id) is { } item
        ? Results.Ok(item)
        : Results.Problem(statusCode: 404, title: "Item not found"));

items.MapPost("/", async (CreateItemRequest req, /* ... */) => { /* ... */ })
    .RequireAuthorization("api-write");
```

## Pattern 5: OpenAPI with Scalar

```csharp
builder.Services.AddOpenApi();

// In pipeline
app.MapOpenApi();
app.MapScalarApiReference(); // Interactive docs at /scalar
```

## Checklist

- [ ] All endpoints use typed request models with FluentValidation
- [ ] ProblemDetails registered globally for consistent error responses
- [ ] Rate limiting applied per user/API key
- [ ] Auth policies at group or endpoint level (never inline checks)
- [ ] OpenAPI generated automatically from endpoint metadata
- [ ] TraceId included in all error responses
