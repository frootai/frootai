# Play 88 — Visual Product Search 🔍

> AI visual commerce — image-based product matching, multi-modal search (image+text), shoppable image recognition, visual similarity ranking.

Build a visual product search engine. CLIP/Florence encodes product catalog into vector embeddings, AI Search provides sub-200ms vector similarity search, multi-modal fusion combines image + text queries ("blue version of this"), shoppable images detect individual products in lifestyle photos, and click-through feedback continuously improves ranking.

## Quick Start
```bash
cd solution-plays/88-visual-product-search
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .
# Use @builder to implement, @reviewer to audit, @tuner to optimize
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure OpenAI | CLIP/Florence visual encoding + attribute extraction |
| Azure AI Search (Standard) | Product vector index with HNSW |
| Azure CDN | Image delivery with resize transforms |
| Azure Content Safety | Moderate user-uploaded images |
| Cosmos DB (Serverless) | Product metadata, click-through analytics |
| Container Apps | Visual search API |

## Pre-Tuned Defaults
- Encoding: CLIP ViT-L/14 · 768-dim · background removal · center crop
- Search: HNSW index · cosine similarity · threshold 0.65 · top 10 results
- Reranking: Visual similarity 50% · in-stock 15% · popularity 15% · price 10% · recency 10%
- Multi-modal: Image 70% / text 30% · text overrides color/size/material

## DevKit (AI-Assisted Development)
| Primitive | What It Does |
|-----------|-------------|
| `agent.md` | Root orchestrator with builder→reviewer→tuner handoffs |
| `copilot-instructions.md` | Visual search domain (CLIP embeddings, multi-modal, shoppable images) |
| 3 agents | Builder (gpt-4o), Reviewer (gpt-4o-mini), Tuner (gpt-4o-mini) |
| 3 skills | Deploy (210+ lines), Evaluate (120+ lines), Tune (225+ lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` with agent routing |

## Cost Estimate
| Environment | Monthly |
|-------------|---------|
| Dev/Test | $30–60 |
| Production (50K queries) | $280–350 |

## vs. Play 09 (AI Search Portal)
| Aspect | Play 09 | Play 88 |
|--------|---------|---------|
| Focus | Text-based hybrid search | Image-based visual search |
| Query | Text keywords | Upload photo + optional text |
| Encoding | text-embedding-3-large | CLIP ViT-L/14 visual encoder |
| Use Case | Enterprise document search | Retail product discovery |

📖 [Full documentation](spec/README.md) · 🌐 [frootai.dev/solution-plays/88-visual-product-search](https://frootai.dev/solution-plays/88-visual-product-search) · 📦 [FAI Protocol](spec/fai-manifest.json)
