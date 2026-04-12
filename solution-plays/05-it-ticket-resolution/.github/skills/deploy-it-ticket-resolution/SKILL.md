---
name: deploy-it-ticket-resolution
description: "Deploy IT Ticket AI — configure classification pipeline, routing rules, knowledge base integration, SLA tracking, PII masking. Use when: deploy, provision, configure."
---

# Deploy IT Ticket Resolution

## When to Use
- Deploy or provision the IT ticket classification and routing pipeline
- Configure knowledge base integration for auto-resolution
- Set up SLA tracking and escalation rules
- Configure PII masking for ticket content
- Integrate with ITSM platforms (ServiceNow, Jira)

## Prerequisites
1. Azure CLI authenticated: `az account show`
2. Bicep CLI: `az bicep version`
3. ITSM platform access (ServiceNow/Jira API credentials)
4. Knowledge base content prepared (FAQ docs, runbooks)
5. Target resource group with Contributor access

## Step 1: Validate Infrastructure
```bash
az bicep lint -f infra/main.bicep
az bicep build -f infra/main.bicep
```
Verify resources:
- Azure OpenAI (gpt-4o-mini for classification, gpt-4o for resolution)
- Azure AI Search (knowledge base indexing)
- Azure Storage (ticket attachments, KB documents)
- Azure Key Vault (ITSM API keys, connection strings)
- Azure Monitor (SLA tracking, classification metrics)

## Step 2: Deploy Azure Resources
```bash
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json
```

## Step 3: Configure Classification Pipeline
- Deploy classification model with category taxonomy
- Categories: Hardware, Software, Network, Access, Account, Other
- Priority levels: P1 (Critical), P2 (High), P3 (Medium), P4 (Low)
- Confidence threshold: route to human if confidence < 0.85

## Step 4: Set Up Knowledge Base
```bash
# Index KB documents into Azure AI Search
python scripts/index_knowledge_base.py --source docs/kb/ --index it-kb-index
```
- Index runbooks, FAQ docs, troubleshooting guides
- Configure semantic ranking for KB retrieval
- Set up hybrid search (keyword + vector) for best recall

## Step 5: Configure Routing Rules
| Priority | SLA Target | Routing |
|----------|-----------|---------|
| P1 Critical | 1 hour | Immediate human + AI assist |
| P2 High | 4 hours | AI auto-resolve, escalate if failed |
| P3 Medium | 8 hours | AI auto-resolve, queue for human review |
| P4 Low | 24 hours | AI auto-resolve, auto-close if resolved |

## Step 6: Configure PII Masking
- Enable PII detection on ticket body, comments, attachments
- Mask: SSN, credit card, phone, email, employee ID
- Log masked version only (never store raw PII in logs)

## Step 7: ITSM Integration
```bash
# Test ServiceNow API connectivity
python scripts/test_itsm.py --platform servicenow --endpoint $SNOW_INSTANCE
```
- Configure webhook for new ticket events
- Set up bidirectional sync (AI resolution → ticket update)
- Map AI categories to ITSM categories

## Step 8: Smoke Test
```bash
python scripts/test_classification.py --ticket "My laptop screen is flickering"
python scripts/test_resolution.py --ticket "How do I reset my VPN password?"
python scripts/test_routing.py --ticket "Production server down" --expected-priority P1
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Wrong classification | Ambiguous ticket text | Improve system prompt with examples |
| Low confidence on all tickets | Temperature too high | Set temperature=0.0 for classification |
| KB retrieval returns irrelevant docs | Missing semantic config | Enable semantic reranking |
| PII not detected | Locale mismatch | Set correct locale in Content Safety config |
| SLA breach not triggered | Timer not started | Verify webhook fires on ticket creation |
| ITSM sync fails | Auth token expired | Implement token refresh in integration |
| Duplicate tickets created | No dedup logic | Hash ticket content for dedup check |
| Escalation loop | No max-escalation limit | Set max 3 escalation attempts |

## CI/CD Integration
```yaml
# Add to CI pipeline after deployment
- name: Validate Classification
  run: python evaluation/eval.py --metrics classification --ci-gate
- name: Validate PII Detection
  run: python evaluation/eval.py --metrics pii --ci-gate
```
