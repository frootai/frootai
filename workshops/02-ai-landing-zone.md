# Workshop 02: AI Landing Zone — Secure Azure Infrastructure for AI

> Duration: 90 minutes | Level: Intermediate | Audience: Cloud Architects, Platform Engineers

## Learning Objectives

By the end of this workshop, participants will:
1. Deploy a WAF-aligned AI Landing Zone on Azure using Bicep
2. Configure private endpoints, managed identity, and diagnostic settings
3. Set up Azure Policy for governance enforcement
4. Connect Azure OpenAI with proper RBAC (no API keys)

## Prerequisites

- Azure subscription with Contributor access
- Azure CLI installed (`az --version` >= 2.50)
- VS Code with FrootAI extension (`code --install-extension pavleenbali.frootai`)

## Workshop Flow

### Part 1: Scaffold (15 min)
```bash
npx frootai scaffold 02-ai-landing-zone
cd 02-ai-landing-zone
code .
```

### Part 2: Review Architecture (15 min)
- Open `spec/play-spec.json` — review WAF alignment scores
- Open `config/openai.json` — review model configuration
- Open `config/guardrails.json` — review security controls

### Part 3: Deploy Infrastructure (30 min)
```bash
az group create --name rg-ai-lz-workshop --location swedencentral
az deployment group create --resource-group rg-ai-lz-workshop --template-file infra/main.bicep --parameters environment=dev projectName=workshop
```

### Part 4: Validate WAF Alignment (15 min)
```bash
npx frootai validate --waf
```

### Part 5: Connect Copilot + Build (15 min)
Open Copilot Chat: `@builder Deploy a secure API endpoint using the landing zone resources`

## Cleanup
```bash
az group delete --name rg-ai-lz-workshop --yes --no-wait
```

## Related
- [Solution Play 02](https://frootai.dev/solution-plays)
- [AI Landing Zone Patterns](https://frootai.dev/docs/Azure-AI-Platform)
