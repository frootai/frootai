---
name: evaluate-ai-data-pipeline
description: "Evaluate AI Data Pipeline — measure enrichment accuracy, data quality score, throughput, error rate, PII detection coverage, pipeline reliability. Use when: evaluate, test pipeline quality."
---

# Evaluate AI Data Pipeline

## When to Use
- Measure LLM enrichment accuracy (classification, extraction, summarization)
- Validate data quality gates (schema, nulls, duplicates)
- Assess pipeline throughput and error recovery
- Check PII detection completeness
- Gate deployments with data quality thresholds

## Pipeline Quality Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Enrichment accuracy | ≥ 90% | LLM output vs human-labeled ground truth |
| Data quality score | ≥ 95% | Records passing all quality checks |
| Throughput | ≥ 10K records/hour | Processing speed measurement |
| Pipeline error rate | < 1% | Failed records / total records |
| PII detection recall | ≥ 99% | Known PII patterns in test data |
| Idempotency | 100% pass | Re-run produces identical output |
| Schema compliance | 100% | Output matches target schema |
| Enrichment latency | < 500ms/record | Per-record LLM call timing |

## Step 1: Prepare Quality Test Dataset
```json
{"record_id": "r001", "text": "Invoice from Acme Corp, $5,000, due Jan 15", "expected_classification": "invoice", "expected_entities": ["Acme Corp", "$5,000", "Jan 15"]}
{"record_id": "r002", "text": "John Smith SSN 123-45-6789 applied for loan", "expected_pii": true, "pii_types": ["name", "ssn"]}
{"record_id": "r003", "text": "Q4 revenue grew 15% year-over-year", "expected_sentiment": "positive", "expected_summary": "Q4 revenue up 15% YoY"}
```
Minimum: 100 labeled records across all enrichment types.

## Step 2: Evaluate Enrichment Accuracy
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics enrichment
```
- Classification accuracy per category
- Entity extraction precision and recall
- Summarization quality (ROUGE-L vs reference)
- Sentiment classification accuracy

## Step 3: Evaluate Data Quality
- Run pipeline on test dataset with known quality issues
- Verify: bad records quarantined, good records passed
- Check: duplicate detection working
- Verify: schema validation catching type mismatches

## Step 4: Test Idempotency
```bash
# Run pipeline twice on same data
python scripts/run_pipeline.py --input test-data/ --output output-1/
python scripts/run_pipeline.py --input test-data/ --output output-2/
# Compare: output-1 and output-2 must be identical
diff -r output-1/ output-2/
```

## Step 5: Test Error Recovery
- Inject malformed records → verify quarantine, not crash
- Simulate LLM timeout → verify retry + continue
- Simulate storage failure → verify pipeline resumes from checkpoint
- Large batch (100K records) → verify memory doesn't exceed limits

## Step 6: Generate Report
```bash
python evaluation/eval.py --all --output evaluation/pipeline-report.json --ci-gate
```

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Promote pipeline to production schedule |
| Enrichment < 85% | Improve enrichment prompts, add few-shot examples |
| Data quality < 90% | Tighten validation rules, fix source data |
| PII detected in serving | Block — fix PII scan before promotion |
| Idempotency fails | Fix pipeline state management |

## Evaluation Cadence
- **Pre-deployment**: Full pipeline evaluation on 100+ records
- **Daily**: Monitor pipeline run success/failure rate
- **Weekly**: Spot-check enrichment quality on 20 random records
- **Monthly**: Full re-evaluation with updated test dataset
- **On source change**: Re-evaluate when data source schema changes

## Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Enrichment "hallucinated" entities | No grounding in prompt | Add "extract only from provided text" |
| Pipeline reprocesses everything | No checkpoint/watermark | Add high-watermark column tracking |
| Slow on Mondays | Weekend data accumulation | Scale pipeline compute on schedule |
| Out-of-order records | Event Hub reprocessing | Add dedup by event ID + timestamp |
| Classification drift | New data categories | Retrain/update enrichment prompt monthly |

## CI/CD Gates
```yaml
- name: Enrichment Quality Gate
  run: python evaluation/eval.py --metrics enrichment --ci-gate --threshold 0.90
- name: Data Quality Gate
  run: python evaluation/eval.py --metrics data_quality --ci-gate --threshold 0.95
- name: Idempotency Test
  run: python evaluation/test_idempotency.py --input test-data/ --verify
```
