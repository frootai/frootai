# Play 27 — AI Data Pipeline 📊

> ETL/ELT with LLM enrichment — classify, extract, and summarize at scale.

Ingest raw data, clean and validate, then enrich with GPT-4o-mini for classification, entity extraction, and summarization. Data Factory orchestrates the pipeline, data flows through lake zones (raw → staging → enriched → serving), with data quality checks and PII detection at every stage.

## Quick Start
```bash
cd solution-plays/27-ai-data-pipeline
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .  # Use @builder for ETL/enrichment, @reviewer for data quality audit, @tuner for cost
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure Data Factory | Pipeline orchestration and scheduling |
| Data Lake Storage Gen2 | Zone-based storage (raw/staging/enriched/serving) |
| Azure OpenAI (gpt-4o-mini) | Batch LLM enrichment (classification, extraction) |
| Azure SQL / Cosmos DB | Enriched data serving layer |

## Enrichment Types
| Type | Model | Cost/1K Records |
|------|-------|----------------|
| Classification | gpt-4o-mini | ~$0.15 |
| Entity extraction | gpt-4o-mini | ~$0.20 |
| Summarization | gpt-4o-mini | ~$0.30 |
| Sentiment | gpt-4o-mini | ~$0.10 |

## Key Metrics
- Enrichment accuracy: ≥90% · Data quality: ≥95% · Throughput: ≥10K records/hr · PII recall: ≥99%

## DevKit (Data Engineering-Focused)
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (ETL/enrichment/ADF), Reviewer (quality/idempotency/PII), Tuner (batch/parallelism/cost) |
| 3 skills | Deploy (104 lines), Evaluate (105 lines), Tune (103 lines) |
| 4 prompts | `/deploy` (ETL pipeline), `/test` (execution), `/review` (data quality), `/evaluate` (enrichment accuracy) |

## Cost
| Dev | Prod (1M records/day) |
|-----|-----------------------|
| $50–150/mo | ~$315/mo (gpt-4o-mini + batch API + caching = 96% savings vs gpt-4o) |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/27-ai-data-pipeline](https://frootai.dev/solution-plays/27-ai-data-pipeline)
