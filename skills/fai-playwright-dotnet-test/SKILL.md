---
name: fai-playwright-dotnet-test
description: |
  Write Playwright E2E tests in .NET with page object models, assertions,
  and CI configuration. Use when testing web applications with Playwright
  in C# projects.
---

# Playwright .NET E2E Tests

Write browser automation tests in C# with Playwright.

## When to Use

- E2E testing .NET web applications
- Testing UI flows with browser automation
- Validating API + UI integration
- Running cross-browser tests in CI

---

## Setup

```bash
dotnet add package Microsoft.Playwright.NUnit
pwsh bin/Debug/net8.0/playwright.ps1 install
```

## Basic Test

```csharp
using Microsoft.Playwright.NUnit;
using Microsoft.Playwright;

[TestFixture]
public class ChatTests : PageTest
{
    [Test]
    public async Task SendMessage_ReceivesResponse()
    {
        await Page.GotoAsync("https://localhost:5001");
        await Page.FillAsync("[data-testid=chat-input]", "Hello");
        await Page.ClickAsync("[data-testid=send-button]");
        await Expect(Page.Locator("[data-testid=response]")).ToBeVisibleAsync();
        await Expect(Page.Locator("[data-testid=response]")).ToContainTextAsync("Hello");
    }

    [Test]
    public async Task EmptyInput_ShowsError()
    {
        await Page.GotoAsync("https://localhost:5001");
        await Page.ClickAsync("[data-testid=send-button]");
        await Expect(Page.Locator(".error-message")).ToBeVisibleAsync();
    }
}
```

## Page Object Model

```csharp
public class ChatPage
{
    private readonly IPage _page;
    public ChatPage(IPage page) => _page = page;

    public async Task Navigate() => await _page.GotoAsync("/chat");
    public async Task SendMessage(string msg)
    {
        await _page.FillAsync("[data-testid=chat-input]", msg);
        await _page.ClickAsync("[data-testid=send-button]");
    }
    public async Task<string> GetResponse() =>
        await _page.TextContentAsync("[data-testid=response]") ?? "";
}
```

## CI Configuration

```yaml
- name: Install Playwright
  run: pwsh bin/Release/net8.0/playwright.ps1 install --with-deps
- name: Run E2E Tests
  run: dotnet test --filter Category=E2E
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Browser not found | Playwright not installed | Run playwright.ps1 install |
| Flaky selectors | Using CSS classes | Use data-testid attributes |
| Timeout on CI | Slow CI machines | Increase default timeout |
| Screenshots missing | Not captured on failure | Add screenshot in TearDown |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Test naming: `test_{action}_{scenario}_{expected}` | Clear intent from name alone |
| One assertion per test (ideally) | Pinpoints exact failure |
| Arrange-Act-Assert structure | Consistent, readable tests |
| Mock external dependencies | Fast, deterministic execution |
| Run tests in CI on every PR | Catch regressions before merge |
| Separate unit from integration | Fast feedback loop for unit tests |

## Related Skills

- `fai-build-test-harness` — Reusable test infrastructure
- `fai-build-unit-test` — Unit test patterns across languages
- `fai-build-integration-test` — Integration test with fixtures
- `fai-pytest-coverage` — Python coverage configuration
