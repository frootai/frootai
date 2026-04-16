---
name: fai-azure-ai-foundry-setup
description: Provision Azure AI Foundry Hub and Project with Managed Identity RBAC, private endpoint networking, connected Azure AI Services and Key Vault — ready for Prompt Flow evaluation pipelines and model fine-tuning.
---

# FAI Azure AI Foundry Setup

Provisions an Azure AI Foundry Hub and Project using Infrastructure as Code, with correct RBAC, private networking, and connected resource topology. Prevents the most common setup mistakes: missing role assignments that cause silent access failures, public endpoints left open after networking is locked down, and disconnected AI Services that break Prompt Flow.

## When to Invoke

| Signal | Example |
|--------|---------|
| Starting a new AI Foundry workspace | No Hub or Project exists in the subscription |
| Prompt Flow jobs failing with auth errors | `AuthenticationError` on a connected resource |
| Fine-tuning requires private endpoint | Compliance requirement: no public internet |
| Team members cannot access Foundry portal | Missing role assignments on Hub or Project |

## Workflow

### Step 1 — Bicep Template (Hub + Project)

```bicep
// infra/ai-foundry.bicep
param location string = resourceGroup().location
param hubName string
param projectName string
param keyVaultId string
param storageAccountId string
param aiServicesId string

// AI Foundry Hub
resource hub 'Microsoft.MachineLearningServices/workspaces@2024-04-01' = {
  name: hubName
  location: location
  kind: 'Hub'
  identity: { type: 'SystemAssigned' }
  sku: { name: 'Basic', tier: 'Basic' }
  properties: {
    friendlyName: hubName
    keyVault: keyVaultId
    storageAccount: storageAccountId
    publicNetworkAccess: 'Disabled'
    managedNetwork: { isolationMode: 'AllowOnlyApprovedOutbound' }
  }
}

// AI Foundry Project (child of Hub)
resource project 'Microsoft.MachineLearningServices/workspaces@2024-04-01' = {
  name: projectName
  location: location
  kind: 'Project'
  identity: { type: 'SystemAssigned' }
  sku: { name: 'Basic', tier: 'Basic' }
  properties: {
    hubResourceId: hub.id
    friendlyName: projectName
  }
}

// Connected AI Services resource (Managed Identity auth -- no API key stored)
resource connection 'Microsoft.MachineLearningServices/workspaces/connections@2024-04-01' = {
  parent: hub
  name: 'azure-ai-services'
  properties: {
    category: 'AzureOpenAI'
    authType: 'ManagedIdentity'
    target: reference(aiServicesId, '2023-05-01').properties.endpoint
  }
}

output hubPrincipalId string = hub.identity.principalId
output projectName string = project.name
```

### Step 2 — RBAC Role Assignments

```bicep
// Role assignments -- Hub MSI needs access to connected resources
var cogServiceUserRoleId     = 'a97b65f3-24c7-4dca-a6f8-7efbf3d41ef0'
var storageBlobContribRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
var kvSecretsUserRoleId      = '4633458b-17de-408a-b874-0445c86b69e0'

resource hubKeyVaultRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVaultId, hub.id, kvSecretsUserRoleId)
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
    principalId: hub.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource hubAiServicesRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(aiServicesId, hub.id, cogServiceUserRoleId)
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cogServiceUserRoleId)
    principalId: hub.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource hubStorageRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccountId, hub.id, storageBlobContribRoleId)
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobContribRoleId)
    principalId: hub.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

### Step 3 — Private Endpoint Configuration

```bicep
// Private endpoint for Hub workspace
resource hubPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-04-01' = {
  name: '${hubName}-pe'
  location: location
  properties: {
    subnet: { id: privateSubnetId }
    privateLinkServiceConnections: [{
      name: '${hubName}-plsc'
      properties: {
        privateLinkServiceId: hub.id
        groupIds: ['amlworkspace']
      }
    }]
  }
}
```

### Step 4 — Verify Setup with Python SDK

```python
from azure.ai.ml import MLClient
from azure.identity import DefaultAzureCredential

client = MLClient(
    credential=DefaultAzureCredential(),
    subscription_id=SUBSCRIPTION_ID,
    resource_group_name=RESOURCE_GROUP,
    workspace_name=PROJECT_NAME,
)

# Verify workspace access
ws = client.workspaces.get(PROJECT_NAME)
print(f"Workspace: {ws.name}, Hub: {ws.hub_resource_id}")

# List available model deployments via connections
connections = list(client.connections.list())
for conn in connections:
    print(f"  {conn.name}: {conn.type} -> {conn.target}")
```

### Step 5 — Initialize Prompt Flow Environment

```bash
# Install Prompt Flow CLI
pip install promptflow promptflow-azure

# Connect to the project
pf config set connection.provider=azureml://subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.MachineLearningServices/workspaces/${PROJECT_NAME}

# List available connections
pf connection list

# Run a quick end-to-end test
pf flow run --flow ./flows/chat-basic --data ./flows/test-data.jsonl
```

## RBAC Reference

| Role | Assigned To | Scope | Purpose |
|------|------------|-------|---------|
| AI Developer | Hub MSI | AI Services | Prompt Flow completions |
| Cognitive Services User | Hub MSI | AI Services | Embedding calls |
| Key Vault Secrets User | Hub MSI | Key Vault | Secret reads |
| Storage Blob Contributor | Hub MSI | Storage | Artifact writes |
| AzureML Data Scientist | User identities | Project | Model training and eval |

## WAF Alignment

| Pillar | Contribution |
|--------|-------------|
| Security | Managed Identity on Hub eliminates credential storage; private endpoint blocks public internet access |
| Reliability | Connected resource health monitoring via Azure Monitor on the Hub |
| Operational Excellence | IaC Bicep ensures reproducible environments across dev/staging/prod |

## Compatible Solution Plays

- **Play 01** — Enterprise RAG (AI Search + OpenAI connections)
- **Play 13** — Fine-Tuning Workflow (compute + dataset management)
- **Play 02** — AI Landing Zone (Hub inside spoke network)

## Notes

- Hub must be created before Project -- `kind: 'Hub'` vs `kind: 'Project'`
- `managedNetwork.isolationMode: 'AllowOnlyApprovedOutbound'` is required for HIPAA/PCI compliance
- Wait ~5 minutes after Bicep deploy for Managed Network provisioning to complete before creating connections
- Private endpoint DNS zone `*.api.azureml.ms` must be linked to the Hub's VNet
