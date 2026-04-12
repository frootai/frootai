# Play 26 — Semantic Search Engine 🔎

> Backend search-as-a-service with embedding pipeline, query expansion, and personalization.

A semantic search engine consumed as an API by other services. Embedding pipeline indexes documents into vector + keyword fields, hybrid search combines BM25 + vector + semantic reranking, query expansion handles synonyms and spelling, and personalization re-ranks based on user profiles.

## Quick Start
```bash
cd solution-plays/26-semantic-search-engine
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .  # Use @builder for index/embeddings, @reviewer for relevance audit, @tuner for scoring
```

## How It Differs from Play 09 (Search Portal)
| Aspect | Play 09 (Portal) | Play 26 (Engine) |
|--------|-----------------|------------------|
| Focus | End-user UI with facets | Backend API for other services |
| UI | Autocomplete, filters | API-only (JSON in, JSON out) |
| Personalization | Basic | User profile-based re-ranking |
| Query expansion | None | Synonym + LLM-based |
| Multi-tenant | No | Tenant-isolated indices |

## Architecture
| Service | Purpose |
|---------|---------|
| Azure AI Search | Hybrid index (vector + keyword + semantic) |
| Azure OpenAI (embeddings) | Document + query embedding pipeline |
| Container Apps | Search-as-a-service API hosting |
| Redis Cache | User profile and query caching |

## Key Metrics
- NDCG@10: ≥0.75 · Zero-result: <3% · Latency p95: <400ms · Personalization lift: ≥10%

## DevKit (Search Engine-Focused)
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (index/embedding/scoring), Reviewer (relevance/access/freshness), Tuner (scoring/expansion/personalization/cost) |
| 3 skills | Deploy (107 lines), Evaluate (105 lines), Tune (103 lines) |
| 4 prompts | `/deploy` (index + pipeline), `/test` (query quality), `/review` (relevance), `/evaluate` (NDCG/MRR) |

## Cost
| Dev | Prod (1M queries/day) |
|-----|-----------------------|
| $100–250/mo | ~$3.6K/mo (no expansion) to ~$5.1K/mo (with smart expansion) |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/26-semantic-search-engine](https://frootai.dev/solution-plays/26-semantic-search-engine)
