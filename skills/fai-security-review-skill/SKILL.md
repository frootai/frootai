---
name: fai-security-review-skill
description: |
  Conduct security reviews for AI applications covering OWASP LLM Top 10,
  prompt injection defense, data leakage prevention, and access control.
  Use when auditing AI code for security vulnerabilities.
---

# AI Security Review

Review AI applications for OWASP LLM Top 10 and security best practices.

## When to Use

- Reviewing AI application code before production
- Auditing for prompt injection vulnerabilities
- Checking data leakage and access control
- Validating OWASP LLM Top 10 compliance

---

## OWASP LLM Top 10 Checklist

| # | Risk | Check |
|---|------|-------|
| LLM01 | Prompt Injection | Input sanitization, system prompt protection |
| LLM02 | Insecure Output | Output validation, no raw HTML rendering |
| LLM03 | Training Data Poisoning | Data provenance, quality checks |
| LLM04 | Model Denial of Service | Rate limiting, token budgets |
| LLM05 | Supply Chain | Dependency scanning, model source verification |
| LLM06 | Sensitive Info Disclosure | PII filtering, no secrets in prompts |
| LLM07 | Insecure Plugin Design | Input validation on tools, least privilege |
| LLM08 | Excessive Agency | Limited tool permissions, human approval |
| LLM09 | Overreliance | Grounding, citations, confidence scores |
| LLM10 | Model Theft | Access control, API key rotation |

## Prompt Injection Defense

```python
def sanitize_user_input(text: str) -> str:
    """Remove common prompt injection patterns."""
    import re
    patterns = [
        r"(?i)ignore\s+(previous|above|all)\s+(instructions?|rules?)",
        r"(?i)you\s+are\s+now\s+(a|an)\s+",
        r"(?i)system\s*:\s*",
        r"(?i)###\s*(system|instruction|prompt)",
    ]
    for pattern in patterns:
        text = re.sub(pattern, "[FILTERED]", text)
    return text

# Always validate output before returning to user
def validate_output(response: str, system_prompt: str) -> str:
    """Ensure output doesn't leak system prompt."""
    if system_prompt[:50].lower() in response.lower():
        return "I cannot provide that information."
    return response
```

## Security Review Checklist

```markdown
## AI Security Review — [Service Name]

### Authentication & Authorization
- [ ] All endpoints require authentication
- [ ] Managed Identity used (no API keys in code)
- [ ] RBAC roles are least-privilege

### Input Validation
- [ ] User input sanitized before LLM
- [ ] File uploads validated (type, size)
- [ ] No SQL/command injection vectors

### Data Protection
- [ ] PII stripped before sending to LLM
- [ ] No secrets in prompts or context
- [ ] Audit logging captures access events

### Output Safety
- [ ] Content safety filter enabled
- [ ] Output validated before rendering
- [ ] System prompt not leakable

### Rate Limiting
- [ ] Per-user rate limits configured
- [ ] Token budget enforced
- [ ] Circuit breaker on LLM calls
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Prompt injection succeeds | No input sanitization | Add sanitize_user_input() |
| System prompt leaked | No output validation | Check response against prompt content |
| PII in LLM logs | No scrubbing | Sanitize before API call |
| No rate limiting | Missing middleware | Add per-user token budget |

