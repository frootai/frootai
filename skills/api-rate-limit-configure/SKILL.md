---
name: api-rate-limit-configure
description: "Configure API rate limiting, APIM throttling, and retry behavior for AI endpoints — absorb bursts, isolate noisy tenants, and control 429 retries"
---

# API Rate Limiting Configuration

## Algorithms

### Token Bucket
Each client gets a bucket with capacity `max_tokens`. Tokens refill at `refill_rate` per second. Each request costs 1+ tokens. When empty, requests are rejected with 429. Best for bursty traffic — allows short spikes up to bucket capacity.

### Sliding Window Counter
Divide time into fixed windows (e.g., 60s). Track request counts in current + previous window. Weight the previous window by overlap percentage. More accurate than fixed windows, avoids boundary burst problems.

## Configuration Schema — `config/rate-limits.json`

```json
{
  "global": {
    "requests_per_minute": 1000,
    "requests_per_hour": 30000,
    "burst_capacity": 50
  },
  "per_user": {
    "free_tier":  { "rpm": 20,  "rph": 500,   "burst": 5  },
    "standard":   { "rpm": 100, "rph": 5000,  "burst": 20 },
    "enterprise": { "rpm": 500, "rph": 50000, "burst": 100 }
  },
  "per_endpoint": {
    "/api/chat/completions": { "rpm": 60,  "cost_per_request": 5 },
    "/api/embeddings":       { "rpm": 200, "cost_per_request": 1 },
    "/api/search":           { "rpm": 300, "cost_per_request": 1 }
  },
  "retry_after_strategy": "exponential",
  "retry_after_base_seconds": 1,
  "retry_after_max_seconds": 60
}
```

## Python — Redis Sliding Window Rate Limiter

```python
import os, time, redis, json, hashlib
from functools import wraps
from fastapi import HTTPException, Request, Response

_redis = redis.Redis(host="redis-cache.redis.cache.windows.net", port=6380, ssl=True,
                     password=os.environ["REDIS_KEY"], decode_responses=True)

def _load_limits() -> dict:
    with open("config/rate-limits.json") as f:
        return json.load(f)

def sliding_window_check(key: str, limit: int, window_seconds: int = 60) -> tuple[bool, int, float]:
    """Returns (allowed, remaining, retry_after_seconds)."""
    now = time.time()
    window_start = now - window_seconds
    pipe = _redis.pipeline()
    pipe.zremrangebyscore(key, 0, window_start)   # prune expired
    pipe.zadd(key, {f"{now}:{hashlib.md5(str(now).encode()).hexdigest()[:8]}": now})
    pipe.zcard(key)
    pipe.expire(key, window_seconds + 1)
    _, _, count, _ = pipe.execute()

    if count > limit:
        oldest_in_window = float(_redis.zrange(key, 0, 0, withscores=True)[0][1])
        retry_after = oldest_in_window + window_seconds - now
        return False, 0, max(retry_after, 1.0)
    return True, limit - count, 0.0

def rate_limit(endpoint: str | None = None):
    """FastAPI dependency for per-user + per-endpoint rate limiting."""
    limits = _load_limits()
    def decorator(func):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            user_id = request.headers.get("X-User-Id", request.client.host)
            tier = request.headers.get("X-User-Tier", "free_tier")
            tier_limits = limits["per_user"].get(tier, limits["per_user"]["free_tier"])

            # Per-user check
            user_key = f"rl:user:{user_id}"
            allowed, remaining, retry_after = sliding_window_check(
                user_key, tier_limits["rpm"], window_seconds=60
            )
            if not allowed:
                raise HTTPException(
                    status_code=429,
                    detail="Rate limit exceeded",
                    headers={
                        "Retry-After": str(int(retry_after)),
                        "X-RateLimit-Limit": str(tier_limits["rpm"]),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": str(int(time.time() + retry_after)),
                    },
                )

            # Per-endpoint check
            ep = endpoint or request.url.path
            ep_limits = limits["per_endpoint"].get(ep)
            if ep_limits:
                ep_key = f"rl:ep:{ep}"
                ep_allowed, ep_remaining, ep_retry = sliding_window_check(
                    ep_key, ep_limits["rpm"], window_seconds=60
                )
                if not ep_allowed:
                    raise HTTPException(status_code=429, detail="Endpoint rate limit exceeded",
                                        headers={"Retry-After": str(int(ep_retry))})

            response: Response = await func(request, *args, **kwargs)
            response.headers["X-RateLimit-Limit"] = str(tier_limits["rpm"])
            response.headers["X-RateLimit-Remaining"] = str(remaining - 1)
            return response
        return wrapper
    return decorator
```

## 429 Response Handling — Client Side

```python
import httpx, asyncio, random

async def call_with_retry(client: httpx.AsyncClient, url: str, payload: dict,
                          max_retries: int = 5) -> httpx.Response:
    for attempt in range(max_retries):
        resp = await client.post(url, json=payload)
        if resp.status_code != 429:
            return resp
        retry_after = int(resp.headers.get("Retry-After", 2 ** attempt))
        jitter = random.uniform(0, min(retry_after * 0.5, 2))
        await asyncio.sleep(retry_after + jitter)
    raise httpx.HTTPStatusError("Rate limited after max retries", request=resp.request, response=resp)
```

## Azure API Management — Rate Limit Policy (Bicep + XML)

```bicep
resource apim 'Microsoft.ApiManagement/service@2023-09-01-preview' existing = {
  name: 'apim-fai-prod'
}

resource rateLimitPolicy 'Microsoft.ApiManagement/service/apis/policies@2023-09-01-preview' = {
  name: 'policy'
  parent: apim::apiResource
  properties: {
    format: 'xml'
    value: '''
<policies>
  <inbound>
    <!-- Global: 1000 req/min across all callers -->
    <rate-limit calls="1000" renewal-period="60"
                retry-after-header-name="Retry-After"
                remaining-calls-header-name="X-RateLimit-Remaining" />
    <!-- Per subscription key: 100 req/min -->
    <rate-limit-by-key calls="100" renewal-period="60"
                       counter-key="@(context.Subscription.Key)"
                       retry-after-variable-name="retryAfter" />
    <!-- Per user IP for anonymous: 20 req/min -->
    <rate-limit-by-key calls="20" renewal-period="60"
                       counter-key="@(context.Request.IpAddress)"
                       increment-condition="@(context.Subscription == null)" />
  </inbound>
  <outbound>
    <set-header name="X-RateLimit-Policy" exists-action="override">
      <value>fai-standard</value>
    </set-header>
  </outbound>
  <on-error>
    <choose>
      <when condition="@(context.Response.StatusCode == 429)">
        <set-body>{"error":"rate_limited","retry_after":"@(context.Variables["retryAfter"])"}</set-body>
      </when>
    </choose>
  </on-error>
</policies>
    '''
  }
}
```

## Azure Redis Cache for Distributed Limiting (Bicep)

```bicep
resource redisCache 'Microsoft.Cache/redis@2023-08-01' = {
  name: 'redis-fai-ratelimit'
  location: resourceGroup().location
  properties: {
    sku: { name: 'Standard', family: 'C', capacity: 1 }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    redisConfiguration: { 'maxmemory-policy': 'volatile-lru' }
  }
}

output redisHostName string = redisCache.properties.hostName
output redisPort int = redisCache.properties.sslPort
```

## Monitoring Rate Limit Hits

Track 429s with custom metrics. In Application Insights, create alerts when the 429 rate exceeds 5% of total requests:

```python
from opencensus.ext.azure import metrics_exporter
from opencensus.stats import aggregation, measure, stats, view

rate_limit_measure = measure.MeasureInt("rate_limit_hits", "Count of 429 responses", "1")
rate_limit_view = view.View("rate_limit_hits_view", "Rate limit hit count",
                            [], rate_limit_measure, aggregation.CountAggregation())
stats.stats.view_manager.register_view(rate_limit_view)

# In your rate limit middleware, after returning 429:
mmap = stats.stats.stats_recorder.new_measurement_map()
mmap.measure_int_put(rate_limit_measure, 1)
mmap.record()  # sends to Application Insights via exporter
```

KQL query for dashboards:
```kql
customMetrics
| where name == "rate_limit_hits"
| summarize hits=sum(value) by bin(timestamp, 5m), cloud_RoleName
| render timechart
```

## Graceful Degradation

When rate limits are hit on upstream dependencies (e.g., Azure OpenAI returns 429):

1. **Fallback model** — route to a cheaper/faster model (gpt-4o-mini instead of gpt-4o)
2. **Cached response** — serve cached completions for repeated queries (semantic similarity > 0.95)
3. **Queue and notify** — enqueue the request, return 202 Accepted with a polling URL
4. **Shed load** — prioritize paying users, drop anonymous requests first

```python
async def handle_upstream_429(request, original_error):
    # Try fallback model
    fallback = await try_fallback_model(request, model="gpt-4o-mini")
    if fallback:
        return fallback
    # Try cache
    cached = await semantic_cache_lookup(request.prompt, threshold=0.95)
    if cached:
        return cached
    # Queue for later
    job_id = await enqueue_request(request)
    return JSONResponse(status_code=202, content={"job_id": job_id, "poll_url": f"/api/jobs/{job_id}"})
```

## Checklist
- [ ] `config/rate-limits.json` defines per-user tiers and per-endpoint limits
- [ ] Redis deployed with TLS and `volatile-lru` eviction for rate limit keys
- [ ] APIM policy uses `rate-limit-by-key` with subscription key counter
- [ ] All 429 responses include `Retry-After`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- [ ] Client SDKs implement exponential backoff with jitter on 429
- [ ] Application Insights alert fires when 429 rate > 5% over 5 min window
- [ ] Upstream 429s trigger fallback model or cached response path
- [ ] Load test confirms limits hold under 10x expected peak traffic
