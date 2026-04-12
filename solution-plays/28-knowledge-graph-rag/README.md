# Play 28 — Knowledge Graph RAG 🕸️

> Graph-based RAG with entity extraction, relationship mapping, and multi-hop traversal.

Instead of vector similarity (Play 01) or agent-controlled search (Play 21), Knowledge Graph RAG builds a graph of entities and relationships, then traverses the graph to find context for multi-hop reasoning queries like "Who does Alice's manager report to?"

## Quick Start
```bash
cd solution-plays/28-knowledge-graph-rag
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .  # Use @builder for graph construction, @reviewer for entity audit, @tuner for traversal
```

## How It Differs from Other RAG Plays
| Aspect | Play 01 (Vector) | Play 21 (Agentic) | Play 28 (Graph) |
|--------|-----------------|-------------------|----------------|
| Retrieval | Similarity search | Agent-controlled multi-source | Graph traversal |
| Best for | "Find similar" | "Search and iterate" | "Who/what connects to X?" |
| Data model | Flat chunks | Flat + sources | Entities + relationships |
| Multi-hop | No | Limited | Native (2-3 hops) |

## Architecture
| Service | Purpose |
|---------|---------|
| Cosmos DB (Gremlin API) | Knowledge graph storage (vertices + edges) |
| Azure OpenAI (gpt-4o) | Entity extraction + relationship mapping |
| Azure AI Search | Vector component for hybrid retrieval |
| Container Apps | Graph RAG API hosting |

## Key Metrics
- Entity F1: ≥0.85 · Relationship precision: ≥0.80 · Multi-hop: ≥75% · Graph vs vector lift: ≥15%

## DevKit (Graph RAG-Focused)
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (entity extraction/graph/traversal), Reviewer (graph quality/entity resolution), Tuner (depth/hybrid weights/cost) |
| 3 skills | Deploy (103 lines), Evaluate (105 lines), Tune (101 lines) |
| 4 prompts | `/deploy` (graph + extraction), `/test` (traversal), `/review` (entity accuracy), `/evaluate` (multi-hop quality) |

## Cost
| Dev | Prod (50K docs) |
|-----|-----------------|
| $100–250/mo | ~$330/mo (ongoing) + $250 one-time extraction |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/28-knowledge-graph-rag](https://frootai.dev/solution-plays/28-knowledge-graph-rag)
