# Contributing a Solution Play

**[H11.21]** Welcome — this guide covers how to contribute a **Solution Play** to the FrootAI catalog. (For seeds / overrides / pollinations of existing catalog entries, see the top-level [CONTRIBUTING.md](../CONTRIBUTING.md).)

> **Founder review SLA**: **7 days** from PR open to first response. Validator runs automatically on every push.

---

## What is a Solution Play?

A **Solution Play** is a runnable, opinionated combination of cloud + AI primitives — typically anchored on a specific use case (e.g. "RAG over enterprise docs on Azure"). Each play ships with:

- A canonical `fai-manifest.json` describing the play's identity, owner, license, and provenance
- A `README.md` walking through what the play does + how to deploy
- Optional `infra/`, `evals/`, `prompts/`, `agents/`, `skills/`, and `workflows/` directories

The catalog already contains 100+ plays harvested from public repos via the FrootAI harvest pipeline ([H1-H6](../../planning/repo-to-solution-play-converter/01-harvest-to-play-masterplan.md)). Community contributions extend this catalog with plays the harvest pipeline doesn't (yet) reach.

Browse existing plays at [frootai.dev/marketplace/category/solution-plays](https://frootai.dev/marketplace/category/solution-plays).

## fai-manifest.json schema

Every Solution Play has a `fai-manifest.json` at its root. The full schema is at [`frootai/orchard/schema/fai-manifest-v2.json`](../schema/fai-manifest-v2.json). For a community-PR contribution, the **required-fields floor** is:

```jsonc
{
  "schema_version": "2.0.0",
  "id": "fai-azure-my-rag-play",          // globally unique id; convention: fai-<variety>-<slug>
  "name": "Azure RAG for Healthcare Docs", // human-readable name
  "slug": "azure-rag-healthcare-docs",     // URL-safe lowercase-hyphenated; 3-64 chars
  "variety": "azure",                       // azure | aws | gcp | oss | hybrid
  "owner": "my-org",                        // GitHub org/user that authored the play
  "owner_type": "community",                // community | first_party | cultivated (community for PRs)
  "repo_url": "https://github.com/my-org/my-rag-play",
  "default_branch": "main",
  "tagline": "≤200 chars — what the play does + who it's for.",
  "license": "MIT"                          // SPDX id; must be in permissive floor (see below)
}
```

**Optional fields** the founder review may request: `categories`, `tech`, `cost_band`, `deployment.azd_template`, `provenance` (auto-populated on landing).

The automated validator ([`cli/commands/release/community-pr-validate.js`](../../../frootai-core/cli/commands/release/community-pr-validate.js)) checks every PR against this floor + the file-tree requirements.

## Submit via PR

### Branch naming

```
community-play/<slug>
```

Example: `community-play/azure-rag-healthcare-docs`.

### File layout

Your PR adds a single directory under `frootai/orchard/community-plays/<slug>/`:

```
frootai/orchard/community-plays/<slug>/
├── fai-manifest.json        (REQUIRED)
├── README.md                (REQUIRED — walkthrough + deploy steps)
├── infra/                   (OPTIONAL — bicep / terraform / azd templates)
├── evals/                   (OPTIONAL — golden datasets + scoring scripts)
├── prompts/                 (OPTIONAL — system / few-shot prompts)
├── agents/                  (OPTIONAL — agent definitions)
├── skills/                  (OPTIONAL — skill packs)
└── workflows/               (OPTIONAL — GitHub Actions / CI configs)
```

### PR template

Open your PR via the [community Solution Play PR template](../../.github/PULL_REQUEST_TEMPLATE/community-play.md) — it walks you through the 5-checkbox pre-flight + asks for the deploy walkthrough summary.

### CLA reference

We use [CC0-1.0](../../LICENSE) for the catalog floor; community contributions are accepted under SPDX-permissive licenses (MIT / Apache-2.0 / BSD-2 / BSD-3 / ISC / 0BSD / Unlicense / CC0-1.0). By submitting a PR you attest the play is yours OR is properly attributed in your `README.md` per its upstream license.

## Founder review SLA

**7 days from PR open to first response.** That response is one of:

1. ✅ **Approved + merged** — your play lands in `frootai/orchard/community-plays/<slug>/` and shows up in [frootai.dev/marketplace](https://frootai.dev/marketplace/category/solution-plays) within 24h (next harvest cron).
2. 🔧 **Changes requested** — specific actionable feedback; respond + push, the validator re-runs, the SLA clock restarts on response.
3. ⏭️ **Deferred** — out-of-scope or duplicate; founder explains why + suggests an alternative path.
4. ❌ **Declined** — rare; reserved for clear policy violations (PII, non-permissive license, malicious code).

Escalation: if no response within 7 days, ping `@pavle` directly on the PR.

## License + attribution

- **Catalog floor**: CC0-1.0 (the catalog metadata + harvest provenance — your manifest fields ABOUT the play).
- **Per-play license**: SPDX-permissive (MIT / Apache-2.0 / BSD-2 / BSD-3 / ISC / 0BSD / Unlicense / CC0-1.0). The `license` field in your manifest is the per-play license.
- **Attribution**: if your play wraps OR derives from another project, cite that project in your `README.md` per its upstream license. The `provenance.harvested_from` field (auto-populated for harvested plays; community PRs leave empty) records the upstream link.

---

## Pre-flight checklist

Before opening your PR:

- [ ] Slug is URL-safe lowercase-hyphenated 3-64 chars
- [ ] License is in the permissive floor (see list above)
- [ ] No PII in manifest fields (validator scans `name`, `tagline`, `description`, `readme_excerpt`)
- [ ] `fai-manifest.json` + `README.md` both present
- [ ] PR is < 100 files (large PRs get a non-blocking warning; founder review may ask to split)
- [ ] Branch name is `community-play/<slug>`

The auto-validator catches every item above — but you'll save a review round-trip by checking yourself first.

---

_This doc is **the structure**; the founder updates the prose as the program evolves. Lib-locked outline + 7-day SLA are pinned in [`cli/commands/release/wave3-launch.js`](../../../frootai-core/cli/commands/release/wave3-launch.js)'s `CONTRIBUTION_PATH` constant ([H11.20])._
