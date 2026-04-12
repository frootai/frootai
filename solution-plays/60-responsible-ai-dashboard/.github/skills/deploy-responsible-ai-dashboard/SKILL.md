---
name: "deploy-responsible-ai-dashboard"
description: "Deploy Responsible AI Dashboard — centralized fairness monitoring, content safety incident tracking, model card registry, compliance evidence hub, executive scorecards, multi-system aggregation."
---

# Deploy Responsible AI Dashboard

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.CognitiveServices` (Azure OpenAI for report generation)
  - `Microsoft.Insights` (Application Insights for metrics collection)
  - `Microsoft.App` (Container Apps for dashboard API)
  - `Microsoft.Web` (Static Web Apps for dashboard frontend)
  - `Microsoft.DocumentDB` (Cosmos DB for incident tracking + model registry)
  - `Microsoft.KeyVault` (secret management)
- Python 3.11+ with `openai`, `fairlearn`, `azure-monitor-query` packages
- `.env` file with: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `APP_INSIGHTS_CONNECTION`, `COSMOS_CONNECTION`

## Step 1: Provision Infrastructure

```bash
az group create --name rg-frootai-rai-dashboard --location eastus2

az deployment group create \
  --resource-group rg-frootai-rai-dashboard \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=prod

az keyvault secret set --vault-name kv-rai-dashboard \
  --name openai-key --value "$AZURE_OPENAI_KEY"
az keyvault secret set --vault-name kv-rai-dashboard \
  --name cosmos-conn --value "$COSMOS_CONNECTION"
```

## Step 2: Deploy AI System Registry

```python
# system_registry.py — register all AI systems for monitoring
class AISystemRegistry:
    def __init__(self, cosmos_client):
        self.container = cosmos_client.get_container_client("ai-systems")

    async def register_system(self, system: dict):
        """Register an AI system for RAI monitoring."""
        entry = {
            "id": system["name"],
            "name": system["name"],
            "type": system["type"],  # classification, generation, recommendation
            "owner": system["owner"],
            "model": system["model"],
            "deployment_date": system["deployment_date"],
            "risk_level": system["risk_level"],  # high, medium, low (EU AI Act)
            "protected_attributes": system.get("protected_attributes", []),
            "compliance_frameworks": system.get("compliance", []),
            "model_card_url": system.get("model_card_url"),
            "status": "active",
            "monitoring": {
                "fairness": True,
                "safety": True,
                "groundedness": True,
                "explainability": True,
            },
        }
        await self.container.upsert_item(entry)
```

## Step 3: Deploy Fairness Metrics Collector

```python
# fairness_collector.py — collect fairness metrics from all systems
from fairlearn.metrics import MetricFrame, selection_rate, demographic_parity_difference

class FairnessCollector:
    METRICS = {
        "demographic_parity": demographic_parity_difference,
        "selection_rate": selection_rate,
    }

    async def collect(self, system_name: str, predictions, labels, sensitive_features):
        """Compute fairness metrics for an AI system."""
        metric_frame = MetricFrame(
            metrics=self.METRICS,
            y_true=labels,
            y_pred=predictions,
            sensitive_features=sensitive_features,
        )

        results = {
            "system": system_name,
            "timestamp": datetime.utcnow().isoformat(),
            "overall": metric_frame.overall.to_dict(),
            "by_group": metric_frame.by_group.to_dict(),
            "difference": metric_frame.difference().to_dict(),
            "ratio": metric_frame.ratio().to_dict(),
            "status": "pass" if all(v > 0.8 for v in metric_frame.ratio().values()) else "fail",
        }

        # Intersectional analysis
        if len(sensitive_features.columns) > 1:
            results["intersectional"] = self._intersectional_analysis(
                predictions, labels, sensitive_features
            )

        await self.store_metrics(results)
        return results
```

Fairness metrics collected:
| Metric | What It Measures | Threshold | Framework |
|--------|-----------------|-----------|-----------|
| Demographic Parity | Equal selection rates | Diff < 0.1 | EEOC, EU AI Act |
| Equalized Odds | Equal TPR/FPR across groups | Diff < 0.1 | Fairlearn |
| Disparate Impact | Adverse impact ratio | > 0.80 (4/5 rule) | EEOC |
| Calibration | Score = probability per group | Slope 0.9-1.1 | EU AI Act |
| Intersectional | Compounded bias | No group < 0.75 | Best practice |

## Step 4: Deploy Content Safety Incident Tracker

```python
# incident_tracker.py — log and analyze safety incidents
class IncidentTracker:
    async def log_incident(self, incident: dict):
        """Log a content safety incident."""
        entry = {
            "id": f"INC-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            "system": incident["system"],
            "timestamp": datetime.utcnow().isoformat(),
            "severity": incident["severity"],  # critical, high, medium, low
            "category": incident["category"],  # violence, hate, sexual, self_harm, PII_leak
            "description": incident["description"],
            "user_impact": incident.get("user_impact", "none"),
            "root_cause": incident.get("root_cause"),
            "remediation": incident.get("remediation"),
            "status": "open",  # open, investigating, resolved, accepted_risk
        }
        await self.cosmos.upsert_item(entry)

        # Alert if critical
        if incident["severity"] == "critical":
            await self.send_alert(entry, channels=["teams", "email", "pagerduty"])
```

## Step 5: Deploy Compliance Evidence Hub

```python
# compliance_hub.py — evidence-based compliance tracking
class ComplianceHub:
    FRAMEWORKS = {
        "eu_ai_act": {
            "articles": ["Article 6 (Risk Classification)", "Article 9 (Risk Management)",
                        "Article 13 (Transparency)", "Article 14 (Human Oversight)"],
            "evidence_required": ["risk_assessment", "transparency_report", "human_oversight_log", "technical_doc"],
        },
        "eeoc": {
            "requirements": ["disparate_impact_test", "adverse_action_notice", "bias_audit"],
            "evidence_required": ["fairness_test_results", "audit_report"],
        },
        "nist_ai_rmf": {
            "functions": ["Govern", "Map", "Measure", "Manage"],
            "evidence_required": ["governance_doc", "risk_profile", "metrics_log", "incident_log"],
        },
    }

    async def assess_compliance(self, system_name: str) -> dict:
        """Check compliance evidence for a registered system."""
        system = await self.registry.get_system(system_name)
        results = {}
        for framework in system["compliance_frameworks"]:
            if framework in self.FRAMEWORKS:
                evidence = await self.check_evidence(system_name, self.FRAMEWORKS[framework])
                results[framework] = {
                    "status": "compliant" if all(evidence.values()) else "gaps_found",
                    "evidence": evidence,
                    "gaps": [k for k, v in evidence.items() if not v],
                }
        return results
```

## Step 6: Deploy Executive Summary Generator

```python
# executive_summary.py — LLM-generated RAI report for non-technical stakeholders
class ExecutiveSummaryGenerator:
    async def generate(self, dashboard_data: dict) -> str:
        response = await self.openai.chat.completions.create(
            model="gpt-4o", temperature=0.3,
            messages=[
                {"role": "system", "content": "Generate an executive summary of AI system health. Use traffic-light (red/yellow/green) for each system. Non-technical language. 1 page max."},
                {"role": "user", "content": f"Dashboard data:\n{json.dumps(dashboard_data, indent=2)[:4000]}"},
            ],
        )
        return response.choices[0].message.content
```

## Step 7: Deploy Dashboard Frontend

```bash
# Deploy Static Web Apps for dashboard UI
az staticwebapp create \
  --name rai-dashboard-ui \
  --resource-group rg-frootai-rai-dashboard \
  --source https://github.com/frootai/rai-dashboard \
  --branch main \
  --app-location "/frontend" \
  --api-location "/api"

# Deploy API backend
az containerapp create \
  --name rai-dashboard-api \
  --resource-group rg-frootai-rai-dashboard \
  --environment rai-env \
  --image acrRAI.azurecr.io/rai-dashboard:latest \
  --target-port 8080 --min-replicas 1 --max-replicas 3 \
  --secrets openai-key=keyvaultref:kv-rai-dashboard/openai-key,cosmos-conn=keyvaultref:kv-rai-dashboard/cosmos-conn
```

## Step 8: Verify Deployment

```bash
curl https://rai-dashboard-api.azurecontainerapps.io/health

# Register a test system
curl -X POST https://rai-dashboard-api.azurecontainerapps.io/api/systems \
  -d '{"name": "customer-classifier", "type": "classification", "owner": "ML team", "model": "gpt-4o", "risk_level": "high", "compliance": ["eu_ai_act", "eeoc"]}'

# Collect fairness metrics
curl -X POST https://rai-dashboard-api.azurecontainerapps.io/api/fairness/customer-classifier

# Generate executive summary
curl https://rai-dashboard-api.azurecontainerapps.io/api/summary
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| System registered | POST system | Entry in Cosmos DB |
| Fairness collected | Trigger collection | Demographic parity + equalized odds |
| Intersectional analysis | Multi-attribute test | Compound group results |
| Incident logged | POST incident | Entry with severity + status |
| Critical alert | Log critical incident | Teams/email notification |
| Compliance check | GET compliance | Evidence gaps identified |
| Executive summary | GET summary | Traffic-light per system |
| Dashboard UI | Open frontend | Systems listed with scores |
| Model card linked | Check registration | model_card_url present |

## Rollback Procedure

```bash
az containerapp revision list --name rai-dashboard-api \
  --resource-group rg-frootai-rai-dashboard
az containerapp ingress traffic set --name rai-dashboard-api \
  --resource-group rg-frootai-rai-dashboard \
  --revision-weight previousRevision=100
```
