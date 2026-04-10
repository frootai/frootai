---
description: "Smart Energy Grid AI domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Smart Energy Grid AI — Domain Knowledge

This workspace implements AI for smart energy grids — load forecasting, renewable integration optimization, demand response management, grid anomaly detection, and energy trading decision support.

## Energy Grid AI Architecture (What the Model Gets Wrong)

### Load Forecasting
```python
async def forecast_load(grid_zone: str, horizon_hours: int = 24) -> LoadForecast:
    # 1. Historical consumption patterns (seasonal, weekly, daily)
    history = await get_consumption(grid_zone, lookback_days=365)
    
    # 2. External factors
    weather = await get_weather_forecast(grid_zone, hours=horizon_hours)
    events = await get_local_events(grid_zone)  # Concerts, sports → demand spike
    
    # 3. ML forecast (not LLM — time-series models outperform)
    forecast = time_series_model.predict(history, weather, events, horizon=horizon_hours)
    
    # 4. LLM explains anomalies in forecast
    if has_unusual_patterns(forecast):
        explanation = await llm.explain(f"Load forecast anomaly in {grid_zone}: {anomaly_details}")
    
    return LoadForecast(predictions=forecast, confidence_intervals=forecast.ci)
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| LLM for load prediction | Time-series models far superior | ML for forecast, LLM for explanation only |
| Ignore weather correlation | Weather drives 30-50% of load variation | Include weather as primary feature |
| Fixed renewable curtailment | Waste clean energy | Dynamic dispatch: prioritize renewables, curtail only when necessary |
| No demand response signals | Miss peak shaving opportunities | Real-time pricing signals to large consumers |
| Single-point forecast | No uncertainty quantification | Provide confidence intervals (80%, 95%) |
| Ignore grid constraints | Forecasted load may exceed transmission capacity | Include network topology constraints |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | LLM for anomaly explanation |
| `config/guardrails.json` | Forecast accuracy thresholds, anomaly sensitivity |
| `config/agents.json` | Grid zones, data sources, forecast horizon |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement forecasting, renewable optimization, demand response |
| `@reviewer` | Audit forecast accuracy, grid safety, compliance |
| `@tuner` | Optimize forecast models, renewable dispatch, peak shaving |

## Slash Commands
`/deploy` — Deploy grid AI | `/test` — Test forecasts | `/review` — Audit accuracy | `/evaluate` — Measure forecast error
