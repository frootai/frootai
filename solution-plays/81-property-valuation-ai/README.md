# Play 81 — Property Valuation AI 🏠

> Automated property appraisal — comparable sales analysis, ML valuation model, adjustment engine, bias testing, regulatory-compliant reports.

Build an automated valuation model (AVM). AI Search finds geospatially-filtered comparable sales, paired-sales-derived adjustment factors normalize for differences (sqft, condition, features), gradient boosting predicts value with confidence intervals, and LLM generates professional appraisal narratives.

## Quick Start
```bash
cd solution-plays/81-property-valuation-ai
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .
# Use @builder to implement, @reviewer to audit, @tuner to optimize
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure AI Search (Standard) | Comparable sales with geospatial filtering |
| Azure Maps | Property geolocation, distance calculations |
| Azure ML | Valuation regression model (gradient boosting) |
| Azure OpenAI (gpt-4o) | Valuation narrative + report generation |
| Cosmos DB (Serverless) | Property records, valuation history |
| Container Apps | Valuation API |

## Pre-Tuned Defaults
- Comp search: 2km radius · 6 months recency · ±20% sqft · top 5 comps
- Adjustments: $/sqft, bedrooms, bathrooms, condition, features · USPAP net <25%
- Confidence: ±8% default · widens for few/old/distant comps
- Bias: ECOA compliance · disparate impact 0.80-1.25 · no protected features

## DevKit (AI-Assisted Development)
| Primitive | What It Does |
|-----------|-------------|
| `agent.md` | Root orchestrator with builder→reviewer→tuner handoffs |
| `copilot-instructions.md` | Valuation domain (AVM, comps, adjustments, fair lending pitfalls) |
| 3 agents | Builder (gpt-4o), Reviewer (gpt-4o-mini), Tuner (gpt-4o-mini) |
| 3 skills | Deploy (205+ lines), Evaluate (125+ lines), Tune (230+ lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` with agent routing |

## Cost Estimate
| Environment | Monthly |
|-------------|---------|
| Dev/Test | $25–50 |
| Production (1K valuations) | $380–500 |

## vs. Play 72 (Climate Risk Assessor)
| Aspect | Play 72 | Play 81 |
|--------|---------|---------|
| Focus | Climate physical/transition risk | Property value estimation |
| Model | NGFS scenario projection | Gradient boosting on comp data |
| Bias Concern | Greenwashing detection | Fair lending / disparate impact |
| Regulation | TCFD | USPAP, ECOA, Fair Housing Act |

📖 [Full documentation](spec/README.md) · 🌐 [frootai.dev/solution-plays/81-property-valuation-ai](https://frootai.dev/solution-plays/81-property-valuation-ai) · 📦 [FAI Protocol](spec/fai-manifest.json)
