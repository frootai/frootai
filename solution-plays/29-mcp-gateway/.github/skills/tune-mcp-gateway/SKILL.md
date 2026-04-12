---
name: tune-mcp-gateway
description: "Tune MCP Gateway — optimize tool descriptions for LLM accuracy, response schemas, transport performance, caching, rate limits. Use when: tune, optimize MCP server."
---

# Tune MCP Gateway

## When to Use
- Optimize tool descriptions so LLMs invoke them more accurately
- Tune response schemas for minimal but complete output
- Configure transport performance (connection pooling, timeouts)
- Add response caching for frequently called tools
- Set rate limits per client/tool

## Tuning Dimensions

### Dimension 1: Tool Description Optimization

| Technique | Before | After | Impact |
|-----------|--------|-------|--------|
| Action verb start | "This tool searches..." | "Search internal KB for..." | +15% invocation accuracy |
| Negative examples | (none) | "Do NOT use for web search" | -30% wrong invocations |
| Parameter hints | "query: string" | "query: the user's search text, e.g. 'Azure pricing'" | +20% param accuracy |
| Return description | (none) | "Returns: array of {title, snippet, score}" | Better LLM output handling |
| When to use | (none) | "Use when user asks about internal docs" | +25% selection accuracy |

**Golden rule**: A tool description should tell the LLM WHAT the tool does, WHEN to use it, and WHAT NOT to use it for.

### Dimension 2: Response Schema Tuning

| Strategy | Response Size | LLM Usability | Cost |
|----------|-------------|---------------|------|
| Full objects | Large (5KB+) | Good but noisy | High tokens |
| Essential fields only | Medium (1-2KB) | Best | Optimal |
| Summary + IDs | Small (<500B) | OK if LLM knows to fetch details | Low tokens |
| Truncated | Variable | Risky (incomplete data) | Varies |

**Rule**: Return essential fields only. Include a clear `summary` field the LLM can use directly.

### Dimension 3: Transport Performance

| Parameter | Default | Optimized | Impact |
|-----------|---------|-----------|--------|
| Connection timeout | 30s | 10s | Faster failure detection |
| Request timeout | 60s | 15s | Don't block on slow backends |
| Connection pooling | None | Pool of 5 | Reduce connection overhead |
| Keepalive | Disabled | 30s interval | Prevent connection drops |
| Max concurrent | Unlimited | 20 | Prevent backend overload |

### Dimension 4: Response Caching

| Strategy | Cache Duration | Hit Rate | Best For |
|----------|---------------|----------|---------|
| No cache | 0 | 0% | Real-time data (stock prices) |
| Short (1 min) | 60s | 20-40% | Frequently queried configs |
| Medium (15 min) | 900s | 40-60% | Reference data |
| Long (1 hour) | 3600s | 60-80% | Static knowledge base |

Cache key: hash of (tool_name + serialized_params).

### Dimension 5: Rate Limiting Configuration

| Client Type | Limit | Per | Purpose |
|-------------|-------|-----|---------|
| Development | 30/min | Client | Prevent accidental loops |
| Production agent | 120/min | Client | Normal usage |
| Batch processing | 300/min | Client | High-throughput jobs |
| Global | 1000/min | Server | Protect backend APIs |

## Production Readiness Checklist
- [ ] Tool descriptions optimized (≥ 90% LLM selection accuracy)
- [ ] All tools have inputSchema with JSON Schema validation
- [ ] Response schemas returning essential fields only
- [ ] Transport timeouts configured (no hanging connections)
- [ ] Caching enabled for cacheable tools
- [ ] Rate limits set per client type
- [ ] Error responses are structured (no stack traces)
- [ ] Security: input sanitization on all tool inputs
- [ ] Monitoring: tool invocation counts, latency, errors

## Output: Tuning Report
After tuning, compare:
- Tool selection accuracy improvement
- Response size reduction
- Transport latency improvement
- Cache hit rate
- Rate limit effectiveness

## Tuning Playbook
1. **Baseline**: Test 30 prompts, measure tool selection accuracy
2. **Descriptions**: Rewrite weakest 5 tool descriptions with action verbs + negatives
3. **Schemas**: Add examples and constraints to all inputSchema fields
4. **Responses**: Trim response to essential fields, add summary field
5. **Cache**: Enable caching on static/reference tools, measure hit rate
6. **Transport**: Set connection timeout=10s, request timeout=15s
7. **Rate limits**: Configure per client type
8. **Re-test**: Same 30 prompts, compare selection accuracy before/after
9. **Monitor**: Deploy with logging, track real-world invocation patterns
10. **Iterate**: Review monthly invocation logs, refine descriptions for misused tools
11. **Document**: Record final tool descriptions and thresholds for onboarding new team members
