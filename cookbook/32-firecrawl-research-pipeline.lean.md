# Recipe 32: Firecrawl Research Pipeline (Firecrawl + Tavily + Context7)

> One play, three MCP servers: **Firecrawl** crawls/scrapes seed sites, **Tavily** broadens with live web search, and **Context7** grounds technical claims in version-pinned docs to produce a multi-source research brief.

## What You'll Build

A play whose agent attaches three MCP servers and runs a **crawl → broaden → ground → synthesize** pipeline:

1. **Firecrawl** turns the seed URLs you provide into clean Markdown via deep crawl/scrape.
2. **Tavily** fills gaps with open-web search (news, benchmarks, adjacent vendors) and citations.
3. **Context7** resolves authoritative, version-correct docs for any named library/framework so claims are grounded.

This is a composition recipe: no single server does all of it.

## Goal

Turn a **set of seed URLs into a cited, grounded research brief** in one run: deep-scrape seeds, fill coverage gaps with web search, and verify technical claims against current docs. Firecrawl can't ground against versioned docs, Tavily can't deep-crawl a site, and Context7 can't browse the open web.

## Areas attached

| Server | Trust | Role in the loop |
|--------|-------|------------------|
| `firecrawl` | verified-publisher | Deep crawl/scrape the seed sites → Markdown |
| `tavily-ai` | verified-publisher | Broaden with live web search + citations |
| `context7` | verified-publisher | Ground claims against version-pinned docs |

Firecrawl = depth, Tavily = breadth, Context7 = grounding. The agent crawls, broadens, grounds, and writes one brief.

The slugs match the marketplace specs under
[`frootai/orchard/registry/mcp-specs/{firecrawl,tavily-ai,context7}.json`](../orchard/registry/mcp-specs/).

## Prerequisites

- FrootAI repo cloned; an existing or new play under `frootai/solution-plays/`.
- A Firecrawl API key, a Tavily API key, and a Context7 API key.

## Step 1 — Declare the MCP scope on the play

In the play's `agent.md` frontmatter, attach all three servers so the engine wires them before the first turn:

```yaml
---
description: "Deep multi-source research brief: crawl + search + ground"
tools: ["terminal", "file", "search"]
mcp_scope:
  attached: ["firecrawl", "tavily-ai", "context7"]
  router_config:
    detach_on_finish: true
---
```

## Step 2 — Provide credentials

Each server reads its credential from the environment (never inline in args — doctrine #6):

```bash
export FIRECRAWL_API_KEY="fc-..."
export TAVILY_API_KEY="tvly-..."
export CONTEXT7_API_KEY="ctx7-..."
```

## Step 3 — The research loop (agent prompt sketch)

```text
1. Call firecrawl_crawl / firecrawl_scrape on the seed URLs → Markdown corpus.
2. Identify coverage gaps + open questions from the corpus.
For each gap:
  3. Call tavily-ai.tavily-search; keep the top 3 citations.
For each technical/library claim:
  4. Call context7.resolve-library-id + get-library-docs; verify the claim.
Finally:
  - Emit a research brief: themes (H2), grounded paragraphs, a sources list
    (crawled URLs + Tavily citations + Context7 doc ids).
```

## Step 4 — Validate the attach plan

```bash
cd frootai-core
node scripts/marketplace/validate-spec.smoke.test.js   # specs are well-formed
# Trust: all three are verified-publisher → attach without prompt. The loop
# is read-only (scrape/search/docs), no destructive tools.
```

## Step 5 — Run it

Activate the play; the engine attaches Firecrawl + Tavily + Context7, and the agent runs the pipeline. The output is a cited research brief you can paste into a doc or deck.

## Sample output

```markdown
# Research Brief — "Edge vector databases, 2026" (4 seeds + 6 web sources)

## 1. Latency profiles (crawled + grounded)
Firecrawl extracted the vendor benchmark pages; Context7 confirmed the client
API shapes against current docs (qdrant ≥ 1.12).
- Crawled: vendor-a.com/benchmarks, vendor-b.io/latency
- Context7: /qdrant/qdrant — "gRPC client, payload indexing"

## 2. Pricing shifts (web-enriched)
Tavily surfaced two 2026 pricing changes not on the seed sites.
- https://example.com/vendor-a-pricing-2026
- https://example.com/edge-db-cost-analysis
```

> The full sample is committed at
> [`recipes-mcp-composition/32-firecrawl-research-pipeline/sample-output.md`](./recipes-mcp-composition/32-firecrawl-research-pipeline/sample-output.md)
> (added in [X8.13]).

## Cost estimate

Assuming **100 invocations/month**, ~4 seed crawls + ~6 searches per run:

| Cost source | Per run | × 100/mo |
|-------------|---------|----------|
| Firecrawl (~4 crawl/scrape jobs) | ~$0.05 | ~$5.00 |
| Tavily search (~6/run) | ~$0.048 (6 × $0.008) | ~$4.80 |
| Context7 docs lookups (~5/run) | ~$0.00 (free tier) | ~$0.00 |
| Model tokens (synthesis, ~16k in / 2k out) | ~$0.08 | ~$8.00 |
| **Total** | **~$0.18** | **~$17.80 / mo** |

FrootAI-side cost is model tokens; Firecrawl + Tavily are the third-party metered calls and scale with crawl depth + search count.

## The `mcp_scope.attached` snippet

Copy this into your own play's `agent.md` frontmatter:

```yaml
mcp_scope:
  attached: ["firecrawl", "tavily-ai", "context7"]
  router_config:
    detach_on_finish: true
```

## Open in Studio

Launch this recipe in the [FrootAI Studio builder](https://studio.frootai.dev/builder?recipe=32-firecrawl-research-pipeline&areas=firecrawl,tavily-ai,context7&prompt=Crawl%20the%20target%20site%20with%20Firecrawl%2C%20enrich%20findings%20via%20Tavily%20search%2C%20ground%20them%20with%20Context7%20docs%2C%20and%20assemble%20a%20research%20brief.) — the deep link pre-fills the prompt and surfaces the recipe's `mcp_scope` areas (`firecrawl`, `tavily-ai`, `context7`) so you start from the recipe, not a blank canvas:

[**▶ Open in Studio**](https://studio.frootai.dev/builder?recipe=32-firecrawl-research-pipeline&areas=firecrawl,tavily-ai,context7&prompt=Crawl%20the%20target%20site%20with%20Firecrawl%2C%20enrich%20findings%20via%20Tavily%20search%2C%20ground%20them%20with%20Context7%20docs%2C%20and%20assemble%20a%20research%20brief.)

## Security note

| Server | Credential | Scope | Blast radius if leaked |
|--------|-----------|-------|------------------------|
| `firecrawl` | `FIRECRAWL_API_KEY` | crawl/scrape | crawl quota usage / billing |
| `tavily-ai` | `TAVILY_API_KEY` | web search | search quota usage / billing |
| `context7` | `CONTEXT7_API_KEY` | docs read-only | doc-lookup quota usage |

All three are `verified-publisher` and expose no destructive tools in this loop. Keep all three API keys in the environment, never in the play manifest or args. Only point Firecrawl at sites you are authorized to crawl, and respect each target's robots/ToS.

## Notes

- **Crawl budget**: cap `firecrawl_crawl` depth + page count so a large site doesn't blow the per-run cost; prefer `firecrawl_map` first to scope the crawl.
- **Swap-ins**: replace Tavily with another search source, or add **Notion** (see [Recipe 24](./24-research-to-notion.md)) to publish the brief as a page.
