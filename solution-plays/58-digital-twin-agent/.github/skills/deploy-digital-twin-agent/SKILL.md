---
name: "deploy-digital-twin-agent"
description: "Deploy Digital Twin Agent — Azure Digital Twins with DTDL models, IoT Hub sensor ingestion, NL→DTDL query translation, predictive maintenance (RUL), twin graph relationships, event-driven updates."
---

# Deploy Digital Twin Agent

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.DigitalTwins` (Azure Digital Twins)
  - `Microsoft.Devices` (IoT Hub for sensor data)
  - `Microsoft.CognitiveServices` (Azure OpenAI for NL queries + predictions)
  - `Microsoft.Kusto` (ADX for telemetry archive)
  - `Microsoft.App` (Container Apps for agent API)
  - `Microsoft.KeyVault` (secret management)
- Python 3.11+ with `azure-digitaltwins-core`, `azure-iot-hub`, `openai`, `azure-kusto-data` packages
- `.env` file with: `ADT_ENDPOINT`, `IOTHUB_CONNECTION`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`

## Step 1: Provision Infrastructure

```bash
az group create --name rg-frootai-digital-twin --location eastus2

az deployment group create \
  --resource-group rg-frootai-digital-twin \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=prod

az keyvault secret set --vault-name kv-digital-twin \
  --name openai-key --value "$AZURE_OPENAI_KEY"
```

## Step 2: Deploy Azure Digital Twins

```bash
# Create Digital Twins instance
az dt create --dt-name dt-factory-twin \
  --resource-group rg-frootai-digital-twin \
  --location eastus2

# Assign Data Owner role
az dt role-assignment create \
  --dt-name dt-factory-twin \
  --assignee $USER_OBJECT_ID \
  --role "Azure Digital Twins Data Owner"
```

## Step 3: Define DTDL Models

```json
// models/machine.json — DTDL model for factory machine
{
  "@id": "dtmi:frootai:factory:Machine;1",
  "@type": "Interface",
  "displayName": "Factory Machine",
  "contents": [
    { "@type": "Property", "name": "machineId", "schema": "string" },
    { "@type": "Property", "name": "status", "schema": { "@type": "Enum", "valueSchema": "string", "enumValues": [{"name": "running"}, {"name": "idle"}, {"name": "maintenance"}, {"name": "fault"}] }},
    { "@type": "Telemetry", "name": "temperature", "schema": "double" },
    { "@type": "Telemetry", "name": "vibration", "schema": "double" },
    { "@type": "Telemetry", "name": "powerConsumption", "schema": "double" },
    { "@type": "Property", "name": "lastMaintenanceDate", "schema": "dateTime" },
    { "@type": "Property", "name": "predictedRUL", "schema": "integer", "description": "Remaining Useful Life in days" },
    { "@type": "Relationship", "name": "locatedIn", "target": "dtmi:frootai:factory:Floor;1" },
    { "@type": "Relationship", "name": "feeds", "target": "dtmi:frootai:factory:Machine;1" }
  ]
}
```

Upload models and create twin instances:
```bash
# Upload DTDL models
az dt model create --dt-name dt-factory-twin \
  --models models/machine.json models/floor.json models/building.json

# Create twin instances
az dt twin create --dt-name dt-factory-twin \
  --dtmi "dtmi:frootai:factory:Machine;1" \
  --twin-id machine-001 \
  --properties '{"machineId": "M-001", "status": "running"}'

# Create relationships
az dt twin relationship create --dt-name dt-factory-twin \
  --source machine-001 --target floor-1 \
  --relationship locatedIn --relationship-id rel-001
```

## Step 4: Deploy IoT Hub Sensor Ingestion

```bash
# Create IoT Hub
az iot hub create --name iot-factory-sensors \
  --resource-group rg-frootai-digital-twin \
  --sku S1 --partition-count 4

# Register device
az iot hub device-identity create \
  --hub-name iot-factory-sensors --device-id sensor-machine-001

# Route IoT messages to Digital Twins via Azure Functions
az functionapp create \
  --name fn-iot-to-twins \
  --resource-group rg-frootai-digital-twin \
  --consumption-plan-location eastus2 \
  --runtime python --runtime-version 3.11
```

Sensor data flow:
```
IoT Device → IoT Hub → Event Grid → Azure Function → Digital Twins (twin update)
                                                    → ADX (telemetry archive)
```

## Step 5: Deploy NL→DTDL Query Engine

```python
# nl_query.py — natural language to DTDL translation
class NLTwinQuery:
    def __init__(self, config):
        self.openai = AzureOpenAI(azure_endpoint=config["endpoint"])
        self.twins_client = DigitalTwinsClient(config["adt_endpoint"], DefaultAzureCredential())
        self.schema = self._load_twin_schema()

    async def query(self, question: str) -> dict:
        # 1. Translate NL to DTDL query
        dtdl = await self.openai.chat.completions.create(
            model="gpt-4o", temperature=0,
            messages=[
                {"role": "system", "content": f"Convert natural language to Azure Digital Twins DTDL query.\nSchema:\n{self.schema}\nReturn ONLY the query string."},
                {"role": "user", "content": question},
            ],
        )
        query_str = dtdl.choices[0].message.content.strip()

        # 2. Execute query
        results = list(self.twins_client.query_twins(query_str))

        # 3. LLM summarizes results
        summary = await self.summarize_results(question, results)

        return {"query": query_str, "results": results, "summary": summary, "count": len(results)}
```

Example queries:
| Natural Language | DTDL Query |
|-----------------|------------|
| "Which machines are overheating?" | `SELECT * FROM digitaltwins T WHERE T.temperature > 80` |
| "Show all machines on Floor 1" | `SELECT M FROM digitaltwins M JOIN F RELATED M.locatedIn WHERE F.$dtId = 'floor-1'` |
| "What's the status of machine M-001?" | `SELECT * FROM digitaltwins T WHERE T.machineId = 'M-001'` |

## Step 6: Deploy Predictive Maintenance

```python
# predictive_maintenance.py — RUL prediction with LLM explanation
class PredictiveMaintenance:
    async def predict_rul(self, twin_id: str) -> dict:
        # Get 30 days of telemetry from ADX
        telemetry = await self.adx_client.query(
            f"SensorData | where TwinId == '{twin_id}' | where Timestamp > ago(30d)"
        )

        # ML model predicts Remaining Useful Life
        features = self.extract_features(telemetry)
        rul = self.rul_model.predict(features)

        # LLM explains the prediction
        explanation = await self.openai.chat.completions.create(
            model="gpt-4o", temperature=0.2,
            messages=[
                {"role": "system", "content": "Explain predictive maintenance prediction. Include: key indicators, recommended actions, urgency level."},
                {"role": "user", "content": f"Machine: {twin_id}\nRUL: {rul['days']} days\nTop factors: {rul['features']}\nTelemetry trends: {rul['trends']}"},
            ],
        )

        # Update twin with prediction
        await self.twins_client.update_digital_twin(twin_id, [
            {"op": "replace", "path": "/predictedRUL", "value": rul["days"]}
        ])

        return {"twin_id": twin_id, "rul_days": rul["days"], "confidence": rul["confidence"],
                "explanation": explanation.choices[0].message.content, "urgency": "high" if rul["days"] < 7 else "normal"}
```

## Step 7: Verify Deployment

```bash
curl https://digital-twin-agent.azurecontainerapps.io/health

# Test NL query
curl -X POST https://digital-twin-agent.azurecontainerapps.io/api/query \
  -d '{"question": "Which machines have high vibration levels?"}'

# Test predictive maintenance
curl https://digital-twin-agent.azurecontainerapps.io/api/predict/machine-001

# Test twin state
curl https://digital-twin-agent.azurecontainerapps.io/api/twin/machine-001
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| ADT instance active | `az dt show` | Running |
| DTDL models uploaded | `az dt model list` | Machine, Floor, Building |
| Twin instances created | `az dt twin query` | Twins with properties |
| Relationships set | `az dt twin relationship list` | locatedIn, feeds |
| IoT telemetry flowing | Check ADX | Recent sensor data |
| NL→DTDL query | Ask "overheating machines" | Returns DTDL + results |
| Predictive maintenance | GET predict endpoint | RUL + explanation |
| Twin updated | Check predictedRUL | Updated with prediction |
| Graph traversal | Query across relationships | Floor→Machines found |

## Rollback Procedure

```bash
az containerapp revision list --name digital-twin-agent \
  --resource-group rg-frootai-digital-twin
az containerapp ingress traffic set --name digital-twin-agent \
  --resource-group rg-frootai-digital-twin \
  --revision-weight previousRevision=100
```
