---
name: fai-azure-key-vault-setup
description: Configure Azure Key Vault with managed identities, RBAC, secret rotation policies, customer-managed keys (CMK), and app integration patterns — avoiding hardcoded secrets and enabling compliant AI workload credential management.
---

# FAI Azure Key Vault

Provisions Azure Key Vault with role-based access control (RBAC), rotation policies, soft-delete and purge protection, customer-managed encryption keys (CMK), and demonstrates Managed Identity integration for AI services. Eliminates inline secrets from configuration; enforces audit logging, access reviews, and compliance check patterns.

## When to Invoke

| Signal | Example |
|--------|---------|
| Secrets in code committed | API keys in `.env` or config files |
| No rotation policy exists | Same credentials since deployment |
| Multi-service credential access unsafe | Multiple apps using one admin key |
| Regulatory compliance required | HIPAA, PCI-DSS, or ISO 27001 audits pending |

## Workflow

### Step 1 — Provision Key Vault with RBAC

```bicep
// infra/keyvault.bicep
param keyvaultName string
param location string
param principalId string  // Managed Identity object ID

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyvaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    accessPolicies: []  // RBAC only, no legacy policies
  }
}

// Grant Managed Identity secret read access
resource rbacSecretRead 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, principalId, subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6'))
  scope: keyVault
  properties: {
    principalId: principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')  // Key Vault Secrets User
  }
}

// Admin gets full access for initial setup only
resource rbacAdminAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, deployment().identity.principalId)
  scope: keyVault
  properties: {
    principalId: deployment().identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '00482a5a-887f-4fb3-b363-3b7fe8e74483')  // Key Vault Administrator
  }
}

output keyVaultId string = keyVault.id
output keyVaultUri string = keyVault.properties.vaultUri
```

### Step 2 — Store Secrets with Rotation Policies

```bicep
// infra/secrets.bicep
param keyVaultUri string

resource openaiKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: '${split(keyVaultUri, '/')[4]}/openai-api-key'
  properties: {
    value: openaiApiKey
    attributes: {
      enabled: true
      expires: dateTimeToEpoch(dateTimeAdd(utcNow('u'), 'P365D'))  // 1-year expiry
    }
  }
}

// Rotation policy: automatic renewal before expiry
resource rotationPolicy 'Microsoft.KeyVault/vaults/secrets/rotationPolicy@2023-07-01' = {
  name: '${split(keyVaultUri, '/')[4]}/openai-api-key/rotationpolicy'
  properties: {
    lifetimeActions: [
      {
        trigger: {
          timeBeforeExpiry: 'P30D'  // 30 days before expiry
        }
        action: {
          type: 'Notify'  // Send event to Event Grid for orchestration
        }
      }
    ]
    expiryTime: 'P365D'
  }
}
```

### Step 3 — Managed Identity Integration in Python

```python
# app/ai_client.py
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient
import os

# Use Managed Identity to authenticate to Key Vault (zero secrets in code)
credential = DefaultAzureCredential(
    exclude_environment_credential=True,
    exclude_powershell_credential=True,
)

vault_url = os.environ["AZURE_KEYVAULT_URL"]
secretClient = SecretClient(vault_url=vault_url, credential=credential)

# Retrieve secret securely
openai_key = secretClient.get_secret("openai-api-key").value

# Use secret to initialize client
from azure.ai.openai import AzureOpenAI

client = AzureOpenAI(
    api_key=openai_key,
    api_version="2024-02-01",
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
)
```

### Step 4 — Customer-Managed Keys (CMK) for Encryption

```bicep
// infra/cmk.bicep
param keyVaultUri string

// Create RSA key for encryption
resource encryptionKey 'Microsoft.KeyVault/vaults/keys@2023-07-01' = {
  name: '${split(keyVaultUri, '/')[4]}/data-encryption-key'
  properties: {
    enabled: true
    kty: 'RSA'
    keySize: 4096
    keyOps: [ 'encrypt', 'decrypt' ]
  }
}

// Enable Cosmos DB to use CMK
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: cosmosAccountName
  location: location
  properties: {
    // ... standard properties
    keyVaultKeyUri: '${keyVaultUri}keys/${encryptionKey.name}/version'
  }
}

// Enable Storage Account to use CMK
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  properties: {
    encryption: {
      services: {
        blob: { enabled: true }
      }
      keySource: 'Microsoft.Keyvault'
      keyvaultproperties: {
        keyvaulturi: keyVaultUri
        keyname: encryptionKey.name
        keyversion: encryptionKey.properties.keyVersion
      }
    }
  }
}
```

### Step 5 — Audit Logging and Compliance

```python
# scripts/audit_vault_access.py
from azure.monitor.query import LogsQueryClient
from azure.identity import DefaultAzureCredential
import json

credential = DefaultAzureCredential()
logs_client = LogsQueryClient(credential)

# Query Key Vault access logs
query = """
AuditLogs
| where TargetResources[0].type == "Microsoft.KeyVault/vaults"
| where ActivityDisplayName in ("Get Secret", "Create Secret", "Update Secret")
| summarize Count=count() by InitiatedBy.user.userPrincipalName, ActivityDisplayName
| sort by Count desc
"""

response = logs_client.query_workspace(
    workspace_id=os.environ["LOG_ANALYTICS_WORKSPACE_ID"],
    query=query,
)

print(json.dumps([row for table in response for row in table], indent=2))

# Compliance check: Secrets without rotation policy
no_rotation = """
KeyVaultSecretMetadata
| where expiryTime == ""
| summarize count() by SecretName
"""
```

## RBAC Role Reference

| Role | Permissions | Use Case |
|------|-------------|----------|
| Key Vault Administrator | Create, delete, rotate secrets/keys | Initial setup and rotation automation |
| Key Vault Secrets User | Read secrets | Application runtime (Managed Identity) |
| Key Vault Crypto User | Encrypt/decrypt with keys | App encryption operations |
| Key Vault Reader | Read metadata only | Audit and compliance teams |

## Retention & Compliance

| Policy | Setting | Rationale |
|--------|---------|-----------|
| Soft Delete | 90 days | Recover accidental deletion |
| Purge Protection | Enabled | Prevent permanent deletion during retention |
| Secret Expiry | 365 days | Force rotation at least annually |
| Audit Logging | All operations | Compliance and forensics |

## WAF Alignment

| Pillar | Contribution |
|--------|-------------|
| Security | RBAC prevents overprivileged access; Managed Identity eliminates credential exposure; CMK controls encryption |
| Compliance | Audit logs enable regulatory reviews; rotation policies enforce credential freshness |
| Operational Excellence | Automatic rotation reduces manual key management; soft-delete prevents outages |

## Compatible Solution Plays

- **Play 01** — Enterprise RAG (embedding endpoint credential management)
- **Play 02** — AI Landing Zone (centralized credential hub)
- **Play 35** — Compliance & Audit (encryption key custody)

## Notes

- Never grant `Key Vault Administrator` to applications; use scoped roles (Secrets User, Crypto User)
- Enable purge protection on production vaults to prevent accidental permanent deletion
- Rotate secrets at least every 365 days; use Event Grid automation to trigger Key Vault rotation tasks
- Audit logs are created automatically; query via Log Analytics or Storage Account export
