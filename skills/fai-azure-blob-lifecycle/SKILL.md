---
name: fai-azure-blob-lifecycle
description: 'Designs Azure Blob Storage lifecycle management with tiering and retention policies.'
---

# Fai Azure Blob Lifecycle

Designs Azure Blob Storage lifecycle management with tiering and retention policies.

## Overview

This skill provides a structured, repeatable procedure for designs azure blob storage lifecycle management with tiering and retention policies.. It can be used standalone as a LEGO block or auto-wired inside solution plays via the FAI Protocol.

**Category:** Azure Integration
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

Perform the primary operation: designs azure blob storage lifecycle management with tiering and retention policies..

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
| security | Validates credentials, enforces least-privilege, scans for secrets |
| cost-optimization | Uses efficient resources, tracks token usage, suggests right-sizing |

## Compatible Solution Plays

- **Play 02**
- **Play 14**

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
npx frootai skill run fai-azure-blob-lifecycle
```

### Inside a Solution Play

When referenced in `fai-manifest.json`, this skill auto-wires with the play's context:

```json
{
  "primitives": {
    "skills": ["skills/fai-azure-blob-lifecycle/"]
  }
}
```

### Via Agent Invocation

Agents can invoke this skill using the `/skill` command in Copilot Chat.

## Configuration Reference

```json
{
  "skill": "skill-name",
  "version": "1.0.0",
  "timeout_seconds": 300,
  "retry_attempts": 3,
  "log_level": "info"
}
```

## Monitoring

Track skill execution metrics:

| Metric | Description | Alert Threshold |
|--------|-------------|----------------|
| Duration | Execution time | > 60 seconds |
| Success rate | Pass/fail ratio | < 95% |
| Error count | Failed executions | > 5/hour |

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Timeout | Slow dependency | Increase timeout_seconds |
| Auth failure | Expired credentials | Refresh Managed Identity |
| Missing config | No fai-manifest.json | Create manifest or pass config_path |
| Validation error | Invalid input | Check parameter types and ranges |

## Notes

- This skill follows the FAI SKILL.md specification
- All outputs are deterministic when `dry_run=true`
- Integrates with FAI Engine for automated pipeline execution
- Part of the Azure Integration category in the FAI primitives catalog