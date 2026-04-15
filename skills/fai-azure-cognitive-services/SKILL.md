---
name: fai-azure-cognitive-services
description: |
  Provision and secure Azure Cognitive Services with private endpoints, quota management,
  content safety defaults, and diagnostic logging. Use when setting up Speech, Vision,
  Language, or multi-service Cognitive Services accounts.
---

# Azure Cognitive Services Setup

Provision and harden Cognitive Services endpoints with security, quotas, and monitoring.

## When to Use

- Provisioning Speech, Vision, Language, or Translator services
- Setting up multi-service Cognitive Services accounts
- Hardening existing services with private endpoints and RBAC
- Configuring content safety and quota limits

---

## Bicep Provisioning

```bicep
resource cogServices 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: cogServicesName
  location: location
  kind: 'CognitiveServices'  // multi-service
  sku: { name: 'S0' }
  identity: { type: 'SystemAssigned' }
  properties: {
    customSubDomainName: cogServicesName
    publicNetworkAccess: 'Disabled'
    networkAcls: { defaultAction: 'Deny' }
    disableLocalAuth: true
  }
}

// Private endpoint
resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: '${cogServicesName}-pe'
  location: location
  properties: {
    subnet: { id: subnetId }
    privateLinkServiceConnections: [{
      name: 'cog-connection'
      properties: {
        privateLinkServiceId: cogServices.id
        groupIds: ['account']
      }
    }]
  }
}
```

## RBAC Setup

```bash
# Grant app Managed Identity access
az role assignment create \
  --assignee-object-id $MI_PRINCIPAL_ID \
  --role "Cognitive Services User" \
  --scope $COG_RESOURCE_ID

# For OpenAI specifically
az role assignment create \
  --assignee-object-id $MI_PRINCIPAL_ID \
  --role "Cognitive Services OpenAI User" \
  --scope $COG_RESOURCE_ID
```

## Content Safety Configuration

```python
from azure.ai.contentsafety import ContentSafetyClient
from azure.identity import DefaultAzureCredential

client = ContentSafetyClient(
    endpoint="https://cog-prod.cognitiveservices.azure.com",
    credential=DefaultAzureCredential()
)

# Analyze text for safety
from azure.ai.contentsafety.models import AnalyzeTextOptions, TextCategory
result = client.analyze_text(AnalyzeTextOptions(
    text="User input to check",
    categories=[TextCategory.HATE, TextCategory.VIOLENCE,
                TextCategory.SELF_HARM, TextCategory.SEXUAL],
))

for cat in result.categories_analysis:
    if cat.severity >= 2:  # 0=safe, 2+=risky
        print(f"BLOCKED: {cat.category} severity={cat.severity}")
```

## Diagnostic Settings

```bicep
resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'cog-diagnostics'
  scope: cogServices
  properties: {
    workspaceId: logAnalyticsWorkspace.id
    logs: [{ category: 'Audit', enabled: true }
           { category: 'RequestResponse', enabled: true }]
    metrics: [{ category: 'AllMetrics', enabled: true }]
  }
}
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| 429 throttling | Quota too low for workload | Increase RPS quota via support request or add retry with backoff |
| 403 Forbidden | Missing RBAC or public access disabled without PE | Verify MI role assignment and private endpoint DNS |
| Content safety false positives | Threshold too strict | Lower severity threshold from 2 to 4 for less aggressive filtering |
| High latency | Region mismatch | Deploy in same region as consuming application |
