# Play 85 — Policy Impact Analyzer 📊

> AI policy analysis — provision extraction, stakeholder impact scoring, cost-benefit modeling, public comment analysis, evidence-based recommendations.

Build an evidence-based policy impact analyzer. Extract provisions from regulatory documents, score impacts per stakeholder group with uncertainty ranges, analyze public comments with campaign detection, and generate balanced recommendations presenting arguments for AND against with cited evidence.

## Quick Start
```bash
cd solution-plays/85-policy-impact-analyzer
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .
# Use @builder to implement, @reviewer to audit, @tuner to optimize
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure OpenAI (gpt-4o) | Policy analysis + stakeholder impact + recommendations |
| Azure AI Search (Standard) | Regulatory knowledge base + precedent retrieval |
| Azure Document Intelligence | Extract provisions from policy PDFs |
| Cosmos DB (Serverless) | Assessments, stakeholder data, comment history |
| Container Apps | Analysis API + dashboard |

## Pre-Tuned Defaults
- Provisions: Structured extraction with 8 fields · zero temperature for legal accuracy
- Stakeholders: 4-category taxonomy · always assess vulnerable groups · evidence-grounded ranges
- Comments: 0.85 similarity deduplication · campaign detection · representation gap analysis
- Evidence: Ranges not points · confidence levels · precedent search · non-partisan enforcement

## DevKit (AI-Assisted Development)
| Primitive | What It Does |
|-----------|-------------|
| `agent.md` | Root orchestrator with builder→reviewer→tuner handoffs |
| `copilot-instructions.md` | Policy domain (impact assessment, non-partisanship, evidence standards) |
| 3 agents | Builder (gpt-4o), Reviewer (gpt-4o-mini), Tuner (gpt-4o-mini) |
| 3 skills | Deploy (220+ lines), Evaluate (115+ lines), Tune (230+ lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` with agent routing |

## Cost Estimate
| Environment | Monthly |
|-------------|---------|
| Dev/Test | $25–50 |
| Production (20 analyses) | $350–450 |

## vs. Play 84 (Citizen Services Chatbot)
| Aspect | Play 84 | Play 85 |
|--------|---------|---------|
| Focus | Citizen-facing Q&A | Policy maker analysis tool |
| Users | Citizens | Government analysts, legislators |
| Output | Conversational answers | Impact assessments + recommendations |
| Analysis | Route to department | Cost-benefit per stakeholder group |

📖 [Full documentation](spec/README.md) · 🌐 [frootai.dev/solution-plays/85-policy-impact-analyzer](https://frootai.dev/solution-plays/85-policy-impact-analyzer) · 📦 [FAI Protocol](spec/fai-manifest.json)
