# 🌳 FAI Orchard

> **The cross-cloud Solution Accelerator hub.** Schema-defined. Crawler-fed. PR-correctable. CC0 where it should be, Apache-2.0 where it must be.

[![Schema: CC0-1.0](https://img.shields.io/badge/Schema-CC0--1.0-success)](./schema/fai-accelerator.schema.json)
[![Validators: Apache-2.0](https://img.shields.io/badge/Validators-Apache--2.0-blue)](./validators/)
[![Schema version: v1.0.0](https://img.shields.io/badge/Schema-v1.0.0-informational)](./schema/fai-accelerator.schema.json)
[![Python validator: 43 tests](https://img.shields.io/badge/Python%20tests-43%20passing-success)](./validators/python/)
[![TypeScript validator: 45 tests](https://img.shields.io/badge/TypeScript%20tests-45%20passing-success)](./validators/typescript/)
[![Seed list: 50 Accelerators](https://img.shields.io/badge/Seed%20list-50%20entries-blueviolet)](./registry/seed-list.json)

---

## What is the Orchard?

The Orchard is a **multi-cloud catalog of AI Solution Accelerators** — Azure, GCP, AWS, OSS — surfaced through one schema, one validator suite, one website, one CLI, one VS Code extension, and one MCP server. It is **not** a model marketplace, a code editor, or an IaC generator. It's the **discovery + composition layer** that sits above all of those.

Two things live here:

| 🚀 Solution Accelerator | 🌿 Solution Play |
|---|---|
| Industry term (Microsoft, Google, AWS all use it) | FrootAI proprietary recipe |
| **Free** to install and run | **Paid** (Pro / Team / Business / Enterprise) |
| Cross-cloud (Azure ✓ GCP ✓ AWS ✓ OSS ✓) | Cross-cloud (composes ON TOP of Accelerators) |
| ~640 entries by end of Y1 | 101 existing + ~19 new = ~120 by end of Y1 |
| Lives in **this folder** (`frootai/orchard/`) | Lives in `frootai/solution-plays/` |
| Crawled nightly from upstream GitHub | Hand-authored by FrootAI |
| Schema: `fai-accelerator.schema.json` | Schema: `fai-manifest.schema.json` |

The Accelerator is the **hardware**; the Play is the **operating system**. They snap together via `pollinations.json` (the link graph).

---

## Status — what you can use today

**Phase `[A0]` schema + validator layer: 9 / 30 sub-phases shipped (30%).**

| Folder | What's live | License |
|---|---|---|
| [`schema/`](./schema/) | **4 schema files** — Accelerator (v1.0.0, 50 props, 17 required, 5 conditional rules), Play (draft-07 cross-ref), Pollinations (v1.0.0, 6 props), plus 5 validating examples | CC0-1.0 (schemas) |
| [`validators/python/`](./validators/python/) | **`frootai-orchard` reference Python validator** + 43-test suite, draft auto-selection (2020-12 + draft-07), `jsonschema[format]` powered | Apache-2.0 |
| [`validators/typescript/`](./validators/typescript/) | **`@frootai/orchard` reference TypeScript validator** + 45-test suite, Ajv 8 + Ajv 2020, ESM build → `dist/` ready for npm | Apache-2.0 |
| [`registry/seed-list.json`](./registry/seed-list.json) | **50 hand-curated Azure Accelerators** (top stars + strategic value), spanning Azure-Samples · Azure · microsoft · microsoft-foundry · MSUSAzureAccelerators | CC0-1.0 |
| [`registry/pollinations.json`](./registry/pollinations.json) | **Empty starter** + JSON Schema — first 50 manual edges land in `[A2.25]`, auto-suggested edges from `[A2.5]` onward | CC0-1.0 |
| [`registry/overrides/`](./registry/overrides/) | **PR-flow documentation** — deep-merge semantics, locked fields, CODEOWNER review workflow | CC0-1.0 |

### What lands next

| Sub-phase | What ships | When |
|---|---|---|
| `[A0.10]` | This README (you are here) | ✅ |
| `[A0.11]` | Public-facing CONTRIBUTING.md | Soon |
| `[A0.12]`–`[A0.20]` | CODEOWNERS · CDN bucket · DNS · Slack hooks · trademark watch · planning trackers | Phase A0 close |
| `[A0.26]` | `registry/discovery-queries.json` (7 GH Search queries per Variety) | Phase A0 close |
| Phase `[A1]` | Crawler core: `discover → harvest → normalize → validate` for ~250 Azure repos | ~2 weeks |
| Phase `[A2]` | Nightly CDN goes live: `cdn.frootai.dev/orchard/v1/azure.json` | ~4 weeks |

Track the full plan at [`planning/fai-orchard-masterplan.md`](../../planning/fai-orchard-masterplan.md).

---

## Try it today

### 1. Validate any manifest against the schema (Python)

```bash
cd frootai/orchard/validators/python
pip install -e .[dev]
python -c "
from frootai_orchard import validate
import json

result = validate(
    '../../schema/fai-accelerator.schema.json',
    json.load(open('../../schema/fai-accelerator.example.json'))[0]
)
print('OK' if result.ok else result.errors)
"
# → OK
```

### 2. Validate any manifest against the schema (TypeScript)

```bash
cd frootai/orchard/validators/typescript
npm install
npm test                # 45 / 45 pass in ~2.4s
```

Or in your own code:

```ts
import { validate } from '@frootai/orchard';
import schema from './fai-accelerator.schema.json';

const result = validate(schema, myManifest);
if (!result.ok) console.error(result.errors);
```

### 3. Inspect the seed list

```bash
cat frootai/orchard/registry/seed-list.json | jq '.[] | .full_name + " (★" + (.stars|tostring) + ")"' | head
```

50 hand-curated Azure Accelerators ranging from `microsoft/ai-agents-for-beginners` (65,368 stars) to `MSUSAzureAccelerators/Risk-Classification-and-Loan-Modeling-Accelerator` (7 stars) — covering the full FROOT layer matrix and 5 industry verticals.

### 4. Browse the schema

The Accelerator schema is **CC0-1.0**. Use it. Fork it. Adopt it. Build your own viewer. Open at:

```
https://frootai.dev/schemas/fai-accelerator.v1.json    (live after [A0.25])
./schema/fai-accelerator.schema.json                   (today, in this repo)
```

---

## Three origin badges

Every Accelerator in the catalog carries one of three origin values (locked into the schema's `origin` enum):

| Badge | `origin` value | What it means |
|---|---|---|
| 🍎 **Harvested** | `harvested` | Crawled from upstream GitHub by `discover → harvest → normalize → validate` (Phases `[A1]` + `[A2]`). The bulk of the catalog. |
| 🌱 **Cultivated** | `cultivated` | Composed by FrootAI's Builder agent from **Azure Verified Modules + Terraform Registry** via the [FAI Greenhouse](../../planning/fai-orchard-masterplan.md) pipeline (Phase `[A11]`). Every line traceable to a Microsoft-signed module via `composed_from[]`. |
| 🌿 **First-party** | `first_party` | Hand-authored by FrootAI. Rare — only used for legacy infrastructure of the 101 existing Solution Plays, to be re-cultivated in `[A11.27]`. |

The schema's conditional rules enforce coherence: `origin: cultivated` requires `composed_from[]` AND `provenance.source: "frootai-greenhouse"`; `origin: harvested` requires `provenance.source: "github-api"`. No spoofing possible.

---

## Folder map

```
orchard/
├── README.md                                  (you are here)
├── CONTRIBUTING.md                            (3 contribution paths)
├── schema/
│   ├── README.md
│   ├── fai-accelerator.schema.json            ✅ CC0-1.0 · 2020-12 · 50 props
│   ├── fai-accelerator.example.json           ✅ 5 fixtures, origin × variety matrix
│   ├── fai-manifest.schema.json               ✅ draft-07, cross-ref copy
│   ├── orchard-pollinations.schema.json       ✅ CC0-1.0 · 2020-12 · flat edge list
│   └── validate-examples.js                   ✅ Ajv smoke test (5/5 pass)
├── validators/
│   ├── README.md
│   ├── python/                                ✅ frootai-orchard@0.1.0 · 43 tests
│   └── typescript/                            ✅ @frootai/orchard@0.1.0 · 45 tests
└── registry/
    ├── README.md
    ├── seed-list.json                         ✅ 50 Azure entries
    ├── pollinations.json                      ✅ Empty starter (edges populated in A2.25)
    └── overrides/
        ├── README.md                          ✅ Full PR-flow guide
        └── <owner>__<repo>.json               🌰 First 5 land in [A2.24]
```

---

## Three ways to contribute

| Path | What you change | Lands when |
|---|---|---|
| 🌱 **Seed a new Accelerator** | One entry in [`registry/seed-list.json`](./registry/seed-list.json) — `{ full_name, variety, reason, stars, first_party }` | Next nightly cron (~24h) |
| 🌂 **Override an Accelerator's metadata** | One file at [`registry/overrides/<owner>__<repo>.json`](./registry/overrides/) — deep-merged over auto-harvested manifest | Next nightly cron (~24h) |
| 🔗 **Add a pollination** | One edge in [`registry/pollinations.json`](./registry/pollinations.json) — link an Accelerator to a Solution Play | Next nightly cron (~24h) |

Full workflow in [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`registry/overrides/README.md`](./registry/overrides/README.md).

---

## License posture (why the split matters)

Two intentional license decisions encoded in this folder:

| What | License | Why |
|---|---|---|
| **Schemas + registry data** (`schema/*.json` + `registry/*.json`) | **CC0-1.0** (public domain dedication) | Standards-bearer play. External orgs (GoogleCloudPlatform, aws-samples, LangChain) can adopt without legal review. No reciprocal obligations. No claim on their code. |
| **Validators** (`validators/python/`, `validators/typescript/`) | **Apache-2.0** | Commercial use explicitly permitted, patent grant included, no rug-pull possible. Anchors the long-term moat in *tooling*, not in schema gatekeeping. (cf. HashiCorp BSL lesson.) |

Our wager: **the schema becomes the de-facto standard for cross-cloud Accelerator metadata** — like `package.json` did for Node, `Cargo.toml` for Rust. The Orchard already wins as a FrootAI feature; if external adoption happens, FrootAI is the standard-bearer.

---

## Doctrine (the bright lines that keep this honest)

From [`planning/fai-orchard-masterplan.md`](../../planning/fai-orchard-masterplan.md) §0.5 — 9 lines, two especially load-bearing for this folder:

1. **NO HAND-MAINTAINED FRUIT LISTS.** Every Accelerator enters via the harvest pipeline. New repos go through `registry/seed-list.json` — one PR, one line, auto-ingested next cron. No admin UI. No curators-of-curators.
2. **NO SILENT ENRICHMENT.** Every LLM-touched field stamps `provenance.enriched_by[]` with the model + step + timestamp. Audit trail is non-negotiable.
3. **POLLINATIONS ARE PRs.** Never admin UI clicks. Every Accelerator ↔ Play link is a reviewable diff.
4. **NO GOLD BICEP.** When a verified module exists (Azure Verified Modules · Terraform Registry), Builder agents compose from it — never hand-write raw IaC. Enforced by CI on every Play PR. The Greenhouse pillar (Phase `[A11]`) is the productization of this rule.

---

## Cross-references

- **Master plan** — [`planning/fai-orchard-masterplan.md`](../../planning/fai-orchard-masterplan.md) — 12 phases × 30 sub-phases, 9 doctrines, 11 moats, 6 revenue levers
- **Schema spec** — [`planning/fai-orchard-manifest-schema.md`](../../planning/fai-orchard-manifest-schema.md) — full field-by-field specification + §13 Greenhouse provenance addendum
- **Source inventory** — [`planning/fai-orchard-source-inventory.md`](../../planning/fai-orchard-source-inventory.md) — live-verified registries (11 harvest sources + 469 AVM Bicep + 194 Terraform Registry modules)
- **Crawler scripts** — `frootai-core/scripts/orchard/` (lands in Phases `[A1]` + `[A2]`)
- **Cultivation scripts** — `frootai-core/scripts/greenhouse/` (lands in Phase `[A11]`)
- **Public website** — `frootai.dev/orchard` (lands in Phase `[A3]`)
- **CLI** — `frootai orchard <subcommand>` (lands in Phase `[A4]`)
- **VS Code extension** — `frootai-vscode` "FAI Orchard" tree view (lands in Phase `[A5]`)
- **SDKs** — `@frootai/orchard` (npm) + `frootai-orchard` (PyPI) (lands in Phase `[A6]`)
- **MCP server** — `@frootai/mcp-orchard` (lands in Phase `[A7]`)

---

## Schema URLs (planned, live after `[A0.25]`)

```
https://frootai.dev/schemas/fai-accelerator.v1.json
https://frootai.dev/schemas/fai-manifest.v1.json
https://frootai.dev/schemas/orchard-pollinations.v1.json
```

For now, reference them via the GitHub raw URLs or the in-tree paths above.

---

*Phase `[A0.10]` shipped 2026-05-25. This folder follows the master-plan-driven workflow — changes outside open `[A0.x]` sub-phases must go through a PR with reasoning. The Orchard is built in public, governed by doctrine, evolved by community PRs.*
