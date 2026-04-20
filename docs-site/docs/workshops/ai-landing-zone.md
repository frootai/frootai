---
sidebar_position: 2
title: "Workshop: AI Landing Zone"
description: "Hands-on workshop — scaffold and deploy an AI Landing Zone with private endpoints, managed identity, RBAC, and WAF validation. Based on Solution Play 02."
---

# Workshop: AI Landing Zone

Deploy a **production-grade AI Landing Zone** — the foundational infrastructure that every enterprise AI workload needs. Secure networking, managed identity, RBAC, and Well-Architected Framework validation in 90 minutes.

| | |
|---|---|
| **Duration** | 90 minutes (5 parts) |
| **Level** | Intermediate |
| **Solution Play** | [02 — AI Landing Zone](../solution-plays/overview.md) |
| **You'll Deploy** | VNet + private endpoints, Azure OpenAI, AI Search, Key Vault, Managed Identity, RBAC |

## Prerequisites

- **Azure subscription** with **Contributor** role
- **Azure CLI** 2.50+ (`az --version`)
- **VS Code** with FrootAI extension
- **Node.js** 18+ (for FrootAI CLI)

```bash
# Verify prerequisites
az --version          # 2.50+
node --version        # 18+
az login              # Authenticate
```

## Part 1: Scaffold (15 min)

Initialize the AI Landing Zone from the FrootAI template:

```bash
npx frootai scaffold 02-ai-landing-zone
cd 02-ai-landing-zone
```

This creates the standard [play structure](../solution-plays/overview.md):

```
02-ai-landing-zone/
├── .github/
│   ├── copilot-instructions.md    # Knowledge supplement
│   ├── agents/                    # builder, reviewer, tuner
│   ├── instructions/              # WAF-aligned guidance
│   └── skills/                    # Infrastructure skills
├── config/
│   ├── openai.json                # AI model configuration
│   └── guardrails.json            # Safety boundaries
├── infra/
│   ├── main.bicep                 # Entry point
│   ├── modules/                   # Network, AI, security modules
│   └── parameters/                # Environment-specific values
└── spec/
    └── fai-manifest.json          # Play metadata + wiring
```

:::tip Explore Before Deploying
Spend 5 minutes reading `copilot-instructions.md` and `fai-manifest.json` to understand what's being deployed and why each component exists.
:::

## Part 2: Review Architecture (15 min)

### Core Components

The AI Landing Zone deploys a secure, interconnected set of services:

| Component | Service | Purpose |
|-----------|---------|---------|
| **Networking** | VNet + subnets + NSGs | Network isolation |
| **AI** | Azure OpenAI (private endpoint) | LLM inference |
| **Search** | Azure AI Search (private endpoint) | Vector + keyword search |
| **Security** | Key Vault (private endpoint) | Secrets management |
| **Identity** | User-Assigned Managed Identity | Service-to-service auth |
| **Monitoring** | Application Insights + Log Analytics | Observability |

### Review Configuration Files

```json
// config/openai.json
{ "model": "gpt-4o", "temperature": 0.1, "max_tokens": 4096, "api_version": "2024-06-01" }
```

```json
// config/guardrails.json
{ "content_safety": { "enabled": true }, "max_tokens_per_request": 4096,
  "rate_limit_per_minute": 60, "require_managed_identity": true }
```

## Part 3: Deploy Infrastructure (30 min)

### Set Parameters

```bash
# Create a resource group
az group create --name ai-landing-zone-rg --location eastus2

# Configure deployment parameters
az deployment group create \
  --resource-group ai-landing-zone-rg \
  --template-file infra/main.bicep \
  --parameters infra/parameters/dev.bicepparam
```

:::warning Deployment Time
The full deployment takes **15-25 minutes** due to private endpoint DNS propagation. The Azure OpenAI resource alone can take 5-10 minutes. Monitor progress in the Azure portal under "Deployments."
:::

### Key Bicep Patterns

The landing zone uses **Azure Verified Modules (AVM)**:

```bicep
module openaiPrivateEndpoint 'br/public:avm/res/network/private-endpoint:0.7.1' = {
  name: 'openai-pe'
  params: {
    name: 'pe-openai-${resourceToken}'
    subnetResourceId: vnet.outputs.subnetResourceIds[0]
    privateLinkServiceConnections: [{ name: 'openai', properties: {
      privateLinkServiceId: openai.outputs.resourceId, groupIds: ['account']
    }}]
  }
}
```

Verify with: `az resource list --resource-group ai-landing-zone-rg --output table`

## Part 4: Validate WAF (15 min)

Run the FrootAI WAF validation to check your deployment against Well-Architected Framework pillars:

```bash
npx frootai validate --waf
```

Expected output checks:

| Pillar | Validation | Expected |
|--------|-----------|----------|
| **Security** | Private endpoints enabled | ✅ Pass |
| **Security** | Managed Identity configured | ✅ Pass |
| **Security** | RBAC (no access keys) | ✅ Pass |
| **Reliability** | Multi-zone deployment | ✅ Pass |
| **Cost** | Dev SKUs for non-production | ✅ Pass |
| **Operations** | Diagnostic settings enabled | ✅ Pass |

:::info WAF Pillars
The six WAF pillars — Security, Reliability, Cost Optimization, Operational Excellence, Performance Efficiency, and Responsible AI — are enforced across all FrootAI solution plays. See [T3: Production Patterns](../learning/t3-production-patterns.md) for detailed patterns.
:::

## Part 5: Connect & Build (15 min)

With infrastructure deployed, use the builder agent to create your first AI application on top of the landing zone:

```bash
# In VS Code with Copilot, reference the builder agent:
# @fai-play-02-builder Help me connect to the deployed Azure OpenAI
# instance using managed identity and send a test query.
```

### Test Connectivity

```python
from azure.identity import DefaultAzureCredential
from openai import AzureOpenAI

credential = DefaultAzureCredential()
token = credential.get_token("https://cognitiveservices.azure.com/.default")

client = AzureOpenAI(
    azure_endpoint="https://<your-openai>.openai.azure.com/",
    api_key=token.token,
    api_version="2024-06-01"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello from the AI Landing Zone!"}]
)
print(response.choices[0].message.content)
```

## Cleanup

```bash
# Remove all resources (irreversible)
az group delete --name ai-landing-zone-rg --yes --no-wait
```

## Next Steps

- Build on your landing zone with [Workshop: Build a RAG Pipeline](./build-rag-pipeline.md)
- Explore [Solution Play 02](../solution-plays/overview.md) for advanced networking patterns
- Learn about [O5: Infrastructure](../learning/o5-infrastructure.md) for deeper Bicep/IaC patterns
