---
description: "Cloud Adoption Framework — Billing domain. Budget alerts, chargeback tags, AHUB, auto-shutdown, cost-anomaly detection, Cost Management exports. Enforced by CAF-B-002..010."
applyTo: "**/*.bicep, **/*.bicepparam, **/parameters.json, **/*.tf, **/*.tfvars, **/azure.yaml"
caf:
  - "billing"
---

# CAF — Billing / Cost Domain

When authoring or reviewing IaC for the **Billing** plane, enforce these standards. Aligned to FAI's `caf-validator/checks/billing.py` (CAF-B-002..010, 6 enforceable checks).

## CAF-B-002 — Budget alerts
- Production subscriptions MUST deploy `Microsoft.Consumption/budgets` with at least one threshold notification (`amount: <monthly cap>`, `notifications.actualCost.thresholds: [80, 100]`)
- Notifications MUST route to a Cost Management action group (email + Teams webhook)
- Forbidden: production subscription with no budget

## CAF-B-003 — costcenter + workload tags for chargeback
- Every billable resource MUST carry tags: `costcenter`, `workload`
- Tags enforced via CAF-G-003 policy assignment — but the workload template MUST author them explicitly
- Forbidden: untagged billable resources (compute, storage, networking, AI services)

## CAF-B-005 — Azure Hybrid Benefit on Windows VMs + SQL
- Windows VMs eligible for AHUB MUST set `licenseType: 'Windows_Server'`
- SQL VMs / managed instances MUST set `licenseType: 'AHUB'` (or equivalent)
- Forbidden: Windows / SQL workload without AHUB when org has Software Assurance

## CAF-B-006 — Auto-shutdown on dev/test VMs
- VMs tagged `environment: 'dev'` or `environment: 'test'` MUST have `Microsoft.DevTestLab/schedules` of `taskType: 'ComputeVmShutdownTask'`
- Shutdown time SHOULD be ≤ 19:00 local

## CAF-B-008 — Cost-anomaly detection
- Production subscriptions MUST deploy `Microsoft.CostManagement/scheduledActions` of `kind: 'InsightAlert'`
- Action MUST notify a Cost Management channel when anomaly detected

## CAF-B-010 — Cost Management exports
- Production subscriptions MUST deploy `Microsoft.CostManagement/exports` with `deliveryInfo.destination` pointing to a Storage Account container
- Export frequency: daily for actual cost, monthly for amortized

## Authoring discipline

- Budget threshold = 80% of forecasted spend, not 100% — gives runway to act before overrun
- Apply AHUB at template-author time — retroactively re-licensing requires VM redeploy
- Use shared chargeback tag schema across all templates — don't invent per-workload conventions

## Out-of-template (process-level) reminders

- CAF-B-004 — Reserved Instance / Savings Plan quarterly review is a recurring purchasing decision (not in IaC)
