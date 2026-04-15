---
name: fai-build-genai-rag
description: |
  Build RAG systems with document chunking, vector indexing, hybrid retrieval,
  citation pipelines, and evaluation. Use when implementing retrieval-augmented
  generation for knowledge bases, support bots, or document Q&A.
---

# Build GenAI RAG Pipeline

Implement retrieval-augmented generation with chunking, indexing, retrieval, and evaluation.

## When to Use

- Building a knowledge-base Q&A system with grounded answers
- Implementing document search with LLM-generated responses
- Need citations and source attribution in AI answers
- Setting up evaluation pipelines for retrieval quality

---

## Architecture

```
Documents → Chunk → Embed → Index → Query → Retrieve → Augment → Generate → Cite
```

## Step 1: Document Chunking

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=512, chunk_overlap=50,
    separators=["\n## ", "\n### ", "\n\n", "\n", ". ", " "],
)

def chunk_document(text: str, metadata: dict) -> list[dict]:
    chunks = splitter.split_text(text)
    return [{"content": c, "chunk_index": i, **metadata}
            for i, c in enumerate(chunks)]
```

## Step 2: Embed and Index

```python
from azure.search.documents import SearchClient

def embed_and_index(chunks: list[dict], search_client: SearchClient):
    texts = [c["content"] for c in chunks]
    embeddings = oai.embeddings.create(model="text-embedding-3-small", input=texts)
    for chunk, emb in zip(chunks, embeddings.data):
        chunk["contentVector"] = emb.embedding
        chunk["id"] = f"{chunk['source']}-{chunk['chunk_index']}"
    search_client.upload_documents(chunks)
```

## Step 3: Hybrid Retrieval

```python
def retrieve(query: str, client: SearchClient, top_k: int = 5) -> list[dict]:
    results = client.search(
        search_text=query,
        vector_queries=[{"kind": "text", "text": query,
                         "fields": "contentVector", "k": top_k}],
        query_type="semantic",
        semantic_configuration_name="default",
        top=top_k,
        select=["id", "content", "source"],
    )
    return [{"content": r["content"], "source": r["source"],
             "score": r["@search.score"]} for r in results]
```

## Step 4: Generate with Citations

```python
import json

def generate_answer(query: str, context: list[dict]) -> dict:
    context_text = "\n\n".join(
        f"[{i+1}] {c['content']}" for i, c in enumerate(context))
    response = oai.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": """Answer using ONLY the provided context.
Cite sources as [1], [2]. If not in context, say "I don't know."
Return JSON: {"answer": "string", "citations": [1, 2]}"""},
            {"role": "user", "content": f"Context:\n{context_text}\n\nQ: {query}"},
        ],
        temperature=0.2,
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)
```

## Step 5: Evaluate

```python
def evaluate_rag(test_set, retrieve_fn, generate_fn) -> dict:
    scores = {"groundedness": [], "relevance": []}
    for row in test_set:
        ctx = retrieve_fn(row["question"])
        result = generate_fn(row["question"], ctx)
        scores["groundedness"].append(judge_groundedness(result, ctx))
        scores["relevance"].append(judge_relevance(result, row["question"]))
    return {k: sum(v)/len(v) for k, v in scores.items()}
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Irrelevant retrieval | Chunk size too large | Reduce to 512 tokens with overlap |
| Hallucinated answers | No grounding instruction | Add "answer ONLY from context" |
| Missing citations | No citation format | Require numbered citations in schema |
| Low eval scores | Embedding mismatch | Same model for indexing and querying |