---
name: tune-document-understanding-v2
description: "Tune Document Understanding V2 — optimize classification thresholds, layout model selection, comparison sensitivity, workflow routing, throughput, cost per document. Use when: tune, optimize doc processing."
---

# Tune Document Understanding V2

## When to Use
- Optimize classification confidence thresholds per doc type
- Select best model per extraction task (prebuilt vs custom vs LLM)
- Tune comparison sensitivity (which changes matter?)
- Optimize document workflow routing rules
- Reduce processing cost per document

## Tuning Dimensions

### Dimension 1: Classification Threshold Tuning

| Doc Type | Default | If Too Many False Positives | If Too Many Misses |
|----------|---------|---------------------------|-------------------|
| Invoice | 0.90 | Raise to 0.95 | Lower to 0.85 |
| Contract | 0.85 | Raise to 0.90 | Lower to 0.80 |
| Report | 0.85 | Raise to 0.90 | Lower to 0.80 |
| Letter | 0.80 | Raise to 0.85 | Lower to 0.75 |
| Form | 0.90 | Raise to 0.95 | Lower to 0.85 |

**Below threshold**: Route to human review queue. Better than wrong classification.

### Dimension 2: Model Selection Per Task

| Task | Best Model | Alternative | Cost/Page |
|------|-----------|------------|-----------|
| Layout detection | prebuilt-layout | Read model (faster) | $0.01 |
| Invoice fields | prebuilt-invoice | Custom model | $0.01 |
| Contract fields | Custom model | GPT-4o vision | $0.05/$0.03 |
| Classification | GPT-4o-mini | Prebuilt classifier | $0.002 |
| Comparison (diff) | GPT-4o | GPT-4o-mini (less nuanced) | $0.01 |

### Dimension 3: Comparison Sensitivity

| Change Type | Default Notify | High Sensitivity | Low Sensitivity |
|------------|---------------|-----------------|----------------|
| Amount changes | Always | Always | > $100 delta |
| Date changes | Always | Always | > 7 day delta |
| Party name changes | Always | Always | Always |
| Formatting changes | Never | Notify | Never |
| Header/footer changes | Never | Notify | Never |
| Section reorder | Notify | Notify | Never |

### Dimension 4: Workflow Routing Rules

| Condition | Destination | Priority |
|-----------|------------|----------|
| Type = invoice, amount > $10K | CFO review queue | High |
| Type = contract, new or amended | Legal review queue | High |
| Type = report, quarterly | Stakeholder distribution | Medium |
| Any doc, PII detected | PII review queue first | Critical |
| Confidence < threshold | Human classification queue | High |

### Dimension 5: Cost Per Document

| Processing Stage | Cost | Optimization |
|-----------------|------|-------------|
| Classification (gpt-4o-mini) | $0.002 | Already cheapest |
| Layout extraction | $0.01/page | Skip blank pages |
| Field extraction (prebuilt) | $0.01/page | Use per doc type, not generic |
| Comparison (gpt-4o) | $0.01 | Only when doc has previous version |
| PII detection | $0.005 | Skip if doc type never has PII |

**Monthly estimate** (5K docs/day, avg 3 pages):
- Classification: ~$300/mo
- Extraction: ~$4,500/mo
- Comparison (20% of docs have versions): ~$300/mo
- PII: ~$750/mo
- **Total: ~$5,850/mo** (optimize to ~$3,500 with smart model routing)

## Production Readiness Checklist
- [ ] Classification accuracy ≥ 92% across all doc types
- [ ] Layout extraction preserving structure (F1 ≥ 88%)
- [ ] Cross-doc comparison detecting meaningful changes
- [ ] Workflow routing documents correctly
- [ ] PII detected and masked before archival
- [ ] Human review rate < 10%
- [ ] Processing time < 15s per document
- [ ] Cost per document within budget

## Output: Tuning Report
After tuning, compare:
- Classification accuracy per doc type
- Layout extraction quality improvement
- Comparison sensitivity calibration
- Workflow routing accuracy
- Cost per document reduction

## Tuning Playbook
1. **Baseline**: Process 50 docs (10 per type), record all metrics
2. **Classification**: Adjust thresholds per type based on FP/FN rates
3. **Layout**: Switch underperforming pages from Read to Layout model
4. **Comparison**: Tune sensitivity per change type (amount always, format never)
5. **Routing**: Verify routing rules match business requirements
6. **PII**: Audit PII detection on docs with known PII content
7. **Cost**: Calculate per-doc cost, optimize model routing
8. **Re-test**: Same 50 docs, compare before/after
