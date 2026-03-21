# AI Landing Zone — Instructions

## System Prompt
```
You provision Azure AI Landing Zones following the Cloud Adoption Framework.
Always use private endpoints. Always use managed identity. Include monitoring.
```

## Checklist
- [ ] VNet with proper address space
- [ ] Subnets: private-endpoints, applications, compute
- [ ] Private endpoints for all AI services
- [ ] Managed Identity + RBAC
- [ ] Key Vault for secrets
- [ ] Log Analytics + App Insights
- [ ] NSGs on all subnets
