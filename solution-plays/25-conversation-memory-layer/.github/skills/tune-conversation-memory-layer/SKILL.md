---
name: tune-conversation-memory-layer
description: "Tune Conversation Memory — optimize compression ratio, recall thresholds, memory TTL per tier, embedding model for recall, storage cost per user. Use when: tune, optimize memory."
---

# Tune Conversation Memory Layer

## When to Use
- Optimize compression to preserve more key facts in fewer tokens
- Tune recall similarity thresholds for precision vs coverage
- Configure per-tier TTLs based on usage patterns
- Select embedding model for recall quality vs speed
- Reduce storage cost per user per month

## Tuning Dimensions

### Dimension 1: Compression Optimization

| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| Summary model | gpt-4o-mini | mini/4o | Mini cheaper, 4o preserves more nuance |
| Max summary tokens | 200 | 100-500 | More = better retention, higher cost |
| Compression trigger | 10 turns | 5-20 | Earlier = more summaries, better memory |
| Fact extraction mode | Narrative | Narrative/Bullet/JSON | Bullet = denser, JSON = structured recall |

**Compression prompt optimization**:
- "Preserve: names, preferences, decisions, dates, action items"
- "Discard: greetings, filler, acknowledgments, small talk"
- Test: compare 5 conversations manually, verify no key fact lost

### Dimension 2: Recall Threshold Tuning

| Threshold | Recall | Precision | Memories Returned |
|-----------|--------|-----------|------------------|
| 0.5 | High | Low (noisy) | Many (5-10) |
| 0.7 | Good | Good | Moderate (3-5) |
| 0.85 | Lower | High | Few (1-3) |
| 0.95 | Minimal | Very High | Rare (0-1) |

**Rule**: Start at 0.7. If agent cites irrelevant memory → raise to 0.8. If agent forgets known facts → lower to 0.6.

### Dimension 3: TTL Configuration Per Tier

| Tier | Default | Short Sessions | Long Relationships |
|------|---------|---------------|-------------------|
| Short-term (Redis) | 15 min | 5 min | 30 min |
| Long-term (Cosmos) | 90 days | 30 days | 1 year |
| Episodic (Vector) | 1 year | 90 days | Indefinite |

**User-driven TTL**: Let users choose retention (ephemeral, standard, persistent).

### Dimension 4: Embedding Model Selection

| Model | Dimensions | Cost/1M | Quality | Speed |
|-------|-----------|---------|---------|-------|
| text-embedding-3-small | 1536 | $0.02 | Good | Fast |
| text-embedding-3-large | 3072 | $0.13 | Best | Slower |
| text-embedding-ada-002 | 1536 | $0.10 | Legacy | Medium |

**Recommendation**: Use 3-small for memory recall (good balance). Only upgrade to 3-large if recall precision < 80%.

### Dimension 5: Storage Cost Per User

| Component | Per User/Month | Optimization |
|-----------|--------------|-------------|
| Redis (short-term) | ~$0.001 | Shared across users, auto-expires |
| Cosmos DB (long-term) | ~$0.05 | Archive old memories to cold storage |
| Vector store (episodic) | ~$0.02 | Prune low-relevance memories quarterly |
| Embeddings (reindex) | ~$0.01 | Only embed on new memory creation |
| **Total** | **~$0.08/user/mo** | **~$0.04 with pruning** |

**At scale**: 100K users × $0.04 = ~$4,000/mo (very cost-effective persistent memory).

## Production Readiness Checklist
- [ ] Recall precision ≥ 85% on test scenarios
- [ ] Compression preserving ≥ 90% key facts
- [ ] PII scrubbed from long-term + episodic tiers
- [ ] User delete/export working (GDPR)
- [ ] Cross-session continuity tested
- [ ] Recall latency < 200ms
- [ ] Storage cost per user documented
- [ ] TTLs configured per tier
- [ ] No memory leaks (unbounded growth)

## Output: Tuning Report
After tuning, compare:
- Compression retention improvement (% key facts)
- Recall precision/coverage change
- Recall latency improvement
- Storage cost per user reduction
- Cross-session continuity score

## Tuning Playbook
1. **Baseline**: Run 20 multi-session test users, record all metrics
2. **Compress**: Test compression with bullet vs narrative vs JSON format
3. **Recall**: Adjust similarity threshold (start 0.7, adjust by \u00b10.05)
4. **Prune**: Remove memories with recall score 0 over 90 days
5. **Embed**: Compare text-embedding-3-small vs large on recall precision
6. **Cost**: Calculate per-user monthly cost, project to target user base
7. **Privacy**: Run PII scrub audit, verify GDPR delete works
8. **Re-test**: Run same 20 users, compare before/after
