# Play 68 — Predictive Maintenance AI

Industrial predictive maintenance — IoT sensor telemetry (vibration, temperature, pressure, current), multivariate feature engineering, Gradient Boosting RUL prediction, condition-based scheduling (urgent/planned/monitor), LLM root cause analysis with parts + repair time, failure pattern recognition, and analyst feedback loop for model improvement.

## Architecture

| Component | Azure Service | Purpose |
|-----------|--------------|---------|
| Sensor Ingestion | Azure IoT Hub | Vibration, temperature, pressure, current |
| Time-Series Store | Azure Data Explorer | 90-day telemetry archive, feature queries |
| RUL Model | Azure ML + scikit-learn | Remaining Useful Life prediction |
| Root Cause | Azure OpenAI (GPT-4o) | Failure mode explanation + action + parts |
| Scheduler | Custom | Condition-based work order generation |
| Prediction API | Azure Container Apps | RUL endpoint + scheduling |

## How It Differs from Related Plays

| Aspect | Play 58 (Digital Twin) | **Play 68 (Predictive Maintenance)** |
|--------|----------------------|--------------------------------------|
| Focus | Full twin representation | **Failure prediction specifically** |
| Model | DTDL twin graph | **ML regression (GradientBoosting)** |
| Output | NL query results | **RUL days + work orders + root cause** |
| Features | Twin properties | **Multivariate sensor stats (kurtosis, trends)** |
| Scheduling | N/A | **Condition-based: urgent/planned/monitor** |
| Feedback | N/A | **Analyst confirms→model retrains** |

## Key Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| RUL MAE | < 5 days | Prediction error margin |
| Critical Detection | > 95% | Failures within 7 days correctly flagged |
| False Alarm Rate | < 10% | Healthy equipment incorrectly flagged |
| Downtime Reduction | > 40% | vs reactive maintenance |
| ROI | > 10x | Value delivered / system cost |

## WAF Alignment

| Pillar | Implementation |
|--------|---------------|
| **Reliability** | Condition-based scheduling, multi-sensor correlation, feedback loop |
| **Performance Efficiency** | Multivariate features, cross-sensor correlation, batch predictions |
| **Cost Optimization** | Reduced unplanned downtime, right-time maintenance, parts pre-ordering |
| **Operational Excellence** | Work order generation, root cause analysis, quarterly model retrain |
| **Security** | IoT device authentication, Key Vault for credentials |
| **Responsible AI** | Explainable predictions with top indicators, human review for urgent |
