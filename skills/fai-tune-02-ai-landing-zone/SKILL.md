---
name: fai-tune-02-ai-landing-zone
description: |
  Tune AI Landing Zone (Play 02) for policy compliance, network performance,
  identity governance, and cost controls. Use when optimizing an existing
  landing zone deployment.
---

# Tune AI Landing Zone (Play 02)

Optimize landing zone configuration for governance, networking, and cost.

## When to Use

- Policy compliance score below target
- Network latency between hub and spoke too high
- Identity governance needs tightening
- Cost controls need refinement

---

## Tuning Dimensions

| Dimension | Config | Default | Tune When |
|-----------|--------|---------|-----------|
| Policy strictness | infra/policies/ | Deny public EP | Legitimate exceptions needed |
| NSG rules | infra/network/ | Deny all inbound | App needs specific ports |
| DNS resolution | infra/dns/ | Private zones | New services added |
| RBAC scope | infra/identity/ | Resource group | Over/under privileged |
| Budget alerts | infra/monitoring/ | 50/75/90% | Thresholds too noisy |

## Policy Compliance Check

```bash
# Scan for non-compliant resources
az policy state list --subscription $SUB \
  --filter "complianceState eq 'NonCompliant'" \
  --query "[].{Resource:resourceId, Policy:policyDefinitionName}" -o table

# Trigger evaluation
az policy state trigger-scan --subscription $SUB
```

## Network Performance Tuning

```bash
# Test latency between hub and spoke
az network watcher show-topology --resource-group rg-spoke -o json

# Verify private endpoint DNS
nslookup oai-prod.openai.azure.com
# Expected: 10.x.x.x (private), NOT public IP
```

## RBAC Audit

```bash
# Find over-privileged assignments
az role assignment list --scope /subscriptions/$SUB \
  --query "[?roleDefinitionName=='Owner' || roleDefinitionName=='Contributor'].{Principal:principalName, Role:roleDefinitionName}" -o table
```

## Cost Control Tuning

```bicep
resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: 'landing-zone-budget'
  properties: {
    amount: 5000
    timeGrain: 'Monthly'
    notifications: {
      alert75: { enabled: true, threshold: 75, operator: 'GreaterThan'
        contactEmails: ['platform@org.com'] }
    }
  }
}
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Policy blocks legitimate resource | Too strict deny | Add exclusion or custom policy |
| DNS not resolving privately | Zone not linked | Link private DNS zone to VNet |
| RBAC too broad | Inherited from subscription | Scope roles to resource group |
| Budget alerts too noisy | Low thresholds | Adjust to 75/90/100% |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Tune one parameter at a time | Isolate impact of each change |
| Always measure before and after | Evidence-based tuning |
| Use evaluation dataset for comparison | Objective quality measurement |
| Keep previous config for rollback | Instant revert if quality drops |
| Document tuning decisions | Future reference for the team |
| Automate tuning evaluation | Reduce manual effort |

## Tuning Workflow

```
1. Baseline eval → record current scores
2. Change ONE parameter
3. Re-run eval → compare to baseline
4. If improved → keep change, update baseline
5. If regressed → revert change
6. Repeat for next parameter
```

## Related Skills

- `fai-tune-01-enterprise-rag` — RAG tuning playbook
- `fai-evaluation-framework` — Eval infrastructure
- `fai-inference-optimization` — Latency and cost optimization
