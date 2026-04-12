---
name: tune-document-intelligence
description: "Tune Document Intelligence — optimize model selection, confidence thresholds, page range processing, batch throughput, cost per document. Use when: tune, optimize."
---

# Tune Document Intelligence

## When to Use
- Optimize field extraction accuracy for specific document types
- Tune confidence thresholds to balance automation vs human review
- Optimize processing throughput for batch operations
- Configure model routing for cost optimization
- Improve custom model performance with retraining

## Tuning Dimensions

### Dimension 1: Model Selection Optimization

| Document Type | Recommended Model | Accuracy | Cost/Page |
|---------------|------------------|----------|-----------|
| Standard invoices | prebuilt-invoice | 95%+ | $0.01 |
| Receipts | prebuilt-receipt | 93%+ | $0.01 |
| ID documents | prebuilt-idDocument | 97%+ | $0.01 |
| Custom forms | custom model | 90%+ | $0.05 |
| Mixed/unknown | prebuilt-layout + GPT-4o | 85%+ | $0.10 |

**Decision tree**:
1. Does a prebuilt model exist for this doc type? → Use prebuilt (cheapest, most accurate)
2. Is layout consistent across documents? → Train custom model
3. Is layout variable? → Use Layout + GPT-4o post-processing

### Dimension 2: Confidence Threshold Tuning

| Threshold | Human Review Rate | Accuracy | Use Case |
|-----------|------------------|----------|----------|
| 0.95 | ~25% | 99%+ | Compliance-critical (financial, legal) |
| 0.90 | ~15% | 97%+ | Standard business documents |
| 0.85 | ~10% | 95%+ | High-volume, lower-risk processing |
| 0.80 | ~5% | 92%+ | Internal documents, low-risk |

**Diagnostic**: Run `python evaluation/eval.py --metrics confidence_calibration`

### Dimension 3: Processing Throughput

| Strategy | Pages/min | Best For |
|----------|-----------|----------|
| Sequential | 6-10 | Single document testing |
| Parallel (5 workers) | 30-50 | Batch processing |
| Parallel (10 workers) | 50-80 | High-volume production |
| Async with queue | 100+ | Enterprise-scale ingestion |

**Optimization steps**:
1. Split multi-page PDFs into single pages for parallel processing
2. Use Azure Storage queue for async processing
3. Set appropriate SKU tier (S0 for production throughput)
4. Implement retry with exponential backoff for throttling

### Dimension 4: Cost Per Document

| Component | Cost Driver | Optimization |
|-----------|------------|-------------|
| Document Intelligence | Pages analyzed | Skip blank pages, use page ranges |
| Storage | Documents stored | Archive processed originals to cool storage |
| GPT-4o enrichment | Tokens processed | Only use for fields that fail prebuilt extraction |
| Human review | Review labor | Optimize threshold to minimize review volume |

**Monthly cost estimate** (10,000 documents/day, avg 3 pages):
- Document Intelligence: ~$9,000/mo (900K pages × $0.01)
- Storage: ~$200/mo (hot + cool tiers)
- GPT-4o enrichment (10% of docs): ~$500/mo
- **Total: ~$9,700/mo** (optimize to ~$6,000 with page skipping + model routing)

### Dimension 5: Custom Model Retraining

**When to retrain**:
- Accuracy drops below 88% on new documents
- New document layouts introduced
- New fields need to be extracted
- Customer feedback indicates systematic errors

**Retraining checklist**:
1. Collect 10-20 new samples of failing document types
2. Label in Document Intelligence Studio
3. Retrain with combined old + new samples
4. Compare new model accuracy vs previous version
5. Deploy only if new model is better on both old and new samples

## Production Readiness Checklist
- [ ] Extraction accuracy ≥ 90% across all document types
- [ ] Confidence threshold calibrated per document type
- [ ] Human review rate < 15%
- [ ] Processing throughput meets batch requirements
- [ ] PII detection and redaction verified
- [ ] Error handling and retry logic tested
- [ ] Cost per document within budget
- [ ] Custom model versioned and rollback-capable
- [ ] Monitoring dashboards showing extraction metrics

## Output: Tuning Report
After tuning, generate comparison:
- Extraction accuracy delta per field
- Human review rate change
- Cost per document change
- Processing throughput improvement
- Confidence threshold recommendations per document type
