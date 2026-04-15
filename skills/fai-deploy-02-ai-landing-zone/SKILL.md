---
name: fai-deploy-02-ai-landing-zone
description: |
  Deploy AI Landing Zone (Play 02) with hub-spoke networking, private endpoints,
  policy assignments, and governance controls. Covers Bicep provisioning for
  secure AI workload hosting.
---

# Deploy AI Landing Zone (Play 02)

Production deployment for secure AI infrastructure with hub-spoke networking.

## When to Use

- Provisioning a new AI Landing Zone environment
- Setting up hub-spoke network topology for AI workloads
- Configuring Azure Policy for governance enforcement
- Deploying shared services (DNS, Bastion, Firewall)

---

## Architecture

```
Hub VNet                          Spoke VNet (AI Workload)
├── Azure Firewall                ├── App Service (PE)
├── Bastion                       ├── Azure OpenAI (PE)
├── Private DNS Zones             ├── AI Search (PE)
└── VPN/ExpressRoute Gateway      └── Cosmos DB (PE)
```

## Deployment Steps

```bash
# 1. Deploy hub
az deployment sub create --location eastus2 \
  --template-file infra/hub/main.bicep

# 2. Deploy spoke with peering
az deployment sub create --location eastus2 \
  --template-file infra/spoke/main.bicep \
  --parameters hubVnetId=$HUB_VNET_ID

# 3. Deploy AI services into spoke
az deployment group create --resource-group rg-ai-spoke \
  --template-file infra/services/main.bicep

# 4. Assign policies
az deployment sub create --location eastus2 \
  --template-file infra/policies/main.bicep
```

## Policy Assignments

| Policy | Effect | Purpose |
|--------|--------|---------|
| Deny public endpoints | Deny | Force private endpoint usage |
| Require tags (env, owner) | Deny | Governance compliance |
| Allowed locations | Deny | Data residency |
| Require TLS 1.2 | Deny | Transport security |
| Enable diagnostics | DeployIfNotExists | Automatic logging |

## Network Validation

```bash
# Verify private endpoint DNS resolution
nslookup oai-prod.openai.azure.com
# Should resolve to 10.x.x.x (private IP), not public

# Test connectivity from spoke
az network bastion ssh --name bastion-hub --resource-group rg-hub \
  --target-resource-id $VM_ID --auth-type ssh-key
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| DNS resolution returns public IP | Private DNS zone not linked | Link DNS zone to spoke VNet |
| Policy blocks deployment | Resource violates policy | Align config with policy (tags, no public access) |
| Cross-VNet connectivity fails | Peering not established | Check peering status and allow forwarding |
| Bastion can't connect | NSG blocking port 443 | Allow BastionSubnet in NSG |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Infrastructure as Code only | Reproducible, auditable deployments |
| Staged promotion (dev→staging→prod) | Catch issues before production |
| Smoke tests after every deploy | Verify critical paths immediately |
| Rollback plan documented | Know how to revert before you deploy |
| Monitoring active before deploy | See impact in real-time |
| Zero-downtime deployments | Slot swaps or rolling updates |

## Deployment Checklist

- [ ] All CI checks pass on release branch
- [ ] Infrastructure deployed via Bicep/Terraform
- [ ] App deployed to staging first
- [ ] Smoke tests pass in staging
- [ ] Production deploy with monitoring active
- [ ] Post-deploy health check confirmed
- [ ] Rollback tested and documented

## Related Skills

- `fai-rollout-plan` — Staged rollout planning
- `fai-multi-stage-docker` — Container build optimization
- `fai-build-github-workflow` — CI/CD pipeline setup
