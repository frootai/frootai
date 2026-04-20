---
sidebar_position: 11
title: Error Handling
description: Production-grade error handling for FrootAI components — retry patterns, circuit breakers, MCP error handling, and graceful degradation.
---

# Error Handling & Recovery Patterns

Production-grade error handling for MCP servers, FAI Engine, Azure SDK calls, and LLM API interactions.

## Error Sources in AI Systems

| Source | Example | Frequency |
|--------|---------|-----------|
| **LLM API** | Rate limits, timeout, content filter | High |
| **Azure SDK** | Transient network, auth expiry | Medium |
| **MCP transport** | Connection drop, malformed JSON | Medium |
| **User input** | Prompt injection, invalid queries | High |
| **Infrastructure** | Cold start, memory pressure | Low |

## Pattern 1: Retry with Exponential Backoff

### Python

```python
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception_type(TransientError)
)
async def call_openai(client, messages, max_tokens=500):
    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=max_tokens,
            timeout=30
        )
        return response.choices[0].message.content
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 429:
            raise TransientError(f"Rate limited: {e}")
        if e.response.status_code >= 500:
            raise TransientError(f"Server error: {e}")
        raise  # Non-retryable
```

### Node.js

```javascript
async function callOpenAI(client, messages, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages,
        max_tokens: 500,
      });
      return response.choices[0].message.content;
    } catch (error) {
      const status = error?.status;
      if ((status === 429 || status >= 500) && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
}
```

## Pattern 2: Circuit Breaker

```python
import time

class CircuitBreaker:
    def __init__(self, failure_threshold=5, recovery_timeout=60):
        self.failure_count = 0
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.last_failure_time = 0
        self.state = "closed"  # closed | open | half-open

    def call(self, func, *args, **kwargs):
        if self.state == "open":
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = "half-open"
            else:
                raise Exception("Circuit breaker OPEN")
        try:
            result = func(*args, **kwargs)
            if self.state == "half-open":
                self.state = "closed"
                self.failure_count = 0
            return result
        except Exception:
            self.failure_count += 1
            self.last_failure_time = time.time()
            if self.failure_count >= self.failure_threshold:
                self.state = "open"
            raise
```

## Pattern 3: MCP Server Error Handling

```python
@mcp.tool()
async def search_knowledge(query: str, max_results: int = 5) -> str:
    """Search FROOT knowledge modules."""
    if not query or len(query) > 500:
        return '{"error": "Query must be 1-500 characters"}'

    try:
        results = perform_search(query, max_results)
        return json.dumps({"results": results})
    except FileNotFoundError:
        return json.dumps({"error": "Knowledge base not found"})
    except Exception as e:
        logger.error(f"Search failed: {e}", exc_info=True)
        return json.dumps({"error": "Search temporarily unavailable"})
```

:::warning Never Raise in MCP Tools
MCP tools must return JSON errors, never propagate exceptions. The AI model can't recover from a crashed tool.
:::

## Pattern 4: Timeout Wrapper

```javascript
function withTimeout(promise, ms, label = 'Operation') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const result = await withTimeout(callOpenAI(client, messages), 30000, 'Azure OpenAI');
```

## Decision Matrix

| Error Type | Retry? | Fallback | User Message |
|-----------|--------|----------|-------------|
| 429 Rate Limit | ✅ backoff | Queue request | "Please wait a moment" |
| 500 Server Error | ✅ 3 attempts | Cached response | "Temporarily unavailable" |
| 401 Auth Expired | ❌ | Refresh token | "Please re-authenticate" |
| 400 Bad Request | ❌ | Fix request | "Invalid input: [details]" |
| Timeout | ✅ 1 retry | Cached response | "Request took too long" |
| Content Filter | ❌ | Rephrase | "Content could not be processed" |

## Best Practices

1. **Always set `max_tokens`** — prevent token budget overruns
2. **Always set timeouts** — no call should wait forever
3. **Retry only transient errors** — 429, 500+, network timeouts
4. **Never retry 400/401/403** — these are permanent failures
5. **Log structured JSON** — not console.log strings
6. **Include correlation IDs** — trace errors across services
7. **Validate at boundaries** — MCP tool inputs, API params, user queries
8. **Degrade gracefully** — cached response > simpler model > error message

## See Also

- [Build an MCP Server](/docs/guides/build-mcp-server) — MCP error patterns
- [Reliability WAF](/docs/concepts/well-architected) — reliability pillar
