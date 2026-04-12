# Play 15 — Multi-Modal DocProc 🖼️

> Process documents with text + images using GPT-4o multi-modal vision.

GPT-4o's vision capability processes documents containing images, charts, tables, and text together. Document Intelligence handles OCR, then GPT-4o interprets visual elements like graphs, stamps, and signatures. Outputs structured JSON. Intelligent routing sends text pages to OCR (cheap) and visual pages to GPT-4o vision (accurate).

## Quick Start
```bash
cd solution-plays/15-multi-modal-docproc
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .  # Use @builder for vision pipeline, @reviewer for accuracy audit, @tuner for routing/cost
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure OpenAI (gpt-4o vision) | Chart/graph/stamp/signature interpretation |
| Document Intelligence | OCR text extraction + table recognition |
| Azure Functions | Page-level processing pipeline |
| Blob Storage | Document upload + page image cache |
| Cosmos DB | Structured extraction results |

## Page Routing (Key Differentiator from Play 06)
| Page Type | Processing Path | Cost |
|-----------|----------------|------|
| Text-only | Document Intelligence OCR | 1x (cheapest) |
| Table | Document Intelligence table extraction | 1x |
| Chart/graph | GPT-4o Vision | 10x |
| Photo/stamp | GPT-4o Vision | 10x |
| Mixed | OCR (text) + Vision (visual) | 5x |

## Key Metrics
- Text extraction: ≥95% · Chart data: ≥85% · Page classification: ≥95% · Processing: <15s/page

## DevKit (Multi-Modal Vision-Focused)
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (vision+OCR pipeline), Reviewer (accuracy/PII in images), Tuner (routing/resolution/cost) |
| 3 skills | Deploy (124 lines), Evaluate (100 lines), Tune (112 lines) |
| 4 prompts | `/deploy` (GPT-4o vision + Doc Intel), `/test` (vision pipeline), `/review` (multi-modal quality), `/evaluate` (accuracy) |

## Cost
| Dev | Prod | With Routing Savings |
|-----|------|---------------------|
| $80–200/mo | $1.2K–3K/mo | 56% savings from intelligent OCR/vision routing |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/15-multi-modal-docproc](https://frootai.dev/solution-plays/15-multi-modal-docproc)
