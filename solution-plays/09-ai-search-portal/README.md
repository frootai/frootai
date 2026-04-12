# Play 09 — AI Search Portal 🔎

> Enterprise search with hybrid ranking, GPT synthesis, and faceted navigation.

A search experience combining keyword matching with semantic understanding. AI Search handles retrieval with custom scoring profiles, GPT-4o synthesizes results into readable summaries with citations.

## Quick Start
```bash
cd solution-plays/09-ai-search-portal
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .  # Use @builder for index schema, @reviewer for relevance audit, @tuner for scoring
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure AI Search | Hybrid search (BM25 + vector + semantic reranking) |
| Azure OpenAI (gpt-4o) | Result synthesis with citations |
| App Service | Search portal frontend |
| Blob Storage | Document source for indexing |

## Key Metrics
- NDCG@10: ≥0.7 · Zero-result rate: <5% · Query latency p95: <500ms

## DevKit
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (index/search), Reviewer (relevance/access audit), Tuner (scoring/cost) |
| 3 skills | Deploy (128 lines), Evaluate (100 lines), Tune (104 lines) |

## Cost
| Dev | Prod |
|-----|------|
| $100–250/mo | $1K–5K/mo |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/09-ai-search-portal](https://frootai.dev/solution-plays/09-ai-search-portal)
