---
name: deploy-semantic-search-engine
description: "Deploy Semantic Search Engine — configure embedding pipeline, vector index, hybrid search, scoring profiles, query expansion, personalization API. Use when: deploy, provision search backend."
---

# Deploy Semantic Search Engine

## When to Use
- Deploy a semantic search-as-a-service backend
- Configure embedding pipeline for document ingestion
- Set up vector index with hybrid search (BM25 + vector + semantic)
- Design scoring profiles with boost functions
- Build query expansion and personalization layer

## How Play 26 Differs from Play 09 (Search Portal)
| Aspect | Play 09 (Search Portal) | Play 26 (Semantic Search Engine) |
|--------|----------------------|-------------------------------|
| Focus | End-user portal with UI | Backend search-as-a-service API |
| UI | Facets, autocomplete, frontend | API-only, consumed by other services |
| Personalization | Basic filters | User profile-based re-ranking |
| Query expansion | None | Synonym + LLM-based expansion |
| Multi-tenant | No | Tenant-isolated indices |

## Prerequisites
1. Azure CLI authenticated: `az account show`
2. Azure AI Search (Standard S1+ for semantic ranking)
3. Azure OpenAI (text-embedding-3-large for indexing)
4. Azure Storage (source documents)
5. Azure Container Apps (search API hosting)

## Step 1: Deploy Infrastructure
```bash
az bicep lint -f infra/main.bicep
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
```

## Step 2: Configure Embedding Pipeline
```python
# Document ingestion pipeline
async def ingest_document(doc):
    chunks = chunk_document(doc, size=512, overlap=50)
    embeddings = await embed_batch(chunks, model="text-embedding-3-large")
    for chunk, embedding in zip(chunks, embeddings):
        await index.upload_document({
            "id": generate_id(doc, chunk),
            "content": chunk.text,
            "title": doc.title,
            "contentVector": embedding,
            "metadata": { "source": doc.source, "timestamp": doc.modified }
        })
```

## Step 3: Configure Search API
```python
# Search-as-a-service API
@app.post("/api/search")
async def search(query: str, user_id: str = None, top_k: int = 10):
    expanded = await expand_query(query)  # Synonym + LLM expansion
    results = await hybrid_search(expanded, top_k=top_k)
    if user_id:
        results = personalize(results, user_id)  # User preference re-ranking
    return results
```

## Step 4: Configure Query Expansion
| Method | Implementation | Improvement |
|--------|---------------|-------------|
| Synonym map | Static synonym dictionary | +10% recall |
| LLM expansion | GPT-4o-mini generates related terms | +20% recall |
| Spelling correction | Fuzzy matching in AI Search | +5% recall |
| Entity recognition | Extract entities, search structured fields | +15% precision |

## Step 5: Configure Personalization
- Track user click history → build preference profile
- Boost results matching user's past interests
- Decay old preferences (30-day half-life)
- Privacy: user can view/delete their profile

## Step 6: Post-Deployment Verification
- [ ] Embedding pipeline processing documents end-to-end
- [ ] Search API returning relevant results
- [ ] Hybrid search (keyword + vector + semantic) working
- [ ] Scoring profiles boosting fresh/popular content
- [ ] Query expansion improving recall
- [ ] Personalization re-ranking for returning users
- [ ] Multi-tenant isolation verified (tenant A can't see B's data)

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Zero results on semantic query | Embedding model mismatch | Match query and index embedding model |
| All results same score | No scoring profile | Add field boosts + freshness function |
| Query expansion too broad | LLM returns unrelated terms | Add "only closely related" to expansion prompt |
| Personalization stale | Preference decay too slow | Reduce half-life from 90 to 30 days |
| Slow indexing | Sequential document processing | Batch embedding calls (10 docs per batch) |
| Tenant data leakage | No partition filter | Add tenant_id filter to every query |

## CI/CD Integration
```yaml
- name: Validate Index Schema
  run: python scripts/validate_schema.py --index $INDEX_NAME
- name: Run Search Quality Gate
  run: python evaluation/eval.py --metrics relevance --ci-gate --threshold 0.75
- name: Verify Embedding Pipeline
  run: python scripts/test_embedding.py --doc samples/test-doc.md --expect-vector-dim 3072
```
