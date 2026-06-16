# Registry

**Status**: ✅ Phase `[A0]` registry-folder complete — 4/4 files live (A0.7 ✅ · A0.8 ✅ · A0.9 ✅ · A0.26 ✅).

The community-editable surface of the Orchard. PR-driven, no admin UI. **CC0-1.0** so external orgs can fork without legal review.

## Files

| File | Purpose | Status |
|---|---|---|
| `seed-list.json` | **50 hand-seeded Azure Solution Accelerators** (top stars + strategic value) — bootstrap input for crawler discovery | ✅ `[A0.7]` 2026-05-24 |
| `pollinations.json` | **Accelerator ↔ Play link graph** (empty starter; first 50 manual edges land in `[A2.25]`; auto-suggested edges from `[A2.5]` onward) | ✅ `[A0.9]` 2026-05-25 |
| `discovery-queries.json` | **28 GitHub Search queries** (7 per Variety × azure/gcp/aws/oss) — the crawler's "where to look" config | ✅ `[A0.26]` 2026-05-25 |
| `overrides/<owner>__<repo>.json` | Per-fruit metadata overrides (deep-merged over harvested manifest) | ✅ `[A0.8]` README + first 5 entries in `[A2.24]` |

## `seed-list.json` shape

Flat JSON array. Each entry has 5 fields:

```jsonc
[
  {
    "full_name": "Azure-Samples/azure-search-openai-demo",  // <owner>/<repo>; passes regex ^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$
    "variety": "azure",                                      // azure | gcp | aws | oss
    "stars": 7665,                                           // snapshot at curation time; refreshed by harvest pipeline
    "first_party": true,                                     // owner is a recognized cloud vendor org
    "reason": "..."                                          // ≤200 chars; why this is a strong seed
  }
]
```

No `$schema` wrapper — the pipeline reads this as a list directly.

## Phase A0.7 seed list (50 entries) — distribution

| Owner | Count | Role |
|---|---:|---|
| `Azure-Samples` | 21 | Canonical demos + RAG references + agent samples |
| `microsoft-foundry` | 10 | Newest org — AI Foundry + MCP + workshops |
| `Azure` | 7 | Enterprise patterns + landing zones + azd CLI itself |
| `microsoft` | 6 | Cross-org AI samples (incl. `ai-agents-for-beginners`, 65k stars) |
| `MSUSAzureAccelerators` | 6 | Industry verticals: call-center, doc, insurance, supply-chain, finance |

| Star bucket | Count | Examples |
|---|---:|---|
| 10k+ | 1 | `microsoft/ai-agents-for-beginners` (65k) |
| 1k-10k | 8 | `azure-search-openai-demo` (7.6k) · `cognitive-services-speech-sdk` (3.4k) · `Generative-AI-for-beginners-dotnet` (2.7k) |
| 100-1k | 27 | The bulk: production-grade samples spanning RAG / agents / voice / docs / infra |
| <100 | 14 | Industry vertical accelerators + early-stage Foundry experiments — long-tail strategic seeds |

## Contribution flow

Every change is a PR. Doctrine line #1: **NO HAND-MAINTAINED FRUIT LISTS** — the seed list is the ONLY manual input; the rest of the catalog is crawler-derived from the GitHub Search API.

See [../CONTRIBUTING.md](../CONTRIBUTING.md) for the three contribution paths.

## How the crawler uses this

```
discover.js  → reads seed-list.json + discovery-queries.json  (Phase [A1.1]–[A1.4])
harvest.js   → fetches metadata for each candidate full_name  (Phase [A1.5]–[A1.10])
normalize.js → maps GitHub fields → fai-accelerator.json     (Phase [A1.11]–[A1.23])
enrich.js    → LLM enrichment (gpt-4o-mini)                    (Phase [A2.1]–[A2.8])
override.js  → merges files from overrides/<owner>__<repo>.json (Phase [A2.9]–[A2.11])
bundle.js    → groups + writes <variety>.json bundles          (Phase [A2.12]–[A2.17])
publish.js   → syncs to Azure Blob CDN + triggers ISR          (Phase [A2.18]–[A2.21])
```

---

*Phase `[A0.1]` placeholder.*
