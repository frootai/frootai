---
name: deploy-ai-data-pipeline
description: "Deploy AI Data Pipeline — configure ETL/ELT with LLM enrichment, batch processing, Data Factory orchestration, data quality checks, PII detection. Use when: deploy, provision data pipeline."
---

# Deploy AI Data Pipeline

## When to Use
- Deploy ETL/ELT pipelines with AI-powered data enrichment
- Configure Azure Data Factory for orchestration
- Set up LLM enrichment (classification, extraction, summarization)
- Implement data quality checks and PII detection
- Configure batch processing with idempotency

## Prerequisites
1. Azure CLI authenticated: `az account show`
2. Data Factory / Synapse for orchestration
3. Azure OpenAI (gpt-4o-mini for batch enrichment)
4. Data Lake Storage Gen2 (source and target zones)

## Step 1: Deploy Infrastructure
```bash
az bicep lint -f infra/main.bicep
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
```

## Step 2: Configure Data Lake Zones
```
data-lake/
├── raw/       ← Source data (unchanged)
├── staging/   ← Cleaned, validated
├── enriched/  ← LLM-enriched (classified, summarized)
└── serving/   ← Ready for consumption
```

## Step 3: Configure Pipeline Stages
| Stage | Tool | Output |
|-------|------|--------|
| Ingest | Data Factory Copy | raw/ |
| Clean | Data Flow | staging/ |
| Validate | Python activity | staging/ (flagged) |
| Enrich | Azure Function + OpenAI | enriched/ |
| Load | Data Factory Copy | SQL/Cosmos |

## Step 4: Configure LLM Enrichment
```python
async def enrich_batch(records, batch_size=20):
    for batch in chunk(records, batch_size):
        results = await openai.batch_complete(
            [build_prompt(r) for r in batch], model="gpt-4o-mini"
        )
        for r, result in zip(batch, results):
            r["classification"] = result.category
            r["summary"] = result.summary
```

**Enrichment cost per 1K records**:
| Type | Model | Cost |
|------|-------|------|
| Classification | gpt-4o-mini | ~$0.15 |
| Entity extraction | gpt-4o-mini | ~$0.20 |
| Summarization | gpt-4o-mini | ~$0.30 |
| Sentiment | gpt-4o-mini | ~$0.10 |
| PII detection | Content Safety | ~$0.05 |

## Step 5: Configure Data Quality
| Check | Stage | On Failure |
|-------|-------|-----------|
| Schema validation | After ingest | Quarantine |
| Null check | After clean | Skip + log |
| Duplicate detection | After clean | Dedup by PK |
| LLM confidence | After enrich | Human review queue |
| PII scan | After enrich | Redact before serving |

## Step 6: Configure Scheduling
- Frequency: daily at 02:00 UTC
- Retry: 3 attempts, 30-min interval
- Timeout: 4 hours

## Step 7: Post-Deployment Verification
- [ ] Pipeline runs end-to-end without errors
- [ ] Data flows through all zones (raw→staging→enriched→serving)
- [ ] LLM enrichment produces correct output
- [ ] Data quality checks catch bad records
- [ ] PII detected and redacted
- [ ] Pipeline is idempotent
- [ ] Monitoring alerts on pipeline failure

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Pipeline timeout | Sequential processing | Enable parallelism |
| LLM errors | Token limit exceeded | Chunk long text |
| Duplicates in serving | No dedup step | Add PK dedup |
| Schema drift | Source changed | Schema evolution in ADF |
| High enrichment cost | Using gpt-4o | Switch to gpt-4o-mini (10x cheaper) |
| PII in serving | PII scan before enrichment | Scan AFTER enrichment too |

## Data Lineage
- Track which source produced each record
- Log all transformations applied (clean, validate, enrich)
- Store enrichment model version per record
- Enable: "Why does this record have this classification?" traceability
