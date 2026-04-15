---
name: fai-nunit-test
description: |
  Write NUnit tests with parameterized cases, setup/teardown, assertion
  constraints, and FluentAssertions. Use when testing .NET applications
  with the NUnit testing framework.
---

# NUnit Testing Patterns

Write reliable NUnit tests with parameterization, constraints, and assertions.

## When to Use

- Testing .NET applications with NUnit
- Writing data-driven parameterized tests
- Using constraint-based assertion model
- Setting up test fixtures with lifecycle hooks

---

## Basic Test

```csharp
[TestFixture]
public class OrderServiceTests
{
    private OrderService _service;

    [SetUp]
    public void Setup()
    {
        _service = new OrderService(new MockRepo());
    }

    [Test]
    public void CalculateTotal_WithItems_ReturnsCorrectSum()
    {
        var order = Order.Create(new Item("Widget", 29.99m, 2));
        var total = _service.CalculateTotal(order);
        Assert.That(total, Is.EqualTo(64.78m).Within(0.01m));
    }

    [Test]
    public void CalculateTotal_EmptyOrder_ReturnsZero()
    {
        Assert.That(_service.CalculateTotal(Order.Empty), Is.Zero);
    }
}
```

## Parameterized Tests

```csharp
[TestCase(100.00, 0.08, 108.00)]
[TestCase(50.00, 0.10, 55.00)]
[TestCase(0.00, 0.08, 0.00)]
public void Calculate_ReturnsCorrectTax(decimal amount, decimal rate, decimal expected)
{
    var result = TaxCalculator.Calculate(amount, rate);
    Assert.That(result, Is.EqualTo(expected).Within(0.01m));
}

[TestCaseSource(nameof(InvalidInputs))]
public void Validate_RejectsInvalid(string input)
{
    Assert.Throws<ArgumentException>(() => Validator.Validate(input));
}

static IEnumerable<string> InvalidInputs() => new[] { "", null, "   " };
```

## Constraint-Based Assertions

```csharp
// Collections
Assert.That(items, Has.Count.EqualTo(3));
Assert.That(items, Has.Exactly(1).Matches<Item>(i => i.Price > 100));
Assert.That(names, Is.Ordered.Ascending);

// Strings
Assert.That(result, Does.Contain("success").IgnoreCase);
Assert.That(email, Does.Match(@"^[\w.]+@[\w.]+$"));

// Exceptions
Assert.That(() => Divide(1, 0), Throws.TypeOf<DivideByZeroException>());
```

## Async Tests

```csharp
[Test]
public async Task ChatAsync_ReturnsResponse()
{
    var result = await _service.ChatAsync("Hello");
    Assert.That(result, Is.Not.Null.And.Not.Empty);
}
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Test not discovered | Missing [TestFixture] or [Test] | Add both attributes |
| SetUp runs per class | Using [OneTimeSetUp] | Use [SetUp] for per-test init |
| Constraint syntax error | Wrong Is/Has chain | Check NUnit constraint docs |
| Async test hangs | Missing async/await | Use async Task return type |
