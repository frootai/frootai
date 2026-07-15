# Recipe 34: Vector DB Comparison (Qdrant + ChromaDB + Pinecone)

> Compose three vector-store MCP servers behind one agent and run the **same
> corpus + the same query set** against each — **Qdrant**, **ChromaDB**, and
> **Pinecone** — to compare recall, latency, and cost on your own data before you
> commit to a store. A bake-off recipe from one FrootAI play.

> **Substitution note**: the masterplan called for Qdrant + ChromaDB +
> **LanceDB**, but LanceDB has no marketplace attach spec yet. Per the
> [authoring guide](../docs/cookbook/recipes-mcp-composition.md) (every attached
> slug must match a marketplace spec), the third store is **Pinecone** — the
> available `verified-publisher` vector store. Swap it back to LanceDB once a
> spec lands.

## What You'll Build

A solution play whose agent attaches three vector stores and runs a
**index → query → score** bake-off:

1. The agent indexes the **same embedded corpus** into Qdrant, ChromaDB, and
   Pinecone.
2. It runs the **same query set** against each store.
3. It scores each on recall@k, latency, and cost, and emits a comparison.

Unlike most composition recipes (where each server plays a distinct role), this
is a **bake-off**: the three servers are interchangeable and the value is the
side-by-side comparison on *your* data.

## Goal

Pick a vector store with **evidence, not vibes**: run an identical workload
against three stores and get a recall/latency/cost table for your corpus. No
single store can tell you how it compares to the others — only an apples-to-apples
bake-off can.

## Areas attached

| Server | Trust | Role in the loop |
|--------|-------|------------------|
| `qdrant` | verified-publisher | Candidate vector store A |
| `chromadb` | verified-publisher | Candidate vector store B |
| `pinecone` | verified-publisher | Candidate vector store C |

All three play the *same* role — they are the candidates under test. The agent
drives an identical index + query workload across them and scores the results.

The slugs match the marketplace specs under
[`frootai/orchard/registry/mcp-specs/{qdrant,chromadb,pinecone}.json`](../orchard/registry/mcp-specs/).

## Prerequisites

- FrootAI repo cloned; an existing or new play under `frootai/solution-plays/`.
- A reachable Qdrant instance, a ChromaDB instance, and a Pinecone API key/index.
- A small embedded corpus + a labelled query set (query → expected doc ids) so
  recall is measurable.

## Step 1 — Declare the MCP scope on the play

In the play's `agent.md` frontmatter, attach all three stores so the engine
wires them before the first turn:

```yaml
---
description: "Benchmark Qdrant vs ChromaDB vs Pinecone on one corpus"
tools: ["terminal", "file", "search"]
mcp_scope:
  attached: ["qdrant", "chromadb", "pinecone"]
  router_config:
    detach_on_finish: true
---
```

## Step 2 — Provide credentials

Each server reads its credential from the environment (never inline in args —
doctrine #6):

```bash
export QDRANT_URL="http://localhost:6333"     # + QDRANT_API_KEY if secured
export CHROMA_URL="http://localhost:8000"
export PINECONE_API_KEY="pc-..."
```

## Step 3 — The bake-off loop (agent prompt sketch)

```text
1. For each store in [qdrant, chromadb, pinecone]:
     a. Upsert the same embedded corpus into a fresh collection/index.
2. For each labelled query:
     a. Run it against all three stores (same top-k).
     b. Record recall@k vs. the expected doc ids + the query latency.
3. Aggregate per store: mean recall@k, p50/p95 latency, est. cost.
Finally:
  - Emit a comparison table + a one-line recommendation for this corpus.
```

## Step 4 — Validate the attach plan

```bash
cd frootai-core
node scripts/marketplace/validate-spec.smoke.test.js   # specs are well-formed
# Trust: all three are verified-publisher → attach without prompt. Use a
# throwaway collection/index name so the bake-off never touches prod data.
```

## Step 5 — Run it

Activate the play; the engine attaches Qdrant + ChromaDB + Pinecone, and the
agent runs the bake-off. The output is a recall/latency/cost table you can use to
choose a store.

## Sample output

```markdown
# Vector DB Bake-off — corpus "support-kb" (12k docs, 200 labelled queries)

| Store | Recall@10 | p50 latency | p95 latency | Est. cost/mo |
|-------|-----------|-------------|-------------|--------------|
| Qdrant | 0.94 | 11 ms | 28 ms | self-host |
| ChromaDB | 0.91 | 9 ms | 24 ms | self-host |
| Pinecone | 0.95 | 18 ms | 41 ms | ~$70 (s1) |

Recommendation: Qdrant — best recall/latency balance for a self-hosted corpus
this size; Pinecone wins marginal recall at a managed-cost premium.
```

> The full sample is committed at
> [`recipes-mcp-composition/34-vector-db-comparison/sample-output.md`](./recipes-mcp-composition/34-vector-db-comparison/sample-output.md)
> (added in [X8.13]).

## Cost estimate

Assuming **100 invocations/month**, one ~12k-doc corpus + 200 queries per run:

| Cost source | Per run | × 100/mo |
|-------------|---------|----------|
| Qdrant (self-host) | $0.00 marginal | $0.00 |
| ChromaDB (self-host) | $0.00 marginal | $0.00 |
| Pinecone (managed index) | ~$0.10 prorated | ~$10.00 |
| Embeddings (corpus, amortized) | ~$0.05 | ~$5.00 |
| Model tokens (orchestration + scoring, ~8k in / 1k out) | ~$0.03 | ~$3.00 |
| **Total** | **~$0.18** | **~$18.00 / mo** |

FrootAI-side cost is model tokens + embeddings; Pinecone is the managed-store
component. Self-hosted Qdrant/ChromaDB add only infrastructure you already run.

## The `mcp_scope.attached` snippet

Copy this into your own play's `agent.md` frontmatter:

```yaml
mcp_scope:
  attached: ["qdrant", "chromadb", "pinecone"]
  router_config:
    detach_on_finish: true
```

## Open in Studio

Launch this recipe in the [FrootAI Studio builder](https://studio.frootai.dev/builder?recipe=34-vector-db-comparison&areas=qdrant,chromadb,pinecone&prompt=Run%20the%20same%20embedding%20workload%20across%20Qdrant%2C%20ChromaDB%2C%20and%20Pinecone%20and%20produce%20a%20recall%2C%20latency%2C%20and%20cost%20comparison.) — the deep link
pre-fills the agent prompt and surfaces the recipe's `mcp_scope` areas
(`qdrant`, `chromadb`, `pinecone`) so you start from the recipe instead of a blank canvas:

[**▶ Open in Studio**](https://studio.frootai.dev/builder?recipe=34-vector-db-comparison&areas=qdrant,chromadb,pinecone&prompt=Run%20the%20same%20embedding%20workload%20across%20Qdrant%2C%20ChromaDB%2C%20and%20Pinecone%20and%20produce%20a%20recall%2C%20latency%2C%20and%20cost%20comparison.)

## Security note

| Server | Credential | Scope | Blast radius if leaked |
|--------|-----------|-------|------------------------|
| `qdrant` | `QDRANT_API_KEY` (if secured) | collection read/write | the bake-off collection only |
| `chromadb` | `CHROMA_API_KEY` (if secured) | collection read/write | the bake-off collection only |
| `pinecone` | `PINECONE_API_KEY` | index read/write | indexes on the Pinecone project |

All three are `verified-publisher`. Use a **throwaway collection/index name** so
the bake-off never reads or overwrites production vectors, and scope the Pinecone
key to a non-prod project. Keep all credentials in the environment, never in the
play manifest or args.

## Notes

- **Fair comparison**: use the *same* embedding model + the *same* top-k across
  all three stores, or the recall numbers aren't comparable.
- **Swap-ins**: drop in any other vector-store spec as a fourth candidate, or
  restore LanceDB once it has a marketplace spec.
