---
description: "Astro framework standards — Islands Architecture, content collections, view transitions, SSG/SSR modes, image optimization, MDX, and deployment patterns."
applyTo: "**/*.astro, **/astro.config.*, **/*.mdx"
waf:
  - "performance-efficiency"
  - "reliability"
  - "operational-excellence"
  - "security"
---

# Astro WAF — FAI Standards

When writing or reviewing Astro code, enforce these WAF-aligned standards.

## Rules

### Islands Architecture
1. Default to zero-JS static HTML. Only hydrate components that require interactivity using `client:*` directives.
2. Use `client:visible` for below-the-fold interactive components to defer hydration until they enter the viewport.
3. Use `client:idle` for non-critical interactivity (analytics widgets, chat bubbles) that can wait until the main thread is idle.
4. Use `client:load` only for above-the-fold components that must be interactive immediately (nav menus, auth forms).
5. Use `client:media="(min-width: 768px)"` for components that are interactive only on specific screen sizes.
6. Prefer Astro components (`.astro`) for static content. Use framework islands (React/Vue/Svelte) only when you need client-side state or lifecycle hooks.

### Content Collections
7. Define all content collections in `src/content.config.ts` using `defineCollection()` with Zod schemas for type safety.
8. Use `glob()` or `file()` loaders to source content: `const blog = defineCollection({ loader: glob({ pattern: "**/*.md", base: "src/data/blog" }), schema: blogSchema })`.
9. Query collections with `getCollection("blog")` and individual entries with `getEntry("blog", "my-post")`. Always handle the `undefined` case.
10. Use `reference()` in schemas to create typed relationships between collections (e.g., author references in blog posts).
11. Place collection schemas in `src/content.config.ts` — never define inline schemas in page files.

### Server Islands
12. Use `server:defer` directive on components that need server rendering at request time while the rest of the page is static.
13. Provide a loading fallback for deferred server islands: `<ServerComponent server:defer><p slot="fallback">Loading...</p></ServerComponent>`.
14. Use server islands for personalized content (user-specific data, A/B tests) on otherwise cacheable pages.

### View Transitions
15. Add `<ViewTransitions />` in the `<head>` of your layout to enable SPA-like page transitions.
16. Use `transition:name="hero"` to animate specific elements across page navigations with shared element transitions.
17. Use `transition:animate="slide"` for directional navigation (pagination, wizard steps).
18. Add `transition:persist` to elements that should maintain state across navigations (audio players, forms in progress).
19. Handle `astro:page-load` and `astro:after-swap` events for scripts that need to re-initialize after navigation.

### SSG vs SSR
20. Use static generation (`output: "static"`) as the default for content sites, marketing pages, and documentation.
21. Use `output: "server"` or `output: "hybrid"` only when pages require per-request data (auth-gated content, real-time data).
22. In hybrid mode, mark dynamic pages with `export const prerender = false` — all other pages remain static.
23. For SSR adapters, prefer `@astrojs/node` for self-hosted, `@astrojs/vercel` for Vercel, `@astrojs/cloudflare` for Cloudflare Workers.

### Image Optimization
24. Use the built-in `<Image />` component from `astro:assets` for automatic format conversion (WebP/AVIF), resizing, and lazy loading.
25. Import images from `src/` for build-time optimization: `import hero from '../assets/hero.jpg'`. Use `<Image src={hero} alt="..." />`.
26. Use `<Picture />` for art-directed responsive images with multiple source formats and sizes.
27. Set explicit `width` and `height` on all images to prevent layout shift (CLS).
28. For remote images, configure `image.remotePatterns` in `astro.config.mjs` to allowlist trusted domains.

### MDX Integration
29. Enable MDX with `@astrojs/mdx` integration. Use MDX for content pages that need interactive components embedded in prose.
30. Import components at the top of MDX files and use them inline: `import Chart from '../components/Chart.astro'`.
31. Use remark/rehype plugins for content transformation: `remarkPlugins: [remarkMath]`, `rehypePlugins: [rehypeKatex]`.
32. Override default HTML elements in MDX via the `components` prop to apply consistent styling.

### Routing & Middleware
33. Use file-based routing in `src/pages/`. Dynamic routes use `[slug].astro`, catch-all with `[...path].astro`.
34. Generate static paths with `getStaticPaths()` returning `{ params, props }` — always return all valid paths for static builds.
35. Use `src/middleware.ts` for cross-cutting concerns: auth checks, redirects, response header injection, locale detection.
36. Chain middleware with `sequence()`: `export const onRequest = sequence(authMiddleware, localeMiddleware)`.

### Environment Variables & Configuration
37. Use `astro:env` module for type-safe environment variables. Define schemas in `astro.config.mjs`: `env: { schema: { API_KEY: envField.string({ context: "server", access: "secret" }) } }`.
38. Never expose server secrets to client components. Use `context: "server"` for API keys and `context: "client"` only for public values.
39. Access env vars in server code with `import { API_KEY } from "astro:env/server"` — never use `import.meta.env` for typed vars.

### TypeScript & Code Quality
40. Enable strict TypeScript: set `"strict": true` in `tsconfig.json` and use `@astrojs/ts-plugin` for `.astro` file support.
41. Type component props with `interface Props` in the component frontmatter, not inline.
42. Use `Astro.props` with destructuring and defaults: `const { title, class: className = "" } = Astro.props`.

### Deployment
43. For static sites: set `output: "static"` and deploy the `dist/` folder to any CDN (Cloudflare Pages, Vercel, Azure Static Web Apps).
44. Configure proper cache headers: immutable for hashed assets (`/_astro/*`), short TTL for HTML pages.
45. Set `site` and `base` in `astro.config.mjs` for correct canonical URLs and asset paths.

## Patterns

```astro
---
// Content collection page with typed data
import { getCollection } from "astro:content";
import Layout from "../layouts/Base.astro";
import { Image } from "astro:assets";

const posts = await getCollection("blog", ({ data }) => !data.draft);
const sorted = posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
---
<Layout title="Blog">
  <ul>
    {sorted.map(post => (
      <li>
        <a href={`/blog/${post.id}/`}>
          <Image src={post.data.cover} alt={post.data.title} width={400} height={225} />
          <h2>{post.data.title}</h2>
          <time datetime={post.data.date.toISOString()}>{post.data.date.toLocaleDateString()}</time>
        </a>
      </li>
    ))}
  </ul>
</Layout>
```

```astro
---
// Island architecture: static page with hydrated interactive component
import InteractiveChart from "../components/Chart.tsx";
---
<section>
  <h2>Static heading — zero JS</h2>
  <p>This content ships as plain HTML.</p>
  <InteractiveChart client:visible data={chartData} />
</section>
```

```typescript
// src/middleware.ts — auth + security headers
import { defineMiddleware, sequence } from "astro:middleware";

const securityHeaders = defineMiddleware((context, next) => {
  const response = await next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
});

const auth = defineMiddleware((context, next) => {
  if (context.url.pathname.startsWith("/dashboard") && !context.locals.user) {
    return context.redirect("/login", 302);
  }
  return next();
});

export const onRequest = sequence(securityHeaders, auth);
```

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|---|---|---|
| `client:load` on every component | Ships unnecessary JS, defeats Astro's purpose | Use `client:visible` or `client:idle`; most components need no hydration |
| Fetching data inside framework islands | Duplicates fetch logic, breaks SSG | Fetch in Astro frontmatter, pass data as props to islands |
| Using `import.meta.env` for typed env vars | No validation, runtime errors | Use `astro:env` module with schema definitions |
| Inline content schemas in page files | Duplicated, no type sharing | Define all schemas in `src/content.config.ts` |
| Missing `alt` on `<Image />` | Accessibility violation, lighthouse failure | Always provide descriptive alt text |
| SSR for pages that could be static | Increased latency, higher hosting cost | Use `output: "hybrid"` and opt-in to SSR per page |
| `getStaticPaths` fetching without pagination | Build OOM on large datasets | Use `paginate()` helper for large collections |
| No fallback on `server:defer` islands | Users see empty space during load | Always provide a `slot="fallback"` |

## Testing

- Build-test with `astro check` to catch TypeScript and template errors before deployment.
- Validate content collection schemas by running `astro build` — schema violations fail the build.
- Use Playwright to test view transitions and island hydration behavior end-to-end.
- Lighthouse CI: verify Performance ≥ 95, zero layout shift from images, zero unused JS.
- Test middleware by making requests to protected routes and verifying redirect/header behavior.
- Validate static output by checking `dist/` for expected HTML files and asset hashes.

## WAF Alignment

| Pillar | Implementation |
|---|---|
| **Performance Efficiency** | Islands Architecture ships zero JS by default, image optimization (WebP/AVIF), `client:visible` deferred hydration, static pre-rendering, hashed asset caching |
| **Reliability** | Content collection schema validation at build time, typed environment variables, `getStaticPaths` exhaustive path generation, middleware chain for consistent behavior |
| **Operational Excellence** | `astro check` in CI, structured file-based routing, content collections as single source of truth, standardized deployment adapters |
| **Security** | Server-only secrets via `astro:env`, security headers in middleware, remote image allowlists, no client-side secret exposure, CSRF-safe static pages |
