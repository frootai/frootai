---
description: "Entity Framework Core standards — migrations, query optimization, eager/lazy loading, concurrency handling."
applyTo: "**/*.cs"
waf:
  - "performance-efficiency"
  - "reliability"
---

# Entity Framework Core — FAI Standards

## DbContext Configuration

- One DbContext per bounded context — never a single "GodContext" for the entire domain
- Register with `AddDbContext<T>` using pooling when possible: `AddDbContextPool<T>`
- Configure connection resiliency for transient failures:

```csharp
services.AddDbContext<OrderContext>(opts =>
    opts.UseSqlServer(conn, sql => sql
        .EnableRetryOnFailure(5, TimeSpan.FromSeconds(30), null)
        .CommandTimeout(30)));
```

- Prefer Fluent API over data annotations for complex mappings
- Use `IEntityTypeConfiguration<T>` per entity to keep `OnModelCreating` clean:

```csharp
public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("Orders", "ordering");
        builder.HasKey(o => o.Id);
        builder.Property(o => o.Total).HasPrecision(18, 4);
        builder.Property(o => o.RowVersion).IsRowVersion(); // concurrency token
        builder.HasQueryFilter(o => !o.IsDeleted);          // global soft-delete filter
        builder.OwnsOne(o => o.ShippingAddress);             // owned type
    }
}
```

## Query Optimization

- Use `AsNoTracking()` for read-only queries — reduces memory and CPU overhead
- Use `AsSplitQuery()` for multi-level `Include` to avoid cartesian explosion
- Prefer explicit `Include`/`ThenInclude` over lazy loading — use compiled queries for hot paths:

```csharp
private static readonly Func<OrderContext, int, Task<Order?>> GetOrderById =
    EF.CompileAsyncQuery((OrderContext ctx, int id) =>
        ctx.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .FirstOrDefault(o => o.Id == id));
```

- Project with `Select` to fetch only needed columns — never materialize full entities for DTOs

## Value Converters & Shadow Properties

```csharp
builder.Property(o => o.Status)
    .HasConversion(v => v.ToString(), v => Enum.Parse<OrderStatus>(v));
builder.Property<DateTime>("LastModified");  // shadow property — not on CLR type
builder.Property<string>("ModifiedBy").HasMaxLength(256);
```

## Migration Management

- Always generate named migrations: `dotnet ef migrations add AddOrderShipping`
- Idempotent scripts in CI/CD: `dotnet ef migrations script --idempotent -o migrate.sql`
- Never call `Database.Migrate()` at startup in production — use release pipelines
- Guard data-loss ops — `migrationBuilder.Sql()` for data moves before column drops
- Review generated migration code before committing — EF can silently generate destructive changes

## Bulk Operations & Raw SQL

- Use `ExecuteUpdate`/`ExecuteDelete` (EF 7+) for set-based mutations without loading entities:

```csharp
await ctx.Orders.Where(o => o.CreatedAt < cutoff).ExecuteDeleteAsync(cancellationToken);
```

- For raw SQL, always use parameterized interpolation — never string concatenation:

```csharp
var orders = await ctx.Orders.FromSqlInterpolated($"SELECT * FROM ordering.Orders WHERE TenantId = {tenantId}").ToListAsync();
```

## Seeding

- Use `HasData` for reference/lookup data only — seed IDs must be stable (changing them = destructive migration)

```csharp
builder.HasData(new OrderStatus { Id = 1, Name = "Pending" }, new OrderStatus { Id = 2, Name = "Shipped" });
```

## Preferred Patterns

```csharp
// ✅ Projection — only fetch what the API needs
var dto = await ctx.Orders.AsNoTracking()
    .Where(o => o.CustomerId == customerId)
    .Select(o => new OrderSummaryDto(o.Id, o.Total, o.Status.ToString(), o.Items.Count))
    .ToListAsync(ct);

// ✅ Explicit transaction for multi-step writes
await using var tx = await ctx.Database.BeginTransactionAsync(ct);
ctx.Orders.Add(order);
await ctx.SaveChangesAsync(ct);
await ctx.Database.ExecuteSqlInterpolatedAsync(
    $"UPDATE ordering.Inventory SET Qty = Qty - {qty} WHERE Sku = {sku}", ct);
await tx.CommitAsync(ct);
```

## Avoided Patterns

```csharp
// ❌ Loading all entities to count them
var count = ctx.Orders.ToList().Count;       // use .CountAsync()

// ❌ N+1 via lazy loading in a loop
foreach (var order in orders)
    Console.WriteLine(order.Customer.Name);  // use .Include(o => o.Customer)

// ❌ String concatenation in raw SQL — SQL injection risk
ctx.Orders.FromSqlRaw("SELECT * FROM Orders WHERE Name = '" + name + "'");
```

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Fat DbContext (100+ DbSets) | Slow model building, high memory | Split per bounded context |
| Lazy loading everywhere | N+1 queries, unpredictable perf | Explicit `Include` or projection |
| `Database.Migrate()` in `Program.cs` | Race conditions in scaled-out apps, no rollback | CI/CD idempotent scripts |
| No concurrency tokens | Silent last-write-wins overwrites | `IsRowVersion()` or `IsConcurrencyToken()` |
| Tracking queries for read APIs | Wasted change-tracker overhead | `AsNoTracking()` / `AsNoTrackingWithIdentityResolution()` |
| Cartesian explosion | Multi-Include joins multiply rows | `AsSplitQuery()` |
| Hardcoded connection strings | Secret leakage, no rotation | Key Vault / managed identity |

## WAF Alignment

| Pillar | EF Core Practice |
|---|---|
| Performance Efficiency | Compiled queries, `AsNoTracking`, `AsSplitQuery`, projections, `ExecuteUpdate/Delete` |
| Reliability | `EnableRetryOnFailure`, concurrency tokens, idempotent migrations, explicit transactions |
| Security | `FromSqlInterpolated` (never raw concat), managed identity auth, no secrets in config |
| Cost Optimization | Connection pooling (`AddDbContextPool`), projection to reduce data transfer |
| Operational Excellence | Named migrations, idempotent scripts, `IEntityTypeConfiguration<T>` per entity |
