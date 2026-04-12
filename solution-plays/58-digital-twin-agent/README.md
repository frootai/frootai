# Play 58 — Digital Twin Agent

AI-powered digital twin — Azure Digital Twins with DTDL models, IoT Hub sensor ingestion via Event Grid, natural language→DTDL query translation, predictive maintenance (Remaining Useful Life), twin graph relationship traversal, event-driven state synchronization, and telemetry archival in Azure Data Explorer.

## Architecture

| Component | Azure Service | Purpose |
|-----------|--------------|---------|
| Twin Platform | Azure Digital Twins | Virtual representation of physical assets |
| Sensor Data | Azure IoT Hub | Device telemetry ingestion |
| Event Routing | Azure Event Grid + Functions | IoT→Twin state updates |
| NL Queries | Azure OpenAI (GPT-4o) | Natural language→DTDL translation |
| Telemetry Archive | Azure Data Explorer | Historical sensor data for ML |
| Predictions | Custom ML + GPT-4o-mini | RUL prediction + explanation |
| Agent API | Azure Container Apps | Query + prediction endpoint |

## How It Differs from Related Plays

| Aspect | Play 19 (Edge AI) | **Play 58 (Digital Twin)** | Play 34 (Edge Deployment) |
|--------|-------------------|--------------------------|--------------------------|
| Model | ONNX on device | **DTDL twin graph in cloud** | ONNX on IoT device |
| Scope | Single device inference | **Entire facility (building/factory)** | Device fleet |
| Query | N/A | **NL→DTDL ("overheating machines?")** | N/A |
| Prediction | Edge inference | **Cloud RUL prediction + LLM explanation** | Edge inference |
| Relationships | N/A | **Graph: locatedIn, feeds, controls** | N/A |
| Telemetry | On-device processing | **Streamed to cloud, archived in ADX** | Cloud sync |

## Key Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| NL Query Accuracy | > 85% | Correct DTDL generated from natural language |
| RUL MAE | < 5 days | Maintenance prediction error margin |
| Critical Detection | > 90% | Failing machines flagged within 7 days |
| Sync Latency | < 5s | IoT message→twin property update |
| Telemetry Coverage | > 95% | Sensors actively reporting |

## WAF Alignment

| Pillar | Implementation |
|--------|---------------|
| **Reliability** | Event-driven IoT→Twin sync, telemetry archival, twin lifecycle |
| **Security** | IoT device authentication, managed identity, Key Vault |
| **Cost Optimization** | ADX Dev tier, gpt-4o-mini for explanations, compressed telemetry |
| **Operational Excellence** | Twin graph visualization, threshold alerting, prediction dashboards |
| **Performance Efficiency** | Event-driven (not polling), ADX hot cache for recent queries |
| **Responsible AI** | Explainable RUL predictions, human review for maintenance decisions |
