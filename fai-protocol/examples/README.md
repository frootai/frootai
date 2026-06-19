# FAI Protocol — Minimal Examples

> **10 minimal `fai-manifest.json` snippets, one per feature.** Copy-paste-ready. Each shows the smallest valid manifest demonstrating a single capability.
>
> **Validation:** every example here is checked by the conformance suite at [`../../conformance/`](../../conformance/) and the schema at [`../../schemas/fai-manifest.schema.json`](../../schemas/fai-manifest.schema.json).
>
> **Tracker:** P0.2.007 · **Authored:** 2026-05-22

| # | File | Demonstrates |
|---|---|---|
| 01 | [`01-minimal.fai-manifest.json`](./01-minimal.fai-manifest.json) | The absolute smallest valid manifest — 4 required fields only |
| 02 | [`02-with-instructions.fai-manifest.json`](./02-with-instructions.fai-manifest.json) | Adding behavioural instructions scoped by `applyTo` |
| 03 | [`03-with-skills.fai-manifest.json`](./03-with-skills.fai-manifest.json) | Wiring reusable skill folders |
| 04 | [`04-with-hooks.fai-manifest.json`](./04-with-hooks.fai-manifest.json) | Lifecycle hooks (sessionStart, sessionEnd, preToolUse) |
| 05 | [`05-with-guardrails.fai-manifest.json`](./05-with-guardrails.fai-manifest.json) | Inline quality thresholds (groundedness, coherence, safety, cost) |
| 06 | [`06-with-infrastructure.fai-manifest.json`](./06-with-infrastructure.fai-manifest.json) | IaC references (Bicep + Terraform + Docker) |
| 07 | [`07-with-toolkit.fai-manifest.json`](./07-with-toolkit.fai-manifest.json) | DevKit + TuneKit + SpecKit paths |
| 08 | [`08-with-catalog-paths.fai-manifest.json`](./08-with-catalog-paths.fai-manifest.json) | Mixing play-local (`./`) and catalog (`../../`) references |
| 09 | [`09-with-scope.fai-manifest.json`](./09-with-scope.fai-manifest.json) | Scoped context isolation for multi-tenant or vertical use |
| 10 | [`10-full.fai-manifest.json`](./10-full.fai-manifest.json) | The full picture — every section combined |

## How to use these

```bash
# Validate any example against the schema
npx ajv-cli validate \
  -s ../../schemas/fai-manifest.schema.json \
  -d ./01-minimal.fai-manifest.json

# Run all examples through the conformance suite
cd ../../
npm run test:conformance
```

## Authoring conventions

- Every example uses the `$schema` reference so editors give live validation.
- Every example uses real knowledge module IDs from the FROOT taxonomy (no placeholders).
- Path strings always start with `./` or `../../` — never bare.
- Comments are NOT included (JSON has no comments) — explanation is in this README + per-file commit messages.
