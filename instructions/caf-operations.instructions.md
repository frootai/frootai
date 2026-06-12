---
description: "Cloud Adoption Framework — Operations domain. Log Analytics, AMA + Container Insights, alert rules, patch lifecycle, Azure Backup, Service Health alerts, Activity Log retention. Enforced by CAF-O-001..011."
applyTo: "**/*.bicep, **/*.bicepparam, **/parameters.json, **/*.tf, **/*.tfvars, **/azure.yaml"
caf:
  - "operations"
---

# CAF — Operations Domain

When authoring or reviewing IaC for the **Operations** plane, enforce these standards. Aligned to FAI's `caf-validator/checks/operations.py` (CAF-O-001..011, 7 enforceable checks).

## CAF-O-001 — Centralized Log Analytics workspace
- Production subscriptions MUST link to a single centralized `Microsoft.OperationalInsights/workspaces`
- Retention: minimum 90 days for prod, 365 days for security-sensitive workloads
- Forbidden: workload-local workspaces that fragment query scope

## CAF-O-002 — Azure Monitor Agent on VMs + Container Insights on AKS
- Every VM MUST have `Microsoft.Compute/virtualMachines/extensions` of type `AzureMonitorLinuxAgent` or `AzureMonitorWindowsAgent`
- Every AKS cluster MUST have `addonProfiles.omsagent.enabled = true` (Container Insights)
- Forbidden: VM or AKS without monitoring agent in production

## CAF-O-003 — Alert rules + action groups
- Templates deploying workloads MUST also deploy at least one `Microsoft.Insights/metricAlerts` or `Microsoft.Insights/scheduledQueryRules`
- Alerts MUST reference a `Microsoft.Insights/actionGroups` with at least one delivery channel (email, webhook, SMS, ITSM)
- Forbidden: workload deployment with no alert rules

## CAF-O-004 — Patch lifecycle
- VMs MUST be onboarded to Update Manager or Automanage:
  - Bicep: `osProfile.linuxConfiguration.patchSettings.patchMode = 'AutomaticByPlatform'` (Linux) or `osProfile.windowsConfiguration.patchSettings.patchMode = 'AutomaticByPlatform'` (Windows)
- Maintenance windows SHOULD be configured via `Microsoft.Maintenance/maintenanceConfigurations`

## CAF-O-005 — Azure Backup for prod VMs + critical data
- Production VMs MUST be protected by `Microsoft.RecoveryServices/vaults/backupPolicies` + `Microsoft.RecoveryServices/vaults/protectedItems`
- Critical data resources (SQL, Files shares) MUST have backup policies attached
- Backup retention: minimum 30 days for prod VMs, 90 days for SQL

## CAF-O-009 — Service Health alerts
- Production subscriptions MUST have at least one `Microsoft.Insights/activityLogAlerts` of category `ServiceHealth`
- Alert MUST notify an action group containing the on-call channel

## CAF-O-011 — Activity Log retention ≥ 1 year
- `Microsoft.Insights/diagnosticSettings` at subscription scope MUST forward Activity Log to Log Analytics with retention ≥ 365 days
- Forbidden: subscription with no Activity Log export

## Authoring discipline

- Co-deploy monitoring resources with workloads — never assume "ops will add it later"
- Reuse the central workspace; do NOT create per-workload workspaces unless data-sovereignty requires it
- Alert rule severity should match runbook escalation policy — `Sev0` = immediate page, `Sev3` = ticket
