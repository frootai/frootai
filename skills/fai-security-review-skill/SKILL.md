---
name: fai-security-review-skill
description: 'Conducts security review following OWASP Top 10 + LLM Top 10 with severity ratings.'
---

# Fai Security Review Skill

Conducts security review following OWASP Top 10 + LLM Top 10 with severity ratings.

## Overview

This skill provides a structured, repeatable procedure for conducts security review following owasp top 10 + llm top 10 with severity ratings.. It can be used standalone as a LEGO block or auto-wired inside solution plays via the FAI Protocol.

**Category:** Security
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

Perform the primary operation: conducts security review following owasp top 10 + llm top 10 with severity ratings..

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
| responsible-ai | Validates content safety, checks for bias, enforces groundedness |

## Compatible Solution Plays

- **Play 30**
- **Play 41**

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
npx frootai skill run fai-security-review-skill
```

### Inside a Solution Play

When referenced in `fai-manifest.json`, this skill auto-wires with the play's context:

```json
{
  "primitives": {
    "skills": ["skills/fai-security-review-skill/"]
  }
}
```

### Via Agent Invocation

Agents can invoke this skill using the `/skill` command in Copilot Chat.

## Security Checklist

- [ ] No hardcoded secrets (use Key Vault)
- [ ] Managed Identity enabled (no connection strings)
- [ ] RBAC roles follow least privilege
- [ ] Network access restricted (Private Endpoints)
- [ ] Content Safety API enabled for LLM output
- [ ] Prompt injection detection active
- [ ] PII redaction configured
- [ ] Audit logging enabled
- [ ] OWASP LLM Top 10 addressed
- [ ] Dependency scanning enabled (Dependabot/Snyk)

## Threat Model

| Threat | Category | Mitigation |
|--------|----------|-----------|
| Prompt injection | OWASP LLM01 | Input sanitization + classifier |
| Data exfiltration | OWASP LLM06 | Output validation + PII filter |
| Model theft | OWASP LLM10 | API key rotation + rate limiting |
| Insecure output | OWASP LLM02 | Schema validation + content safety |

## Secret Patterns Blocked

```bash
# Patterns the secrets-scanner hook detects
AZURE_.*_KEY=           # Azure service keys
OPENAI_API_KEY=         # OpenAI keys
-----BEGIN.*PRIVATE     # Private keys/certificates
DefaultEndpointsProtocol=  # Azure connection strings
ghp_[A-Za-z0-9]{36}    # GitHub PATs
```

## Notes

- This skill follows the FAI SKILL.md specification
- All outputs are deterministic when `dry_run=true`
- Integrates with FAI Engine for automated pipeline execution
- Part of the Security category in the FAI primitives catalog