# Play 31 — Low-Code AI Builder 🧩

> Visual AI pipeline designer — drag-and-drop workflows, template library, one-click deploy.

Build AI pipelines without writing code. Drag nodes onto a canvas, connect them, configure properties, and deploy with one click. Pre-built templates for document classification, sentiment analysis, FAQ bots, email triage, and data enrichment. Citizen developers can ship AI in minutes.

## Quick Start
```bash
cd solution-plays/31-low-code-ai-builder
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .  # Use @builder for pipeline designer, @reviewer for validation audit, @tuner for performance
```

## Architecture
| Service | Purpose |
|---------|---------|
| Static Web Apps | Visual pipeline designer (React) |
| Cosmos DB | Pipeline definitions (versioned, per user) |
| Container Apps | Pipeline execution engine |
| Azure OpenAI | AI steps within pipelines |
| Key Vault | Connector credentials |

## Pre-Built Templates
| Template | Use Case |
|----------|----------|
| Document Classifier | Auto-sort incoming documents by type |
| Customer Sentiment | Real-time review/feedback scoring |
| FAQ Bot | Quick RAG chatbot from knowledge base |
| Email Triager | Auto-classify and route incoming email |
| Data Enricher | Batch LLM augmentation on records |

## Key Metrics
- Pipeline success: ≥95% · Deploy success: ≥90% · Time to first pipeline: <5min · Load: <3s

## DevKit (Low-Code Platform-Focused)
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (designer/templates/connectors), Reviewer (validation/security), Tuner (execution speed/model routing/cost) |
| 3 skills | Deploy (105 lines), Evaluate (105 lines), Tune (101 lines) |
| 4 prompts | `/deploy` (builder platform), `/test` (pipeline execution), `/review` (validation), `/evaluate` (template quality) |

## Cost
| Dev | Prod (1K runs/day) |
|-----|--------------------|
| $80–200/mo | ~$135/mo (SWA + Cosmos serverless + mini AI steps) |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/31-low-code-ai-builder](https://frootai.dev/solution-plays/31-low-code-ai-builder)
