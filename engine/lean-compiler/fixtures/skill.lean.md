---
name: example-skill
description: A representative SKILL.md fixture for the Lean Compiler golden tests. USE FOR exercising prose/table/example/behaviour compression end-to-end.
---

# Example Skill

This skill exists to demonstrate the Lean
Compiler. it is a verbose document that has many
filler phrases, which the prose compressor should remove.

## When to use

USE FOR compressing a Full primitive into its Lean variant.
DO NOT USE FOR rewriting behaviour-bearing instructions.

You MUST never drop a guardrail, and you MUST never alter a parameter.

## Steps

- Run     the compiler on the source file.
- Run     the compiler on the source file.
- Configure the `--type` flag when the heuristic guesses wrong.

## Reference

| stage | role | compresses |
| --- | --- | --- |
| prose | PROSE | yes |
| example | EXAMPLE | yes |
| guardrail | GUARDRAIL | no |

## Example

```ts
const out = compile(md);

console.log(out.stats.saved);
```

See <https://frootai.dev> for the full docs.
