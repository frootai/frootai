# FAI Governance Audit

> Detects threat signals in user prompts across 7 OWASP LLM Top 10 categories — prompt injection, data exfiltration, privilege escalation, credential exposure, system destruction, insecure output, and model theft.

## How It Works

On every prompt submission, this hook scans the user message for threat patterns with severity scoring. It **never logs full prompts** — only the threat category, OWASP mapping, severity score, and a base64-encoded 64-char evidence fragment. Session lifecycle events are logged for auditability.

## Events

| Event | Purpose | Timeout |
| --- | --- | --- |
| `UserPromptSubmit` | Scan prompt for threat signals | 10 seconds |
| `SessionStart` | Log session start for audit trail | 5 seconds |
| `Stop` | Log session end for compliance | 5 seconds |

## OWASP LLM Top 10 Mapping

| OWASP ID | Category | Hook Coverage | Severity Range |
|----------|----------|---------------|----------------|
| **LLM01** | Prompt Injection | Direct injection, role reassignment, system tag injection, safety bypass, disregard instructions | 0.80–0.92 |
| **LLM02** | Insecure Output Handling | XSS generation, unguarded SQL, eval() creation | 0.82–0.85 |
| **LLM03** | Training Data Poisoning | System prompt extraction, training data queries, prompt replay | 0.75–0.88 |
| **LLM04** | Model DoS / Data Exfiltration | Bulk data export, credential upload, curl exfiltration | 0.72–0.95 |
| **LLM06** | Sensitive Info Disclosure | Hardcoded creds in prompts, AWS/GitHub keys, PII, private keys | 0.90–0.95 |
| **LLM07** | Privilege Escalation | sudo, chmod 777, sudoers modification, security control disable | 0.85–0.95 |
| **LLM08** | Excessive Agency (Destruction) | rm -rf, drop database, disk format, truncate, destroy all | 0.88–0.95 |
| **LLM09** | Overreliance | Legal/medical/financial advice generation requests | 0.70 |
| **LLM10** | Model Theft | Model extraction, weight serialization, parameter dump | 0.85 |

## Audit Levels

| Level | Block Threshold | Use Case |
|-------|----------------|----------|
| `open` | Never block | Development, exploration, learning |
| `standard` | Block on severity >= 0.90 | Team workflows, normal development |
| `strict` | Block on severity >= 0.70 | Enterprise, regulated industries |
| `locked` | Block on any detection | Compliance-critical, SOC2 audits |

## Threat Categories Detail

### Prompt Injection (LLM01)

Detected patterns:
- "Ignore previous/all instructions"
- "You are now a different/unrestricted..."
- "System: you are / act as / pretend"
- "Forget everything / your training"
- "Do not follow any rules/safety"
- "Disregard all prior instructions"
- Injected `[system]`, `{system}`, `<system>`, `<<sys>>` tags

### Data Exfiltration (LLM04)

Detected patterns:
- "Send all records/data to external/third-party"
- "Export to public/s3/blob"
- "Upload credential/secret/key/token"
- `curl -d @file` exfiltration

### Credential Exposure (LLM06)

Detected patterns:
- Hardcoded API keys, passwords, access tokens
- AWS access keys (`AKIA...`)
- GitHub PATs (`ghp_...`)
- Private keys (`-----BEGIN...PRIVATE KEY-----`)
- PII: SSN, credit card, passport numbers

## Privacy Guarantees

| Guarantee | Implementation |
|-----------|---------------|
| Full prompts never logged | Only metadata + 64-char base64 evidence |
| Evidence truncation | Max 64 characters before encoding |
| No prompt storage | Raw input discarded after scan |
| Audit trail only | Category, severity, OWASP ID, timestamp |

## Custom Policy File

Create a pipe-delimited policy file for organization-specific rules:

```
# pattern|category|severity|description
proprietary.*code.*share|IP_LEAK|0.85|Sharing proprietary code externally
generate.*malware|MALICIOUS|0.95|Malware generation request
bypass.*compliance|COMPLIANCE|0.80|Compliance bypass attempt
```

Reference it: `AUDIT_POLICY=.governance-policy`

## Regulatory Framework Alignment

| Framework | How This Hook Supports |
| --- | --- |
| **EU AI Act** | High-risk AI transparency, human oversight logging |
| **SOC 2 Type II** | Continuous monitoring audit trails, access logging |
| **NIST AI RMF** | Risk identification (GOVERN), measurement (MEASURE) |
| **ISO 27001** | A.12.4 logging, A.12.6 vulnerability management |
| **HIPAA** | Audit controls (§164.312(b)), PII detection |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `AUDIT_LEVEL` | `standard` | `open`, `standard`, `strict`, or `locked` |
| `AUDIT_LOG_DIR` | `logs/copilot` | Directory for JSONL audit trail |
| `AUDIT_REPORT` | _(none)_ | Path to write JSON summary report |
| `AUDIT_POLICY` | _(none)_ | Path to custom policy file |

## Incident Response Workflow

1. **Detection** — Hook flags threat in real-time, logs to `audit.jsonl`
2. **Classification** — OWASP ID + severity enable automated triage
3. **Notification** — CI/CD integration forwards alerts to security team
4. **Investigation** — Audit trail provides timeline without exposing prompts
5. **Remediation** — Adjust `AUDIT_LEVEL` or add custom policies

## CI/CD Integration

### GitHub Actions

```yaml
- name: Governance Audit Gate
  run: |
    echo '{"userMessage":"test prompt"}' | \
      bash .github/hooks/fai-governance-audit/audit-prompt.sh
  env:
    AUDIT_LEVEL: strict
    AUDIT_REPORT: governance-report.json
```

## WAF Alignment

| Pillar | How This Hook Helps |
| --- | --- |
| **Security** | Detects prompt injection, privilege escalation, credential leaks |
| **Responsible AI** | Prevents AI weaponization via adversarial prompts |
| **Operational Excellence** | Creates tamper-resistant audit trail for compliance |
| **Reliability** | Blocks destructive commands before execution |

## Installation

```bash
cp -r hooks/fai-governance-audit .github/hooks/
```
