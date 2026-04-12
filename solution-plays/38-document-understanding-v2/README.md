# Play 38 — Document Understanding V2 📑🔍

> Advanced document processing with layout-aware extraction, cross-doc comparison, and auto-classification.

Beyond Play 06's basic OCR: auto-classify documents by type, extract fields while preserving layout structure (sections, tables, columns), compare document versions to find changes, and route through automated workflows. Document intelligence meets AI reasoning.

## Quick Start
```bash
cd solution-plays/38-document-understanding-v2
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .  # Use @builder for extraction/classification, @reviewer for accuracy audit, @tuner for model routing
```

## How It Differs from Play 06 and Play 15
| Aspect | Play 06 (Doc Intel) | Play 15 (Multi-Modal) | Play 38 (Understanding V2) |
|--------|--------------------|-----------------------|---------------------------|
| Classification | Manual model | Page-type routing | Auto-classify any doc |
| Comparison | None | None | Cross-doc diff + risk |
| Layout | Basic fields | Page-level visual | Section/table-aware |
| Workflow | Extract only | Extract only | Classify → extract → route → archive |

## Architecture
| Service | Purpose |
|---------|---------|
| Document Intelligence | Layout + prebuilt extraction |
| Azure OpenAI (gpt-4o) | Classification, comparison analysis |
| Cosmos DB | Classification results, comparison logs |
| Azure Functions | Workflow orchestration |

## Key Metrics
- Classification: ≥92% · Layout F1: ≥88% · Comparison: ≥85% · PII recall: ≥99%

## DevKit (Advanced Document-Focused)
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (layout/comparison/classification), Reviewer (accuracy/PII/consistency), Tuner (models/thresholds/cost) |
| 3 skills | Deploy (106 lines), Evaluate (107 lines), Tune (103 lines) |
| 4 prompts | `/deploy` (understanding pipeline), `/test` (extraction/workflow), `/review` (PII/accuracy), `/evaluate` (classification) |

## Cost
| Dev | Prod (5K docs/day) |
|-----|--------------------|
| $80–200/mo | ~$3.5K-5.8K/mo (optimize with smart model routing) |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/38-document-understanding-v2](https://frootai.dev/solution-plays/38-document-understanding-v2)
