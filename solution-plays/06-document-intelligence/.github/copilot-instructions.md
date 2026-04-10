---
description: "Document Intelligence domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Document Intelligence — Domain Knowledge

This workspace implements AI-powered document processing — OCR, form extraction, table recognition, and document classification using Azure Document Intelligence.

## Document Processing Pipeline (What the Model Gets Wrong)

### Extraction Architecture
```
Upload → Prebuilt/Custom Model → OCR + Layout → Field Extraction → Validation → Structured Output
```

### Azure Document Intelligence Client
```python
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.identity import DefaultAzureCredential

# WRONG — using deprecated Form Recognizer
from azure.ai.formrecognizer import DocumentAnalysisClient  # OLD SDK

# CORRECT — Document Intelligence (new SDK, 2024+)
client = DocumentIntelligenceClient(
    endpoint=config["endpoint"],
    credential=DefaultAzureCredential(),
)
result = client.begin_analyze_document("prebuilt-invoice", document_bytes)
```

### Prebuilt Models vs Custom Models
| Scenario | Model | API ID | When to Use |
|----------|-------|--------|-------------|
| Invoices | Prebuilt | `prebuilt-invoice` | Standard invoice formats |
| Receipts | Prebuilt | `prebuilt-receipt` | Retail receipts |
| ID Documents | Prebuilt | `prebuilt-idDocument` | Passports, driver's licenses |
| Business Cards | Prebuilt | `prebuilt-businessCard` | Contact cards |
| General Documents | Prebuilt | `prebuilt-layout` | Tables, paragraphs, headings |
| Custom Forms | Custom | `your-model-id` | Domain-specific forms |

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Using old Form Recognizer SDK | Deprecated, missing features | Use `azure.ai.documentintelligence` |
| OCR without layout analysis | Loses table structure, reading order | Use `prebuilt-layout` for tables |
| No confidence threshold | Accept low-quality extractions | Reject fields with confidence < 0.8 |
| Processing all pages | Slow for large PDFs | Specify page ranges: `pages="1-3"` |
| No PII handling | Extracted SSN/ID stored in plain text | Detect + mask PII after extraction |
| Synchronous for large docs | Timeout on 100+ page PDFs | Use async: `begin_analyze_document` (polls) |
| No validation rules | Accept invalid extracted data | Validate: dates, amounts, required fields |
| Single-region deployment | High latency for global users | Deploy models to multiple regions |

### Confidence Scoring
```python
# Always check field confidence
for field_name, field_value in result.documents[0].fields.items():
    if field_value.confidence < 0.8:
        flagged_fields.append({"field": field_name, "value": field_value.content, "confidence": field_value.confidence})
        # Route to human review
    else:
        extracted_data[field_name] = field_value.content
```

## Evaluation Targets
| Metric | Target |
|--------|--------|
| Field extraction accuracy | >= 95% |
| Table extraction accuracy | >= 90% |
| Processing time per page | < 3 seconds |
| Confidence threshold | >= 0.8 per field |
| Human review rate | < 15% of documents |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | LLM for post-processing validation |
| `config/guardrails.json` | confidence thresholds, PII rules |
| `config/document-intelligence.json` | model IDs, page limits, regions |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement extraction pipelines, custom models, validation |
| `@reviewer` | Audit extraction accuracy, PII handling, confidence calibration |
| `@tuner` | Optimize model selection, page processing, throughput |

## Slash Commands
`/deploy` — Deploy doc processing | `/test` — Run extraction tests | `/review` — Audit quality | `/evaluate` — Evaluate accuracy
