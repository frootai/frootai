---
description: "Svelte 5 standards — runes, SvelteKit, TypeScript, and minimal-bundle patterns."
applyTo: "**/*.svelte, **/*.ts"
waf:
  - "performance-efficiency"
  - "reliability"
---

# Svelte — FAI Standards

## Svelte 5 Runes

Use runes for all reactive state. Never use legacy `let` reactivity or `$:` labels.

```svelte
<script lang="ts">
  // ✅ $state for mutable reactive values
  let count = $state(0);
  let items = $state<string[]>([]);

  // ✅ $derived for computed values (replaces $: reactive statements)
  let doubled = $derived(count * 2);
  let total = $derived.by(() => items.reduce((sum, i) => sum + i.length, 0));

  // ✅ $effect for side effects (replaces onMount + $: side-effect blocks)
  $effect(() => {
    document.title = `Count: ${count}`;
    return () => { /* cleanup on teardown or re-run */ };
  });
</script>
```

## Component Props & Snippets

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  // ✅ $props with destructuring + defaults
  let { title, variant = 'primary', children, header }: {
    title: string;
    variant?: 'primary' | 'secondary';
    children: Snippet;
    header?: Snippet<[{ close: () => void }]>;
  } = $props();
</script>

<div class="card {variant}">
  {#if header}
    {@render header({ close: () => console.log('closed') })}
  {/if}
  <h2>{title}</h2>
  {@render children()}
</div>
```

- Type all props inline or with a separate `interface` — never use `any`
- Use `Snippet` for composable render slots; prefer snippets over `<slot>` (deprecated in v5)
- `$bindable()` for two-way binding props: `let { value = $bindable('') } = $props()`

## SvelteKit Routing & Data Loading

```
src/routes/
├── +layout.svelte          ← shared shell (nav, footer)
├── +layout.server.ts       ← runs on server every request
├── +page.svelte             ← renders at /
├── +page.server.ts          ← server load + form actions
├── +error.svelte            ← error boundary
├── api/health/+server.ts    ← API route (GET/POST handlers)
└── items/[id]/
    ├── +page.svelte
    └── +page.ts             ← universal load (SSR + client)
```

### Server Load vs Universal Load

```typescript
// +page.server.ts — runs ONLY on server, can access DB/secrets
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
  const item = await db.items.find(params.id);
  if (!item) error(404, 'Item not found');
  return { item }; // serialized to client
};
```

```typescript
// +page.ts — universal load (SSR + client navigation)
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
  const res = await fetch(`/api/items/${params.id}`);
  if (!res.ok) throw new Error('Failed to load');
  return { item: await res.json() };
};
```

- Use `+page.server.ts` when accessing secrets, DB, or server-only APIs
- Use `+page.ts` for data that can be fetched client-side on navigation
- Never import `$env/static/private` in universal load or client code

### Form Actions

```typescript
// +page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const data = await request.formData();
    const name = data.get('name')?.toString().trim();
    if (!name) return fail(400, { name, missing: true });
    await db.items.create({ name, userId: locals.user.id });
    redirect(303, '/items');
  }
};
```

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  let { form } = $props();
</script>

<form method="POST" action="?/create" use:enhance>
  <input name="name" value={form?.name ?? ''} aria-describedby="err" />
  {#if form?.missing}<span id="err" role="alert">Name required</span>{/if}
  <button>Create</button>
</form>
```

## Environment Variables

```typescript
import { SECRET_API_KEY } from '$env/static/private';   // server-only, build-time
import { PUBLIC_APP_URL } from '$env/static/public';     // available on client
import { env } from '$env/dynamic/private';               // server-only, runtime
```

- `$env/static/private` — inlined at build, tree-shaken, fails if imported in client
- `$env/dynamic/private` — read at runtime, for values that change per deployment
- Prefix client-safe vars with `PUBLIC_` — SvelteKit enforces this boundary

## Stores & Navigation

```svelte
<script lang="ts">
  import { page, navigating } from '$app/stores';
  import { goto, invalidateAll } from '$app/navigation';

  let currentPath = $derived($page.url.pathname);

  async function refresh() {
    await invalidateAll(); // re-run all load functions
  }
</script>

{#if $navigating}<progress />{/if}
```

## CSS Scoping & Transitions

```svelte
<style>
  /* Scoped by default — only affects this component */
  .card { padding: 1rem; }

  /* Escape hatch for global overrides */
  :global(.toast-container) { position: fixed; z-index: 50; }
</style>

<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { flip } from 'svelte/animate';

  let visible = $state(true);
</script>

{#if visible}
  <div transition:fade={{ duration: 200 }}>Fades in/out</div>
{/if}

{#each items as item (item.id)}
  <div animate:flip={{ duration: 300 }} in:fly={{ y: 20 }}>
    {item.name}
  </div>
{/each}
```

## Error Handling

```svelte
<!-- +error.svelte — error boundary per layout segment -->
<script lang="ts">
  import { page } from '$app/stores';
</script>

<h1>{$page.status}</h1>
<p>{$page.error?.message}</p>
<a href="/">Go home</a>
```

- Use `error(status, message)` from `@sveltejs/kit` in load/actions — never throw raw
- Nest `+error.svelte` in route groups for segment-specific error pages
- `handleError` hook in `hooks.server.ts` for logging unhandled errors

## Adapter Configuration

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-auto'; // auto-detects deploy target
// import adapter from '@sveltejs/adapter-node';   // Node server
// import adapter from '@sveltejs/adapter-static'; // full SSG (prerender all)

export default {
  kit: {
    adapter: adapter(),
    csrf: { checkOrigin: true },       // enabled by default — never disable
    env: { dir: './' },
  }
};
```

- `adapter-auto` for Vercel/Cloudflare/Netlify auto-detection
- `adapter-node` for self-hosted Docker/Azure Container Apps — set `ORIGIN` env var
- `adapter-static` for pre-rendered SPAs — requires `export const prerender = true` on all pages

## Testing

```typescript
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Counter from './Counter.svelte';

test('increments on click', async () => {
  render(Counter, { props: { initial: 0 } });
  const btn = screen.getByRole('button', { name: /increment/i });
  await userEvent.click(btn);
  expect(screen.getByText('1')).toBeInTheDocument();
});
```

- Use `@testing-library/svelte` with Vitest — avoid `mount()` from `svelte` directly
- Heed all a11y warnings from `svelte-check` — role, aria-label, alt text
- Run `svelte-check --tsconfig ./tsconfig.json` in CI for type + a11y validation

## Anti-Patterns

- ❌ `let x = 0` without `$state` — not reactive in Svelte 5, UI won't update
- ❌ `$:` reactive labels — removed in Svelte 5, use `$derived` / `$effect`
- ❌ `<slot>` / `<slot name="x">` — deprecated, use `{@render children()}` snippets
- ❌ Importing `$env/static/private` in `+page.svelte` or `+page.ts` — build error
- ❌ `use:enhance` without handling — always add callback for optimistic UI or error display
- ❌ Global CSS without `:global()` — styles leak or silently fail
- ❌ `$effect` for derived state — use `$derived` instead, effects are for side-effects only
- ❌ `goto()` in form actions — use `redirect()` from `@sveltejs/kit` (proper 303)
- ❌ Disabling CSRF (`csrf: { checkOrigin: false }`) in production

## WAF Alignment

| Pillar | Svelte/SvelteKit Practice |
|---|---|
| **Performance** | Svelte compiles to vanilla JS — no virtual DOM overhead. Use `$derived` over `$effect` to avoid unnecessary re-renders. Lazy-load with `{#await import()}`. `adapter-static` for CDN-served pre-rendered pages. |
| **Reliability** | `+error.svelte` per route segment. `handleError` in `hooks.server.ts` for centralized logging. `fail()` in form actions for typed validation errors. |
| **Security** | CSRF origin checks enabled by default. `$env/static/private` enforced server-only at build. Form actions validate + sanitize with `fail()`. CSP headers via `hooks.server.ts` `handle`. |
| **Cost** | Minimal JS bundles (compiler strips unused code). `adapter-static` eliminates server costs entirely. Selective prerendering (`export const prerender = true`) for stable pages. |
| **Operations** | `svelte-check` in CI for type + a11y errors. Vitest + `@testing-library/svelte` for unit tests. Playwright for E2E. `adapter-node` with Docker for predictable container deployments. |
| **Responsible AI** | Svelte a11y warnings are compiler errors — enforce `alt`, `aria-*`, semantic HTML. Use `role="alert"` for dynamic error messages. Respect `prefers-reduced-motion` in transitions. |
