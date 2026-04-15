# Play 71 — Smart Energy Grid AI ⚡

> AI-powered grid intelligence — load forecasting, renewable dispatch, demand response, anomaly detection.

Build a smart energy grid management system. Time-series models forecast load (Prophet + LightGBM ensemble), IoT Hub ingests sensor data, and LLMs explain anomalies for grid operators.

## Quick Start
```bash
cd solution-plays/71-smart-energy-grid-ai
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .
# Use @builder to implement, @reviewer to audit, @tuner to optimize
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure IoT Hub | Grid sensor data ingestion (frequency, voltage, load) |
| Azure Data Explorer | Time-series storage + KQL analytics |
| Azure ML | Forecast model training (Prophet, LightGBM, LSTM) |
| Azure OpenAI (gpt-4o) | Anomaly explanation + demand response recommendations |
| Event Hubs | Real-time grid telemetry streaming |
| Container Apps | Grid dashboard API + forecast serving |

```mermaid
graph TB
    subgraph Edge Layer
        Meters[Smart Meters & Sensors<br/>Voltage · Frequency · Load · Generation]
        DER[Distributed Energy Resources<br/>Solar · Wind · Battery · EV Chargers]
    end

    subgraph Ingestion
        IoTHub[Azure IoT Hub<br/>Meter Telemetry · Device Management · Message Routing]
    end

    subgraph Stream Processing
        Stream[Stream Analytics<br/>Load Aggregation · Frequency Deviation · Anomaly Detection]
    end

    subgraph Digital Twin
        ADT[Azure Digital Twins<br/>Grid Topology · Substation State · Feeder Model · DER Registry]
    end

    subgraph AI Engine
        OpenAI[Azure OpenAI — GPT-4o<br/>Demand Forecasting · Optimization Reasoning · Operator Reports]
    end

    subgraph Application
        API[Container Apps<br/>Grid API · Demand Forecaster · Load Balancer · Operator Dashboard]
    end

    subgraph Data Store
        Cosmos[Cosmos DB<br/>Forecasts · Grid History · Decisions · Outage Records]
    end

    subgraph Security
        KV[Key Vault — Premium HSM<br/>SCADA Creds · Device Certs · Encryption Keys]
        MI[Managed Identity<br/>Zero-secret Auth]
    end

    subgraph Monitoring
        AppInsights[Application Insights<br/>Forecast Accuracy · Grid Stability · System Reliability]
    end

    Meters -->|Telemetry| IoTHub
    DER -->|Generation Data| IoTHub
    IoTHub -->|Real-time Stream| Stream
    Stream -->|Aggregated Signals| API
    Stream -->|State Updates| ADT
    ADT -->|Grid Topology| API
    API -->|Demand Analysis| OpenAI
    OpenAI -->|Forecast + Optimization| API
    API <-->|Grid State| Cosmos
    API -->|Auth| MI
    MI -->|Secrets| KV
    API -->|Traces| AppInsights

    style Meters fill:#f97316,color:#fff,stroke:#ea580c
    style DER fill:#22c55e,color:#fff,stroke:#16a34a
    style IoTHub fill:#06b6d4,color:#fff,stroke:#0891b2
    style Stream fill:#0ea5e9,color:#fff,stroke:#0284c7
    style ADT fill:#8b5cf6,color:#fff,stroke:#7c3aed
    style OpenAI fill:#10b981,color:#fff,stroke:#059669
    style API fill:#3b82f6,color:#fff,stroke:#2563eb
    style Cosmos fill:#f59e0b,color:#fff,stroke:#d97706
    style KV fill:#ef4444,color:#fff,stroke:#dc2626
    style MI fill:#7c3aed,color:#fff,stroke:#6d28d9
    style AppInsights fill:#0ea5e9,color:#fff,stroke:#0284c7
```

📐 [Full architecture details](architecture.md)

## Pre-Tuned Defaults
- Forecast: Ensemble (Prophet 30% + LightGBM 50% + LSTM 20%) · MAPE target < 5%
- Anomaly: Isolation Forest · contamination 0.02 · frequency ±0.2 Hz critical
- Dispatch: Solar → Wind → Battery → Hydro → Gas Peaker (last resort)
- Demand Response: 3-tier pricing · 30-min notification · 20% max curtailment

## DevKit (AI-Assisted Development)
| Primitive | What It Does |
|-----------|-------------|
| `agent.md` | Root orchestrator with builder→reviewer→tuner handoffs |
| `copilot-instructions.md` | Grid AI domain knowledge (forecasting, dispatch, demand response pitfalls) |
| 3 agents | Builder (gpt-4o), Reviewer (gpt-4o-mini), Tuner (gpt-4o-mini) |
| 3 skills | Deploy (170+ lines), Evaluate (130+ lines), Tune (200+ lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` with agent routing |

## Cost Estimate

| Service | Dev | Prod | Enterprise |
|---------|-----|------|------------|
| Azure IoT Hub | $0 | $250 | $2,500 |
| Azure OpenAI | $30 | $250 | $1,000 |
| Stream Analytics | $80 | $480 | $1,920 |
| Azure Digital Twins | $15 | $150 | $600 |
| Cosmos DB | $3 | $120 | $480 |
| Container Apps | $10 | $150 | $400 |
| Key Vault | $1 | $10 | $20 |
| Application Insights | $0 | $40 | $150 |
| **Total** | **$139/mo** | **$1,450/mo** | **$7,070/mo** |

> Estimates based on Azure retail pricing. Actual costs vary by region, usage, and enterprise agreements.

💰 [Full cost breakdown](cost.json)

## vs. Play 69 (Carbon Footprint Tracker)
| Aspect | Play 69 | Play 71 |
|--------|---------|---------|
| Focus | Scope 1/2/3 emissions tracking | Real-time grid operations |
| Data | Annual/quarterly reports | 15-min sensor telemetry |
| AI Role | Emission factor estimation | Load forecasting + anomaly detection |
| Infrastructure | Cosmos DB + Functions | IoT Hub + Data Explorer + ML |

📖 [Full documentation](spec/README.md) · 🌐 [frootai.dev/solution-plays/71-smart-energy-grid-ai](https://frootai.dev/solution-plays/71-smart-energy-grid-ai) · 📦 [FAI Protocol](spec/fai-manifest.json)
