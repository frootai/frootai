# Recipe 38: Competitor Pricing Tracker (Firecrawl + MongoDB + Notion)

> **Community contribution sample ([X8.25]).** This is the 11th composition
> recipe — a prototype that walks the full contributor workflow end to end:
> author the cookbook page, add the companion assets (`run.mjs`,
> `sample-output.md`, `mcp-scope.json`, `cost.json`, `security.json`,
> `studio.json`), register it, and pass the gates. Use it as the worked example
> when submitting your own recipe via the contribution flow.

> Compose three MCP servers into one competitive-intelligence loop: crawl
> competitor pricing pages with **Firecrawl**, persist each snapshot to
> **MongoDB** for history, then publish a diffed digest to **Notion** — turning
> scattered pricing pages into a tracked, week-over-week report from one FrootAI
> play.

## What You'll Build

A solution play whose agent attaches three MCP servers and runs a
**crawl → persist → publish** pipeline:

1. **Firecrawl** scrapes each competitor's pricing page into structured data.
2. **MongoDB** stores every snapshot so the agent can diff this week against
   last week.
3. **Notion** publishes a digest page summarizing prices and flagging changes.

This is a canonical composition recipe — no single server does the job; the
value is in the federation.

## Goal

Turn **scattered competitor pricing pages into a tracked digest** in one play
run: the agent crawls each page, stores the snapshot, diffs against history, and
publishes a Notion report. No single server can do this — Firecrawl can't
remember last week, MongoDB can't crawl, Notion can't scrape.

## Areas attached

| Server | Trust | Role in the loop |
|--------|-------|------------------|
| `firecrawl` | verified-publisher | Crawl/scrape each competitor pricing page |
| `mongodb` | verified-publisher | Persist + recall pricing snapshots for diffing |
| `notion` | verified-publisher | Publish the diffed pricing digest |

Firecrawl handles *capture* (page → structured data), MongoDB handles *memory*
(snapshot → history), Notion handles *publish* (diff → readable digest). The
agent decides what to crawl, persists each result, diffs against the prior run,
and publishes once.

The slugs match the marketplace specs under
[`frootai/orchard/registry/mcp-specs/{firecrawl,mongodb,notion}.json`](../orchard/registry/mcp-specs/).

## Prerequisites

- FrootAI repo cloned; an existing or new play under `frootai/solution-plays/`.
- A Firecrawl API key, a MongoDB connection string (scoped to one collection),
  and a Notion integration token with access to the target page.

## Step 1 — Declare the MCP scope on the play

In the play's `agent.md` frontmatter, attach all three servers so the engine
wires them before the first turn:

```yaml
---
description: "Crawl competitor pricing, track history, and publish a Notion digest"
mcp_scope:
  attached: ["firecrawl", "mongodb", "notion"]
  router_config:
    detach_on_finish: true
---
```

## Step 2 — Provide credentials

Set the credentials in the environment — never in the play manifest or args:

```bash
export FIRECRAWL_API_KEY="fc-..."
export MDB_MCP_CONNECTION_STRING="mongodb+srv://..."
export NOTION_TOKEN="ntn_..."
```

## Step 3 — The tracking loop (agent prompt sketch)

```text
1. For each competitor URL, use Firecrawl to scrape the pricing page.
2. Insert each scraped snapshot into the MongoDB `pricing_snapshots` collection.
3. Load the prior snapshots and diff prices against the new crawl.
4. Create a Notion page summarizing current prices and flagging any changes.
```

## Step 4 — Validate the attach plan

```bash
node frootai-core/scripts/orchard/validate-recipe-mcp-scope.js
```

This confirms the recipe's `mcp_scope.attached` matches this cookbook spec and
that every slug resolves to a real marketplace spec.

## Step 5 — Run it

```bash
node frootai/cookbook/recipes-mcp-composition/38-competitor-pricing-tracker/run.mjs
```

The offline harness drives the full loop against fake areas (no network, no
secrets) and prints a deterministic transcript ending in `RESULT: OK`.

## Sample output

See [`sample-output.md`](./recipes-mcp-composition/38-competitor-pricing-tracker/sample-output.md)
for the captured transcript. Illustrative live-run summary:

```text
Crawled 3 competitor pricing pages (vendor-a, vendor-b, vendor-c).
Persisted 3 snapshots; diffed against last week.
1 price change flagged: vendor-b Pro $29 → $34.
Published "Weekly competitor pricing digest" to Notion.
```

## Cost estimate

| Component | Per 100 runs |
|-----------|--------------|
| Model tokens | ~$3.50 |
| Firecrawl crawls (3 pages/run) | ~$6.00 |
| MongoDB + Notion | flat-rate |
| **Total** | **~$9.50** |

The metered third-party calls are the Firecrawl crawls; MongoDB and Notion are
flat-rate. See [`cost.json`](./recipes-mcp-composition/38-competitor-pricing-tracker/cost.json).

## The `mcp_scope.attached` snippet

Copy this into your own play's `agent.md` frontmatter:

```yaml
mcp_scope:
  attached: ["firecrawl", "mongodb", "notion"]
  router_config:
    detach_on_finish: true
```

## Open in Studio

Launch this recipe in the [FrootAI Studio builder](https://studio.frootai.dev/builder?recipe=38-competitor-pricing-tracker&areas=firecrawl,mongodb,notion&prompt=Crawl%20competitor%20pricing%20pages%20with%20Firecrawl%2C%20persist%20each%20snapshot%20to%20MongoDB%2C%20diff%20against%20history%2C%20and%20publish%20a%20pricing%20digest%20to%20Notion.) — the deep link
pre-fills the agent prompt and surfaces the recipe's `mcp_scope` areas
(`firecrawl`, `mongodb`, `notion`) so you start from the recipe instead of a blank canvas:

[**▶ Open in Studio**](https://studio.frootai.dev/builder?recipe=38-competitor-pricing-tracker&areas=firecrawl,mongodb,notion&prompt=Crawl%20competitor%20pricing%20pages%20with%20Firecrawl%2C%20persist%20each%20snapshot%20to%20MongoDB%2C%20diff%20against%20history%2C%20and%20publish%20a%20pricing%20digest%20to%20Notion.)

## Security note

| Server | Credential | Scope | Blast radius if leaked |
|--------|-----------|-------|------------------------|
| `firecrawl` | `FIRECRAWL_API_KEY` | crawl/scrape | can crawl pages on your plan's quota |
| `mongodb` | `MDB_MCP_CONNECTION_STRING` | one collection | read/write the `pricing_snapshots` collection |
| `notion` | `NOTION_TOKEN` | scoped pages | create/edit pages the integration can see |

Scope the MongoDB connection string to a **single collection** and the Notion
token to the **specific digest page** — neither needs broader access. Keep all
three in the environment, never in the play manifest or args. Firecrawl crawls
whatever URL you give it — only point it at pages you're authorized to scrape.

## Notes

- **Contribution sample**: this recipe exists to prototype the community PR
  workflow. To submit your own, copy this directory's asset shape, claim the
  next free slot, and run the validators in Step 4 + the runnable script in
  Step 5 before opening a PR.
- **Swap-ins**: replace Notion with **GitHub** (see
  [Recipe 30](./30-notion-doc-update-on-pr.md)) to file the digest as an issue
  instead of a doc.
