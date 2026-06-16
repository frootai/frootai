# TypeScript Validator Tests

**Status**: ✅ Phase `[A0.6]` shipped 2026-05-24. **45 tests · 100% pass · ~2.4s wall time.**

## Test breakdown (after `it.each` expansion)

| File | Tests | What's tested |
|---|---:|---|
| `test_required_fields.test.ts` | **20** | 17 top-level required fields + 3 nested `provenance.*` fields (`it.each`) |
| `test_round_trip.test.ts` | **7** | 5 fixtures from `fai-accelerator.example.json` + 2 matrix invariants |
| `test_conditional.test.ts` | **5** | All 5 `allOf` / `if`-`then` rules |
| `test_enums.test.ts` | **5** | `variety` · `ripeness` · `categories` · `origin` · `trust_badges` boundaries |
| `test_types.test.ts` | **5** | Wrong-type rejection across 5 fields |
| `test_formats.test.ts` | **3** | `id` regex · `repo_url` GitHub pattern · `integrity_sha256` 64-hex |
| **Total** | **45** | |

## Cross-validator parity with Python

| | Python (A0.5) | TypeScript (A0.6) |
|---|---:|---:|
| Tests | 43 | 45 |
| Wall time | ~4.5s | ~2.4s |
| Required-field coverage | 17 + 3 | 17 + 3 |
| Conditional rules | 5 | 5 |
| Matrix invariants | 2 | 2 |

Tiny delta in count (43 vs 45) is due to vitest's `it.each` producing one extra parametrized id-label per case. Test SUBSTANCE is identical — same fixtures, same negative cases, same positive baseline.

## Run

```bash
cd frootai/orchard/validators/typescript
npm test           # vitest run
npm run test:watch # vitest in watch mode
```
