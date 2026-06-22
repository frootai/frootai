---
description: "Nuxt 3 standards — Vue 3, SSR, auto-imports, and composable patterns."
applyTo: "**/*.vue, **/*.ts"
waf:
  - "performance-efficiency"
  - "reliability"
---

# Nuxt 3 — FAI Standards

## Auto-Imports

Nuxt auto-imports composables (`composables/`), components (`components/`), and utilities (`utils/`). Never write manual imports for Vue APIs or Nuxt composables.

```vue
<script setup lang="ts">
// ✅ All auto-imported — useRoute, useFetch, useState, ref, computed
const route = useRoute()
const { data } = await useFetch('/api/products')
const count = useState('counter', () => 0)
</script>
```

Custom composables: prefix with `use`, export from `composables/`. Utils: pure functions only — no Vue reactivity.

## File-Based Routing

Pages in `pages/`. Dynamic: `[id].vue`. Catch-all: `[...slug].vue`. Always use `definePageMeta`:

```vue
<!-- pages/products/[id].vue -->
<script setup lang="ts">
definePageMeta({
  layout: 'shop',
  middleware: ['auth'],
  validate: (route) => /^\d+$/.test(route.params.id as string),
})
const { data: product } = await useFetch(`/api/products/${useRoute().params.id}`)
</script>
```

Use `navigateTo()` for programmatic navigation — never `router.push` in server context.

## Server Routes (Nitro)

HTTP-method suffixed files in `server/api/`. Use `defineEventHandler`, `readBody`, `getQuery`, `getRouterParam`:

```ts
// server/api/products/[id].get.ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
  return await db.findProduct(id) ?? throw createError({ statusCode: 404 })
})
```

POST/PUT: `readBody<T>(event)` with validation. `server/middleware/` for auth. `server/utils/` for shared helpers (auto-imported).

## Data Fetching

- `useFetch` — component-level, SSR-safe, deduped, reactive via `watch`
- `useAsyncData` — custom fetch logic, transforms, multi-source aggregation
- `$fetch` — event handlers and client-only code ONLY

```vue
<script setup lang="ts">
const { data, pending, refresh } = await useFetch('/api/items', {
  query: { page: currentPage }, watch: [currentPage],
})
</script>
```

`useAsyncData` for multi-source: `Promise.all([$fetch(...), $fetch(...)])`. **Never** call `$fetch` directly in `<script setup>` — causes double fetch on SSR.

## State & Runtime Config

`useState` for SSR-safe reactive state. Pinia (`@pinia/nuxt`) for complex stores with `defineStore` + composition API.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    apiSecret: '',          // Server-only — NUXT_API_SECRET env var
    public: { apiBase: '' } // Client-safe — NUXT_PUBLIC_API_BASE env var
  }
})
```

Access via `useRuntimeConfig()` in components, `event.context.runtimeConfig` in server routes. Never use `process.env` in client code.

## SEO, Middleware, Plugins

```vue
<script setup lang="ts">
useSeoMeta({ title: () => product.value?.name, description: 'Browse our catalog' })
</script>
```

```ts
// middleware/auth.ts
export default defineNuxtRouteMiddleware((to) => {
  const { isLoggedIn } = useAuth()
  if (!isLoggedIn.value && to.meta.requiresAuth) return navigateTo('/login')
})
```

Plugins in `plugins/` — use `.client.ts`/`.server.ts` suffixes. Layouts in `layouts/` — bind via `definePageMeta({ layout: 'admin' })`.

## Error Handling

Wrap volatile components in `<NuxtErrorBoundary>` with `#error="{ error, clearError }"` slot. Server routes: always `createError({ statusCode, statusMessage })` — never throw raw strings. Create `error.vue` at project root for global error pages.

## TypeScript, Modules & Testing

```ts
export default defineNuxtConfig({
  typescript: { strict: true, typeCheck: true },
  modules: ['@pinia/nuxt', '@nuxt/image', '@nuxtjs/i18n'],
})
```

Run `nuxi typecheck` in CI. Use `.nuxt/tsconfig.json` — don't override auto-generated paths.

Test with `@nuxt/test-utils` + Vitest: `mountSuspended()` for component tests, `$fetch` for server route tests. Run `nuxi prepare` before test suite.

## Anti-Patterns

- **Don't** use `axios`/raw `fetch` — use `$fetch`, `useFetch`, `useAsyncData`
- **Don't** import Vue APIs manually (`import { ref }`) — auto-imported
- **Don't** use `process.env` in client code — use `useRuntimeConfig().public`
- **Don't** call `$fetch` in `<script setup>` top-level — double fetch on SSR
- **Don't** use `router.push()` — use `<NuxtLink>` or `navigateTo()`
- **Don't** skip `definePageMeta.validate` for dynamic route params

## WAF Alignment

| Pillar | Practice |
|---|---|
| Performance | `<Lazy*>` components, `useFetch` with `pick`, Nitro `routeRules` caching, code-split via `pages/` |
| Reliability | `NuxtErrorBoundary` per widget, `createError` with status codes, `useFetch` retry, `server/api/health.get.ts` |
| Security | Secrets in `runtimeConfig` (not `public`), validate `readBody`, CSRF module, CSP in `nitro.routeRules` |
| Cost | ISR via `routeRules`, edge deploy with Nitro presets, `nitro.minify`, lazy hydration |
| Operations | `nuxi analyze` bundles, structured server logging, `nuxi typecheck` in CI, pin module versions |
| Responsible AI | Sanitize input before LLM calls, content safety in server routes, AI attribution in UI |
