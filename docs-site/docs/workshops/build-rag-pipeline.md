---
sidebar_position: 1
title: "Workshop: Build a RAG Pipeline"
description: "Hands-on workshop — build an end-to-end RAG pipeline with Azure OpenAI, AI Search, chunking, embeddings, hybrid search, and evaluation. Based on Solution Play 01."
---

# Workshop: Build a RAG Pipeline

Build a complete **Retrieval-Augmented Generation** pipeline from scratch — from raw documents to a production-quality question-answering system with citations and evaluation.

| | |
|---|---|
| **Duration** | 2 hours (6 sections × 20 min) |
| **Level** | Intermediate |
| **Solution Play** | [01 — Enterprise RAG](../solution-plays/overview.md) |
| **You'll Build** | Document ingestion → chunking → embedding → indexing → retrieval → generation → evaluation |

## Prerequisites

- **Azure subscription** with Azure OpenAI access
- **Azure OpenAI** — GPT-4o deployment + text-embedding-3-large deployment
- **Azure AI Search** — Basic tier or higher (Free tier lacks semantic ranker)
- **Azure Blob Storage** — for source documents
- **VS Code** with FrootAI extension installed
- **Python 3.10+** with `pip`

```bash
pip install openai azure-search-documents azure-identity azure-storage-blob
```

## Section 1: Concepts (20 min)

RAG solves the core LLM limitation: **models don't know your data**. Retrieve relevant context at query time and inject it into the prompt — no retraining needed.

:::info Why RAG Over Fine-Tuning?
RAG gives you **up-to-date knowledge** without retraining. Update documents, re-index, and the system reflects changes immediately. See [T1: Fine-Tuning](../learning/t1-fine-tuning.md) for when fine-tuning is appropriate.
:::

**Key components:** chunking → embedding → indexing → retrieval (hybrid search) → generation with citations.

## Section 2: Data Preparation (20 min)

### Upload Source Documents

Upload PDFs or text files to Azure Blob Storage:

```bash
az storage blob upload-batch \
  --account-name <storage-account> \
  --destination documents \
  --source ./data/pdfs
```

### Chunking Strategy

Split documents into **512-token chunks with 128-token overlap**, then generate embeddings:

```python
def chunk_document(text: str, chunk_size: int = 512, overlap: int = 128):
    words = text.split()
    return [" ".join(words[i:i + chunk_size])
            for i in range(0, len(words), chunk_size - overlap)
            if words[i:i + chunk_size]]

client = AzureOpenAI(azure_endpoint="https://<resource>.openai.azure.com/",
                     api_version="2024-06-01")

def embed(text: str) -> list[float]:
    return client.embeddings.create(
        model="text-embedding-3-large", input=text
    ).data[0].embedding  # 3072 dimensions
```

## Section 3: Index Build (20 min)

Create an Azure AI Search index with keyword, vector, and semantic fields:

```python
from azure.search.documents.indexes.models import (
    SearchIndex, SearchField, VectorSearch,
    HnswAlgorithmConfiguration, VectorSearchProfile
)

index = SearchIndex(name="rag-workshop", fields=[
    SearchField(name="id", type="Edm.String", key=True),
    SearchField(name="content", type="Edm.String", searchable=True),
    SearchField(name="source", type="Edm.String", filterable=True),
    SearchField(name="embedding", type="Collection(Edm.Single)",
                vector_search_dimensions=3072,
                vector_search_profile_name="hnsw-profile")
], vector_search=VectorSearch(
    algorithms=[HnswAlgorithmConfiguration(name="hnsw")],
    profiles=[VectorSearchProfile(name="hnsw-profile",
                                   algorithm_configuration_name="hnsw")]
))
```

Push chunked and embedded documents:

```python
from azure.search.documents import SearchClient

search_client = SearchClient(endpoint, "rag-workshop", credential)
search_client.upload_documents([
    {"id": str(i), "content": chunk, "source": "doc.pdf",
     "embedding": embed(chunk)} for i, chunk in enumerate(chunks)
])
```

## Section 4: Query Pipeline (20 min)

### Hybrid Search (Keyword + Vector + Semantic Ranker)

```python
from azure.search.documents.models import VectorizableTextQuery

results = search_client.search(
    search_text=query,
    vector_queries=[VectorizableTextQuery(
        text=query, k_nearest_neighbors=5, fields="embedding")],
    query_type="semantic", semantic_configuration_name="default", top=5)

def build_context(results) -> str:
    return "\n\n---\n\n".join(
        f"[Source {i}: {r['source']}]\n{r['content']}"
        for i, r in enumerate(results, 1))
```

## Section 5: Full RAG Pipeline (20 min)

Wire retrieval to generation with citation support:

```python
async def rag_query(question: str) -> dict:
    results = search_client.search(search_text=question, top=5,
        vector_queries=[VectorizableTextQuery(text=question,
            k_nearest_neighbors=5, fields="embedding")],
        query_type="semantic", semantic_configuration_name="default")
    context = build_context(results)

    response = client.chat.completions.create(model="gpt-4o", messages=[
        {"role": "system", "content":
         "Answer based ONLY on the provided context. Cite as [Source N]. "
         "If the context doesn't contain the answer, say so."},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"}
    ], temperature=0.1, max_tokens=1000)

    return {"answer": response.choices[0].message.content,
            "sources": [r["source"] for r in results]}
```

:::tip Streaming for Better UX
In production, use `stream=True` to return tokens as they're generated. Users see the first token in ~500ms instead of waiting 3-5s for the full response.
:::

## Section 6: Evaluation (20 min)

Evaluate your RAG pipeline with standardized metrics:

| Metric | Target | What It Measures |
|--------|--------|-----------------|
| **Groundedness** | ≥ 4.0 | Is the answer supported by retrieved context? |
| **Relevance** | ≥ 4.0 | Does the answer address the user's question? |
| **Coherence** | ≥ 4.0 | Is the answer logically structured? |
| **Citation accuracy** | ≥ 90% | Do citations match actual source content? |

```python
from azure.ai.evaluation import GroundednessEvaluator

evaluator = GroundednessEvaluator(model_config)
score = evaluator(
    response=result["answer"],
    context=context,
    query=question
)
print(f"Groundedness: {score['groundedness']}")  # Target: ≥ 4.0
```

See [T2: Responsible AI](../learning/t2-responsible-ai.md) for the full evaluation framework.

## Cleanup

Remove Azure resources to avoid ongoing charges:

```bash
az group delete --name rag-workshop-rg --yes --no-wait
```

## Next Steps

- Explore [Solution Play 01](../solution-plays/overview.md) for the production-ready version
- Learn about [R2: RAG Architecture](../learning/r2-rag-architecture.md) for advanced patterns
- Try the [Multi-Agent Workshop](./multi-agent-service.md) for agentic RAG
