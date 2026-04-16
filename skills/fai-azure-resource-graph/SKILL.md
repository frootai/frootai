---
name: fai-azure-resource-graph
description: Query Azure Resource Graph across subscriptions with KQL for compliance audits, cost analysis, RBAC reviews, and cross-tenant resource discovery — enabling unified visibility into sprawling AI infrastructure.
---

# FAI Azure Resource Graph

Queries Azure Resource Graph using Kusto Query Language (KQL) to analyze resources across subscriptions and tenants in real-time. Enables compliance audits (unused resources, encryption gaps), cost attribution (resource tags vs billing), RBAC reviews (privileged role assignments), and inventory discovery for AI workloads. Eliminates manual loops through subscriptions or portal; scales to thousands of resources.

## When to Invoke

| Signal | Example |
|--------|---------|
| Compliance audit needed | Query all VMs missing encryption or storage accounts without public access disabled |
| Cost attribution unclear | Find all resources tagged by team, then sum costs per team via billing API |
| RBAC review required | Discover all users with Contributor/Owner roles (security risk) |
| Resource discovery | Inventory all Azure OpenAI endpoints and their deployment SKUs across subscriptions |

## Workflow

### Step 1 — Authenticate and Set Subscription Scope

```bash
# Login and target multiple subscriptions for query
az login

# View current subscription
az account show --query name -o tsv

# Run query across all subscriptions (or specify --subscriptions)
az graph query -q "Resources | where type == 'microsoft.cognitiveservices/accounts/deployments' | project id, name, type" --subscriptions "sub-1,sub-2,sub-3"
```

### Step 2 — Inventory Resource Types and Tags

```kusto
// List all resource types with count (audit completeness)
Resources
| summarize Count = count() by type
| sort by Count desc

// Find resources missing mandatory tags (compliance risk)
Resources
| where tags !has "Owner" or tags !has "CostCenter"
| summarize UntaggedCount = count() by tostring(type)
| project type, UntaggedCount
```

### Step 3 — Encryption & Security Audit

```kusto
// Find unencrypted storage accounts (compliance violation)
Resources
| where type == 'microsoft.storage/storageaccounts'
| extend EncryptionStatus = properties.encryption.services.blob.enabled
| where EncryptionStatus != true
| project id, name, EncryptionStatus, resourceGroup

// Identify all Key Vaults without purge protection
Resources
| where type == 'microsoft.keyvault/vaults'
| extend PurgeProtection = properties.enablePurgeProtection
| where PurgeProtection != true
| project id, name, PurgeProtection
```

### Step 4 — RBAC and Access Review

```kusto
// Discover all users/apps with Contributor role (security risk)
authorizationResources
| where type == 'microsoft.authorization/roleassignments'
| where properties.roleDefinitionId contains 'b24988ac-6180-42a0-ab88-20f7382dd24c'  // Contributor
| extend AssigneeType = properties.principalType
| project id, assigneeType=AssigneeType, scope=properties.scope, createdOn=properties.createdOn

// Find stale role assignments (not used in 90 days via risk analysis)
authorizationResources
| where type == 'microsoft.authorization/roleassignments'
| project id, principalId=properties.principalId, scope=properties.scope, createdOn=properties.createdOn
| join kind=inner (AuditLogs | where ActivityDisplayName == "Add member to role") on $left.principalId == $right.TargetResources[0].id
```

### Step 5 — Cost Attribution by Tag

```kusto
// Summarize AI workload costs by team (via tag)
Resources
| where type =~ 'microsoft.cognitiveservices/accounts' or type =~ 'microsoft.compute/virtualmachines'
| extend Team = tags.team, CostCenter = tags.costcenter
| project id, name, type, Team, CostCenter
| summarize ResourceCount = count() by Team, CostCenter

// Find orphaned/unused resources (no activity in 30 days)
Resources
| where type in ('microsoft.compute/virtualmachines', 'microsoft.storage/storageaccounts', 'microsoft.keyvault/vaults')
| extend LastActivityTime = properties.provisioningState
| project id, name, type, LastActivityTime
```

## KQL Query Patterns

| Pattern | Example | Use Case |
|---------|---------|----------|
| **Resource Filter** | `where type == 'microsoft.cognitiveservices/accounts'` | Find all OpenAI endpoints |
| **Tag Query** | `where tags.team == 'ai-platform'` | Filter by business unit |
| **Property Projection** | `project id, name, properties.sku.name` | Extract specific fields |
| **Aggregation** | `summarize count() by properties.location` | Compliance/cost by region |
| **Join** | `join kind=inner (AuditLogs)` | Cross-reference activity logs |

## Python Integration

```python
# scripts/resource_audit.py
from azure.identity import DefaultAzureCredential
from azure.mgmt.resourcegraph import ResourceGraphClient
from azure.mgmt.resourcegraph.models import QueryRequest

credential = DefaultAzureCredential()
client = ResourceGraphClient(credential)

# Query: all Azure OpenAI accounts without private endpoint
query = """
Resources
| where type == 'microsoft.cognitiveservices/accounts'
| where kind == 'OpenAI'
| where properties.publicNetworkAccess != 'Disabled'
| project id, name, publicAccess=properties.publicNetworkAccess
"""

request = QueryRequest(query=query, subscriptions=["sub-id-1", "sub-id-2"])
response = client.resources(request)

print(f"Found {len(response.data)} OpenAI accounts without private endpoint protection:")
for resource in response.data:
    print(f"  {resource['name']} (public access: {resource['publicAccess']})")
```

## WAF Alignment

| Pillar | Contribution |
|--------|-------------|
| Security | Identify unencrypted resources, overprivileged role assignments, missing network isolation |
| Compliance | Audit encryption, tag enforcement, RBAC reviews across all subscriptions |
| Cost Optimization | Attribute costs by tag; discover orphaned resources; right-size SKUs |
| Operational Excellence | Inventory infrastructure; track resource drift; generate compliance reports |

## Compatible Solution Plays

- **Play 02** — AI Landing Zone (enterprise compliance audit)
- **Play 35** — Compliance & Audit (automated security posture scanning)
- **Play 52** — FinOps and Cost Management (cost attribution by team)

## Notes

- Resource Graph queries execute in seconds across thousands of resources
- Limit subscriptions in `--subscriptions` to reduce query scope if needed
- Store query results in CSV/JSON for compliance report generation
- Schedule regular RBAC and encryption audits via GitHub Actions or Azure Automation--|
| Timeout | Slow dependency | Increase timeout_seconds |
| Auth failure | Expired credentials | Refresh Managed Identity |
| Missing config | No fai-manifest.json | Create manifest or pass config_path |
| Validation error | Invalid input | Check parameter types and ranges |

## Notes

- This skill follows the FAI SKILL.md specification
- All outputs are deterministic when `dry_run=true`
- Integrates with FAI Engine for automated pipeline execution
- Part of the Azure Integration category in the FAI primitives catalog