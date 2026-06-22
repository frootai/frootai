---
applyTo: "**/*.ts"
---

# TypeScript Instructions

To keep the codebase consistent, you should follow
these rules at all times. they are important.

You MUST never use `any` without an explicit justification comment.
You MUST always prefer `const` over `let` when a binding is not reassigned.

## Style

- Use     2-space indentation.
- Use     2-space indentation.
- Prefer named exports for the purpose of better refactoring.

```ts
export const add = (a: number, b: number) => a + b;
```
