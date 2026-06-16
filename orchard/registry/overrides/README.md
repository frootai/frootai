# Overrides

**Status**: ✅ Phase `[A0.8]` shipped 2026-05-24. Full PR-flow documentation.

> *Community-submitted metadata corrections that deep-merge over auto-harvested manifests. The mechanism that keeps the Orchard accurate without becoming a curated catalog.*

---

## 1. Purpose

The harvest pipeline (Phases `[A1]` + `[A2]`) auto-generates a manifest for every Accelerator by reading GitHub metadata + LLM-classifying via gpt-4o-mini. The auto-pipeline gets ~85–92% of fields right. The remaining 8–15% need human correction.

**Overrides are how that correction happens.** Drop a JSON file here, open a PR, get it merged → the field is fixed on the next nightly cron run (within ~24h).

This is the **community editing surface** of the Orchard. It is intentionally:

- **PR-driven** — no admin UI, no logged-in editors, no curators-of-curators. Doctrine line #1 (NO HAND-MAINTAINED FRUIT LISTS).
- **File-per-fruit** — one accelerator's overrides live in one file, named by the fruit's `id`.
- **Auditable** — every override stamps `provenance.overrides_applied[]` so anyone can see what was changed and why.
- **Reversible** — delete the file → next cron run returns the fruit to its auto-harvested state.

---

## 2. File naming

```
overrides/<owner>__<repo>.json
```

The filename MUST match the fruit's canonical `id` (lowercase, double-underscore separator). Examples:

| GitHub repo | Filename |
|---|---|
| `Azure-Samples/azure-search-openai-demo` | `azure-samples__azure-search-openai-demo.json` |
| `microsoft/ai-agents-for-beginners` | `microsoft__ai-agents-for-beginners.json` |
| `GoogleCloudPlatform/generative-ai` | `googlecloudplatform__generative-ai.json` |

The pipeline (`override.js`, Phase `[A2.9]`) loads the file by computing the expected filename from each accelerator's `id` field. If a filename doesn't match a real fruit `id`, it's logged as a warning and ignored — no errors.

---

## 3. File shape

Override files are **descriptor objects**, not full manifests. The shape:

```jsonc
{
  // REQUIRED — must match the target fruit's id field
  "id": "azure-samples__azure-search-openai-demo",

  // REQUIRED — partial fai-accelerator.json fragment that deep-merges over the auto-harvested manifest
  "overrides": {
    "tagline": "Production-grade RAG with hybrid + vector search on Azure AI Search",
    "categories": ["rag", "search", "chat"],
    "froot_layer": "R",
    "cost_band": "$150-600/mo",
    "trust_badges": ["microsoft_official", "azd_template", "production_ready", "eval_proven"]
  },

  // REQUIRED — human-readable justification (≤500 chars)
  "reason": "Verified deployment costs over 3 months at <company>; original cost-band auto-estimate was 30% high.",

  // REQUIRED — who submitted (GitHub username, optionally email)
  "submitted_by": "github:username",

  // REQUIRED — who reviewed and merged (must be a CODEOWNER from .github/CODEOWNERS)
  "reviewed_by": "@pavle",

  // OPTIONAL — date the override was authored (auto-stamped by CI if absent)
  "submitted_at": "2026-05-24T14:32:00Z"
}
```

### What CAN be overridden

**Any field** from [`../../schema/fai-accelerator.schema.json`](../../schema/fai-accelerator.schema.json) except the locked set in §5 below. Most-overridden fields by frequency (projected from beta):

| Field | Why it's often wrong |
|---|---|
| `tagline` | Auto-polished tagline misses the repo's actual value prop |
| `cost_band` | LLM cost estimate diverges from real-world production usage |
| `categories[]` | Multi-pattern repos get classified to only one category |
| `froot_layer` | F/R/O1/O2/T boundaries are fuzzy; humans pick better than the classifier |
| `pollinates[]` | New Plays ship → manual pollination links needed before next auto-suggest cycle |
| `trust_badges[]` | Earned badges (e.g., `eval_proven`) require human verification |
| `description` | Auto-extracted README excerpt may be the wrong section |

### What CANNOT be overridden

Five fields are **locked** — overriding them is rejected at PR review:

| Locked field | Why |
|---|---|
| `id` | Filename already encodes this; changing it would point at a different fruit |
| `schema_version` | Pipeline-controlled |
| `origin` | Tracks how the fruit entered the Orchard (harvested vs cultivated vs first_party); overriding would forge provenance |
| `provenance.*` | Audit trail; the pipeline owns this entirely |
| `composed_from[]` | For cultivated fruits only — set by FAI Greenhouse, never by humans |

---

## 4. Deep-merge semantics

`override.js` performs a **deep recursive merge** of `overrides.*` over the auto-harvested manifest, with these explicit rules:

| Type | Rule |
|---|---|
| **Scalars** (string, number, boolean, null) | Override replaces. `tagline: "new"` replaces the auto-harvested tagline. |
| **Arrays** | Override **replaces wholesale** (no concat, no dedupe-merge). To add one badge, list ALL badges. |
| **Objects** | Override **deep-merges key-by-key**. `cost_estimate: { monthly_prod_low: 150 }` only changes that one field; other `cost_estimate` keys are preserved. |
| **`null`** | Override sets the field to null. Use to clear an auto-set value (e.g., `latest_release: null`). |
| **Missing keys** | Untouched — auto-harvested value persists. |

### Example: changing one cost field only

Auto-harvested:
```jsonc
"cost_estimate": {
  "currency": "USD",
  "monthly_dev_low": 50,
  "monthly_dev_high": 200,
  "monthly_prod_low": 200,
  "monthly_prod_high": 800,
  "drivers": ["Azure OpenAI", "AI Search S1"],
  "method": "llm_estimate_v1",
  "estimated_at": "2026-05-24T02:14:00Z"
}
```

Override file:
```jsonc
{
  "id": "azure-samples__azure-search-openai-demo",
  "overrides": {
    "cost_estimate": {
      "monthly_prod_low": 150,
      "monthly_prod_high": 600,
      "method": "manual_override"
    }
  },
  "reason": "Verified deployment costs ...",
  "submitted_by": "github:username",
  "reviewed_by": "@pavle"
}
```

Final merged result:
```jsonc
"cost_estimate": {
  "currency": "USD",
  "monthly_dev_low": 50,          // preserved
  "monthly_dev_high": 200,        // preserved
  "monthly_prod_low": 150,        // OVERRIDDEN
  "monthly_prod_high": 600,       // OVERRIDDEN
  "drivers": ["Azure OpenAI", "AI Search S1"],   // preserved
  "method": "manual_override",    // OVERRIDDEN
  "estimated_at": "2026-05-24T02:14:00Z"          // preserved
}
```

### Example: replacing an array

To add `production_ready` to existing `trust_badges`:

```jsonc
"overrides": {
  // ✅ Correct — list ALL desired badges
  "trust_badges": ["microsoft_official", "azd_template", "production_ready"]

  // ❌ Wrong — this REPLACES the whole array with one item
  // "trust_badges": ["production_ready"]
}
```

---

## 5. Provenance stamping

When `override.js` applies your file, it stamps:

```jsonc
"provenance": {
  "harvested_at": "...",
  "harvested_by": "fai-orchard-harvester/v1.0",
  "source": "github-api",
  "enriched_by": [ ... ],
  "overrides_applied": [
    "overrides/azure-samples__azure-search-openai-demo.json"
  ]
}
```

The `overrides_applied[]` array is the public audit trail. Every consumer of the manifest (website, CLI, MCP, SDK) sees which override files were merged in.

If multiple overrides exist for the same fruit (rare; shouldn't happen by convention but the pipeline handles it), they're applied in lexicographic-filename order and each one is appended to `overrides_applied[]`.

---

## 6. PR submission workflow

1. **Fork** [`frootai/frootai`](https://github.com/frootai/frootai)
2. **Create your override file** at `orchard/registry/overrides/<owner>__<repo>.json`
3. **Validate locally** (optional but recommended):
   ```bash
   cd orchard/validators/python
   python -c "from frootai_orchard import validate; import json; \
     r = validate('../../schema/fai-accelerator.schema.json', \
                  json.load(open('../../registry/overrides/<owner>__<repo>.json'))['overrides']); \
     print('OK' if r.ok else r.errors)"
   ```
   (validates that your `overrides.*` fragment is schema-valid in isolation)
4. **Open a PR** titled `[orchard:override] <owner>/<repo>: <one-line summary>`
5. **CI runs**: schema validation + locked-field check + lint (≤500 char reason, valid SPDX license, etc.)
6. **CODEOWNER reviews** (per `.github/CODEOWNERS` — owner of `orchard/registry/overrides/` reviews)
7. **Merge → next nightly cron picks it up** (~24h max; cron runs 02:00 UTC)
8. **Verify** at `https://frootai.dev/orchard/<variety>/<slug>` — your change is live

### What a good PR looks like

| ✅ Good | ❌ Bad |
|---|---|
| Title: `[orchard:override] Azure-Samples/azure-search-openai-demo: correct prod cost band` | Title: `Fix demo costs` |
| Reason: "Verified deployment costs over 3 months at <company>; original cost-band auto-estimate was 30% high." | Reason: "wrong cost" |
| One file changed (the override) | Multiple files (probably should be split PRs) |
| Override changes 1–3 related fields | Override changes 12 unrelated fields |
| Author is the repo's maintainer OR has real-world data | Author is anonymous with no context |

---

## 7. When to override vs other paths

| Symptom | Path | Not this path |
|---|---|---|
| Auto-classifier put fruit in wrong `froot_layer` | Override `froot_layer` here | Don't edit `enrich.js` |
| New accelerator should be in the Orchard | Add to `../seed-list.json` | Don't override (no fruit to override yet) |
| New Accelerator ↔ Play link needed | PR to `../pollinations.json` | Don't override `pollinates[]` here |
| Schema field is missing | PR to `../../schema/fai-accelerator.schema.json` | Don't fake it via override |
| `gold_iac=false` should be `true` for a cultivated fruit | Override is REJECTED — the Greenhouse owns this field | File an issue against the Greenhouse pipeline |

---

## 8. CODEOWNERS

Per [`frootai/.github/CODEOWNERS`](../../../.github/CODEOWNERS):

```
/orchard/registry/overrides/        @frootai/core @frootai/community
```

Two-reviewer rule: at least one CODEOWNER from `@frootai/core` OR `@frootai/community` must approve every override PR. Self-review is not allowed. This is the single human gate that keeps the catalog trustworthy.

---

## 9. The first 5 overrides (land in `[A2.24]`)

After the first nightly crawl produces ~250 enriched Azure manifests, the most-overridden top-star fruits get their hand-written corrections:

| # | Target | Likely override field(s) |
|---|---|---|
| 1 | `Azure-Samples/azure-search-openai-demo` | `tagline` (polish) + `cost_band` (refine) |
| 2 | `microsoft/ai-agents-for-beginners` | `categories[]` (add `agent`) + `trust_badges` (add `production_ready`) |
| 3 | `Azure/GPT-RAG` | `description` (extract correct section) + `pollinates[]` (link Play 01) |
| 4 | `Azure-Samples/graphrag-accelerator` | `categories[]` (add custom `graphrag`) + flag archived in `tags[]` |
| 5 | `microsoft-foundry/foundry-samples` | `tagline` (it's a docs-embedded sample collection, not a single app) |

These 5 will exist as worked examples in this folder by `[A2.24]` close (~7 weeks from now).

---

## 10. FAQ

**Q: Can I override a field for ALL fruits at once?**
A: No. One file per fruit. If you find yourself wanting a bulk override, it's a signal the underlying classifier is wrong → fix `enrich.js` instead.

**Q: What if upstream GitHub data changes after my override?**
A: Override always wins on overridden fields. Other fields refresh from the latest GitHub data on every cron run. If an override becomes stale (e.g., the repo got transferred and `repo_url` should change), open a new PR.

**Q: Can I override a Solution Play (in `frootai/solution-plays/`)?**
A: No — this folder is for **Accelerators only**. Plays use `fai-manifest.schema.json` and are authored/edited directly by FrootAI; community contributions there go through the usual PR review on the play's `.fai/manifest.json`.

**Q: Are overrides versioned?**
A: Git is the version history. If you need to revert an override, revert the merge commit.

**Q: What happens if my override's `reviewed_by` field changes after merge?**
A: It's the historical record of who first reviewed. Subsequent edits to the same override file go through fresh review and can be co-credited (add a second username, or open a separate file like `..__001-amendment.json` if structurally needed — extremely rare).

**Q: How do I see all overrides for a fruit?**
A: Read `provenance.overrides_applied[]` on any published fruit manifest. The website detail page renders this as a "Community corrections" expandable section.

---

## 11. Cross-references

- [`../README.md`](../README.md) — registry overview
- [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) — the three contribution paths (seed / override / pollinate)
- [`../../schema/fai-accelerator.schema.json`](../../schema/fai-accelerator.schema.json) — the field vocabulary you're overriding
- [`../../schema/fai-accelerator.example.json`](../../schema/fai-accelerator.example.json) — 5 worked manifest examples
- `planning/fai-orchard-masterplan.md` — Phase `[A2.9]`–`[A2.11]` for the `override.js` implementation; `[A2.24]` for the first 5 worked overrides

---

*The Orchard stays accurate not because curators police it but because every wrong field has a 60-second fix path. That's the whole point.*
