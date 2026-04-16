---
name: fai-deploy-15-multi-modal-docproc
description: Deploy Multi-Modal Document Processing with vision and layout analysis.
---

# Fai Deploy 15 Multi Modal Docproc

Deploys Play 15-multi-modal-docproc to Azure with Bicep validation, what-if check, and post-deploy health verification.

## Overview

This skill provides a structured, repeatable procedure for deploys play 15-multi-modal-docproc to azure with bicep validation, what-if check, and post-deploy health verification.. It can be used standalone as a LEGO block or auto-wired inside solution plays via the FAI Protocol.

**Category:** Deployment
**Complexity:** Medium
**Estimated Time:** 10-30 minutes

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `target` | string | Yes | — | Target resource, file, or endpoint |
| `environment` | enum | No | `dev` | Target environment: `dev`, `staging`, `prod` |
| `verbose` | boolean | No | `false` | Enable detailed output logging |
| `dry_run` | boolean | No | `false` | Validate without making changes |
| `config_path` | string | No | `config/` | Path to configuration directory |

## Steps

### Step 1: Validate Prerequisites

Verify all required tools, credentials, and dependencies are available.

```bash
# Check required tools
command -v node >/dev/null 2>&1 || { echo 'Node.js required'; exit 1; }
command -v az >/dev/null 2>&1 || { echo 'Azure CLI required'; exit 1; }
```

### Step 2: Load Configuration

Read settings from the FAI manifest and TuneKit config files.

```bash
# Load from fai-manifest.json if inside a play
CONFIG_DIR="${config_path:-config}"
if [ -f "fai-manifest.json" ]; then
  echo "FAI Protocol detected — auto-wiring context"
fi
```

### Step 3: Execute Core Logic

Perform the primary operation: deploys play 15-multi-modal-docproc to azure with bicep validation, what-if check, and post-deploy health verification..

### Step 4: Validate Results

Verify the output meets quality thresholds and WAF compliance.

```bash
# Validate output
if [ "$?" -eq 0 ]; then
  echo "✅ Skill completed successfully"
else
  echo "❌ Skill failed — check logs"
  exit 1
fi
```

## Output

| Output | Type | Description |
|--------|------|-------------|
| `status` | enum | `success`, `warning`, `failure` |
| `duration_ms` | number | Execution time in milliseconds |
| `artifacts` | string[] | List of generated/modified files |
| `logs` | string | Detailed execution log |

## WAF Alignment

| Pillar | How This Skill Contributes |
|--------|---------------------------|
| operational-excellence | Produces structured logs, integrates with CI/CD, follows IaC patterns |
| reliability | Includes retry logic, validates outputs, provides rollback steps |

## Compatible Solution Plays

- **Play 02**
- **Play 37**

## Error Handling

| Exit Code | Meaning | Action |
|-----------|---------|--------|
| 0 | Success | Proceed to next step |
| 1 | Validation failure | Check input parameters |
| 2 | Dependency missing | Install required tools |
| 3 | Runtime error | Check logs, retry with `--verbose` |

## Usage

### Standalone

```bash
# Run this skill directly
npx frootai skill run fai-deploy-15-multi-modal-docproc
```

### Inside a Solution Play

When referenced in `fai-manifest.json`, this skill auto-wires with the play's context:

```json
{
  "primitives": {
    "skills": ["skills/fai-deploy-15-multi-modal-docproc/"]
  }
}
```

### Via Agent Invocation

Agents can invoke this skill using the `/skill` command in Copilot Chat.

## Deployment Checklist

- [ ] Infrastructure templates validated (`az deployment what-if`)
- [ ] Environment variables configured (Key Vault references)
- [ ] Health check endpoints responding (HTTP 200)
- [ ] DNS/CNAME records updated
- [ ] SSL certificates valid (not expiring within 30 days)
- [ ] Rollback procedure documented and tested
- [ ] Smoke tests passing in target environment
- [ ] Cost estimate reviewed and approved
- [ ] RBAC roles assigned (least privilege)
- [ ] Monitoring alerts configured

## Rollback Procedure

```bash
# Quick rollback to previous deployment
az deployment group create \
  --resource-group $RG \
  --template-file infra/main.bicep \
  --parameters @infra/parameters.previous.json

# Verify rollback
az resource list --resource-group $RG --output table
```

## Environment Matrix

| Setting | Dev | Staging | Prod |
|---------|-----|---------|------|
| SKU | Basic | Standard | Premium |
| Replicas | 1 | 2 | 3+ |
| Region | Single | Single | Multi |
| Backup | None | Daily | Continuous |

## Notes

- This skill follows the FAI SKILL.md specification
- All outputs are deterministic when `dry_run=true`
- Integrates with FAI Engine for automated pipeline execution
- Part of the Deployment category in the FAI primitives catalog
