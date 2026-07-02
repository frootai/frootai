# Recipe 30: Notion Doc Update on PR (GitHub + Notion + Stripe)

> Compose 3 MCP servers into 1 doc-sync flow: when a docs PR merges in **GitHub**, mirror the changed page into **Notion**, and when the change touches a pricing/plan doc, reflect it into **Stripe** so billing never drifts from docs — all from 1 FrootAI play.

## What You'll Build

A solution play whose agent attaches 3 MCP servers and runs a **detect → mirror → reconcile** workflow:

1. **GitHub** surfaces the merged PR and changed doc files.
2. **Notion** updates the mirrored page(s) so the team KB stays in lock-step with the repo.
3. **Stripe** reconciles the billing catalog (product/price/payment-link) when the changed doc is a pricing/plan page — the "notify billing on update" side of the loop.

This is a canonical composition recipe: no single server does it; the value is the federation.

## Goal

Keep 3 surfaces in sync from **1 merged PR**: the repo (source of truth), Notion (readable mirror), and Stripe (billing catalog). No single server can do this — GitHub can't write Notion, Notion can't touch billing, Stripe can't see the PR.

## Areas attached

| Server | Trust | Role in the loop |
|--------|-------|------------------|
| `github` | first-party-ms | Detect the merged PR + changed doc files |
| `notion` | verified-publisher | Mirror the changed doc into the workspace |
| `stripe` | verified-publisher | Reconcile catalog on a pricing/plan-doc change |

GitHub handles *detect* (PR → changed files), Notion handles *mirror* (doc → workspace page), Stripe handles *reconcile* (pricing change → catalog update). The agent only touches Stripe when a pricing/plan doc actually changed.

The slugs match the marketplace specs under
[`frootai/orchard/registry/mcp-specs/{github,notion,stripe}.json`](../orchard/registry/mcp-specs/).

## Prerequisites

- FrootAI repo cloned; an existing or new play under `frootai/solution-plays/`.
- A GitHub token (PR + contents read), a Notion integration token (page write), and a Stripe secret key (catalog write — **test mode** strongly recommended).

## Step 1 — Declare the MCP scope on the play

In the play's `agent.md` frontmatter, attach all 3 servers so the engine wires them before the first turn:

```yaml
---
description: "Sync a merged docs PR into Notion + reconcile Stripe pricing"
tools: ["terminal", "file", "search"]
mcp_scope:
  attached: ["github", "notion", "stripe"]
  router_config:
    detach_on_finish: true
---
```

## Step 2 — Provide credentials

Each server reads its credential from the environment (never inline in args — doctrine #6):

```bash
export GITHUB_TOKEN="ghp_..."        # PR + contents read
export NOTION_TOKEN="ntn_..."        # page write on the target workspace
export STRIPE_SECRET_KEY="sk_test_..." # test-mode key — catalog write
```

## Step 3 — The doc-sync loop (agent prompt sketch)

```text
1. Call github to read the merged PR + the list of changed doc files.
For each changed doc:
  2. Read the new content; call notion.update (or append blocks) on the
     mirrored page so Notion matches the repo.
  3. If the doc is a pricing/plan page, parse the affected plan; call the
     stripe catalog tools (create_product / create_payment_link) to reflect
     the change. Otherwise skip Stripe.
Finally:
  - Summarize: which pages were mirrored + whether the billing catalog changed.
```

## Step 4 — Validate the attach plan

```bash
cd frootai-core
node scripts/marketplace/validate-spec.smoke.test.js   # specs are well-formed
# Trust: github is first-party-ms, notion + stripe are verified-publisher.
# Stripe's catalog writes (create_product, etc.) confirm per call under
# allowDestructive: false — billing is never mutated silently.
```

## Step 5 — Run it

Activate the play (e.g. on a merge webhook); the engine attaches GitHub + Notion + Stripe, and the agent runs the loop. Output: updated Notion mirror plus, when relevant, reconciled Stripe catalog.

## Sample output

```markdown
# Doc-sync run — PR #318 merged ("Update Pro plan limits")

- Notion mirrored: 2 pages (docs/pricing.md → "Pricing", docs/faq.md → "FAQ")
- Stripe reconciled: 1 change
  - Product "Pro" price updated $29 → $39 (test mode)
- No-op: docs/faq.md (not a pricing page)

All three surfaces in sync.
```

> The full sample is committed at
> [`recipes-mcp-composition/30-notion-doc-update-on-pr/sample-output.md`](./recipes-mcp-composition/30-notion-doc-update-on-pr/sample-output.md)
> (added in [X8.13]).

## Cost estimate

Assuming **100 invocations/month**, 1 merged PR (~2 changed docs) per run:

| Cost source | Per run | × 100/mo |
|-------------|---------|----------|
| GitHub reads (~5 calls) | $0.00 (token quota) | $0.00 |
| Notion page writes (~2) | $0.00 (token quota) | $0.00 |
| Stripe catalog calls (~1, when pricing changed) | $0.00 (API quota) | $0.00 |
| Model tokens (diff analysis + sync, ~7k in / 1k out) | ~$0.03 | ~$3.00 |
| **Total** | **~$0.03** | **~$3.00 / mo** |

FrootAI-side cost is model tokens only; all 3 servers are token/API-quota metered with no marginal per-run charge at this volume.

## The `mcp_scope.attached` snippet

Copy this into your own play's `agent.md` frontmatter:

```yaml
mcp_scope:
  attached: ["github", "notion", "stripe"]
  router_config:
    detach_on_finish: true
```

## Open in Studio

Launch this recipe in the [FrootAI Studio builder](https://studio.frootai.dev/builder?recipe=30-notion-doc-update-on-pr&areas=github,notion,stripe&prompt=When%20a%20pull%20request%20merges%2C%20update%20the%20linked%20Notion%20doc%20and%20reconcile%20the%20Stripe%20billing%20catalog.) — the deep link pre-fills the agent prompt and surfaces the recipe's `mcp_scope` areas (`github`, `notion`, `stripe`) so you start from the recipe instead of a blank canvas:

[**▶ Open in Studio**](https://studio.frootai.dev/builder?recipe=30-notion-doc-update-on-pr&areas=github,notion,stripe&prompt=When%20a%20pull%20request%20merges%2C%20update%20the%20linked%20Notion%20doc%20and%20reconcile%20the%20Stripe%20billing%20catalog.)

## Security note

| Server | Credential | Scope | Blast radius if leaked |
|--------|-----------|-------|------------------------|
| `github` | `GITHUB_TOKEN` | PR + contents **read** | read access to the scoped repo |
| `notion` | `NOTION_TOKEN` | page write | edit the integration's shared pages |
| `stripe` | `STRIPE_SECRET_KEY` | catalog write | **billing** — use a **test-mode** key |

`stripe` is the sensitive one: a live secret key can mutate real billing. Use a **test-mode** key (`sk_test_...`) for development, scope it to the catalog, and rely on `allowDestructive: false` so every `create_*` call confirms. Keep all credentials in the environment, never in the play manifest or args.

## Notes

- **Webhook-driven**: trigger this play from a GitHub merge webhook so the sync is automatic, not manual.
- **Swap-ins**: drop Stripe for a docs-only sync, or replace Notion with **GitHub** (see [Recipe 28](./28-browser-screenshot-to-bug-report.md)) to mirror into a wiki repo instead.
