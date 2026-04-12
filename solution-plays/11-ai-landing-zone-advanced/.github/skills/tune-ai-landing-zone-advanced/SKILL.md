---
name: tune-ai-landing-zone-advanced
description: "Tune Advanced Landing Zone — optimize SKU right-sizing, region selection, policy effects (Audit vs Deny), reserved instances, Firewall rules, cost governance. Use when: tune, optimize, cost review."
---

# Tune AI Landing Zone Advanced

## When to Use
- Right-size infrastructure SKUs based on actual usage
- Optimize region selection for latency and cost
- Tune Azure Policy effects (Audit vs Deny vs DeployIfNotExists)
- Configure reserved instances for predictable workloads
- Optimize Firewall rules for performance and cost
- Reduce monthly infrastructure spend

## Tuning Dimensions

### Dimension 1: SKU Right-Sizing

| Resource | Dev/Test SKU | Production SKU | When to Upgrade |
|----------|-------------|---------------|----------------|
| Azure Firewall | Standard | Premium | Need IDPS, TLS inspection |
| NAT Gateway | Standard (1 IP) | Standard (4+ IPs) | >100 concurrent SNAT connections |
| VPN Gateway | VpnGw1 | VpnGw2AZ | >650 Mbps throughput needed |
| Bastion | Basic | Standard | Need file transfer, IP-based connect |
| Log Analytics | Pay-as-you-go | Commitment tier | >100 GB/day ingestion |

**Diagnostic**: Check Azure Advisor for right-sizing recommendations
```bash
az advisor recommendation list --category cost --query "[?shortDescription.solution=='Right-size']" -o table
```

### Dimension 2: Region Selection Strategy

| Factor | Weight | Optimization |
|--------|--------|-------------|
| AI service availability | High | Check GPU/model availability per region |
| User proximity | High | Deploy in regions closest to users |
| Pricing delta | Medium | Same service can cost 10-30% less in some regions |
| Compliance (data residency) | Critical | GDPR → EU regions, HIPAA → US regions |
| Paired region | Medium | Use paired regions for DR |

**Multi-region pattern**: Primary + DR in paired region, Firewall in each hub.

### Dimension 3: Policy Effect Tuning

| Phase | Recommended Effect | Rationale |
|-------|-------------------|-----------|
| Initial rollout | Audit | Discover non-compliance without blocking |
| After 30 days | Deny (new resources) | Prevent new violations |
| After 60 days | DeployIfNotExists | Auto-remediate existing resources |
| Ongoing | Deny + DINE | Full enforcement + auto-remediation |

**Per-policy tuning**:
- `Require private endpoints` → Start Audit (find existing public), then Deny
- `Require managed identity` → Deny immediately (no reason for keys)
- `Require diagnostic settings` → DINE (auto-deploy, no user action needed)
- `Allowed locations` → Deny immediately (compliance critical)

### Dimension 4: Cost Optimization

| Strategy | Savings | Complexity |
|----------|---------|-----------|
| Reserved instances (1y) | 30-40% on VMs, Firewall | Low |
| Reserved instances (3y) | 50-60% on VMs, Firewall | Low |
| Dev/test pricing | 40% on Windows VMs | Low (needs VS subscription) |
| Spot VMs for non-critical | 60-90% on compute | Medium |
| Commitment tier (Log Analytics) | 15-30% on ingestion | Low |
| Auto-shutdown (dev/test) | 50% on non-prod compute | Low |

**Monthly cost estimate (hub infrastructure)**:
| Component | Dev | Prod |
|-----------|-----|------|
| Azure Firewall | $912/mo (Standard) | $912/mo (Premium: $1,824) |
| NAT Gateway | $32/mo | $32/mo |
| VPN Gateway | $138/mo (VpnGw1) | $380/mo (VpnGw2AZ) |
| Bastion | $139/mo (Basic) | $278/mo (Standard) |
| Log Analytics | ~$50/mo (10GB/day) | ~$500/mo (100GB/day) |
| **Total hub** | **~$1,271/mo** | **~$3,014/mo** |

With 1-year reservations: Dev ~$890 → Prod ~$2,110 (30% savings).

### Dimension 5: Firewall Rule Optimization

| Rule Type | Use Case | Performance Impact |
|-----------|----------|-------------------|
| Network rules | IP-based, fastest | Lowest latency |
| Application rules | FQDN-based, TLS inspection | Medium latency |
| NAT rules | Inbound DNAT | Lowest latency |

**Optimization steps**:
1. Move high-frequency rules to top of collection (processed first)
2. Use IP groups for large IP ranges (reduces rule count)
3. Consolidate overlapping FQDN rules
4. Use web categories instead of individual FQDNs where possible
5. Monitor rule hit counts — remove unused rules after 30 days

## Production Readiness Checklist
- [ ] All SKUs right-sized per actual workload
- [ ] Reserved instances purchased for production resources
- [ ] Policy effects graduated from Audit to Deny
- [ ] Regions selected for compliance + cost balance
- [ ] Firewall rules optimized (no unused rules)
- [ ] Log Analytics commitment tier configured
- [ ] Auto-shutdown configured for non-prod
- [ ] Azure Advisor recommendations reviewed and actioned
- [ ] Budget alerts configured per subscription
- [ ] Cost management tags enforced

## Output: Tuning Report
After tuning, compare before/after:
- Monthly infrastructure cost delta
- Policy compliance improvement (Audit → Deny transition)
- SKU right-sizing savings
- Reservation savings projection (1y and 3y)
- Firewall rule optimization (rule count, hit rates)
