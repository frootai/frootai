# Play 55 — Supply Chain AI

AI-powered supply chain intelligence — demand forecasting (Prophet ML + LLM anomaly explanation), supplier risk scoring (multi-factor weighted), inventory optimization (safety stock + EOQ), logistics routing, procurement anomaly detection, and external signal integration (weather, holidays, promotions, economic indicators).

## Architecture

```mermaid
graph TB
    subgraph Data Sources
        POS[POS Transactions<br/>Sales Data · Returns · Store Demand Signals]
        IoT[IoT Sensors<br/>Warehouse Temp · Fleet GPS · Equipment Status]
        Suppliers[Supplier Systems<br/>Shipment Notifications · Lead Times · Invoices]
        ERP[ERP / WMS<br/>Inventory Records · Purchase Orders · Receipts]
    end

    subgraph Event Ingestion
        EventHubs[Azure Event Hubs<br/>Real-Time Streams · Millions Events/sec · Kafka API]
    end

    subgraph Stream Processing
        StreamAnalytics[Stream Analytics<br/>Demand Aggregation · Threshold Alerts · SLA Monitoring]
    end

    subgraph ML & Forecasting
        AzureML[Azure Machine Learning<br/>Demand Forecasting · Inventory Optimization · Lead-Time Prediction]
        Models[ML Models<br/>Prophet · DeepAR · Optimization Solvers]
    end

    subgraph AI Intelligence
        AOAI[Azure OpenAI<br/>NL Query Interface · Root-Cause Analysis · Scenario Simulation]
    end

    subgraph Operational Data
        CosmosDB[Cosmos DB<br/>Inventory Levels · Orders · Supplier Metrics · Forecasts]
        BlobStore[Azure Blob Storage<br/>Data Lake · Training Data · Historical Archives]
    end

    subgraph Decision & Action
        Dashboard[Operations Dashboard<br/>Demand Forecasts · Stock Levels · Supplier Risk · Alerts]
        Alerts[Alert Engine<br/>Stockout Risk · Delay Detection · SLA Breach · Demand Spikes]
    end

    subgraph Security
        KV[Key Vault<br/>API Keys · ERP Credentials · Supplier Tokens]
        MI[Managed Identity<br/>Zero-secret Auth]
    end

    subgraph Monitoring
        AppInsights[Application Insights<br/>Forecast Accuracy · Processing Latency · Model Performance]
    end

    POS -->|Events| EventHubs
    IoT -->|Telemetry| EventHubs
    Suppliers -->|Updates| EventHubs
    ERP -->|Records| EventHubs
    EventHubs -->|Streams| StreamAnalytics
    StreamAnalytics -->|Aggregated| CosmosDB
    StreamAnalytics -->|Alerts| Alerts
    CosmosDB -->|Training Data| BlobStore
    BlobStore -->|Datasets| AzureML
    AzureML -->|Train| Models
    Models -->|Forecasts| CosmosDB
    CosmosDB -->|Context| AOAI
    AOAI -->|Insights| Dashboard
    CosmosDB -->|Real-Time| Dashboard
    Alerts -->|Notifications| Dashboard
    MI -->|Secrets| KV
    StreamAnalytics -->|Traces| AppInsights

    style POS fill:#3b82f6,color:#fff,stroke:#2563eb
    style IoT fill:#3b82f6,color:#fff,stroke:#2563eb
    style Suppliers fill:#3b82f6,color:#fff,stroke:#2563eb
    style ERP fill:#3b82f6,color:#fff,stroke:#2563eb
    style EventHubs fill:#f59e0b,color:#fff,stroke:#d97706
    style StreamAnalytics fill:#10b981,color:#fff,stroke:#059669
    style AzureML fill:#10b981,color:#fff,stroke:#059669
    style Models fill:#10b981,color:#fff,stroke:#059669
    style AOAI fill:#10b981,color:#fff,stroke:#059669
    style CosmosDB fill:#f59e0b,color:#fff,stroke:#d97706
    style BlobStore fill:#f59e0b,color:#fff,stroke:#d97706
    style Dashboard fill:#3b82f6,color:#fff,stroke:#2563eb
    style Alerts fill:#0ea5e9,color:#fff,stroke:#0284c7
    style KV fill:#7c3aed,color:#fff,stroke:#6d28d9
    style MI fill:#7c3aed,color:#fff,stroke:#6d28d9
    style AppInsights fill:#0ea5e9,color:#fff,stroke:#0284c7
```

> Full architecture details: [`architecture.md`](./architecture.md)

## How It Differs from Related Plays

| Aspect | Play 45 (Real-Time Event AI) | **Play 55 (Supply Chain AI)** | Play 27 (Data Pipeline) |
|--------|---------------------------|------------------------------|------------------------|
| Domain | Any event stream | **Supply chain specifically** | General data processing |
| Forecasting | Anomaly detection | **Demand forecasting with CI** | ETL/transformation |
| ML Model | Streaming Z-score | **Prophet time-series + LLM** | No ML |
| Output | Enriched events + alerts | **Forecasts + risk scores + inventory plans** | Transformed data |
| External Data | N/A | **Weather, holidays, economic indicators** | N/A |
| Optimization | N/A | **Safety stock, EOQ, reorder point** | N/A |

## Key Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| Forecast MAPE | < 15% | Mean Absolute Percentage Error |
| CI Calibration | > 90% | Actuals within 95% confidence interval |
| Supplier Risk Accuracy | > 80% | Risk scores match historical outcomes |
| Service Level | > 95% | Orders filled from stock |
| Stockout Rate | < 3% | Out-of-stock occurrences |
| Carrying Cost Reduction | > 15% | vs manual inventory planning |

## Cost Estimate

| Service | Dev | Prod | Enterprise |
|---------|-----|------|------------|
| Azure OpenAI | $80 | $600 | $2,500 |
| Azure Machine Learning | $50 | $300 | $1,200 |
| Cosmos DB | $5 | $150 | $600 |
| Azure Event Hubs | $10 | $75 | $350 |
| Azure Stream Analytics | $25 | $100 | $300 |
| Azure Blob Storage | $5 | $40 | $120 |
| Key Vault | $1 | $5 | $15 |
| Application Insights | $0 | $40 | $120 |
| **Total** | **$176** | **$1,310** | **$5,205** |

> Detailed breakdown with SKUs and optimization tips: [`cost.json`](./cost.json) · [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/)

## WAF Alignment

| Pillar | Implementation |
|--------|---------------|
| **Reliability** | Confidence intervals, reforecast triggers, lead time buffers |
| **Cost Optimization** | Prophet (free ML), gpt-4o-mini for risk, ADX Dev tier |
| **Performance Efficiency** | Weekly batch forecast, event-driven reforecast on anomalies |
| **Operational Excellence** | MAPE tracking, supplier reassessment schedule, audit trail |
| **Security** | Key Vault for API keys, no PII in supply chain data |
| **Responsible AI** | LLM explains anomalies (not black-box), human reviews risk recommendations |
