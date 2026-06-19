# FAI Protocol Conformance Test Suite

[![FAI Protocol L0 conformance](./badge.svg)](https://github.com/frootai/frootai/tree/main/conformance)

> **The bar for "I implement FAI Protocol."** Any runtime claiming FAI conformance MUST pass these tests.
>
> **Suite version:** `conformance-v0.9-rc1` (matches spec [v0.9-rc1](../fai-protocol/README.md))
> **Tracker:** P0.2.010 (suite) · P1.2.008 (CLI runner) · P1.2.009 (badge) · **Authored:** 2026-05-22

---

## Status badge

The [`badge.svg`](./badge.svg) and [`badge-endpoint.json`](./badge-endpoint.json) files in this directory are **auto-regenerated** by [`.github/workflows/conformance-badge.yml`](../.github/workflows/conformance-badge.yml) on every push to `main` that touches the spec, schemas, or this suite. The workflow:

1. Runs `npm run test:conformance`
2. Runs `node conformance/generate-badge.js` (which re-runs L0 via the bundled lib + writes both artefacts)
3. Auto-commits any change with `[skip ci]` to avoid recursion

**Embed the badge:**

```markdown
[![FAI Protocol L0 conformance](https://raw.githubusercontent.com/frootai/frootai/main/conformance/badge.svg)](https://github.com/frootai/frootai/tree/main/conformance)
```

**Or via shields.io endpoint** (for full shields.io control over style + colour):

```markdown
[![FAI Protocol L0 conformance](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/frootai/frootai/main/conformance/badge-endpoint.json)](https://github.com/frootai/frootai/tree/main/conformance)
```

The endpoint JSON also carries audit-trail metadata (`fai.suite`, `fai.protocol`, `fai.elapsedMs`, `fai.generatedAt`) that shields.io ignores but humans/CI can read.

---

## Conformance levels

The spec defines 5 levels (§9.1). This suite ships **Level 0** = the foundational five tests every implementation must pass before claiming any level.

| Level | What it proves | Test file |
|---|---|---|
| **L0** | The basic five — parse + schema + paths + context + guardrails | This suite |
| L1 | Parser-only: parse manifest, validate schema | (planned v1.0) |
| L2 | Resolver: parser + resolve all paths to existing files | (planned v1.0) |
| L3 | Wirer: resolver + inject context into loaded primitives | (planned v1.0) |
| L4 | Evaluator: wirer + evaluate guardrails | (planned v1.0) |
| L5 | Full: evaluator + run hooks + MCP bridge | (planned v1.0) |

L0 is intentionally light so any third-party implementation can claim it in days, not months. L1–L5 will be released alongside v1.0 GA.

---

## How to run

```bash
# From the repo root — runs the 5 canonical scripts
npm run test:conformance

# Or via the bundled CLI (zero-dep, scans any directory)
npx fai conformance . --quiet
```

Both runners return exit code `0` on pass, non-zero on any failure. Each test prints `✅ PASS` or `❌ FAIL <reason>`.


In CI it's wired via the standard Node test convention — no extra runner needed.

---

## The 5 L0 tests

| # | File | What it tests |
|---|---|---|
| 01 | [`test-01-manifest-parse.js`](./test-01-manifest-parse.js) | Valid example manifests parse without error |
| 02 | [`test-02-schema-validation.js`](./test-02-schema-validation.js) | Every example validates against `fai-manifest.schema.json` |
| 03 | [`test-03-path-syntax.js`](./test-03-path-syntax.js) | All declared paths use the `./` or `../../` resolution rules from §5.1 |
| 04 | [`test-04-knowledge-ids.js`](./test-04-knowledge-ids.js) | All `context.knowledge` entries match known FROOT module IDs or the `X*` custom prefix |
| 05 | [`test-05-guardrail-ranges.js`](./test-05-guardrail-ranges.js) | All guardrail values fall in their declared ranges (groundedness 0–1, safety = 0, costPerQuery ≥ 0) |

A runtime that passes all 5 may publish:
> *"Conforms to FAI Protocol v0.9-rc1, Level 0 conformance suite (conformance-v0.9-rc1)."*

---

## Adding a new test

1. Create `test-NN-name.js` in this folder.
2. Use the same shape as the existing tests:
   - Read fixtures from `../fai-protocol/examples/` (the canonical examples).
   - Write checks against the schemas in `../schemas/`.
   - Emit `✅ PASS` / `❌ FAIL <reason>` for each fixture.
   - Track pass / fail counts, exit `process.exit(failCount > 0 ? 1 : 0)`.
3. Add the file to `index.js` (runs all in order).
4. Bump suite version in this README.

---

## What this is NOT

- Not a unit test framework. Use vitest/jest if you want assertions, parameterization, and fancy reporting in your own runtime.
- Not a benchmark. Performance characteristics are out of scope for L0.
- Not a security audit. Manifests with malicious content (e.g. path traversal) are tested at L1+ — L0 trusts the input is well-intentioned but possibly buggy.

---

## CHANGELOG

| Date | Suite version | Change |
|---|---|---|
| 2026-05-22 | `conformance-v0.9-rc1` | Initial L0 release with 5 tests against the v0.9-rc1 spec. |
