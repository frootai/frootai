---
name: fai-embedding-model-select
description: |
  Select and configure embedding models for vector search and RAG pipelines. Use this skill when:
  - Choosing between embedding models (text-embedding-3-small vs large vs ada-002)
  - Configuring dimensions, batch sizes, and chunking parameters
  - Benchmarking embedding quality for a specific domain
  - Setting up hybrid search weighting (sparse vs dense)
---

# Embedding Model Selection

Select the optimal embedding model for vector search based on cost, quality, and latency tradeoffs.

## When to Use

- Starting a new RAG pipeline — choose the right embedding model
- Migrating from ada-002 to text-embedding-3 family
- Optimizing cost by reducing dimensions without quality loss
- Benchmarking embedding quality on domain-specific data

---

## Model Comparison

| Model | Dimensions | Cost/1M tokens | MTEB Score | Best For |
|-------|-----------|----------------|------------|----------|
| text-embedding-3-small | 1536 (or 512) | $0.02 | 62.3 | Cost-efficient RAG, most use cases |
| text-embedding-3-large | 3072 (or 1024) | $0.13 | 64.6 | High-precision retrieval, legal/medical |
| text-embedding-ada-002 | 1536 | $0.10 | 61.0 | Legacy — migrate to 3-small |

**Key insight:** text-embedding-3-small at 512 dimensions costs 80% less than ada-002 with comparable quality for most domains.

## Dimension Reduction

text-embedding-3 models support native dimension reduction via the `dimensions` parameter:

```python
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(
    azure_endpoint="https://oai-prod.openai.azure.com",
    azure_ad_token_provider=token_provider,
    api_version="2024-10-21",
)

# Full dimensions (1536)
response = client.embeddings.create(
    model="text-embedding-3-small",
    input="How to configure retry policies in Azure",
)

# Reduced dimensions (512) — 66% less storage, ~2% quality loss
response_reduced = client.embeddings.create(
    model="text-embedding-3-small",
    input="How to configure retry policies in Azure",
    dimensions=512,
)

embedding = response_reduced.data[0].embedding  # len=512
```

## Chunking Strategy

| Parameter | Recommendation | Why |
|-----------|---------------|-----|
| Chunk size | 512-1024 tokens | Balances context coverage and retrieval precision |
| Overlap | 50-100 tokens | Prevents information loss at chunk boundaries |
| Splitter | Recursive (by heading > paragraph > sentence) | Preserves semantic boundaries |

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=512,
    chunk_overlap=50,
    separators=["\n## ", "\n### ", "\n\n", "\n", ". ", " "],
)

chunks = splitter.split_text(document_text)
```

## Batch Embedding

```python
import asyncio

async def embed_batch(texts: list[str], batch_size: int = 16) -> list[list[float]]:
    """Embed texts in batches to stay within rate limits."""
    embeddings = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=batch,
            dimensions=512,
        )
        embeddings.extend([d.embedding for d in response.data])
    return embeddings
```

## Hybrid Search Weighting

Configure the balance between keyword (sparse) and vector (dense) retrieval:

```python
# Azure AI Search hybrid query
results = search_client.search(
    search_text="retry policy configuration",  # Keyword (BM25)
    vector_queries=[{
        "kind": "text",
        "text": "retry policy configuration",  # Vector (embedding)
        "fields": "contentVector",
        "k": 10,
        "weight": 0.7,  # Dense weight (higher = more semantic)
    }],
    query_type="semantic",
    semantic_configuration_name="default",
    top=10,
)
```

| Weighting | Sparse | Dense | Best For |
|-----------|--------|-------|----------|
| Keyword-heavy | 0.7 | 0.3 | Exact term matching (code, IDs) |
| Balanced | 0.5 | 0.5 | General purpose |
| Semantic-heavy | 0.3 | 0.7 | Natural language questions |

## Benchmarking

```python
def benchmark_model(model: str, dims: int, test_pairs: list[tuple[str, str]]) -> dict:
    """Evaluate retrieval quality with known relevant pairs."""
    from numpy import dot
    from numpy.linalg import norm

    hits = 0
    for query, expected in test_pairs:
        q_emb = embed(query, model, dims)
        e_emb = embed(expected, model, dims)
        similarity = dot(q_emb, e_emb) / (norm(q_emb) * norm(e_emb))
        if similarity > 0.75:
            hits += 1

    return {"model": model, "dimensions": dims,
            "recall": hits / len(test_pairs), "pairs_tested": len(test_pairs)}
```

## Decision Flowchart

```
Start → Budget constrained?
  Yes → text-embedding-3-small @ 512 dims
  No  → Domain-specific precision needed?
    Yes → text-embedding-3-large @ 1024+ dims
    No  → text-embedding-3-small @ 1536 dims
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Low retrieval quality | Chunk size too large or wrong splitter | Reduce to 512 tokens, use recursive splitter |
| High embedding costs | Full dimensions when fewer suffice | Test 512 dims — often <3% quality loss |
| Dimension mismatch errors | Query and index use different dims | Ensure same model + dimensions at index and query time |
| Slow batch processing | Sequential embedding calls | Use batch API (up to 16 inputs per call) |
