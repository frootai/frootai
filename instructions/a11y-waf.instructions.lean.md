---
description: "Accessibility standards — WCAG 2.2 AA compliance, semantic HTML, ARIA roles/properties, keyboard navigation, focus management, color contrast, screen reader compatibility, and inclusive design patterns."
applyTo: "**/*.tsx, **/*.html, **/*.vue"
waf:
  - "responsible-ai"
  - "reliability"
---

# Accessibility (A11y) — FAI Standards

When creating or modifying UI components, enforce WCAG 2.2 Level AA compliance. Every interactive element must be operable by keyboard, visible to assistive technology, and meet contrast requirements.

## Semantic HTML Rules

1. Use native HTML elements over ARIA where possible — `<button>` not `<div role="button">`, `<nav>` not `<div role="navigation">`
2. Every page must have exactly one `<main>` landmark
3. Use `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>` landmarks — screen readers use these for page navigation
4. Heading hierarchy must be sequential — never skip from `<h1>` to `<h3>`
5. Every page must have exactly one `<h1>`
6. Use `<ul>`/`<ol>` for lists — never style `<div>` elements to look like lists
7. Use `<table>` with `<thead>`, `<th scope="col">`, and `<caption>` for tabular data
8. Use `<fieldset>` and `<legend>` to group related form controls

## ARIA Rules

9. Never use `role="presentation"` or `aria-hidden="true"` on focusable elements
10. Every `aria-labelledby` and `aria-describedby` ID must reference an existing element
11. Custom widgets must implement the correct [WAI-ARIA design pattern](https://www.w3.org/WAI/ARIA/apg/patterns/)
12. Use `aria-live="polite"` for status updates, `aria-live="assertive"` only for errors/alerts
13. Toggle buttons must use `aria-pressed`, expandable sections must use `aria-expanded`
14. Use `aria-current="page"` on the active navigation link

```tsx
// Correct: live region for dynamic content
<div aria-live="polite" aria-atomic="true">
  {statusMessage && <p>{statusMessage}</p>}
</div>

// Correct: accessible modal dialog
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Confirm deletion</h2>
  <p>This action cannot be undone.</p>
  <button onClick={onConfirm}>Delete</button>
  <button onClick={onCancel}>Cancel</button>
</div>
```

## Keyboard Navigation Rules

15. All interactive elements must be reachable via Tab key in logical DOM order — never use positive `tabindex` (1, 2, 3)
16. Use `tabindex="0"` to make custom elements focusable, `tabindex="-1"` for programmatic focus only
17. Escape key must close modals, dropdowns, and popovers
18. Arrow keys must navigate within composite widgets (tabs, menus, listboxes, grids)
19. Enter/Space must activate buttons and links
20. Provide a visible skip link as the first focusable element on every page

```html
<!-- Skip link pattern -->
<a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:p-3 focus:bg-white focus:text-black">
  Skip to main content
</a>
```

## Focus Management Rules

21. When a modal opens, move focus to the first focusable element inside it
22. When a modal closes, return focus to the element that triggered it
23. Trap focus inside modal dialogs — Tab must not escape to content behind the overlay
24. After removing a list item, move focus to the next item or the list container
25. Focus must be visible — never use `outline: none` without a custom focus indicator

```css
/* Minimum focus indicator: 2px solid, 3:1 contrast against adjacent colors */
:focus-visible {
  outline: 2px solid #1a73e8;
  outline-offset: 2px;
}
```

## Color & Contrast Rules

26. Normal text (< 18pt / < 14pt bold): minimum **4.5:1** contrast ratio against background
27. Large text (≥ 18pt / ≥ 14pt bold): minimum **3:1** contrast ratio
28. UI components and graphical objects: minimum **3:1** contrast ratio
29. Focus indicators: minimum **3:1** contrast against adjacent colors
30. Never convey information by color alone — add icons, patterns, or text labels

## Forms & Error Handling

31. Every `<input>`, `<select>`, `<textarea>` must have an associated `<label>` with matching `for`/`id`
32. Required fields must use `aria-required="true"` and visible indicator (not color alone)
33. Validation errors must be announced — use `aria-describedby` pointing to the error message
34. Error messages must identify the field and describe how to fix the issue
35. Group related inputs with `<fieldset>` and `<legend>` (e.g., radio button groups, address fields)

```tsx
<div>
  <label htmlFor="email">Email address <span aria-hidden="true">*</span></label>
  <input
    id="email"
    type="email"
    aria-required="true"
    aria-invalid={!!errors.email}
    aria-describedby={errors.email ? "email-error" : undefined}
  />
  {errors.email && (
    <p id="email-error" role="alert">Enter a valid email address (e.g., name@example.com)</p>
  )}
</div>
```

## Images & Media

36. Every `<img>` must have an `alt` attribute — descriptive for informative images, `alt=""` for decorative
37. Complex images (charts, diagrams) need a long description via `aria-describedby` or adjacent text
38. Videos must have captions; pre-recorded audio must have transcripts
39. Avoid auto-playing media — if unavoidable, provide pause/stop controls within 3 seconds

## Motion & Animation

40. Respect `prefers-reduced-motion` — disable non-essential animations when set to `reduce`
41. No content may flash more than 3 times per second
42. Carousels and auto-advancing content must have pause controls

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

## Touch & Target Size

43. Touch targets must be at least **44×44 CSS pixels** (WCAG 2.2 Target Size)
44. Spacing between adjacent targets must be at least 8px to prevent accidental activation

## Anti-Patterns

- `<div onClick>` — use `<button>` instead
- `placeholder` as the only label — always use `<label>`
- `aria-label` that duplicates visible text — use `aria-labelledby` instead
- `display: none` on live regions — content won't be announced
- `tabindex="5"` — positive tabindex breaks natural focus order
- Color-only error indicators (red border without text/icon)

## Testing & Validation

- Run `axe-core` or Lighthouse Accessibility audit on every page — target **zero violations**
- Test keyboard-only navigation for every interactive flow
- Test with NVDA (Windows) or VoiceOver (macOS) for at least the critical user paths
- Validate heading hierarchy with browser developer tools or HeadingsMap extension
- Test at 200% browser zoom — no content should be hidden or overlapping
- Verify `prefers-reduced-motion` behavior by enabling the OS setting

## WAF Alignment

| Pillar | How A11y Supports It |
| --- | --- |
| Responsible AI | Inclusive design ensures AI-powered UIs are usable by everyone |
| Reliability | Semantic HTML degrades gracefully when JS fails — core content remains accessible |
