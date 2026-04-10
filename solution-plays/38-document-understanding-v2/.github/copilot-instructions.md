---
description: "Document Understanding V2 domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Document Understanding V2 — Domain Knowledge

This workspace implements advanced document understanding — layout-aware extraction, cross-document reasoning, document comparison, classification pipelines, and intelligent routing by document type.

## Document Understanding Architecture (What the Model Gets Wrong)

### Layout-Aware Extraction (Not Just OCR)
```python
# WRONG — flat text extraction (loses structure)
text = ocr_extract(document)  # "Name John Doe Address 123 Main St"

# CORRECT — layout-aware: preserve tables, headers, reading order
from azure.ai.documentintelligence import DocumentIntelligenceClient

result = client.begin_analyze_document("prebuilt-layout", doc_bytes)
# Returns structured: paragraphs with roles (title, header, footer)
# Tables with row/column structure
# Reading order preserved
for table in result.tables:
    for cell in table.cells:
        data[cell.row_index][cell.column_index] = cell.content
```

### Cross-Document Reasoning
```python
# Compare two versions of a contract
async def compare_documents(doc_a: str, doc_b: str) -> ComparisonResult:
    # 1. Extract structured content from both
    content_a = await extract_structured(doc_a)
    content_b = await extract_structured(doc_b)
    
    # 2. LLM comparison with structured context
    diff = await llm.compare(
        prompt="Compare these document versions. Identify: added clauses, removed clauses, changed terms, risk implications.",
        doc_a=content_a, doc_b=content_b,
    )
    return diff
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Flat OCR text | Loses table structure, headers, reading order | Use prebuilt-layout for structure-aware extraction |
| Process entire PDF at once | Memory overflow on 100+ page docs | Page-by-page processing, merge results |
| No document classification | Wrong extraction model for document type | Classify first → route to best model |
| Ignore headers/footers | Extract noise (page numbers, logos) | Filter by paragraph role |
| No field confidence scoring | Accept bad extractions silently | Threshold: confidence >= 0.8 per field |
| No cross-document capability | Can't compare/merge documents | Structured extraction → LLM comparison |
| Single extraction pass | Miss content in complex layouts | Two-pass: layout first, then targeted extraction |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | LLM for reasoning, comparison, summarization |
| `config/guardrails.json` | Confidence thresholds, PII detection, page limits |
| `config/document-intelligence.json` | Model IDs, feature flags, regions |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement extraction pipelines, comparison engine, classification |
| `@reviewer` | Audit extraction accuracy, PII handling, cross-doc quality |
| `@tuner` | Optimize model selection per doc type, throughput, cost |

## Slash Commands
`/deploy` — Deploy doc pipeline | `/test` — Test extraction | `/review` — Audit quality | `/evaluate` — Measure accuracy
