---
name: fai-premium-frontend-ui
description: |
  Build premium frontend interfaces with modern design systems, animations,
  responsive layouts, and accessibility. Use when creating polished user
  experiences for AI applications.
---

# Premium Frontend UI

Build polished, accessible frontend interfaces for AI applications.

## When to Use

- Creating production UI for AI chat or dashboard apps
- Implementing design systems with consistent components
- Adding animations and micro-interactions
- Ensuring accessibility compliance (WCAG 2.1 AA)

---

## Chat Interface Component

```tsx
'use client';
import { useState, useRef, useEffect } from 'react';

export function ChatWidget() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const resp = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: input }),
    });
    const data = await resp.json();
    setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    setLoading(false);
  }

  return (
    <div className="flex flex-col h-[600px] w-full max-w-2xl mx-auto border rounded-xl">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`rounded-lg px-4 py-2 max-w-[80%] ${
              m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && <div className="animate-pulse text-gray-400">Thinking...</div>}
        <div ref={bottomRef} />
      </div>
      <div className="border-t p-4 flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask a question..."
          className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2"
          aria-label="Chat message input" />
        <button onClick={handleSend} disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700
                     disabled:opacity-50 transition-colors">
          Send
        </button>
      </div>
    </div>
  );
}
```

## Accessibility Checklist

| Check | Requirement |
|-------|-------------|
| Keyboard | All interactive elements focusable with Tab |
| ARIA labels | Inputs, buttons, and regions labeled |
| Color contrast | 4.5:1 ratio for text (WCAG AA) |
| Focus visible | Clear focus indicator on all elements |
| Screen reader | Content announced in logical order |
| Motion | Respect `prefers-reduced-motion` |

## Responsive Breakpoints

```css
/* Tailwind defaults */
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Laptop */
xl: 1280px  /* Desktop */
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Layout breaks on mobile | Fixed widths | Use flex/grid with responsive classes |
| Focus not visible | Default outline removed | Add focus:ring-2 classes |
| Screen reader skips content | Missing ARIA | Add aria-label and roles |
| Animation janky | Layout shifts | Use transform/opacity only |
