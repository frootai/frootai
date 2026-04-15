---
name: fai-azure-container-registry
description: |
  Harden Azure Container Registry with content trust, vulnerability scanning, retention
  policies, and geo-replication. Use when securing container image supply chains for
  production AI workloads.
---

# Azure Container Registry Hardening

Secure ACR with content trust, scanning, retention, and geo-replication.

## When to Use

- Setting up container registry for production workloads
- Hardening existing ACR against supply chain attacks
- Configuring image retention to control storage costs
- Enabling geo-replication for multi-region deployments

---

## Bicep Provisioning

```bicep
resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: acrName
  location: location
  sku: { name: 'Premium' }  // Required for geo-replication, content trust
  identity: { type: 'SystemAssigned' }
  properties: {
    adminUserEnabled: false  // Always disable admin user
    publicNetworkAccess: 'Disabled'
    policies: {
      trustPolicy: { type: 'Notary', status: 'enabled' }
      retentionPolicy: { days: 30, status: 'enabled' }
      quarantinePolicy: { status: 'enabled' }
    }
  }
}

// Geo-replication
resource replication 'Microsoft.ContainerRegistry/registries/replications@2023-11-01-preview' = {
  name: 'westeurope'
  parent: acr
  location: 'westeurope'
}
```

## Vulnerability Scanning

```bash
# Enable Defender for Containers
az security pricing create --name Containers --tier Standard

# Check scan results for an image
az acr repository show-manifests --name $ACR --repository myapp \
  --query "[].{Digest:digest, Tags:tags, LastUpdated:lastUpdateTime}" -o table
```

## CI/CD Integration

```yaml
# GitHub Actions — build, scan, push
- name: Build and push to ACR
  uses: azure/docker-login@v1
  with:
    login-server: myacr.azurecr.io
    username: ${{ secrets.ACR_USERNAME }}
    password: ${{ secrets.ACR_PASSWORD }}

- run: |
    docker build -t myacr.azurecr.io/myapp:${{ github.sha }} .
    docker push myacr.azurecr.io/myapp:${{ github.sha }}

- name: Scan image
  run: |
    az acr task run --name scan-image --registry $ACR \
      --arg IMAGE=myapp:${{ github.sha }}
```

## Retention Policy

```bash
# Purge untagged images older than 7 days
az acr run --cmd "acr purge --filter 'myapp:.*' \
  --untagged --ago 7d" --registry $ACR /dev/null
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Image pull fails cross-region | No replication in target region | Enable geo-replication for consuming region |
| Push denied | Missing AcrPush role | Grant AcrPush RBAC on registry to CI/CD identity |
| Vulnerability scan not running | Defender not enabled | Enable Microsoft Defender for Containers |
| Storage costs growing | No retention policy | Enable retention policy and scheduled purge |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Start simple, add complexity when needed | Avoid over-engineering |
| Automate repetitive tasks | Consistency and speed |
| Document decisions and tradeoffs | Future reference for the team |
| Validate with real data | Don't rely on synthetic tests alone |
| Review with peers | Fresh eyes catch blind spots |
| Iterate based on feedback | First version is never perfect |

## Quality Checklist

- [ ] Requirements clearly defined
- [ ] Implementation follows project conventions
- [ ] Tests cover happy path and error paths
- [ ] Documentation updated
- [ ] Peer reviewed
- [ ] Validated in staging environment

## Related Skills

- `fai-implementation-plan-generator` — Planning and milestones
- `fai-review-and-refactor` — Code review patterns
- `fai-quality-playbook` — Engineering quality standards
