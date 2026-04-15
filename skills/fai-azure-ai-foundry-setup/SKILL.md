---
name: fai-azure-ai-foundry-setup
description: |
  Set up Azure AI Foundry with hub/project topology, model deployments, evaluation pipelines,
  Prompt Flow integration, and secure networking. Use when provisioning AI Foundry for
  model management and experimentation.
---

# Azure AI Foundry Setup

Provision and configure Azure AI Foundry for model management, evaluation, and experimentation.

## When to Use

- Setting up a new AI development environment
- Deploying models through AI Foundry hub/project
- Creating evaluation pipelines for model quality tracking
- Integrating Prompt Flow for prompt engineering workflows

---

## Step 1: Provision Hub and Project

```bicep
// Hub — shared infrastructure (networking, identity, storage)
resource hub 'Microsoft.MachineLearningServices/workspaces@2024-10-01' = {
  name: hubName
  location: location
  kind: 'Hub'
  identity: { type: 'SystemAssigned' }
  properties: {
    friendlyName: 'AI Foundry Hub'
    storageAccount: storageAccount.id
    keyVault: keyVault.id
    applicationInsights: appInsights.id
    publicNetworkAccess: 'Disabled'
  }
}

// Project — team-scoped workspace under the hub
resource project 'Microsoft.MachineLearningServices/workspaces@2024-10-01' = {
  name: projectName
  location: location
  kind: 'Project'
  identity: { type: 'SystemAssigned' }
  properties: {
    friendlyName: 'Enterprise RAG Project'
    hubResourceId: hub.id
  }
}
```

## Step 2: Deploy Models

```bash
# Deploy GPT-4o via Azure CLI
az ml serverless-endpoint create \
  --resource-group $RG \
  --workspace-name $PROJECT \
  --name gpt-4o-endpoint \
  --model-id azureml://registries/azure-openai/models/gpt-4o

# Deploy embedding model
az ml online-deployment create \
  --resource-group $RG \
  --workspace-name $PROJECT \
  --endpoint-name embedding-endpoint \
  --file deployment-config.yml
```

## Step 3: Configure RBAC

```bicep
// Grant project identity access to Azure OpenAI
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(project.id, openAI.id, cognitiveServicesUserId)
  scope: openAI
  properties: {
    principalId: project.identity.principalId
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd') // Cognitive Services OpenAI User
    principalType: 'ServicePrincipal'
  }
}
```

## Step 4: Evaluation Pipeline

```python
from azure.ai.evaluation import evaluate
from azure.identity import DefaultAzureCredential

# Run evaluation against deployed model
result = evaluate(
    data="evaluation/test-dataset.jsonl",
    evaluators={
        "groundedness": GroundednessEvaluator(credential=DefaultAzureCredential()),
        "relevance": RelevanceEvaluator(credential=DefaultAzureCredential()),
        "coherence": CoherenceEvaluator(credential=DefaultAzureCredential()),
    },
    target=lambda row: call_model(row["question"], row["context"]),
)

print(f"Groundedness: {result.metrics['groundedness.score']:.2f}")
print(f"Relevance: {result.metrics['relevance.score']:.2f}")
```

## Step 5: Prompt Flow Integration

```yaml
# flow.dag.yaml — Prompt Flow definition
inputs:
  question: { type: string }
  context: { type: string }
nodes:
  - name: format_prompt
    type: prompt
    source: { type: code, path: prompts/rag-prompt.jinja2 }
    inputs: { question: ${inputs.question}, context: ${inputs.context} }
  - name: call_llm
    type: llm
    source: { type: code, path: llm_call.py }
    inputs: { prompt: ${format_prompt.output} }
    connection: azure_openai
    api: chat
outputs:
  answer: { value: ${call_llm.output} }
```

## Networking

| Component | Network Access | Auth |
|-----------|---------------|------|
| Hub | Private endpoint | Managed Identity |
| Project | Inherits from Hub | MI + RBAC |
| OpenAI | Private endpoint | MI (OpenAI User role) |
| Storage | Private endpoint | MI (Blob Contributor) |
| Key Vault | Private endpoint | MI (Secrets User) |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Eval pipeline can't reach model | RBAC not assigned to project MI | Grant Cognitive Services OpenAI User |
| Prompt Flow times out | Network rules block hub→OpenAI | Verify private endpoint DNS resolution |
| Model deployment fails | Quota exceeded in region | Check regional capacity, try alternate region |
| High eval costs | Running against full dataset | Use sampling (100-500 rows) for dev evals |
