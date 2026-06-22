---
description: "Next.js 16 App Router standards — Server Components by default, streaming with Suspense, Turbopack, Tailwind v4, static export for FAI.dev, and production optimization patterns."
applyTo: "**/*.tsx, **/*.ts, **/*.jsx, **/next.config.*"
waf:
  - "performance-efficiency"
  - "security"
  - "reliability"
---

# Next.js — FAI Standards

## App Router Architecture

Use the `app/` directory exclusively. Every file inside `app/` is a **Server Component** by default — no hydration cost, direct `async/await` data fetching, zero client JS shipped.

```tsx
// app/plays/[id]/page.tsx — Server Component (default)
import { notFound } from "next/navigation";

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return { title: `Play ${id} — FAI`, openGraph: { title: `Solution Play ${id}` } };
}

export default async function PlayPage({ params }: Props) {
  const { id } = await params;
  const play = await getPlay(id);
  if (!play) notFound();
  return <article><h1>{play.title}</h1><p>{play.summary}</p></article>;
}
```

Add `'use client'` only for interactive leaves: event handlers, `useState`, `useEffect`, browser APIs. Push it to the smallest component possible — never on layout or page files unless unavoidable.

## File Conventions

| File | Purpose |
|------|---------|
| `layout.tsx` | Persistent shell — wraps children, never re-renders on navigation |
| `page.tsx` | Unique route UI — must `export default` a component |
| `loading.tsx` | Instant loading skeleton via automatic `<Suspense>` boundary |
| `error.tsx` | Error boundary — must be `'use client'`, receives `reset()` prop |
| `not-found.tsx` | 404 UI — triggered by `notFound()` or missing dynamic segments |
| `route.ts` | API endpoint — export `GET`, `POST`, `PUT`, `DELETE` functions |

```tsx
// app/api/plays/route.ts — Route Handler
import { NextRequest, NextResponse } from "next/server";
export async function GET(request: NextRequest) {
  const plays = await searchPlays(request.nextUrl.searchParams.get("q") ?? "");
  return NextResponse.json(plays, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
```

## Server Actions

Mutate data without API routes. Define with `'use server'` at function or file level.

```tsx
"use server";
import { revalidateTag } from "next/cache";
export async function submitFeedback(formData: FormData) {
  const rating = Number(formData.get("rating"));
  if (rating < 1 || rating > 5) throw new Error("Invalid rating");
  await db.feedback.create({ data: { rating, playId: String(formData.get("playId")) } });
  revalidateTag("feedback");
}
```

## Streaming & Suspense

Wrap slow async components in `<Suspense>` to stream HTML progressively:

```tsx
import { Suspense } from "react";
export default function Dashboard() {
  return <Suspense fallback={<p>Loading…</p>}><AsyncMetrics /></Suspense>;
}
async function AsyncMetrics() {
  const metrics = await fetch("/api/metrics", { next: { revalidate: 60 } }).then(r => r.json());
  return <pre>{JSON.stringify(metrics, null, 2)}</pre>;
}
```

## Caching & Revalidation

- **`fetch` cache**: Auto-deduped in Server Components. `{ next: { revalidate: N } }` for ISR, `{ cache: "no-store" }` for dynamic.
- **`revalidateTag(tag)`** / **`revalidatePath(path)`**: On-demand invalidation from Server Actions or Route Handlers.
- **`unstable_cache(fn, keys, { revalidate, tags })`**: Cache arbitrary async functions (DB queries, computations).
- **Static export**: `output: "export"` in `next.config.ts` — pre-renders at build time, zero server costs. Requires `images: { unoptimized: true }`.

## Parallel & Intercepting Routes

- **Parallel routes** (`@folder`): Render multiple pages in same layout — dashboards, modals alongside content.
- **Intercepting routes** (`(.)folder`): Show route in modal while preserving URL for direct access.

## Image & Font Optimization

```tsx
import Image from "next/image";
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"], display: "swap" });
// Images: always set width/height or fill — prevents CLS
<Image src="/hero.webp" alt="Contoso" width={1200} height={630} priority />
// Fonts: apply in layout via <body className={inter.className}>
```

## Middleware

Runs at the edge before every request. Use for auth guards, redirects, geo-routing — never heavy computation.

```ts
// middleware.ts (project root)
import { NextResponse, type NextRequest } from "next/server";
export function middleware(request: NextRequest) {
  if (!request.cookies.get("session")?.value && request.nextUrl.pathname.startsWith("/dashboard"))
    return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}
export const config = { matcher: ["/dashboard/:path*"] };
```

## Environment Variables

- `NEXT_PUBLIC_*` — exposed to client bundles (analytics IDs, public URLs). Never put secrets here.
- Server-only vars — use `process.env.SECRET_KEY` in Server Components, Route Handlers, middleware.
- Validate at build: fail fast on missing required vars.

## Anti-Patterns

| Anti-Pattern | Fix |
|---|---|
| `'use client'` on page/layout | Extract interactive parts into leaf client components |
| `useEffect` for data fetching | Use async Server Components or `useSWR` in client components |
| `getServerSideProps` / `getStaticProps` | These are Pages Router — use `async` page components + `fetch` cache options |
| `next/router` | Use `next/navigation` (`useRouter`, `usePathname`, `useSearchParams`) |
| `<img>` tag | Use `next/image` for automatic WebP/AVIF, lazy loading, CLS prevention |
| Barrel exports (`index.ts` re-exporting all) | Causes tree-shaking failures — import directly from source |
| `fetch` in `useEffect` without abort | Use Server Component or add `AbortController` |
| Secrets in `NEXT_PUBLIC_*` vars | Only public values — API keys go in server-only env vars + Key Vault |

## WAF Alignment

| Pillar | Practice |
|--------|----------|
| **Performance** | Server Components (zero client JS), streaming, `next/image` (WebP/AVIF), `next/font` (no layout shift), Turbopack for dev (`next dev --turbopack`) |
| **Security** | Server-only secrets via `process.env`, middleware auth guards, CSP headers in `next.config.ts`, never expose DB connections to client |
| **Reliability** | `error.tsx` boundaries per route, `loading.tsx` skeletons, `notFound()` for missing data, graceful `Suspense` fallbacks |
| **Cost** | Static export where possible (zero server costs), ISR for semi-dynamic pages, edge middleware (cheaper than full server) |
| **Operational Excellence** | `generateMetadata()` for SEO, structured `app/` directory, `next build` output analysis, Turbopack for fast iteration |
