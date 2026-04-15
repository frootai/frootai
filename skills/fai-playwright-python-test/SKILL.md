---
name: fai-playwright-python-test
description: |
  Write Playwright E2E tests in Python with pytest fixtures, page objects,
  and screenshot capture. Use when testing web applications with Playwright
  in Python projects.
---

# Playwright Python E2E Tests

Write browser tests in Python with pytest-playwright.

## When to Use

- E2E testing Python web applications (FastAPI, Django)
- Testing AI chat interfaces in the browser
- Cross-browser testing with chromium, firefox, webkit
- CI-integrated browser testing

---

## Setup

```bash
pip install pytest-playwright
playwright install
```

## Basic Test

```python
import pytest
from playwright.sync_api import Page, expect

def test_send_message(page: Page):
    page.goto("http://localhost:8000")
    page.fill("[data-testid=chat-input]", "Hello")
    page.click("[data-testid=send-button]")
    expect(page.locator("[data-testid=response]")).to_be_visible()
    expect(page.locator("[data-testid=response]")).to_contain_text("Hello")

def test_empty_input_shows_error(page: Page):
    page.goto("http://localhost:8000")
    page.click("[data-testid=send-button]")
    expect(page.locator(".error-message")).to_be_visible()
```

## Page Object

```python
class ChatPage:
    def __init__(self, page: Page):
        self.page = page
    def navigate(self):
        self.page.goto("http://localhost:8000")
    def send_message(self, msg: str):
        self.page.fill("[data-testid=chat-input]", msg)
        self.page.click("[data-testid=send-button]")
    def get_response(self) -> str:
        return self.page.text_content("[data-testid=response]") or ""

def test_chat_flow(page: Page):
    chat = ChatPage(page)
    chat.navigate()
    chat.send_message("What is RAG?")
    assert "retrieval" in chat.get_response().lower()
```

## Screenshot on Failure

```python
@pytest.fixture(autouse=True)
def screenshot_on_failure(page: Page, request):
    yield
    if request.node.rep_call.failed:
        page.screenshot(path=f"screenshots/{request.node.name}.png")
```

## CI Configuration

```yaml
- run: pip install pytest-playwright && playwright install --with-deps
- run: pytest tests/e2e/ --headed=false --browser chromium
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Timeout on element | Slow rendering | Use expect() with auto-wait |
| Browser not installed | Missing playwright install | Run `playwright install` |
| Flaky tests | Race conditions | Use Playwright auto-waiting, not sleep |
| Can't find element | Dynamic selectors | Use data-testid attributes |

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
