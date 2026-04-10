---
description: "Supply Chain AI domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Supply Chain AI — Domain Knowledge

This workspace implements AI for supply chain — demand forecasting, inventory optimization, supplier risk scoring, logistics route optimization, and anomaly detection in procurement.

## Supply Chain AI Architecture (What the Model Gets Wrong)

### Demand Forecasting Pipeline
```python
async def forecast_demand(product_id: str, horizon_days: int = 90) -> Forecast:
    # 1. Gather historical data
    sales_history = await get_sales_data(product_id, lookback_days=365)
    external_signals = await get_external_data()  # Weather, holidays, events, economic indicators
    
    # 2. Feature engineering
    features = build_features(sales_history, external_signals)
    # Seasonality, trend, day-of-week, promotions, weather correlation
    
    # 3. ML forecast (statistical + LLM for anomaly explanation)
    ml_forecast = time_series_model.predict(features, horizon=horizon_days)
    
    # 4. LLM-enhanced: explain unusual patterns
    if has_anomalies(ml_forecast):
        explanation = await llm.analyze(f"Demand forecast shows {anomaly_description}. Possible causes given: {external_signals}")
    
    return Forecast(predictions=ml_forecast, confidence_intervals=ml_forecast.ci, explanation=explanation)
```

### Supplier Risk Scoring
```python
class SupplierRisk(BaseModel):
    supplier: str
    risk_score: float      # 0-100 (higher = riskier)
    financial_health: str  # strong, moderate, weak
    delivery_reliability: float  # On-time delivery rate
    quality_score: float   # Defect rate inverse
    geo_risk: str          # Political stability of supplier region
    concentration_risk: str  # Single-source dependency level
    recommendation: str    # maintain, diversify, replace
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| LLM-only forecasting | Statistical models outperform LLMs at time-series | ML model for forecast, LLM for explanation only |
| Ignore external signals | Miss weather/event-driven demand spikes | Weather, holidays, promotions, economic indicators as features |
| No confidence intervals | Point forecast without uncertainty | Always provide CI (80% and 95% bands) |
| Single supplier dependency | Supply chain single point of failure | Risk score includes concentration_risk → recommend diversification |
| Batch-only forecasting | Can't react to real-time demand changes | Event-driven reforecast on significant sales anomalies |
| Historical data only | Misses regime changes | Combine historical patterns with forward-looking signals |
| No lead time consideration | Forecast without accounting for delivery lag | Subtract supplier lead time from reorder point |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | LLM for analysis/explanation, temperature=0.2 |
| `config/guardrails.json` | Forecast horizon limits, risk thresholds, anomaly sensitivity |
| `config/agents.json` | Data sources, reforecast triggers, alert rules |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement forecasting, risk scoring, optimization algorithms |
| `@reviewer` | Audit forecast accuracy, risk model fairness, data quality |
| `@tuner` | Optimize model parameters, feature selection, reforecast frequency |

## Slash Commands
`/deploy` — Deploy supply chain AI | `/test` — Test with historical data | `/review` — Audit accuracy | `/evaluate` — Measure forecast error + risk precision
