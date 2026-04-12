---
name: tune-knowledge-graph-rag
description: "Tune Knowledge Graph RAG — optimize graph traversal depth, entity resolution, hybrid graph+vector weights, extraction prompt, Gremlin query performance, cost. Use when: tune, optimize graph RAG."
---

# Tune Knowledge Graph RAG

## When to Use
- Optimize graph traversal depth (more hops = more context, higher latency)
- Tune entity resolution thresholds (when to merge similar entities)
- Configure hybrid graph+vector retrieval weights
- Improve entity extraction prompt quality
- Reduce Gremlin query latency and RU cost

## Tuning Dimensions

### Dimension 1: Graph Traversal Depth

| Max Hops | Context Size | Accuracy | Latency | Cost |
|----------|-------------|----------|---------|------|
| 1 | Small (direct neighbors) | Good for simple queries | < 100ms | Low |
| 2 | Medium (2 degrees) | Good for relationship queries | 100-300ms | Medium |
| 3 | Large (3 degrees) | Best for complex reasoning | 300-800ms | High |
| 4+ | Very large | Diminishing returns, noise | > 1s | Very high |

**Rule**: Default to 2 hops. Only use 3 for explicitly multi-hop queries. Never use 4+.

### Dimension 2: Entity Resolution

| Threshold | Behavior | Example |
|-----------|----------|---------|
| Strict (exact match) | Only merge identical names | "AWS" ≠ "Amazon Web Services" |
| Moderate (fuzzy + aliases) | Merge similar + known aliases | "AWS" = "Amazon Web Services" |
| Aggressive (embedding similarity) | Merge if embeddings similar | "ML" = "Machine Learning" |

Configuration:
```json
{
  "entity_resolution": {
    "method": "fuzzy_plus_aliases",
    "similarity_threshold": 0.85,
    "alias_dictionary": "config/entity-aliases.json",
    "case_sensitive": false
  }
}
```

### Dimension 3: Hybrid Graph+Vector Weights

| Configuration | Graph Weight | Vector Weight | Best For |
|--------------|-------------|--------------|---------|
| Graph-heavy | 0.7 | 0.3 | Relationship-heavy domains (org charts, supply chains) |
| Balanced | 0.5 | 0.5 | General-purpose knowledge bases |
| Vector-heavy | 0.3 | 0.7 | Content-heavy with few relationships |

**Tuning method**: Compare retrieval quality on test queries with each weight configuration.

### Dimension 4: Extraction Prompt Optimization

| Technique | Impact | Example |
|-----------|--------|---------|
| Entity type constraints | +20% precision | "Only extract: Person, Org, Product" |
| Relationship direction | +15% accuracy | "Alice reports_to Bob (not Bob reports_to Alice)" |
| Few-shot examples | +25% consistency | Include 2 examples of expected output |
| Confidence scores | Enables filtering | "Include confidence 0-1 per entity" |
| Negative examples | -30% false entities | "Do NOT extract generic concepts" |

### Dimension 5: Cost Optimization

| Component | Cost Driver | Optimization |
|-----------|------------|-------------|
| Entity extraction | GPT-4o tokens per doc | Batch documents, use gpt-4o-mini for simple docs |
| Graph storage | Cosmos DB RU/s | Set appropriate RU/s for read pattern |
| Graph traversal | Gremlin query complexity | Index key properties, limit hop depth |
| Embedding (hybrid) | Per-query embedding | Cache query embeddings for repeated queries |

**Monthly estimate** (50K documents, 10K queries/day):
- Entity extraction (one-time): ~$250 (gpt-4o for 50K docs)
- Cosmos DB (400 RU/s): ~$24/mo
- Query embeddings: ~$6/mo
- OpenAI generation: ~$300/mo
- **Total: ~$330/mo** (ongoing) + $250 (one-time extraction)

## Production Readiness Checklist
- [ ] Entity extraction F1 ≥ 0.85
- [ ] Relationship precision ≥ 0.80
- [ ] Entity resolution merging duplicates correctly
- [ ] Graph traversal (2 hops) < 300ms
- [ ] Hybrid graph+vector weights optimized
- [ ] Multi-hop queries resolving correctly (≥ 75%)
- [ ] Graph vs vector providing ≥ 15% lift on relationship queries
- [ ] Cosmos DB RU/s sized for query load
- [ ] Entity alias dictionary maintained

## Output: Tuning Report
After tuning, compare:
- Entity extraction accuracy improvement
- Graph traversal latency change
- Hybrid weight optimization results
- Multi-hop query success rate
- Cost per query reduction
