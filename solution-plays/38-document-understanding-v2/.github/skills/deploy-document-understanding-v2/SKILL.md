---
name: deploy-document-understanding-v2
description: "Deploy Document Understanding V2 — configure layout-aware extraction, cross-document comparison, automatic classification, document workflow automation. Use when: deploy, provision advanced doc processing."
---

# Deploy Document Understanding V2

## When to Use
- Deploy advanced document processing beyond basic OCR extraction
- Configure layout-aware extraction (preserves document structure)
- Enable cross-document comparison (find differences between versions)
- Set up automatic document classification (invoice, contract, report)
- Build document workflow automation (classify → extract → route → archive)

## How Play 38 Differs from Play 06 and Play 15
| Aspect | Play 06 (Doc Intel) | Play 15 (Multi-Modal) | Play 38 (Understanding V2) |
|--------|--------------------|-----------------------|---------------------------|
| Focus | Single-doc OCR+fields | Vision+OCR on images | Advanced understanding |
| Classification | Manual model selection | Page-type routing | Auto-classify any document |
| Comparison | None | None | Cross-doc diff & versioning |
| Layout | Basic fields | Page-level visual | Section/paragraph/table-aware |
| Workflow | Extract only | Extract only | Classify → extract → route → archive |

## Prerequisites
1. Azure Document Intelligence (S0 for Layout + custom models)
2. Azure OpenAI (gpt-4o for classification + comparison analysis)
3. Azure Storage (document upload + processed output)
4. Cosmos DB (classification results, comparison logs)

## Step 1: Deploy Infrastructure
```bash
az bicep lint -f infra/main.bicep
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
```

## Step 2: Configure Document Classification
| Category | Detection Method | Confidence Threshold |
|----------|-----------------|---------------------|
| Invoice | Prebuilt-invoice features + LLM | 0.90 |
| Contract | Legal language patterns + LLM | 0.85 |
| Report | Section headers + tables + LLM | 0.85 |
| Letter | Salutation + signature + LLM | 0.80 |
| Form | Checkboxes + input fields + LLM | 0.90 |
| Unknown | Below all thresholds | → Human review queue |

## Step 3: Configure Layout-Aware Extraction
```python
# Layout extraction preserves document structure
result = doc_intelligence_client.begin_analyze_document("prebuilt-layout", document)
for page in result.pages:
    for paragraph in page.paragraphs:
        # paragraph.role: title, heading, footnote, body
        # paragraph.bounding_regions: exact position on page
    for table in page.tables:
        # table.cells: row/col structure with spans
    for selection_mark in page.selection_marks:
        # selection_marks: checkboxes, radio buttons
```

## Step 4: Configure Cross-Document Comparison
```python
# Compare two versions of a document
async def compare_documents(doc_v1, doc_v2):
    fields_v1 = await extract_fields(doc_v1)
    fields_v2 = await extract_fields(doc_v2)
    diff = compute_field_diff(fields_v1, fields_v2)
    summary = await summarize_changes(diff, model="gpt-4o")
    return { "changes": diff, "summary": summary, "risk_level": assess_change_risk(diff) }
```

## Step 5: Configure Document Workflow
```
Document Upload → Auto-Classify → Type-Specific Extraction
    → Validation Rules → PII Masking → Route to Destination
    → Archive with Metadata → Notify Stakeholders
```

## Step 6: Post-Deployment Verification
- [ ] Classification correctly identifying document types
- [ ] Layout extraction preserving section/table structure
- [ ] Cross-doc comparison detecting field changes
- [ ] Workflow routing documents to correct destination
- [ ] PII masking before archival
- [ ] Human review queue receiving low-confidence docs
- [ ] Processing time < 15s per document

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Classification wrong | Overlapping doc features | Add more category-specific features to prompt |
| Layout structure lost | Not using Layout model | Switch from Read to Layout model |
| Comparison misses changes | Field normalization wrong | Normalize dates, amounts before diff |
| Workflow routing errors | Classification confidence too low | Lower threshold or add intermediate review |
| Slow processing | Sequential page analysis | Parallelize per-page extraction |
| PII missed in tables | Only scanning body text | Add table cell scanning to PII check |

## Document Understanding Pipeline (Full)
```
Upload → Auto-Classify (gpt-4o-mini) → Select Extraction Model
    → Layout-Aware Extraction (sections, tables, marks)
    → Field Validation (cross-field consistency)
    → PII Masking → Route to Destination
    → If previous version exists: Cross-Doc Comparison
    → Archive with Full Metadata
```
