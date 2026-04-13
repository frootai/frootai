---
description: ".NET architecture standards — DDD, SOLID, clean architecture, CQRS, event sourcing."
applyTo: "**/*.cs"
waf:
  - "reliability"
  - "operational-excellence"
---

# .NET Architecture — FAI Standards

> DDD, Clean Architecture, CQRS with MediatR, EF Core patterns, Result pattern, and vertical slices for .NET 8+.

## Clean Architecture Layers

- **Domain** → Entities, aggregates, value objects, domain events, repository interfaces. Zero dependencies on other layers.
- **Application** → Use cases (command/query handlers), DTOs, validation, interfaces for infra services. References Domain only.
- **Infrastructure** → EF Core `DbContext`, repository implementations, external service clients, email, blob storage. References Application.
- **Presentation** → Minimal APIs or controllers, middleware, auth config, model binding. References Application only.

```
src/
├── Domain/           # Entities, ValueObjects, Events, IRepository<T>
├── Application/      # Commands/, Queries/, DTOs/, Behaviors/, IServices
├── Infrastructure/   # Persistence/, ExternalServices/, DI registration
└── WebApi/           # Endpoints/, Middleware/, Program.cs
```

## Domain-Driven Design

### Aggregates & Entities
```csharp
public sealed class Order : AggregateRoot
{
    private readonly List<OrderLine> _lines = [];
    public IReadOnlyList<OrderLine> Lines => _lines.AsReadOnly();
    public Money Total => _lines.Aggregate(Money.Zero, (sum, l) => sum + l.SubTotal);

    public void AddLine(ProductId productId, Quantity qty, Money unitPrice)
    {
        Guard.Against.Negative(qty.Value, nameof(qty));
        _lines.Add(new OrderLine(productId, qty, unitPrice));
        AddDomainEvent(new OrderLineAddedEvent(Id, productId));
    }
}
```

### Value Objects
```csharp
public sealed record Money(decimal Amount, string Currency)
{
    public static Money Zero => new(0, "USD");
    public static Money operator +(Money a, Money b)
    {
        if (a.Currency != b.Currency) throw new CurrencyMismatchException(a.Currency, b.Currency);
        return a with { Amount = a.Amount + b.Amount };
    }
}
```

- Value objects are `record` types — immutable, structural equality by default
- Entities use `Id` property with strongly-typed IDs (`OrderId`, `ProductId`)
- Domain events raised via `AddDomainEvent()` on aggregate root, dispatched after `SaveChangesAsync`

## CQRS with MediatR

```csharp
// Command — returns Result, not entity
public sealed record CreateOrderCommand(Guid CustomerId, List<LineDto> Lines)
    : IRequest<Result<OrderId>>;

public sealed class CreateOrderHandler(IOrderRepository repo, IUnitOfWork uow)
    : IRequestHandler<CreateOrderCommand, Result<OrderId>>
{
    public async Task<Result<OrderId>> Handle(CreateOrderCommand cmd, CancellationToken ct)
    {
        var order = Order.Create(new CustomerId(cmd.CustomerId));
        foreach (var line in cmd.Lines)
            order.AddLine(new ProductId(line.ProductId), new Quantity(line.Qty), new Money(line.Price, "USD"));

        repo.Add(order);
        await uow.SaveChangesAsync(ct);
        return Result.Success(order.Id);
    }
}

// Query — returns DTO, never entity
public sealed record GetOrderQuery(Guid OrderId) : IRequest<Result<OrderDto>>;
```

- Commands mutate state, queries read — never mix
- Pipeline behaviors for cross-cutting: `ValidationBehavior<,>`, `LoggingBehavior<,>`, `TransactionBehavior<,>`
- Register via `services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(CreateOrderHandler).Assembly))`

## Result Pattern

```csharp
public class Result<T>
{
    public T? Value { get; }
    public Error? Error { get; }
    public bool IsSuccess => Error is null;

    public static Result<T> Success(T value) => new() { Value = value };
    public static Result<T> Failure(Error error) => new() { Error = error };
}
```

- Return `Result<T>` from handlers — never throw for business rule violations
- Exceptions reserved for truly exceptional cases (network failure, corrupted state)
- Map `Result` to HTTP status in endpoint: `IsSuccess ? Ok(r.Value) : Problem(r.Error)`

## Repository Pattern with EF Core

```csharp
public sealed class OrderRepository(AppDbContext db) : IOrderRepository
{
    public async Task<Order?> GetByIdAsync(OrderId id, CancellationToken ct) =>
        await db.Orders.Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == id, ct);

    public void Add(Order order) => db.Orders.Add(order);
}
```

- Repository interfaces live in **Domain**, implementations in **Infrastructure**
- `IUnitOfWork` wraps `SaveChangesAsync` — called in handler, not repository
- Use `AsNoTracking()` for all read queries; split read/write `DbContext` when scaling

## Vertical Slice Alternative

When Clean Architecture layers add overhead for simple CRUD, use vertical slices:

```csharp
// One file per feature: Features/Orders/CreateOrder.cs
public static class CreateOrder
{
    public sealed record Command(Guid CustomerId) : IRequest<Result<Guid>>;
    public sealed class Handler(AppDbContext db) : IRequestHandler<Command, Result<Guid>> { ... }
    public sealed class Validator : AbstractValidator<Command> { ... }
}
```

- Group by feature, not by layer — all related code in one folder
- Still use MediatR, FluentValidation, Result pattern inside each slice

## Minimal API Organization

```csharp
// Endpoints/OrderEndpoints.cs
public static class OrderEndpoints
{
    public static RouteGroupBuilder MapOrderEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v{version:apiVersion}/orders")
            .WithTags("Orders")
            .RequireAuthorization();

        group.MapPost("/", CreateOrder).WithName(nameof(CreateOrder));
        group.MapGet("/{id:guid}", GetOrder).WithName(nameof(GetOrder));
        return group;
    }

    private static async Task<IResult> CreateOrder(CreateOrderCommand cmd, ISender sender, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return result.IsSuccess
            ? Results.CreatedAtRoute(nameof(GetOrder), new { id = result.Value }, result.Value)
            : Results.Problem(result.Error!.Message, statusCode: 400);
    }
}
```

## Configuration & Middleware

- Use Options pattern: `services.Configure<AzureOpenAIOptions>(config.GetSection("AzureOpenAI"))` — inject `IOptions<T>`
- Validate options at startup: `services.AddOptionsWithValidateOnStart<T>().ValidateDataAnnotations()`
- API versioning: `services.AddApiVersioning(o => { o.DefaultApiVersion = new(1, 0); o.AssumeDefaultVersionWhenUnspecified = true; })`
- Middleware order: ExceptionHandler → CORS → Auth → RateLimiter → Endpoints

## Preferred Patterns

- ✅ Primary constructors for DI: `class Handler(IRepo repo)` — no manual field assignment
- ✅ `sealed` on classes not designed for inheritance — lets JIT devirtualize
- ✅ `CancellationToken` threaded through every async call chain
- ✅ `TimeProvider` for testable time — never `DateTime.UtcNow` directly
- ✅ `IAsyncEnumerable<T>` for streaming large result sets
- ✅ `global using` in a single `GlobalUsings.cs` file per project

## Anti-Patterns

- ❌ Anemic domain model — entities with only getters and all logic in services
- ❌ Injecting `DbContext` directly into endpoints — use repository + unit-of-work
- ❌ Returning entities from API endpoints — always map to DTOs
- ❌ `Task.Result` or `.Wait()` — causes deadlocks; always `await`
- ❌ Service locator via `IServiceProvider.GetService<T>()` in business logic
- ❌ `catch (Exception) { }` swallowing errors silently
- ❌ God classes (`OrderService` with 40 methods) — split into command/query handlers
- ❌ Storing domain logic in stored procedures or EF query interceptors

## WAF Alignment

| Pillar | .NET Implementation |
|---|---|
| **Reliability** | Polly v8 `ResiliencePipeline` (retry + circuit breaker + timeout), health checks via `MapHealthChecks`, `IHostedService` graceful shutdown |
| **Security** | `DefaultAzureCredential`, Data Protection API, `[Authorize]` policies, AntiForgery, parameterized EF queries (no raw SQL interpolation) |
| **Cost Optimization** | Response caching middleware, `IMemoryCache`/`IDistributedCache`, model routing via config, right-sized Container Apps |
| **Operational Excellence** | `ILogger<T>` + Serilog sinks to App Insights, `Activity`/`ActivitySource` for distributed tracing, `/health` + `/ready` endpoints |
| **Performance** | `System.Text.Json` source generators, `ValueTask` for hot paths, `ObjectPool<T>`, output caching, `AsNoTracking` reads |
| **Responsible AI** | Content Safety middleware, PII redaction in logs via `Destructure.ByTransforming`, prompt injection validation at boundary |

### Operational Excellence
- Structured JSON logging with Application Insights + correlation IDs
- Custom metrics: latency p50/p95/p99, token usage, quality scores
- Automated Bicep deployment via GitHub Actions (staging → prod)
- Feature flags for gradual rollout, incident runbooks
