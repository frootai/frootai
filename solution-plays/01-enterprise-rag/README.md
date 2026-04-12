# Play 01 — Enterprise RAG Q&A 🔍

> Production RAG with hybrid search, semantic reranking, and pre-tuned guardrails.

Build a production-grade Retrieval-Augmented Generation system. AI Search indexes your documents, GPT-4o generates grounded answers with citations, and Container Apps hosts the API.

## Quick Start
```bash
# 1. Clone and navigate
cd solution-plays/01-enterprise-rag

# 2. Deploy infrastructure
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json

# 3. Open in VS Code with Copilot
code .
# Use @builder to implement, @reviewer to audit, @tuner to optimize
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure AI Search | Hybrid search (BM25 + vector + semantic reranking) |
| Azure OpenAI (gpt-4o) | Grounded response generation with citations |
| Container Apps | API hosting with auto-scaling |
| Blob Storage | Document storage and indexing source |

## Pre-Tuned Defaults
- Temperature: 0.1 · Top-k: 5 · Hybrid weights: 60/40 (vector/keyword)
- Chunking: 512 tokens, semantic strategy, 10% overlap
- Guardrails: Groundedness ≥0.8, Relevance ≥0.7, Content Safety enabled

## DevKit (AI-Assisted Development)
| Primitive | What It Does |
|-----------|-------------|
| `agent.md` | Root orchestrator with builder→reviewer→tuner handoffs |
| `copilot-instructions.md` | RAG domain knowledge (hybrid search, chunking, Azure SDK pitfalls) |
| 3 agents | Builder (implements), Reviewer (audits security + quality), Tuner (optimizes config) |
| 3 skills | Deploy (106 lines), Evaluate (153 lines), Tune (167 lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` |

## Cost Estimate
| Environment | Monthly |
|-------------|---------|
| Dev/Test | $150–300 |
| Production | $2K–8K |

📖 [Full documentation](spec/README.md) · 🌐 [frootai.dev/solution-plays/01-enterprise-rag](https://frootai.dev/solution-plays/01-enterprise-rag) · 📦 [FAI Protocol](spec/fai-manifest.json)
