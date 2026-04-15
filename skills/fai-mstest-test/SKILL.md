---
name: fai-mstest-test
description: |
  Write MSTest tests with data-driven cases, test initialization, assertion
  patterns, and code coverage. Use when testing .NET applications with the
  MSTest framework.
---

# MSTest Testing Patterns

Write reliable MSTest tests with data-driven cases and assertion patterns.

## When to Use

- Testing .NET applications with MSTest
- Writing data-driven parameterized tests
- Setting up test initialization and cleanup
- Configuring code coverage with dotnet test

---

## Basic Test Structure

```csharp
[TestClass]
public class OrderServiceTests
{
    private OrderService _service = null!;

    [TestInitialize]
    public void Setup()
    {
        _service = new OrderService(new MockRepository());
    }

    [TestMethod]
    public void CalculateTotal_WithItems_ReturnsCorrectSum()
    {
        var order = Order.Create(new Item("Widget", 29.99m, 2));
        var total = _service.CalculateTotal(order);
        Assert.AreEqual(64.78m, total, 0.01m);
    }

    [TestMethod]
    [ExpectedException(typeof(ArgumentException))]
    public void CalculateTotal_EmptyOrder_ThrowsException()
    {
        _service.CalculateTotal(Order.Empty);
    }
}
```

## Data-Driven Tests

```csharp
[TestClass]
public class TaxCalculatorTests
{
    [DataTestMethod]
    [DataRow(100.00, 0.08, 108.00)]
    [DataRow(50.00, 0.10, 55.00)]
    [DataRow(0.00, 0.08, 0.00)]
    public void Calculate_ReturnsCorrectTax(double amount, double rate, double expected)
    {
        var result = TaxCalculator.Calculate((decimal)amount, (decimal)rate);
        Assert.AreEqual((decimal)expected, result, 0.01m);
    }
}
```

## Mocking with Moq

```csharp
[TestMethod]
public async Task Chat_ReturnsResponse()
{
    var mockClient = new Mock<IOpenAIClient>();
    mockClient.Setup(c => c.CompleteAsync(It.IsAny<string>()))
              .ReturnsAsync("Hello from GPT");

    var service = new ChatService(mockClient.Object);
    var result = await service.ChatAsync("Hi");

    Assert.AreEqual("Hello from GPT", result);
    mockClient.Verify(c => c.CompleteAsync("Hi"), Times.Once);
}
```

## Coverage

```bash
dotnet test --collect:"Code Coverage" --results-directory ./coverage
dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=cobertura
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Test not discovered | Missing [TestClass] or [TestMethod] | Add both attributes |
| DataRow type mismatch | Wrong parameter types | Match DataRow types to method params |
| Mock returns null | Missing Setup() | Add Setup for all called methods |
| Async test hangs | Missing async/await | Use async Task, not void |
