---
name: "rbac-setup-play"
description: "Set up RBAC role assignments for a solution play's Azure resources"
---

# RBAC Setup for AI Solution Plays

Configure least-privilege Azure RBAC for AI workloads — OpenAI, AI Search, Storage, Cosmos DB — using managed identities, reusable Bicep modules, and environment-tiered permissions.

## Common Role Reference Table

| Role Name | GUID | Typical Assignee |
|-----------|------|-------------------|
| Cognitive Services OpenAI User | `5e0bd9bd-7b93-4f28-af87-19fc36ad61bd` | App backend calling GPT |
| Cognitive Services OpenAI Contributor | `a001fd3d-188f-4b5d-821b-7da978bf7442` | CI/CD deploying models |
| Search Index Data Reader | `1407120a-92aa-4202-b7e9-c0e197c71c8f` | App reading search index |
| Search Index Data Contributor | `8ebe5a00-799e-43f5-93ac-243d3dce84a7` | Indexer writing to index |
| Search Service Contributor | `7ca78c08-252a-4471-8644-bb5ff32d4ba0` | CI/CD managing index schema |
| Storage Blob Data Reader | `2a2b9908-6ea1-4ae2-8e65-a410df84e7d1` | App reading documents |
| Storage Blob Data Contributor | `ba92f5b4-2d11-453d-a403-e96b0029c9fe` | Indexer writing chunks |
| Cosmos DB Account Reader | `fbdf93bf-df7d-467e-a4d2-9458aa1360c8` | App reading chat history |
| Cosmos DB Operator | `230815da-be43-4aae-9cb4-875f7bd000aa` | App writing chat sessions |
| Key Vault Secrets User | `4633458b-17de-408a-b874-0445c86b69e6` | App reading secrets |

## Managed Identity vs Service Principal

**Always prefer managed identity** for Azure-hosted workloads. Service principals are only for external CI/CD (GitHub Actions OIDC) or on-prem agents.

```bicep
// System-assigned identity on Container Apps — no credential management
resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  identity: {
    type: 'SystemAssigned'
  }
  // ...
}

// User-assigned identity — share across multiple resources
resource uami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${workloadName}-${env}'
  location: location
}
```

For GitHub Actions, use OIDC federated credentials — never store client secrets:
```bash
az ad app federated-credential create --id $APP_ID \
  --parameters '{"name":"gh-deploy","issuer":"https://token.actions.githubusercontent.com",
  "subject":"repo:org/repo:environment:production","audiences":["api://AzureADTokenExchange"]}'
```

## Reusable Bicep Role Assignment Module

Create `infra/modules/role-assignment.bicep` — one module for all role grants:

```bicep
@description('Principal ID of the managed identity or service principal')
param principalId string

@description('Role definition ID (GUID only, no full resource path)')
param roleDefinitionId string

@description('Target resource ID to scope the assignment to')
param resourceId string

@allowed(['ServicePrincipal', 'User', 'Group'])
param principalType string = 'ServicePrincipal'

// Deterministic name prevents duplicate assignments on redeploy
var assignmentName = guid(resourceId, roleDefinitionId, principalId)

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: assignmentName
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions', roleDefinitionId)
    principalId: principalId
    principalType: principalType
  }
}
```

## Wiring Role Assignments in main.bicep

```bicep
// Grant app identity → OpenAI User on the Cognitive Services account
module appToOpenAI 'modules/role-assignment.bicep' = {
  name: 'rbac-app-openai-user'
  params: {
    principalId: app.identity.principalId
    roleDefinitionId: '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd' // OpenAI User
    resourceId: cognitiveAccount.id
  }
}

// Grant app identity → Search Index Data Reader
module appToSearch 'modules/role-assignment.bicep' = {
  name: 'rbac-app-search-reader'
  params: {
    principalId: app.identity.principalId
    roleDefinitionId: '1407120a-92aa-4202-b7e9-c0e197c71c8f' // Search Index Data Reader
    resourceId: searchService.id
  }
}

// Grant app identity → Storage Blob Data Reader
module appToBlob 'modules/role-assignment.bicep' = {
  name: 'rbac-app-blob-reader'
  params: {
    principalId: app.identity.principalId
    roleDefinitionId: '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1'
    resourceId: storageAccount.id
  }
}

// Grant indexer identity → Storage Blob Data Contributor + Search Index Data Contributor
module indexerToBlob 'modules/role-assignment.bicep' = {
  name: 'rbac-indexer-blob-contrib'
  params: {
    principalId: indexerIdentity.properties.principalId
    roleDefinitionId: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
    resourceId: storageAccount.id
  }
}
```

## Environment-Specific RBAC Strategy

| Concern | Dev | Prod |
|---------|-----|------|
| Developer access | Cognitive Services OpenAI Contributor | No direct access — deploy via CI/CD only |
| App identity | OpenAI User + Blob Contributor (debug) | OpenAI User + Blob Reader (read-only) |
| Index management | Search Service Contributor for devs | Search Index Data Reader for app only |
| Key Vault | Key Vault Administrator for devs | Key Vault Secrets User for app identity |
| Cosmos DB | Cosmos DB Operator | Cosmos DB Account Reader (writes via SDK RBAC) |

Implement with a Bicep parameter:

```bicep
@allowed(['dev', 'staging', 'prod'])
param environment string

// Dev gets Blob Contributor; prod gets Blob Reader
var blobRoleId = environment == 'prod'
  ? '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1'  // Reader
  : 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'  // Contributor
```

## Custom Role Definition

When built-in roles are too broad, create a scoped custom role:

```bicep
resource customRole 'Microsoft.Authorization/roleDefinitions@2022-04-01' = {
  name: guid(subscription().id, 'fai-ai-app-reader')
  properties: {
    roleName: 'FAI AI App Reader'
    description: 'Read-only access to OpenAI completions and search queries'
    type: 'CustomRole'
    assignableScopes: [resourceGroup().id]
    permissions: [
      {
        actions: [
          'Microsoft.CognitiveServices/accounts/deployments/read'
          'Microsoft.Search/searchServices/indexes/read'
        ]
        dataActions: [
          'Microsoft.CognitiveServices/accounts/OpenAI/deployments/chat/completions/action'
          'Microsoft.Search/searchServices/indexes/documents/search/action'
        ]
        notActions: []
        notDataActions: []
      }
    ]
  }
}
```

## RBAC Audit Script

Run after deployment to verify all assignments are correct:

```bash
#!/usr/bin/env bash
set -euo pipefail

RG="${1:?Usage: audit-rbac.sh <resource-group>}"

echo "=== RBAC Audit: $RG ==="

# List all role assignments in the resource group
az role assignment list --resource-group "$RG" \
  --query "[].{Principal:principalName, Role:roleDefinitionName, Scope:scope}" \
  -o table

# Check for overprivileged assignments (Owner/Contributor on prod)
OVERPRIVILEGED=$(az role assignment list --resource-group "$RG" \
  --query "[?roleDefinitionName=='Owner' || roleDefinitionName=='Contributor'].principalName" -o tsv)

if [ -n "$OVERPRIVILEGED" ]; then
  echo "⚠️  Overprivileged principals found:"
  echo "$OVERPRIVILEGED"
  exit 1
fi

# Verify managed identity assignments exist for required roles
REQUIRED_ROLES=("Cognitive Services OpenAI User" "Search Index Data Reader" "Storage Blob Data Reader")
for role in "${REQUIRED_ROLES[@]}"; do
  COUNT=$(az role assignment list --resource-group "$RG" \
    --query "[?roleDefinitionName=='$role'] | length(@)" -o tsv)
  if [ "$COUNT" -eq 0 ]; then
    echo "❌ Missing assignment: $role"
  else
    echo "✅ $role: $COUNT assignment(s)"
  fi
done
```

## Troubleshooting Access Denied

| Error | Cause | Fix |
|-------|-------|-----|
| `403 Principal does not have access` | Role assignment missing or not yet propagated | Add assignment; wait 5-10 min for propagation |
| `AuthorizationFailed` on deployment | Deployer lacks `Microsoft.Authorization/roleAssignments/write` | Grant deployer **User Access Administrator** or **Owner** on the RG |
| OpenAI returns `Access denied due to Virtual Network/Firewall` | Network rules block identity | Add app subnet to Cognitive Services network ACL |
| `The caller does not have permission on the data plane` | Using control-plane role instead of data-plane | Switch from `Cognitive Services Contributor` to `OpenAI User` (data action) |
| Search returns `403` on query but index exists | Wrong role — service-level vs index-level | Use `Search Index Data Reader` (data), not `Search Service Reader` (control) |
| Cosmos DB `Request blocked by Auth` | RBAC not enabled on account | Set `disableLocalAuth: true` and assign `Cosmos DB Operator` or built-in data role |
| Role assignment succeeds but app still fails | Identity token cached with old claims | Restart the app or wait for token refresh (~1 hour for MI tokens) |

## Least Privilege Checklist

- [ ] App identity has **only** data-plane roles — never Owner/Contributor
- [ ] Indexer identity separated from app identity with write-scoped roles
- [ ] Dev team uses **PIM** (Privileged Identity Management) for elevated access
- [ ] No API keys — `disableLocalAuth: true` on OpenAI, Search, Cosmos, Storage
- [ ] Custom roles scoped to resource group, not subscription
- [ ] CI/CD uses OIDC federation — no stored secrets
- [ ] Role assignments use `principalType: 'ServicePrincipal'` to prevent name conflicts
