---
name: fai-managed-identity-setup
description: |
  Set up Azure Managed Identity with least-privilege RBAC role assignments
  for AI workloads. Use when connecting services to Azure OpenAI, Storage,
  Key Vault, or other resources without credentials.
---

# Managed Identity Setup

Configure Managed Identity with RBAC for credential-free Azure service access.

## When to Use

- Connecting an app to Azure OpenAI without API keys
- Setting up service-to-service auth with least-privilege
- Replacing connection strings with identity-based access
- Configuring user-assigned identity for multi-service scenarios

---

## System-Assigned vs User-Assigned

| Type | Use When |
|------|----------|
| System-assigned | Single service, lifecycle tied to resource |
| User-assigned | Shared across services, pre-created |

## Enable System-Assigned MI

```bicep
resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  identity: { type: 'SystemAssigned' }
  // ...
}
```

## RBAC Assignment

```bicep
var roles = {
  openAIUser: '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'
  blobReader: '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1'
  kvSecretsUser: '4633458b-17de-408a-b874-0445c86b69e6'
}

resource openAIRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(openAI.id, app.id, roles.openAIUser)
  scope: openAI
  properties: {
    principalId: functionApp.identity.principalId
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions', roles.openAIUser)
    principalType: 'ServicePrincipal'
  }
}
```

## Python SDK with MI

```python
from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from openai import AzureOpenAI

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)
client = AzureOpenAI(
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    azure_ad_token_provider=token_provider,
    api_version="2024-10-21",
)
```

## .NET with MI

```csharp
var client = new AzureOpenAIClient(
    new Uri(endpoint), new DefaultAzureCredential());
```

## Common Role Assignments

| Service | Role | Purpose |
|---------|------|---------|
| Azure OpenAI | Cognitive Services OpenAI User | Call completions/embeddings |
| Blob Storage | Storage Blob Data Reader | Read documents |
| Key Vault | Key Vault Secrets User | Read secrets |
| AI Search | Search Index Data Reader | Query indexes |
| App Config | App Configuration Data Reader | Read config |
| Cosmos DB | Cosmos DB Built-in Data Contributor | Read/write data |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| 403 Forbidden | Role not assigned or wrong scope | Verify role + scope, wait 5min for propagation |
| Token acquisition fails | MI not enabled on resource | Enable identity in resource config |
| Works locally, fails in Azure | Local uses different credential | DefaultAzureCredential tries MI first in Azure |
| Multiple identities conflict | Both system + user assigned | Specify clientId for user-assigned |
