---
name: deploy-low-code-ai-builder
description: "Deploy Low-Code AI Builder — configure visual pipeline designer, template library, connector framework, one-click deployment to Azure. Use when: deploy, provision builder platform."
---

# Deploy Low-Code AI Builder

## When to Use
- Deploy a visual pipeline builder for citizen developers
- Configure template library with pre-built AI workflow patterns
- Set up connector framework for data sources and AI services
- Enable one-click deployment from visual designer to Azure

## Prerequisites
1. Azure CLI authenticated: `az account show`
2. Static Web Apps (visual designer frontend)
3. Cosmos DB (pipeline definition storage)
4. Azure OpenAI (AI steps within pipelines)
5. Container Apps (pipeline execution runtime)

## Step 1: Deploy Infrastructure
```bash
az bicep lint -f infra/main.bicep
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
```

## Step 2: Configure Visual Designer
| Component | Technology | Purpose |
|-----------|-----------|---------|
| Canvas | React Flow | Drag-and-drop node editor |
| Node palette | Custom components | AI steps, connectors, logic |
| Property panel | JSON Schema forms | Per-node configuration |
| Execution view | WebSocket updates | Real-time pipeline progress |

## Step 3: Configure Template Library
| Template | Steps | Use Case |
|----------|-------|----------|
| Document Classifier | Upload → OCR → Classify → Store | Auto-sort docs |
| Customer Sentiment | Ingest → Analyze → Score → Alert | Feedback analysis |
| FAQ Bot | RAG → Generate → Safety → Respond | Quick chatbot |
| Email Triager | Read → Classify → Route → Respond | Auto-route email |
| Data Enricher | Fetch → LLM Enrich → Validate → Store | Data augmentation |

## Step 4: Configure Connector Framework
| Connector Type | Examples | Auth |
|----------------|---------|------|
| Data sources | Blob, SQL, Cosmos, SharePoint | Managed Identity |
| AI services | Azure OpenAI, Content Safety | Managed Identity |
| External APIs | REST, GraphQL, Webhook | API key (KV) |
| Notifications | Teams, Email, Slack | OAuth / Webhook |

## Step 5: Configure Pipeline Definition Schema
```json
{
  "pipeline": {
    "id": "pipe-uuid", "name": "Document Classifier", "version": 2,
    "steps": [
      { "id": "s1", "type": "input", "connector": "blob-storage" },
      { "id": "s2", "type": "ai", "model": "gpt-4o-mini", "prompt": "Classify" },
      { "id": "s3", "type": "condition", "if": "s2.category == 'invoice'" },
      { "id": "s4", "type": "action", "connector": "cosmos-db" }
    ]
  }
}
```

## Step 6: Enable One-Click Deploy
- Design in canvas → Click Deploy → Validate → Generate Container App → Stage → Promote

## Step 7: Post-Deployment Verification
- [ ] Visual designer loads and renders
- [ ] Templates importable and customizable
- [ ] Connectors authenticate and fetch data
- [ ] Pipeline execution correct output
- [ ] One-click deploy creates Container App
- [ ] Versioning saves/restores
- [ ] Error messages user-friendly

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Designer blank | SWA build failed | Check build logs |
| Connector auth fails | Missing KV secret | Add API key to Key Vault |
| Step fails silently | No error propagation | Add error node after each step |
| Deploy timeout | Large pipeline | Optimize steps, use sub-pipelines |
| Template import fails | Version mismatch | Check schema version |
| Execution slow | Sequential steps | Mark independent steps parallel |

## Architecture Overview
```
User → Visual Designer (SWA) → Pipeline Definition (Cosmos DB)
                                      ↓
                    Execution Engine (Container Apps) → Connectors → AI Services
                                      ↓
                    Results Dashboard → Version History → Promote to Production
```

## Security Considerations
- Validate all pipeline definitions before execution (no arbitrary code)
- Connector credentials stored in Key Vault, never in pipeline definition
- Rate limit pipeline executions per user (prevent abuse)
- Audit log all pipeline runs (who ran what, when, what output)
- Content safety on AI step outputs (filter harmful content)
- Sandbox execution: pipelines can only access connected resources
