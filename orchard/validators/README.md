# Validators

**Status**: 🌱 Phase `[A0]` scaffolding.

Reference implementations of the Orchard schemas. Both **Apache-2.0** licensed (patent grant included; commercial use explicitly permitted).

## Layout

- [`python/`](./python/) — `[A0.5]` · uses `jsonschema` + `pytest` · ~30 tests
- [`typescript/`](./typescript/) — `[A0.6]` · uses `ajv` + `vitest` · ~30 tests

## Contract

Both validators MUST:

1. Validate `../schema/fai-accelerator.schema.json` against any input JSON
2. Validate `../schema/fai-manifest.schema.json` against any input JSON
3. Return a normalized error format (path · keyword · message · severity)
4. Pass identical fixture matrix (the **cross-validator contract test** in `[A6.27]`)

## Why both languages

- **Python** — server-side crawler (`frootai-core/scripts/orchard/validate.js` uses the Python validator as the canonical reference per `[A1.24]`)
- **TypeScript** — bundled into `@frootai/orchard` SDK + VS Code extension + browser runtime checks

Two implementations enforce a clean schema. If the schema is ambiguous, the validators diverge → caught by the cross-validator contract test.

---

*Phase `[A0.1]` placeholder.*
