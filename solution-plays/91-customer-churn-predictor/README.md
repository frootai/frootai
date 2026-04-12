# Play 91 — Customer Churn Predictor 📉

> AI churn prediction — multi-signal risk scoring, SHAP explainability, segment-specific retention, automated intervention workflows.

Build a customer churn prediction system. LightGBM scores risk from 4 signal categories (usage, engagement, billing, support), SHAP explains top 3 churn drivers per customer, segment-specific retention playbooks auto-trigger personalized interventions, and LLM personalizes retention messaging.

## Quick Start
```bash
cd solution-plays/91-customer-churn-predictor
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .
# Use @builder to implement, @reviewer to audit, @tuner to optimize
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure ML | Churn model training + daily batch scoring |
| Azure OpenAI (gpt-4o) | Retention message personalization |
| Cosmos DB (Serverless) | Customer profiles, risk scores, action history |
| Event Hubs | Real-time usage event streaming |
| Azure Functions | Risk score triggers + retention orchestration |
| Communication Services | Email/SMS retention campaign delivery |

## Pre-Tuned Defaults
- Risk: High >0.70 · Medium 0.40-0.70 · Low <0.40 · daily scoring for high risk
- Features: 4 signal groups (usage, engagement, billing, support) · 30 max features · SHAP top 3
- Retention: 5 playbooks (price-sensitive, feature-gap, support, engagement, contract) · budget caps
- Model: LightGBM · scale_pos_weight for class imbalance · weekly retrain

## DevKit (AI-Assisted Development)
| Primitive | What It Does |
|-----------|-------------|
| `agent.md` | Root orchestrator with builder→reviewer→tuner handoffs |
| `copilot-instructions.md` | Churn domain (signals, explainability, retention playbooks) |
| 3 agents | Builder (gpt-4o), Reviewer (gpt-4o-mini), Tuner (gpt-4o-mini) |
| 3 skills | Deploy (215+ lines), Evaluate (115+ lines), Tune (225+ lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` with agent routing |

## Cost Estimate
| Environment | Monthly |
|-------------|---------|
| Dev/Test | $65–100 |
| Production (10K customers) | $90–150 |

## vs. Play 64 (AI Sales Assistant)
| Aspect | Play 64 | Play 91 |
|--------|---------|---------|
| Focus | New customer acquisition | Existing customer retention |
| Model | Lead scoring + opportunity | Churn risk + retention action |
| Action | Personalized sales outreach | Segment-specific retention playbook |
| Metric | Win rate + pipeline | AUC-ROC + retention lift + ROI |

📖 [Full documentation](spec/README.md) · 🌐 [frootai.dev/solution-plays/91-customer-churn-predictor](https://frootai.dev/solution-plays/91-customer-churn-predictor) · 📦 [FAI Protocol](spec/fai-manifest.json)
