---
name: fai-azure-resource-health
description: |
  Monitor Azure resource health with alert routing, incident enrichment, and service
  impact triage. Use when setting up proactive health monitoring, outage detection,
  or automated incident response for AI workloads.
---

# Azure Resource Health Monitoring

Set up proactive health monitoring with alerts, enrichment, and incident workflows.

## When to Use

- Detecting Azure platform issues affecting your AI workload
- Setting up proactive alerts for resource degradation
- Enriching incident tickets with platform health context
- Distinguishing between app bugs and platform outages

---

## Alert Setup

```bicep
resource healthAlert 'Microsoft.Insights/activityLogAlerts@2023-01-01-preview' = {
  name: 'resource-health-alert'
  location: 'Global'
  properties: {
    enabled: true
    scopes: [resourceGroup().id]
    condition: {
      allOf: [
        { field: 'category', equals: 'ResourceHealth' }
        { field: 'resourceType', equals: 'Microsoft.CognitiveServices/accounts' }
        { field: 'status', containsAny: ['Active', 'In Progress'] }
      ]
    }
    actions: {
      actionGroups: [{ actionGroupId: actionGroup.id }]
    }
  }
}
```

## KQL Health Queries

```kql
// Resource health events in last 24 hours
AzureActivity
| where CategoryValue == "ResourceHealth"
| where TimeGenerated > ago(24h)
| project TimeGenerated, ResourceId, OperationNameValue,
    Status=tostring(Properties.currentHealthStatus),
    PreviousStatus=tostring(Properties.previousHealthStatus),
    Cause=tostring(Properties.cause)
| order by TimeGenerated desc

// Service health impact summary
ServiceHealthResources
| where type == 'microsoft.resourcehealth/events'
| where properties.EventType == 'ServiceIssue'
| project name, status=tostring(properties.Status),
    impactStartTime=todatetime(properties.ImpactStartTime),
    services=tostring(properties.Impact)
| order by impactStartTime desc
```

## CLI Health Check

```bash
# Check specific resource health
az resource show --ids $RESOURCE_ID \
  --api-version 2023-07-01-preview \
  --query "properties.availabilityState" -o tsv

# List recent health events
az rest --method GET \
  --url "https://management.azure.com/subscriptions/$SUB/providers/Microsoft.ResourceHealth/events?api-version=2024-02-01" \
  --query "value[].{Name:name, Status:properties.status, Impact:properties.impactedServices}"
```

## Incident Enrichment Pattern

```python
def enrich_incident(resource_id: str) -> dict:
    """Add platform health context to incident tickets."""
    from azure.mgmt.resourcehealth import ResourceHealthMgmtClient
    from azure.identity import DefaultAzureCredential

    client = ResourceHealthMgmtClient(DefaultAzureCredential(), subscription_id)
    status = client.availability_statuses.get_by_resource(resource_id)

    return {
        "resource_id": resource_id,
        "availability": status.properties.availability_state,  # Available/Degraded/Unavailable
        "reason": status.properties.reason_type,  # PlatformInitiated/UserInitiated
        "summary": status.properties.summary,
        "is_platform_issue": status.properties.reason_type == "PlatformInitiated",
    }
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Incidents detected late | No alert rule configured | Add activity log alert for ResourceHealth events |
| False positives on health | Transient platform resets | Filter on status Active only, ignore Resolved |
| Can't distinguish app vs platform | No enrichment in runbook | Add Resource Health API call to incident workflow |
| Alert noise too high | Scope too broad | Scope alerts to specific resource types |
