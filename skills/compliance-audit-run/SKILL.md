---
name: compliance-audit-run
description: "Run AI compliance audits, collect Azure evidence, and track remediation — assess SOC 2, HIPAA, ISO 27001, and EU AI Act controls"
---

# Compliance Audit Run

Run automated compliance audits for AI systems against SOC 2, ISO 27001, HIPAA, and EU AI Act. Collects evidence from Azure Policy, Defender for Cloud, and AI-specific controls (model governance, data lineage, bias testing, content safety). Produces audit reports with risk classification and remediation tracking.

## Compliance Framework Mapping

Map AI system controls to each framework's requirements before auditing:

| Framework | AI-Relevant Controls | Azure Evidence Source |
|-----------|---------------------|----------------------|
| SOC 2 Type II | CC6.1 logical access, CC7.2 monitoring, CC8.1 change mgmt | Entra ID logs, Defender for Cloud, DevOps audit |
| ISO 27001:2022 | A.8.28 secure coding, A.5.12 info classification | Azure Policy, Purview data catalog |
| HIPAA | §164.312 access control, §164.314 BAA, §164.530 audit | Key Vault access policies, Activity Log |
| EU AI Act | Art.9 risk mgmt, Art.10 data governance, Art.13 transparency | Content Safety scores, model cards, bias reports |

## EU AI Act Risk Classification

Classify every AI component before auditing — high-risk systems require conformity assessment:

```python
EU_AI_ACT_RISK = {
    "unacceptable": ["social_scoring", "real_time_biometric_mass"],
    "high_risk": [
        "employment_screening", "credit_scoring", "medical_diagnosis",
        "law_enforcement_profiling", "education_assessment", "critical_infra"
    ],
    "limited_risk": ["chatbot", "deepfake_generator", "emotion_recognition"],
    "minimal_risk": ["spam_filter", "content_recommendation", "search_ranking"]
}

def classify_ai_risk(system_purpose: str, affects_fundamental_rights: bool) -> str:
    for level, purposes in EU_AI_ACT_RISK.items():
        if system_purpose in purposes:
            return level
    return "high_risk" if affects_fundamental_rights else "minimal_risk"
```

## Automated Compliance Checks

Pull compliance state from Azure Policy and Defender for Cloud, then layer AI-specific checks:

```bash
# Azure Policy compliance for AI resource group
az policy state summarize --filter "resourceGroup eq 'rg-ai-prod'" \
  -o json | jq '.value[0] | {compliant: .results.resourceDetails[0].count,
  nonCompliant: .results.resourceDetails[1].count}'

# Defender for Cloud secure score for the subscription
az security secure-score list --query "[0].{score:current,max:max}" -o table

# Check RBAC — no wildcard actions on AI resources
az role assignment list --scope "/subscriptions/$SUB_ID/resourceGroups/rg-ai-prod" \
  --query "[?roleDefinitionName=='Owner' || roleDefinitionName=='Contributor'].\
  {principal:principalName,role:roleDefinitionName}" -o table

# Verify Key Vault soft-delete and purge protection
az keyvault show -n kv-ai-prod --query "{softDelete:properties.enableSoftDelete,\
  purgeProtection:properties.enablePurgeProtection}" -o table

# Check private endpoints on Azure OpenAI
az network private-endpoint list -g rg-ai-prod \
  --query "[?contains(privateLinkServiceConnections[0].groupIds[0],'openai')].\
  {name:name,status:privateLinkServiceConnections[0].privateLinkServiceConnectionState.status}" -o table
```

## AI-Specific Audit Items

These go beyond standard cloud compliance — they audit model lifecycle and responsible AI:

```python
import json, subprocess, datetime

def audit_ai_controls(resource_group: str) -> list[dict]:
    findings = []

    # 1. Model governance — verify model registry has versioning
    models = json.loads(subprocess.check_output([
        "az", "ml", "model", "list", "-g", resource_group,
        "--query", "[].{name:name,version:version,stage:stage}", "-o", "json"
    ]))
    unversioned = [m for m in models if int(m["version"]) < 2]
    if unversioned:
        findings.append({"control": "MODEL_GOVERNANCE", "severity": "HIGH",
            "detail": f"{len(unversioned)} models lack version history",
            "remediation": "Register model versions via az ml model create --version"})

    # 2. Data lineage — check Purview registration
    result = subprocess.run(["az", "purview", "account", "list", "-g", resource_group],
        capture_output=True, text=True)
    if "[]" in result.stdout or result.returncode != 0:
        findings.append({"control": "DATA_LINEAGE", "severity": "HIGH",
            "detail": "No Purview account for data lineage tracking",
            "remediation": "Deploy Purview and register AI data sources"})

    # 3. Content safety — verify Azure Content Safety is enforced
    oai_resources = json.loads(subprocess.check_output([
        "az", "cognitiveservices", "account", "list", "-g", resource_group,
        "--query", "[?kind=='OpenAI'].{name:name,contentFilter:properties.contentFilter}", "-o", "json"
    ]))
    unfiltered = [r for r in oai_resources if not r.get("contentFilter")]
    if unfiltered:
        findings.append({"control": "CONTENT_SAFETY", "severity": "CRITICAL",
            "detail": f"{len(unfiltered)} OpenAI resources lack content filtering",
            "remediation": "Apply content filter policy via az cognitiveservices account update"})

    # 4. Bias testing — check evaluation pipeline exists
    eval_runs = json.loads(subprocess.check_output([
        "az", "ml", "job", "list", "-g", resource_group,
        "--query", "[?contains(displayName,'bias') || contains(displayName,'fairness')]", "-o", "json"
    ]))
    if not eval_runs:
        findings.append({"control": "BIAS_TESTING", "severity": "MEDIUM",
            "detail": "No bias/fairness evaluation jobs found in last 90 days",
            "remediation": "Run fairness evaluation: az ml job create -f evaluation/bias-eval.yml"})

    # 5. Diagnostic logging — verify all AI resources log to Log Analytics
    diag = json.loads(subprocess.check_output([
        "az", "monitor", "diagnostic-settings", "list",
        "--resource-group", resource_group, "-o", "json"
    ]))
    if not diag:
        findings.append({"control": "AUDIT_LOGGING", "severity": "HIGH",
            "detail": "Diagnostic settings not configured for AI resources",
            "remediation": "Enable diagnostic logs to Log Analytics workspace"})

    return findings
```

## Evidence Collection Script

Collect all audit evidence into a timestamped package for auditor review:

```python
import os, json, subprocess, datetime, hashlib
from pathlib import Path

def collect_audit_evidence(resource_group: str, output_dir: str = "audit-evidence"):
    ts = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    evidence_path = Path(output_dir) / ts
    evidence_path.mkdir(parents=True, exist_ok=True)
    manifest = {"timestamp": ts, "resource_group": resource_group, "artifacts": []}

    evidence_commands = {
        "policy-compliance.json": f"az policy state list --filter \"resourceGroup eq '{resource_group}'\" -o json",
        "rbac-assignments.json": f"az role assignment list --resource-group {resource_group} -o json",
        "network-security.json": f"az network nsg list -g {resource_group} -o json",
        "keyvault-access.json": f"az keyvault list -g {resource_group} --query \"[].{{name:name,sku:properties.sku,access:properties.accessPolicies}}\" -o json",
        "defender-alerts.json": f"az security alert list --resource-group {resource_group} -o json",
        "activity-log.json": f"az monitor activity-log list -g {resource_group} --offset 90d -o json",
        "private-endpoints.json": f"az network private-endpoint list -g {resource_group} -o json",
        "ai-deployments.json": f"az cognitiveservices account list -g {resource_group} -o json",
    }

    for filename, cmd in evidence_commands.items():
        result = subprocess.run(cmd.split(), capture_output=True, text=True)
        filepath = evidence_path / filename
        filepath.write_text(result.stdout if result.returncode == 0 else json.dumps({"error": result.stderr}))
        sha = hashlib.sha256(filepath.read_bytes()).hexdigest()
        manifest["artifacts"].append({"file": filename, "sha256": sha, "status": "ok" if result.returncode == 0 else "error"})

    # Write manifest with integrity hashes
    (evidence_path / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return str(evidence_path)
```

## Compliance Dashboard Query

KQL query for a Log Analytics compliance dashboard — tracks control status over time:

```kql
// Compliance posture over 30 days — one row per day per control
AzureActivity
| where TimeGenerated > ago(30d)
| where ResourceGroup == "rg-ai-prod"
| summarize
    PolicyChanges = countif(OperationNameValue has "policyAssignments"),
    RBACChanges = countif(OperationNameValue has "roleAssignments"),
    KeyVaultAccess = countif(OperationNameValue has "vaults"),
    NetworkChanges = countif(OperationNameValue has "networkSecurityGroups")
  by bin(TimeGenerated, 1d)
| order by TimeGenerated desc
```

## Remediation Tracking

Track findings from detection through resolution with SLA enforcement:

```python
REMEDIATION_SLA = {"CRITICAL": 24, "HIGH": 72, "MEDIUM": 168, "LOW": 720}  # hours

def build_remediation_plan(findings: list[dict]) -> list[dict]:
    plan = []
    for f in findings:
        sla_hours = REMEDIATION_SLA.get(f["severity"], 720)
        due = datetime.datetime.utcnow() + datetime.timedelta(hours=sla_hours)
        plan.append({
            "control": f["control"], "severity": f["severity"],
            "detail": f["detail"], "remediation": f["remediation"],
            "sla_hours": sla_hours, "due_by": due.isoformat() + "Z",
            "status": "OPEN", "assignee": None
        })
    return sorted(plan, key=lambda x: REMEDIATION_SLA.get(x["severity"], 999))
```

## Audit Report Generation

Produce a structured JSON report suitable for auditor handoff or CI/CD gate:

```python
def generate_audit_report(resource_group: str) -> dict:
    findings = audit_ai_controls(resource_group)
    plan = build_remediation_plan(findings)
    risk_level = classify_ai_risk("chatbot", affects_fundamental_rights=False)

    critical = sum(1 for f in findings if f["severity"] == "CRITICAL")
    high = sum(1 for f in findings if f["severity"] == "HIGH")

    return {
        "report_id": f"AUDIT-{datetime.datetime.utcnow().strftime('%Y%m%d-%H%M')}",
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "resource_group": resource_group,
        "eu_ai_act_risk": risk_level,
        "summary": {
            "total_findings": len(findings),
            "critical": critical, "high": high,
            "medium": len(findings) - critical - high,
            "pass_rate": f"{max(0, 100 - len(findings) * 10)}%"
        },
        "findings": findings,
        "remediation_plan": plan,
        "frameworks_assessed": ["SOC2", "ISO27001", "HIPAA", "EU_AI_ACT"],
        "verdict": "FAIL" if critical > 0 else "CONDITIONAL_PASS" if high > 0 else "PASS"
    }
```

## Phase 5 Verdict Gate

Use this final decision table after the evidence pack and remediation plan are generated:

| Verdict | Meaning | Release Action |
|---------|---------|----------------|
| `PASS` | No critical or high findings; evidence complete | Deploy or promote |
| `CONDITIONAL_PASS` | No critical findings, but high-severity remediation remains | Time-box remediation and require approver sign-off |
| `FAIL` | Any critical finding or missing evidence for a regulated control | Block release and open incident |

The Phase 5 gate should always include named approvers, due dates for open remediation, and an explicit decision on whether production rollout is allowed.

## Continuous Compliance Monitoring

Wire audit checks into CI/CD so compliance regressions block deployment:

```yaml
# .github/workflows/compliance-gate.yml
name: Compliance Gate
on:
  pull_request:
    paths: [infra/**, config/**]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - run: |
          pip install -r requirements.txt
          python -c "
          from compliance_audit import generate_audit_report
          import json, sys
          report = generate_audit_report('rg-ai-prod')
          print(json.dumps(report, indent=2))
          if report['verdict'] == 'FAIL':
              print('::error::Compliance audit FAILED — critical findings detected')
              sys.exit(1)
          "
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `az policy state` returns empty | Verify Policy assignments exist: `az policy assignment list -g $RG` |
| Defender score 0 | Enable Defender plans: `az security pricing create -n VirtualMachines --tier Standard` |
| Purview not found | Deploy: `az purview account create -n purview-ai -g $RG -l eastus` |
| Model registry empty | Register: `az ml model create -n gpt-model --version 1 -g $RG -w ws-ai` |
| Evidence hash mismatch | Re-collect — files were modified post-collection |
