# Recipe 15: Error Handling & Recovery Patterns

> Production-grade error handling for FrootAI components: MCP servers, FAI Engine, Azure SDK calls, and LLM API interactions.

## Why Error Handling Matters

Common failure sources:

| Source | Example | Frequency |
|--------|---------|-----------|
| **LLM API** | Rate limits, timeout, content filter | High |
| **Azure SDK** | Transient network, auth expiry | Medium |
| **MCP transport** | Connection drop, malformed JSON | Medium |
| **User input** | Prompt injection, invalid queries | High |
| **Infrastructure** | Cold start, memory pressure | Low |

## Pattern 1: Retry with Exponential Backoff

### Python (Azure OpenAI)

```python
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

class TransientError(Exception):
    """Retryable error from Azure OpenAI."""
    pass

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception_type(TransientError),
    before_sleep=lambda retry_state: print(f"Retry {retry_state.attempt_number}...")
)
async def call_openai(client, messages, max_tokens=500):
    """Call Azure OpenAI with retry on transient errors."""
    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=max_tokens,   # Always set token budget
            timeout=30               # Always set timeout
        )
        return response.choices[0].message.content
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 429:  # Rate limited
            raise TransientError(f"Rate limited: {e}")
        if e.response.status_code >= 500:  # Server error
            raise TransientError(f"Server error: {e}")
        raise  # Non-retryable (400, 401, 403, etc.)
```

### Node.js (Azure OpenAI)

```javascript
async function callOpenAI(client, messages, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages,
        max_tokens: 500,            // Always set token budget
      });
      return response.choices[0].message.content;
    } catch (error) {
      const status = error?.status || error?.response?.status;
      if (status === 429 || status >= 500) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        console.warn(`Attempt ${attempt} failed (${status}), retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;  // Non-retryable
    }
  }
  throw new Error(`Failed after ${maxRetries} attempts`);
}
```

## Pattern 2: Circuit Breaker

Use to prevent cascading failures when a downstream service is down:

```python
import time

class CircuitBreaker:
    def __init__(self, failure_threshold=5, recovery_timeout=60):
        self.failure_count = 0
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.last_failure_time = 0
        self.state = "closed"  # closed = normal, open = blocking, half-open = testing

    def call(self, func, *args, **kwargs):
        if self.state == "open":
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = "half-open"
            else:
                raise Exception("Circuit breaker is OPEN — service unavailable")

        try:
            result = func(*args, **kwargs)
            if self.state == "half-open":
                self.state = "closed"
                self.failure_count = 0
            return result
        except Exception as e:
            self.failure_count += 1
            self.last_failure_time = time.time()
            if self.failure_count >= self.failure_threshold:
                self.state = "open"
            raise

# Usage
ai_circuit = CircuitBreaker(failure_threshold=3, recovery_timeout=30)

try:
    result = ai_circuit.call(call_openai, client, messages)
except Exception as e:
    # Fallback: use cached response or simpler model
    result = get_cached_response(query)
```

## Pattern 3: MCP Server Error Handling

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("frootai-server")

@mcp.tool()
async def search_knowledge(query: str, max_results: int = 5) -> str:
    """Search FROOT knowledge modules.
    
    Args:
        query: Search query (1-500 chars)
        max_results: Results to return (1-20, default 5)
    """
    # Input validation at system boundary
    if not query or len(query) > 500:
        return '{"error": "Query must be 1-500 characters"}'
    max_results = max(1, min(20, max_results))

    try:
        results = perform_search(query, max_results)
        return json.dumps({"results": results, "count": len(results)})
    except FileNotFoundError:
        return json.dumps({"error": "Knowledge base not found", "hint": "Run npm run build:knowledge"})
    except json.JSONDecodeError:
        return json.dumps({"error": "Corrupt knowledge base", "hint": "Rebuild with npm run build:knowledge"})
    except Exception as e:
        # Log the real error, return safe message
        logger.error(f"Search failed: {e}", exc_info=True)
        return json.dumps({"error": "Search temporarily unavailable"})
```

## Pattern 4: FAI Engine Graceful Degradation

```javascript
// engine/manifest-reader.js — graceful degradation example
function loadManifest(manifestPath) {
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(raw);

    // Validate required fields
    if (!manifest.play) throw new Error('Missing "play" field');
    if (!manifest.version) throw new Error('Missing "version" field');

    return { ok: true, manifest };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { ok: false, error: `Manifest not found: ${manifestPath}` };
    }
    if (error instanceof SyntaxError) {
      return { ok: false, error: `Invalid JSON in ${manifestPath}: ${error.message}` };
    }
    return { ok: false, error: `Failed to load manifest: ${error.message}` };
  }
}
```

## Pattern 5: Timeout Wrapper

```javascript
function withTimeout(promise, ms, label = 'Operation') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Usage
const result = await withTimeout(
  callOpenAI(client, messages),
  30000,
  'Azure OpenAI call'
);
```

## Pattern 6: Structured Error Logging

```python
import json
import logging
import uuid

logger = logging.getLogger("frootai")

def log_error(error, context=None):
    """Structured JSON error logging with correlation ID."""
    correlation_id = str(uuid.uuid4())[:8]
    entry = {
        "level": "error",
        "correlation_id": correlation_id,
        "error_type": type(error).__name__,
        "message": str(error),
        "context": context or {},
        # Never log: stack traces in production, PII, secrets
    }
    logger.error(json.dumps(entry))
    return correlation_id  # Return for user-facing error messages
```

## Decision Matrix

| Error Type | Retry? | Fallback | User Message |
|-----------|--------|----------|-------------|
| 429 Rate Limit | ✅ (backoff) | Queue request | "Please wait a moment" |
| 500 Server Error | ✅ (3 attempts) | Cache/simpler model | "Temporarily unavailable" |
| 401 Auth Expired | ❌ | Refresh token | "Please re-authenticate" |
| 400 Bad Request | ❌ | Fix request | "Invalid input: [details]" |
| Timeout | ✅ (1 retry) | Cached response | "Request took too long" |
| Content Filter | ❌ | Rephrase | "Content could not be processed" |
| Network Error | ✅ (3 attempts) | Offline mode | "Connection lost" |

## Best Practices

1. **Always set `max_tokens`** — prevent token budget overruns
2. **Always set timeouts** — no call should wait forever
3. **Retry only transient errors** — 429, 500+, network timeouts
4. **Never retry 400/401/403** — these are permanent failures
5. **Log structured JSON** — not console.log strings
6. **Include correlation IDs** — trace errors across services
7. **Validate at boundaries** — MCP tool inputs, API params, user queries
8. **Degrade gracefully** — cached response > simpler model > error message
