---
name: "deploy-ai-model-governance"
description: "Deploy AI Model Governance — model registry with versioning, multi-stage approval workflows, A/B champion/challenger testing, model cards, lineage tracking, progressive rollout, drift monitoring."
---

# Deploy AI Model Governance

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.MachineLearningServices` (Azure ML workspace + model registry)
  - `Microsoft.CognitiveServices` (Azure OpenAI for governance analysis)
  - `Microsoft.App` (Container Apps for governance API)
  - `Microsoft.KeyVault` (secret management)
- Python 3.11+ with `azure-ai-ml`, `azure-identity`, `openai` packages
- `.env` file with: `AZURE_ML_WORKSPACE`, `AZURE_ML_RESOURCE_GROUP`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`

## Step 1: Provision Governance Infrastructure

```bash
# Create resource group
az group create --name rg-frootai-model-governance --location eastus2

# Deploy infrastructure (ML workspace, OpenAI, Container Apps, Key Vault)
az deployment group create \
  --resource-group rg-frootai-model-governance \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=prod

# Create Azure ML workspace for model registry
az ml workspace create \
  --name ml-model-governance \
  --resource-group rg-frootai-model-governance \
  --location eastus2

az keyvault secret set --vault-name kv-model-gov \
  --name openai-key --value "$AZURE_OPENAI_KEY"
```

## Step 2: Set Up Model Registry

```python
# model_registry.py — centralized model registry with versioning
from azure.ai.ml import MLClient
from azure.ai.ml.entities import Model
from azure.identity import DefaultAzureCredential

class ModelRegistry:
    def __init__(self, config):
        self.ml_client = MLClient(
            credential=DefaultAzureCredential(),
            subscription_id=config["subscription_id"],
            resource_group_name=config["resource_group"],
            workspace_name=config["workspace"],
        )

    def register_model(self, name, version, path, model_card):
        """Register model with full metadata and model card."""
        required = ["purpose", "limitations", "training_data", "evaluation", "risks", "mitigations"]
        missing = [f for f in required if f not in model_card]
        if missing:
            raise ValueError(f"Model card missing: {missing}")

        model = Model(
            name=name, version=version, path=path,
            type="custom_model", description=model_card["purpose"],
            tags={"model_card": "complete", "status": "registered",
                  "eval_accuracy": str(model_card["evaluation"].get("accuracy", "N/A")),
                  "bias_tested": str(model_card.get("bias_testing", {}).get("tested", False))},
            properties={"model_card_json": json.dumps(model_card)},
        )
        return self.ml_client.models.create_or_update(model)
```

Model lifecycle states:
| State | Description | Who Transitions |
|-------|-------------|-----------------|
| **Registered** | Model uploaded + model card submitted | Developer |
| **Under Review** | Eval gate running, bias testing | Automated |
| **Approved** | Human sign-off from ML lead | ML Lead |
| **Staged** | Deployed to staging environment | CI/CD |
| **A/B Testing** | Champion/challenger traffic split | Automated |
| **Production** | 100% traffic, actively monitored | CI/CD |
| **Deprecated** | Successor deployed, traffic draining | ML Lead |
| **Retired** | No traffic, archived | Automated |

## Step 3: Implement Approval Workflow

```python
# approval_workflow.py — multi-stage approval gates
class ApprovalWorkflow:
    async def run_approval(self, model_name, version):
        results = {"model": model_name, "version": version, "stages": {}}

        # Stage 1: Automated evaluation gate
        eval_result = await self.run_eval_gate(model_name, version)
        results["stages"]["eval_gate"] = eval_result
        if not eval_result["passed"]:
            return {**results, "status": "rejected", "reason": "Eval gate failed"}

        # Stage 2: Bias testing across protected attributes
        bias_result = await self.run_bias_testing(model_name, version)
        results["stages"]["bias_testing"] = bias_result
        if not bias_result["passed"]:
            return {**results, "status": "rejected", "reason": "Bias testing failed"}

        # Stage 3: Model card completeness check
        card_result = await self.check_model_card(model_name, version)
        results["stages"]["model_card"] = card_result

        # Stage 4: Human approval request
        approval = await self.create_approval_request(model_name, version, results)
        results["stages"]["human_approval"] = {"status": "pending", "id": approval.id}

        return {**results, "status": "pending_approval"}
```

Approval gate configuration:
| Gate | Type | Criteria | Blocker |
|------|------|----------|---------|
| Eval gate | Automated | Accuracy ≥ threshold, F1 ≥ threshold | Yes |
| Bias testing | Automated | No significant disparity across groups | Yes |
| Model card | Automated | All required fields present | Yes |
| Human review | Manual | ML Lead sign-off | Yes |
| Security scan | Automated | No vulnerabilities in model artifacts | Yes |

## Step 4: Implement A/B Testing

```python
# ab_testing.py — champion/challenger with statistical significance
class ABTestingFramework:
    def __init__(self, config):
        self.initial_split = config.get("initial_split", 0.05)
        self.min_samples = config.get("min_samples", 1000)
        self.significance = config.get("significance", 0.05)

    async def evaluate_ab_test(self, test_id):
        champion = await self.get_metrics("champion")
        challenger = await self.get_metrics("challenger")
        stat, p_value = stats.mannwhitneyu(champion["scores"], challenger["scores"])
        challenger_better = challenger["mean"] > champion["mean"]

        return {
            "p_value": p_value,
            "significant": p_value < self.significance,
            "recommendation": "promote" if p_value < self.significance and challenger_better else "keep_champion",
        }
```

Progressive rollout stages: `5% → 25% → 50% → 100%` with health monitoring at each stage.

## Step 5: Deploy Drift Monitoring

```python
# drift_monitor.py — detect accuracy degradation and data drift
class DriftMonitor:
    def __init__(self, config):
        self.accuracy_threshold = config.get("min_accuracy", 0.85)
        self.psi_threshold = config.get("data_drift_psi", 0.2)

    async def check_drift(self, model_name):
        current = await self.get_recent_metrics(days=7)
        baseline = await self.get_baseline(model_name)
        accuracy_drift = baseline["accuracy"] - current["accuracy"]
        data_psi = self.calculate_psi(baseline["distribution"], current["distribution"])

        return {
            "accuracy_drift": accuracy_drift,
            "data_drift_psi": data_psi,
            "needs_retrain": accuracy_drift > 0.05 or data_psi > self.psi_threshold,
            "alert": accuracy_drift > 0.10,
        }
```

Drift detection types:
| Type | Method | Threshold | Action |
|------|--------|-----------|--------|
| **Accuracy drift** | Compare to baseline accuracy | > 5% drop | Retrain |
| **Data drift** | Population Stability Index (PSI) | PSI > 0.2 | Investigate |
| **Concept drift** | Feature importance shift | Significant change | Retrain |
| **Latency drift** | P95 latency increase | > 50% increase | Scale/optimize |

## Step 6: Deploy Governance API

```bash
az acr build --registry acrModelGov \
  --image model-governance:latest .

az containerapp create \
  --name model-gov \
  --resource-group rg-frootai-model-governance \
  --environment model-gov-env \
  --image acrModelGov.azurecr.io/model-governance:latest \
  --target-port 8080 \
  --min-replicas 1 --max-replicas 3 \
  --secrets openai-key=keyvaultref:kv-model-gov/openai-key \
  --env-vars OPENAI_KEY=secretref:openai-key ML_WORKSPACE=$ML_WORKSPACE
```

## Step 7: Verify Deployment

```bash
curl https://model-gov.azurecontainerapps.io/health

# Register test model
curl -X POST https://model-gov.azurecontainerapps.io/api/models/register \
  -d '{"name": "test-model", "version": "1.0.0", "model_card": {"purpose": "Test", "limitations": "None", "training_data": "synthetic", "evaluation": {"accuracy": 0.95}, "risks": "Low", "mitigations": "Review"}}'

# Trigger approval workflow
curl -X POST https://model-gov.azurecontainerapps.io/api/models/test-model/1.0.0/approve
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| ML workspace | `az ml workspace show` | Active |
| Model registered | Registry query | Model with metadata |
| Approval workflow | Trigger approval | 4 stages execute |
| Eval gate | Below-threshold model | Rejected |
| Bias testing | Submit model | Tested across groups |
| Model card | Incomplete card | Missing fields flagged |
| A/B test | Start test | Traffic split active |
| Progressive rollout | Deploy | 5%→25%→50%→100% |
| Drift monitor | Check endpoint | Metrics returned |
| Rollback | Trigger | Instant revert |
