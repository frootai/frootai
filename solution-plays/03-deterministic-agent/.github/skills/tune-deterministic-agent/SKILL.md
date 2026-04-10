---
name: tune-deterministic-agent
description: "Tune deterministic agent — optimize confidence thresholds, abstention rates, latency, model routing, response caching, cost. Use when: tune, optimize, confidence, threshold, latency, cost, cache."
---

# Tune Deterministic Agent for Production

## When to Use
- User asks to optimize confidence thresholds or abstention rates
- User asks to reduce latency or cost
- User asks about model routing or caching
- User mentions tuning, optimization, production readiness

## Tuning Dimensions

| Dimension | Parameter | Default | Range | Impact |
|-----------|----------|---------|-------|--------|
| Confidence threshold | `guardrails.confidence_threshold` | 0.8 | 0.5-0.95 | Higher = more abstentions, fewer errors |
| Max tokens | `openai.max_tokens` | 4096 | 1024-8192 | Lower = faster, cheaper |
| Model | `openai.model` | gpt-4o | gpt-4o/gpt-4o-mini | Mini = 30x cheaper, lower quality |
| Cache TTL | `cache.ttl_seconds` | 3600 | 0-86400 | Higher = more cache hits, staler data |
| Seed | `openai.seed` | 42 | Any integer | Change to reset deterministic baseline |

## Phase 1: Confidence Threshold Tuning

```python
def tune_confidence_threshold(test_cases: list[dict]) -> float:
    """Find optimal threshold that maximizes accuracy while minimizing false abstentions."""
    best_threshold = 0.8
    best_f1 = 0
    
    for threshold in [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]:
        tp, fp, fn, tn = 0, 0, 0, 0
        for case in test_cases:
            resp = get_agent_response(case["query"])
            should_answer = case.get("has_answer", True)
            did_answer = resp.confidence >= threshold
            
            if should_answer and did_answer: tp += 1
            elif not should_answer and did_answer: fp += 1
            elif should_answer and not did_answer: fn += 1
            else: tn += 1
        
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
        
        print(f"Threshold {threshold}: P={precision:.2f} R={recall:.2f} F1={f1:.2f} Abstentions={fn+tn}")
        if f1 > best_f1:
            best_f1 = f1
            best_threshold = threshold
    
    return best_threshold
```

## Phase 2: Model Routing (Cost Optimization)

```python
def route_to_model(query: str, complexity: str) -> str:
    """Route simple queries to cheaper model."""
    # gpt-4o-mini: $0.15/1M input tokens (30x cheaper than gpt-4o)
    # gpt-4o:      $5.00/1M input tokens (highest quality)
    
    simple_patterns = ["what is", "define", "list", "how many", "when was"]
    
    if any(p in query.lower() for p in simple_patterns):
        return "gpt-4o-mini"    # Simple factual → cheap model
    if len(query.split()) < 10:
        return "gpt-4o-mini"    # Short query → cheap model
    return "gpt-4o"             # Complex → capable model

# Both models MUST use temperature=0 + seed for determinism
```

## Phase 3: Response Caching

```python
import hashlib, json, redis

class DeterministicCache:
    def __init__(self, redis_client, ttl: int = 3600):
        self.redis = redis_client
        self.ttl = ttl
    
    def _key(self, query: str, model: str, seed: int) -> str:
        """Deterministic cache key: same input → same key."""
        content = f"{query}|{model}|{seed}"
        return f"det:{hashlib.sha256(content.encode()).hexdigest()[:16]}"
    
    def get(self, query: str, model: str, seed: int):
        cached = self.redis.get(self._key(query, model, seed))
        return json.loads(cached) if cached else None
    
    def set(self, query: str, model: str, seed: int, response: dict):
        self.redis.setex(self._key(query, model, seed), self.ttl, json.dumps(response))

# Cache hit rate for deterministic agents is typically 40-60%
# (many enterprise queries are repeated: "What's our PTO policy?")
```

## Phase 4: Latency Optimization

| Optimization | Latency Impact | Trade-off |
|-------------|---------------|-----------|
| Response caching | -70% (cache hit) | Stale data if TTL too long |
| gpt-4o-mini routing | -40% | Lower quality on complex queries |
| Reduce max_tokens 4096→2048 | -15% | Truncated long responses |
| Streaming response | -50% TTFT | Harder to validate structured output |
| Connection pooling | -10% | More memory |

```python
# Measure latency percentiles
import time

latencies = []
for case in test_cases:
    start = time.perf_counter()
    resp = get_agent_response(case["query"])
    latencies.append(time.perf_counter() - start)

p50 = sorted(latencies)[len(latencies)//2]
p95 = sorted(latencies)[int(len(latencies)*0.95)]
p99 = sorted(latencies)[int(len(latencies)*0.99)]
print(f"p50={p50:.2f}s p95={p95:.2f}s p99={p99:.2f}s ratio={p95/p50:.1f}x")
# Target: p95/p50 < 2.0x
```

## Phase 5: Production Readiness Checklist

| Check | Target | Status |
|-------|--------|--------|
| temperature = 0 | Exact 0 | Verify in config/openai.json |
| seed is set | Any fixed integer | Verify in config/openai.json |
| Confidence threshold tuned | Optimal F1 from Phase 1 | Update config/guardrails.json |
| Model routing configured | Simple→mini, complex→4o | Implement in app code |
| Cache enabled | TTL 1-24h based on data freshness | Redis/Cosmos Cache |
| Fingerprint monitoring | Alert on change | Implement check_fingerprint() |
| Latency p95 < 3s | Measured across 100 requests | Load test results |
| Cost per query < $0.05 | Calculated with routing | Token usage metrics |

## Output: Tuning Report

```
## Deterministic Agent Tuning Report
| Parameter | Before | After | Impact |
|-----------|--------|-------|--------|
| Confidence threshold | 0.8 | 0.85 | Abstention +5%, errors -12% |
| Model routing | gpt-4o only | mini for simple | Cost -55% |
| Caching | None | Redis 1h TTL | Latency -65% (cache hits) |
| max_tokens | 4096 | 2048 | Latency -12% |
| p95 latency | 2.8s | 1.2s | -57% |
| Cost/query | $0.08 | $0.03 | -62% |
```
