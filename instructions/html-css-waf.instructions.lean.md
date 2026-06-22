---
description: "HTML/CSS standards — semantic HTML, accessibility, 60-30-10 color rule, and responsive design."
applyTo: "**/*.html, **/*.css"
waf:
  - "responsible-ai"
  - "performance-efficiency"
---

# HTML & CSS — FAI Standards

## Semantic HTML5

- Use `<header>`, `<nav>`, `<main>`, `<article>`, `<section>`, `<aside>`, `<footer>` — never `<div>` soup
- One `<main>` per page. `<figure>` + `<figcaption>` for images/charts/code
- `<details>`+`<summary>` for collapsible UI. `<dialog>` for modals (`.showModal()`)
- `<time datetime="2026-04-13">` for dates. Strict `h1`→`h6` hierarchy, never skip levels

```html
<article>
  <header><h2>Play 01 — Enterprise RAG</h2></header>
  <section aria-labelledby="arch">
    <h3 id="arch">Architecture</h3>
    <figure>
      <img src="arch.webp" alt="RAG pipeline: ingest → chunk → embed → retrieve" width="800" height="450">
      <figcaption>End-to-end RAG architecture</figcaption>
    </figure>
  </section>
</article>
```

## CSS Custom Properties & Theming

```css
:root {
  color-scheme: light dark;
  --color-surface: light-dark(#fff, #1a1a2e);
  --color-text: light-dark(#111, #e0e0e0);
  --color-primary: #10b981;
  --radius-md: 0.5rem;
  --space-unit: 0.25rem;
}
body { background: var(--color-surface); color: var(--color-text); }
```

## Modern Layout

- **Grid** for 2D layouts, **Flexbox** for 1D alignment. `gap` on both — no margin hacks

```css
.play-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
  gap: calc(var(--space-unit) * 6);
}
.card { display: flex; flex-direction: column; gap: 1rem; aspect-ratio: 4 / 3; }
```

## Container Queries

```css
.card-wrapper { container-type: inline-size; }
@container (min-inline-size: 400px) { .card { flex-direction: row; } }
```

## CSS Nesting & Cascade Layers

```css
@layer reset, base, components, utilities;

@layer components {
  .btn {
    padding-block: 0.5rem; padding-inline: 1rem;
    &:hover { filter: brightness(1.1); }
    &:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  }
}
```

## Logical Properties

- `margin-inline`, `padding-block`, `border-inline-start`, `inset-block` — automatic RTL support

## Responsive Typography & `:has()`

```css
h1 { font-size: clamp(1.75rem, 1rem + 3vw, 3rem); }
h2 { font-size: clamp(1.25rem, 0.8rem + 2vw, 2rem); }
p  { font-size: clamp(1rem, 0.9rem + 0.5vw, 1.125rem); line-height: 1.6; }

.form-group:has(:invalid) { border-color: var(--color-error); }
.card:has(> img) { grid-template-rows: 200px 1fr; }
```

## Scroll Snap & BEM

```css
.carousel {
  display: flex; overflow-x: auto; scroll-snap-type: x mandatory;
  & > * { scroll-snap-align: start; flex: 0 0 min(300px, 80vw); }
}
```

- BEM: `.play-card` → `.play-card__title` → `.play-card--featured`. Max depth: `block__element--modifier`

## Accessibility

- `:focus-visible` for keyboard-only focus rings — never `outline: none` without replacement
- `prefers-reduced-motion: reduce` — disable transitions, parallax, auto-play
- `prefers-contrast: more` — increase borders, use solid backgrounds
- Touch targets: `44px × 44px` min (`min-block-size`/`min-inline-size`)
- Contrast: 4.5:1 text, 3:1 large text / UI (WCAG AA). Use `aria-*` on unlabelled interactives

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

## Performance

- `content-visibility: auto` on below-fold sections — skips rendering until scrolled
- `will-change` only before animation, remove after — never in static styles
- `contain: layout style paint` on isolated components (cards, modals)
- Images: `loading="lazy"` + explicit `width`/`height` to prevent CLS
- `<picture>` with `<source type="image/avif">` → `webp` → `jpg` fallback
- Inline critical CSS in `<head>`, defer rest via `<link rel="preload" as="style">`

## Anti-Patterns

- ❌ `<div>`/`<span>` for clickable elements — use `<button>`, `<a>`, `<input>`
- ❌ `outline: none` without `:focus-visible` replacement
- ❌ `!important` outside utility layers or a11y overrides
- ❌ Fixed `px` font sizes — use `rem`/`clamp()`
- ❌ `@import` in CSS — use `@layer` or bundler imports
- ❌ Magic numbers — extract to custom properties
- ❌ `will-change` on static elements — compositor layer bloat
- ❌ `height: 100vh` on mobile — use `100dvh`
- ❌ Styling with IDs — specificity too high, use classes
- ❌ `display: none` without `aria-hidden` consideration

## WAF Alignment

| Pillar | HTML/CSS Practice |
| --- | --- |
| **Responsible AI** | Semantic HTML for screen readers, WCAG AA contrast, `prefers-reduced-motion`, `aria-*`, `lang` on `<html>` |
| **Performance** | `content-visibility`, `contain`, lazy loading, critical CSS inlining, AVIF/WebP, CSS-only animations |
| **Reliability** | Progressive enhancement — content readable without CSS/JS, `<noscript>`, `@supports` feature detection |
| **Security** | CSP-compatible styles (no inline `style=`), `referrerpolicy`, `sandbox` on `<iframe>`, SRI on CDN sheets |
| **Cost Optimization** | Cascade layers for minimal CSS, tree-shakeable utilities, system font stacks, modern image formats |
| **Operational Excellence** | Design tokens as custom properties, BEM/utility naming, `@layer` for predictable cascade |
