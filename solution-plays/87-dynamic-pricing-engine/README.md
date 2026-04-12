# Play 87 — Dynamic Pricing Engine 💰

> AI dynamic pricing — demand-based optimization, competitor monitoring, elasticity modeling, A/B testing, fairness-constrained pricing.

Build a dynamic pricing engine. ML elasticity models predict demand sensitivity, scipy optimization finds revenue-maximizing prices within fairness constraints (margin floor, change caps, no demographic discrimination), competitor monitoring maintains market positioning, and A/B testing validates price points with statistical significance.

## Quick Start
```bash
cd solution-plays/87-dynamic-pricing-engine
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .
# Use @builder to implement, @reviewer to audit, @tuner to optimize
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure ML | Elasticity model training + real-time serving |
| Azure Data Explorer | Transaction time-series + demand analytics |
| Azure OpenAI (gpt-4o) | Market analysis + pricing explanations |
| Event Hubs | Real-time sales event streaming |
| Azure Functions | Price calculation engine (event-driven) |
| Cosmos DB (Serverless) | Price history, A/B results, audit log |

## Pre-Tuned Defaults
- Constraints: 15% min margin · ±10% max daily change · 2× surge cap · no demographic pricing
- Elasticity: Gradient boosting · 10 features · weekly retrain · cross-elasticity enabled
- Optimization: Revenue 60% / margin 40% · hourly updates · 0.7 dampening
- A/B: 1000 min samples · 95% confidence · 14-day max duration

## DevKit (AI-Assisted Development)
| Primitive | What It Does |
|-----------|-------------|
| `agent.md` | Root orchestrator with builder→reviewer→tuner handoffs |
| `copilot-instructions.md` | Pricing domain (elasticity, fairness, A/B testing, surge caps) |
| 3 agents | Builder (gpt-4o), Reviewer (gpt-4o-mini), Tuner (gpt-4o-mini) |
| 3 skills | Deploy (215+ lines), Evaluate (120+ lines), Tune (240+ lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` with agent routing |

## Cost Estimate
| Environment | Monthly |
|-------------|---------|
| Dev/Test | $130–170 |
| Production (1K products) | $240–350 |

## vs. Play 14 (Cost-Optimized AI Gateway)
| Aspect | Play 14 | Play 87 |
|--------|---------|---------|
| Focus | AI service cost optimization | Product price optimization |
| Optimization | Model routing + caching | Elasticity + competitor positioning |
| Fairness | N/A | No demographic discrimination, surge caps |
| A/B Testing | N/A | Price point experimentation |

📖 [Full documentation](spec/README.md) · 🌐 [frootai.dev/solution-plays/87-dynamic-pricing-engine](https://frootai.dev/solution-plays/87-dynamic-pricing-engine) · 📦 [FAI Protocol](spec/fai-manifest.json)
