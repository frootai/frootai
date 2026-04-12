---
name: tune-copilot-teams-extension
description: "Tune Copilot Teams Extension — optimize Adaptive Card layouts, Graph API batching, response caching, SSO token management, cost per interaction. Use when: tune, optimize."
---

# Tune Copilot Teams Extension

## When to Use
- Optimize Adaptive Card layouts for better UX
- Improve Graph API performance with batching and caching
- Tune bot response quality and latency
- Configure SSO token caching and refresh strategy
- Reduce cost per interaction

## Tuning Dimensions

### Dimension 1: Adaptive Card Optimization

| Aspect | Default | Optimized | Impact |
|--------|---------|-----------|--------|
| Card complexity | 10+ elements | 5-7 elements | Faster render, better mobile |
| Image resolution | Original | 400px max width | Faster load |
| Action buttons | 5+ | 3 max (primary/secondary/dismiss) | Clearer UX |
| FactSet usage | Full details | Top 3-5 facts | Less scroll |
| Card version | 1.3 | 1.5 | Latest Teams features |

**Card design rules**:
- Mobile-first: test on phone before desktop
- Max 3 action buttons per card
- Use `wrap: true` on all TextBlocks
- FactSet for key-value data (not tables)
- Fallback text for clients that can't render cards

### Dimension 2: Graph API Performance

| Strategy | Before | After | Improvement |
|----------|--------|-------|-------------|
| Individual calls | 5 calls × 200ms = 1s | — | Baseline |
| Batch requests (`$batch`) | 1 call × 300ms | 70% faster | 700ms saved |
| Response caching (Redis) | — | Cache 5min TTL | 95% faster for repeated |
| Delta queries | Full data each time | Only changes | 80% less data |
| Select/expand fields | Return all fields | Only needed fields | 50% less payload |

```bash
# Example: Batch 3 Graph calls into 1
POST https://graph.microsoft.com/v1.0/$batch
{
  "requests": [
    { "id": "1", "method": "GET", "url": "/me/profile" },
    { "id": "2", "method": "GET", "url": "/me/drive/recent" },
    { "id": "3", "method": "GET", "url": "/me/messages?$top=5" }
  ]
}
```

### Dimension 3: Response Quality Tuning

| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| System prompt length | 500 tokens | 200-800 | Shorter = faster, longer = more context |
| Temperature | 0.3 | 0.1-0.5 | Lower = more consistent, higher = more creative |
| Max response tokens | 500 | 200-1000 | Cards show summaries, link to details |
| Knowledge grounding | None | SharePoint/Dataverse | More accurate domain answers |
| Citation format | None | "[Source: doc name]" | User trust + verification |

### Dimension 4: SSO Token Management

| Strategy | Implementation | Benefit |
|----------|---------------|---------|
| Token caching | Store in Bot State (Cosmos DB) | Avoid re-auth on every message |
| Refresh proactively | Refresh at 80% of expiry | No failed calls from expired tokens |
| Scope minimization | Request only needed scopes | Faster consent, less risk |
| Conditional access | Handle MFA challenges gracefully | No broken flows for MFA users |

### Dimension 5: Cost Per Interaction

| Component | Cost Driver | Optimization |
|-----------|------------|-------------|
| Bot Service | Messages processed | Free tier: 10K messages/mo |
| App Service | Compute hours | B1 tier sufficient for <1000 users |
| Azure OpenAI | Tokens per response | Cache frequent responses, use gpt-4o-mini |
| Graph API | API calls | Batch + cache = 70% reduction |
| Cosmos DB (state) | RU/s | Serverless for low volume |

**Monthly cost estimate** (1000 active users, 10 messages/user/day):
| Component | Cost |
|-----------|------|
| Bot Service (Free tier, up to 10K) | $0 |
| App Service (B1) | $55/mo |
| Azure OpenAI (gpt-4o-mini) | $15/mo |
| Cosmos DB (Serverless) | $5/mo |
| **Total** | **~$75/mo** |

## Production Readiness Checklist
- [ ] Adaptive Cards render on all Teams clients (desktop/mobile/web)
- [ ] SSO working without user prompts
- [ ] Graph API using batch + cache (< 3s response time)
- [ ] Graph permissions are least-privilege verified
- [ ] Throttling handled with exponential backoff
- [ ] Bot state persisted in Cosmos DB
- [ ] Proactive notifications tested
- [ ] Error messages user-friendly (not stack traces)
- [ ] Teams admin approval obtained
- [ ] Analytics tracking user engagement metrics

## Output: Tuning Report
After tuning, compare:
- Response latency improvement
- Graph API call reduction (batch + cache savings)
- Adaptive Card engagement (click-through on actions)
- Cost per interaction change
- User satisfaction delta
