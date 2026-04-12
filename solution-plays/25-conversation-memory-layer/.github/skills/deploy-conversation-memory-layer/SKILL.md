---
name: deploy-conversation-memory-layer
description: "Deploy Conversation Memory Layer — configure tiered memory (short-term Redis, long-term Cosmos DB, episodic vector store), compression pipeline, PII-aware storage, recall API. Use when: deploy, provision memory."
---

# Deploy Conversation Memory Layer

## When to Use
- Deploy persistent conversation memory for AI agents
- Configure tiered memory (short-term, long-term, episodic)
- Set up vector-based recall for relevant memory retrieval
- Implement memory compression for token budgets
- Configure PII-aware storage with consent management

## Prerequisites
1. Azure CLI authenticated: `az account show`
2. Redis Cache (short-term), Cosmos DB (long-term), Vector store (episodic)
3. Azure OpenAI (compression + embedding models)

## Step 1: Deploy Infrastructure
```bash
az bicep lint -f infra/main.bicep
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
```

## Step 2: Configure Memory Tiers
| Tier | Storage | TTL | What It Stores | Access |
|------|---------|-----|---------------|--------|
| Short-term | Redis | 15 min | Current conversation turns | Every request |
| Long-term | Cosmos DB | 90 days | Compressed summaries | On recall |
| Episodic | Vector store | 1 year | Key facts, preferences | Similarity search |
| Working | In-context | Request-scoped | Active memory | Always loaded |

## Step 3: Configure Memory Schema
```json
{
  "id": "mem-uuid", "user_id": "user-123", "tier": "long-term",
  "content": "User prefers dark mode and concise answers",
  "embedding": [0.01, 0.02],
  "metadata": { "confidence": 0.92, "pii_scrubbed": true }
}
```

## Step 4: Configure Compression Pipeline
```
10 turns (~4000 tokens) → GPT-4o-mini summarize → ~200 tokens
    → Embed for vector recall → Store long-term + episodic
    → Delete raw turns from short-term after TTL
```

## Step 5: Configure Recall API
```python
async def recall_memories(user_id, query):
    short = await redis.get(f"memory:{user_id}:session")
    episodic = await vector_search(query=query, user_id=user_id, top_k=5, min_score=0.7)
    return {"short_term": short, "episodic": episodic}
```

## Step 6: Configure PII Handling
- Scrub PII before long-term/episodic storage
- Users can view, export, delete memories (GDPR)
- Encryption at rest, per-user partition isolation

## Step 7: Post-Deployment Verification
- [ ] Short-term storing/expiring (15-min TTL)
- [ ] Long-term persisting across sessions
- [ ] Episodic recall returning relevant memories
- [ ] Compression: 4000 → ~200 tokens
- [ ] PII scrubbed before storage
- [ ] User delete/export working
- [ ] Recall latency < 200ms

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Memory not persisting | Redis TTL too short | Increase TTL or move to Cosmos |
| Irrelevant recall | Similarity threshold low | Raise from 0.5 to 0.7 |
| Compression loses facts | Prompt too aggressive | Add "preserve preferences" |
| PII in long-term | Scrubbing missed pattern | Add more PII patterns |
| Recall slow | Large vector index | Add user_id filter |
| Memory unbounded | No TTL on long-term | Set 90-day TTL |

## Architecture Diagram
```
User Message → Recall API → Redis (short-term) + Vector Search (episodic)
                                ↓
              Assemble Working Memory → Add to LLM Context
                                ↓
              Response Generated → Store Turn in Redis
                                ↓
              10 Turns Accumulated? → Compress → Store Long-Term + Episodic
```

## Security Considerations
- All memory encrypted at rest (Cosmos DB + Redis)
- Per-user isolation via Cosmos DB partition key
- PII scrubber runs BEFORE long-term storage
- GDPR: implement `GET /memory/{user_id}` (view) and `DELETE /memory/{user_id}` (forget)
- Consent: user must opt-in to persistent memory
- Audit log: track who accessed which user's memories
- No cross-user memory leakage (strict partition isolation)
