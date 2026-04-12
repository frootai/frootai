# Play 64 — AI Sales Assistant

AI-powered sales enablement — CRM-grounded lead scoring (ICP match + engagement signals), personalized email generation, call prep with talk tracks, competitive intelligence from win/loss data, deal stage coaching, and CRM integration (Salesforce, HubSpot, Dynamics 365). All emails are drafts — sales rep reviews before sending.

## Architecture

| Component | Azure Service | Purpose |
|-----------|--------------|---------|
| Scoring + Emails | Azure OpenAI (GPT-4o) | Lead scoring, email generation, talk tracks |
| Competitive Intel | Azure OpenAI (GPT-4o-mini) | Battle cards from win/loss data |
| CRM Integration | Salesforce/HubSpot/Dynamics API | Contact, company, activity, deal data |
| Deal State | Azure Cosmos DB | Lead pipeline, scoring history |
| Sales API | Azure Container Apps | Scoring + email + intel endpoint |
| Secrets | Azure Key Vault | CRM credentials, OpenAI key |

## How It Differs from Related Plays

| Aspect | Play 54 (Customer Support V2) | **Play 64 (Sales Assistant)** |
|--------|------------------------------|------------------------------|
| Audience | Existing customers | **Prospects and leads** |
| Goal | Resolve issues | **Close deals** |
| Data Source | KB + conversation | **CRM + engagement signals + win/loss** |
| Scoring | Sentiment (positive/negative) | **Lead temperature (hot/warm/cold)** |
| Output | Resolution response | **Email drafts + talk tracks + battle cards** |
| AI Role | Auto-respond or escalate | **Draft → rep reviews → sends** |

## Key Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| Score-to-Close Correlation | > 0.6 | High scores predict closed deals |
| Email Response Rate | > 15% | AI-drafted emails get replies |
| CRM Grounding | 100% | No hallucinated company data |
| Talk Track Relevance | > 4.0/5.0 | Personalized, actionable |
| Cost per Lead | < $0.10 | Score + email + talk track |

## WAF Alignment

| Pillar | Implementation |
|--------|---------------|
| **Reliability** | CRM-grounded scoring (no speculation), consistent scoring (temp=0) |
| **Security** | CRM credentials in Key Vault, no PII in logs |
| **Cost Optimization** | gpt-4o-mini for competitive intel, batch scoring, cached battle cards |
| **Operational Excellence** | CRM sync every 15 min, scoring history tracking |
| **Performance Efficiency** | Parallel CRM data fetch, cached company profiles |
| **Responsible AI** | Email review workflow (never auto-send), scoring fairness |
