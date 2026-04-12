---
name: "deploy-ai-sales-assistant"
description: "Deploy AI Sales Assistant — CRM-grounded lead scoring, personalized email generation, call prep with talk tracks, competitive intelligence, deal stage coaching, CRM integration."
---

# Deploy AI Sales Assistant

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.CognitiveServices` (Azure OpenAI for scoring + email gen)
  - `Microsoft.App` (Container Apps for sales API)
  - `Microsoft.DocumentDB` (Cosmos DB for deal state + competitive intel)
  - `Microsoft.KeyVault` (secret management)
- CRM API access (Salesforce, HubSpot, or Dynamics 365)
- `.env` file with: `AZURE_OPENAI_KEY`, `CRM_API_KEY`, `CRM_INSTANCE_URL`, `COSMOS_CONNECTION`

## Step 1: Provision Infrastructure

```bash
az group create --name rg-frootai-sales-assistant --location eastus2

az deployment group create \
  --resource-group rg-frootai-sales-assistant \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json

az keyvault secret set --vault-name kv-sales-ai \
  --name openai-key --value "$AZURE_OPENAI_KEY"
az keyvault secret set --vault-name kv-sales-ai \
  --name crm-api-key --value "$CRM_API_KEY"
```

## Step 2: Deploy CRM Integration

```python
# crm_connector.py — unified CRM adapter
class CRMConnector:
    ADAPTERS = {
        "salesforce": SalesforceAdapter,
        "hubspot": HubSpotAdapter,
        "dynamics365": DynamicsAdapter,
    }

    def __init__(self, config):
        adapter_class = self.ADAPTERS[config["crm_type"]]
        self.adapter = adapter_class(config["crm_url"], config["crm_api_key"])

    async def get_lead(self, lead_id: str) -> dict:
        lead = await self.adapter.get_contact(lead_id)
        company = await self.adapter.get_account(lead["company_id"])
        activities = await self.adapter.get_activities(lead_id, days=90)

        return {
            "name": lead["name"],
            "title": lead["title"],
            "company": company["name"],
            "industry": company["industry"],
            "employees": company["employees"],
            "revenue": company.get("annual_revenue"),
            "funding": company.get("last_funding_round"),
            "engagement": {
                "email_opens": sum(1 for a in activities if a["type"] == "email_open"),
                "website_visits": sum(1 for a in activities if a["type"] == "page_view"),
                "content_downloads": sum(1 for a in activities if a["type"] == "download"),
                "meeting_attended": sum(1 for a in activities if a["type"] == "meeting"),
            },
            "deal_history": await self.adapter.get_deals(company["id"]),
        }
```

CRM data grounding:
| Data Source | What It Provides | Why Critical |
|-------------|-----------------|-------------|
| Contact record | Name, title, role | Personalization |
| Company record | Industry, size, revenue | Segment scoring |
| Activity timeline | Opens, visits, downloads | Behavioral signals |
| Deal history | Past wins/losses, deal size | Propensity scoring |
| Competitor mentions | Win/loss reasons | Battle card context |

## Step 3: Deploy Lead Scoring Engine

```python
# lead_scorer.py — CRM-grounded, explainable scoring
class LeadScorer:
    def __init__(self, config):
        self.openai = AzureOpenAI(azure_endpoint=config["endpoint"])
        self.weights = config["scoring_weights"]

    async def score(self, lead: dict) -> LeadScore:
        # Feature extraction from CRM data (NOT LLM speculation)
        features = {
            "company_fit": self.score_company_fit(lead),     # ICP match
            "engagement": self.score_engagement(lead),       # Behavioral signals
            "timing": self.score_timing(lead),               # Budget cycle, recent events
            "deal_history": self.score_history(lead),        # Past relationship
        }

        weighted = sum(features[k] * self.weights[k] for k in features)
        temperature = "hot" if weighted > 80 else "warm" if weighted > 50 else "cold"

        # LLM generates talk track based on scoring factors
        talk_track = await self.generate_talk_track(lead, features, temperature)

        return LeadScore(
            score=round(weighted),
            temperature=temperature,
            factors=[ScoringFactor(name=k, score=v, weight=self.weights[k]) for k, v in features.items()],
            next_action=self.recommend_action(temperature, lead),
            talk_track=talk_track,
        )

    def score_company_fit(self, lead):
        """Score based on ICP (Ideal Customer Profile)."""
        fit = 0
        if lead["industry"] in self.icp["target_industries"]: fit += 30
        if lead["employees"] >= self.icp["min_employees"]: fit += 20
        if lead.get("revenue", 0) >= self.icp["min_revenue"]: fit += 20
        if lead.get("funding"): fit += 15
        return min(fit, 100)

    def score_engagement(self, lead):
        """Score based on behavioral signals from CRM."""
        eng = lead["engagement"]
        score = min(100, (
            eng["email_opens"] * 5 +
            eng["website_visits"] * 10 +
            eng["content_downloads"] * 20 +
            eng["meeting_attended"] * 30
        ))
        return score
```

## Step 4: Deploy Email Generator

```python
# email_generator.py — personalized, CRM-grounded outreach
class SalesEmailGenerator:
    async def generate(self, lead: dict, purpose: str, tone: str = "professional") -> dict:
        response = await self.openai.chat.completions.create(
            model="gpt-4o", temperature=0.5,
            messages=[
                {"role": "system", "content": f"""You are a sales email writer for {self.company_name}.
Tone: {tone}. Personalize using the lead's industry, role, and engagement data.
NEVER guess company details — use ONLY the data provided.
Include ONE clear call-to-action. Keep under 150 words."""},
                {"role": "user", "content": f"Lead: {json.dumps(lead)}\nPurpose: {purpose}"},
            ],
        )

        email = response.choices[0].message.content
        return {
            "subject": self.extract_subject(email),
            "body": email,
            "personalization_score": self.score_personalization(email, lead),
            "status": "draft",  # NEVER auto-send — sales rep reviews first
        }
```

**Email workflow**: AI drafts → Sales rep reviews → Optional edits → Send via CRM.

## Step 5: Deploy Competitive Intelligence

```python
# competitive_intel.py — battle cards from win/loss data
class CompetitiveIntel:
    async def get_battle_card(self, competitor: str, industry: str) -> dict:
        # Ground in actual win/loss data from CRM
        wins = await self.crm.get_deals(competitor=competitor, outcome="won")
        losses = await self.crm.get_deals(competitor=competitor, outcome="lost")

        card = await self.openai.chat.completions.create(
            model="gpt-4o", temperature=0.2,
            messages=[
                {"role": "system", "content": "Generate a competitive battle card from win/loss data. Include: strengths, weaknesses, objection handlers, differentiators."},
                {"role": "user", "content": f"Competitor: {competitor}\nIndustry: {industry}\nWins against: {len(wins)} ({self.summarize(wins)})\nLosses to: {len(losses)} ({self.summarize(losses)})"},
            ],
        )
        return {"competitor": competitor, "battle_card": card.choices[0].message.content, "based_on": f"{len(wins)} wins, {len(losses)} losses"}
```

## Step 6: Deploy and Verify

```bash
az acr build --registry acrSalesAI --image sales-assistant:latest .

az containerapp create \
  --name sales-assistant \
  --resource-group rg-frootai-sales-assistant \
  --environment sales-env \
  --image acrSalesAI.azurecr.io/sales-assistant:latest \
  --target-port 8080 --min-replicas 1 --max-replicas 3

# Test lead scoring
curl -X POST https://sales-assistant.azurecontainerapps.io/api/score \
  -d '{"lead_id": "lead-001"}'

# Test email generation
curl -X POST https://sales-assistant.azurecontainerapps.io/api/email \
  -d '{"lead_id": "lead-001", "purpose": "follow_up_demo"}'
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| CRM connected | API health check | Lead data retrieved |
| Lead scored | POST score request | 0-100 with factors + temperature |
| Talk track | Score result | Personalized talking points |
| Email generated | POST email request | Personalized draft (NOT auto-sent) |
| Competitive intel | GET battle card | Win/loss grounded analysis |
| No hallucination | Check company data | All from CRM, nothing guessed |
| Email review workflow | Check status | "draft" — requires rep review |

## Rollback Procedure

```bash
az containerapp revision list --name sales-assistant \
  --resource-group rg-frootai-sales-assistant
az containerapp ingress traffic set --name sales-assistant \
  --resource-group rg-frootai-sales-assistant \
  --revision-weight previousRevision=100
```
