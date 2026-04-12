---
name: evaluate-multi-modal-docproc
description: "Evaluate Multi-Modal DocProc — test vision extraction accuracy on charts/stamps/photos, OCR accuracy on text, cross-modal consistency, PII in images. Use when: evaluate, test quality."
---

# Evaluate Multi-Modal DocProc

## When to Use
- Evaluate GPT-4o vision accuracy on charts, graphs, stamps, signatures
- Measure OCR extraction accuracy on text and tables
- Validate cross-modal consistency (vision + OCR results aligned)
- Test PII detection in both text and image content
- Gate deployments with extraction quality thresholds

## Quality Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Text field extraction (OCR) | ≥ 95% | Labeled test set comparison |
| Table extraction F1 | ≥ 90% | Cell-level precision/recall |
| Chart data extraction | ≥ 85% | Data point accuracy for charts |
| Stamp/signature detection | ≥ 90% | Detection rate on known stamps |
| Page classification accuracy | ≥ 95% | Correct routing to OCR vs vision |
| Cross-modal consistency | ≥ 90% | Vision + OCR agree on shared fields |
| PII detection (images) | ≥ 95% | PII in photos/stamps detected |
| Processing time per page | < 15 seconds | Timed batch processing |

## Step 1: Prepare Multi-Modal Test Set
Create test documents with ground truth:
```json
{"id": "mm001", "document": "samples/invoice-with-logo.pdf", "pages": [
  {"page": 1, "type": "mixed", "expected_text": {"vendor": "Acme Corp", "total": "$1,234.56"}, "expected_visual": {"logo": "Acme Corp logo, blue"}},
  {"page": 2, "type": "table", "expected_rows": 15, "expected_columns": 4}
]}
{"id": "mm002", "document": "samples/report-with-charts.pdf", "pages": [
  {"page": 3, "type": "chart", "expected_data": {"type": "bar", "values": [10, 25, 40, 15]}}
]}
```
Minimum: 30 test documents spanning all page types (text, table, chart, photo, stamp, mixed).

## Step 2: Evaluate Per-Modality Accuracy
```bash
# OCR accuracy (text pages)
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics ocr_accuracy

# Vision accuracy (visual pages)
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics vision_accuracy

# Table extraction
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics table_extraction
```

## Step 3: Evaluate Page Classification
- Submit 100 pages of known types
- Track which pages were routed to OCR vs GPT-4o vision
- Calculate classification accuracy and confusion matrix
- Misrouting cost: text→vision = 10x overspend, chart→OCR = garbage output

## Step 4: Evaluate Cross-Modal Consistency
For mixed pages processed by BOTH OCR and vision:
- Do extracted fields agree? (company name in OCR matches logo text in vision)
- Resolve conflicts: OCR confidence vs vision interpretation
- Track disagreement rate — target <10%

## Step 5: Test PII in Visual Content
- Test images containing visible PII (ID cards, credit cards, address labels)
- Verify GPT-4o vision detects and reports PII
- Verify PII is redacted in stored results
- Test: screenshots with email addresses, phone numbers

## Step 6: Generate Quality Report
```bash
python evaluation/eval.py --all --output evaluation/report.json --ci-gate
```

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Deploy to production |
| OCR < 90% | Check document quality, adjust preprocessing |
| Vision < 80% | Improve prompts, increase image resolution |
| Page classification < 90% | Retrain classifier with more samples |
| PII in images missed | Add explicit PII check in vision prompt |

## Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Charts interpreted as decoration | Generic vision prompt | Use chart-specific extraction prompt |
| Table columns shifted | Complex merged cells | Route to Doc Intel table model, not vision |
| Stamps not detected | Too small in image | Crop stamp region, process at higher DPI |
| Handwriting gibberish | Low quality scan | Require 300 DPI, apply contrast enhancement |
| Vision + OCR disagree | Different interpretation | Use OCR for text, vision for visual meaning |

## Evaluation Cadence
- **Pre-deployment**: Full multi-modal evaluation suite
- **Weekly**: Spot-check 10 production documents across types
- **Monthly**: Re-evaluate with new document samples
- **On prompt change**: Re-evaluate vision accuracy for affected page types
- **On model update**: Full comparison old vs new GPT-4o version
