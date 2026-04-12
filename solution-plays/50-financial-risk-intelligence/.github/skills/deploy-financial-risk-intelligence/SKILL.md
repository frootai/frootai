---
name: "deploy-financial-risk-intelligence"
description: "Deploy Financial Risk Intelligence — explainable credit risk scoring, real-time fraud detection (rules→ML→LLM), market sentiment analysis, regulatory reporting (ECOA/GDPR/Basel III), audit trails."
---

# Deploy Financial Risk Intelligence

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.CognitiveServices` (Azure OpenAI for risk analysis)
  - `Microsoft.DocumentDB` (Cosmos DB for audit trail + risk data)
  - `Microsoft.App` (Container Apps for risk engine)
  - `Microsoft.KeyVault` (secret management)
  - `Microsoft.EventHub` (real-time transaction streaming)
- Python 3.11+ with `openai`, `scikit-learn`, `shap`, `azure-cosmos` packages
- `.env` file with: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `COSMOS_CONNECTION`, `EVENTHUB_CONNECTION`

## Step 1: Provision Risk Infrastructure

```bash
# Create resource group
az group create --name rg-frootai-financial-risk --location eastus2

# Deploy infrastructure (OpenAI, Cosmos DB, Event Hubs, Container Apps, Key Vault)
az deployment group create \
  --resource-group rg-frootai-financial-risk \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=prod

# Store secrets
az keyvault secret set --vault-name kv-financial-risk \
  --name openai-key --value "$AZURE_OPENAI_KEY"
az keyvault secret set --vault-name kv-financial-risk \
  --name cosmos-conn --value "$COSMOS_CONNECTION"
```

## Step 2: Deploy Explainable Credit Risk Scoring

```python
# credit_risk.py — structured, explainable risk scoring
from pydantic import BaseModel, Field
from openai import AzureOpenAI
import json

class RiskFactor(BaseModel):
    factor: str          # "high_debt_to_income_ratio"
    impact: str          # "negative" or "positive"
    weight: float        # 0.0-1.0
    explanation: str     # "Debt-to-income ratio of 45% exceeds 36% guideline"

class CreditRiskScore(BaseModel):
    score: int = Field(ge=300, le=850)
    risk_level: str      # low, medium, high, very_high
    factors: list[RiskFactor]
    recommendation: str  # approve, review, decline
    confidence: float
    regulatory_notice: str  # ECOA adverse action notice if applicable

class CreditRiskEngine:
    def __init__(self, config):
        self.client = AzureOpenAI(
            azure_endpoint=config["endpoint"],
            api_version="2024-08-06",
        )
        self.model = config.get("model", "gpt-4o")

    async def score_applicant(self, applicant: dict) -> CreditRiskScore:
        """Generate explainable credit risk score with regulatory compliance."""
        response = await self.client.chat.completions.create(
            model=self.model,
            temperature=0,  # Deterministic for financial decisions
            seed=42,        # Reproducible scoring
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": CREDIT_RISK_SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(applicant)},
            ],
        )
        score = CreditRiskScore.model_validate_json(response.choices[0].message.content)

        # Log audit trail (regulatory requirement)
        await self.log_decision(applicant["id"], score)

        # Add ECOA adverse action notice if declining
        if score.recommendation == "decline":
            score.regulatory_notice = self._generate_adverse_action_notice(score.factors)

        return score
```

Explainability requirements by regulation:
| Regulation | Requirement | Implementation |
|-----------|-------------|---------------|
| **ECOA** (US) | Adverse action reasons | Top 4 factors in human-readable format |
| **GDPR Art.22** | Right to explanation | Full reasoning chain + factor weights |
| **Basel III** | Model validation | Model card, version, test results |
| **SOX** | Data integrity | Immutable audit trail in Cosmos DB |
| **Fair Lending** | No disparate impact | Bias testing across protected attributes |

## Step 3: Deploy Real-Time Fraud Detection

```python
# fraud_detector.py — three-tier fraud detection (rules→ML→LLM)
class FraudDetector:
    def __init__(self, config):
        self.rule_engine = FraudRuleEngine(config["rules"])
        self.ml_model = load_model(config["ml_model_path"])
        self.llm_client = AzureOpenAI(azure_endpoint=config["endpoint"])
        self.thresholds = config["thresholds"]

    async def detect(self, transaction: dict) -> FraudResult:
        """Three-tier fraud detection: rules (1ms) → ML (10ms) → LLM (500ms)."""
        # Tier 1: Rule-based checks (instant, deterministic)
        rule_flags = self.rule_engine.check(transaction)
        if rule_flags:
            return FraudResult(action="block", confidence=0.99,
                             reason=f"Rule violation: {rule_flags[0]}", tier="rules")

        # Tier 2: ML model scoring (fast, statistical patterns)
        ml_score = self.ml_model.predict_proba(self._extract_features(transaction))
        if ml_score > self.thresholds["ml_block"]:
            return FraudResult(action="block", confidence=ml_score, tier="ml")
        if ml_score < self.thresholds["ml_allow"]:
            return FraudResult(action="allow", confidence=1-ml_score, tier="ml")

        # Tier 3: LLM analysis (expensive, only for uncertain zone)
        llm_result = await self._llm_analyze(transaction)
        return FraudResult(action=llm_result["action"],
                         confidence=llm_result["confidence"], tier="llm")
```

Fraud detection tiers:
| Tier | Method | Latency | Cost | When Used |
|------|--------|---------|------|-----------|
| Rules | Velocity, amount, geo-impossible | < 1ms | Free | Every transaction |
| ML | Gradient boosted model | < 10ms | Free (local) | After rules pass |
| LLM | GPT-4o contextual analysis | < 500ms | ~$0.01 | ML uncertain zone only (5-10%) |

## Step 4: Deploy Market Sentiment Analysis

```python
# sentiment.py — market sentiment from news and filings
class MarketSentimentAnalyzer:
    async def analyze_sentiment(self, entity: str, sources: list) -> dict:
        """Analyze market sentiment for risk assessment."""
        response = await self.client.chat.completions.create(
            model="gpt-4o",
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "Analyze market sentiment. Return: sentiment (bullish/bearish/neutral), confidence, key_factors, risk_events."},
                {"role": "user", "content": f"Entity: {entity}\nSources: {json.dumps(sources)}"},
            ],
        )
        return json.loads(response.choices[0].message.content)
```

## Step 5: Deploy Audit Trail

```python
# audit.py — immutable, SOX-compliant audit logging
from azure.cosmos.aio import CosmosClient
from datetime import datetime, timezone

class AuditTrailLogger:
    def __init__(self, config):
        self.client = CosmosClient(config["cosmos_endpoint"], config["cosmos_key"])
        self.db = self.client.get_database_client("financial-risk")
        self.container = self.db.get_container_client("audit-trail")

    async def log_decision(self, decision: dict):
        """Log immutable audit entry with full decision context."""
        entry = {
            "id": f"audit-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "decision_type": decision["type"],  # credit_risk, fraud, sentiment
            "input_hash": self._hash_input(decision["input"]),  # Don't store raw PII
            "model_version": decision["model_version"],
            "score": decision["score"],
            "factors": decision["factors"],
            "action": decision["action"],
            "confidence": decision["confidence"],
            "regulatory_framework": decision.get("regulation", "ECOA"),
            "_immutable": True,  # Cosmos DB TTL disabled — never delete
        }
        await self.container.create_item(entry)
```

## Step 6: Deploy Container Apps Risk Engine

```bash
az acr build --registry acrFinRisk \
  --image financial-risk-engine:latest .

az containerapp create \
  --name financial-risk-engine \
  --resource-group rg-frootai-financial-risk \
  --environment fin-risk-env \
  --image acrFinRisk.azurecr.io/financial-risk-engine:latest \
  --target-port 8080 \
  --min-replicas 2 --max-replicas 10 \
  --cpu 2 --memory 4Gi \
  --secrets openai-key=keyvaultref:kv-financial-risk/openai-key,cosmos-conn=keyvaultref:kv-financial-risk/cosmos-conn \
  --env-vars OPENAI_KEY=secretref:openai-key COSMOS_CONN=secretref:cosmos-conn
```

## Step 7: Verify Deployment

```bash
# Health check
curl https://financial-risk-engine.azurecontainerapps.io/health

# Test credit risk scoring
curl -X POST https://financial-risk-engine.azurecontainerapps.io/api/credit-risk \
  -d '{"id": "test-001", "income": 75000, "debt": 25000, "credit_history_years": 8, "payment_history": "good"}'

# Test fraud detection
curl -X POST https://financial-risk-engine.azurecontainerapps.io/api/fraud-detect \
  -d '{"transaction_id": "txn-001", "amount": 5000, "merchant": "online_electronics", "location": "US", "velocity_24h": 3}'

# Verify audit trail
curl https://financial-risk-engine.azurecontainerapps.io/api/audit/recent
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| Risk engine healthy | `curl /health` | 200 OK |
| Credit score explainable | Score request | Score + 4+ factors + recommendation |
| ECOA adverse notice | Decline scenario | Adverse action reasons generated |
| Fraud rules | Velocity violation | Blocked at tier 1 |
| Fraud ML | Moderate risk | Score + confidence |
| Fraud LLM | Edge case | Contextual analysis in uncertain zone |
| Audit trail | Check Cosmos DB | Immutable entries with timestamps |
| No PII in audit | Inspect entries | Input hashed, no raw PII |
| Latency (fraud) | Benchmark | < 100ms for rules+ML tier |
| Key Vault access | Managed identity | Secrets resolved |

## Rollback Procedure

```bash
az containerapp revision list --name financial-risk-engine \
  --resource-group rg-frootai-financial-risk
az containerapp ingress traffic set --name financial-risk-engine \
  --resource-group rg-frootai-financial-risk \
  --revision-weight previousRevision=100
```
