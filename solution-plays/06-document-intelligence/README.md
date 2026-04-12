# Play 06 — Document Intelligence 📄

> Extract, classify, and structure document data with OCR + LLM.

Feed PDFs, invoices, receipts, and forms into Azure Document Intelligence for OCR, then GPT-4o extracts structured fields into typed JSON. Handles multi-page documents, handwriting, tables, and stamps.

## Quick Start
```bash
cd solution-plays/06-document-intelligence
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .  # Use @builder for extraction, @reviewer for accuracy audit, @tuner for throughput
```

## Architecture
| Service | Purpose |
|---------|---------|
| Document Intelligence | OCR, form recognition, table extraction |
| Azure OpenAI (gpt-4o) | Post-extraction enrichment + structured output |
| Blob Storage | Document upload and processing queue |
| Cosmos DB | Structured extraction results storage |

## Key Metrics
- Field extraction: ≥95% (prebuilt), ≥90% (custom) · Processing: <10s/page · PII recall: ≥99%

## DevKit
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (OCR/extraction), Reviewer (accuracy/PII audit), Tuner (model selection/cost) |
| 3 skills | Deploy (117 lines), Evaluate (110 lines), Tune (105 lines) |

## Cost
| Dev | Prod |
|-----|------|
| $80–200/mo | $1.2K–3K/mo |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/06-document-intelligence](https://frootai.dev/solution-plays/06-document-intelligence)
