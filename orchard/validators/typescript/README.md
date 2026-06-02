# TypeScript Validator (`@frootai/orchard`)

**Status**: ✅ Phase `[A0.6]` shipped 2026-05-24. **45/45 tests pass** in 2.35s on Node 22 + vitest 2.1.

## Layout (live)

```
typescript/
├── README.md                    (this file)
├── package.json                 (Apache-2.0; deps: ajv, ajv-formats, vitest, typescript)
├── tsconfig.json                (ES2022 / ESNext / strict / noUncheckedIndexedAccess)
├── src/
│   ├── index.ts                 (re-exports validate, Result, ValidationError)
│   ├── errors.ts                (ValidationError + Result interfaces)
│   └── validator.ts             (validate() + draft auto-selection)
└── tests/
    ├── _fixtures.ts             (shared fixtures: schemas + examples + deep-clone helpers)
    ├── test_conditional.test.ts (5 tests — the 5 allOf/if-then rules)
    ├── test_enums.test.ts       (5 tests — sealed-enum violations)
    ├── test_formats.test.ts     (3 tests — regex + sha256 pattern)
    ├── test_required_fields.test.ts (20 tests — 17 top-level + 3 nested provenance)
    ├── test_round_trip.test.ts  (7 tests — 5 examples + 2 matrix invariants)
    └── test_types.test.ts       (5 tests — wrong-type rejection)
```

## Install + run

```bash
cd frootai/orchard/validators/typescript
npm install
npm test          # vitest run — 45/45 in ~2.4s
npm run build     # tsc — emits dist/ for publish
```

## Public API

```ts
import { validate, type Result, type ValidationError } from '@frootai/orchard';

const result = validate(schema, payload);
//      ^ Result { ok: boolean; errors: readonly ValidationError[] }

if (result.ok) {
  console.log('OK');
} else {
  for (const err of result.errors) {
    console.log(`${err.path}  ${err.keyword}  ${err.message}`);
  }
}
```

`schema` can be a parsed JSON object OR a filesystem path string to a `.json` file.

## Draft auto-selection

Mirror of the Python validator. `validate()` reads the schema's `$schema` field and picks the right Ajv class:

| `$schema` value | Class used |
|---|---|
| `https://json-schema.org/draft/2020-12/schema` | `Ajv2020` (Accelerator schema) |
| `http://json-schema.org/draft-07/schema#` (or without hash) | `Ajv` (Manifest schema) |
| anything else | `Ajv` (draft-07 compatible) |

Format checks (`uri`, `date-time`, ...) are always enabled via `ajv-formats`.

## Error-format contract

Every error is a `ValidationError` with:

```ts
interface ValidationError {
  path: string;            // JSON Pointer ("<root>" at top level)
  keyword: string;         // JSON Schema keyword that failed
  message: string;         // Human-readable
  severity: 'error' | 'warning';
  params: {
    ajv_params: unknown;   // Ajv's raw params (shape depends on keyword)
    schema_path: string;   // JSON Pointer into the schema
  };
}
```

Cross-validator contract with Python (`[A6.27]`): `path` / `keyword` / `message` / `severity` are field-for-field equal. `params` is implementation-specific (Python wraps `validator_value`; TS wraps `ajv_params`) but both expose the underlying validator's keyword-specific data plus `schema_path`.

## What this validator is used by

- **Phase `[A5]`** — VS Code extension manifest preview
- **Phase `[A6]`** — `@frootai/orchard` SDK uses this as its validation core
- **Phase `[A6.27]`** — cross-validator contract test (compares this output to the Python validator's output)
- **Phase `[A7]`** — MCP server `orchard.validate` tool
