---
description: "Knowledge Graph RAG domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Knowledge Graph RAG — Domain Knowledge

This workspace implements knowledge graph-enhanced RAG — entity extraction, relationship mapping, graph traversal for multi-hop reasoning, and hybrid retrieval (graph + vector).

## Knowledge Graph RAG Architecture (What the Model Gets Wrong)

### Graph + Vector Hybrid Retrieval
```python
# WRONG — vector-only RAG (misses relationships between entities)
chunks = vector_search(query)  # Finds similar text, not connections

# CORRECT — graph traversal + vector search combined
async def graph_rag_retrieve(query: str) -> list:
    # 1. Extract entities from query
    entities = extract_entities(query)  # ["Azure OpenAI", "private endpoints"]
    
    # 2. Graph traversal — find related entities (1-2 hops)
    graph_results = []
    for entity in entities:
        neighbors = graph.query(f"MATCH (n)-[r]->(m) WHERE n.name = '{entity}' RETURN m, r LIMIT 10")
        graph_results.extend(neighbors)
    
    # 3. Vector search — find semantically similar chunks
    vector_results = vector_search(query, top_k=5)
    
    # 4. Merge and deduplicate
    combined = merge_results(graph_results, vector_results)
    return combined
```

### Entity Extraction + Relationship Mapping
```python
# LLM extracts entities and relationships from documents
EXTRACTION_PROMPT = """Extract entities and relationships from this text.
Output JSON: {"entities": [{"name": "...", "type": "..."}], "relationships": [{"source": "...", "target": "...", "type": "..."}]}"""

# Example output:
# {"entities": [{"name": "Azure OpenAI", "type": "Service"}, {"name": "GPT-4o", "type": "Model"}],
#  "relationships": [{"source": "Azure OpenAI", "target": "GPT-4o", "type": "hosts"}]}
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Vector-only RAG | Can't answer "how is X related to Y?" | Graph traversal for relationships |
| Deep graph traversal (>3 hops) | Exponential result explosion, slow | Limit to 2 hops max |
| No entity normalization | "Azure OpenAI" vs "OpenAI Service" = duplicates | Canonical entity names + aliases |
| LLM for all graph queries | Slow, expensive | Use Cypher/Gremlin for deterministic traversal |
| No relationship types | All edges are generic "related_to" | Typed relationships: "hosts", "depends_on", "owned_by" |
| Graph without vector | Misses semantic similarity | Hybrid: graph for structure, vector for meaning |
| No graph visualization | Users can't explore connections | Expose graph explorer UI |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | Entity extraction model, generation model |
| `config/search.json` | Graph depth, vector top_k, merge strategy |
| `config/guardrails.json` | Max hops, entity confidence threshold |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement graph construction, entity extraction, hybrid retrieval |
| `@reviewer` | Audit graph quality, relationship accuracy, traversal performance |
| `@tuner` | Optimize graph depth, entity resolution, query performance |

## Slash Commands
`/deploy` — Deploy graph RAG | `/test` — Test multi-hop queries | `/review` — Audit graph quality | `/evaluate` — Measure retrieval accuracy
