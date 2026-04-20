---
sidebar_position: 6
title: "R2: RAG Architecture"
description: "Retrieval-Augmented Generation end-to-end — ingestion pipeline, query pipeline, chunking strategies, hybrid search, and Azure implementation with latency breakdown."
---

# R2: RAG Architecture

RAG (Retrieval-Augmented Generation) grounds LLM responses in **your data** instead of relying on training-time knowledge. It solves three fundamental LLM limitations. For prompting fundamentals, see [R1: Prompt Engineering](./r1-prompt-engineering.md).

## Why RAG Exists

| LLM Limitation | What Happens | RAG Solution |
|----------------|-------------|--------------|
| **Knowledge cutoff** | Model doesn't know events after training date | Retrieve current docs at query time |
| **Hallucination** | Model fabricates plausible-sounding answers | Ground responses in retrieved evidence |
| **No private data** | Model can't access your internal docs, APIs, databases | Index private data into a search service |

## RAG vs Fine-Tuning vs Prompt Engineering

| Dimension | Prompt Engineering | RAG | Fine-Tuning |
|-----------|-------------------|-----|-------------|
| **Adds new knowledge** | ❌ | ✅ Real-time | ✅ Baked in |
| **Cites sources** | ❌ | ✅ With retrieval metadata | ❌ |
| **Setup cost** | Free | Medium (search infra + embeddings) | High (GPU + labeled data) |
| **Data freshness** | Training cutoff | Minutes (re-index) | Weeks (re-train) |
| **Best for** | Format, tone, style | Private/current knowledge Q&A | Domain language, specialized behavior |

**Decision rule:** Start with [prompt engineering](./r1-prompt-engineering.md). Add RAG when you need private or current data. Fine-tune only when RAG + prompting can't achieve the required style or accuracy.

## The Two Pipelines

RAG has two distinct pipelines — **Offline (Ingestion)** runs ahead of time, **Online (Query)** runs per request.

### Offline: Ingestion Pipeline

```
Documents → Load → Extract → Clean → Chunk → Enrich → Embed → Index
```

| Step | What It Does | Azure Service |
|------|-------------|---------------|
| **Document Loading** | Fetch from blob, SharePoint, SQL, APIs | Azure Blob Storage, Data Factory |
| **Extraction** | OCR, table extraction, layout analysis | Azure Document Intelligence |
| **Cleaning** | Remove headers, footers, boilerplate, PII | Custom code + Presidio |
| **Chunking** | Split into retrieval-friendly segments | Custom (see strategies below) |
| **Enrichment** | Add metadata: title, source, date, entities | Azure AI Language, custom |
| **Embedding** | Convert text → dense vectors (1536-3072 dims) | Azure OpenAI `text-embedding-3-large` |
| **Indexing** | Store vectors + metadata for fast retrieval | Azure AI Search |

### Online: Query Pipeline

```
User Query → Process → Embed → Retrieve → Rerank → Assemble Context → Generate
```

| Step | Typical Latency | What Happens |
|------|----------------|-------------|
| **Query Processing** | 5–20 ms | Rewrite, expand, decompose multi-part questions |
| **Query Embedding** | 20–50 ms | Convert query to same vector space as documents |
| **Retrieval** | 30–80 ms | Hybrid search (keyword + vector) returns top-50 |
| **Reranking** | 50–150 ms | Cross-encoder reranks top-50 → top-5 |
| **Context Assembly** | 5–10 ms | Format retrieved chunks + metadata into prompt |
| **LLM Generation** | 500–3000 ms | Generate grounded response with citations |
| **Total** | **~700–3300 ms** | End-to-end latency for a single RAG query |

:::info Latency Budget
Generation dominates total latency (60-80%). Use **streaming** to improve perceived performance — first tokens arrive in ~200 ms even if full response takes 3 seconds. FrootAI Play 01 implements streaming by default.
:::

## Chunking Strategies

Chunking quality is the **single biggest factor** in RAG accuracy.

| Strategy | Chunk Size | Overlap | Best For | Trade-off |
|----------|-----------|---------|----------|-----------|
| **Fixed-size** | 512 tokens | 128 tokens (25%) | General-purpose, fast | May split mid-sentence |
| **Recursive** | 256–1024 tokens | Paragraph boundaries | Structured docs (markdown, HTML) | Slower, better quality |
| **Semantic** | Variable | Embedding similarity threshold | Complex, varied documents | Expensive (requires embedding each segment) |
| **Document-aware** | Per section/page | None | PDFs, slides, legal docs | Requires layout understanding |

:::tip Start with Fixed-Size
Fixed-size chunking with 512 tokens and 128-token overlap works for 80% of use cases. Only invest in semantic chunking when evaluation shows retrieval quality issues. See [R3: Deterministic AI](./r3-deterministic-ai.md) for evaluation methods.
:::

## Hybrid Search

Modern RAG systems combine **keyword search** (BM25) and **vector search** for best results:

| Search Type | Strengths | Weaknesses |
|-------------|-----------|------------|
| **Keyword (BM25)** | Exact matches, names, codes, acronyms | Misses synonyms and paraphrases |
| **Vector** | Semantic similarity, handles paraphrasing | Can miss exact terms, numbers |
| **Hybrid** | Best of both — precision + recall | Slightly higher latency |

**Typical weight split:** 50–70% vector, 30–50% keyword. Azure AI Search supports hybrid natively with `search_type="hybrid"`.

## Python Implementation: Hybrid Search with Azure AI Search

```python
from azure.search.documents import SearchClient
from azure.identity import DefaultAzureCredential
from openai import AzureOpenAI

credential = DefaultAzureCredential()

search_client = SearchClient(
    endpoint="https://my-search.search.windows.net",
    index_name="knowledge-base",
    credential=credential,
)

oai_client = AzureOpenAI(
    azure_endpoint="https://my-oai.openai.azure.com/",
    api_version="2024-12-01-preview",
    azure_deployment="gpt-4o",
)

def rag_query(question: str, top_k: int = 5) -> str:
    # 1. Hybrid search (keyword + vector)
    results = search_client.search(
        search_text=question,
        vector_queries=[{
            "kind": "text",
            "text": question,
            "fields": "content_vector",
            "k": top_k,
        }],
        query_type="semantic",
        semantic_configuration_name="default",
        top=top_k,
    )

    # 2. Assemble context with source citations
    context_parts = []
    for i, r in enumerate(results, 1):
        context_parts.append(f"[{i}] {r['title']}: {r['content']}")
    context = "\n\n".join(context_parts)

    # 3. Generate grounded response
    response = oai_client.chat.completions.create(
        model="gpt-4o",
        temperature=0.2,
        max_tokens=800,
        messages=[
            {
                "role": "system",
                "content": (
                    "Answer using ONLY the provided context. "
                    "Cite sources as [1], [2], etc. "
                    "If the context doesn't contain the answer, say so."
                ),
            },
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"},
        ],
    )
    return response.choices[0].message.content
```

## Azure RAG Architecture

| Component | Azure Service | SKU (Dev / Prod) |
|-----------|--------------|-----------------|
| **Vector Store + Search** | Azure AI Search | Free / Standard S2 |
| **Embeddings** | Azure OpenAI `text-embedding-3-large` | PAYG |
| **Generation** | Azure OpenAI `gpt-4o` | PAYG / PTU |
| **Document Processing** | Azure Document Intelligence | S0 |
| **Storage** | Azure Blob Storage | LRS / GRS |
| **Orchestration** | Azure Functions or Container Apps | Consumption / Dedicated |

:::warning
Always use **Managed Identity** for service-to-service auth — never embed API keys in application code. Use Azure Key Vault for any secrets that can't use Managed Identity. See FrootAI's [security instructions](./r1-prompt-engineering.md) for more.
:::

## Key Takeaways

1. **RAG = Ingestion (offline) + Query (online)** — optimize both independently
2. **Chunking quality drives retrieval quality** — start with 512 tokens / 128 overlap
3. **Hybrid search (keyword + vector) beats either alone** — use 50-70% vector weight
4. **Streaming hides latency** — first tokens arrive in ~200 ms
5. **Cite sources** — every RAG response must include retrievable references

FrootAI Play 01 (Enterprise RAG) and Play 21 (Agentic RAG) implement production-grade versions of these patterns with evaluation pipelines. Use [O1: Semantic Kernel](./o1-semantic-kernel.md) for orchestration.
