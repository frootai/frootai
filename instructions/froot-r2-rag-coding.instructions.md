---
description: "RAG coding standards — chunking config, embedding batch calls, reranker integration, citation injection."
applyTo: "**/*.py, **/*.ts"
waf:
  - "reliability"
  - "performance-efficiency"
---

# RAG Coding Patterns — FAI Standards

## Document Processing Pipeline

Follow: **Extract → Clean → Chunk → Embed → Index**. Never skip steps.

```python
async def ingest(doc: Document, cfg: RAGConfig) -> IndexResult:
    text = extract_text(doc)                          # PDF/DOCX/HTML → plain text
    cleaned = strip_headers_footers(text)             # Remove boilerplate
    chunks = chunk_with_metadata(cleaned, doc.source) # Preserve source lineage
    embeddings = await batch_embed(chunks, cfg)       # Batched API calls
    return await upsert_to_index(chunks, embeddings, cfg)
```

## Chunking Strategies

Configure sizes via `config/rag.json` — never hardcode. Choose strategy by document type:

- **Fixed-size + overlap** (default): `size=512` tokens, `overlap=128`. Use for unstructured text.
- **Structure-aware**: Split on headings (H1/H2/H3), fall back to fixed when section exceeds max tokens. Use for Markdown, HTML, legal docs.
- **Semantic**: Split at topic boundaries via embedding similarity. Expensive — use only when quality demands it.

```python
def chunk_fixed(text: str, size: int = 512, overlap: int = 128) -> list[Chunk]:
    tokens = tokenizer.encode(text)
    return [Chunk(text=tokenizer.decode(tokens[i:i + size]),
                  start_token=i, end_token=min(i + size, len(tokens)))
            for i in range(0, len(tokens), size - overlap)]
```

## Embedding Best Practices

Batch requests — Azure OpenAI supports up to 16 inputs per call.

```python
async def batch_embed(chunks: list[Chunk], cfg: RAGConfig) -> list[list[float]]:
    results = []
    for i in range(0, len(chunks), cfg.embedding_batch_size):
        batch = [c.text for c in chunks[i:i + cfg.embedding_batch_size]]
        resp = await client.embeddings.create(
            model=cfg.embedding_model, input=batch, dimensions=cfg.embedding_dimensions)
        results.extend([item.embedding for item in resp.data])
    return results
```

- `text-embedding-3-large` with `dimensions=1536` for production
- `text-embedding-3-small` for dev/prototyping only
- Strip HTML/Markdown formatting before embedding — tags are noise

## Hybrid Search with Semantic Reranking

Always combine keyword + vector + semantic reranker. Pure vector search misses exact matches.

```python
results = search_client.search(
    search_text=query,                                      # BM25 keyword
    vector_queries=[VectorizableTextQuery(
        text=query, k_nearest_neighbors=50, fields="content_vector")],
    query_type="semantic", semantic_configuration_name="default",
    top=cfg.retrieval_top_k,                                # 5-10 for generation
    select=["id", "content", "source_url", "chunk_id"],
    filter=metadata_filter,                                 # Tenant/date scoping
)
```

- `k_nearest_neighbors=50` candidate pool → reranker selects `top=5`
- Semantic reranker adds ~200ms — worth it for quality
- Use `filter` for tenant isolation, date ranges, document categories

## Vector Store Configuration

**Azure AI Search** — preferred. Define HNSW profile with `m=4`, `efConstruction=400`.
**Cosmos DB vCore** — when transactional consistency + vector search needed. `m=16`, `efConstruction=64`, `similarity=COS`.

## Citation Pipeline

Every chunk carries source lineage: `source_url`, `page_number`, `chunk_id`, `heading`. Tag chunks `[Source N]` in context, instruct model to cite them, post-process to resolve URLs.

## Context Window Budget

Reserve tokens explicitly — never fill the full window with retrieved content.

- System prompt: 500–1000 tokens
- Retrieved context: 60% of window
- Conversation history: 15% of window
- Response: `max_tokens` from config
- Count with `tiktoken` — never estimate. Truncate oldest turns first, not context.

## Multi-Index Routing & Metadata Filtering

- Route queries to domain-specific indexes based on intent classification
- `tenant_id` filters for multi-tenant isolation — never rely on prompt alone
- Date filters for time-sensitive content (policies, release notes)

## Retrieval Evaluation

| Metric | Target | Measures |
|--------|--------|----------|
| Recall@5 | ≥ 0.80 | Relevant docs in top-k |
| MRR | ≥ 0.70 | First relevant doc rank |
| NDCG@10 | ≥ 0.75 | Rank quality with position weighting |
| Groundedness | ≥ 4.0/5 | Answer supported by context |

Run `evaluation/eval_retrieval.py` against labeled test set before every index config change.

## Grounding Check

Verify LLM answers against retrieved sources at `temperature=0`. Reject ungrounded claims.

## Anti-Patterns

- ❌ Embedding raw HTML/Markdown — formatting tags kill retrieval precision
- ❌ Single monolithic index for all doc types — use domain-specific indexes
- ❌ Pure vector search without BM25 keyword component
- ❌ Filling entire context window with chunks — no room for response
- ❌ Hardcoded chunk sizes — configure in `config/rag.json`
- ❌ Skipping overlap in fixed chunking — loses boundary context
- ❌ No citation tracking — can't verify or debug answers
- ❌ Embedding full documents instead of chunks — embeddings lose specificity
- ❌ Cosine similarity threshold as sole filter — always use reranking
- ❌ `temperature > 0` for grounding checks or RAG classification

## WAF Alignment

| Pillar | RAG Practice |
|--------|-------------|
| **Reliability** | Retry embedding/search with backoff. Circuit breaker on vector store. Keyword-only fallback. |
| **Security** | Tenant metadata filters. Managed Identity for clients. PII strip before indexing. Prompt injection detection. |
| **Cost** | Batch embeddings (16/call). Cache query embeddings. `text-embedding-3-small` for dev. Right-size HNSW params. |
| **Performance** | Async embed calls. Pre-compute at ingest. Semantic cache. Stream LLM responses. |
| **Ops Excellence** | Log recall, latency, reranker scores. Track token usage. Alert on groundedness drops. Version index schemas. |
| **Responsible AI** | Grounding check every answer. Citations for transparency. Content Safety on chunks + answers. |
