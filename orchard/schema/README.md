# Schemas

**Status**: 🌱 Phase `[A0]` — 5/5 schema files live (A0.2 ✅ · A0.3 ✅ · A0.4 ✅ · A0.9 ✅ · A0.26 ✅ · A0.28 ✅). Schema folder complete.

## Files

| File | Purpose | Draft | License | Status |
|---|---|---|---|---|
| `fai-accelerator.schema.json` | JSON Schema for the Accelerator manifest (50 properties · 17 required · 5 conditional rules) | **2020-12** | **CC0-1.0** | ✅ `[A0.2]` 2026-05-24 |
| `fai-accelerator.example.json` | 5 validating example manifests covering the origin × variety matrix | n/a | CC0-1.0 | ✅ `[A0.3]` 2026-05-24 |
| `validate-examples.js` | Lightweight Ajv 2020-12 smoke test that validates every example against the schema | n/a | Apache-2.0 | ✅ `[A0.3]` 2026-05-24 |
| `fai-manifest.schema.json` | **Cross-reference copy** of the Solution Play schema (source of truth: `frootai/schemas/fai-manifest.schema.json`) | **draft-07** | Apache-2.0 | ✅ `[A0.4]` 2026-05-24 |
| `orchard-pollinations.schema.json` | JSON Schema for `../registry/pollinations.json` — the Accelerator ↔ Play edge graph (6 properties · 2 required · flat edge-list shape) | **2020-12** | **CC0-1.0** | ✅ `[A0.9]` 2026-05-25 |
| `orchard-discovery-queries.schema.json` | JSON Schema for `../registry/discovery-queries.json` — 28 GitHub Search queries (7 per Variety) | **2020-12** | **CC0-1.0** | ✅ `[A0.26]` 2026-05-25 |
| `orchard-seed-list.schema.json` | JSON Schema for `../registry/seed-list.json` — 50 hand-curated bootstrap seeds | **2020-12** | **CC0-1.0** | ✅ `[A0.28]` 2026-05-25 |

## Cross-reference policy (A0.4)

`fai-manifest.schema.json` is **byte-identical** (SHA-256 verified) to its source at [`frootai/schemas/fai-manifest.schema.json`](../../schemas/fai-manifest.schema.json). Source of truth lives in `frootai/schemas/` (used at runtime by the FAI Engine for all 101 existing Plays); the copy here exists so the validator + harvest pipeline + Orchard UI can resolve **both schemas from a single folder** during cross-pollination checks (e.g., `[A2.26]` doctrine: every Accelerator must reference a Play that exists in this Play schema's vocabulary).

A byte-identity CI check lands in `[A2.27]` (smoke pipeline) to prevent silent divergence.

## Mixed-draft note

The two schemas use different JSON Schema drafts:
- **Accelerator** (`fai-accelerator.schema.json`) → JSON Schema 2020-12 (latest)
- **Manifest** (`fai-manifest.schema.json`) → JSON Schema draft-07 (legacy, in production since 2025-09)

Both are valid; Ajv supports both via separate imports (`ajv/dist/2020` for 2020-12; default `ajv` for draft-07). The Python `jsonschema` library also supports both via `Draft202012Validator` and `Draft7Validator`. The two-validator implementations in `[A0.5]`/`[A0.6]` will provide both factories.

## Example matrix (5 fixtures)

The 5 examples in `fai-accelerator.example.json` deliberately cover every cell of the origin × variety matrix:

| # | id | variety | origin | What it proves |
|---|---|---|---|---|
| 1 | `azure-samples__azure-search-openai-demo` | azure | harvested | Canonical example (matches spec doc §1) |
| 2 | `googlecloudplatform__generative-ai` | gcp | harvested | Cross-cloud — schema works for GCP fruits |
| 3 | `aws-samples__amazon-bedrock-samples` | aws | harvested | AWS row of the matrix |
| 4 | `frootai__ai-foundry-rag-production` | azure | cultivated | Forward-proof — `composed_from[]` with 5 real AVM modules + integrity hashes |
| 5 | `frootai__solution-play-21-baseline-infra` | azure | first_party | Legacy hand-authored Play infra (the 3rd origin tier) |

## Run the smoke test

```bash
cd frootai
node orchard/schema/validate-examples.js
```

Expected output:
```
=== fai-accelerator examples — schema smoke test ===
Formats : ajv-formats loaded (uri + date-time enforced)
Count   : 5
---
PASS [1/5] azure-samples__azure-search-openai-demo ...
PASS [2/5] googlecloudplatform__generative-ai ...
PASS [3/5] aws-samples__amazon-bedrock-samples ...
PASS [4/5] frootai__ai-foundry-rag-production ...
PASS [5/5] frootai__solution-play-21-baseline-infra ...
---
Summary: 5 pass, 0 fail
```

The proper Python + TypeScript reference validators with ~30 tests each land in `[A0.5]` and `[A0.6]`.

## Public URLs (set in A0.25)

- `https://frootai.dev/schemas/fai-accelerator.v1.json`
- `https://frootai.dev/schemas/fai-manifest.v1.json`

## Spec

See `planning/fai-orchard-manifest-schema.md` for the full schema specification including §13 (Greenhouse provenance: `origin`, `composed_from[]`, `gold_iac`).

## Why CC0-1.0 for the Accelerator schema

The standards-bearer play: zero adoption friction. External orgs (Azure-Samples, GoogleCloudPlatform, aws-samples) can adopt without legal review. The commercial moat lives in the validators + cultivation skills, not the schema text.

## Public URLs (set in A0.25)

- `https://frootai.dev/schemas/fai-accelerator.v1.json`
- `https://frootai.dev/schemas/fai-manifest.v1.json`

## Spec

See `planning/fai-orchard-manifest-schema.md` for the full schema specification including §13 (Greenhouse provenance: `origin`, `composed_from[]`, `gold_iac`).

## Why CC0-1.0 for the Accelerator schema

The standards-bearer play: zero adoption friction. External orgs (Azure-Samples, GoogleCloudPlatform, aws-samples) can adopt without legal review. The commercial moat lives in the validators + cultivation skills, not the schema text.

---

*Phase `[A0.1]` placeholder.*
