---
description: "Play 01 patterns — RAG-specific patterns — chunking strategy, embedding batch, hybrid search, citation enforcement, hallucination prevention."
applyTo: "**/*.py, **/*.bicep"
waf:
  - "reliability"
  - "security"
---

# Play 01 — Enterprise RAG Patterns — FAI Standards

## Document Ingestion Pipeline (Extract → Chunk → Embed → Index)

Every document flows through four stages. Each stage preserves `source_id`, `page_number`, and `section_title` metadata for citation tracing downstream.

```python
from azure.identity import DefaultAzureCredential
from azure.ai.documentintelligence import DocumentIntelligenceClient
from openai import AzureOpenAI
from azure.search.documents import SearchClient
import json, hashlib

cfg = json.load(open("config/rag.json"))
credential = DefaultAzureCredential()

# Stage 1: Extract — Azure Document Intelligence layout model
doc_client = DocumentIntelligenceClient(cfg["doc_intelligence_endpoint"], credential)
poller = doc_client.begin_analyze_document("prebuilt-layout", body=pdf_bytes, content_type="application/pdf")
result = poller.result()
pages = [{"page": p.page_number, "text": p.content, "source_id": doc_id} for p in result.pages]

# Stage 2: Chunk — see chunking strategies below
chunks = semantic_chunk(pages, max_tokens=cfg["chunk_max_tokens"], overlap=cfg["chunk_overlap_tokens"])

# Stage 3: Embed — batched, dimension-reduced
embeddings = batch_embed(chunks, model=cfg["embedding_model"], dimensions=cfg["embedding_dimensions"])

# Stage 4: Index — upload to Azure AI Search
search_client = SearchClient(cfg["search_endpoint"], cfg["search_index"], credential)
docs = [{"id": hashlib.sha256(c["text"].encode()).hexdigest()[:16],
         "content": c["text"], "embedding": e,
         "source_id": c["source_id"], "page_number": c["page_number"],
         "section_title": c["section_title"]}
        for c, e in zip(chunks, embeddings)]
search_client.upload_documents(docs)
```

## Chunking Strategies

### Semantic Chunking (preferred for prose documents)
Split on heading boundaries, paragraph breaks, or sentence clusters. Respect section structure.

```python
def semantic_chunk(pages: list[dict], max_tokens: int = 512, overlap_tokens: int = 64) -> list[dict]:
    """Split on paragraph/heading boundaries, merge small paragraphs, split large ones."""
    chunks = []
    for page in pages:
        paragraphs = page["text"].split("\n\n")
        buffer, buf_len = "", 0
        for para in paragraphs:
            para_tokens = len(para.split())  # approximate; use tiktoken in production
            if buf_len + para_tokens > max_tokens and buffer:
                chunks.append({"text": buffer.strip(), "page_number": page["page"],
                               "source_id": page.get("source_id", ""), "section_title": ""})
                # keep overlap from end of previous chunk
                overlap_text = " ".join(buffer.split()[-overlap_tokens:])
                buffer, buf_len = overlap_text + " " + para, overlap_tokens + para_tokens
            else:
                buffer += "\n\n" + para
                buf_len += para_tokens
        if buffer.strip():
            chunks.append({"text": buffer.strip(), "page_number": page["page"],
                           "source_id": page.get("source_id", ""), "section_title": ""})
    return chunks
```

### Fixed-Size with Overlap (for code, logs, structured data)
Use `tiktoken` for exact token counts. 512 tokens/chunk, 64-token overlap is the baseline — tune via `config/rag.json`.

## Embedding with text-embedding-3-large

Batch embedding calls (max 2048 inputs/call). Use `dimensions` parameter to reduce 3072 → 1536 for cost/latency without meaningful recall loss.

```python
def batch_embed(chunks: list[dict], model: str, dimensions: int, batch_size: int = 256) -> list[list[float]]:
    """Batch embed with dimension reduction. Caller handles retry on 429."""
    aoai = AzureOpenAI(azure_endpoint=cfg["aoai_endpoint"], azure_ad_token_provider=get_bearer,
                       api_version="2024-06-01")
    all_embeddings = []
    for i in range(0, len(chunks), batch_size):
        batch = [c["text"] for c in chunks[i:i + batch_size]]
        resp = aoai.embeddings.create(input=batch, model=model, dimensions=dimensions)
        all_embeddings.extend([d.embedding for d in resp.data])
    return all_embeddings
```

## Azure AI Search — Hybrid Search (Keyword + Vector + Semantic Reranking)

Always use all three retrieval modes together — keyword recall covers exact terms vectors miss, vector recall covers semantic similarity, semantic reranker reorders by deep relevance.

```python
from azure.search.documents.models import VectorizableTextQuery

def hybrid_search(query: str, top_k: int = 5) -> list[dict]:
    vector_query = VectorizableTextQuery(text=query, k_nearest_neighbors=50, fields="embedding")
    results = search_client.search(
        search_text=query,                           # BM25 keyword
        vector_queries=[vector_query],                # vector
        query_type="semantic",                        # semantic reranker
        semantic_configuration_name=cfg["semantic_config"],
        top=top_k,
        select=["content", "source_id", "page_number", "section_title"],
    )
    return [{"content": r["content"], "source_id": r["source_id"],
             "page": r["page_number"], "section": r["section_title"],
             "score": r["@search.reranker_score"]} for r in results]
```

## Citation Pipeline — Source Tracking Through Chunks to Response

Inject numbered source references into the system prompt. The model cites `[1]`, `[2]` etc. Post-process to map citations back to original documents.

```python
def build_grounded_prompt(query: str, sources: list[dict]) -> list[dict]:
    context_block = "\n\n".join(
        f"[{i+1}] (Source: {s['source_id']}, Page {s['page']})\n{s['content']}"
        for i, s in enumerate(sources)
    )
    return [
        {"role": "system", "content": f\"\"\"You are an enterprise assistant. Answer ONLY from the provided sources.
Rules:
- Cite every claim with [N] referring to the source number.
- If the sources do not contain the answer, say "I don't have enough information to answer that."
- Never fabricate information beyond what the sources state.
- Use direct quotes with citations for critical facts.

Sources:
{context_block}\"\"\"},
        {"role": "user", "content": query}
    ]
```

## Chat History with Cosmos DB

Store conversation turns in Cosmos DB with TTL. Partition by `session_id` for single-partition reads.

```python
from azure.cosmos import CosmosClient

cosmos = CosmosClient(cfg["cosmos_endpoint"], credential)
container = cosmos.get_database_client(cfg["cosmos_db"]).get_container_client("conversations")

def save_turn(session_id: str, role: str, content: str, citations: list[dict] | None = None):
    container.create_item({"id": f"{session_id}-{uuid4().hex[:8]}", "session_id": session_id,
                           "role": role, "content": content, "citations": citations or [],
                           "timestamp": datetime.utcnow().isoformat(), "ttl": cfg.get("chat_ttl", 2592000)})

def get_history(session_id: str, max_turns: int = 10) -> list[dict]:
    query = "SELECT * FROM c WHERE c.session_id=@sid ORDER BY c.timestamp DESC OFFSET 0 LIMIT @n"
    items = list(container.query_items(query, parameters=[
        {"name": "@sid", "value": session_id}, {"name": "@n", "value": max_turns}
    ], partition_key=session_id))
    return [{"role": i["role"], "content": i["content"]} for i in reversed(items)]
```

## Content Safety on Output

Screen every LLM response before returning to the user. Block or flag based on severity thresholds from config.

```python
from azure.ai.contentsafety import ContentSafetyClient
from azure.ai.contentsafety.models import AnalyzeTextOptions

safety = ContentSafetyClient(cfg["content_safety_endpoint"], credential)

def check_safety(text: str) -> bool:
    result = safety.analyze_text(AnalyzeTextOptions(text=text))
    thresholds = cfg.get("safety_thresholds", {"Hate": 2, "Violence": 2, "SelfHarm": 2, "Sexual": 2})
    for cat in result.categories_analysis:
        if cat.severity >= thresholds.get(cat.category, 2):
            return False  # blocked
    return True
```

## Retrieval Evaluation

Measure retrieval quality offline before deploying config changes. Minimum thresholds: **Recall@5 ≥ 0.85**, **MRR ≥ 0.70**.

```python
def evaluate_retrieval(test_set: list[dict], top_k: int = 5) -> dict:
    recalls, mrrs = [], []
    for item in test_set:
        results = hybrid_search(item["query"], top_k=top_k)
        retrieved_ids = {r["source_id"] for r in results}
        relevant_ids = set(item["relevant_source_ids"])
        recalls.append(len(retrieved_ids & relevant_ids) / len(relevant_ids))
        for rank, r in enumerate(results, 1):
            if r["source_id"] in relevant_ids:
                mrrs.append(1.0 / rank); break
        else:
            mrrs.append(0.0)
    return {"recall_at_k": sum(recalls) / len(recalls), "mrr": sum(mrrs) / len(mrrs)}
```

## Config-Driven Parameters (`config/rag.json`)

All tunable values live in config — never hardcode. Example:
```json
{"chunk_max_tokens": 512, "chunk_overlap_tokens": 64, "embedding_model": "text-embedding-3-large",
 "embedding_dimensions": 1536, "search_top_k": 5, "semantic_config": "my-semantic-config",
 "temperature": 0.1, "max_tokens": 1024, "chat_ttl": 2592000,
 "safety_thresholds": {"Hate": 2, "Violence": 2, "SelfHarm": 2, "Sexual": 2}}
```

## Anti-Patterns

- ❌ Embedding entire documents without chunking — exceeds token limits, destroys retrieval precision
- ❌ Vector-only search without BM25 keyword — misses exact-match terms like product codes, error IDs
- ❌ Skipping semantic reranker — raw vector similarity returns noisy top-K results
- ❌ No overlap between chunks — loses context at chunk boundaries, fragments sentences
- ❌ Hardcoding chunk size across all document types — tables need different strategy than prose
- ❌ Returning LLM response without citation validation — model may hallucinate source numbers
- ❌ Storing chat history without TTL — unbounded Cosmos DB growth, cost explosion
- ❌ Using API keys instead of `DefaultAzureCredential` — secrets in code/env vars leak
- ❌ Embedding with full 3072 dimensions when 1536 suffices — doubles storage + latency for <1% recall gain
- ❌ Skipping Content Safety filtering on output — exposes users to harmful generated content

## WAF Alignment

| Pillar | Play 01 Implementation |
| --- | --- |
| **Security** | `DefaultAzureCredential` everywhere, Key Vault for non-Azure secrets, private endpoints on Search + Cosmos + OpenAI, Content Safety on output, Prompt Shields on input |
| **Reliability** | Retry with backoff on embedding/search calls, circuit breaker on OpenAI, health check at `/health` with dependency status, fallback to keyword-only if vector service degrades |
| **Cost** | `text-embedding-3-large` with `dimensions=1536`, `max_tokens` from config, semantic cache in Redis (TTL from config), gpt-4o-mini for query rewriting before gpt-4o for generation |
| **Performance** | Batch embedding (256/call), async ingestion pipeline, streaming SSE for chat responses, Cosmos DB partition key = `session_id` for single-partition reads |
| **Operations** | Structured logging with correlation IDs, retrieval eval in CI (fail deploy if Recall@5 < 0.85), token usage telemetry per request, config changes via PR review |
| **Responsible AI** | Grounding instructions in system prompt, citation enforcement, "I don't know" fallback, Content Safety severity thresholds from config, PII redaction before logging |
