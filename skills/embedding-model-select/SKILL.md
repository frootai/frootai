---
name: embedding-model-select
description: "Select embedding models, dimensions, and hybrid search settings for vector workloads - balance recall, storage cost, and migration risk"
---

# Embedding Model Selection

## Model Comparison

| Model | Dimensions | Max Tokens | MTEB Avg | Cost (1M tokens) | Best For |
|-------|-----------|------------|----------|-------------------|----------|
| text-embedding-3-small | 1536 (default) | 8191 | 62.3 | $0.02 | Cost-sensitive RAG, high-volume indexing |
| text-embedding-3-large | 3072 (default) | 8191 | 64.6 | $0.13 | Quality-critical retrieval, legal/medical |
| text-embedding-ada-002 | 1536 (fixed) | 8191 | 61.0 | $0.10 | Legacy — do not use for new projects |

Key differences: `3-small` is 5× cheaper than `ada-002` with better quality. `3-large` wins on MTEB benchmarks but costs 6.5× more than `3-small`. Both `3-*` models support dimension reduction; `ada-002` does not.

## Dimension Reduction (Matryoshka Embeddings)

`text-embedding-3-*` models use matryoshka representation learning — truncating the vector to fewer dimensions preserves most retrieval quality while cutting storage and search cost.

| Model | Dimensions | Relative Quality | Storage per 1M docs |
|-------|-----------|------------------|---------------------|
| 3-small | 1536 | 100% | ~6 GB |
| 3-small | 512 | ~97% | ~2 GB |
| 3-small | 256 | ~95% | ~1 GB |
| 3-large | 3072 | 100% | ~12 GB |
| 3-large | 1024 | ~98.5% | ~4 GB |
| 3-large | 256 | ~96% | ~1 GB |

Rule of thumb: start with `3-small` at 1536. If recall is insufficient, try `3-large` at 1024 before jumping to 3072. For hybrid search with BM25, `3-small` at 256 is often enough since sparse retrieval covers lexical gaps.

```python
import os

from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from openai import AzureOpenAI

client = AzureOpenAI(
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    azure_ad_token_provider=get_bearer_token_provider(
        DefaultAzureCredential(),
        "https://cognitiveservices.azure.com/.default",
    ),
    api_version="2024-12-01-preview",
)

# Reduced dimensions - API truncates server-side
response = client.embeddings.create(
    input="quarterly revenue exceeded projections",
    model="embedding-small",
    dimensions=256,
)
vector = response.data[0].embedding  # len() == 256
```

## Batch Embedding with Azure OpenAI

Azure OpenAI accepts up to **16 inputs per API call** (not 2048 like the public API). Exceeding this returns a 400 error. Chunk your corpus accordingly.

```python
import asyncio
from openai import AsyncAzureOpenAI

BATCH_SIZE = 16  # Azure OpenAI limit

async def embed_corpus(texts: list[str], model: str, dimensions: int) -> list[list[float]]:
    client = AsyncAzureOpenAI(
        azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        api_version="2024-06-01",
    )
    semaphore = asyncio.Semaphore(5)  # Max concurrent requests

    async def _embed_batch(batch: list[str]) -> list[list[float]]:
        async with semaphore:
            resp = await client.embeddings.create(
                input=batch, model=model, dimensions=dimensions
            )
            return [d.embedding for d in resp.data]

    batches = [texts[i : i + BATCH_SIZE] for i in range(0, len(texts), BATCH_SIZE)]
    results = await asyncio.gather(*[_embed_batch(b) for b in batches])
    return [vec for batch_vecs in results for vec in batch_vecs]
```

## config/embeddings.json Structure

```json
{
  "model": "text-embedding-3-small",
  "deployment_name": "embedding-small",
  "dimensions": 1536,
  "batch_size": 16,
  "max_tokens_per_chunk": 512,
  "overlap_tokens": 50,
  "cache_ttl_hours": 168,
  "cost_per_million_tokens": 0.02,
  "index": {
    "metric": "cosine",
    "algorithm": "hnsw",
    "ef_construction": 400,
    "m": 4
  },
  "hybrid": {
    "enabled": true,
    "sparse_weight": 0.3,
    "dense_weight": 0.7
  }
}
```

Load it at startup and pass to your embedding pipeline — never hardcode model names or dimensions.

## Evaluation Metrics

### MTEB Retrieval Recall

Measure retrieval quality on your own corpus, not just MTEB leaderboard scores:

```python
def measure_recall_at_k(queries: list[dict], k: int = 10) -> float:
    """Each query dict has 'text' and 'relevant_doc_ids' (ground truth)."""
    hits = 0
    total_relevant = 0
    for q in queries:
        retrieved_ids = search_index(q["text"], top_k=k)
        hits += len(set(retrieved_ids) & set(q["relevant_doc_ids"]))
        total_relevant += len(q["relevant_doc_ids"])
    return hits / total_relevant if total_relevant else 0.0
```

Target thresholds:
- **Recall@10 ≥ 0.85** for general knowledge bases
- **Recall@5 ≥ 0.90** for high-stakes (legal, medical, compliance)
- **MRR@10 ≥ 0.70** for user-facing search

If recall drops >3% when reducing dimensions, keep the higher dimension count.

## Migration Between Models (Re-Embedding Pipeline)

Switching models (e.g., `ada-002` → `3-small`) requires re-embedding the entire corpus because vector spaces are incompatible. Never mix embeddings from different models in one index.

```python
import hashlib, json

def re_embed_pipeline(docs: list[dict], new_model: str, new_dims: int):
    """Dual-write to old + new index, then swap alias."""
    new_index = f"idx-{new_model}-{new_dims}-{int(time.time())}"
    create_index(new_index, dimensions=new_dims)

    for batch in chunked(docs, BATCH_SIZE):
        texts = [d["content"] for d in batch]
        vectors = embed_batch(texts, model=new_model, dimensions=new_dims)
        upsert_vectors(new_index, batch, vectors)

    # Validate before cutover
    recall = measure_recall_at_k(eval_queries, k=10)
    if recall < 0.85:
        raise ValueError(f"Recall {recall:.2f} below threshold — aborting migration")

    swap_index_alias("production", new_index)  # Atomic cutover
    # Keep old index for 7 days as rollback safety net
```

## Cost Estimation

Formula: `total_cost = (total_tokens / 1_000_000) × price_per_million`

```python
import tiktoken

def estimate_embedding_cost(texts: list[str], model: str = "text-embedding-3-small") -> dict:
    enc = tiktoken.encoding_for_model(model)
    total_tokens = sum(len(enc.encode(t)) for t in texts)
    price_map = {
        "text-embedding-3-small": 0.02,
        "text-embedding-3-large": 0.13,
        "text-embedding-ada-002": 0.10,
    }
    cost = (total_tokens / 1_000_000) * price_map[model]
    return {"total_tokens": total_tokens, "cost_usd": round(cost, 4), "model": model}
```

Example: 500k documents × 300 avg tokens = 150M tokens → $3.00 with `3-small`, $19.50 with `3-large`.

## Caching Embeddings

Cache embeddings by content hash to avoid re-embedding unchanged documents and to skip redundant API calls during retries.

```python
import hashlib, json, redis

r = redis.Redis(host="localhost", port=6379, db=0)
CACHE_TTL = 7 * 24 * 3600  # 7 days

def get_or_embed(text: str, model: str, dimensions: int) -> list[float]:
    cache_key = f"emb:{model}:{dimensions}:{hashlib.sha256(text.encode()).hexdigest()}"
    cached = r.get(cache_key)
    if cached:
        return json.loads(cached)
    resp = client.embeddings.create(input=text, model=model, dimensions=dimensions)
    vec = resp.data[0].embedding
    r.setex(cache_key, CACHE_TTL, json.dumps(vec))
    return vec
```

Include model name and dimensions in the cache key — vectors from different configs are not interchangeable.

## Hybrid Search Integration (Sparse + Dense)

Combine BM25 (sparse) with embedding vectors (dense) for best retrieval. Azure AI Search supports this natively with `semantic` ranking on top.

```python
from azure.search.documents import SearchClient
from azure.search.documents.models import VectorizableTextQuery

def hybrid_search(query: str, top_k: int = 10) -> list[dict]:
    vector_query = VectorizableTextQuery(
        text=query, k_nearest_neighbors=50, fields="content_vector"
    )
    results = search_client.search(
        search_text=query,            # BM25 sparse component
        vector_queries=[vector_query], # Dense component
        query_type="semantic",         # Semantic reranker on top
        semantic_configuration_name="default",
        top=top_k,
    )
    return [{"id": r["id"], "score": r["@search.score"]} for r in results]
```

Weight tuning: start with 0.7 dense / 0.3 sparse. If queries are keyword-heavy (product codes, error messages), shift toward 0.5/0.5.

## Choosing Dimensions — Decision Tree

1. **Budget-constrained, >1M docs**: `3-small` at 256 + hybrid search
2. **General RAG (10k–1M docs)**: `3-small` at 1536 (default) — best price/quality
3. **High-stakes retrieval (legal, medical)**: `3-large` at 1024 — near-max quality, 3× less storage than 3072
4. **Maximum quality, cost no object**: `3-large` at 3072
5. **Migrating from ada-002**: Switch to `3-small` at 1536 — better quality, 80% cost reduction

Always benchmark on your evaluation set before finalizing. Synthetic MTEB numbers don't predict domain-specific recall.
