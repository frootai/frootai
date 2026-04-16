---
name: azure-openai-setup
description: "Set up Azure OpenAI deployments, RBAC, and monitoring — harden inference endpoints and control latency, quota, and cost"
---

# Azure OpenAI Service Setup

## Bicep Deployment — Cognitive Services Account

Deploy the Azure OpenAI resource with system-assigned managed identity, network restrictions, and a custom subdomain for token-based auth:

```bicep
@description('Azure region — check model availability per region')
param location string = resourceGroup().location
param aoaiName string = 'aoai-${uniqueString(resourceGroup().id)}'
param sku string = 'S0' // S0 is the only SKU for Azure OpenAI

resource openai 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: aoaiName
  location: location
  kind: 'OpenAI'
  sku: { name: sku }
  identity: { type: 'SystemAssigned' }
  properties: {
    customSubDomainName: aoaiName
    publicNetworkAccess: 'Disabled' // Enable only via Private Endpoint
    networkAcls: { defaultAction: 'Deny' }
    disableLocalAuth: true // Force Entra ID — no API keys
  }
}
```

## Model Deployments — Deployment Types

Three deployment types with different billing and latency profiles:

| Type | Billing | Latency | Use Case |
|------|---------|---------|----------|
| **Standard** | Per-token (PAYG) | Variable, shared capacity | Dev/test, bursty workloads |
| **Global-Standard** | Per-token, global routing | Lowest average | Multi-region apps, high availability |
| **Provisioned (PTU)** | Reserved throughput units | Consistent, guaranteed | Production SLA, predictable latency |

**PTU sizing rule**: 1 PTU ≈ 6 RPM for GPT-4o at 4K input / 1K output. Use the [Azure capacity calculator](https://oai.azure.com/portal/calculator) for exact sizing.

```bicep
@description('Chat completion model deployment')
param chatModelName string = 'gpt-4o'
param chatModelVersion string = '2024-11-20' // Pin to specific version
param chatDeploymentType string = 'GlobalStandard' // Standard | GlobalStandard | ProvisionedManaged

resource chatDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openai
  name: 'chat'
  sku: chatDeploymentType == 'ProvisionedManaged' ? { name: 'ProvisionedManaged', capacity: 50 }
                                                   : { name: chatDeploymentType, capacity: 80 } // 80K TPM
  properties: {
    model: {
      format: 'OpenAI'
      name: chatModelName
      version: chatModelVersion
    }
    versionUpgradeOption: 'NoAutoUpgrade' // Manual upgrades only in production
  }
}

resource embeddingDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openai
  name: 'embedding'
  sku: { name: 'Standard', capacity: 120 } // 120K TPM
  properties: {
    model: {
      format: 'OpenAI'
      name: 'text-embedding-3-large'
      version: '1'
    }
    versionUpgradeOption: 'NoAutoUpgrade'
  }
  dependsOn: [chatDeployment] // Serial deployment — ARM limitation
}
```

**Model version pinning**: Always set `versionUpgradeOption: 'NoAutoUpgrade'` and pin `version` explicitly. Auto-upgrades can break structured output schemas or change token costs mid-sprint.

## Content Filtering Configuration

```bicep
resource contentFilter 'Microsoft.CognitiveServices/accounts/raiPolicies@2024-10-01' = {
  parent: openai
  name: 'production-filter'
  properties: {
    basePolicyName: 'Microsoft.DefaultV2'
    contentFilters: [
      { name: 'hate',       blocking: true, severityThreshold: 'Medium', source: 'Prompt' }
      { name: 'sexual',     blocking: true, severityThreshold: 'Medium', source: 'Prompt' }
      { name: 'violence',   blocking: true, severityThreshold: 'Medium', source: 'Prompt' }
      { name: 'selfharm',   blocking: true, severityThreshold: 'Medium', source: 'Prompt' }
      { name: 'jailbreak',  blocking: true, source: 'Prompt' }  // Prompt Shields
      { name: 'hate',       blocking: true, severityThreshold: 'Medium', source: 'Completion' }
      { name: 'sexual',     blocking: true, severityThreshold: 'Medium', source: 'Completion' }
      { name: 'violence',   blocking: true, severityThreshold: 'Medium', source: 'Completion' }
      { name: 'selfharm',   blocking: true, severityThreshold: 'Medium', source: 'Completion' }
    ]
  }
}
```

## Managed Identity RBAC

Assign `Cognitive Services OpenAI User` to the consuming app — never `Contributor`:

```bicep
param appPrincipalId string // System-assigned identity of Container App / Function

@description('Cognitive Services OpenAI User — allows inference, blocks management plane')
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: openai
  name: guid(openai.id, appPrincipalId, '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd')
  properties: {
    principalId: appPrincipalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions',
                        '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd') // Cognitive Services OpenAI User
    principalType: 'ServicePrincipal'
  }
}

output endpoint string = openai.properties.endpoint
output identityPrincipalId string = openai.identity.principalId
```

## Python Client — DefaultAzureCredential

```python
from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from openai import AzureOpenAI

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(
    azure_endpoint="https://aoai-xxxxx.openai.azure.com",
    azure_ad_token_provider=token_provider,
    api_version="2024-12-01-preview",  # Pin API version
)

response = client.chat.completions.create(
    model="chat",  # Deployment name, NOT model name
    messages=[{"role": "user", "content": "Hello"}],
    temperature=0,        # Deterministic for reproducibility
    max_tokens=1024,
    seed=42,              # Server-side seed for consistency
)
```

## config/openai.json Structure

```json
{
  "model": "gpt-4o",
  "deployment_name": "chat",
  "api_version": "2024-12-01-preview",
  "temperature": 0,
  "max_tokens": 4096,
  "seed": 42,
  "top_p": 1.0,
  "frequency_penalty": 0,
  "presence_penalty": 0,
  "response_format": { "type": "json_object" },
  "fallback": {
    "deployment_name": "chat-mini",
    "model": "gpt-4o-mini",
    "max_tokens": 4096
  }
}
```

## Rate Limit Monitoring

Key metrics to alert on — available via Azure Monitor `microsoft.cognitiveservices/accounts`:

| Metric | Alert Threshold | Action |
|--------|----------------|--------|
| `AzureOpenAI.Requests.TokenTransaction` | >80% of TPM capacity | Scale up or add fallback |
| `AzureOpenAI.Requests.Count` with `StatusCode=429` | >5 per minute | Activate circuit breaker |
| `AzureOpenAI.Requests.Duration` P95 | >10s for chat | Check PTU saturation |
| `ProvisionedManagedUtilizationV2` | >90% sustained | Add PTU or overflow to PAYG |

```python
# Retry with exponential backoff — handle 429s gracefully
from tenacity import retry, wait_exponential, retry_if_exception_type
from openai import RateLimitError

@retry(wait=wait_exponential(min=1, max=60), retry=retry_if_exception_type(RateLimitError))
def call_with_retry(client, messages, config):
    return client.chat.completions.create(
        model=config["deployment_name"],
        messages=messages,
        temperature=config["temperature"],
        max_tokens=config["max_tokens"],
    )
```

## Regional Failover

Deploy to two regions and failover on 429/5xx:

```python
ENDPOINTS = [
    {"region": "eastus2",  "endpoint": "https://aoai-eastus2-xxx.openai.azure.com"},
    {"region": "swedencentral", "endpoint": "https://aoai-sweden-xxx.openai.azure.com"},
]

def create_client(endpoint_config):
    return AzureOpenAI(
        azure_endpoint=endpoint_config["endpoint"],
        azure_ad_token_provider=token_provider,
        api_version="2024-12-01-preview",
    )

def call_with_failover(messages, config):
    for ep in ENDPOINTS:
        try:
            client = create_client(ep)
            return call_with_retry(client, messages, config)
        except Exception as e:
            if ep == ENDPOINTS[-1]:
                raise
            continue  # Try next region
```

## Cost Estimation Rules

| Model | PAYG Input/1M | PAYG Output/1M | PTU (per unit/hr) |
|-------|--------------|----------------|-------------------|
| GPT-4o | $2.50 | $10.00 | ~$2.00 |
| GPT-4o-mini | $0.15 | $0.60 | ~$0.30 |
| text-embedding-3-large | $0.13 | — | N/A |

**Break-even rule**: PTU becomes cheaper than PAYG at ~60-70% sustained utilization. Below that, PAYG with aggressive caching wins. Use a PAYG overflow deployment alongside PTU for burst traffic.

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` | `disableLocalAuth: true` but using API key | Switch to `DefaultAzureCredential` |
| `404 DeploymentNotFound` | Using model name instead of deployment name | Use deployment name in `model=` param |
| `429 RateLimitExceeded` | Exceeded TPM/RPM quota | Add retry logic, scale capacity, or failover |
| `ContentFilterResult` | Input/output blocked by content filter | Review filter thresholds, check prompt content |
| Model version deprecated | Auto-upgrade disabled, version EOL | Update `version` in Bicep, redeploy |
