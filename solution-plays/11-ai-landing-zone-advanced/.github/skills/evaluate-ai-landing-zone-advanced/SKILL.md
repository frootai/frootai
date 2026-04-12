---
name: evaluate-ai-landing-zone-advanced
description: "Evaluate Advanced Landing Zone — audit Azure Policy compliance, Defender score, network segmentation, RBAC least-privilege, CIS/NIST benchmarks. Use when: evaluate, audit, compliance check."
---

# Evaluate AI Landing Zone Advanced

## When to Use
- Audit Azure Policy compliance across management groups
- Evaluate Defender for Cloud secure score and recommendations
- Validate network segmentation (hub-spoke, private endpoints)
- Check RBAC assignments follow least-privilege principle
- Assess compliance against CIS, NIST 800-53, ISO 27001

## Governance Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Policy compliance | ≥ 95% | Azure Policy compliance dashboard |
| Defender secure score | ≥ 80% | Defender for Cloud dashboard |
| Resources with private endpoints | 100% (AI services) | Resource configuration audit |
| Resources with managed identity | 100% | Identity audit |
| Resources with diagnostic settings | 100% | Monitor configuration check |
| RBAC role assignments | Zero standing admin | PIM audit |
| Network exposure | Zero public IPs on AI services | NSG/Firewall audit |
| Encryption at rest | 100% | Storage/DB encryption check |

## Step 1: Audit Azure Policy Compliance
```bash
# Check compliance at management group scope
az policy state list --management-group $MG_ID --filter "complianceState eq 'NonCompliant'" --query "[].{resource:resourceId, policy:policyDefinitionName}" -o table
```
- Group non-compliant resources by policy
- Prioritize: Deny policies (blocking) > Audit policies (monitoring)
- Check for exemptions that may hide real violations

## Step 2: Evaluate Defender for Cloud
```bash
# Get secure score
az security secure-score-controls list --query "[].{name:displayName, score:current, max:max}" -o table
```
- Target: ≥ 80% overall secure score
- Review unhealthy resources per control
- Prioritize: Critical > High > Medium recommendations
- Check Defender coverage (all resource types enabled?)

## Step 3: Validate Network Segmentation
- [ ] Hub VNet has Firewall in dedicated subnet
- [ ] Each spoke has proper subnet segmentation
- [ ] NSGs on every subnet (deny default, allow specific)
- [ ] No AI services with public network access enabled
- [ ] Private endpoints resolving via private DNS zones
- [ ] UDR (User Defined Routes) forcing traffic through Firewall
- [ ] No direct internet egress from spokes (NAT Gateway via hub only)

## Step 4: Audit RBAC Assignments
```bash
# List role assignments at MG scope
az role assignment list --scope "/providers/Microsoft.Management/managementGroups/$MG_ID" --query "[].{principal:principalName, role:roleDefinitionName, scope:scope}" -o table
```
- No Owner assignments below root MG (use Contributor + RBAC Admin split)
- Service principals should have minimum required roles
- Check for overprivileged assignments (Owner where Contributor suffices)
- Verify PIM (Privileged Identity Management) for eligible vs active roles

## Step 5: Check Resource Tagging
```bash
# Find resources missing required tags
az resource list --query "[?tags.environment==null || tags.costCenter==null].{name:name, type:type}" -o table
```
Required tags: `environment`, `costCenter`, `owner`, `project`, `managedBy`

## Step 6: Generate Compliance Report
```bash
# Export compliance data
az policy state list --management-group $MG_ID --output json > evaluation/compliance-report.json
az security assessment list --output json > evaluation/defender-report.json
```

### Compliance Gate Decision
| Result | Action |
|--------|--------|
| All PASS (≥95% compliant, ≥80% secure score) | Approve for workload onboarding |
| Policy compliance < 90% | Remediate non-compliant resources |
| Secure score < 70% | Address critical Defender recommendations |
| Public endpoints found on AI services | Block — deploy private endpoints |
| Standing admin roles found | Enable PIM, remove permanent assignments |

## Common Findings

| Finding | Severity | Remediation |
|---------|----------|-------------|
| Storage account with public access | High | Enable private endpoint, disable public |
| Missing diagnostic settings | Medium | Deploy DINE policy for auto-remediation |
| Overprivileged service principal | High | Scope down to minimum required role |
| Missing encryption (CMK) | Medium | Enable customer-managed keys |
| NSG allows all inbound | Critical | Restrict to required ports/sources only |
| No activity log forwarding | Medium | Configure to central Log Analytics |

## Evaluation Cadence
- **Pre-onboarding**: Full compliance audit before any workload deployment
- **Weekly**: Defender secure score + policy compliance dashboard review
- **Monthly**: RBAC assignment audit, tag compliance, cost review
- **Quarterly**: Full CIS/NIST benchmark assessment
- **On change**: Re-evaluate after any policy or network modification
