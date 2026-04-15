---
name: fai-azure-architecture-review
description: |
  Review Azure architecture against Well-Architected Framework pillars. Use when:
  - Preparing for production launch of an AI workload
  - Conducting periodic architecture health checks
  - Identifying security gaps, reliability risks, and cost waste
  - Validating WAF alignment before major changes
---

# Azure Architecture Review

Systematic review of Azure architecture against the 6 WAF pillars with actionable findings.

## When to Use

- Before production launch — catch issues early
- Quarterly health checks — detect architecture drift
- After major changes — validate new components
- Compliance reviews — document WAF alignment

---

## Review Framework

### Pillar 1: Reliability

```bash
# Check for single points of failure
az resource list --resource-group $RG --query "[?sku.capacity==1]" -o table

# Verify health probes exist
az network lb probe list --resource-group $RG --lb-name $LB -o table

# Check backup configuration
az backup policy list --resource-group $RG --vault-name $VAULT -o table
```

| Check | Pass Criteria |
|-------|--------------|
| Multi-instance | All critical services have ≥2 instances |
| Health probes | Every LB/AG has active health probes |
| Retry policy | All external calls have exponential backoff |
| Backup | RPO/RTO documented and tested |

### Pillar 2: Security

```bash
# Find resources with public endpoints
az resource list --resource-group $RG \
  --query "[?properties.publicNetworkAccess=='Enabled'].{Name:name, Type:type}" -o table

# Check for resources without Managed Identity
az resource list --resource-group $RG \
  --query "[?identity==null].{Name:name, Type:type}" -o table

# Audit RBAC assignments
az role assignment list --scope /subscriptions/$SUB/resourceGroups/$RG -o table
```

| Check | Pass Criteria |
|-------|--------------|
| No public endpoints | All data-plane endpoints use private endpoints |
| Managed Identity | All services authenticate via MI, not keys |
| RBAC | No Owner/Contributor at subscription scope for service accounts |
| Key Vault | All secrets externalized, no env vars or hardcoded |

### Pillar 3: Cost Optimization

```bash
# Find oversized resources
az monitor metrics list --resource $RESOURCE_ID \
  --metric "Percentage CPU" --interval PT1H \
  --aggregation Average --query "value[].timeseries[].data[]" -o table

# Check for unused resources
az advisor recommendation list --resource-group $RG \
  --category Cost -o table
```

### Pillar 4: Operational Excellence

| Check | Pass Criteria |
|-------|--------------|
| IaC coverage | 100% of resources defined in Bicep/Terraform |
| CI/CD | Every service has automated build + deploy pipeline |
| Monitoring | Application Insights + Log Analytics configured |
| Runbooks | Incident response procedures documented |

### Pillar 5: Performance Efficiency

| Check | Pass Criteria |
|-------|--------------|
| Latency SLOs | P95 targets defined and monitored |
| Caching | Redis or semantic cache for hot paths |
| Autoscale | Configured for variable workloads |
| CDN | Static assets served via CDN |

### Pillar 6: Responsible AI

| Check | Pass Criteria |
|-------|--------------|
| Content safety | Filters enabled on all AI endpoints |
| Groundedness | Evaluation pipeline running with ≥0.8 threshold |
| Transparency | Users informed when interacting with AI |
| Human escalation | Override path exists for high-impact decisions |

## Review Report Template

```markdown
# Architecture Review — [Project Name]
**Date:** YYYY-MM-DD | **Reviewer:** [name]

## Summary
- Critical: X | High: X | Medium: X | Low: X

## Findings
| # | Pillar | Severity | Finding | Recommendation |
|---|--------|----------|---------|---------------|
| 1 | Security | Critical | Public endpoint on OpenAI | Add private endpoint |
| 2 | Reliability | High | Single replica on search | Scale to 2+ replicas |
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| High-risk findings discovered late | No review gate | Add architecture review as release pipeline gate |
| Review takes too long | Scope too broad | Focus on changed components + critical path only |
| Findings not acted on | No ownership | Assign finding owner + due date in review report |
