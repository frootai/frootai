---
name: "deploy-customer-churn-predictor"
description: "Deploy Customer Churn Predictor — multi-signal risk scoring, SHAP explainability, segment-specific retention workflows, cohort analysis, LTV optimization."
---

# Deploy Customer Churn Predictor

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- Customer data (usage, billing, support tickets — ≥12 months history)
- Python 3.11+ with `azure-openai`, `lightgbm`, `shap`, `pandas`

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-churn \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure ML | Churn model training + batch scoring | Compute on-demand |
| Azure OpenAI | Retention message personalization | S0 |
| Cosmos DB | Customer profiles, risk scores, action history | Serverless |
| Event Hubs | Real-time usage event streaming | Standard |
| Azure Functions | Risk score triggers + retention workflow orchestration | Consumption |
| Azure Communication Services | Email/SMS retention campaign delivery | Pay-as-you-go |
| Container Apps | Churn dashboard API | Consumption |
| Azure Key Vault | API keys + CRM credentials | Standard |

## Step 2: Build Feature Engineering Pipeline

```python
# Churn signal categories
FEATURE_GROUPS = {
    "usage_signals": {
        "login_frequency_7d": "Logins in last 7 days",
        "login_frequency_30d": "Logins in last 30 days",
        "login_trend_pct": "% change in login frequency (30d vs prior 30d)",
        "feature_adoption_pct": "% of product features used",
        "session_duration_avg_min": "Average session length",
        "api_calls_30d": "API calls (for B2B SaaS)",
        "inactive_days": "Days since last activity"
    },
    "engagement_signals": {
        "email_open_rate_30d": "Email open rate last 30 days",
        "email_open_trend": "Open rate trend (declining?)",
        "nps_score": "Latest NPS score",
        "nps_trend": "NPS trend over 6 months",
        "community_posts_30d": "Community/forum activity",
        "webinar_attendance": "Attended recent webinars"
    },
    "billing_signals": {
        "payment_delay_count_90d": "Late payments in 90 days",
        "downgrade_requested": "Requested plan downgrade",
        "contract_days_remaining": "Days until contract end",
        "billing_disputes": "Active billing disputes",
        "discount_applied": "Currently on promotional pricing"
    },
    "support_signals": {
        "tickets_open": "Currently open support tickets",
        "tickets_90d": "Total tickets in 90 days",
        "avg_resolution_hours": "Average ticket resolution time",
        "escalations_90d": "Ticket escalations",
        "csat_score": "Customer satisfaction score"
    }
}

async def build_features(customer_id: str) -> dict:
    """Build churn prediction features from multiple data sources."""
    usage = await get_usage_data(customer_id, days=90)
    engagement = await get_engagement_data(customer_id)
    billing = await get_billing_data(customer_id)
    support = await get_support_data(customer_id, days=90)
    
    features = {}
    features.update(compute_usage_features(usage))
    features.update(compute_engagement_features(engagement))
    features.update(compute_billing_features(billing))
    features.update(compute_support_features(support))
    
    return features
```

## Step 3: Train Churn Model

```python
import lightgbm as lgb
import shap

# Train gradient boosting classifier
model = lgb.LGBMClassifier(
    n_estimators=300, max_depth=6, learning_rate=0.05,
    num_leaves=63, min_child_samples=20,
    scale_pos_weight=len(y_train[y_train==0]) / len(y_train[y_train==1]),  # Handle class imbalance
    subsample=0.8, colsample_bytree=0.8
)
model.fit(X_train, y_train, eval_set=[(X_val, y_val)], callbacks=[lgb.early_stopping(50)])

# SHAP explainer for top churn drivers
explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test)

# Per-customer explanation
def explain_prediction(customer_features: dict) -> list[str]:
    """Get top 3 drivers for this customer's churn risk."""
    sv = explainer.shap_values(pd.DataFrame([customer_features]))
    top_features = sorted(zip(customer_features.keys(), sv[0]), key=lambda x: abs(x[1]), reverse=True)[:3]
    return [f"{name}: {describe_impact(name, value)}" for name, value in top_features]
```

## Step 4: Deploy Retention Action Engine

```python
RETENTION_PLAYBOOKS = {
    "high_risk_price_sensitive": {
        "actions": ["discount_offer_20pct", "billing_flexibility", "downgrade_option"],
        "channel": "email + call",
        "timing": "within_48_hours",
        "budget_cap_per_customer": 200
    },
    "high_risk_feature_gap": {
        "actions": ["feature_demo_session", "power_user_training", "roadmap_preview"],
        "channel": "email + in_app",
        "timing": "within_72_hours",
        "budget_cap_per_customer": 50
    },
    "high_risk_support_frustrated": {
        "actions": ["escalate_to_csm", "priority_support_30d", "executive_outreach"],
        "channel": "phone + email",
        "timing": "immediate",
        "budget_cap_per_customer": 100
    },
    "medium_risk_engagement_decline": {
        "actions": ["re_engagement_email_series", "usage_tips", "community_invite"],
        "channel": "email",
        "timing": "within_7_days",
        "budget_cap_per_customer": 20
    },
    "contract_expiry_approaching": {
        "actions": ["early_renewal_discount", "annual_review_meeting", "roi_report"],
        "channel": "csm + email",
        "timing": "60_days_before_expiry",
        "budget_cap_per_customer": 500
    }
}

async def recommend_retention(risk_score: float, drivers: list[str], segment: str) -> RetentionAction:
    """Select retention playbook based on risk + drivers + segment."""
    if risk_score < 0.3:
        return RetentionAction(action="monitor", playbook=None)
    
    # Match drivers to playbook
    if any("support" in d or "ticket" in d for d in drivers):
        playbook = RETENTION_PLAYBOOKS["high_risk_support_frustrated"]
    elif any("price" in d or "payment" in d or "billing" in d for d in drivers):
        playbook = RETENTION_PLAYBOOKS["high_risk_price_sensitive"]
    elif any("login" in d or "usage" in d or "feature" in d for d in drivers):
        playbook = RETENTION_PLAYBOOKS["high_risk_feature_gap"]
    elif any("contract" in d for d in drivers):
        playbook = RETENTION_PLAYBOOKS["contract_expiry_approaching"]
    else:
        playbook = RETENTION_PLAYBOOKS["medium_risk_engagement_decline"]
    
    # Personalize message via LLM
    message = await personalize_retention_message(playbook, drivers, segment)
    
    return RetentionAction(action=playbook["actions"][0], message=message, channel=playbook["channel"])
```

## Step 5: Deploy Batch Scoring Pipeline

```bash
# Daily batch scoring of all active customers
python scoring/batch_score.py \
  --model models/churn_v1.pkl \
  --output cosmosdb://churn-scores \
  --trigger-threshold 0.7 \
  --trigger-action retention_workflow
```

## Step 6: Smoke Test

```bash
# Score a single customer
curl -s https://api-churn.azurewebsites.net/api/predict \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"customer_id": "cust-001"}' | jq '.risk_score, .drivers, .recommended_action'

# Get cohort risk distribution
curl -s https://api-churn.azurewebsites.net/api/cohort \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"segment": "enterprise", "period": "Q1-2026"}' | jq '.risk_distribution'

# Trigger retention for high-risk
curl -s https://api-churn.azurewebsites.net/api/retention/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"customer_id": "cust-001", "playbook": "high_risk_support_frustrated"}' | jq '.status'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| AUC < 0.75 | Insufficient features | Add engagement + billing signals, not just usage |
| All customers scored high risk | Threshold too low | Calibrate threshold on holdout set |
| Retention actions not triggered | Function trigger misconfigured | Check Event Hubs connection + threshold |
| SHAP explanations unclear | Raw feature names | Map to human-readable labels |
| Class imbalance (5% churn) | Model predicts "no churn" always | Use scale_pos_weight or SMOTE |
