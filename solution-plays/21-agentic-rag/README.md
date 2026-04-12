# Play 21 — Agentic RAG 🧠

> Autonomous retrieval — the agent decides when, what, and where to search.

Unlike standard RAG (Play 01) with a fixed pipeline, Agentic RAG gives the AI agent full control over retrieval. It decides IF search is needed, WHICH sources to query (AI Search, Bing, SQL, APIs), ITERATES on results if insufficient, and self-evaluates groundedness before responding.

## Quick Start
```bash
cd solution-plays/21-agentic-rag
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .  # Use @builder for retrieval agent, @reviewer for citation audit, @tuner for routing
```

## How It Differs from Standard RAG
| Aspect | Play 01 (Standard RAG) | Play 21 (Agentic RAG) |
|--------|----------------------|----------------------|
| Search decision | Always search | Agent decides IF needed |
| Source selection | Single fixed source | Agent picks from multiple |
| Iteration | One-shot retrieval | Agent iterates if insufficient |
| Self-evaluation | None | Agent checks groundedness |
| Multi-source | No | AI Search + Bing + SQL + APIs |
| Caching | No | Semantic cache (60% cost savings) |

## Architecture
| Service | Purpose |
|---------|---------|
| Azure OpenAI (gpt-4o) | Agent with tool-calling for autonomous retrieval |
| Azure AI Search | Primary knowledge base |
| Bing Web Search | Fallback for current/external info |
| Redis Cache | Semantic caching for repeated patterns |
| Container Apps | Agent hosting |

## Key Metrics
- Groundedness: ≥0.90 · Source accuracy: ≥90% · Avg hops: <2.0 · Cache hit: ≥40%

## DevKit (Agentic Retrieval-Focused)
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (multi-source routing/iteration), Reviewer (citation/groundedness), Tuner (routing weights/cache/cost) |
| 3 skills | Deploy (110 lines), Evaluate (104 lines), Tune (104 lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` with agent routing |

## Cost
| Dev | Prod | With Caching |
|-----|------|-------------|
| $150–300/mo | $2K–8K/mo | 40-60% savings from semantic cache |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/21-agentic-rag](https://frootai.dev/solution-plays/21-agentic-rag)
