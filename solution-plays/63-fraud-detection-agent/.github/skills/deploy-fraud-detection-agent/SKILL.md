---
name: "deploy-fraud-detection-agent"
description: "Deploy Fraud Detection Agent — three-layer detection (rules <1ms, ML <50ms, graph analysis), explainable decisions (PSD2), fraud ring network analysis, velocity checks, analyst feedback loop."
---

# Deploy Fraud Detection Agent

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.CognitiveServices` (Azure OpenAI for explanation generation)
  - `Microsoft.DocumentDB` (Cosmos DB Gremlin for fraud graph + audit trail)
  - `Microsoft.EventHub` (transaction stream ingestion)
  - `Microsoft.App` (Container Apps for detection API)
  - `Microsoft.KeyVault` (secret management)
- Python 3.11+ with `openai`, `scikit-learn`, `gremlinpython`, `azure-eventhub` packages
- `.env` file with: `AZURE_OPENAI_KEY`, `COSMOS_GREMLIN_ENDPOINT`, `COSMOS_GREMLIN_KEY`, `EVENTHUB_CONNECTION`

## Step 1: Provision Infrastructure

```bash
az group create --name rg-frootai-fraud-detection --location eastus2

az deployment group create \
  --resource-group rg-frootai-fraud-detection \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=prod

az keyvault secret set --vault-name kv-fraud-detect \
  --name openai-key --value "$AZURE_OPENAI_KEY"
az keyvault secret set --vault-name kv-fraud-detect \
  --name gremlin-key --value "$COSMOS_GREMLIN_KEY"
```

## Step 2: Deploy Three-Layer Detection Pipeline

### Layer 1: Rule Engine (<1ms)
```python
class FraudRuleEngine:
    def __init__(self, config):
        self.rules = config["rules"]

    def check(self, txn: dict) -> list:
        flags = []
        # Velocity: >5 transactions in 1 minute
        if txn["velocity_1min"] > self.rules["velocity_max_1min"]:
            flags.append({"rule": "velocity", "detail": f"{txn['velocity_1min']} txns in 1 min"})
        # Amount: >3x average for this account
        if txn["amount"] > txn["avg_amount"] * self.rules["amount_multiplier"]:
            flags.append({"rule": "amount_spike", "detail": f"${txn['amount']} vs avg ${txn['avg_amount']}"})
        # Geo-impossible: two countries <2 hours apart
        if txn.get("geo_impossible"):
            flags.append({"rule": "geo_impossible", "detail": f"{txn['last_country']} → {txn['country']} in {txn['time_gap_min']} min"})
        # New device + high amount
        if txn.get("new_device") and txn["amount"] > self.rules["new_device_limit"]:
            flags.append({"rule": "new_device_high_amount", "detail": f"New device, ${txn['amount']}"})
        return flags
```

### Layer 2: ML Model (<50ms)
```python
class FraudMLModel:
    def __init__(self, model_path):
        self.model = joblib.load(model_path)
        self.feature_names = self.model.feature_names_in_

    def predict(self, txn: dict) -> dict:
        features = self.extract_features(txn)
        proba = self.model.predict_proba([features])[0][1]  # Fraud probability
        shap_values = self.explainer.shap_values([features])

        return {
            "score": proba,
            "top_features": self.get_top_features(shap_values, k=5),
            "tier": "block" if proba > 0.9 else "review" if proba > 0.7 else "allow",
        }
```

### Layer 3: Graph Analysis (fraud rings)
```python
class FraudGraphAnalyzer:
    def __init__(self, gremlin_client):
        self.client = gremlin_client

    async def analyze(self, sender: str, receiver: str) -> dict:
        # Check for fraud ring patterns
        ring = await self.client.submit(f"""
            g.V('{sender}').repeat(out('transfers_to')).until(
                has('id', '{receiver}').or().loops().is(5)
            ).path().by('id')
        """)

        # Check mule account indicators
        mule_score = await self.check_mule_patterns(receiver)

        # Check coordinated attack (multiple senders → same receiver in window)
        coordinated = await self.check_coordinated(receiver, window_minutes=30)

        return {
            "ring_detected": len(ring) > 0,
            "ring_path": ring[0] if ring else None,
            "mule_score": mule_score,
            "coordinated_attack": coordinated["is_coordinated"],
            "related_accounts": coordinated.get("account_count", 0),
        }
```

Graph patterns detected:
| Pattern | Description | Detection Method |
|---------|-------------|-----------------|
| **Ring** | A→B→C→D→A circular transfers | Cycle detection in Gremlin |
| **Mule** | Account receives from many, withdraws fast | In-degree + withdrawal velocity |
| **Coordinated** | Multiple senders → same receiver in short window | Temporal aggregation |
| **Layering** | Rapid series of small transfers to obscure origin | Path length + amount pattern |

## Step 3: Deploy Transaction Stream Processing

```bash
# Event Hub for real-time transaction ingestion
az eventhubs namespace create \
  --name eh-fraud-detection \
  --resource-group rg-frootai-fraud-detection \
  --sku Standard --capacity 2

az eventhubs eventhub create \
  --name transactions \
  --namespace-name eh-fraud-detection \
  --resource-group rg-frootai-fraud-detection \
  --partition-count 8
```

## Step 4: Deploy Explainable Decision Output

```python
class FraudExplainer:
    async def explain(self, rule_flags, ml_result, graph_result) -> str:
        factors = []
        if rule_flags:
            factors.extend([f"Rule violation: {f['rule']} — {f['detail']}" for f in rule_flags])
        if ml_result["score"] > 0.5:
            factors.extend([f"ML indicator: {f}" for f in ml_result["top_features"][:3]])
        if graph_result.get("ring_detected"):
            factors.append(f"Network pattern: fraud ring detected ({graph_result['ring_path']})")
        if graph_result.get("coordinated_attack"):
            factors.append(f"Coordinated: {graph_result['related_accounts']} accounts targeting same receiver")

        return {
            "decision_factors": factors,
            "combined_score": self.combine_scores(rule_flags, ml_result, graph_result),
            "regulatory_notice": "Decision made per PSD2 Art. 70 requirements. Factors available for customer review.",
        }
```

## Step 5: Deploy Analyst Feedback Loop

```python
class FeedbackLoop:
    async def submit_analyst_decision(self, txn_id, decision, analyst_id):
        """Analyst confirms or overrides fraud decision."""
        await self.cosmos.upsert_item({
            "txn_id": txn_id,
            "analyst_decision": decision,  # "confirmed_fraud", "false_positive", "escalate"
            "analyst_id": analyst_id,
            "timestamp": datetime.utcnow().isoformat(),
        })
        # Queue for model retraining
        if decision in ["confirmed_fraud", "false_positive"]:
            await self.retrain_queue.send({"txn_id": txn_id, "label": decision})
```

## Step 6: Deploy and Verify

```bash
az acr build --registry acrFraud --image fraud-detection:latest .

az containerapp create \
  --name fraud-detection \
  --resource-group rg-frootai-fraud-detection \
  --environment fraud-env \
  --image acrFraud.azurecr.io/fraud-detection:latest \
  --target-port 8080 --min-replicas 2 --max-replicas 10

# Test
curl -X POST https://fraud-detection.azurecontainerapps.io/api/detect \
  -d '{"sender": "acct-001", "receiver": "acct-999", "amount": 5000, "velocity_1min": 7}'
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| Rule engine | Velocity violation | Flagged <1ms |
| ML scoring | Normal transaction | Score + top features |
| Graph analysis | Known ring accounts | Ring detected |
| Combined decision | Multi-layer result | block/review/allow + explanation |
| Explanation | Check decision_factors | Regulatory-compliant factors |
| Latency (rules+ML) | Benchmark | < 50ms combined |
| Feedback loop | Analyst confirms fraud | Queued for retraining |
| Event Hub | Send transactions | Real-time processing |

## Rollback Procedure

```bash
az containerapp revision list --name fraud-detection \
  --resource-group rg-frootai-fraud-detection
az containerapp ingress traffic set --name fraud-detection \
  --resource-group rg-frootai-fraud-detection \
  --revision-weight previousRevision=100
```
