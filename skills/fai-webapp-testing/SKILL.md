---
name: fai-webapp-testing
description: "Design layered web app test strategy across unit, integration, E2E, accessibility, and performance baselines."
---

# FAI WebApp Testing

## Purpose

Build a complete test strategy for modern web apps with deterministic CI gates.

## Test Pyramid

| Layer | Target | Example Tools |
|------|--------|---------------|
| Unit | Pure logic/components | Vitest, Jest |
| Integration | API + component interactions | Testing Library, Playwright component |
| E2E | User journeys | Playwright/Cypress |
| Accessibility | WCAG checks | axe-core |
| Performance | Core Web Vitals budget | Lighthouse CI |

## Step 1 - Unit Testing Baseline

```ts
import { describe, it, expect } from 'vitest';

describe('price formatter', () => {
  it('formats USD values', () => {
    expect(formatPrice(1999)).toBe('$19.99');
  });
});
```

## Step 2 - Integration Testing

```tsx
render(<CheckoutPage />);
await user.click(screen.getByRole('button', { name: /pay now/i }));
expect(await screen.findByText(/payment successful/i)).toBeInTheDocument();
```

## Step 3 - E2E Journey

```ts
test('user can complete checkout', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Pricing' }).click();
  await page.getByTestId('select-plan-pro').click();
  await expect(page.getByText('Order confirmed')).toBeVisible();
});
```

## Step 4 - Accessibility Gate

```ts
import AxeBuilder from '@axe-core/playwright';
const results = await new AxeBuilder({ page }).analyze();
expect(results.violations).toEqual([]);
```

## Step 5 - CI Quality Gates

| Gate | Threshold |
|------|-----------|
| Unit coverage | >= 80% lines |
| E2E critical flow pass | 100% |
| Axe violations | 0 high/critical |
| Lighthouse performance | >= 80 |

## Troubleshooting

| Issue | Cause | Fix |
|------|-------|-----|
| Flaky E2E | Timing and unstable selectors | Add explicit waits + semantic selectors |
| Slow test suite | Over-heavy E2E coverage | Shift non-critical checks to integration |
| A11y regressions | Missing lint/a11y checks | Add pre-merge axe + ESLint plugin |

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
