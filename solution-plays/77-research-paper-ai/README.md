# Play 77 — Research Paper AI 📚

> AI research assistant — multi-source paper search, structured extraction, thematic literature review, citation network analysis, research gap identification.

Build an intelligent research assistant. Search across Semantic Scholar, arXiv, PubMed, and Crossref simultaneously, extract structured data (objective, methodology, findings, limitations), synthesize thematic literature reviews with verified citations, and identify research gaps grounded in paper limitations.

## Quick Start
```bash
cd solution-plays/77-research-paper-ai
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .
# Use @builder to implement, @reviewer to audit, @tuner to optimize
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure OpenAI (gpt-4o) | Paper extraction + synthesis + gap analysis |
| Azure AI Search (Standard) | Paper index with semantic search |
| Semantic Scholar / arXiv / PubMed | Multi-source academic paper search |
| Cosmos DB (Serverless) | Paper metadata, extraction cache |
| Container Apps | Research AI API |

## Pre-Tuned Defaults
- Search: 4 sources · top 50 papers · relevance threshold 0.7 · dedup by DOI
- Extraction: 6 structured fields · full-text preferred · quantitative results included
- Synthesis: Thematic grouping · APA citations · 3000 max words · compare/contrast
- Gaps: 3-5 per review · evidence-required · 5 gap types

## DevKit (AI-Assisted Development)
| Primitive | What It Does |
|-----------|-------------|
| `agent.md` | Root orchestrator with builder→reviewer→tuner handoffs |
| `copilot-instructions.md` | Research domain (multi-source search, citation verification, thematic synthesis pitfalls) |
| 3 agents | Builder (gpt-4o), Reviewer (gpt-4o-mini), Tuner (gpt-4o-mini) |
| 3 skills | Deploy (200+ lines), Evaluate (125+ lines), Tune (230+ lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` with agent routing |

## Cost Estimate
| Environment | Monthly |
|-------------|---------|
| Dev/Test | $20–50 |
| Production (50 reviews) | $300–400 |

## vs. Play 01 (Enterprise RAG)
| Aspect | Play 01 | Play 77 |
|--------|---------|---------|
| Focus | Enterprise document Q&A | Academic paper research |
| Data Source | Internal documents | Semantic Scholar, arXiv, PubMed |
| Output | Single answer with citations | Literature review + gap analysis |
| Citation | Internal document references | DOI-verified academic citations |

📖 [Full documentation](spec/README.md) · 🌐 [frootai.dev/solution-plays/77-research-paper-ai](https://frootai.dev/solution-plays/77-research-paper-ai) · 📦 [FAI Protocol](spec/fai-manifest.json)
