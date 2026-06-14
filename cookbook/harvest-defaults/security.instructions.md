---
description: "Baseline security patterns and OWASP LLM Top 10 mitigations (cloud-agnostic)"
applyTo: "**/*.{py,ts,js,bicep,tf,json,yml,yaml}"
---

# Security Patterns — Baseline

Cloud-agnostic security guardrails applied to every Solution Play emitted by
the FAI harvest pipeline. Cloud-specific extensions live in
`<cloud>-coding.instructions.md`.

## OWASP LLM Top 10 Mitigations

### LLM01: Prompt Injection
- **System prompt isolation:** never concatenate user input into the system message
- **Input sanitization:** strip control characters, cap length to a known budget (default 4096 tokens)
- **Output validation:** validate LLM responses against a schema before returning
- **Delimiter strategy:** wrap user content in XML-style delimiters

```python
import re

def sanitize_user_input(text: str, max_length: int = 4096) -> str:
    text = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", text)
    if len(text) > max_length:
        text = text[:max_length]
    return text.replace("SYSTEM:", "").replace("ASSISTANT:", "").strip()
```

### LLM02: Insecure Output Handling
- Validate every LLM output against a JSON schema before passing it on
- HTML-encode any LLM output rendered in a web UI
- Never `exec`/`eval` LLM-generated code outside a sandbox
- Log outputs (or output metadata) for audit

### LLM03: Training Data Poisoning
- Use only curated, verified knowledge sources for retrieval
- Attach source attribution to every generated response
- Monitor groundedness; alert below threshold

### LLM04: Denial of Service
- Set `max_tokens` on every call
- Rate-limit per user/session (default 60 req/min)
- Time-out long requests (default 60 s)
- Apply a circuit breaker around model calls

### LLM05: Supply Chain
- Pin SDK versions to exact (no `^`, no `~`)
- Run `pip audit` / `npm audit` in CI
- Prefer vendor-managed base images
- Verify package checksums on install

### LLM06: Sensitive Information Disclosure
- Run PII detection on inputs and outputs
- Log metadata only in production (never full prompts/responses)
- Mask known PII patterns (email, phone, SSN)
- Classify data at rest with the platform's data-governance service

### LLM07: Insecure Plugin / Tool Design
- Validate every MCP tool input against a JSON schema
- Least-privilege tool permissions
- Log every tool invocation with parameters and result
- Rate-limit tool calls per session

### LLM08: Excessive Agency
- Maintain an explicit tool allowlist in `config/agents.json`
- Require human approval for destructive actions (delete / update / deploy)
- Enforce policy via `guardrails.json` preToolUse hooks
- Log every agent decision and tool selection

### LLM09: Overreliance
- Always include source citations
- Surface confidence scores when available
- Add disclaimers on generated content in user-facing surfaces
- Human-in-the-loop for high-stakes decisions

### LLM10: Model Theft
- Place model endpoints behind private networking
- Never expose model endpoints publicly without auth
- Rotate API keys on a fixed cycle (default 90 days)
- Prefer managed identity over keys where the platform supports it

## Platform-Neutral Security Baseline

### Network
- All AI services behind a private endpoint / VPC equivalent
- Restrict ingress with NSG / Security Group / firewall rules
- Enable DDoS protection on public-facing surfaces
- Place a WAF in front of API gateways

### Identity & Access
- Workload identity for service-to-service auth (no static keys)
- RBAC with least-privilege role assignments
- Conditional access on admin operations
- OIDC / OAuth2 for user authentication

### Data Protection
- Encryption at rest (platform-managed minimum; customer-managed for sensitive data)
- TLS 1.2+ for data in transit
- Centralized secret store for credentials, certificates, connection strings
- Retention policies aligned with the play's compliance posture

### Monitoring & Incident Response
- Enable the platform's defender / security center on all subscriptions
- Alert on anomalous access patterns
- Diagnostic logging on every resource
- SIEM integration for correlation
- Documented incident-response runbook with escalation

## Input Validation
- Validate request bodies against Pydantic (Python) or Zod (TypeScript) models
- Cap payload size (default 10 MB)
- Reject unexpected content types
- Sanitize file uploads: MIME check, malware scan, size cap

## Secret Management
- **Never** commit secrets to git (`.gitignore` + pre-commit hooks)
- Store every secret in the platform's managed secret store
- Reference secrets via the secret store, not env vars baked into images
- Rotate on schedule (default 90 days)
- Prefer workload identity to access the secret store

## Audit Logging
- Log all authentication events (success and failure)
- Log all data-access events with user identity and resource accessed
- Log all administrative actions
- Retain audit logs for a minimum of 1 year (adjust per compliance regime)
- Ship logs to a query-able store for alerting

## License

This file is part of the FAI cookbook (CC0-1.0). Plays MAY embed verbatim.
