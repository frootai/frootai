---
description: "Playwright testing standards — role-based locators, auto-wait, visual regression, and accessibility testing."
applyTo: "**/*.spec.ts, **/*.test.ts"
waf:
  - "reliability"
  - "operational-excellence"
---

# Playwright — FAI Standards

## Page Object Model

Encapsulate page structure in POM classes. Tests reference methods, not selectors.

```typescript
// pages/dashboard.page.ts
import { type Locator, type Page } from "@playwright/test";

export class DashboardPage {
  readonly heading: Locator;
  readonly createButton: Locator;
  readonly searchInput: Locator;

  constructor(private page: Page) {
    this.heading = page.getByRole("heading", { name: "Dashboard" });
    this.createButton = page.getByRole("button", { name: "Create" });
    this.searchInput = page.getByRole("searchbox");
  }

  async search(term: string) {
    await this.searchInput.fill(term);
    await this.searchInput.press("Enter");
  }
  async goto() { await this.page.goto("/dashboard"); }
}
```

## Custom Fixtures

Extend `test` with shared setup — avoids `beforeEach` duplication across specs.

```typescript
// fixtures.ts
import { test as base } from "@playwright/test";
import { DashboardPage } from "./pages/dashboard.page";

type Fixtures = { dashboardPage: DashboardPage };

export const test = base.extend<Fixtures>({
  dashboardPage: async ({ page }, use) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await use(dashboard);
  },
});
export { expect } from "@playwright/test";
```

## Locators & Auto-Waiting

Use role-based and text locators. Playwright auto-waits for actionability — never add explicit sleeps.

- `page.getByRole("button", { name: "Submit" })` — preferred for interactive elements
- `page.getByLabel("Email")` — form fields by associated label
- `page.getByTestId("order-summary")` — stable data-testid for complex selectors
- `page.getByText("No results")` — visible text matching

## Web-First Assertions

Assertions auto-retry until timeout. Never combine `waitFor` + manual checks.

```typescript
await expect(page.getByRole("alert")).toBeVisible();
await expect(page.getByRole("heading")).toHaveText("Welcome");
await expect(page.getByRole("list")).toHaveCount(5);
await expect(page).toHaveURL(/\/dashboard/);
```

## API Testing

Use `request` context for backend-only tests — no browser overhead.

```typescript
test("POST /api/items returns 201", async ({ request }) => {
  const res = await request.post("/api/items", { data: { name: "Widget" } });
  expect(res.status()).toBe(201);
  expect(await res.json()).toMatchObject({ name: "Widget" });
});
```

## Visual Regression

`toHaveScreenshot` diffs against baseline. Update baselines: `npx playwright test --update-snapshots`.

```typescript
test("landing page visual", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveScreenshot("landing.png", { maxDiffPixelRatio: 0.01 });
});
```

## Accessibility — ARIA Snapshots

Snapshot the accessibility tree to catch missing roles, labels, and landmarks.

```typescript
await expect(page.getByRole("navigation")).toMatchAriaSnapshot(`
  - navigation:
    - link "Home"
    - link "Dashboard"
    - button "Profile menu"
`);
```

## Authentication Reuse

Log in once, save `storageState`, reuse across tests — avoids per-test login overhead.

```typescript
// auth.setup.ts — runs before all specs via project dependencies
import { test as setup } from "@playwright/test";
setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.TEST_USER!);
  await page.getByLabel("Password").fill(process.env.TEST_PASS!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.context().storageState({ path: ".auth/state.json" });
});
// playwright.config.ts → use: { storageState: ".auth/state.json" }
```

## Network Mocking

Intercept network calls to isolate UI from backend variability.

```typescript
await page.route("**/api/items", (route) =>
  route.fulfill({ json: [{ id: 1, name: "Mocked" }] })
);
await page.goto("/items");
await expect(page.getByText("Mocked")).toBeVisible();
```

## Parallel Execution & Test Tagging

```typescript
// playwright.config.ts
export default defineConfig({
  workers: process.env.CI ? 4 : undefined, // fixed workers in CI, auto locally
  fullyParallel: true,
});
```

Tag tests for selective runs: `npx playwright test --grep @smoke`.

```typescript
test("checkout flow @smoke @e2e", async ({ page }) => { /* ... */ });
test("admin export @slow", async ({ page }) => { /* ... */ });
```

## Trace Viewer for Debugging

Enable traces on first retry to diagnose failures without re-running locally.

```typescript
// playwright.config.ts
use: { trace: "on-first-retry" },
```

View: `npx playwright show-trace trace.zip` — includes DOM snapshots, network log, console, and action timeline.

## Mobile Emulation

```typescript
import { devices } from "@playwright/test";
export default defineConfig({
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] } },
  ],
});
```

## CI Configuration — GitHub Actions

```yaml
# .github/workflows/e2e.yml
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: playwright-report/ }
```

## Anti-Patterns

- ❌ `page.waitForTimeout(3000)` — use auto-waiting locators and web-first assertions
- ❌ `page.$("div.btn-primary")` — use role/label/testid locators, not CSS selectors
- ❌ `page.evaluate(() => document.querySelector(...))` — bypasses retry and auto-wait
- ❌ Shared mutable state between parallel tests — each test gets its own `BrowserContext`
- ❌ Login flow in every test — use `storageState` via setup project
- ❌ Screenshots in `afterEach` for passing tests — use `trace: "on-first-retry"` instead
- ❌ Hardcoded viewport sizes — use `devices` presets for consistent emulation

## WAF Alignment

| Pillar | Practice |
|---|---|
| **Reliability** | Auto-retry assertions, `trace: "on-first-retry"`, flake-free locator strategy, test isolation via `BrowserContext` |
| **Operational Excellence** | CI with artifact upload on failure, `--grep` tag filtering, parallel workers, reproducible `playwright install --with-deps` |
| **Performance Efficiency** | `storageState` auth reuse, `fullyParallel: true`, API tests without browser, network mocking eliminates backend latency |
| **Security** | Secrets via `process.env` (never committed), auth state in `.gitignore`, `--with-deps` pins browser versions |
| **Cost Optimization** | Run only `@smoke` on PR, full suite on merge; single Chromium install instead of all browsers for fast CI |
| **Responsible AI** | Accessibility ARIA snapshots enforce inclusive UI, visual regression catches unintended layout regressions |