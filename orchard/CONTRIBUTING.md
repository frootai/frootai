# Contributing to the FAI Orchard

**Status**: ✅ Phase `[A0.11]` shipped 2026-05-25. Canonical contribution guide.

> *Three paths in, no admin UI, every change auditable. The Orchard stays accurate because every wrong field has a 60-second fix path — not because curators police it.*

---

## TL;DR — pick your path

| If you want to... | Use this path | File you touch | Time to live |
|---|---|---|---|
| Add an Accelerator the Orchard doesn't know about yet | 🌱 **Seed** | [`registry/seed-list.json`](./registry/seed-list.json) | ~24h (next nightly cron) |
| Fix a wrong field on an Accelerator already in the catalog | 🍂 **Override** | [`registry/overrides/<owner>__<repo>.json`](./registry/overrides/) | ~24h (next nightly cron) |
| Link an Accelerator to a Solution Play | 🔗 **Pollinate** | [`registry/pollinations.json`](./registry/pollinations.json) | ~24h (next nightly cron) |
| Suggest a schema change (new field, new enum value, ...) | 📐 **Schema PR** | [`schema/fai-accelerator.schema.json`](./schema/fai-accelerator.schema.json) | Reviewed weekly; bumps schema version |
| Improve the docs / a validator / this CONTRIBUTING | 📝 **Regular PR** | The file in question | Reviewed on merge |

Every path is **a single PR**. No issues required first. CODEOWNER review is enough.

---

## 1. 🌱 Seed a new Accelerator

When the harvest pipeline doesn't know about a repo yet, add it to the bootstrap list.

### Required fields

```jsonc
{
  "full_name": "Azure-Samples/my-new-accelerator",  // <owner>/<repo>, case preserved from GitHub
  "variety": "azure",                                // azure | gcp | aws | oss | hybrid
  "stars": 142,                                      // current star count (snapshot; refreshed by pipeline)
  "first_party": true,                               // true if owner is a recognized cloud-vendor org
  "reason": "One-line ≤200 chars: why this is a strong seed for the Orchard."
}
```

### Step-by-step

1. **Fork** [`frootai/frootai`](https://github.com/frootai/frootai)
2. **Append your entry** to `orchard/registry/seed-list.json` (array of objects; keep it valid JSON)
3. **Validate locally** (optional):
   ```bash
   cd frootai
   node -e "JSON.parse(require('fs').readFileSync('orchard/registry/seed-list.json'))" && echo OK
   ```
4. **PR title**: `[orchard:seed] <owner>/<repo>: <one-line summary>`
5. **CI runs**: JSON parseability + dedupe check + `full_name` regex check
6. **CODEOWNER reviews** (per `.github/CODEOWNERS`; reviewer of `orchard/registry/`)
7. **Merge → next nightly cron at 02:00 UTC picks it up**
8. **Verify** at `https://frootai.dev/orchard/<variety>/<slug>` within 24h of merge

### What makes a good seed

| ✅ Good seed | ❌ Weak seed |
|---|---|
| Microsoft-official or major-cloud-vendor repo | Personal experiment with <20 stars and no commits in 12 months |
| Has a meaningful README + tech stack | Empty repo or a single notebook |
| Maps to one of the 19 schema categories | Generic infrastructure with no AI angle |
| `reason` cites the specific pattern (e.g., "GraphRAG topology", "voice-realtime") | `reason` says "looks cool" |
| Owner is in the recognized first-party list **OR** has 500+ stars | Anonymous fork of a Microsoft repo |

### When NOT to seed

- The crawler will discover the repo via `discovery-queries.json` (Phase `[A0.26]`) — your seed is redundant. Check the live catalog first.
- The repo is archived AND not the canonical reference for a pattern. Archived repos for novel patterns (e.g., `graphrag-accelerator`) are still seeded; archived hello-worlds are not.
- The repo isn't `first_party` AND has <100 stars. Community discovery via search queries will find it organically.

---

## 2. 🍂 Override an existing Accelerator's metadata

When the auto-harvested manifest gets a field wrong, override it. The pipeline auto-classifies via gpt-4o-mini and gets ~85–92% of fields right; this is how you close the gap.

### File path

```
orchard/registry/overrides/<owner>__<repo>.json
```

Lowercase, double-underscore separator (matches the fruit's `id` field).

### Required fields

```jsonc
{
  "id": "azure-samples__azure-search-openai-demo",   // must match target Accelerator's id
  "overrides": {
    "tagline": "Production-grade RAG with hybrid + vector search on Azure AI Search",
    "categories": ["rag", "search", "chat"],
    "froot_layer": "R",
    "cost_band": "$150-600/mo"
    // ANY field from fai-accelerator.schema.json — except the 5 locked fields (see overrides/README.md §3)
  },
  "reason": "Verified deployment costs over 3 months at <company>; original cost-band auto-estimate was 30% high.",
  "submitted_by": "github:your-username",
  "reviewed_by": "@pavle"
}
```

### Step-by-step

1. **Fork** and **create** the override file at `orchard/registry/overrides/<id>.json`
2. **Validate locally** (the `overrides.*` fragment should be schema-valid in isolation):
   ```bash
   cd frootai/orchard/validators/python
   python -c "
   from frootai_orchard import validate
   import json
   payload = json.load(open('../../registry/overrides/<id>.json'))['overrides']
   r = validate('../../schema/fai-accelerator.schema.json', payload)
   print('OK' if r.ok else r.errors)
   "
   ```
3. **PR title**: `[orchard:override] <owner>/<repo>: <one-line summary>`
4. **CI runs**: schema validation + locked-field check + reason length cap (≤500 chars) + valid SPDX license check
5. **CODEOWNER reviews** — at least one CODEOWNER from `orchard/registry/overrides/` must approve. Self-review is not allowed.
6. **Merge → next nightly cron picks it up**
7. **Audit trail**: your override file path lands in the published manifest's `provenance.overrides_applied[]`

### Deep-merge semantics (the rule that bites)

- **Scalars** replace (`tagline: "new"` overwrites)
- **Arrays replace wholesale** (no concat — to add one badge, list ALL badges)
- **Objects deep-merge key-by-key** (`cost_estimate: { monthly_prod_low: 150 }` only changes that one field; others preserved)
- **`null`** sets the field to null
- **Missing keys** untouched

Full rules + worked examples in [`registry/overrides/README.md`](./registry/overrides/README.md).

### Locked fields (CANNOT override)

Five fields are rejected at PR review:

| Locked field | Why |
|---|---|
| `id` | Filename already encodes it |
| `schema_version` | Pipeline-controlled |
| `origin` | Tracks how the Accelerator entered (harvested/cultivated/first_party); overriding would forge provenance |
| `provenance.*` | Audit trail; the pipeline owns this entirely |
| `composed_from[]` | For cultivated Accelerators only; set by FAI Greenhouse, never by humans |

---

## 3. 🔗 Add a pollination (Accelerator ↔ Play link)

When an Accelerator is a baseline / extension / alternative / pattern / infra for a Solution Play, add the edge.

### Required fields

```jsonc
{
  "accelerator_id": "azure-samples__azure-search-openai-demo",
  "play_id": "01",                       // 2-3 digit Play ID
  "play_slug": "01-enterprise-rag",      // optional but recommended
  "relation": "baseline",                // baseline | extends_to | alternative | uses_pattern | provides_infra
  "confidence": 0.95,                    // 0.0–1.0
  "reason": "Same RAG topology, simpler than Play 01 but excellent Bicep + azd starter.",
  "source": "manual",                    // auto | manual | community_pr (use community_pr for community contributions)
  "added_at": "2026-05-25T14:32:00Z",
  "added_by": "github:your-username"
}
```

### Step-by-step

1. **Fork** the repo
2. **Append your edge** to the `edges` array in `orchard/registry/pollinations.json`
3. **Validate locally**:
   ```bash
   cd frootai
   node orchard/schema/validate-examples.js   # extends to also validate pollinations.json in a future patch
   # Or one-off:
   node -e "
   const Ajv = require('ajv/dist/2020').default;
   const fs = require('fs');
   const schema = JSON.parse(fs.readFileSync('orchard/schema/orchard-pollinations.schema.json'));
   const data = JSON.parse(fs.readFileSync('orchard/registry/pollinations.json'));
   const ajv = new Ajv({strict: false, allErrors: true});
   require('ajv-formats')(ajv);
   const v = ajv.compile(schema);
   console.log(v(data) ? 'OK' : v.errors);
   "
   ```
4. **PR title**: `[orchard:pollinate] <accelerator_id> → Play <play_id>: <relation>`
5. **CI runs**: schema validation + accelerator_id existence check (must point at a real Accelerator) + play_id existence check (must point at a real Solution Play)
6. **CODEOWNER reviews**
7. **Merge → next nightly cron picks it up; visible on both the Accelerator detail page and the Play detail page**

### Choosing the right `relation`

| Relation | Use when |
|---|---|
| `baseline` | The Accelerator is a simpler, working starter for the Play's pattern |
| `extends_to` | The Play builds agentic / multi-modal / advanced reasoning on top of the Accelerator |
| `alternative` | Same outcome, different stack (e.g., AWS Bedrock RAG is an `alternative` to Azure RAG Play) |
| `uses_pattern` | Shares architectural pattern but not topology (e.g., both use multi-agent orchestration) |
| `provides_infra` | The Accelerator IS the infrastructure layer for the Play (typically `origin: cultivated` from FAI Greenhouse) |

### `confidence` thresholds (encoded in the schema)

| Range | Meaning |
|---|---|
| 1.0 | Manually verified by FrootAI |
| 0.95+ | LLM with explicit reasoning |
| 0.7–0.95 | LLM auto-suggest |
| <0.7 | **Rejected at bundle time** — won't ship to CDN |

For community PRs, use a confidence you can defend in the `reason` field.

---

## 4. Schema PRs

If a field is missing, an enum value is too narrow, or a regex needs adjustment — PR the schema directly.

### Steps

1. PR `orchard/schema/fai-accelerator.schema.json` (or one of the other schemas)
2. **Bump the schema version**:
   - **Patch** (1.0.0 → 1.0.1): clarifications, new categories[] vocab, new trust_badges. Backwards compatible.
   - **Minor** (1.0.x → 1.1.0): new optional fields. Backwards compatible.
   - **Major** (1.x → 2.0.0): breaking changes to required fields. Old manifests stay on v1 until re-harvested; CDN serves both `/v1/` and `/v2/` for 6 months.
3. **Update the validators' fixture matrix** to cover the new shape (Python `tests/` + TypeScript `tests/`)
4. **Update the example file** if the new field is required
5. **PR title**: `[orchard:schema] vX.Y.Z: <one-line summary>`
6. **CI runs**: schema meta-validation + all validator tests + breaking-change detector
7. **CODEOWNER review**: at least 2 CODEOWNERS for minor/major, 1 for patch
8. Schema PRs ship on a **weekly cadence** (vs nightly for the other 3 paths) — reduces churn for downstream consumers

---

## 5. CODEOWNERS & review

Per [`frootai/.github/CODEOWNERS`](../.github/CODEOWNERS) (path-prefix precedence — most-specific wins):

```
/orchard/                           @frootai/core @frootai/community
/orchard/schema/                    @frootai/core @frootai/protocol
/orchard/validators/                @frootai/core @frootai/distribution
/orchard/registry/                  @frootai/core @frootai/community
/orchard/registry/overrides/        @frootai/core @frootai/community
```

Teams are GitHub team handles — not individual usernames. As FrootAI grows, team membership changes without touching this file. Why each team:

| Team | Why it reviews here |
|---|---|
| `@frootai/core` | Default reviewer on every PR (top-level `*` rule + every Orchard rule) — the founder + co-founders |
| `@frootai/protocol` | Owns schema evolution; reviews `orchard/schema/` alongside `/schemas/` and `/fai-protocol/` |
| `@frootai/distribution` | Owns the npm + PyPI + MCP publishing pipeline; reviews `orchard/validators/` since they ship as `@frootai/orchard` (npm) and `frootai-orchard` (PyPI) |
| `@frootai/community` | Lower-friction reviewer for catalog-data PRs (seed / override / pollinate) |

### Review SLAs (target)

| Path | SLA |
|---|---|
| Seed | 48 hours |
| Override | 48 hours |
| Pollination | 48 hours |
| Schema PR | 7 days (weekly review cadence) |

### How disputes are resolved

1. **Discussion in PR comments** — most disagreements resolve here
2. **Escalation to a second CODEOWNER** — if the first reviewer and the contributor disagree
3. **Founder decision** — `@pavle` makes the final call on contested PRs (small project, single founder; this will be a council in Phase A10+)
4. **Doctrine override** — if a PR conflicts with one of the 9 bright lines in master plan §0.5, the doctrine wins by default; reversing this requires a doctrine PR with strong justification

### How to become a CODEOWNER

Merit-based:
- Ship 5+ approved contributions across multiple paths
- Review (and have your reviews accepted) on 3+ other contributors' PRs
- Demonstrate doctrine alignment (no PRs trying to bypass the 9 bright lines)

Open an issue titled `[orchard:codeowner] Apply for CODEOWNER on <path>` — current CODEOWNERS review track record + vote.

---

## 6. License & legal

| What | License | What you can do |
|---|---|---|
| **Schemas** (`schema/*.json`) | **CC0-1.0** | Use, fork, adopt, embed in your own products, no attribution required |
| **Registry data** (`registry/*.json`) | **CC0-1.0** | Same — including `seed-list.json`, `pollinations.json`, and `overrides/*.json` |
| **Validators** (`validators/python/`, `validators/typescript/`) | **Apache-2.0** | Commercial use OK; patent grant included; no rug-pull possible (cf. HashiCorp BSL lesson) |
| **Documentation** (`README.md`, `CONTRIBUTING.md`, schema READMEs) | **CC-BY-4.0** | Attribute FrootAI when redistributing |

By submitting a PR you confirm you have the right to license your contribution under the file's declared license, and that the contribution does not violate any third-party rights.

There is no CLA — git's `Signed-off-by` (DCO) is sufficient. Use `git commit -s`.

---

## 7. Code of Conduct

This folder inherits [`frootai/CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) (Contributor Covenant v2.1).

Short version: be kind, assume good faith, name behavior not people, escalate to `@pavle` if needed.

---

## 8. Doctrine — the 9 bright lines

From [`planning/fai-orchard-masterplan.md`](../../planning/fai-orchard-masterplan.md) §0.5. A PR that violates a doctrine line is rejected by default; reversing a doctrine line requires its own PR.

1. **Schema is public domain.** Schemas use CC0-1.0; no contributor can change this without a doctrine PR.
2. **Crawler is server-side only.** No client-side scraping; nightly cron is the only ingestion path.
3. **NO SILENT ENRICHMENT.** Every LLM-touched field stamps `provenance.enriched_by[]`.
4. **NO HAND-MAINTAINED FRUIT LISTS.** Every Accelerator enters via the harvest pipeline; seed-list is the only manual input.
5. **POLLINATIONS ARE PRs.** Never admin UI clicks.
6. **Cost ledger is mandatory.** Every LLM invocation is metered and recorded.
7. **Refund-first policy.** (Applies to paid Plays, not this folder.)
8. **No dark patterns.** No fake scarcity, no manipulation in any surface that touches this catalog.
9. **NO GOLD BICEP.** Builder agents never write raw Bicep/Terraform when a verified module exists.

---

## 9. Anti-patterns we'll reject

Some PRs we'll close on sight (politely, with explanation):

- **Bulk re-classification PRs** without per-fruit reasoning. If you want to re-classify 50 fruits, fix the classifier in `enrich.js` instead.
- **Adding categories/badges/enums to the schema to fit one fruit.** The schema vocabulary serves the whole catalog; if one fruit needs a custom badge, override the existing fields.
- **Adding required fields without migration.** Required-field additions are breaking changes; bump major version + document migration.
- **`gold_iac: true` without `gold_iac_reason`.** Doctrine line 9; the escape valve requires explicit justification tracked in CI.
- **Self-referential overrides** (overriding a field to claim the same value the auto-pipeline already produced). Wastes review time.
- **Polished marketing taglines in `reason` fields.** Reasons are technical justifications, not pitches.

---

## 10. Cross-references

- [`README.md`](./README.md) — Orchard overview, status, "Try it today" actions
- [`schema/README.md`](./schema/README.md) — schema file inventory
- [`validators/README.md`](./validators/README.md) — Python + TypeScript validator overview
- [`registry/README.md`](./registry/README.md) — registry file shapes + crawler-flow diagram
- [`registry/overrides/README.md`](./registry/overrides/README.md) — full deep-merge semantics + FAQ
- `planning/fai-orchard-masterplan.md` — 12 phases × 30 sub-phases · 9 doctrines · 11 moats
- `planning/fai-orchard-manifest-schema.md` — full field-by-field schema specification

---

*The catalog stays accurate not because we curate it but because every wrong field has a 60-second fix path. Help us keep that promise.*
