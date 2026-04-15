---
name: fai-semantic-cache-implement
description: "Implement semantic caching for AI responses with Redis and embedding similarity"
---

# Semantic Cache Implementation

Embedding-based cache that matches semantically similar queries to avoid redundant LLM calls. Uses Redis with vector similarity search (RediSearch) to store query embeddings alongside cached responses. A cosine similarity threshold (default 0.95) determines cache hits.

## Architecture

```
User Query → Compute Embedding → Redis VECTOR SEARCH (top-1, cosine)
  ├─ similarity ≥ threshold → Return cached response (cache HIT)
  └─ similarity < threshold → Call LLM → Store embedding + response → Return
```

## config/cache.json

```json
{
  "semantic_cache": {
    "enabled": true,
    "embedding_model": "text-embedding-3-small",
    "embedding_dimensions": 1536,
    "similarity_threshold": 0.95,
    "ttl_seconds": 3600,
    "max_cache_size_mb": 512,
    "redis_index_name": "idx:semantic_cache",
    "redis_key_prefix": "sc:",
    "invalidation": {
      "strategy": "ttl+version",
      "model_version_key": "cache:model_version",
      "flush_on_model_change": true
    },
    "monitoring": {
      "log_hit_rate": true,
      "alert_hit_rate_below": 0.2,
      "sample_rate": 1.0
    }
  }
}
```

## Core Implementation — `semantic_cache.py`

```python
import json, hashlib, time, struct
import numpy as np
from openai import AzureOpenAI
from redis import Redis
from redis.commands.search.field import VectorField, TextField, NumericField
from redis.commands.search.indexDefinition import IndexDefinition, IndexType
from redis.commands.search.query import Query

class SemanticCache:
    def __init__(self, config_path: str = "config/cache.json"):
        with open(config_path) as f:
            self.cfg = json.load(f)["semantic_cache"]

        self.dims = self.cfg["embedding_dimensions"]
        self.threshold = self.cfg["similarity_threshold"]
        self.ttl = self.cfg["ttl_seconds"]
        self.prefix = self.cfg["redis_key_prefix"]
        self.index = self.cfg["redis_index_name"]

        self.redis = Redis(host="localhost", port=6379, decode_responses=False)
        self.oai = AzureOpenAI()  # Uses AZURE_OPENAI_* env vars
        self._ensure_index()

    def _ensure_index(self):
        """Create RediSearch vector index if it doesn't exist."""
        try:
            self.redis.ft(self.index).info()
        except Exception:
            schema = (
                TextField("$.query", as_name="query"),
                TextField("$.response", as_name="response"),
                NumericField("$.created_at", as_name="created_at"),
                NumericField("$.token_cost", as_name="token_cost"),
                VectorField("$.embedding", "FLAT", {
                    "TYPE": "FLOAT32", "DIM": self.dims,
                    "DISTANCE_METRIC": "COSINE",
                }, as_name="embedding"),
            )
            self.redis.ft(self.index).create_index(
                schema,
                definition=IndexDefinition(
                    prefix=[self.prefix], index_type=IndexType.JSON
                ),
            )

    def _embed(self, text: str) -> list[float]:
        resp = self.oai.embeddings.create(
            input=text,
            model=self.cfg["embedding_model"],
            dimensions=self.dims,
        )
        return resp.data[0].embedding

    def _vec_bytes(self, embedding: list[float]) -> bytes:
        return np.array(embedding, dtype=np.float32).tobytes()

    def lookup(self, query: str) -> dict | None:
        """Search cache for semantically similar query. Returns cached
        response dict or None on miss."""
        query_emb = self._embed(query)
        q = (
            Query("*=>[KNN 1 @embedding $vec AS score]")
            .return_fields("query", "response", "score", "token_cost")
            .sort_by("score")
            .dialect(2)
        )
        results = self.redis.ft(self.index).search(
            q, query_params={"vec": self._vec_bytes(query_emb)}
        )
        if not results.docs:
            return None

        doc = results.docs[0]
        similarity = 1.0 - float(doc.score)  # COSINE distance → similarity
        if similarity < self.threshold:
            return None

        return {
            "response": doc.response,
            "similarity": similarity,
            "original_query": doc.query,
            "cache_hit": True,
            "saved_tokens": int(doc.token_cost),
        }

    def store(self, query: str, response: str, token_cost: int):
        """Store query embedding + response in cache with TTL."""
        embedding = self._embed(query)
        key = f"{self.prefix}{hashlib.sha256(query.encode()).hexdigest()[:16]}"
        self.redis.json().set(key, "$", {
            "query": query,
            "response": response,
            "embedding": embedding,
            "created_at": time.time(),
            "token_cost": token_cost,
        })
        self.redis.expire(key, self.ttl)

    def invalidate_all(self):
        """Flush all cached entries (use on model version change)."""
        for key in self.redis.scan_iter(f"{self.prefix}*"):
            self.redis.delete(key)

    def invalidate_by_prefix(self, query_prefix: str):
        """Invalidate entries whose original query starts with prefix."""
        q = Query(f"@query:{query_prefix}*").return_fields("query")
        for doc in self.redis.ft(self.index).search(q).docs:
            self.redis.delete(doc.id)
```

## Middleware Integration

```python
from semantic_cache import SemanticCache

cache = SemanticCache()
_stats = {"hits": 0, "misses": 0}

def cached_completion(query: str, system_prompt: str = "", **kwargs) -> dict:
    """Drop-in replacement for LLM completion with semantic caching."""
    cached = cache.lookup(query)
    if cached:
        _stats["hits"] += 1
        return cached

    _stats["misses"] += 1
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": query})

    resp = cache.oai.chat.completions.create(
        model=kwargs.get("model", "gpt-4o"),
        messages=messages,
        **{k: v for k, v in kwargs.items() if k != "model"},
    )
    answer = resp.choices[0].message.content
    tokens_used = resp.usage.total_tokens

    cache.store(query, answer, tokens_used)
    return {"response": answer, "cache_hit": False, "tokens_used": tokens_used}

def cache_hit_rate() -> float:
    total = _stats["hits"] + _stats["misses"]
    return _stats["hits"] / total if total > 0 else 0.0
```

## Cache Invalidation Strategies

| Strategy | When to Use | How |
|----------|------------|-----|
| **TTL expiry** | Default — stale data auto-evicts | Set `ttl_seconds` in config (3600 = 1h) |
| **Model version bump** | After deploying new model or updated system prompt | Increment `cache:model_version` in Redis → triggers `invalidate_all()` |
| **Prefix purge** | Knowledge base updated for a specific domain | Call `invalidate_by_prefix("insurance policy")` |
| **Manual flush** | Emergency or full retraining | Call `invalidate_all()` |

Version-aware invalidation check at startup:

```python
def check_model_version(cache: SemanticCache, current_version: str):
    stored = cache.redis.get("cache:model_version")
    if stored and stored.decode() != current_version:
        cache.invalidate_all()
    cache.redis.set("cache:model_version", current_version)
```

## Cost Savings Calculation

```python
def estimate_savings(stats: dict, cost_per_1k_input: float = 0.005,
                     cost_per_1k_output: float = 0.015,
                     embed_cost_per_1k: float = 0.00002) -> dict:
    saved_tokens = stats.get("total_saved_tokens", 0)
    embed_calls = stats["hits"] + stats["misses"]  # every request embeds
    llm_cost_saved = saved_tokens / 1000 * (cost_per_1k_input + cost_per_1k_output)
    embed_overhead = embed_calls / 1000 * embed_cost_per_1k
    return {
        "llm_cost_saved_usd": round(llm_cost_saved, 4),
        "embedding_overhead_usd": round(embed_overhead, 4),
        "net_savings_usd": round(llm_cost_saved - embed_overhead, 4),
        "cache_hit_rate": cache_hit_rate(),
    }
```

## Monitoring

Track cache performance with structured logging:

```python
import logging, json

logger = logging.getLogger("semantic_cache")

def log_cache_event(event: str, query: str, similarity: float = 0.0,
                    tokens_saved: int = 0):
    logger.info(json.dumps({
        "event": event,  # "hit" | "miss" | "store" | "invalidate"
        "query_hash": hashlib.sha256(query.encode()).hexdigest()[:12],
        "similarity": round(similarity, 4),
        "tokens_saved": tokens_saved,
        "hit_rate": cache_hit_rate(),
    }))
```

Alert when hit rate drops below threshold (from `config/cache.json`):

```python
if cache_hit_rate() < cfg["monitoring"]["alert_hit_rate_below"]:
    logger.warning(f"Cache hit rate {cache_hit_rate():.1%} below threshold")
```

## Tuning the Similarity Threshold

| Threshold | Behavior | Use Case |
|-----------|----------|----------|
| **0.99** | Near-exact match only | Legal, medical — precision critical |
| **0.95** | Default — semantically equivalent queries | General Q&A, support bots |
| **0.90** | Broader matches, higher hit rate | FAQ bots, low-stakes summaries |
| **< 0.85** | Too aggressive — returns wrong answers | Not recommended |

Test with your domain data: compute pairwise similarities between paraphrased questions and set threshold above the 5th percentile.
