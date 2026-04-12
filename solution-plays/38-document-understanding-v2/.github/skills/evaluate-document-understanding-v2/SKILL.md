---
name: evaluate-document-understanding-v2
description: "Evaluate Document Understanding V2 — measure classification accuracy, layout extraction quality, cross-doc comparison accuracy, workflow routing, PII detection. Use when: evaluate, audit doc processing."
---

# Evaluate Document Understanding V2

## When to Use
- Validate auto-classification accuracy across document types
- Measure layout-aware extraction quality (sections, tables preserved)
- Test cross-document comparison (changes detected correctly)
- Verify workflow routing (right docs to right destination)
- Gate deployments with document understanding thresholds

## Document Understanding Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Classification accuracy | ≥ 92% | Correct type / total docs |
| Layout extraction F1 | ≥ 88% | Section/table structure preserved |
| Cross-doc change detection | ≥ 85% | Changes found / actual changes |
| Workflow routing accuracy | ≥ 95% | Correct destination / total routed |
| Field extraction accuracy | ≥ 90% | Extracted vs ground truth fields |
| PII detection recall | ≥ 99% | PII found / actual PII |
| Processing time per doc | < 15 seconds | End-to-end timing |
| Human review rate | < 10% | Low-confidence docs sent to human |

## Step 1: Test Auto-Classification
```json
{"doc": "samples/invoice-01.pdf", "expected_type": "invoice", "confidence_min": 0.90}
{"doc": "samples/contract-nda.pdf", "expected_type": "contract", "confidence_min": 0.85}
{"doc": "samples/quarterly-report.pdf", "expected_type": "report", "confidence_min": 0.85}
{"doc": "samples/handwritten-letter.pdf", "expected_type": "letter", "confidence_min": 0.80}
```
Minimum: 50 documents across all supported categories.

## Step 2: Evaluate Layout Extraction
- Submit documents with complex layouts (multi-column, nested tables)
- Verify: sections extracted in correct order
- Verify: tables preserve row/column structure (including merged cells)
- Verify: headers/footers separated from body content

## Step 3: Test Cross-Doc Comparison
```json
{"doc_v1": "contract-v1.pdf", "doc_v2": "contract-v2.pdf",
 "expected_changes": [{"field": "payment_terms", "from": "Net 30", "to": "Net 60"},
                      {"field": "effective_date", "from": "2026-01-01", "to": "2026-04-01"}]}
```
- Compare: detected changes vs actual changes
- Verify: additions, modifications, and deletions all detected
- Risk assessment: does severity match (payment terms change = high risk)

## Step 4: Test Workflow Routing
- Submit 30 documents → verify each routes to correct destination
- Invoices → accounting system
- Contracts → legal review queue
- Reports → stakeholder distribution list

## Step 5: Generate Report
```bash
python evaluation/eval.py --all --output evaluation/doc-v2-report.json --ci-gate
```

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Deploy document workflow |
| Classification < 85% | Add more training examples per doc type |
| Layout broken | Switch from Read to Layout model |
| Comparison misses changes | Improve field normalization |
| PII missed | BLOCKER — fix PII scanner |

## Evaluation Cadence
- **Pre-deployment**: Full classification + layout + comparison suite
- **Weekly**: Classification accuracy on production documents
- **Monthly**: Cross-doc comparison accuracy check
- **On new doc type**: Add classification training + evaluation set

## Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Invoice classified as report | Both have numbers and tables | Add invoice-specific features (due date, vendor) |
| Layout merges two columns | Complex multi-column page | Use Layout model (not Read) |
| Comparison misses renumbered clauses | Clause numbers changed | Compare by content, not by position |
| Workflow routes to wrong queue | Classification error cascades | Add confidence check at routing step |
| Slow on large docs (50+ pages) | Sequential page processing | Parallelize per-page extraction |
| PII in table headers missed | Only scanning cell content | Include header row in PII scan |

## CI/CD Quality Gates
```yaml
- name: Classification Gate
  run: python evaluation/eval.py --metrics classification --ci-gate --threshold 0.92
- name: Layout Gate
  run: python evaluation/eval.py --metrics layout_f1 --ci-gate --threshold 0.88
- name: Comparison Gate
  run: python evaluation/eval.py --metrics comparison --ci-gate --threshold 0.85
```

## Play 06 vs 38 Decision Guide
| Need | Use Play 06 | Use Play 38 |
|------|-----------|-------------|
| Simple OCR extraction | ✅ | Overkill |
| Auto-classify doc type | ❌ | ✅ |
| Cross-doc comparison | ❌ | ✅ |
| Layout-preserved extraction | ❌ | ✅ |
| Document workflow automation | ❌ | ✅ |
