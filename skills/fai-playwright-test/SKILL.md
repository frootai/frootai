---
name: fai-playwright-test
description: |
  Write Playwright E2E tests in TypeScript with test fixtures, assertions,
  and parallel execution. Use when testing web applications with the
  Playwright Test framework.
---

# Playwright TypeScript E2E Tests

Write browser tests in TypeScript with @playwright/test.

## When to Use

- E2E testing web applications with TypeScript
- Testing across chromium, firefox, and webkit
- Running parallel tests with fixtures and reporters
- Visual regression testing with screenshots

---

## Setup

```bash
npm init playwright@latest
```

## Test Structure

```typescript
import { test, expect } from '@playwright/test';

test('send message and receive response', async ({ page }) => {
  await page.goto('/');
  await page.fill('[data-testid=chat-input]', 'Hello');
  await page.click('[data-testid=send-button]');
  await expect(page.locator('[data-testid=response]')).toBeVisible();
  await expect(page.locator('[data-testid=response]')).toContainText('Hello');
});

test('empty input shows validation error', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid=send-button]');
  await expect(page.locator('.error')).toBeVisible();
});

test.describe('authenticated flows', () => {
  test.use({ storageState: 'auth.json' });

  test('shows user dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });
});
```

## Page Object Model

```typescript
export class ChatPage {
  constructor(private page: Page) {}

  async navigate() { await this.page.goto('/'); }
  async sendMessage(msg: string) {
    await this.page.fill('[data-testid=chat-input]', msg);
    await this.page.click('[data-testid=send-button]');
  }
  async getResponse() {
    return this.page.textContent('[data-testid=response]');
  }
}
```

## playwright.config.ts

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
});
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Tests time out | Element not found | Use data-testid, check baseURL |
| Flaky in CI | No retries configured | Add retries: 2 for CI |
| Auth tests fail | No saved state | Run auth setup as globalSetup |
| Screenshots not captured | Not configured | Set screenshot: 'only-on-failure' |
