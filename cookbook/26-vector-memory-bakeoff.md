# Recipe 26: Vector-Memory Bake-off (Pinecone + Chroma)

> Attach two vector-database MCP servers side by side — **Pinecone** (managed)
> and **Chroma** (embedded/self-hosted) — and let one agent write the same
> memories to both, so you can compare retrieval quality, latency, and cost
> before committing to one.

## What You'll Build

A play that runs an A/B comparison of two verified-publisher vector stores:

1. The agent ingests the same corpus into **Pinecone** (`upsert-records`) and
   **Chroma** (`chroma_add_documents`).
2. It runs identical queries against both (`search-records` vs
   `chroma_query_documents`).
3. It reports a side-by-side of the results so you can choose.

## Why Compose These Two?

| Server | Trust | Profile |
|--------|-------|---------|
| `pinecone` | verified-publisher | Fully-managed, serverless, integrated inference |
| `chromadb` | verified-publisher | Embedded / self-hosted, simple, great for local dev |

Same job (vector memory), very different operational profiles. Running both
behind one agent removes the guesswork from "which vector DB should we adopt?".

## Prerequisites

- A Pinecone API key (`PINECONE_API_KEY`)
- Node 18+ (Pinecone runs via `npx -y @pinecone-database/mcp`)
- `uv` / Python on PATH (Chroma runs via `uvx chroma-mcp`)

## Step 1 — Declare the MCP scope

```yaml
---
description: "A/B bake-off across Pinecone and Chroma vector memories"
tools: ["terminal", "file", "search"]
mcp_scope:
  attached: ["pinecone", "chromadb"]
  router_config:
    detach_on_finish: true
---
```

## Step 2 — Credentials (env only, doctrine #6)

```bash
export PINECONE_API_KEY="..."
# Chroma defaults to an ephemeral local client — no credential needed.
# For Chroma Cloud: export CHROMA_CLIENT_TYPE=cloud + CHROMA_API_KEY/TENANT/DATABASE
```

## Step 3 — Dual ingest

```text
For each document in the corpus:
  - pinecone.upsert-records { name: "bakeoff", records: [{ id, text }] }
  - chromadb.chroma_add_documents { collection_name: "bakeoff",
                                    documents: [text], ids: [id] }
```

## Step 4 — Dual query + compare

```text
For each evaluation query:
  - A = pinecone.search-records { name: "bakeoff",
                                  query: { inputs: { text }, topK: 5 } }
  - B = chromadb.chroma_query_documents { collection_name: "bakeoff",
                                          query_texts: [text], n_results: 5 }
  - Diff the ranked ids; record overlap@5 + which store ranked the gold doc higher.
```

## Step 5 — Validate

```bash
cd frootai-core
node scripts/marketplace/run-marketplace-tests.js
```

## Notes

- **Destructive-action audit**: Chroma exposes destructive tools
  (`chroma_delete_collection`, `chroma_delete_documents`) which confirm per call
  under `allowDestructive: false`; Pinecone's tools are non-destructive. Tear
  down the Chroma `bakeoff` collection explicitly when finished.
- **Swap-ins**: substitute **Qdrant** for either store, or feed the corpus from
  **Firecrawl** (Recipe 25) instead of a static file list.
