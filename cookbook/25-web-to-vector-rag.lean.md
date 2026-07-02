# Recipe 25: Web-to-Vector RAG (Firecrawl + Qdrant + OpenAI Docs)

> Build an agentic ingestion pipeline that **scrapes** the web with Firecrawl,
> **stores** the embeddings in Qdrant, and grounds answers against **OpenAI's
> developer docs** — three verified-publisher MCP servers in one play.

## What You'll Build

A play that turns a list of URLs (or a whole site) into a queryable vector
memory and answers questions over it:

1. **Firecrawl** scrapes / crawls the target pages into clean markdown.
2. **Qdrant** stores each chunk as a memory (`qdrant-store`) and retrieves the
   relevant ones at query time (`qdrant-find`).
3. **OpenAI Docs** (hosted) grounds any OpenAI-API questions that come up while
   wiring the embedding/inference calls.

## Why Compose These Three?

| Server | Trust | Role |
|--------|-------|------|
| `firecrawl` | verified-publisher | Ingest: scrape / crawl / extract |
| `qdrant` | verified-publisher | Store + semantic retrieval |
| `openai` | verified-publisher | Reference: OpenAI developer docs (read-only) |

Firecrawl is the *ingest* stage, Qdrant is the *memory* stage; the OpenAI Docs
server is a read-only reference so the agent uses correct API shapes when it
generates the embedding/inference glue.

## Prerequisites

- A Firecrawl API key and a Qdrant URL + API key (or a local Qdrant)
- `uv` / Python on PATH (Qdrant's server runs via `uvx mcp-server-qdrant`)
- Node 18+ (Firecrawl runs via `npx -y firecrawl-mcp`)

## Step 1 — Declare the MCP scope

```yaml
---
description: "Agentic web-to-vector RAG ingestion + retrieval"
tools: ["terminal", "file", "search"]
mcp_scope:
  attached: ["firecrawl", "qdrant", "openai"]
  router_config:
    detach_on_finish: true
---
```

## Step 2 — Credentials (env only, doctrine #6)

```bash
export FIRECRAWL_API_KEY="fc-..."
export QDRANT_URL="https://xyz.cloud.qdrant.io:6333"
export QDRANT_API_KEY="..."
export COLLECTION_NAME="web-rag"
# OpenAI Docs server is hosted + public — no credential.
```

## Step 3 — Ingest

```text
1. firecrawl.firecrawl_crawl { url: "https://docs.example.com/**", limit: 100 }
   → poll firecrawl.firecrawl_check_crawl_status until done.
2. For each returned page, chunk the markdown, then
   qdrant.qdrant-store { information: <chunk>, collection_name: "web-rag",
                         metadata: { url } }.
```

## Step 4 — Retrieve + answer

```text
On a user question:
  1. qdrant.qdrant-find { query: <question>, collection_name: "web-rag" }
  2. Synthesize a cited answer from the returned memories.
  3. If the question is about the OpenAI API itself, also call
     openai.search / openai.fetch against the docs server.
```

## Step 5 — Validate

```bash
cd frootai-core
node scripts/marketplace/run-marketplace-tests.js   # specs + trust green
```

## Notes

- **No destructive tools** in this composition — Firecrawl, Qdrant (store/find),
  and the OpenAI Docs server are all non-mutating reads/appends. Set
  `QDRANT_READ_ONLY=true` to disable `qdrant-store` for a pure-retrieval variant.
- **Swap-ins**: use **Pinecone** or **Chroma** instead of Qdrant for the memory
  stage (Recipe 26 compares them), or **Tavily** instead of Firecrawl for
  search-style ingestion (Recipe 24).
