---
name: tune-landing-zone
description: "Tune AI Landing Zone for production — optimize SKU sizing, reduce cost, configure monitoring thresholds, right-size networking, manage GPU quota. Use when: tune, optimize, cost, SKU, quota, performance, budget."
---

# Tune AI Landing Zone for Production

## When to Use
- User asks to optimize landing zone cost
- User asks about SKU sizing or right-sizing
- User asks to configure monitoring alerts
- User mentions quota, budget, cost optimization

## Tuning Dimensions

| Dimension | What to Optimize | Impact |
|-----------|-----------------|--------|
| SKU sizing | Right-size AI services, compute, storage | 30-60% cost reduction |
| Network config | Optimize firewall rules, NSG efficiency | Reduced latency, lower cost |
| Monitoring | Set alert thresholds, reduce log volume | Better signal-to-noise |
| Quota | Plan GPU capacity, request increases | Avoid deployment failures |
| Governance | Budget alerts, cost anomaly detection | Prevent cost surprises |

## Phase 1: SKU Right-Sizing

### AI Services
| Service | Dev/Test SKU | Production SKU | Cost Difference |
|---------|-------------|----------------|-----------------|
| Azure OpenAI | S0 (pay-per-use) | S0 + PTU (provisioned) | PTU cheaper at >1M tokens/day |
| AI Search | Basic ($75/mo) | S1 ($250/mo) | Basic for <1M docs |
| Key Vault | Standard ($0.03/op) | Standard | Premium only for HSM |
| Storage | Standard LRS | Standard ZRS | LRS for non-critical, ZRS for prod |
| Log Analytics | Pay-per-GB | Commitment tier | Commitment at >100 GB/day |

### Compute SKUs
```bash
# Check current usage vs capacity
az vm list-usage --location eastus2 \
  --query "[?contains(name.value, 'Standard_NC')].{SKU:name.localizedValue, Used:currentValue, Limit:limit}" \
  -o table

# Right-sizing analysis
# If GPU utilization < 30% → downgrade SKU
# If GPU utilization > 80% → upgrade or add nodes
# If CPU-only workload → don't use GPU SKU
```

## Phase 2: Network Optimization

### Firewall Rule Consolidation
```bash
# List all firewall rules
az network firewall network-rule collection list \
  -g rg-hub --firewall-name fw-hub -o table

# Check for redundant rules
# ❌ Multiple rules for same FQDN → consolidate
# ❌ Allow * on any port → restrict to specific ports
# ✅ Specific FQDNs + specific ports = minimal attack surface
```

### NSG Flow Optimization
```bash
# Check NSG flow logs for unused rules
az network watcher flow-log list -l eastus2 -o table

# Rules with 0 hits in 30 days → candidates for removal
# Rules with deny hits → working correctly (keep)
```

## Phase 3: Monitoring Thresholds

### Alert Rules by Priority
| Alert | Metric | Threshold | Action Group |
|-------|--------|-----------|-------------|
| High CPU on compute | CPU % > 85% for 5 min | ≥ 85% | PagerDuty + email |
| Disk usage | Disk % > 80% | ≥ 80% | Email team |
| Failed requests | 4xx rate > 5% | > 5% for 15 min | Slack + email |
| Private endpoint down | Connection status ≠ Approved | Any change | PagerDuty |
| Budget 80% reached | Forecast > 80% budget | ≥ 80% | Email finance + team |
| Budget 100% reached | Spend > 100% budget | ≥ 100% | PagerDuty + email |

### Log Analytics Optimization
```bash
# Check data ingestion volume
az monitor log-analytics workspace show \
  -g rg-ai-landing-zone -n ws-ai-landing-zone \
  --query "sku.name" -o tsv

# If ingesting > 100 GB/day → switch to commitment tier
# Common waste: verbose diagnostic logs on stable resources
# Fix: Set diagnostic settings to log only errors + critical metrics
```

## Phase 4: Quota Planning

```bash
# GPU quota per region
az vm list-usage --location eastus2 \
  --query "[?contains(name.value, 'NC') || contains(name.value, 'ND')].{SKU:name.localizedValue, Used:currentValue, Limit:limit}" \
  -o table

# OpenAI TPM quota
az cognitiveservices account deployment list \
  --name oai-landing-zone -g rg-ai-landing-zone \
  --query "[].{Model:model.name, SKU:sku.name, Capacity:sku.capacity}" \
  -o table

# Request quota increase if needed
# Portal: Subscriptions → Usage + quotas → Request increase
# Or: az support tickets create ...
```

## Phase 5: Cost Governance

```bash
# Create budget
az consumption budget create \
  --budget-name "ai-landing-zone-monthly" \
  --amount 5000 \
  --category Cost \
  --time-grain Monthly \
  --start-date $(date -d "first day of this month" +%Y-%m-01) \
  --end-date $(date -d "first day of next year" +%Y-01-01) \
  --resource-group rg-ai-landing-zone

# Add budget alert at 80% and 100%
# Sends email to finance + engineering team
```

### Cost Comparison by Environment
| Resource | Dev (monthly) | Staging (monthly) | Prod (monthly) |
|----------|--------------|-------------------|----------------|
| OpenAI S0 | ~$200 | ~$500 | ~$2,000 |
| AI Search Basic/S1 | $75 | $250 | $250 |
| Key Vault Standard | ~$5 | ~$10 | ~$20 |
| Log Analytics | ~$50 | ~$100 | ~$300 |
| Firewall | $912 | $912 | $912 |
| VNet + PE | ~$20 | ~$20 | ~$20 |
| **Total** | **~$1,262** | **~$1,792** | **~$3,502** |

## Output: Tuning Report

```
## Landing Zone Tuning Report
| Dimension | Before | After | Savings |
|-----------|--------|-------|---------|
| AI Search SKU | S2 ($1000/mo) | S1 ($250/mo) | -75% |
| Log retention | 365 days | 90 days | -67% data cost |
| Firewall rules | 45 rules | 22 rules | Cleaner, faster |
| GPU quota | 8 NCv3 (unused) | Released | Freed for other teams |
| Budget alerts | None | 80% + 100% | Cost visibility |
| Monitoring alerts | 0 | 6 priority alerts | Incident detection |
```
