---
name: "deploy-predictive-maintenance-ai"
description: "Deploy Predictive Maintenance AI — IoT sensor ingestion, multivariate feature engineering, RUL model, condition-based scheduling, root cause analysis, failure pattern recognition."
---

# Deploy Predictive Maintenance AI

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.Devices` (IoT Hub for sensor telemetry)
  - `Microsoft.CognitiveServices` (Azure OpenAI for root cause analysis)
  - `Microsoft.Kusto` (Azure Data Explorer for time-series storage)
  - `Microsoft.MachineLearningServices` (Azure ML for RUL model)
  - `Microsoft.App` (Container Apps for prediction API)
  - `Microsoft.KeyVault` (secret management)
- Python 3.11+ with `azure-iot-hub`, `scikit-learn`, `azure-kusto-data`, `openai` packages
- `.env` file with: `IOTHUB_CONNECTION`, `ADX_CLUSTER`, `AZURE_OPENAI_KEY`, `ML_WORKSPACE`

## Step 1: Provision Infrastructure

```bash
az group create --name rg-frootai-predictive-maintenance --location eastus2

az deployment group create \
  --resource-group rg-frootai-predictive-maintenance \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json

az keyvault secret set --vault-name kv-pred-maint \
  --name openai-key --value "$AZURE_OPENAI_KEY"
az keyvault secret set --vault-name kv-pred-maint \
  --name iothub-conn --value "$IOTHUB_CONNECTION"
```

## Step 2: Deploy IoT Sensor Ingestion

```bash
az iot hub create --name iot-pred-maintenance \
  --resource-group rg-frootai-predictive-maintenance --sku S1

# Register equipment sensors
az iot hub device-identity create --hub-name iot-pred-maintenance --device-id pump-001
az iot hub device-identity create --hub-name iot-pred-maintenance --device-id compressor-001
az iot hub device-identity create --hub-name iot-pred-maintenance --device-id motor-001
```

Sensor telemetry schema:
| Sensor | Measurement | Unit | Sampling Rate |
|--------|------------|------|--------------|
| Vibration (accelerometer) | RMS velocity | mm/s | 1 Hz |
| Temperature | Surface temp | °C | 0.1 Hz |
| Pressure | Operating pressure | bar | 0.1 Hz |
| Current | Motor current draw | A | 1 Hz |
| Acoustic | Sound level | dB | 0.5 Hz |
| Oil quality | Particle count | ppm | 0.01 Hz (daily) |

## Step 3: Deploy Feature Engineering Pipeline

```python
# feature_engineering.py — multivariate sensor features
import numpy as np
from scipy import stats

class MaintenanceFeatureEngine:
    def extract(self, telemetry: dict, lookback_days: int = 90) -> dict:
        features = {}

        # Vibration features
        vib = telemetry["vibration"]
        features["vib_rms"] = np.sqrt(np.mean(np.square(vib)))
        features["vib_peak"] = np.max(np.abs(vib))
        features["vib_kurtosis"] = stats.kurtosis(vib)
        features["vib_trend"] = np.polyfit(range(len(vib)), vib, 1)[0]  # Slope

        # Temperature features
        temp = telemetry["temperature"]
        features["temp_mean"] = np.mean(temp)
        features["temp_max"] = np.max(temp)
        features["temp_anomaly_count"] = np.sum(temp > np.mean(temp) + 2 * np.std(temp))
        features["temp_trend"] = np.polyfit(range(len(temp)), temp, 1)[0]

        # Operating context
        features["operating_hours"] = telemetry["operating_hours"]
        features["hours_since_last_maintenance"] = telemetry["hours_since_maintenance"]
        features["duty_cycle"] = telemetry["duty_cycle"]  # % of max capacity
        features["start_stop_count"] = telemetry["start_stop_cycles"]

        # Cross-sensor correlation
        features["vib_temp_correlation"] = np.corrcoef(vib[-1000:], temp[-1000:])[0, 1]

        return features
```

Feature importance for RUL:
| Feature | Importance | Why |
|---------|-----------|-----|
| `vib_trend` | 0.25 | Increasing vibration = bearing wear |
| `hours_since_maintenance` | 0.20 | Time-based degradation |
| `temp_anomaly_count` | 0.15 | Overheating indicates problems |
| `vib_kurtosis` | 0.12 | Spiky vibration = impact damage |
| `duty_cycle` | 0.10 | High load = faster wear |
| `vib_temp_correlation` | 0.08 | Breaking correlation = new failure mode |
| `start_stop_count` | 0.05 | Thermal cycling fatigue |
| `oil_quality` | 0.05 | Contamination indicates wear |

## Step 4: Deploy RUL Prediction Model

```python
# rul_model.py — Remaining Useful Life predictor
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import cross_val_score
import joblib

class RULPredictor:
    def __init__(self, model_path=None):
        if model_path:
            self.model = joblib.load(model_path)
        else:
            self.model = GradientBoostingRegressor(
                n_estimators=200, max_depth=6, learning_rate=0.05,
                loss="huber",  # Robust to outliers
            )

    def train(self, features_df, rul_labels):
        self.model.fit(features_df, rul_labels)
        cv_score = cross_val_score(self.model, features_df, rul_labels, cv=5, scoring="neg_mean_absolute_error")
        return {"cv_mae": -cv_score.mean(), "cv_std": cv_score.std()}

    def predict(self, features: dict) -> dict:
        features_array = np.array([list(features.values())])
        rul_days = self.model.predict(features_array)[0]

        # Confidence from ensemble variance
        tree_predictions = [tree.predict(features_array)[0] for tree in self.model.estimators_[:, 0]]
        confidence = 1 - (np.std(tree_predictions) / max(np.mean(tree_predictions), 1))

        return {
            "rul_days": max(0, round(rul_days)),
            "confidence": round(confidence, 2),
            "schedule": "urgent" if rul_days < 7 else "planned" if rul_days < 30 else "monitor",
        }
```

## Step 5: Deploy Root Cause Analysis

```python
# root_cause.py — LLM-powered failure explanation
class RootCauseAnalyzer:
    async def analyze(self, equipment_id, features, rul_result):
        top_features = sorted(features.items(), key=lambda x: abs(x[1]), reverse=True)[:5]

        response = await self.openai.chat.completions.create(
            model="gpt-4o", temperature=0.2,
            messages=[
                {"role": "system", "content": "You are a maintenance engineer. Analyze sensor data and recommend maintenance actions. Include: likely failure mode, recommended actions, parts needed, estimated repair time."},
                {"role": "user", "content": f"Equipment: {equipment_id}\nRUL: {rul_result['rul_days']} days\nSchedule: {rul_result['schedule']}\nTop indicators:\n" + "\n".join(f"- {k}: {v}" for k, v in top_features)},
            ],
        )
        return {
            "equipment_id": equipment_id,
            "analysis": response.choices[0].message.content,
            "top_indicators": dict(top_features),
        }
```

## Step 6: Deploy Maintenance Scheduler

```python
# scheduler.py — condition-based maintenance scheduling
class MaintenanceScheduler:
    def schedule(self, predictions: list) -> list:
        work_orders = []
        for pred in predictions:
            if pred["schedule"] == "urgent":
                work_orders.append({
                    "equipment_id": pred["equipment_id"],
                    "priority": "P1",
                    "window": "next_24_hours",
                    "type": "corrective",
                    "rul_days": pred["rul_days"],
                })
            elif pred["schedule"] == "planned":
                work_orders.append({
                    "equipment_id": pred["equipment_id"],
                    "priority": "P2",
                    "window": f"next_{pred['rul_days']}_days",
                    "type": "preventive",
                    "rul_days": pred["rul_days"],
                })
        # Sort by urgency, group by location for efficiency
        return sorted(work_orders, key=lambda w: w["rul_days"])
```

## Step 7: Deploy and Verify

```bash
az acr build --registry acrPredMaint --image pred-maintenance:latest .

az containerapp create \
  --name pred-maintenance \
  --resource-group rg-frootai-predictive-maintenance \
  --environment maint-env \
  --image acrPredMaint.azurecr.io/pred-maintenance:latest \
  --target-port 8080 --min-replicas 1 --max-replicas 3

# Test prediction
curl https://pred-maintenance.azurecontainerapps.io/api/predict/pump-001

# Get maintenance schedule
curl https://pred-maintenance.azurecontainerapps.io/api/schedule
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| Sensors telemetry | IoT Hub messages | Data flowing |
| Features extracted | ADX query | Statistical features computed |
| RUL predicted | GET predict endpoint | Days + confidence + schedule |
| Root cause analysis | Check explanation | Failure mode + actions + parts |
| Work orders | GET schedule endpoint | Prioritized maintenance list |
| Urgent alert | Equipment with RUL<7 | P1 work order created |
| Historical accuracy | Backtest | RUL MAE within target |

## Rollback Procedure

```bash
az containerapp revision list --name pred-maintenance \
  --resource-group rg-frootai-predictive-maintenance
az containerapp ingress traffic set --name pred-maintenance \
  --resource-group rg-frootai-predictive-maintenance \
  --revision-weight previousRevision=100
```
