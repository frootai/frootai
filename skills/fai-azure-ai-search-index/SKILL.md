---
name: fai-azure-ai-search-index
description: Create Azure AI Search vector indexes with HNSW profiles, semantic ranker configuration, hybrid BM25+vector search, field mappings for chunked RAG documents, and batch indexing pipelines — resolving recall failures and irrelevant chunk retrieval.
---

# FAI Azure AI Search Index

Configures Azure AI Search indexes optimised for RAG retrieval -- combining vector (HNSW), keyword (BM25), and semantic reranking into a hybrid pipeline that consistently outperforms pure-vector search on recall. Addresses the most common retrieval failures: wrong chunk size, missing semantic profile, inverted keyword/vector weights, and embedding dimension mismatch.

## When to Invoke

| Signal | Example |
|--------|---------|
| RAG answers are imprecise or hallucinated | Correct document exists but is not retrieved |
| Index has no vector field | Only keyword search configured |
| Semantic ranker not enabled | `queryType: 'simple'` in search calls |
| Embedding dimensions don't match | 1536 vs 3072 mismatch causing zero results |

## Workflow

### Step 1 — Define the Index Schema

```python
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    SearchIndex, SearchField, SearchFieldDataType,
    VectorSearch, HnswAlgorithmConfiguration, HnswParameters,
    VectorSearchProfile, SemanticConfiguration, SemanticSearch,
    SemanticPrioritizedFields, SemanticField,
)
from azure.identity import DefaultAzureCredential

client = SearchIndexClient(
    endpoint=SEARCH_ENDPOINT,
    credential=DefaultAzureCredential(),
)

index = SearchIndex(
    name="rag-documents",
    fields=[
        SearchField(name="id",            type=SearchFieldDataType.String,    key=True,       filterable=True),
        SearchField(name="content",       type=SearchFieldDataType.String,    searchable=True, analyzer_name="en.microsoft"),
        SearchField(name="title",         type=SearchFieldDataType.String,    searchable=True, filterable=True),
        SearchField(name="source_url",    type=SearchFieldDataType.String,    filterable=True),
        SearchField(name="category",      type=SearchFieldDataType.String,    filterable=True, facetable=True),
        SearchField(name="chunk_index",   type=SearchFieldDataType.Int32,     filterable=True, sortable=True),
        SearchField(name="last_modified", type=SearchFieldDataType.DateTimeOffset, filterable=True, sortable=True),
        # Vector field -- dimensions MUST match your embedding model output exactly
        SearchField(
            name="content_vector",
            type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
            searchable=True,
            vector_search_dimensions=3072,             # text-embedding-3-large
            vector_search_profile_name="hnsw-profile",
        ),
    ],
)
```

### Step 2 — Configure HNSW and Semantic Profiles

```python
    # Attach to the index object from Step 1
    index.vector_search = VectorSearch(
        algorithms=[
            HnswAlgorithmConfiguration(
                name="hnsw-config",
                parameters=HnswParameters(
                    m=4,               # Connections per layer -- higher = better recall, more memory
                    ef_construction=400,  # Build-time search depth
                    ef_search=500,        # Query-time search depth -- tune up if recall < 80%
                    metric="cosine",
                ),
            )
        ],
        profiles=[VectorSearchProfile(
            name="hnsw-profile",
            algorithm_configuration_name="hnsw-config",
        )],
    )

    index.semantic_search = SemanticSearch(
        configurations=[
            SemanticConfiguration(
                name="semantic-config",
                prioritized_fields=SemanticPrioritizedFields(
                    title_field=SemanticField(field_name="title"),
                    content_fields=[SemanticField(field_name="content")],
                    keywords_fields=[SemanticField(field_name="category")],
                ),
            )
        ]
    )

client.create_or_update_index(index)
print("Index 'rag-documents' created/updated")
```

### Step 3 — Hybrid Search Query

```python
from azure.search.documents import SearchClient
from azure.search.documents.models import VectorizedQuery

search_client = SearchClient(SEARCH_ENDPOINT, "rag-documents", DefaultAzureCredential())

def hybrid_search(query: str, embedding: list[float], top_k: int = 5) -> list[dict]:
    vector_query = VectorizedQuery(
        vector=embedding,
        k_nearest_neighbors=50,      # Retrieve 50 vector candidates before reranking
        fields="content_vector",
    )

    results = search_client.search(
        search_text=query,             # BM25 keyword component
        vector_queries=[vector_query],
        query_type="semantic",         # Enable semantic reranker
        semantic_configuration_name="semantic-config",
        select=["id", "title", "content", "source_url", "category"],
        top=top_k,
        query_language="en-us",
    )

    return [
        {
            "id":      r["id"],
            "title":   r["title"],
            "content": r["content"],
            "source":  r["source_url"],
            "score":   r["@search.reranker_score"],
        }
        for r in results
    ]
```

### Step 4 — Batch Document Indexing

```python
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

# Managed Identity for both OpenAI and Search -- no API keys
token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)
openai_client  = AzureOpenAI(azure_endpoint=AOAI_ENDPOINT, azure_ad_token_provider=token_provider)
search_client  = SearchClient(SEARCH_ENDPOINT, "rag-documents", DefaultAzureCredential())

def index_chunks(chunks: list[dict], batch_size: int = 32) -> None:
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]

        # Batch embed -- one API call per 32 chunks
        embeddings = openai_client.embeddings.create(
            input=[c["content"] for c in batch],
            model="text-embedding-3-large",
        ).data

        docs = [
            {**chunk, "content_vector": emb.embedding}
            for chunk, emb in zip(batch, embeddings)
        ]
        result = search_client.upload_documents(docs)
        succeeded = sum(1 for r in result if r.succeeded)
        print(f"Batch {i // batch_size + 1}: {succeeded}/{len(docs)} indexed")
```

### Step 5 — Recall Validation

```python
def validate_recall(test_queries: list[dict], top_k: int = 5) -> float:
    """Measure Recall@K -- fraction of queries where gold doc is in top-K results."""
    hits = 0
    for q in test_queries:
        embedding = openai_client.embeddings.create(
            input=q["query"], model="text-embedding-3-large"
        ).data[0].embedding
        results = hybrid_search(q["query"], embedding, top_k)
        if any(r["id"] == q["expected_id"] for r in results):
            hits += 1

    recall = hits / len(test_queries)
    print(f"Recall@{top_k}: {recall:.2%}  ({hits}/{len(test_queries)} hits)")
    return recall
```

## HNSW Tuning Reference

| Parameter | Low Value | High Value | Recommendation |
|-----------|-----------|------------|----------------|
| `m` | 2 (less memory) | 16 (better recall) | 4 for most RAG workloads |
| `ef_construction` | 100 (faster build) | 1000 (better recall) | 400 |
| `ef_search` | 100 (faster query) | 1000 (better recall) | 500; increase if Recall@5 < 80% |

## WAF Alignment

| Pillar | Contribution |
|--------|-------------|
| Reliability | Semantic reranker reduces hallucinations from wrong-chunk retrieval |
| Performance Efficiency | HNSW delivers sub-100ms retrieval at million-document scale |
| Security | `DefaultAzureCredential` for both OpenAI and Search -- no API keys in configuration |

## Compatible Solution Plays

- **Play 01** — Enterprise RAG (primary vector store)
- **Play 09** — AI Search Portal (faceted search UI)
- **Play 21** — Agentic RAG (multi-index retrieval)

## Notes

- `text-embedding-3-large` outputs 3072 dimensions; `text-embedding-3-small` outputs 1536 -- match `vector_search_dimensions` exactly or queries return zero results
- Set `k_nearest_neighbors=50` in the vector query, then `top=5` -- semantic reranker selects best 5 from the 50 vector candidates
- Semantic reranker adds ~30ms median latency; the recall improvement almost always justifies it
- Rebuild the index (not update) when changing `vector_search_dimensions` or HNSW `m` parameter
