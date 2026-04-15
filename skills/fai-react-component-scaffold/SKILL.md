---
name: fai-react-component-scaffold
description: |
  Scaffold React components with TypeScript, props interfaces, hooks patterns,
  and Storybook stories. Use when building reusable UI components for
  React applications.
---

# React Component Scaffold

Build typed React components with hooks, stories, and testing.

## When to Use

- Creating reusable UI components
- Setting up component libraries with Storybook
- Building form components with controlled state
- Writing component tests with React Testing Library

---

## Component Template

```tsx
import { useState, useCallback } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled = false, placeholder = "Type a message..." }: ChatInputProps) {
  const [value, setValue] = useState('');

  const handleSend = useCallback(() => {
    if (!value.trim()) return;
    onSend(value.trim());
    setValue('');
  }, [value, onSend]);

  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSend()}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 border rounded px-3 py-2"
        aria-label="Chat message"
      />
      <button onClick={handleSend} disabled={disabled || !value.trim()}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
        Send
      </button>
    </div>
  );
}
```

## Custom Hook

```tsx
import { useState, useCallback } from 'react';

interface UseChat {
  messages: Message[];
  sendMessage: (content: string) => Promise<void>;
  isLoading: boolean;
}

export function useChat(): UseChat {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (content: string) => {
    setMessages(prev => [...prev, { role: 'user', content }]);
    setIsLoading(true);
    try {
      const resp = await fetch('/api/chat', {
        method: 'POST', body: JSON.stringify({ message: content }),
      });
      const data = await resp.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { messages, sendMessage, isLoading };
}
```

## Test

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInput } from './ChatInput';

test('calls onSend with trimmed value', () => {
  const onSend = jest.fn();
  render(<ChatInput onSend={onSend} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '  hello  ' } });
  fireEvent.click(screen.getByText('Send'));
  expect(onSend).toHaveBeenCalledWith('hello');
});

test('disables send when empty', () => {
  render(<ChatInput onSend={jest.fn()} />);
  expect(screen.getByText('Send')).toBeDisabled();
});
```

## Storybook

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { ChatInput } from './ChatInput';

const meta: Meta<typeof ChatInput> = { component: ChatInput };
export default meta;

export const Default: StoryObj = { args: { onSend: console.log } };
export const Disabled: StoryObj = { args: { onSend: console.log, disabled: true } };
export const CustomPlaceholder: StoryObj = { args: { onSend: console.log, placeholder: "Ask AI..." } };
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Stale closure in callback | Missing dep in useCallback | Add all dependencies |
| Infinite re-render | Object/array in deps | Use useMemo for objects |
| Test can't find element | Wrong query | Use getByRole or getByLabelText |
| Component too complex | Too many responsibilities | Extract custom hooks |
