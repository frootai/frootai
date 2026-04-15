---
name: fai-xunit-test
description: "Generate robust xUnit test suites with Fact/Theory patterns, fixtures, mocking, and deterministic assertions."
---

# FAI xUnit Test

## Objective

Create maintainable .NET tests that balance speed, isolation, and behavioral confidence.

## Patterns

| Pattern | Use Case |
|--------|----------|
| Fact | Single deterministic scenario |
| Theory + InlineData | Parameterized coverage |
| Collection fixtures | Shared expensive setup |
| WebApplicationFactory | API integration tests |

## Step 1 - Unit Test Example

```csharp
public class PriceServiceTests
{
    [Theory]
    [InlineData(1000, 0.10, 900)]
    [InlineData(2000, 0.25, 1500)]
    public void ApplyDiscount_ReturnsExpectedValue(decimal amount, decimal rate, decimal expected)
    {
        var service = new PriceService();
        var result = service.ApplyDiscount(amount, rate);
        Assert.Equal(expected, result);
    }
}
```

## Step 2 - Mock External Dependencies

```csharp
var repository = new Mock<IOrderRepository>();
repository.Setup(r => r.GetByIdAsync("A1")).ReturnsAsync(new Order("A1"));
```

## Step 3 - Integration Test with WebApplicationFactory

```csharp
public class OrdersApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public OrdersApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetOrder_Returns200()
    {
        var response = await _client.GetAsync("/api/orders/A1");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
```

## Step 4 - Test Quality Rules

- Prefer behavior assertions over implementation details.
- Avoid sleeps; use deterministic clocks/fakes.
- Isolate test data; no cross-test leakage.
- Keep test names scenario-oriented.

## Validation Checklist

| Check | Pass Condition |
|------|----------------|
| Unit test speed | Fast local execution |
| Determinism | No random/fuzzy timing failures |
| Coverage | Critical paths covered |
| Integration confidence | Key endpoints validated |

## Troubleshooting

| Issue | Cause | Fix |
|------|-------|-----|
| Flaky tests | Time/network dependence | Use fake clock and local test doubles |
| Slow suite | Too many integration tests | Move logic checks to unit layer |
| Brittle tests | Over-mocking internals | Assert outcomes, not internals |

## Advanced Implementation Notes

### Operational Guardrails

- Define measurable SLOs before rollout.
- Capture baseline metrics and compare deltas post-change.
- Add alert thresholds with explicit on-call ownership.
- Use environment-specific overrides for dev/staging/prod.

### CI/CD and Validation Expansion

```bash
# Example verification sequence
npm run lint
npm test
npm run build
```

```json
{
  "quality_gate": {
    "required": true,
    "min_score": 0.8,
    "block_on_failure": true
  }
}
```

### Security and Compliance Checks

| Control | Requirement |
|--------|-------------|
| Secret handling | No plaintext secrets in repo |
| Access model | Least privilege role assignments |
| Logging | Redact sensitive data before persistence |
| Auditability | Keep immutable trace of critical actions |

### Performance and Cost Notes

- Budget requests and tokens per endpoint/class of workload.
- Profile p95 and p99 latency as separate objectives.
- Add caching only where correctness is preserved.
- Use periodic reports to catch drift in cost/quality.

### Extended Troubleshooting

| Symptom | Likely Cause | Recommended Action |
|--------|--------------|--------------------|
| Validation gate failures | Threshold too strict or wrong baseline | Recalibrate using a fixed reference dataset |
| Unexpected regressions | Missing scenario coverage | Add targeted regression tests and rerun |
| Production-only issues | Environment mismatch | Diff environment config and identity settings |
| Slow recovery during incidents | Unclear ownership/runbook steps | Add explicit owner and sequence in runbook |
