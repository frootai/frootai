---
name: evaluate-landing-zone
description: "Evaluate AI Landing Zone security and compliance — audit private endpoints, NSG rules, RBAC assignments, diagnostic settings, encryption, network isolation. Use when: evaluate, audit, security, compliance, review, assess."
---

# Evaluate AI Landing Zone Security & Compliance

## When to Use
- User asks to audit the landing zone for security
- User asks to check compliance (private endpoints, RBAC, NSG)
- User asks to evaluate before production go-live
- User mentions security review, compliance check, WAF assessment

## Security Evaluation Checklist

| Category | Check | Target | Command |
|----------|-------|--------|---------|
| Network | All AI services have private endpoints | 100% | `az network private-endpoint list` |
| Network | Public access disabled on all services | 100% | Check `publicNetworkAccess: Disabled` |
| Network | NSG on every subnet | 100% | `az network nsg list` |
| Network | VNet peering in Connected state | 100% | `az network vnet peering list` |
| Identity | Managed Identity on all apps | 100% | No API keys in config |
| Identity | RBAC least-privilege | 100% | No Owner/Contributor on prod |
| Identity | No hardcoded credentials | 0 findings | `grep -r "password\|api_key\|secret" --include="*.bicep"` |
| Monitoring | Diagnostic settings on all resources | 100% | `az monitor diagnostic-settings list` |
| Monitoring | Log Analytics receiving data | Active | Query workspace for recent logs |
| Encryption | Storage encryption at rest | Enabled | Check `encryption.services.blob.enabled` |
| Encryption | Key Vault soft delete | Enabled | Check `properties.enableSoftDelete` |
| Governance | Resource locks on production | Lock exists | `az lock list` |
| Governance | Budget alerts configured | Active | `az consumption budget list` |

## Step 1: Network Security Audit

```bash
# Check all private endpoints
az network private-endpoint list -g rg-ai-landing-zone \
  --query "[].{Name:name, Service:privateLinkServiceConnections[0].groupIds[0], Status:privateLinkServiceConnections[0].privateLinkServiceConnectionState.status}" \
  -o table

# Check for public access (should be empty/disabled)
az resource list -g rg-ai-landing-zone \
  --query "[?properties.publicNetworkAccess=='Enabled'].{Name:name, Type:type}" \
  -o table
# Expected: 0 results

# Check NSG rules for deny-internet-inbound
az network nsg rule list -g rg-ai-landing-zone --nsg-name nsg-private-endpoints \
  --query "[?access=='Deny' && direction=='Inbound' && sourceAddressPrefix=='Internet']" \
  -o table
```

## Step 2: Identity & Access Audit

```bash
# List all role assignments (check for over-privileged)
az role assignment list -g rg-ai-landing-zone \
  --query "[].{Principal:principalName, Role:roleDefinitionName, Scope:scope}" \
  -o table

# Flag dangerous roles
# ❌ Owner on resource group — too broad
# ❌ Contributor on subscription — blast radius
# ✅ Cognitive Services OpenAI User — least privilege
# ✅ Storage Blob Data Reader — read-only access

# Check for API keys (should be zero)
az cognitiveservices account keys list --name oai-landing-zone -g rg-ai-landing-zone 2>&1
# If keys exist, verify they're not used anywhere (Managed Identity should be used instead)
```

## Step 3: Monitoring Audit

```bash
# Check diagnostic settings exist on key resources
for resource in $(az resource list -g rg-ai-landing-zone --query "[].id" -o tsv); do
  diag=$(az monitor diagnostic-settings list --resource $resource --query "length(value)" -o tsv 2>/dev/null)
  if [ "$diag" == "0" ] || [ -z "$diag" ]; then
    echo "MISSING diagnostics: $resource"
  fi
done

# Verify Log Analytics is receiving data
az monitor log-analytics query \
  --workspace $(az monitor log-analytics workspace show -g rg-ai-landing-zone --name ws-ai-landing-zone --query customerId -o tsv) \
  --analytics-query "AzureDiagnostics | summarize count() by ResourceType | order by count_ desc" \
  --timespan PT24H -o table
```

## Step 4: Bicep Code Quality Audit

```bash
# Lint the Bicep template
az bicep lint --file infra/main.bicep --diagnostics-format sarif

# Check for hardcoded values
grep -n "hardcoded\|'eastus'\|'westus'\|password\|secret" infra/main.bicep
# Expected: 0 results (all values should be parameters)

# Check all resources use latest API versions
grep -n "Microsoft\.\|@20" infra/main.bicep | head -20
```

## Step 5: Cost Check

```bash
# Estimate monthly cost
az consumption usage list --start-date $(date -d "-7 days" +%Y-%m-%d) --end-date $(date +%Y-%m-%d) \
  --query "[?contains(instanceName, 'landing-zone')].{Resource:instanceName, Cost:pretaxCost}" \
  -o table

# Check for over-sized SKUs
# Common over-provisioning: S3 AI Search when S1 suffices, Premium Key Vault when Standard works
```

## Output: Security Evaluation Report

```
## AI Landing Zone Security Report
| Category | Checks | Passed | Failed | Score |
|----------|--------|--------|--------|-------|
| Network | 4 | 4 | 0 | 100% |
| Identity | 3 | 3 | 0 | 100% |
| Monitoring | 2 | 2 | 0 | 100% |
| Encryption | 2 | 2 | 0 | 100% |
| Governance | 2 | 1 | 1 | 50% |
| **Overall** | **13** | **12** | **1** | **92%** |

### Failed Checks
| Check | Issue | Remediation |
|-------|-------|-------------|
| Budget alerts | No budget configured | Create budget with az consumption budget create |
```
