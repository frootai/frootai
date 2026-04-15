---
name: fai-web-coder
description: "Generate production-ready web pages and components from natural language with responsive layout, accessibility, and test hooks."
---

# FAI Web Coder

## Goal

Translate product requirements into maintainable frontend code with predictable UX quality and implementation constraints.

## Input Contract

| Input | Required | Description |
|------|----------|-------------|
| feature_summary | Yes | What the page/component does |
| framework | Yes | React, Next.js, Vue, plain HTML/CSS |
| design_system | No | Existing tokens/components |
| breakpoints | No | Mobile/tablet/desktop targets |
| accessibility_level | No | WCAG AA by default |

## Step 1 - Convert Requirement to UI Spec

```json
{
  "page": "Pricing",
  "sections": ["Hero", "Plan Cards", "FAQ", "CTA"],
  "states": ["loading", "empty", "error", "success"],
  "actions": ["Select plan", "Contact sales"]
}
```

## Step 2 - Scaffold Component Architecture

```tsx
export function PricingPage() {
  return (
    <main>
      <HeroSection />
      <PlanGrid />
      <FaqSection />
      <CtaBanner />
    </main>
  );
}
```

## Step 3 - Apply Responsive and A11y Rules

- Use semantic regions (main, section, nav, footer).
- Keep keyboard flow and focus visibility.
- Ensure contrast ratios meet WCAG AA.
- Use aria-live for async status updates.

```css
:root {
  --space-2: 0.5rem;
  --space-4: 1rem;
  --space-8: 2rem;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
}

@media (min-width: 768px) {
  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
```

## Step 4 - Add State Handling

```tsx
if (isLoading) return <SkeletonGrid />;
if (error) return <ErrorState retry={refetch} />;
if (!plans.length) return <EmptyState />;
```

## Step 5 - Add Test Hooks

```tsx
<button data-testid="select-plan-pro">Choose Pro</button>
```

## Validation Checklist

| Check | Pass Condition |
|------|----------------|
| Responsive layout | Works at all target breakpoints |
| Accessibility | Keyboard nav + labels + contrast pass |
| State coverage | Loading/empty/error/success present |
| Testability | Stable test IDs or semantic selectors |

## Troubleshooting

| Issue | Cause | Fix |
|------|-------|-----|
| Mobile overflow | Fixed-width container | Use fluid widths and minmax grids |
| Focus lost on rerender | Re-mounting key elements | Preserve DOM identity and focus management |
| Flaky E2E selectors | Styling-based selectors | Use role or data-testid selectors |
