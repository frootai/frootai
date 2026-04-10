---
description: "Digital Twin Agent domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Digital Twin Agent — Domain Knowledge

This workspace implements a digital twin AI agent — virtual representation of physical assets (buildings, factories, devices), real-time sensor data integration, predictive maintenance, and natural language querying of twin state.

## Digital Twin Architecture (What the Model Gets Wrong)

### Azure Digital Twins + AI Layer
```python
from azure.digitaltwins.core import DigitalTwinsClient

# Query twin state with DTDL (Digital Twins Definition Language)
twins_client = DigitalTwinsClient(endpoint, credential)
query = "SELECT * FROM digitaltwins T WHERE T.$metadata.Temperature > 80"
results = twins_client.query_twins(query)

# AI layer: natural language → DTDL query
async def nl_to_twin_query(question: str) -> list:
    # LLM translates NL to DTDL
    dtdl_query = await llm.translate(
        system="Convert natural language to Azure Digital Twins DTDL query. Schema: {twin_schema}",
        user=question,  # "Which machines are overheating?"
    )
    return twins_client.query_twins(dtdl_query)
```

### Predictive Maintenance Pattern
```python
async def predict_maintenance(twin_id: str) -> MaintenancePrediction:
    # 1. Get historical telemetry from twin
    telemetry = await get_telemetry(twin_id, hours=720)  # 30 days
    
    # 2. ML model predicts remaining useful life (RUL)
    rul = ml_model.predict(telemetry.features)
    
    # 3. LLM explains the prediction
    explanation = await llm.explain(
        f"Machine {twin_id} has {rul.days} days until maintenance needed. "
        f"Key indicators: {rul.top_features}. Recommend maintenance actions."
    )
    return MaintenancePrediction(twin_id=twin_id, rul_days=rul.days, explanation=explanation)
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| LLM generates DTDL without schema | Invalid queries, wrong property names | Include twin schema in LLM context |
| Poll sensors (not stream) | Misses rapid changes, high latency | Event-driven: IoT Hub → Event Grid → Digital Twins |
| No historical data retention | Can't train predictive models | Archive telemetry to ADX/Time Series Insights |
| Synchronous twin updates | Blocks on IoT message processing | Async update functions, queue-based processing |
| No twin graph relationships | Isolated twins, no spatial reasoning | Model relationships: contains, feeds, controls |
| Ignore twin lifecycle | Twins never decommissioned | Status tracking: active → maintenance → decommissioned |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | NL-to-DTDL model, prediction explanation model |
| `config/guardrails.json` | Telemetry thresholds, maintenance prediction confidence |
| `config/agents.json` | Twin models, sensor refresh rate, alert rules |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement twin models, NL query, predictive maintenance |
| `@reviewer` | Audit twin accuracy, security, telemetry coverage |
| `@tuner` | Optimize prediction accuracy, query performance, data retention |

## Slash Commands
`/deploy` — Deploy digital twin | `/test` — Test twin queries | `/review` — Audit data quality | `/evaluate` — Measure prediction accuracy
