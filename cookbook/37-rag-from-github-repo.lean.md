# Recipe 37: RAG from a GitHub Repo (GitHub + Markitdown + Azure AI Search)

> Compose three MCP servers into one ingestion pipeline: pull a repository's
> files with **GitHub**, normalize every document to clean Markdown with
> **Markitdown**, and index the result as a searchable vector store with
> **Azure AI Search** — turning any repo into a queryable RAG corpus from one
> FrootAI play.

> **Numbering note**: the masterplan called this `27-rag-from-github-repo.md`,
> but slot `27` was already taken by
> [`27-submit-mcp-spec.md`](./27-submit-mcp-spec.md). Per the
> [authoring guide](../docs/cookbook/recipes-mcp-composition.md) numbering rule
> ("claim the next free number; do not reuse 24–27"), this recipe lands at `37`.

## What You'll Build

A solution play whose agent attaches three MCP servers and runs an
**fetch → normalize → index** pipeline:

1. **GitHub** lists + reads the repository's files (docs, READMEs, source) at a
   given ref — no local clone required.
2. **Markitdown** converts every non-Markdown document (PDF, Office, notebooks,
   images) to clean Markdown so the chunker sees uniform text.
3. **Azure AI Search** chunks + embeds the Markdown and upserts it into a vector
   index you can query for grounded retrieval.

This is a canonical composition recipe — no single server does the job; the
value is in the federation.

## Goal

Turn a **GitHub repository into a queryable vector index** in one play run: the
agent fetches the repo's documents, normalizes them to Markdown, and upserts
embeddings into an Azure AI Search index ready for RAG. No single server can do
this — GitHub can't embed, Markitdown can't index, Azure AI Search can't read
your private repo.

## Areas attached

| Server | Trust | Role in the loop |
|--------|-------|------------------|
| `github` | first-party-ms | List + read the repo's files at a ref |
| `markitdown` | first-party-ms | Normalize every document → Markdown |
| `azure` | first-party-ms | Chunk + embed + upsert into an AI Search index |

GitHub handles *fetch* (repo → files), Markitdown handles *normalize* (binary →
text), Azure AI Search handles *index* (text → vector store). The agent walks
the file tree, converts as needed, and batches upserts.

The slugs match the marketplace specs under
[`frootai/orchard/registry/mcp-specs/{github,markitdown,azure}.json`](../orchard/registry/mcp-specs/).

## Prerequisites

- FrootAI repo cloned; an existing or new play under `frootai/solution-plays/`.
- A GitHub token (read access to the target repo) and an Azure subscription with
  an AI Search service. Markitdown runs locally and needs no credential.

## Step 1 — Declare the MCP scope on the play

In the play's `agent.md` frontmatter, attach all three servers so the engine
wires them before the first turn:

```yaml
---
description: "Ingest a GitHub repo into an Azure AI Search vector index"
tools: ["terminal", "file", "search"]
mcp_scope:
  attached: ["github", "markitdown", "azure"]
  router_config:
    detach_on_finish: true
---
```

## Step 2 — Provide credentials

Each server reads its credential from the environment (never inline in args —
doctrine #6). Markitdown needs none:

```bash
export GITHUB_TOKEN="ghp_..."
export AZURE_SUBSCRIPTION_ID="..."
# Azure auth: either `az login` or a service principal
export AZURE_TENANT_ID="..."
export AZURE_CLIENT_ID="..."
export AZURE_CLIENT_SECRET="..."
```

## Step 3 — The ingestion loop (agent prompt sketch)

```text
1. Call github.list/read to enumerate the repo's files at the target ref.
For each document file:
  2. If it is not already Markdown (PDF/Office/notebook/image), call
     markitdown.convert_to_markdown → Markdown body.
  3. Chunk the Markdown (~800 tokens, 100 overlap); keep the source path +
     ref as metadata.
Finally:
  - Call the azure AI Search data-plane to embed + upsert the chunks into the
    target index; report the document + chunk counts.
```

## Step 4 — Validate the attach plan

```bash
cd frootai-core
node scripts/marketplace/validate-spec.smoke.test.js   # specs are well-formed
# Trust: all three are first-party-ms → attach without prompt; destructive
# Azure tools still confirm per call under allowDestructive: false.
```

## Step 5 — Run it

Activate the play; the engine merges the `mcp_scope.attached` list, attaches
GitHub + Markitdown + Azure, and the agent runs the pipeline. The output is a
populated Azure AI Search index you can query for grounded retrieval.

## Sample output

```markdown
# Ingestion Report — github.com/acme/widgets @ main

- Files scanned: 142
- Converted via Markitdown: 18 (PDF: 6, .docx: 9, .ipynb: 3)
- Chunks upserted to index `widgets-rag`: 1,204
- Skipped (binary/unsupported): 7

Index `widgets-rag` is ready. Sample query "how do I configure retries?"
returns 5 chunks from docs/reliability.md + src/client.ts.
```

> The full sample is committed at
> [`recipes-mcp-composition/37-rag-from-github-repo/sample-output.md`](./recipes-mcp-composition/37-rag-from-github-repo/sample-output.md)
> (added in [X8.13]).

## Cost estimate

Assuming **100 invocations/month**, one ~150-file repo per run:

| Cost source | Per run | × 100/mo |
|-------------|---------|----------|
| GitHub reads (~150 calls) | $0.00 (token quota) | $0.00 |
| Markitdown (local convert, ~18 docs) | $0.00 | $0.00 |
| Embeddings (~1,200 chunks × 800 tok) | ~$0.10 | ~$10.00 |
| Azure AI Search (Basic tier, prorated) | ~$0.10 | ~$10.00 |
| Model tokens (orchestration) | ~$0.02 | ~$2.00 |
| **Total** | **~$0.22** | **~$22.00 / mo** |

FrootAI-side cost is model tokens; embeddings + the AI Search service are the
Azure-metered components and dominate at volume. GitHub reads and local
Markitdown add no marginal cost.

## The `mcp_scope.attached` snippet

Copy this into your own play's `agent.md` frontmatter:

```yaml
mcp_scope:
  attached: ["github", "markitdown", "azure"]
  router_config:
    detach_on_finish: true
```

## Open in Studio

Launch this recipe in the [FrootAI Studio builder](https://studio.frootai.dev/builder?recipe=37-rag-from-github-repo&areas=github,markitdown,azure&prompt=Index%20a%20GitHub%20repo%3A%20convert%20its%20docs%20to%20Markdown%20and%20build%20a%20RAG%20index%20in%20Azure%20AI%20Search.) — the deep link
pre-fills the agent prompt and surfaces the recipe's `mcp_scope` areas
(`github`, `markitdown`, `azure`) so you start from the recipe instead of a blank canvas:

[**▶ Open in Studio**](https://studio.frootai.dev/builder?recipe=37-rag-from-github-repo&areas=github,markitdown,azure&prompt=Index%20a%20GitHub%20repo%3A%20convert%20its%20docs%20to%20Markdown%20and%20build%20a%20RAG%20index%20in%20Azure%20AI%20Search.)

## Security note

| Server | Credential | Scope | Blast radius if leaked |
|--------|-----------|-------|------------------------|
| `github` | `GITHUB_TOKEN` | repo read | read access to whatever repos the token can see |
| `markitdown` | none | local file/URI read | reads only the paths you pass it |
| `azure` | `AZURE_*` (SP or `az login`) | AI Search data-plane | index read/write on the subscription |

All three are `first-party-ms`. Scope the GitHub token to **read-only** on the
target repo, and the Azure service principal to **just the AI Search resource**.
Keep all credentials in the environment, never in the play manifest or args.
Azure's destructive tools (delete index, etc.) still confirm per call under
`allowDestructive: false`.

## Notes

- **Incremental re-index**: pass a `since` ref so GitHub only returns files
  changed since the last run; upsert by stable chunk id to avoid duplicates.
- **Swap-ins**: replace Azure AI Search with **Qdrant** or **Pinecone** (see
  [Recipe 25](./25-web-to-vector-rag.md)) if you want a self-hosted vector store.
