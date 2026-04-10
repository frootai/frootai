---
name: tune-enterprise-rag
description: "Tune Enterprise RAG for production — optimize chunking, search config, model routing, caching, temperature, token budget, evaluation thresholds. Use when: tune, optimize, performance, cost, latency, quality, config."
---

# Tune Enterprise RAG for Production

## When to Use
- User asks to optimize RAG performance or reduce cost
- User asks to tune chunking, search, or model parameters
- User reports low quality scores or high latency
- User mentions model routing, caching, or cost optimization

## Tuning Dimensions

| Dimension | Config File | Key Parameters |
|-----------|------------|----------------|
| Chunking | config/chunking.json | chunk_size, overlap, strategy |
| Search | config/search.json | search_type, top_k, score_threshold |
| Model | config/openai.json | model, temperature, max_tokens |
| Guardrails | config/guardrails.json | groundedness_min, content_safety |
| Cost | config/model-comparison.json | model routing rules |

## Phase 1: Chunking Optimization

### Diagnose Chunk Quality
```python
# Analyze chunk size distribution
import tiktoken
enc = tiktoken.encoding_for_model("gpt-4o")

chunks = load_all_chunks()
sizes = [len(enc.encode(c["content"])) for c in chunks]
print(f"Min: {min(sizes)}, Max: {max(sizes)}, Avg: {sum(sizes)//len(sizes)}, Median: {sorted(sizes)[len(sizes)//2]}")

# Flag problematic chunks
for c in chunks:
    tokens = len(enc.encode(c["content"]))
    if tokens < 50:
        print(f"TOO SMALL ({tokens} tokens): {c['id']} — will have no context")
    if tokens > 1500:
        print(f"TOO LARGE ({tokens} tokens): {c['id']} — will add noise to retrieval")
```

### Optimal Parameters by Document Type
| Document Type | Chunk Size | Overlap | Strategy |
|--------------|-----------|---------|----------|
| Policies/Procedures | 512 tokens | 64 (12.5%) | Sentence-aware |
| Technical manuals | 1024 tokens | 128 (12.5%) | Section headers |
| FAQs | 256 tokens | 32 (12.5%) | Question-answer pairs |
| Legal documents | 768 tokens | 96 (12.5%) | Paragraph boundaries |
| Spreadsheets/Tables | 512 tokens | 0 | Row-based |

## Phase 2: Search Configuration

### Tune top_k
```python
# Test different top_k values against evaluation set
for k in [3, 5, 7, 10]:
    config["search"]["top_k"] = k
    results = run_evaluation(test_set, config)
    print(f"top_k={k}: groundedness={results['groundedness']:.2f}, relevance={results['relevance']:.2f}")

# Typical finding:
# top_k=3: High groundedness (0.9), low relevance (0.6) — too few sources
# top_k=5: Good balance (0.85, 0.78) — recommended default
# top_k=10: Low groundedness (0.7), high relevance (0.85) — too much noise
```

### Score Threshold
```python
# Filter out low-confidence results
config["search"]["score_threshold"] = 0.7  # Reject chunks scoring below 0.7
# Higher threshold = fewer chunks = higher groundedness, lower recall
# Lower threshold = more chunks = lower groundedness, higher recall
```

### Search Type Comparison
| Type | Groundedness | Relevance | Latency | When to Use |
|------|-------------|-----------|---------|-------------|
| Vector only | 0.75 | 0.65 | ~200ms | Semantic similarity only |
| BM25 only | 0.80 | 0.60 | ~100ms | Exact keyword matches |
| Hybrid (recommended) | 0.85 | 0.78 | ~300ms | Best of both |
| Hybrid + reranking | 0.88 | 0.82 | ~500ms | Highest quality |

## Phase 3: Model Configuration

### Temperature Tuning
| Use Case | Temperature | Why |
|----------|-------------|-----|
| Factual Q&A | 0.0 - 0.1 | Deterministic, reproducible answers |
| Summarization | 0.2 - 0.3 | Slight variation in phrasing |
| Creative writing | 0.7 - 0.9 | Diverse, creative output |
| RAG (default) | 0.1 | Factual grounding with minimal variation |

### Token Budget
```python
# Budget allocation for 8K context window
SYSTEM_PROMPT = 500     # Grounding instructions
RETRIEVED_CHUNKS = 4000  # ~5 chunks × 800 tokens
USER_QUERY = 200        # Average query length
RESPONSE = 1000         # Max response length
BUFFER = 300            # Safety margin
# Total: 6000 tokens — fits in 8K window with room to spare
```

### Model Routing (Cost Optimization)
```python
def select_model(query: str, complexity: str) -> str:
    """Route to cheaper model for simple queries."""
    if complexity == "simple":
        return "gpt-4o-mini"  # $0.15/1M input — 30x cheaper
    elif complexity == "complex":
        return "gpt-4o"       # $5/1M input — highest quality
    else:
        return "gpt-4o-mini"  # Default to cheap

# Classify query complexity
def classify_complexity(query: str) -> str:
    simple_patterns = ["what is", "define", "list", "how many"]
    if any(p in query.lower() for p in simple_patterns):
        return "simple"
    return "complex"
```

## Phase 4: Caching

```python
import hashlib, json, redis

def cache_response(query: str, response: dict, ttl: int = 3600):
    """Cache responses by query hash."""
    key = f"rag:{hashlib.sha256(query.encode()).hexdigest()[:16]}"
    redis_client.setex(key, ttl, json.dumps(response))

def get_cached(query: str) -> dict | None:
    key = f"rag:{hashlib.sha256(query.encode()).hexdigest()[:16]}"
    cached = redis_client.get(key)
    return json.loads(cached) if cached else None
```

Cache hit rates of 30-50% are typical for enterprise RAG (repeated questions about policies, procedures).

## Phase 5: Production Readiness Checklist

| Check | Command | Target |
|-------|---------|--------|
| Groundedness | `python evaluation/eval.py` | ≥ 0.8 |
| Relevance | `python evaluation/eval.py` | ≥ 0.7 |
| Latency (p95) | Load test with 100 users | < 3 seconds |
| Error rate | Monitor for 24h | < 0.1% |
| Token cost | Calculate per-query cost | < $0.05/query |
| Cache hit rate | Monitor Redis stats | > 30% |

## Output: Tuning Report

```
## RAG Tuning Report
| Parameter | Before | After | Impact |
|-----------|--------|-------|--------|
| chunk_size | 2048 | 512 | Groundedness +15% |
| top_k | 3 | 5 | Relevance +12% |
| temperature | 0.7 | 0.1 | Groundedness +8% |
| search_type | vector | hybrid+rerank | Relevance +18% |
| model routing | gpt-4o only | gpt-4o-mini for simple | Cost -60% |
| caching | none | Redis 1h TTL | Latency -40% |
```
