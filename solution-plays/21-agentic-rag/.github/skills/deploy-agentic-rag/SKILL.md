---
name: deploy-agentic-rag
description: "Deploy Agentic RAG — configure autonomous retrieval agent with multi-source routing (AI Search, Bing, SQL, APIs), iterative search, self-evaluation, semantic caching. Use when: deploy, provision."
---

# Deploy Agentic RAG

## When to Use
- Deploy an autonomous retrieval agent that decides when and where to search
- Configure multi-source routing (AI Search, Bing, SQL, custom APIs)
- Set up iterative search with self-evaluation loops
- Deploy semantic caching for repeated query patterns

## How Agentic RAG Differs from Standard RAG (Play 01)
| Aspect | Standard RAG (Play 01) | Agentic RAG (Play 21) |
|--------|----------------------|----------------------|
| Search decision | Always search | Agent decides IF needed |
| Source selection | Fixed single source | Agent picks from multiple |
| Iteration | One-shot | Agent iterates if insufficient |
| Self-evaluation | None | Agent checks groundedness |
| Multi-source | No | AI Search + Bing + SQL + APIs |

## Prerequisites
1. Azure CLI authenticated: `az account show`
2. Azure OpenAI with gpt-4o (tool-calling capable)
3. Azure AI Search with indexed knowledge base
4. Redis Cache for semantic caching (optional)

## Step 1: Deploy Infrastructure
```bash
az bicep build -f infra/main.bicep
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
```

## Step 2: Configure Source Registry
```json
{
  "sources": [
    { "name": "knowledge-base", "type": "ai-search", "priority": 1 },
    { "name": "web-search", "type": "bing", "priority": 2 },
    { "name": "product-db", "type": "sql", "priority": 3 }
  ],
  "routing": { "default_sources": ["knowledge-base"], "max_sources_per_query": 3 }
}
```

## Step 3: Configure Agent Tools
The agent has a tool per data source. It autonomously decides which to call:
- `search_knowledge_base` — internal KB docs
- `search_web` — web for recent info
- `query_database` — product/customer data
- `self_evaluate` — check if context sufficient

## Step 4: Configure Iteration Limits
| Parameter | Default | Range | Purpose |
|-----------|---------|-------|---------|
| `max_retrieval_hops` | 3 | 1-5 | Max search iterations |
| `min_groundedness` | 0.85 | 0.7-0.95 | Self-eval stop threshold |
| `max_sources` | 3 | 1-5 | Max sources per query |
| `iteration_timeout` | 30s | 10-60s | Total retrieval budget |

## Step 5: Configure Semantic Caching
- Similarity threshold: 0.92, TTL: 1 hour, embedding: text-embedding-3-small
- Expected: >60% cost reduction on repeated query patterns

## Step 6: Post-Deployment Verification
- [ ] Agent routes to correct data source per query type
- [ ] Iterative search triggered when first result insufficient
- [ ] Self-evaluation prevents low-quality responses
- [ ] Citations include source and document
- [ ] Cache hits on similar queries
- [ ] Max iterations enforced (no loops)
- [ ] Cost per query tracked

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Agent searches all sources | No routing logic | Improve source descriptions in tools |
| Infinite loop | No iteration cap | Set max_retrieval_hops=3 |
| Cache never hits | Threshold 0.99 | Lower to 0.92 |
| Slow (>30s) | Too many iterations | Reduce max_hops, raise groundedness |
| Citations missing | Source not in tool output | Return source metadata from tools |
| Wrong source selected | Ambiguous tool descriptions | Make tool descriptions more specific |

## CI/CD Integration
```yaml
- name: Validate Infrastructure
  run: az bicep lint -f infra/main.bicep
- name: Deploy to Staging
  run: az deployment group create -g $STAGING_RG -f infra/main.bicep -p infra/parameters.json
- name: Run Retrieval Quality Gate
  run: python evaluation/eval.py --metrics source_selection,groundedness --ci-gate
- name: Verify Source Connectivity
  run: python scripts/test_sources.py --sources knowledge-base,web-search,product-db
```

## Architecture Diagram
```
User Query → Agent (gpt-4o with tool-calling)
                │
                ├─ Tool: search_knowledge_base → AI Search
                ├─ Tool: search_web → Bing API
                ├─ Tool: query_database → SQL
                ├─ Tool: call_api → Custom REST
                └─ Tool: self_evaluate → Check groundedness
                                │
                ├─ Sufficient? → Respond with citations
                └─ Insufficient? → Iterate (next source or refine query)
```
