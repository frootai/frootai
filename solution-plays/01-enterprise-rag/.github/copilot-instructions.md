---
description: "Enterprise RAG domain knowledge — auto-injected into every Copilot conversation in this workspace"
applyTo: "**"
---

# Enterprise RAG — Domain Knowledge

This workspace implements a production-grade Enterprise RAG (Retrieval-Augmented Generation) system on Azure. The following rules supplement your existing knowledge with RAG-specific patterns, Azure AI integration pitfalls, and project conventions.

## RAG Architecture (What the Model Often Gets Wrong)

### Chunking Strategy
| Parameter | Value | Why |
|-----------|-------|-----|
| Chunk size | 512-1024 tokens | Too small = no context. Too large = irrelevant noise. |
| Overlap | 10-15% of chunk size | Prevents splitting mid-sentence at chunk boundaries |
| Strategy | Semantic (sentence-aware) | Character-based splitting breaks meaning |

### Retrieval Pattern (Hybrid Search — Not Just Vector)
```python
# ❌ WRONG — vector-only search misses keyword matches
results = search_client.search(query, vector_queries=[vector])

# ✅ CORRECT — hybrid: keyword + vector + semantic reranking
results = search_client.search(
    search_text=query,                    # BM25 keyword search
    vector_queries=[vector],              # Vector similarity
    query_type="semantic",                # Semantic reranking
    semantic_configuration_name="default",
    top=5
)
```

### Grounding Pattern (Prevent Hallucination)
```python
system_prompt = """Answer based ONLY on the provided context.
If the context doesn't contain the answer, say 'I don't have enough information.'
Always cite the source document: [Source: {document_name}]
Never make up facts not in the context."""
```

## Azure AI SDK Pitfalls

### Authentication — Always DefaultAzureCredential
Never use `AzureOpenAI(api_key="sk-xxx")`. Always use `DefaultAzureCredential()` with `get_bearer_token_provider(credential, "https://cognitiveservices.azure.com/.default")`.

### Search Client — Semantic Configuration Name Must Match Deployment
The `semantic_configuration_name` parameter must match the exact name configured in Azure Portal (often "default" or "my-semantic-config"). Mismatch = silent fallback to non-semantic search.

### Token Counting — Use tiktoken
Use `tiktoken.encoding_for_model("gpt-4o")` for accurate counts. Budget: system(500) + chunks(3000) + query(200) + response(1000) = ~4700 total.

### Embedding Model Mismatch = Zero Results
Query embedding model MUST match the index embedding model. If index built with `text-embedding-3-large`, query must also use `text-embedding-3-large`. Different model = dimension mismatch = 0 results.

## Content Safety (Non-Negotiable for Enterprise)
Check BOTH user input AND model output with `ContentSafetyClient`. Categories: Hate, Violence, SelfHarm, Sexual. Severity threshold: reject >= 4 (Medium), log >= 2 (Low).

## Coverage Targets for RAG Evaluation

| Metric | Target | Tool |
|--------|--------|------|
| Groundedness | ≥ 0.8 | Azure AI Evaluation SDK |
| Relevance | ≥ 0.7 | Azure AI Evaluation SDK |
| Coherence | ≥ 0.8 | Azure AI Evaluation SDK |
| Fluency | ≥ 0.8 | Azure AI Evaluation SDK |
| Content Safety | Pass all | Content Safety API |

## File Naming Conventions
- Python: `snake_case.py` (e.g., `document_processor.py`)
- API routes: `kebab-case` (e.g., `/api/v1/chat-completion`)
- Config: `kebab-case.json` (e.g., `model-comparison.json`)
- Tests: `test_module_name.py` (e.g., `test_document_processor.py`)
- Bicep: `kebab-case.bicep` (e.g., `ai-search.bicep`)

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | model, temperature (0.1 for factual, 0.7 for creative), max_tokens |
| `config/chunking.json` | chunk_size, overlap, strategy |
| `config/search.json` | search_type (hybrid), top_k, score_threshold |
| `config/guardrails.json` | content_safety thresholds, groundedness_min, max_latency_ms |

## Common Mistakes in Enterprise RAG

| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Vector-only search | Misses exact keyword matches (product codes, IDs) | Use hybrid search (BM25 + vector + semantic) |
| No reranking | Top-5 vector results may not be the most relevant | Enable semantic reranking in AI Search |
| Prompt with no grounding instruction | Model hallucinates beyond retrieved context | "Answer ONLY from context. If unsure, say so." |
| Same temperature for all tasks | Factual queries need 0.1, creative need 0.7 | Model routing with per-task temperature |
| No token budgeting | Response truncated or context overflow | Budget: system(500) + chunks(3000) + query(200) + response(1000) |
| Embedding model mismatch | Query uses different model than index → 0 results | Same model for indexing and querying |
| No evaluation pipeline | Ship without measuring quality | Run eval.py with groundedness/relevance/coherence gates |

## Available Specialist Agents (optional)

| Agent | Use For |
|-------|---------|
| `@builder` | Implement RAG pipeline features (chunking, retrieval, generation) |
| `@reviewer` | Audit for security (Managed Identity, Content Safety), RAG quality |
| `@tuner` | Optimize config values, model routing, caching, evaluation gates |

## Slash Commands
| Command | Action |
|---------|--------|
| `/deploy` | Deploy infrastructure with Bicep + configure app |
| `/test` | Run pytest with coverage |
| `/review` | Security + RAG quality review |
| `/evaluate` | Run evaluation pipeline (groundedness, relevance, coherence) |
