---
name: fai-azure-key-vault-setup
description: |
  Set up Azure Key Vault with RBAC-only access, private networking, rotation policies,
  and audit logging. Use when centralizing secrets, keys, and certificates for AI
  workloads with compliance requirements.
---

# Azure Key Vault Setup

Provision and harden Key Vault with RBAC, private endpoints, rotation, and auditing.

## When to Use

- Centralizing secrets for AI service connections
- Setting up certificate management for mTLS
- Implementing key rotation policies for compliance
- Enabling audit logging for security reviews

---

## Bicep Provisioning

```bicep
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true        // RBAC-only, no access policies
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true          // Required for compliance
    publicNetworkAccess: 'Disabled'
    networkAcls: { defaultAction: 'Deny' }
  }
}

// Private endpoint
resource pe 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: '${kvName}-pe'
  location: location
  properties: {
    subnet: { id: subnetId }
    privateLinkServiceConnections: [{
      name: 'kv-link'
      properties: {
        privateLinkServiceId: keyVault.id
        groupIds: ['vault']
      }
    }]
  }
}
```

## RBAC Roles

| Role | Scope | Who |
|------|-------|-----|
| Key Vault Secrets User | Vault | App Managed Identities (read secrets) |
| Key Vault Secrets Officer | Vault | DevOps pipeline (set secrets) |
| Key Vault Administrator | Vault | Platform team only |
| Key Vault Crypto User | Vault | Services doing encryption/decryption |

```bash
# Grant app MI read-only secret access
az role assignment create \
  --assignee-object-id $APP_MI_ID \
  --role "Key Vault Secrets User" \
  --scope $KV_RESOURCE_ID
```

## Secret Management

```python
from azure.keyvault.secrets import SecretClient
from azure.identity import DefaultAzureCredential

client = SecretClient(
    vault_url="https://kv-prod.vault.azure.net",
    credential=DefaultAzureCredential()
)

# Get secret
api_key = client.get_secret("openai-api-key").value

# Set secret with expiration
from datetime import datetime, timedelta, timezone
client.set_secret("db-connection", "Server=...",
    expires_on=datetime.now(timezone.utc) + timedelta(days=90))
```

## Rotation Policy

```bash
# Set auto-rotation: generate new version every 90 days, notify 30 days before expiry
az keyvault secret set-attributes --vault-name $KV --name openai-key \
  --expires "$(date -u -d '+90 days' '+%Y-%m-%dT%H:%M:%SZ')"

# Event Grid notification for rotation
az eventgrid event-subscription create \
  --name secret-rotation-sub \
  --source-resource-id $KV_RESOURCE_ID \
  --endpoint $FUNCTION_ENDPOINT \
  --included-event-types Microsoft.KeyVault.SecretNearExpiry
```

## Diagnostic Logging

```bicep
resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'kv-audit'
  scope: keyVault
  properties: {
    workspaceId: logAnalytics.id
    logs: [{ category: 'AuditEvent', enabled: true, retentionPolicy: { days: 365 } }]
    metrics: [{ category: 'AllMetrics', enabled: true }]
  }
}
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| 403 Forbidden on secret access | Missing RBAC role (not access policy) | Grant Key Vault Secrets User to MI |
| Soft-deleted vault blocking recreate | Purge protection preventing deletion | Use `az keyvault recover` or wait for retention to expire |
| Secret rotation not firing | No Event Grid subscription for NearExpiry | Create event subscription for SecretNearExpiry |
| DNS resolution fails from VNet | Private endpoint DNS zone not linked | Link privatelink.vaultcore.azure.net to VNet |
