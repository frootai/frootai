# Recipe 29: Azure Resource Audit (Azure + MS Learn)

> Compose two MCP servers into one governance pass: enumerate a subscription's
> live resources with **Azure**, fetch the authoritative best-practice guidance
> for each resource type from **MS Learn**, and emit a per-resource audit that
> maps what you have against what Microsoft recommends — from one FrootAI play.

## What You'll Build

A solution play whose agent attaches two MCP servers and runs an
**enumerate → ground → audit** loop:

1. **Azure** lists the resources in a subscription (or resource group) with
   their types, SKUs, regions, and key config.
2. **MS Learn** fetches the current Well-Architected / best-practice
   documentation for each distinct resource type — no hallucinated guidance.
3. The agent cross-references the two and emits an audit: each resource, the
   relevant best-practice, and whether the live config follows it.

This is a canonical composition recipe — no single server does the job; the
value is in the federation.

## Goal

Turn a **live subscription into a grounded audit report** in one play run: the
agent inventories your Azure resources, pulls Microsoft's own best-practice docs
per resource type, and flags gaps. No single server can do this — Azure can't
cite best practices, MS Learn can't see your subscription.

## Areas attached

| Server | Trust | Role in the loop |
|--------|-------|------------------|
| `azure` | first-party-ms | Enumerate live resources + their config |
| `ms-learn` | first-party-ms | Fetch authoritative best-practice docs per type |

Azure handles *enumerate* (subscription → resource inventory), MS Learn handles
*ground* (resource type → official guidance). The agent joins them and writes a
single audit. (Two servers is the minimum for a composition; each plays a
distinct role.)

The slugs match the marketplace specs under
[`frootai/orchard/registry/mcp-specs/{azure,ms-learn}.json`](../orchard/registry/mcp-specs/).

## Prerequisites

- FrootAI repo cloned; an existing or new play under `frootai/solution-plays/`.
- An Azure subscription with read access. MS Learn is public and needs no
  credential.

## Step 1 — Declare the MCP scope on the play

In the play's `agent.md` frontmatter, attach both servers so the engine wires
them before the first turn:

```yaml
---
description: "Audit Azure resources against Microsoft best-practice docs"
tools: ["terminal", "file", "search"]
mcp_scope:
  attached: ["azure", "ms-learn"]
  router_config:
    detach_on_finish: true
---
```

## Step 2 — Provide credentials

Each server reads its credential from the environment (never inline in args —
doctrine #6). MS Learn needs none:

```bash
export AZURE_SUBSCRIPTION_ID="..."
# Azure auth: either `az login` or a read-only service principal
export AZURE_TENANT_ID="..."
export AZURE_CLIENT_ID="..."
export AZURE_CLIENT_SECRET="..."
```

## Step 3 — The audit loop (agent prompt sketch)

```text
1. Call the azure resource APIs to list resources in scope (type, SKU, region,
   key config flags).
2. Build the distinct set of resource types present.
For each distinct type:
  3. Call ms-learn.microsoft_docs_search + microsoft_docs_fetch for the
     Well-Architected / best-practice guidance for that type.
For each resource:
  4. Compare live config against the fetched guidance; record pass / gap.
Finally:
  - Emit an audit table: resource, type, best-practice, status, the doc link.
```

## Step 4 — Validate the attach plan

```bash
cd frootai-core
node scripts/marketplace/validate-spec.smoke.test.js   # specs are well-formed
# Trust: both are first-party-ms → attach without prompt. This recipe only
# reads — no destructive Azure tools are invoked.
```

## Step 5 — Run it

Activate the play; the engine merges the `mcp_scope.attached` list, attaches
Azure + MS Learn, and the agent runs the loop. The output is a per-resource
audit you can hand to your platform team.

## Sample output

```markdown
# Azure Resource Audit — sub `acme-prod` (42 resources)

| Resource | Type | Best practice | Status | Doc |
|----------|------|---------------|--------|-----|
| kv-acme-prod | Key Vault | Purge protection ON | ✅ pass | learn.microsoft.com/azure/key-vault/... |
| st-acme-logs | Storage | Disallow public blob access | ⚠️ gap | learn.microsoft.com/azure/storage/... |
| app-acme-api | App Service | HTTPS-only + min TLS 1.2 | ✅ pass | learn.microsoft.com/azure/app-service/... |

3 gaps found across 42 resources. See per-row docs for remediation.
```

> The full sample is committed at
> [`recipes-mcp-composition/29-azure-resource-audit/sample-output.md`](./recipes-mcp-composition/29-azure-resource-audit/sample-output.md)
> (added in [X8.13]).

## Cost estimate

Assuming **100 invocations/month**, one ~40-resource subscription per run:

| Cost source | Per run | × 100/mo |
|-------------|---------|----------|
| Azure resource reads (~50 calls) | $0.00 (ARM quota) | $0.00 |
| MS Learn doc fetches (~10/run) | $0.00 (public) | $0.00 |
| Model tokens (audit reasoning, ~12k in / 2k out) | ~$0.06 | ~$6.00 |
| **Total** | **~$0.06** | **~$6.00 / mo** |

FrootAI-side cost is model tokens only; Azure ARM reads and MS Learn fetches add
no marginal cost. Larger subscriptions scale the token cost, not the API cost.

## The `mcp_scope.attached` snippet

Copy this into your own play's `agent.md` frontmatter:

```yaml
mcp_scope:
  attached: ["azure", "ms-learn"]
  router_config:
    detach_on_finish: true
```

## Open in Studio

Launch this recipe in the [FrootAI Studio builder](https://studio.frootai.dev/builder?recipe=29-azure-resource-audit&areas=azure,ms-learn&prompt=Audit%20my%20Azure%20subscription's%20resources%20against%20Well-Architected%20guidance%20and%20produce%20a%20prioritized%20remediation%20report%20grounded%20in%20MS%20Learn.) — the deep link
pre-fills the agent prompt and surfaces the recipe's `mcp_scope` areas
(`azure`, `ms-learn`) so you start from the recipe instead of a blank canvas:

[**▶ Open in Studio**](https://studio.frootai.dev/builder?recipe=29-azure-resource-audit&areas=azure,ms-learn&prompt=Audit%20my%20Azure%20subscription's%20resources%20against%20Well-Architected%20guidance%20and%20produce%20a%20prioritized%20remediation%20report%20grounded%20in%20MS%20Learn.)

## Security note

| Server | Credential | Scope | Blast radius if leaked |
|--------|-----------|-------|------------------------|
| `azure` | `AZURE_*` (SP or `az login`) | resource **read** | inventory read on the subscription |
| `ms-learn` | none | public docs | none — public content only |

Both are `first-party-ms`. Scope the Azure principal to **Reader** on the target
subscription — this recipe never writes. Keep credentials in the environment,
never in the play manifest or args. MS Learn reads only public Microsoft docs.

## Notes

- **Scope down**: pass a resource-group filter to audit one workload at a time
  and keep the token cost bounded.
- **Swap-ins**: add **Markitdown** to convert a fetched PDF compliance standard,
  or **GitHub** (see [Recipe 28](./28-browser-screenshot-to-bug-report.md)) to
  file each gap as an issue.
