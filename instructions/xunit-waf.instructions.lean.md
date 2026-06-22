---
description: "xUnit testing standards — Fact/Theory, FluentAssertions, and integration testing with WebApplicationFactory."
applyTo: "**/*.cs"
waf:
  - "reliability"
---

# xUnit.net — FAI Standards

## Test Organization

Use `[Fact]` for single-case tests, `[Theory]` with data attributes for parameterized tests:

```csharp
public class OrderService_PlaceOrder
{
    [Fact]
    public async Task PlaceOrder_ValidCart_ReturnsConfirmation()
    {
        var sut = new OrderService(_mockRepo.Object);
        var result = await sut.PlaceOrderAsync(TestData.ValidCart);
        result.Status.Should().Be(OrderStatus.Confirmed);
    }

    [Theory]
    [InlineData(0, false)]
    [InlineData(-1, false)]
    [InlineData(100, true)]
    public void ValidateQuantity_ReturnsExpected(int qty, bool expected)
        => OrderValidator.IsValidQuantity(qty).Should().Be(expected);

    [Theory]
    [MemberData(nameof(DiscountCases))]
    public void ApplyDiscount_CalculatesCorrectly(decimal price, decimal discount, decimal expected)
        => PricingEngine.ApplyDiscount(price, discount).Should().Be(expected);

    public static IEnumerable<object[]> DiscountCases()
    {
        yield return new object[] { 100m, 0.1m, 90m };
        yield return new object[] { 50m, 0.25m, 37.5m };
    }

    [Theory]
    [ClassData(typeof(BulkOrderTestCases))]
    public void BulkOrder_AppliesTierPricing(Order order, decimal expectedTotal)
        => _sut.CalculateTotal(order).Should().Be(expectedTotal);
}
```

## Assertion Patterns

Prefer FluentAssertions over raw `Assert.*` for readability. Use `Assert.Throws` for exception paths:

```csharp
// FluentAssertions — chain assertions, get clear failure messages
result.Should().NotBeNull();
result.Items.Should().HaveCount(3).And.OnlyContain(i => i.IsActive);
result.CreatedAt.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(5));

// Exception assertions
var act = () => sut.Process(null!);
act.Should().Throw<ArgumentNullException>().WithParameterName("request");

// xUnit built-in (acceptable for simple cases)
Assert.Equal(expected, actual);
var ex = Assert.Throws<InvalidOperationException>(() => sut.Execute());
Assert.Contains("expired", ex.Message);
```

## Test Lifecycle

Constructor runs before each test, `Dispose` after. Use `IAsyncLifetime` for async setup/teardown:

```csharp
public class DatabaseTests : IAsyncLifetime
{
    private readonly AppDbContext _db;

    public DatabaseTests() => _db = TestDbFactory.Create();

    public async Task InitializeAsync()
        => await _db.Database.MigrateAsync();

    public async Task DisposeAsync()
        => await _db.Database.EnsureDeletedAsync();

    [Fact]
    public async Task Insert_PersistsEntity() { /* ... */ }
}
```

## Shared Context

`IClassFixture<T>` shares a single instance across all tests in one class. `ICollectionFixture<T>` shares across multiple classes:

```csharp
// Shared within one test class
public class ProductTests : IClassFixture<DatabaseFixture>
{
    private readonly DatabaseFixture _fixture;
    public ProductTests(DatabaseFixture fixture) => _fixture = fixture;
}

// Shared across multiple test classes
[CollectionDefinition("Integration")]
public class IntegrationCollection : ICollectionFixture<ApiFixture> { }

[Collection("Integration")]
public class OrderApiTests { /* injected ApiFixture */ }

[Collection("Integration")]
public class PaymentApiTests { /* same ApiFixture instance */ }
```

## Integration Tests with WebApplicationFactory

```csharp
public class ApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public ApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.WithWebHostBuilder(b =>
        {
            b.ConfigureServices(s =>
            {
                s.RemoveAll<DbContext>();
                s.AddDbContext<AppDbContext>(o => o.UseInMemoryDatabase("test"));
                s.AddSingleton<IEmailService, FakeEmailService>();
            });
        }).CreateClient();
    }

    [Fact]
    public async Task GetProducts_Returns200()
    {
        var response = await _client.GetAsync("/api/products");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
```

## Dependency Injection in Tests

```csharp
public class ServiceTests
{
    private readonly ServiceProvider _provider;

    public ServiceTests()
    {
        _provider = new ServiceCollection()
            .AddSingleton<ICache, FakeCache>()
            .AddTransient<OrderService>()
            .BuildServiceProvider();
    }

    [Fact]
    public void Resolve_OrderService_UsesInjectedCache()
        => _provider.GetRequiredService<OrderService>().Should().NotBeNull();
}
```

## Mocking

NSubstitute (concise) or Moq (explicit setup):

```csharp
// NSubstitute
var repo = Substitute.For<IOrderRepository>();
repo.GetByIdAsync(42).Returns(TestData.SampleOrder);
var sut = new OrderService(repo);
await repo.Received(1).SaveAsync(Arg.Any<Order>());

// Moq
var mock = new Mock<IPaymentGateway>();
mock.Setup(g => g.ChargeAsync(It.IsAny<decimal>())).ReturnsAsync(PaymentResult.Success);
mock.Verify(g => g.ChargeAsync(99.99m), Times.Once);
```

## Output & Diagnostics

`ITestOutputHelper` captures output per-test (visible in test explorer):

```csharp
public class DiagnosticTests(ITestOutputHelper output)
{
    [Fact]
    public void SlowQuery_LogsWarning()
    {
        output.WriteLine($"Test started: {DateTime.UtcNow:O}");
        var (result, elapsed) = MeasureExecution(() => _sut.RunQuery());
        output.WriteLine($"Elapsed: {elapsed.TotalMilliseconds}ms");
        elapsed.Should().BeLessThan(TimeSpan.FromSeconds(2));
    }
}
```

## Parallelism Control

xUnit runs test classes in parallel by default. Disable per-collection when tests share state:

```csharp
[Collection("Sequential-DB")]  // Tests in this collection run serially
public class MigrationTests { }
```

To disable globally, add `xunit.runner.json`: `{ "parallelizeTestCollections": false }`

## Test Ordering

Avoid ordering — tests should be independent. When sequence genuinely matters (e.g., migration smoke tests), use `[TestCaseOrderer]` with a custom orderer.

## Code Coverage

Use Coverlet with `dotnet test`:

```bash
dotnet test --collect:"XPlat Code Coverage" -- DataCollectionRunSettings.DataCollectors.DataCollector.Configuration.Format=cobertura
reportgenerator -reports:coverage.cobertura.xml -targetdir:coverage-report
```

## Naming Convention

`Method_Scenario_ExpectedResult` — class name = SUT class + method under test:

```
OrderService_PlaceOrder/PlaceOrder_EmptyCart_ThrowsValidationException
PricingEngine_ApplyDiscount/ApplyDiscount_NegativeRate_ClampsToZero
```

## Anti-Patterns

| Avoid | Do Instead |
|---|---|
| `Thread.Sleep` in tests | Use `async/await` with `Task.Delay` or polling |
| Shared mutable static state | `IClassFixture` / `ICollectionFixture` |
| Testing private methods | Test through public API surface |
| `[Fact]` with hardcoded loops | `[Theory]` + `[InlineData]`/`[MemberData]` |
| Catching exceptions manually | `Assert.Throws` / `.Should().Throw<T>()` |
| Giant arrange blocks | Extract test builders / `TestData` factories |

## WAF Alignment

| Pillar | Practice |
|---|---|
| **Reliability** | Integration tests with `WebApplicationFactory`, retry-aware assertions, lifecycle cleanup via `IAsyncLifetime` |
| **Security** | No secrets in test code, use `ConfigureServices` to swap real auth for test stubs |
| **Cost Optimization** | In-memory databases over cloud instances, parallel execution, Coverlet to find dead code |
| **Operational Excellence** | CI-integrated `dotnet test`, coverage gates, deterministic test data |
| **Performance Efficiency** | Shared fixtures reduce setup cost, parallelism by default, avoid `Thread.Sleep` |

## Code Quality Standards

- TypeScript with `strict: true` in tsconfig OR Python with type hints on all functions
- No `any` types in TypeScript — define proper interfaces, type guards, discriminated unions
- Structured JSON logging only — never `console.log` in production code
- Every `async` operation wrapped in try/catch with actionable, context-rich error messages
- No commented-out code — use feature flags or remove. No TODO without linked issue number
- Functions ≤ 50 lines, files ≤ 300 lines — extract when growing beyond limits
- Consistent naming: camelCase (TypeScript), snake_case (Python), kebab-case (files/folders)
- JSDoc/docstrings on all public functions with parameter descriptions and return types

## Testing Requirements

- Unit tests for business logic (80%+ coverage target, measured in CI)
- Integration tests for Azure SDK interactions (mock with nock/responses/WireMock)
- End-to-end tests for critical user journeys (Playwright/Cypress)
- Mutation testing for critical paths (Stryker for TS, mutmut for Python)
- No flaky tests — fix root cause or quarantine with tracking issue
- Evaluation pipeline (`eval.py`) passes all quality thresholds before production

## Security Checklist

- [ ] `DefaultAzureCredential` for all Azure service authentication
- [ ] Secrets stored exclusively in Azure Key Vault
- [ ] Private endpoints for data-plane operations in production
- [ ] Content Safety API for all user-facing LLM outputs
- [ ] Input validation and sanitization (prompt injection defense)
- [ ] PII detection and redaction before logging
- [ ] CORS with explicit origin allowlist (never `*` in production)
- [ ] TLS 1.2+ enforced on all connections
- [ ] Dependency audit (`npm audit` / `pip audit`) in CI pipeline
- [ ] Rate limiting per user/IP (60 req/min default)

## Anti-Patterns

- ❌ Hardcoding API keys, connection strings, or secrets in source code
- ❌ Using `console.log` instead of structured Application Insights logging
- ❌ Missing error handling on async operations (unhandled promise rejections)
- ❌ Public endpoints in production without authentication and authorization
- ❌ Unbounded queries without pagination or result limits
- ❌ Not implementing health check endpoint (load balancer can't detect unhealthy)
- ❌ Logging PII, full user prompts, or secret values — even in debug mode
- ❌ Using `temperature > 0.5` in production without documented justification
- ❌ Deploying without Content Safety enabled for user-facing endpoints

## WAF Alignment

### Security
- DefaultAzureCredential for all auth — zero API keys in code
- Key Vault for secrets, certificates, encryption keys
- Private endpoints for data-plane in production
- Content Safety API, PII detection + redaction, input validation

### Reliability
- Retry with exponential backoff (3 retries, 1-30s jitter)
- Circuit breaker (50% failure → open 30s)
- Health check at /health with dependency status
- Graceful degradation, connection pooling, SIGTERM handling

### Cost Optimization
- max_tokens from config — never unlimited
- Model routing (gpt-4o-mini for classification, gpt-4o for reasoning)
- Semantic caching with Redis (TTL from config)
- Right-sized SKUs, FinOps telemetry (token usage per request)

### Operational Excellence
- Structured JSON logging with Application Insights + correlation IDs
- Custom metrics: latency p50/p95/p99, token usage, quality scores
- Automated Bicep deployment via GitHub Actions (staging → prod)
- Feature flags for gradual rollout, incident runbooks
