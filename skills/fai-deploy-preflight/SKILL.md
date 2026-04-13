---
name: fai-deploy-preflight
description: 'Validates Bicep templates, checks Azure resource availability, verifies quota, and runs what-if deployment before any Azure infrastructure changes. A safety gate for all FAI play deployments.'
---

# FAI Deploy Preflight

Run a comprehensive preflight check before deploying any FAI play infrastructure to Azure.

## Checks Performed

### 1. Bicep Validation
```bash
az bicep build -f infra/main.bicep
```
Verify template compiles without errors.

### 2. Parameter Validation
- All required parameters have values
- SKU names are valid
- Region is available for requested services
- Tags include: environment, project, costCenter, managedBy

### 3. Quota Check
- GPU quota (if AKS GPU nodes requested)
- Azure OpenAI TPM/RPM quota for the region
- AI Search replica/partition limits
- Cosmos DB throughput limits

### 4. What-If Deployment
```bash
az deployment group what-if \
  -g <resource-group> \
  -f infra/main.bicep \
  -p infra/parameters.json
```
Review planned changes before applying.

### 5. Cost Estimate
- Estimate monthly cost based on defined resources
- Compare against budget tags
- Flag if estimated cost exceeds budget by >20%

### 6. Security Check
- Private endpoints configured for all PaaS services?
- Managed Identity used (no API keys)?
- Diagnostic settings enabled?
- RBAC roles follow least privilege?

## Output

```
🚀 FAI Deploy Preflight — [play name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Bicep validation passed
✅ Parameters validated (12/12 fields)
⚠️  GPU quota: 4/8 vCPUs remaining in eastus
✅ What-if: 7 resources to create, 0 to modify, 0 to delete
✅ Estimated cost: $1,240/month (within budget)
✅ Security: all checks passed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESULT: READY TO DEPLOY
```

## Rollback Strategy

If the preflight check passes but deployment fails:
1. Capture deployment error from Azure Resource Manager
2. Check deployment operation details: `az deployment group show -g <rg> -n <deployment>`
3. If partial deployment: `az deployment group cancel -g <rg> -n <deployment>`
4. Run what-if again with previous parameters to verify rollback
5. Delete partially-created resources that are not in the target state
6. Log incident in Application Insights with deployment correlation ID

## Integration with CI/CD

Add the preflight step before any Azure deployment in your pipeline:
- Run after Bicep linting and before `az deployment group create`
- Set `--fail-on-warning true` in production pipelines
- Use `--output json` for machine-readable results in automation
- Cache quota checks to avoid rate limiting on Azure Resource Manager API

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--play` | required | Play ID or path to solution play folder |
| `--env` | staging | Target environment (dev/staging/prod) |
| `--resource-group` | from azure.yaml | Azure resource group name |
| `--fail-on-warning` | true | Treat warnings as errors |
| `--skip-cost` | false | Skip cost estimation (faster) |
| `--skip-quota` | false | Skip quota checks |
| `--output` | text | Output format (text/json/markdown) |
| `--timeout` | 300 | Max seconds for what-if deployment |

## Error Codes

| Code | Meaning | Resolution |
|------|---------|------------|
| PF001 | Bicep compilation error | Fix syntax in infra/main.bicep |
| PF002 | Missing required parameter | Add to infra/parameters.json |
| PF003 | Insufficient quota | Request quota increase or change region |
| PF004 | What-if deployment failed | Check ARM error message for details |
| PF005 | Cost exceeds budget | Right-size resources or increase budget |
| PF006 | Security check failed | Enable private endpoints and managed identity |
| PF007 | Region not available | Choose different Azure region |
| PF008 | API version mismatch | Update Bicep to latest provider versions |
