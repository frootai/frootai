# FAI WAF Compliance

> Validates code changes against all 6 Well-Architected Framework pillars with per-pillar scoring and configurable thresholds.

## How It Works

When a Copilot session ends, this hook scans the git diff for anti-patterns mapped to the 6 WAF pillars. Each pillar starts at a perfect 100 and loses points per violation (weighted by severity). Any pillar score falling below the configurable threshold triggers a warning or blocks the commit.

## Event

| Field | Value |
| --- | --- |
| **Trigger** | `Stop` |
| **Mode** | `warn` (log findings) or `block` (exit 1 if any pillar fails) |
| **Scope** | Uncommitted + staged git diff (added lines only) |
| **Timeout** | 30 seconds |

## Pillar Checklist

### Reliability

| ID | Check | Severity | Weight |
| --- | --- | --- | --- |
| R-1 | Bare catch blocks — swallowed errors | High | -15 |
| R-2 | HTTP calls without `.catch` or `try/catch` | Medium | -8 |
| R-3 | HTTP client created without timeout config | Medium | -6 |
| R-4 | Single replica count — no high-availability | Medium | -8 |
| R-5 | `process.exit()` in non-CLI server code | Medium | -6 |
| R-6 | Promise without rejection handler | Medium | -6 |

### Security

| ID | Check | Severity | Weight |
| --- | --- | --- | --- |
| S-1 | Hardcoded API key / password / token in assignment | Critical | -25 |
| S-2 | `chmod 777` or `chmod 666` — overly permissive | High | -15 |
| S-3 | Bicep param with "secret/password/key" missing `@secure()` | High | -12 |
| S-4 | TLS verification disabled (`rejectUnauthorized: false`) | Critical | -20 |
| S-5 | String concatenation in SQL query — injection risk | High | -15 |
| S-6 | Inline connection string instead of Key Vault reference | High | -12 |
| S-7 | Wildcard `*` CORS origin | High | -10 |
| S-8 | `eval()` or `Function()` constructor with string input | High | -12 |

### Cost Optimization

| ID | Check | Severity | Weight |
| --- | --- | --- | --- |
| C-1 | Hardcoded Premium/Dedicated SKU | Medium | -8 |
| C-2 | OpenAI `completions.create` without `max_tokens` | Medium | -6 |
| C-3 | GPT-4 model for potentially low-complexity task | Low | -4 |
| C-4 | `while(true)` in serverless/Functions context | Medium | -8 |
| C-5 | Unbounded database query without limit | Medium | -6 |
| C-6 | Cache set without TTL | Low | -4 |

### Operational Excellence

| ID | Check | Severity | Weight |
| --- | --- | --- | --- |
| O-1 | Bicep resource without `@description` decorator | Medium | -6 |
| O-2 | `console.log` with sensitive variable names | High | -10 |
| O-3 | `print`/`console.log` instead of structured logger | Low | -3 |
| O-4 | Catch block without telemetry or logging | Medium | -6 |
| O-5 | Hardcoded Azure/OpenAI endpoint URL | Medium | -5 |
| O-6 | Azure resource without tags metadata | Low | -3 |

### Performance Efficiency

| ID | Check | Severity | Weight |
| --- | --- | --- | --- |
| P-1 | Synchronous file I/O (`readFileSync`) in async context | Medium | -8 |
| P-2 | List/query operation without pagination | Medium | -6 |
| P-3 | N+1 query pattern in loop | High | -10 |
| P-4 | I/O call missing `await` | Medium | -6 |
| P-5 | `JSON.parse` on large unbounded input body | Medium | -5 |
| P-6 | Regex with user input — ReDoS risk | Medium | -6 |

### Responsible AI

| ID | Check | Severity | Weight |
| --- | --- | --- | --- |
| RA-1 | System prompt without safety boundary declaration | Medium | -6 |
| RA-2 | Raw user input concatenated into LLM prompt | High | -12 |
| RA-3 | LLM output used without validation or grounding check | Medium | -6 |
| RA-4 | PII field names interpolated into prompt templates | High | -10 |
| RA-5 | OpenAI call without content safety filter | Medium | -8 |
| RA-6 | Temperature above 1.0 — higher hallucination risk | Low | -4 |

## Scoring Methodology

Each pillar starts at **100 points**. Every violation deducts its weight (clamped to 0).

```
Pillar Score = max(0, 100 - sum(violation_weights))
```

Default threshold: **60/100**. Override with `WAF_THRESHOLD`.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `WAF_MODE` | `warn` | `warn` = log findings, `block` = exit 1 if any pillar fails |
| `WAF_THRESHOLD` | `60` | Minimum passing score per pillar (0–100) |
| `WAF_REPORT_FILE` | _(none)_ | Path to write JSON compliance report |
| `WAF_FALSE_POSITIVES` | _(none)_ | Pipe-separated extra false positive terms |

## JSON Report

Set `WAF_REPORT_FILE=waf-report.json`:

```json
{
  "timestamp": "2026-04-06T10:30:00Z",
  "threshold": 60,
  "totalFindings": 3,
  "failingPillars": 1,
  "pillars": {
    "reliability": { "score": 77, "findings": 2 },
    "security": { "score": 48, "findings": 1 },
    "cost-optimization": { "score": 100, "findings": 0 },
    "operational-excellence": { "score": 100, "findings": 0 },
    "performance-efficiency": { "score": 100, "findings": 0 },
    "responsible-ai": { "score": 100, "findings": 0 }
  }
}
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: WAF Compliance Check
  run: bash .github/hooks/FAI-waf-compliance/check-waf.sh
  env:
    WAF_MODE: block
    WAF_THRESHOLD: "70"
    WAF_REPORT_FILE: waf-report.json
```

### Azure DevOps

```yaml
- script: bash .github/hooks/FAI-waf-compliance/check-waf.sh
  env:
    WAF_MODE: block
    WAF_THRESHOLD: "70"
  displayName: 'WAF Compliance Gate'
```

## WAF Alignment

| Pillar | How This Hook Helps |
| --- | --- |
| **Reliability** | Catches bare catch blocks, missing error handling, single-replica configs |
| **Security** | Detects hardcoded secrets, disabled TLS, SQL injection, wildcard CORS |
| **Cost Optimization** | Flags premium SKUs, missing token budgets, infinite loops in serverless |
| **Operational Excellence** | Enforces structured logging, Bicep metadata, config externalization |
| **Performance Efficiency** | Identifies sync I/O, N+1 queries, missing pagination, ReDoS risk |
| **Responsible AI** | Validates content safety config, prompt injection guards, PII handling |

## Installation

```bash
cp -r hooks/FAI-waf-compliance .github/hooks/
```

Or reference from `fai-manifest.json`:

```json
{
  "primitives": {
    "hooks": ["FAI-waf-compliance"]
  }
}
```
