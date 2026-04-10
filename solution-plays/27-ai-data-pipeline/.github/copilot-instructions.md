---
description: "AI Data Pipeline domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# AI Data Pipeline — Domain Knowledge

This workspace implements an AI-powered data pipeline — ingestion, transformation, enrichment with LLM (classification, extraction, summarization), quality validation, and loading into vector/search stores.

## Data Pipeline Architecture (What the Model Gets Wrong)

### ETL with LLM Enrichment
```python
# Pipeline: Ingest → Chunk → Embed → Enrich → Validate → Load
async def process_document(doc: Document):
    # 1. Ingest (parse PDF/DOCX/HTML)
    text = extract_text(doc)
    
    # 2. Chunk (semantic boundaries)
    chunks = chunk_text(text, size=1024, overlap=128)
    
    # 3. Embed (batch for efficiency)
    vectors = await batch_embed(chunks, model="text-embedding-3-large", batch_size=100)
    
    # 4. Enrich with LLM (classification, entity extraction)
    enrichments = await batch_enrich(chunks, tasks=["classify", "extract_entities", "summarize"])
    
    # 5. Validate (quality checks)
    validated = [c for c in enrichments if c.confidence >= 0.8]
    
    # 6. Load into search index
    await search_client.upload_documents(validated)
```

### Batch Processing (Not One-at-a-Time)
```python
# WRONG — one API call per chunk (slow, expensive)
for chunk in chunks:
    embedding = embed(chunk)  # 1000 API calls for 1000 chunks

# CORRECT — batch embedding (fast, fewer API calls)
embeddings = embed_batch(chunks, batch_size=100)  # 10 API calls for 1000 chunks
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| One-at-a-time API calls | 100x slower than batching | Batch embed/enrich: 100 items per call |
| No dead letter queue | Failed docs lost silently | DLQ + retry with exponential backoff |
| No idempotency | Re-processing creates duplicates | Hash doc content → upsert by hash |
| LLM enrichment without caching | Same doc enriched on every run | Cache enrichments by content hash |
| No data quality validation | Bad data in search index | Validate: confidence >= 0.8, required fields present |
| Synchronous pipeline | Blocks on slow LLM calls | Async + queue-based: Azure Service Bus / Event Grid |
| No progress tracking | Can't resume after failure | Checkpoint after each batch, resume from checkpoint |
| Full reindex on every run | Wasteful for incremental updates | Change tracking: only process new/modified docs |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | Embedding model, enrichment model, batch size |
| `config/chunking.json` | Chunk size, overlap, strategy |
| `config/guardrails.json` | Quality thresholds, retry limits, DLQ settings |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement pipeline stages, batch processing, queue integration |
| `@reviewer` | Audit data quality, idempotency, error handling, scalability |
| `@tuner` | Optimize batch sizes, parallelism, caching, cost per document |

## Slash Commands
`/deploy` — Deploy pipeline | `/test` — Test with sample docs | `/review` — Audit quality | `/evaluate` — Measure throughput + accuracy
