---
name: evaluate-document-intelligence
description: "Evaluate Document Intelligence — test field extraction accuracy, table recognition, confidence scores, processing time, human review rate. Use when: evaluate, test."
---

# Evaluate Document Intelligence

## When to Use
- Evaluate field extraction accuracy across document types
- Measure table and structure recognition quality
- Validate confidence score calibration
- Test processing throughput and latency
- Gate deployments with quality thresholds

## Quality Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Field extraction accuracy | ≥ 95% (prebuilt), ≥ 90% (custom) | Labeled test set comparison |
| Table recognition F1 | ≥ 90% | Cell-level precision/recall |
| Confidence calibration | Within ±5% of actual accuracy | Confidence vs actual accuracy |
| Processing time per page | < 10 seconds | Timed batch processing |
| Human review rate | < 15% | Fields below confidence threshold |
| PII detection recall | ≥ 99% | Known PII pattern test |
| End-to-end pipeline success | ≥ 98% | Documents processed without errors |

## Step 1: Prepare Test Dataset
Create labeled test documents:
- 20+ documents per document type
- Include edge cases: rotated pages, low quality scans, handwritten text
- Label all expected fields with ground truth values
- Include documents with and without PII

## Step 2: Run Extraction Accuracy Evaluation
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics extraction_accuracy
```
- Compare extracted field values vs ground truth
- Per-field accuracy (some fields harder than others)
- Per-document-type accuracy breakdown
- Flag fields with consistent extraction failures

## Step 3: Evaluate Table Recognition
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics table_recognition
```
- Cell-level precision and recall
- Row/column count accuracy
- Merged cell handling
- Header row detection
- Nested table support

## Step 4: Confidence Score Calibration
- Group extractions by confidence range (0.5-0.6, 0.6-0.7, ..., 0.9-1.0)
- Actual accuracy in each range should match confidence score
- If confidence 0.9 but accuracy only 0.7 → model is overconfident
- Adjust threshold based on calibration results

## Step 5: Processing Performance
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics performance
```
- Pages per second throughput
- p50, p95, p99 latency per page
- Memory usage during batch processing
- Failure rate on large documents (50+ pages)

## Step 6: Generate Quality Report
```bash
python evaluation/eval.py --all --output evaluation/report.json --ci-gate
```

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Deploy to production |
| Extraction < 85% | Retrain custom model with more samples |
| Table F1 < 80% | Switch to Layout model for complex tables |
| High human review rate (>25%) | Lower confidence threshold or retrain |
| Processing > 15s/page | Enable parallel processing, check resource SKU |
| PII recall < 95% | Block deployment, fix PII detection config |

## Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| All fields empty | Wrong model selected | Match model to document type |
| Numbers extracted as text | Locale mismatch | Set correct locale (en-US, de-DE) |
| Table columns misaligned | Complex multi-span headers | Use Layout model + custom post-processing |
| Handwriting not recognized | Prebuilt model limitation | Use custom model trained on handwriting |
| Date format wrong | Regional format difference | Normalize dates in post-processing |
| Low confidence everywhere | Poor scan quality | Require 300 DPI minimum in intake |

## CI/CD Integration
```yaml
# Add quality gates to deployment pipeline
- name: Extraction Accuracy Gate
  run: python evaluation/eval.py --metrics extraction_accuracy --ci-gate --threshold 0.90
- name: Table Recognition Gate
  run: python evaluation/eval.py --metrics table_recognition --ci-gate --threshold 0.85
- name: PII Detection Gate
  run: python evaluation/eval.py --metrics pii --ci-gate --threshold 0.99
```

## Evaluation Cadence
- **Pre-deployment**: Full evaluation suite on all document types
- **Weekly**: Spot-check extraction accuracy on recent production documents
- **Monthly**: Full re-evaluation with expanded test set
- **On model update**: Side-by-side comparison old model vs new model
- **On new document type**: Create labeled test set before enabling in production
