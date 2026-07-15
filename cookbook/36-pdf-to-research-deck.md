# Recipe 36: PDF to Research Deck (Markitdown + Context7 + Tavily)

> Compose three MCP servers into one research loop: convert a source **PDF** to
> clean Markdown with **Markitdown**, ground every claim against current,
> version-pinned library docs with **Context7**, and enrich with live web
> context + citations from **Tavily** — emitting a single cited research summary
> from one FrootAI play.

> **Numbering note**: the masterplan called this `26-pdf-to-research-deck.md`,
> but slot `26` was already taken by the Phase X4 preview
> [`26-vector-memory-bakeoff.md`](./26-vector-memory-bakeoff.md). Per the
> [authoring guide](../docs/cookbook/recipes-mcp-composition.md) numbering rule
> ("claim the next free number; do not reuse 24–27"), this recipe lands at `36`.

## What You'll Build

A solution play whose agent attaches three MCP servers and runs an
**ingest → ground → enrich → summarize** loop:

1. **Markitdown** converts the input PDF (or Office/image) to Markdown so the
   agent can read it as text — no OCR plumbing, no PDF parsing in the agent.
2. **Context7** resolves authoritative, version-correct documentation for any
   libraries/frameworks named in the PDF (no hallucinated APIs).
3. **Tavily** searches the open web for recent context the PDF and Context7
   don't cover (release notes, benchmarks, news) and returns citations.

This is a canonical composition recipe — no single server does the job; the
value is in the federation.

## Goal

Turn an arbitrary source PDF into a **cited research summary** in one play run:
the agent extracts the PDF's content, grounds the technical claims against
current docs, fills gaps with fresh web search, and emits a structured summary
with citations. No single server can do this — Markitdown can't search, Context7
can't read your PDF, Tavily can't ground against version-pinned docs.

## Areas attached

| Server | Trust | Role in the loop |
|--------|-------|------------------|
| `markitdown` | first-party-ms | Convert the source PDF → Markdown the agent can read |
| `context7` | verified-publisher | Grounded, version-correct library docs |
| `tavily-ai` | verified-publisher | Fresh web context + citations |

Markitdown handles *ingestion* (binary → text); Context7 + Tavily cover
*grounding* (version-pinned docs + open web). The agent decides which retriever
to call per claim and writes one consolidated summary at the end.

The slugs match the marketplace specs under
[`frootai/orchard/registry/mcp-specs/{markitdown,context7,tavily-ai}.json`](../orchard/registry/mcp-specs/).

## Prerequisites

- FrootAI repo cloned; an existing or new play under `frootai/solution-plays/`.
- A source PDF reachable by path or URI.
- A Context7 API key and a Tavily API key. Markitdown runs locally and needs no
  credential.

## Step 1 — Declare the MCP scope on the play

In the play's `agent.md` frontmatter, attach all three servers so the engine
wires them before the first turn:

```yaml
---
description: "Research assistant: PDF → grounded, cited research summary"
tools: ["terminal", "file", "search"]
mcp_scope:
  attached: ["markitdown", "context7", "tavily-ai"]
  router_config:
    detach_on_finish: true
---
```

## Step 2 — Provide credentials

Each server reads its credential from the environment (never inline in args —
doctrine #6). Markitdown needs none:

```bash
export CONTEXT7_API_KEY="ctx7-..."
export TAVILY_API_KEY="tvly-..."
```

## Step 3 — The research loop (agent prompt sketch)

```text
1. Call markitdown.convert_to_markdown on the source PDF URI → Markdown body.
2. Extract the key claims + the libraries/frameworks named in the body.
For each claim:
  3. If it names a library, call context7.resolve-library-id +
     context7.get-library-docs and verify the claim against current docs.
  4. If the claim is about ecosystem/news/benchmarks, call
     tavily-ai.tavily-search and keep the top 3 citations.
Finally:
  - Emit a research summary: one H2 per theme, each with a grounded paragraph
    and a citations bullet list (doc id or URL).
```

## Step 4 — Validate the attach plan

```bash
cd frootai-core
node scripts/marketplace/validate-spec.smoke.test.js   # specs are well-formed
# Trust: markitdown is first-party-ms, context7 + tavily-ai are
# verified-publisher → all attach without prompt.
```

## Step 5 — Run it

Activate the play; the engine merges the `mcp_scope.attached` list, attaches
Markitdown + Context7 + Tavily, and the agent runs the loop. The output is a
cited research summary you can paste into a deck or doc.

## Sample output

```markdown
# Research Summary — "Streaming LLM Inference at the Edge" (source.pdf)

## 1. KV-cache offloading (grounded)
The paper's claim that vLLM supports paged KV-cache offloading to host RAM is
confirmed against current docs (vllm ≥ 0.6).
- Context7: /vllm-project/vllm — "PagedAttention + CPU offload"

## 2. Edge runtime options (web-enriched)
The PDF predates WebGPU-backed runtimes; Tavily surfaced two 2026 options.
- https://example.com/webgpu-llm-2026
- https://example.com/edge-inference-benchmark
```

> The full sample is committed at
> [`recipes-mcp-composition/36-pdf-to-research-deck/sample-output.md`](./recipes-mcp-composition/36-pdf-to-research-deck/sample-output.md)
> (added in [X8.13]).

## Cost estimate

Assuming **100 invocations/month**, one ~20-page PDF per run:

| Cost source | Per run | × 100/mo |
|-------------|---------|----------|
| Markitdown (local convert) | $0.00 | $0.00 |
| Context7 docs lookups (~5/run) | ~$0.00 (free tier) | ~$0.00 |
| Tavily search (~3/run) | ~$0.024 (3 × $0.008) | ~$2.40 |
| Model tokens (synthesis, ~8k in / 1k out) | ~$0.03 | ~$3.00 |
| **Total** | **~$0.05** | **~$5.40 / mo** |

FrootAI-side cost is model tokens; Tavily is the only third-party metered call.
Markitdown and the Context7 free tier add no marginal cost at this volume.

## The `mcp_scope.attached` snippet

Copy this into your own play's `agent.md` frontmatter:

```yaml
mcp_scope:
  attached: ["markitdown", "context7", "tavily-ai"]
  router_config:
    detach_on_finish: true
```

## Open in Studio

Launch this recipe in the [FrootAI Studio builder](https://studio.frootai.dev/builder?recipe=36-pdf-to-research-deck&areas=markitdown,context7,tavily-ai&prompt=Convert%20the%20source%20PDF%20to%20Markdown%2C%20enrich%20it%20with%20Context7%20docs%20and%20Tavily%20search%2C%20and%20assemble%20a%20research%20deck.) — the deep link
pre-fills the agent prompt and surfaces the recipe's `mcp_scope` areas
(`markitdown`, `context7`, `tavily-ai`) so you start from the recipe instead of a blank canvas:

[**▶ Open in Studio**](https://studio.frootai.dev/builder?recipe=36-pdf-to-research-deck&areas=markitdown,context7,tavily-ai&prompt=Convert%20the%20source%20PDF%20to%20Markdown%2C%20enrich%20it%20with%20Context7%20docs%20and%20Tavily%20search%2C%20and%20assemble%20a%20research%20deck.)

## Security note

| Server | Credential | Scope | Blast radius if leaked |
|--------|-----------|-------|------------------------|
| `markitdown` | none | local file/URI read | reads only the path you pass it |
| `context7` | `CONTEXT7_API_KEY` | docs read-only | doc-lookup quota usage |
| `tavily-ai` | `TAVILY_API_KEY` | web search | search quota usage / billing |

All three are `verified-publisher` or higher and expose no destructive tools in
this loop. Keep both API keys in the environment, never in the play manifest or
args. Markitdown reads local files — only pass it paths you intend it to read.

## Notes

- **Swap-ins**: replace Tavily with **Firecrawl** for deep multi-page crawls, or
  add **Qdrant**/**Pinecone** to cache embeddings of what you retrieved (see
  [Recipe 25](./25-web-to-vector-rag.md)).
- **Inputs**: Markitdown also converts Office docs, images, and audio — the same
  loop works for a slide deck or a scanned report.
