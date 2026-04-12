# Play 89 — Retail Inventory Predictor 📦

> AI demand forecasting — SKU-level prediction, dynamic safety stock, promotion modeling, automated replenishment, stockout prevention.

Build a retail inventory prediction system. LightGBM forecasts demand per SKU × store with promotion/weather/event features, dynamic safety stock adapts to demand variability, Croston handles slow movers, and event-driven replenishment triggers purchase orders before stockout.

## Quick Start
```bash
cd solution-plays/89-retail-inventory-predictor
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .
# Use @builder to implement, @reviewer to audit, @tuner to optimize
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure ML | Demand forecasting (LightGBM + Croston) |
| Azure Data Explorer | Sales time-series analytics (KQL) |
| Azure OpenAI (gpt-4o-mini) | Anomaly explanation + replenishment reports |
| Event Hubs | Real-time POS transaction streaming |
| Azure Functions | Reorder trigger engine (event-driven) |
| Cosmos DB (Serverless) | SKU metadata, forecasts, reorder history |

## Pre-Tuned Defaults
- Forecast: LightGBM · 14-day horizon · daily updates · 20+ features · Croston for slow movers
- Safety Stock: Dynamic · z-score based · 95% service level default · category overrides
- Promotions: 5 promo types with lift + post-promo dip · cannibalization modeling
- Reorder: Event-driven · per-supplier lead time · 20% promo buffer · emergency supplier

## DevKit (AI-Assisted Development)
| Primitive | What It Does |
|-----------|-------------|
| `agent.md` | Root orchestrator with builder→reviewer→tuner handoffs |
| `copilot-instructions.md` | Inventory domain (demand forecasting, safety stock, promotion effects) |
| 3 agents | Builder (gpt-4o), Reviewer (gpt-4o-mini), Tuner (gpt-4o-mini) |
| 3 skills | Deploy (220+ lines), Evaluate (115+ lines), Tune (235+ lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` with agent routing |

## Cost Estimate
| Environment | Monthly |
|-------------|---------|
| Dev/Test | $100–140 |
| Production (50K SKU-stores) | $200–300 |

## vs. Play 87 (Dynamic Pricing Engine)
| Aspect | Play 87 | Play 89 |
|--------|---------|---------|
| Focus | Price optimization | Inventory replenishment |
| Model | Elasticity (price↔demand) | Demand forecasting (time-series) |
| Output | Optimal price per product | Reorder point + order quantity |
| Promotion | Price point A/B testing | Demand lift + post-promo dip |

📖 [Full documentation](spec/README.md) · 🌐 [frootai.dev/solution-plays/89-retail-inventory-predictor](https://frootai.dev/solution-plays/89-retail-inventory-predictor) · 📦 [FAI Protocol](spec/fai-manifest.json)
