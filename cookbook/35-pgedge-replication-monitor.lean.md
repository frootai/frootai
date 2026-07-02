# Recipe 35: pgEdge Replication Monitor (pgEdge + Elastic)

> Compose two MCP servers into one health check: query live replication state
> from the distributed Postgres cluster with **pgEdge**, correlate it against the
> replication event logs in **Elastic**, and emit a replication-health report
> that flags lagging or diverged nodes — from one FrootAI play.

## What You'll Build

A solution play whose agent attaches two MCP servers and runs a
**measure → correlate → report** loop:

1. **pgEdge** queries the cluster's replication state — per-node lag, slot
   status, and last-applied LSN — straight from the system views.
2. **Elastic** searches the replication/error logs for the same window
   (conflicts, slot drops, retry storms) to explain *why* a node lags.
3. The agent joins the two and emits a health report with per-node status and
   the correlated log evidence.

This is a canonical composition recipe — no single server does the job; the
value is in the federation.

## Goal

Turn **live cluster state + replication logs into a health verdict** in one play
run: the agent measures per-node lag from pgEdge, correlates it with Elastic log
events, and flags nodes at risk. No single server can do this — pgEdge sees state
but not the log history, Elastic has the logs but not the live cluster view.

## Areas attached

| Server | Trust | Role in the loop |
|--------|-------|------------------|
| `pgedge` | verified-publisher | Query live replication state per node |
| `elastic` | verified-publisher | Correlate replication events/errors from logs |

pgEdge handles *measure* (cluster → live replication state), Elastic handles
*correlate* (logs → why a node lags). The agent joins them and writes one health
report. (Two servers is the minimum for a composition; each plays a distinct
role.)

The slugs match the marketplace specs under
[`frootai/orchard/registry/mcp-specs/{pgedge,elastic}.json`](../orchard/registry/mcp-specs/).

## Prerequisites

- FrootAI repo cloned; an existing or new play under `frootai/solution-plays/`.
- pgEdge connection details (read access) and an Elasticsearch endpoint + API
  key (read access to the replication log indices).

## Step 1 — Declare the MCP scope on the play

In the play's `agent.md` frontmatter, attach both servers so the engine wires
them before the first turn:

```yaml
---
description: "Monitor pgEdge replication health, correlated with Elastic logs"
tools: ["terminal", "file", "search"]
mcp_scope:
  attached: ["pgedge", "elastic"]
  router_config:
    detach_on_finish: true
---
```

## Step 2 — Provide credentials

Each server reads its credential from the environment (never inline in args —
doctrine #6):

```bash
export PGEDGE_DB_HOST="..."
export PGEDGE_DB_NAME="..."
export PGEDGE_DB_USER="..."
export PGEDGE_DB_PASSWORD="..."
export PGEDGE_DB_SSLMODE="require"   # keep TLS on
export ES_URL="https://your-cluster:9200"
export ES_API_KEY="..."             # read access to the replication log indices
```

## Step 3 — The monitor loop (agent prompt sketch)

```text
1. Call pgedge.query_database (read-only) for replication state:
   per-node lag, slot active/inactive, last-applied LSN, conflicts.
2. For any node with lag above threshold:
   a. Call elastic.search over the replication log indices for that node +
      time window (conflicts, slot drops, retry/backoff events).
3. Join live state with the correlated log evidence per node.
Finally:
  - Emit a health report: per-node status (ok / lagging / diverged), the lag
    figure, and the explaining log events.
```

## Step 4 — Validate the attach plan

```bash
cd frootai-core
node scripts/marketplace/validate-spec.smoke.test.js   # specs are well-formed
# Trust: both are verified-publisher. This recipe is read-only — pgEdge runs
# inside a read-only transaction by default; do NOT set PGEDGE_DB_ALLOW_WRITES.
```

## Step 5 — Run it

Activate the play (e.g. on a schedule); the engine attaches pgEdge + Elastic, and
the agent runs the loop. The output is a replication-health report you can route
to on-call or a dashboard.

## Sample output

```markdown
# Replication Health — cluster "edge-prod" (3 nodes)

| Node | Status | Lag | Evidence |
|------|--------|-----|----------|
| n1 (primary) | ✅ ok | 0 | — |
| n2 (eu-west) | ✅ ok | 0.4s | within threshold |
| n3 (us-east) | ⚠️ lagging | 42s | Elastic: 18 × "apply conflict" 14:05–14:20 |

1 node flagged. n3 lag correlates with an apply-conflict burst — investigate the
conflicting write on n3.
```

> The full sample is committed at
> [`recipes-mcp-composition/35-pgedge-replication-monitor/sample-output.md`](./recipes-mcp-composition/35-pgedge-replication-monitor/sample-output.md)
> (added in [X8.13]).

## Cost estimate

Assuming **100 invocations/month**, a few state + log queries per run:

| Cost source | Per run | × 100/mo |
|-------------|---------|----------|
| pgEdge queries (~3, read-only) | $0.00 (cluster cost) | $0.00 |
| Elastic search (~3 per lagging node) | $0.00 (cluster cost) | $0.00 |
| Model tokens (correlation + report, ~9k in / 1k out) | ~$0.04 | ~$4.00 |
| **Total** | **~$0.04** | **~$4.00 / mo** |

FrootAI-side cost is model tokens only; pgEdge + Elastic queries hit your own
infrastructure with no marginal per-run charge.

## The `mcp_scope.attached` snippet

Copy this into your own play's `agent.md` frontmatter:

```yaml
mcp_scope:
  attached: ["pgedge", "elastic"]
  router_config:
    detach_on_finish: true
```

## Open in Studio

Launch this recipe in the [FrootAI Studio builder](https://studio.frootai.dev/builder?recipe=35-pgedge-replication-monitor&areas=pgedge,elastic&prompt=Monitor%20pgEdge%20replication%20lag%20and%20ship%20the%20metrics%20to%20Elastic%20for%20alerting.) — the deep link
pre-fills the agent prompt and surfaces the recipe's `mcp_scope` areas
(`pgedge`, `elastic`) so you start from the recipe instead of a blank canvas:

[**▶ Open in Studio**](https://studio.frootai.dev/builder?recipe=35-pgedge-replication-monitor&areas=pgedge,elastic&prompt=Monitor%20pgEdge%20replication%20lag%20and%20ship%20the%20metrics%20to%20Elastic%20for%20alerting.)

## Security note

| Server | Credential | Scope | Blast radius if leaked |
|--------|-----------|-------|------------------------|
| `pgedge` | `PGEDGE_DB_*` | DB **read** (read-only txn) | read access to the cluster |
| `elastic` | `ES_API_KEY` | index **read** | read access to the log indices |

Both run **read-only** here. **Do not set `PGEDGE_DB_ALLOW_WRITES`** — keep
pgEdge in its default read-only transaction so a monitor run can never mutate the
cluster. Keep `PGEDGE_DB_SSLMODE=require` and leave Elastic TLS verification on.
Keep all credentials in the environment, never in the play manifest or args.

## Notes

- **Threshold tuning**: set the lag threshold per node role (a geo-distant
  replica tolerates more lag than a same-region one) to cut false alarms.
- **Swap-ins**: add **MS Learn** (see
  [Recipe 29](./29-azure-resource-audit.md)) for remediation guidance, or
  **GitHub** (see [Recipe 28](./28-browser-screenshot-to-bug-report.md)) to open
  an issue when a node diverges.
