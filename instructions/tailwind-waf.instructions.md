---
description: "Tailwind CSS v4 standards — utility-first, component extraction, responsive design, and dark mode patterns."
applyTo: "**/*.css, **/*.tsx, **/*.vue"
waf:
  - "performance-efficiency"
---

# Tailwind CSS — FAI Standards

## Tailwind v4 CSS-First Configuration

Tailwind v4 replaces `tailwind.config.js` with native CSS directives. All customization lives in your CSS entry point:

```css
/* app/globals.css — Tailwind v4 entry */
@import "tailwindcss";

@theme {
  --color-brand: #10b981;
  --color-brand-dark: #059669;
  --color-surface: #0a0a0a;
  --color-surface-alt: #111111;
  --font-sans: "Inter", system-ui, sans-serif;
  --spacing-18: 4.5rem;
  --radius-pill: 9999px;
  --breakpoint-xs: 28rem;
}

@variant dark (&:where(.dark, .dark *));
```

Content detection is automatic in v4 — no `content[]` config needed. For non-standard paths, use `@source`:

```css
@source "../components/**/*.{tsx,vue}";
@source "../node_modules/@acme/ui/dist/**/*.js";
```

## Utility-First Methodology

Compose UI directly with utilities. Extract components only when a pattern repeats 3+ times:

```html
<!-- ✅ Utility-first — readable, scannable, no abstraction overhead -->
<button class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2
               text-sm font-medium text-white shadow-sm
               hover:bg-brand-dark focus-visible:outline-2
               focus-visible:outline-offset-2 focus-visible:outline-brand
               disabled:opacity-50 disabled:pointer-events-none
               transition-colors duration-150">
  Deploy
</button>
```

Use `@apply` sparingly — only for repeated base styles in leaf components, never in layout or page files:

```css
/* ✅ Acceptable: repeated badge pattern across 10+ components */
.badge {
  @apply inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium;
}

/* ❌ Never: layout utilities belong in markup, not extracted */
.page-wrapper {
  @apply flex min-h-screen flex-col;
}
```

## Responsive Design (Mobile-First)

Always design mobile-first. Breakpoints (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`) layer upward:

```html
<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
  <article class="p-4 sm:p-6 lg:p-8">
    <h2 class="text-lg sm:text-xl lg:text-2xl font-bold">Title</h2>
  </article>
</div>
```

Container queries for component-scoped responsive behavior:

```html
<div class="@container">
  <div class="flex flex-col @md:flex-row @lg:gap-6 items-start @md:items-center">
    <img class="w-full @md:w-48 @lg:w-64 rounded-lg" src="..." alt="..." />
    <div class="mt-4 @md:mt-0">...</div>
  </div>
</div>
```

## Dark Mode (Class Strategy)

Use `class` strategy via the `@variant` directive (see config above). Toggle `.dark` on `<html>`:

```html
<!-- Light: white surface, dark text. Dark: dark surface, light text -->
<div class="bg-white text-gray-900 dark:bg-surface dark:text-gray-100
            border border-gray-200 dark:border-white/10
            shadow-sm dark:shadow-none">
  <p class="text-gray-600 dark:text-gray-400">Adaptive content</p>
</div>
```

## Custom Design Tokens via CSS Variables

Reference `@theme` tokens directly as utilities. Extend with arbitrary values when one-off:

```html
<!-- Theme tokens used as utilities -->
<div class="bg-brand text-white rounded-pill p-18">
  Branded card with custom spacing
</div>

<!-- Arbitrary values for one-offs — never add to @theme for single use -->
<div class="grid grid-cols-[240px_1fr_120px] gap-[clamp(1rem,3vw,2rem)]">
  <aside class="h-[calc(100vh-4rem)] overflow-y-auto">Sidebar</aside>
</div>
```

Child selectors and arbitrary variants:

```html
<ul class="space-y-2 [&>li]:rounded-lg [&>li]:border [&>li]:p-3
           [&>li:hover]:bg-gray-50 dark:[&>li:hover]:bg-white/5">
  <li>Item with hover state</li>
</ul>
```

## Tailwind Merge + cn() Utility

Use `tailwind-merge` with `clsx` to safely merge conditional classes without conflicts:

```typescript
// lib/utils.ts — standard cn() pattern
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

```tsx
// Usage: last class wins, no duplicates in output
function Card({ className, featured }: { className?: string; featured?: boolean }) {
  return (
    <div className={cn(
      "rounded-xl border p-6 transition-shadow",
      featured ? "border-brand bg-brand/5 shadow-lg" : "border-gray-200 dark:border-white/10",
      className // consumer overrides always win
    )}>
      ...
    </div>
  );
}
```

## Typography with Prose

Use `@tailwindcss/typography` for rendered markdown/CMS content:

```html
<article class="prose prose-lg dark:prose-invert
                prose-headings:font-bold prose-headings:tracking-tight
                prose-a:text-brand prose-a:no-underline hover:prose-a:underline
                prose-code:before:content-none prose-code:after:content-none
                prose-pre:bg-surface prose-pre:border prose-pre:border-white/10
                max-w-none">
  <!-- Rendered markdown here -->
</article>
```

## Animation Utilities

Prefer Tailwind's built-in animation utilities; define custom keyframes in `@theme`:

```css
@theme {
  --animate-fade-in: fade-in 0.3s ease-out;
  --animate-slide-up: slide-up 0.4s ease-out;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slide-up {
  from { opacity: 0; transform: translateY(0.5rem); }
  to { opacity: 1; transform: translateY(0); }
}
```

```html
<div class="animate-fade-in motion-reduce:animate-none">
  Always respect motion-reduce for accessibility.
</div>
```

## Production: Tree-Shaking + Prettier

Tailwind v4 auto-detects sources and tree-shakes unused utilities at build time. Ensure:
- No dynamic class construction: `` `text-${color}-500` `` — use complete literals or safelist
- Install `prettier-plugin-tailwindcss` for deterministic class ordering across the team
- Configure in `.prettierrc`: `{ "plugins": ["prettier-plugin-tailwindcss"] }`

## Anti-Patterns

- ❌ String-interpolating class names — breaks tree-shaking (`text-${size}` → invisible to scanner)
- ❌ `@apply` in layout/page files — defeats utility-first, creates hidden coupling
- ❌ Mixing `tailwind.config.js` with `@theme` — pick one; v4 uses CSS-first exclusively
- ❌ Using `!important` modifiers (`!p-4`) — fix specificity at the source, not with force
- ❌ Conditional classes without `tailwind-merge` — leads to conflicting utility output
- ❌ Ignoring `motion-reduce:` for animations — accessibility violation (WCAG 2.3.3)
- ❌ Giant `@apply` chains (5+ utilities) — just use utilities in markup
- ❌ Missing dark mode variants on interactive states (hover, focus, active)
- ❌ Hardcoding colors (`bg-[#10b981]`) when a token exists in `@theme`

## WAF Alignment

| Pillar | Tailwind Practice |
|--------|-------------------|
| **Performance** | Automatic tree-shaking removes unused CSS. Atomic utilities = high cache-hit ratio. Avoid runtime CSS-in-JS. |
| **Security** | No user input in class names — prevents CSS injection. CSP-compatible (no inline styles generated). |
| **Reliability** | Design tokens in `@theme` = single source of truth. `cn()` prevents class conflicts. Prettier plugin enforces ordering. |
| **Cost Optimization** | Zero-runtime CSS — no JS bundle cost. Shared utility cache across pages reduces CDN egress. |
| **Operational Excellence** | `prettier-plugin-tailwindcss` enforces consistent ordering. `@theme` tokens align design/dev. Container queries reduce breakpoint sprawl. |
| **Responsible AI** | `motion-reduce:` respects user preferences. Semantic HTML + utilities preserve screen-reader compatibility. |
