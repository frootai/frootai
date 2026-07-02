# Recipe 31: Multi-Cloud Cost Report (Azure + MongoDB)

> Compose two MCP servers into one FinOps pass: pull live spend from **Azure**
> Cost Management, join it against the historical cost snapshots cached in
> **MongoDB**, and emit a cross-period cost report with month-over-month trend
> and anomalies — from one FrootAI play.

## What You'll Build

A solution play whose agent attaches two MCP servers and runs a
**fetch → join → report** loop:

1. **Azure** returns the current period's cost broken down by service, resource
   group, and region.
2. **MongoDB** holds the rolling history of prior cost snapshots (Atlas runs on
   Azure, AWS, and GCP — the "multi-cloud" cache); the agent aggregates it for
   the baseline.
3. The agent joins live spend against the cached history and emits a report with
   deltas, trend, and flagged anomalies.

This is a canonical composition recipe — no single server does the job; the
value is in the federation.

## Goal

Turn **live Azure spend + cached history into a trend report** in one play run:
the agent fetches this period's cost, compares it against the snapshots in
MongoDB, and flags anomalies. No single server can do this — Azure has no memory
of prior periods in a queryable form, MongoDB can't read your live bill.

## Areas attached

| Server | Trust | Role in the loop |
|--------|-------|------------------|
| `azure` | first-party-ms | Fetch live cost by service / RG / region |
| `mongodb` | verified-publisher | Aggregate the cached historical cost snapshots |

Azure handles *fetch* (subscription → current spend), MongoDB handles *baseline*
(history → trend). The agent joins them and writes one report. (Two servers is
the minimum for a composition; each plays a distinct role.)

> **Cache population is out of scope here.** This recipe **reads** the snapshot
> history via MongoDB's `find` / `aggregate` / `count` tools (run with
> `MDB_MCP_READ_ONLY=true`). A separate scheduled collector writes each period's
> snapshot — keeping this play strictly read-only.

The slugs match the marketplace specs under
[`frootai/orchard/registry/mcp-specs/{azure,mongodb}.json`](../orchard/registry/mcp-specs/).

## Prerequisites

- FrootAI repo cloned; an existing or new play under `frootai/solution-plays/`.
- An Azure subscription with Cost Management read access, and a MongoDB
  (Atlas) connection string to a collection of prior cost snapshots.

## Step 1 — Declare the MCP scope on the play

In the play's `agent.md` frontmatter, attach both servers so the engine wires
them before the first turn:

```yaml
---
description: "Cross-period Azure cost report with MongoDB-cached trend"
tools: ["terminal", "file", "search"]
mcp_scope:
  attached: ["azure", "mongodb"]
  router_config:
    detach_on_finish: true
---
```

## Step 2 — Provide credentials

Each server reads its credential from the environment (never inline in args —
doctrine #6):

```bash
export AZURE_SUBSCRIPTION_ID="..."
export AZURE_TENANT_ID="..."          # or use `az login`
export AZURE_CLIENT_ID="..."
export AZURE_CLIENT_SECRET="..."
export MDB_MCP_CONNECTION_STRING="mongodb+srv://..."
export MDB_MCP_READ_ONLY="true"       # this recipe never writes
```

## Step 3 — The report loop (agent prompt sketch)

```text
1. Call azure Cost Management for the current period: spend by service, RG,
   and region.
2. Call mongodb.aggregate on the snapshots collection for the trailing N
   periods (same grouping).
3. Join live vs. cached: compute deltas + a simple trend per group.
4. Flag anomalies (e.g. a service up >25% vs. its trailing mean).
Finally:
  - Emit a report: total this period, top movers, anomalies, the trend table.
```

## Step 4 — Validate the attach plan

```bash
cd frootai-core
node scripts/marketplace/validate-spec.smoke.test.js   # specs are well-formed
# Trust: azure is first-party-ms, mongodb is verified-publisher. This recipe
# only reads — MDB_MCP_READ_ONLY=true and no destructive Azure tools.
```

## Step 5 — Run it

Activate the play; the engine attaches Azure + MongoDB, and the agent runs the
loop. The output is a cross-period cost report you can drop into a FinOps review.

## Sample output

```markdown
# Cost Report — sub `acme-prod` — June 2026

- Total this period: $18,420 (▲ 12% vs. May)
- Top movers:
  - Azure OpenAI: $4,100 (▲ 38%) ⚠️ anomaly (>25% over trailing mean)
  - Storage: $2,030 (▼ 4%)
  - App Service: $1,560 (▲ 2%)
- 1 anomaly flagged. Trend (6-month) attached.
```

> The full sample is committed at
> [`recipes-mcp-composition/31-multi-cloud-cost-report/sample-output.md`](./recipes-mcp-composition/31-multi-cloud-cost-report/sample-output.md)
> (added in [X8.13]).

## Cost estimate

Assuming **100 invocations/month**, one subscription + 6-month history per run:

| Cost source | Per run | × 100/mo |
|-------------|---------|----------|
| Azure Cost Management reads (~5 calls) | $0.00 (ARM quota) | $0.00 |
| MongoDB aggregate (~3 queries) | $0.00 (Atlas tier) | $0.00 |
| Model tokens (join + trend reasoning, ~10k in / 1.5k out) | ~$0.05 | ~$5.00 |
| **Total** | **~$0.05** | **~$5.00 / mo** |

FrootAI-side cost is model tokens only; Azure ARM reads and MongoDB aggregates
add no marginal cost at this volume.

## The `mcp_scope.attached` snippet

Copy this into your own play's `agent.md` frontmatter:

```yaml
mcp_scope:
  attached: ["azure", "mongodb"]
  router_config:
    detach_on_finish: true
```

## Open in Studio

Launch this recipe in the [FrootAI Studio builder](https://studio.frootai.dev/builder?recipe=31-multi-cloud-cost-report&areas=azure,mongodb&prompt=Pull%20Azure%20cost%20data%2C%20store%20it%20read-only%20in%20MongoDB%2C%20and%20produce%20a%20multi-cloud%20monthly%20cost%20report.) — the deep link
pre-fills the agent prompt and surfaces the recipe's `mcp_scope` areas
(`azure`, `mongodb`) so you start from the recipe instead of a blank canvas:

[**▶ Open in Studio**](https://studio.frootai.dev/builder?recipe=31-multi-cloud-cost-report&areas=azure,mongodb&prompt=Pull%20Azure%20cost%20data%2C%20store%20it%20read-only%20in%20MongoDB%2C%20and%20produce%20a%20multi-cloud%20monthly%20cost%20report.)

## Security note

| Server | Credential | Scope | Blast radius if leaked |
|--------|-----------|-------|------------------------|
| `azure` | `AZURE_*` (SP or `az login`) | Cost Management **read** | spend data read on the subscription |
| `mongodb` | `MDB_MCP_CONNECTION_STRING` | collection read (`MDB_MCP_READ_ONLY=true`) | read access to the snapshots DB |

Both servers run **read-only** here. Scope the Azure principal to **Cost
Management Reader** and set `MDB_MCP_READ_ONLY=true` so MongoDB can't mutate the
snapshot history. Keep the connection string + Azure credentials in the
environment, never in the play manifest or args.

## Notes

- **Multi-cloud baseline**: because the MongoDB cache is cloud-agnostic, you can
  store AWS/GCP cost snapshots in the same collection and report all clouds in
  one pass — point the collector at each provider's cost API.
- **Swap-ins**: add **MS Learn** (see
  [Recipe 29](./29-azure-resource-audit.md)) to attach cost-optimization
  guidance per flagged service.
