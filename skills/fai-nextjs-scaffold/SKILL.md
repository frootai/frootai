---
name: fai-nextjs-scaffold
description: |
  Scaffold Next.js applications with App Router, server components, API routes,
  and deployment configuration. Use when building React frontends with SSR,
  static export, or full-stack Next.js applications.
---

# Next.js Scaffold

Scaffold production Next.js apps with App Router, server components, and deployment.

## When to Use

- Building React frontends with server-side rendering
- Creating full-stack apps with API routes
- Setting up static export for Azure Static Web Apps
- Configuring Next.js with TypeScript and Tailwind

---

## Project Structure

```
my-app/
├── src/
│   ├── app/
│   │   ├── layout.tsx        # Root layout
│   │   ├── page.tsx          # Home page
│   │   ├── globals.css       # Global styles
│   │   └── api/
│   │       └── chat/
│   │           └── route.ts  # API route
│   ├── components/
│   │   ├── ui/               # Reusable UI components
│   │   └── chat-widget.tsx   # Feature component
│   └── lib/
│       └── openai.ts         # OpenAI client
├── public/                   # Static assets
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## App Router Page

```tsx
// src/app/page.tsx
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <h1 className="text-4xl font-bold">AI Chat</h1>
      <ChatWidget />
    </main>
  );
}
```

## API Route

```typescript
// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { message } = await req.json();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: message }],
  });
  return NextResponse.json({ reply: response.choices[0].message.content });
}
```

## Server Component with Data Fetching

```tsx
// src/app/dashboard/page.tsx
async function getData() {
  const res = await fetch('https://api.example.com/stats', { next: { revalidate: 60 } });
  return res.json();
}

export default async function Dashboard() {
  const data = await getData();
  return <div>{data.totalUsers} users</div>;
}
```

## Static Export Config

```typescript
// next.config.ts
const config = {
  output: 'export',          // Static HTML export
  images: { unoptimized: true }, // Required for static
  trailingSlash: true,
};
export default config;
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Hydration mismatch | Server/client content differs | Use `use client` for interactive components |
| API route 404 | Wrong file path | Must be `app/api/.../route.ts` |
| Static export fails | Using server features | Remove dynamic routes or use generateStaticParams |
| Build OOM | Large page count | Set NODE_OPTIONS=--max-old-space-size=4096 |
