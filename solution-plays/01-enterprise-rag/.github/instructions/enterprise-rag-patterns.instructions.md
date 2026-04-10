---
description: "Enterprise RAG domain patterns — chunking strategies, hybrid search, grounding, evaluation pipeline, Azure AI integration"
applyTo: "**/*.{py,ts,js}"
---

# Enterprise RAG — Domain Patterns

## Pattern 1: Document Chunking with Semantic Boundaries

### Problem
Naive character-based splitting breaks sentences, destroys context, and reduces retrieval quality.

### Solution — Sentence-Aware Chunking
```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1024,
    chunk_overlap=128,        # 12.5% overlap
    separators=["\n\n", "\n", ". ", " ", ""],  # Paragraph > sentence > word
    length_function=len,
)
chunks = splitter.split_text(document_text)

# Add metadata for retrieval context
for i, chunk in enumerate(chunks):
    chunk_doc = {
        "id": f"{doc_id}_chunk_{i}",
        "content": chunk,
        "source": document_name,
        "page": page_number,
        "chunk_index": i,
        "total_chunks": len(chunks),
    }
```

### Key Parameters
| Parameter | Range | Impact |
|-----------|-------|--------|
| chunk_size | 512-1024 tokens | Too small = no context. Too large = noise. |
| chunk_overlap | 10-15% of chunk_size | Prevents mid-sentence splits |
| separators | paragraph → sentence → word | Respects document structure |

## Pattern 2: Hybrid Search (BM25 + Vector + Semantic Reranking)

### Problem
Vector-only search misses exact keyword matches (product codes, error codes, IDs). BM25-only search misses semantic similarity.

### Solution — Triple-Mode Hybrid
```python
from azure.search.documents import SearchClient
from azure.search.documents.models import VectorizableTextQuery

def hybrid_search(query: str, top_k: int = 5) -> list:
    """Hybrid search: BM25 + vector + semantic reranking."""
    vector_query = VectorizableTextQuery(
        text=query,
        k_nearest_neighbors=50,
        fields="content_vector",
    )
    results = search_client.search(
        search_text=query,                       # BM25 keyword match
        vector_queries=[vector_query],            # Vector similarity
        query_type="semantic",                    # Semantic reranking
        semantic_configuration_name="default",    # Must match deployed config
        top=top_k,
        select=["content", "source", "page"],
    )
    return [{"content": r["content"], "source": r["source"], "score": r["@search.reranker_score"]} for r in results]
```

## Pattern 3: Grounded Response Generation

### Problem
LLM hallucinates facts not in the retrieved context. Enterprise scenarios require source attribution.

### Solution — Grounding System Prompt
```python
GROUNDING_PROMPT = """You are an enterprise assistant. Answer ONLY using the provided context.

RULES:
1. If the context doesn't contain the answer, say: "I don't have enough information to answer this."
2. NEVER fabricate information not in the context.
3. Always cite the source: [Source: {document_name}, Page {page}]
4. If the question is ambiguous, ask for clarification.
5. Keep answers concise and factual.

CONTEXT:
{retrieved_chunks}

USER QUESTION: {user_query}"""

async def generate_response(query: str, chunks: list[dict]) -> dict:
    context = "\n\n---\n\n".join(
        f"[Source: {c['source']}]\n{c['content']}" for c in chunks
    )
    response = await openai_client.chat.completions.create(
        model=config["model"],
        temperature=0.1,    # Low temperature for factual answers
        max_tokens=1000,
        messages=[
            {"role": "system", "content": GROUNDING_PROMPT.format(
                retrieved_chunks=context, user_query=query
            )},
            {"role": "user", "content": query},
        ],
    )
    return {
        "answer": response.choices[0].message.content,
        "sources": [c["source"] for c in chunks],
        "model": config["model"],
        "tokens": response.usage.total_tokens,
    }
```

## Pattern 4: RAG Evaluation Pipeline

### Problem
Shipping RAG without measuring quality leads to hallucinations and poor user experience.

### Solution — 5-Metric Evaluation
```python
from azure.ai.evaluation import GroundednessEvaluator, RelevanceEvaluator, CoherenceEvaluator

async def evaluate_rag(test_set_path: str) -> dict:
    """Run RAG evaluation with quality gates."""
    evaluators = {
        "groundedness": GroundednessEvaluator(model_config),
        "relevance": RelevanceEvaluator(model_config),
        "coherence": CoherenceEvaluator(model_config),
    }
    results = {"pass": True, "metrics": {}}
    
    test_cases = load_jsonl(test_set_path)
    for case in test_cases:
        chunks = hybrid_search(case["query"])
        response = await generate_response(case["query"], chunks)
        
        for name, evaluator in evaluators.items():
            score = evaluator(
                query=case["query"],
                response=response["answer"],
                context="\n".join(c["content"] for c in chunks),
            )
            results["metrics"].setdefault(name, []).append(score)
    
    # Quality gates
    thresholds = {"groundedness": 0.8, "relevance": 0.7, "coherence": 0.8}
    for metric, scores in results["metrics"].items():
        avg = sum(scores) / len(scores)
        results["metrics"][metric] = avg
        if avg < thresholds.get(metric, 0.7):
            results["pass"] = False
    
    return results
```

## Pattern 5: Token Budget Management

### Problem
Context window overflow when combining system prompt + retrieved chunks + user query + response.

### Solution — Budget Allocation
```python
import tiktoken

def budget_tokens(query: str, chunks: list[dict], model: str = "gpt-4o") -> list[dict]:
    """Trim chunks to fit within token budget."""
    enc = tiktoken.encoding_for_model(model)
    TOTAL_BUDGET = 8000
    SYSTEM_TOKENS = 500
    QUERY_TOKENS = len(enc.encode(query))
    RESPONSE_BUDGET = 1000
    CHUNK_BUDGET = TOTAL_BUDGET - SYSTEM_TOKENS - QUERY_TOKENS - RESPONSE_BUDGET
    
    selected = []
    used = 0
    for chunk in chunks:
        chunk_tokens = len(enc.encode(chunk["content"]))
        if used + chunk_tokens <= CHUNK_BUDGET:
            selected.append(chunk)
            used += chunk_tokens
        else:
            break
    return selected
```

## Anti-Patterns to Avoid

| Anti-Pattern | Why Bad | Correct Pattern |
|-------------|---------|-----------------|
| Vector-only search | Misses exact keyword matches | Hybrid: BM25 + vector + semantic |
| No reranking | Top-K vector results may be irrelevant | Enable semantic reranking |
| Large chunks (>2000 tokens) | Irrelevant noise in context | 512-1024 tokens with overlap |
| No grounding instruction | LLM hallucinates freely | "Answer ONLY from context" |
| Same temperature everywhere | Factual queries need precision | 0.1 for facts, 0.7 for creative |
| Query embedding ≠ index embedding | Dimension mismatch → 0 results | Same model for both |
| Synchronous Azure SDK calls | Blocks thread, slow under load | Use async clients (aiohttp, httpx) |
| No token budgeting | Context overflow, truncated response | Budget: system + chunks + query + response |
| print() for logging | No correlation, no structured search | Use structlog with correlation_id |
| No evaluation pipeline | Ship without quality measurement | Groundedness ≥ 0.8, Relevance ≥ 0.7 |
