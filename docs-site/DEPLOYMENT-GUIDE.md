# FrootAI Documentation Site — Deployment Guide

## Cloudflare Pages Setup for docs.frootai.dev

### Prerequisites
- Cloudflare account with `frootai.dev` domain
- 157 MDX documentation files in `.factory/docs/`

---

## Option A: Fumadocs (Next.js MDX) — Recommended

Fumadocs is a modern Next.js documentation framework that renders MDX files beautifully.

### Steps:

1. **Create the docs project:**
```bash
cd c:\CodeSpace
npx create-fumadocs-app docs.frootai.dev
# Select: Next.js, MDX, Tailwind
cd docs.frootai.dev
```

2. **Copy MDX content:**
```bash
xcopy "c:\CodeSpace\frootai\.factory\docs\*" "c:\CodeSpace\docs.frootai.dev\content\docs\" /s /e
```

3. **Configure (`fumadocs.config.ts`):**
```ts
export default defineConfig({
  dir: './content/docs',
  basePath: '/',
});
```

4. **Test locally:**
```bash
npm run dev
# Open http://localhost:3000
```

5. **Deploy to Cloudflare Pages:**
   - Go to → https://dash.cloudflare.com → Pages → Create a project
   - Connect to GitHub → select `frootai/docs.frootai.dev`
   - Build settings:
     - Framework: Next.js (Static Export)
     - Build command: `npx next build`
     - Output: `out`
   - Deploy

6. **Set custom domain:**
   - In Cloudflare Pages project → Custom domains → Add
   - Enter: `docs.frootai.dev`
   - Cloudflare auto-creates the CNAME record

---

## Option B: Starlight (Astro) — Lightweight Alternative

Starlight is Astro-based — faster builds, simpler setup, great for pure docs.

### Steps:

1. **Create project:**
```bash
npm create astro@latest -- --template starlight docs.frootai.dev
cd docs.frootai.dev
```

2. **Copy content:**
```bash
xcopy "c:\CodeSpace\frootai\.factory\docs\*" "src\content\docs\" /s /e
```

3. **Configure (`astro.config.mjs`):**
```js
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'FrootAI Docs',
      logo: { src: './src/assets/frootai-mark.png' },
      social: { github: 'https://github.com/frootai/frootai' },
      sidebar: [
        { label: 'Getting Started', items: [{ label: 'Quickstart', link: '/getting-started/' }] },
        { label: 'Concepts', autogenerate: { directory: 'concepts' } },
        { label: 'Learning', autogenerate: { directory: 'learning' } },
        { label: 'Guides', autogenerate: { directory: 'guides' } },
        { label: 'Solution Plays', autogenerate: { directory: 'solution-plays' } },
        { label: 'Primitives', autogenerate: { directory: 'primitives' } },
        { label: 'API Reference', autogenerate: { directory: 'api-reference' } },
      ],
      customCss: ['./src/styles/custom.css'],
    }),
  ],
});
```

4. **Deploy to Cloudflare:**
   - Same as Option A but build command: `npm run build`, output: `dist`

---

## Option C: Quick & Dirty — Static HTML (Today)

If you just want `docs.frootai.dev` live TODAY:

1. **In Cloudflare Dashboard:**
   - Go to → https://dash.cloudflare.com
   - Select your `frootai.dev` domain
   - DNS → Add Record:
     - Type: CNAME
     - Name: docs
     - Target: frootai.github.io (or your Cloudflare Pages URL)
   
2. **Use Cloudflare Pages redirect** (temporary):
   - Create a simple `_redirects` file:
     ```
     / https://frootai.dev/docs 301
     ```
   - This redirects docs.frootai.dev → frootai.dev/docs until full docs site is ready

---

## Cloudflare DNS Configuration

Regardless of which option you choose, you need this DNS record:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | docs | `docs-frootai-dev.pages.dev` | ✅ Proxied |

This is auto-created when you add `docs.frootai.dev` as a custom domain in Cloudflare Pages.

---

## Content Stats (from .factory/docs/)

| Section | Files | Topics |
|---------|-------|--------|
| Getting Started | 1 | Quickstart guide |
| Concepts | 3 | FAI Protocol, Primitives, WAF |
| Learning | 16 | F1-F4, R1-R3, O1-O6, T1-T3 |
| Guides | 5 | Deploy, Agents, Migration, Enterprise, Troubleshooting |
| Solution Plays | 105 | All 104 plays + index |
| Primitives | 6 | Agents, Skills, Instructions, Hooks, Plugins, Workflows |
| API Reference | 4 | MCP Tools, CLI, Schemas, index |
| Specialties | 12 | Memory, Context, Sessions, Reasoning, etc. |
| **Total** | **157 MDX files** | |
