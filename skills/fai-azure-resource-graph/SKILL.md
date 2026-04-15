---
name: fai-azure-resource-graph
description: |
  Query Azure estate with Resource Graph KQL for governance, compliance audits,
  and resource inventory at scale. Use when building cross-subscription dashboards,
  tag compliance reports, or resource drift detection.
---

# Azure Resource Graph

Query and govern Azure resources at scale with KQL patterns and compliance automation.

## When to Use

- Auditing resource configurations across subscriptions
- Building compliance dashboards (tag enforcement, SKU checks)
- Detecting drift from desired state
- Generating resource inventory exports

---

## Common KQL Queries

```kql
// All resources missing required tags
Resources
| where isnull(tags['env']) or isnull(tags['owner']) or isnull(tags['costCenter'])
| project name, type, resourceGroup, subscriptionId,
    missingTags = pack_array(
        iff(isnull(tags['env']), 'env', ''),
        iff(isnull(tags['owner']), 'owner', ''),
        iff(isnull(tags['costCenter']), 'costCenter', ''))
| mv-expand missingTags
| where missingTags != ''

// Resources with public endpoints
Resources
| where properties.publicNetworkAccess == 'Enabled'
    or properties.networkRuleSet.defaultAction == 'Allow'
| project name, type, resourceGroup, subscriptionId

// Cognitive Services accounts by SKU and region
Resources
| where type == 'microsoft.cognitiveservices/accounts'
| project name, location, sku=tostring(properties.sku.name),
    kind=tostring(kind), publicAccess=tostring(properties.publicNetworkAccess)
```

## CLI Usage

```bash
# Query across all subscriptions
az graph query -q "Resources | summarize count() by type | order by count_ desc" \
  --first 20 -o table

# Export non-compliant resources to CSV
az graph query -q "Resources | where isnull(tags['owner'])" \
  --first 1000 -o csv > untagged-resources.csv
```

## Python SDK

```python
from azure.mgmt.resourcegraph import ResourceGraphClient
from azure.mgmt.resourcegraph.models import QueryRequest
from azure.identity import DefaultAzureCredential

client = ResourceGraphClient(DefaultAzureCredential())

query = QueryRequest(
    query="Resources | where type =~ 'microsoft.cognitiveservices/accounts' | project name, location, sku=properties.sku.name",
    subscriptions=[sub_id],
)
result = client.resources(query)
for row in result.data:
    print(f"{row['name']} ({row['location']}) - {row['sku']}")
```

## Scheduled Compliance Report

```bash
#!/bin/bash
# Run weekly via GitHub Actions or Azure Automation
DATE=$(date +%Y-%m-%d)
az graph query -q "Resources | where isnull(tags['owner'])" \
  --first 5000 -o csv > "reports/untagged-$DATE.csv"
az graph query -q "Resources | where properties.publicNetworkAccess == 'Enabled'" \
  --first 5000 -o csv > "reports/public-endpoints-$DATE.csv"
echo "Compliance report generated for $DATE"
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Query returns empty results | Scope limited to wrong subscription | Pass all subscription IDs to query |
| Throttling (429) | Too many queries per second | Batch queries, cache results |
| Stale data | Resource Graph has ~5min propagation delay | Use for auditing, not real-time checks |
| Property not available | ARM property not indexed in Graph | Check Resource Graph table schema docs |

