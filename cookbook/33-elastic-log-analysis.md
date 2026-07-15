# Recipe 33: Elastic Log Analysis (Elastic + Context7 + MS Learn)

> Compose three MCP servers into one production-debugging loop: query the error
> logs with **Elastic**, ground the failing library/API against version-pinned
> docs with **Context7**, and pull platform remediation guidance from
> **MS Learn** — turning a noisy log spike into a root-cause + fix report from one
> FrootAI play.

## What You'll Build

A solution play whose agent attaches three MCP servers and runs a
**query → ground → remediate** loop:

1. **Elastic** searches the log indices for the error pattern + surrounding
   context (frequency, first/last seen, correlated fields).
2. **Context7** resolves the current docs for the library/API in the stack trace
   so the diagnosis is grounded — not guessed.
3. **MS Learn** fetches the platform/Azure best-practice + troubleshooting
   guidance for the failing component.

This is a canonical composition recipe — no single server does the job; the
value is in the federation.

## Goal

Turn a **log spike into a root-cause + remediation report** in one play run: the
agent finds the error in Elastic, grounds the failing API against current docs,
and pulls the platform fix guidance. No single server can do this — Elastic can't
explain the API, Context7 can't see your logs, MS Learn can't query your cluster.

## Areas attached

| Server | Trust | Role in the loop |
|--------|-------|------------------|
| `elastic` | verified-publisher | Query the log indices for the error + context |
| `context7` | verified-publisher | Ground the failing library/API against docs |
| `ms-learn` | first-party-ms | Fetch platform remediation/troubleshooting docs |

Elastic handles *find* (logs → the error in context), Context7 handles *ground*
(stack trace → versioned API docs), MS Learn handles *remediate* (component →
platform fix guidance). The agent queries, grounds, and writes one report.

The slugs match the marketplace specs under
[`frootai/orchard/registry/mcp-specs/{elastic,context7,ms-learn}.json`](../orchard/registry/mcp-specs/).

## Prerequisites

- FrootAI repo cloned; an existing or new play under `frootai/solution-plays/`.
- An Elasticsearch endpoint + API key (read access to the log indices) and a
  Context7 API key. MS Learn is public and needs no credential.

## Step 1 — Declare the MCP scope on the play

In the play's `agent.md` frontmatter, attach all three servers so the engine
wires them before the first turn:

```yaml
---
description: "Debug a production error from logs → grounded root-cause + fix"
tools: ["terminal", "file", "search"]
mcp_scope:
  attached: ["elastic", "context7", "ms-learn"]
  router_config:
    detach_on_finish: true
---
```

## Step 2 — Provide credentials

Each server reads its credential from the environment (never inline in args —
doctrine #6). MS Learn needs none:

```bash
export ES_URL="https://your-cluster:9200"
export ES_API_KEY="..."          # read access to the log indices
export CONTEXT7_API_KEY="ctx7-..."
```

## Step 3 — The debugging loop (agent prompt sketch)

```text
1. Call elastic.search / esql on the log indices for the error pattern;
   gather frequency, first/last seen, and correlated fields (service, version).
2. Extract the failing library/API + version from the stack trace.
3. Call context7.resolve-library-id + get-library-docs to ground the
   diagnosis against the current API.
4. Call ms-learn.microsoft_docs_search + fetch for platform troubleshooting
   guidance for the failing component.
Finally:
  - Emit a report: symptom, root cause (grounded), remediation steps, the
    doc links, and the log query used.
```

## Step 4 — Validate the attach plan

```bash
cd frootai-core
node scripts/marketplace/validate-spec.smoke.test.js   # specs are well-formed
# Trust: elastic + context7 are verified-publisher, ms-learn is first-party-ms.
# The loop is read-only (search/docs), no destructive tools.
```

## Step 5 — Run it

Activate the play; the engine attaches Elastic + Context7 + MS Learn, and the
agent runs the loop. The output is a root-cause + remediation report you can
hand to on-call.

## Sample output

```markdown
# Incident Report — "504 spike on /checkout" (logs-prod-*)

**Symptom:** 1,240 × HTTP 504 from gateway, 14:02–14:31 UTC.

**Root cause (grounded):** Upstream Node service timing out on a Cosmos DB
call; the SDK's default `requestTimeout` is below the p99 latency.
- Context7: /azure/cosmos — "CosmosClientOptions.requestTimeout"

**Remediation (MS Learn):** Raise the SDK timeout + enable retry on 429/503.
- learn.microsoft.com/azure/cosmos-db/... — "SDK retry + timeout tuning"

**Query used:** `status:504 AND path:"/checkout"` over the incident window.
```

> The full sample is committed at
> [`recipes-mcp-composition/33-elastic-log-analysis/sample-output.md`](./recipes-mcp-composition/33-elastic-log-analysis/sample-output.md)
> (added in [X8.13]).

## Cost estimate

Assuming **100 invocations/month**, a few log queries + doc lookups per run:

| Cost source | Per run | × 100/mo |
|-------------|---------|----------|
| Elastic search (~4 queries) | $0.00 (cluster cost) | $0.00 |
| Context7 docs lookups (~3/run) | ~$0.00 (free tier) | ~$0.00 |
| MS Learn doc fetches (~3/run) | $0.00 (public) | $0.00 |
| Model tokens (log triage + synthesis, ~14k in / 1.5k out) | ~$0.06 | ~$6.00 |
| **Total** | **~$0.06** | **~$6.00 / mo** |

FrootAI-side cost is model tokens only; Elastic queries hit your own cluster,
Context7 free tier and MS Learn add no marginal cost.

## The `mcp_scope.attached` snippet

Copy this into your own play's `agent.md` frontmatter:

```yaml
mcp_scope:
  attached: ["elastic", "context7", "ms-learn"]
  router_config:
    detach_on_finish: true
```

## Open in Studio

Launch this recipe in the [FrootAI Studio builder](https://studio.frootai.dev/builder?recipe=33-elastic-log-analysis&areas=elastic,context7,ms-learn&prompt=Analyze%20recent%20Elastic%20logs%2C%20correlate%20errors%20with%20library%20docs%20via%20Context7%2C%20and%20ground%20fixes%20in%20MS%20Learn%20guidance.) — the deep link
pre-fills the agent prompt and surfaces the recipe's `mcp_scope` areas
(`elastic`, `context7`, `ms-learn`) so you start from the recipe instead of a blank canvas:

[**▶ Open in Studio**](https://studio.frootai.dev/builder?recipe=33-elastic-log-analysis&areas=elastic,context7,ms-learn&prompt=Analyze%20recent%20Elastic%20logs%2C%20correlate%20errors%20with%20library%20docs%20via%20Context7%2C%20and%20ground%20fixes%20in%20MS%20Learn%20guidance.)

## Security note

| Server | Credential | Scope | Blast radius if leaked |
|--------|-----------|-------|------------------------|
| `elastic` | `ES_API_KEY` | index **read** | read access to the log indices |
| `context7` | `CONTEXT7_API_KEY` | docs read-only | doc-lookup quota usage |
| `ms-learn` | none | public docs | none — public content only |

Scope the Elastic API key to **read-only** on the log indices — this recipe
never writes. **Do not set `ES_SSL_SKIP_VERIFY`**; keep TLS verification on so
the cluster connection can't be MITM'd. Keep all credentials in the environment,
never in the play manifest or args.

## Notes

- **Bound the query**: always constrain `elastic.search` by time window + index
  pattern so a broad error term doesn't scan the whole cluster.
- **Swap-ins**: add **GitHub** (see
  [Recipe 28](./28-browser-screenshot-to-bug-report.md)) to open an issue with
  the report, or **Notion** (see [Recipe 24](./24-research-to-notion.md)) to file
  the postmortem.
