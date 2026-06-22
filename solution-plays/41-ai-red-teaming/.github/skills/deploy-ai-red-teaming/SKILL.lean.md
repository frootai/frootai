---
name: "deploy-ai-red-teaming"
description: "Deploy AI Red Teaming framework — automated adversarial attack simulation, jailbreak detection, prompt injection testing, safety scorecards for EU AI Act and NIST AI RMF."
---

# Deploy AI Red Teaming Framework

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.CognitiveServices` (Azure OpenAI + Content Safety)
  - `Microsoft.App` (Container Apps for attack orchestrator)
  - `Microsoft.KeyVault` (secret management)
- Python 3.11+ with `azure-ai-evaluation`, `pyrit` packages
- Target AI application endpoint available for testing
- `.env` file with: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `AZURE_CONTENT_SAFETY_ENDPOINT`, `AZURE_CONTENT_SAFETY_KEY`

## Step 1: Provision Red Team Infrastructure

```bash
# Create resource group
az group create --name rg-frootai-ai-red-teaming --location eastus2

# Deploy infrastructure (OpenAI attacker model, Content Safety, Key Vault, App Insights)
az deployment group create \
  --resource-group rg-frootai-ai-red-teaming \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=prod

# Store secrets
az keyvault secret set --vault-name kv-red-team \
  --name openai-key --value "$AZURE_OPENAI_KEY"
az keyvault secret set --vault-name kv-red-team \
  --name content-safety-key --value "$AZURE_CONTENT_SAFETY_KEY"
```

## Step 2: Deploy Attacker Model

```bash
# Deploy GPT-4o as the attacker model (generates adversarial prompts)
az cognitiveservices account deployment create \
  --name openai-red-team \
  --resource-group rg-frootai-ai-red-teaming \
  --deployment-name gpt-4o-attacker \
  --model-name gpt-4o \
  --model-version "2024-08-06" \
  --model-format OpenAI \
  --sku-capacity 30 --sku-name Standard

# Deploy GPT-4o-mini as the judge model (evaluates attack success)
az cognitiveservices account deployment create \
  --name openai-red-team \
  --resource-group rg-frootai-ai-red-teaming \
  --deployment-name gpt-4o-mini-judge \
  --model-name gpt-4o-mini \
  --model-version "2024-07-18" \
  --model-format OpenAI \
  --sku-capacity 50 --sku-name Standard
```

Key architecture decisions:
- **Attacker model** (gpt-4o): Generates sophisticated adversarial prompts
- **Judge model** (gpt-4o-mini): Evaluates whether attacks succeeded (cheaper, high volume)
- **Content Safety API**: Provides severity scoring independent of LLM judgment
- **Separation**: Attacker and target must be different deployments to avoid self-bias

## Step 3: Configure Attack Framework

```python
# attack_framework.py — core red team orchestrator
from pyrit.orchestrator import RedTeamingOrchestrator
from pyrit.prompt_target import AzureOpenAITarget
from pyrit.score import AzureContentFilterScorer

# Configure target (the AI application under test)
target = AzureOpenAITarget(
    deployment_name="target-app",
    endpoint=os.environ["TARGET_ENDPOINT"],
    api_key=os.environ["TARGET_KEY"],
)

# Configure attacker
attacker = AzureOpenAITarget(
    deployment_name="gpt-4o-attacker",
    endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    api_key=os.environ["AZURE_OPENAI_KEY"],
)

# Configure scoring
scorer = AzureContentFilterScorer(
    endpoint=os.environ["CONTENT_SAFETY_ENDPOINT"],
    api_key=os.environ["CONTENT_SAFETY_KEY"],
)

orchestrator = RedTeamingOrchestrator(
    attack_strategy="multi_turn",
    red_teaming_chat=attacker,
    prompt_target=target,
    scorer=scorer,
    max_turns=5,
)
```

## Step 4: Define Attack Categories

```json
// config/attacks.json
{
  "categories": {
    "jailbreak": {
      "techniques": ["role_play", "hypothetical", "encoded", "multi_persona"],
      "num_attacks": 50,
      "severity_weight": 1.0
    },
    "prompt_injection": {
      "techniques": ["instruction_override", "context_manipulation", "delimiter_confusion"],
      "num_attacks": 50,
      "severity_weight": 0.9
    },
    "data_exfiltration": {
      "techniques": ["system_prompt_leak", "training_data_extraction", "context_dump"],
      "num_attacks": 30,
      "severity_weight": 0.8
    },
    "harmful_content": {
      "techniques": ["indirect_request", "hypothetical_scenario", "translation_bypass"],
      "num_attacks": 40,
      "severity_weight": 1.0
    },
    "bias_elicitation": {
      "techniques": ["stereotyping", "demographic_comparison", "cultural_bias"],
      "num_attacks": 30,
      "severity_weight": 0.7
    },
    "encoding_bypass": {
      "techniques": ["base64", "unicode_substitution", "leetspeak", "rot13"],
      "num_attacks": 20,
      "severity_weight": 0.6
    }
  },
  "multi_turn": {
    "enabled": true,
    "max_turns": 5,
    "escalation_strategies": ["crescendo", "context_building", "trust_establishment"]
  }
}
```

## Step 5: Deploy Attack Orchestrator

```bash
# Build and deploy the attack orchestrator container
az acr build --registry acrRedTeam \
  --image red-team-orchestrator:latest .

az containerapp create \
  --name red-team-orchestrator \
  --resource-group rg-frootai-ai-red-teaming \
  --environment red-team-env \
  --image acrRedTeam.azurecr.io/red-team-orchestrator:latest \
  --target-port 8080 \
  --min-replicas 0 --max-replicas 3 \
  --secrets openai-key=keyvaultref:kv-red-team/openai-key,cs-key=keyvaultref:kv-red-team/content-safety-key \
  --env-vars OPENAI_KEY=secretref:openai-key CONTENT_SAFETY_KEY=secretref:cs-key
```

## Step 6: Verify Deployment

```bash
# Health check
curl https://red-team-orchestrator.azurecontainerapps.io/health

# Run smoke test (10 attacks across all categories)
curl -X POST https://red-team-orchestrator.azurecontainerapps.io/api/scan \
  -H "Content-Type: application/json" \
  -d '{"target_endpoint": "https://target-app.azurewebsites.net/api/chat", "mode": "smoke", "attacks_per_category": 2}'

# Verify scorecard generation
curl https://red-team-orchestrator.azurecontainerapps.io/api/reports/latest
```

## Verification Checklist

| Check | Command | Expected |
|-------|---------|----------|
| Attacker model deployed | `az cognitiveservices account deployment show` | gpt-4o-attacker active |
| Judge model deployed | deployment show | gpt-4o-mini-judge active |
| Content Safety live | API health check | 200 OK |
| Orchestrator running | `curl /health` | 200 OK |
| Smoke scan completes | POST `/api/scan` | Results JSON with scores |
| Scorecard generates | GET `/api/reports/latest` | HTML/PDF report |
| Key Vault access | Managed identity check | Secrets resolved |
| App Insights telemetry | Dashboard check | Attack events flowing |

## Rollback Procedure

```bash
# Red teaming is non-destructive — rollback the orchestrator only
az containerapp revision list --name red-team-orchestrator \
  --resource-group rg-frootai-ai-red-teaming
az containerapp ingress traffic set --name red-team-orchestrator \
  --resource-group rg-frootai-ai-red-teaming \
  --revision-weight previousRevision=100
```
