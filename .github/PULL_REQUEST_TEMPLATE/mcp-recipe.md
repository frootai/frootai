---
name: MCP Composition Recipe Contribution
about: Contribute a new cross-server MCP composition recipe to the FrootAI cookbook
title: "mcp-recipe: <slug> — <one-line summary>"
labels: ["mcp-recipe", "cookbook", "community", "needs-founder-review"]
assignees: ["pavle"]
---

<!--
  [X8.24] Community MCP composition-recipe PR template.
  Authoring guide: docs/cookbook/recipes-mcp-composition.md  ([X8.1])
  Worked example:  cookbook/38-competitor-pricing-tracker.md  ([X8.25] sample 11th)
  Scope validator: frootai-core/scripts/orchard/validate-recipe-mcp-scope.js  ([X8.21])
  Nightly harness:  .github/workflows/cookbook-composition.yml  ([X8.15])
  Founder review SLA: 14 days from PR open.
  Default trust posture: the recipe may only attach servers that already have a
  marketplace spec under orchard/registry/mcp-specs/.
-->

## 1. Recipe

**Slot number** (next free `NN`, do NOT reuse 24–27): `<NN>`
**Slug** (`NN-kebab-case`, matches the dir + cookbook filename): `<NN-slug>`
**Title** (human-readable): `<Title> (<Server A> + <Server B> + ...)`
**One-line goal** (no marketing): `<what the federated play actually does>`

## 2. Composition (≥ 2 servers, distinct roles)

> A recipe must federate **two or more** MCP servers, each in a distinct role.
> Every attached slug must already have a marketplace spec under
> [`orchard/registry/mcp-specs/<slug>.json`](../../orchard/registry/mcp-specs/).

| Server (slug) | Trust | Role in the loop |
|---|---|---|
| `<slug>` | `first-party-ms` / `verified-publisher` / `community` | `<capture / persist / publish / ...>` |

**`mcp_scope.attached`** (the canonical attach list, same in the cookbook md + `mcp-scope.json`):

```yaml
mcp_scope:
  attached: ["<slug>", "<slug>"]
  router_config:
    detach_on_finish: true
```

## 3. Companion assets

> Copy the asset shape from the [recipe 38 worked example](../../cookbook/recipes-mcp-composition/38-competitor-pricing-tracker/).
> Each lives under `cookbook/recipes-mcp-composition/<NN-slug>/`.

- [ ] `mcp-scope.json` — `{ mcp_scope: { attached: [...], router_config: { detach_on_finish: true } } }`
- [ ] `run.mjs` — offline harness run via the shared `_harness.mjs`; prints `RESULT: OK`; exercises **every** attached area
- [ ] `sample-output.md` — embeds the verbatim `run.mjs` transcript
- [ ] `cost.json` — `{ invocations: 100, monthlyCostUsd, currency, note }`
- [ ] `security.json` — one entry per server with the **real** env-var credential (declared in that server's spec) + scope
- [ ] `studio.json` — `{ recipe, areas, prompt, url }` canonical Open-in-Studio deep link

## 4. Cookbook page

> `cookbook/<NN-slug>.md` — follow the mandated section structure from the
> authoring guide ([X8.1]).

- [ ] **Goal** / **Areas attached** (trust table) / **Steps** / **Sample output** / **Cost estimate**
- [ ] The copy-pasteable `mcp_scope.attached` snippet (matches `mcp-scope.json`)
- [ ] A **Security note** naming each credential
- [ ] An **Open in Studio** section linking the `studio.json` URL

## 5. Registration

- [ ] Registered in [`frootai.dev/public/data/cookbook.json`](../../../frootai.dev/public/data/cookbook.json)
- [ ] Row added to the [`cookbook/README.md`](../../cookbook/README.md) composition table
- [ ] `frootai.dev/scripts/build-recipe-links.mjs` re-run (recipe surfaces on each server's detail page)

## Pre-flight checklist

> Run these locally before opening the PR — the CI mirrors them.

- [ ] `node frootai-core/scripts/orchard/validate-recipe-mcp-scope.js` is **green** (scope ↔ cookbook ↔ specs parity, ≥ 2 servers, real specs)
- [ ] `node cookbook/recipes-mcp-composition/<NN-slug>/run.mjs` exits 0 and ends with `RESULT: OK`
- [ ] Every attached slug resolves to a real `orchard/registry/mcp-specs/<slug>.json`
- [ ] `security.json` credentials are each declared in their server's spec — no invented env vars
- [ ] The cookbook `attached: [...]` blocks match `mcp-scope.json` exactly (same order)
- [ ] The slot number is free (not 24–27, not an existing recipe)

## What the PR validator checks

The nightly `cookbook-composition.yml` workflow ([X8.15]) runs every recipe's
`run.mjs` on Node 22 and fails on any `RESULT` that isn't `OK`. The
`validate-recipe-mcp-scope.js` validator ([X8.21]) enforces scope ↔ cookbook ↔
spec consistency. Errors block merge.

## Founder review SLA

**14 days from PR open to first response.** If you haven't heard back, ping
`@pavle` on this PR.

## Author attestation

- [ ] I authored this recipe (or have the right to contribute it) and it attaches only servers I'm authorized to use.
- [ ] The recipe is a genuine composition (≥ 2 servers, distinct roles) — not a single-server task with idle attachments.
