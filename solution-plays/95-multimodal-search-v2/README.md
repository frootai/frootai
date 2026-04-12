# Play 95 — Multimodal Search V2 🔎

> Unified multimodal search — text+image+audio+video indexing, cross-modal retrieval, late fusion ranking, personalized results.

Build a unified multimodal search engine. Per-modality encoders (text-embedding-3-large, CLIP, Whisper) create embeddings across 4 content types, cross-modal retrieval enables searching images with text queries (and vice versa), late fusion with reciprocal rank fusion merges and re-ranks results, and user preference models personalize result ordering.

## Quick Start
```bash
cd solution-plays/95-multimodal-search-v2
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .
# Use @builder to implement, @reviewer to audit, @tuner to optimize
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure OpenAI | Text embedding + CLIP visual encoding |
| Azure AI Search (Standard) | 4 vector indices (text, image, audio, video) |
| Azure Speech (Whisper) | Audio → transcript for embedding |
| Azure AI Vision | Video key frame extraction |
| Azure Storage + CDN | Media files + delivery |
| Cosmos DB (Serverless) | User preferences, search analytics |

## Pre-Tuned Defaults
- Encoding: text-embedding-3-large (1536d) · CLIP ViT-L/14 (768d) · Whisper-large-v3
- Fusion: Reciprocal rank · text 40% / image 30% / audio 20% / video 10% · multi-modal bonus
- Cross-modal: CLIP shared space for text↔image · transcript embedding for text→audio/video
- Video: 1 fps key frames · scene detection · dual embedding (visual + transcript)

## DevKit (AI-Assisted Development)
| Primitive | What It Does |
|-----------|-------------|
| `agent.md` | Root orchestrator with builder→reviewer→tuner handoffs |
| `copilot-instructions.md` | Multimodal domain (cross-modal, late fusion, video processing) |
| 3 agents | Builder (gpt-4o), Reviewer (gpt-4o-mini), Tuner (gpt-4o-mini) |
| 3 skills | Deploy (225+ lines), Evaluate (110+ lines), Tune (225+ lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` with agent routing |

## Cost Estimate
| Environment | Monthly |
|-------------|---------|
| Dev/Test | $60–100 |
| Production (100K docs, 50K queries) | $350–450 |

## vs. Play 88 (Visual Product Search)
| Aspect | Play 88 | Play 95 |
|--------|---------|---------|
| Focus | Product image matching (retail) | Universal content search (all types) |
| Modalities | Image + text (2) | Text + image + audio + video (4) |
| Cross-Modal | Image↔text only | All combinations (text→any, image→video) |
| Fusion | Reranking weights | Late fusion with reciprocal rank |

📖 [Full documentation](spec/README.md) · 🌐 [frootai.dev/solution-plays/95-multimodal-search-v2](https://frootai.dev/solution-plays/95-multimodal-search-v2) · 📦 [FAI Protocol](spec/fai-manifest.json)
