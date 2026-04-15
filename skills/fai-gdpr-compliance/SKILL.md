---
name: fai-gdpr-compliance
description: |
  Implement GDPR-aligned controls for data minimization, subject rights,
  consent management, and audit readiness. Use when building AI systems
  that process personal data of EU residents.
---

# GDPR Compliance for AI Systems

Implement data protection controls for AI workloads handling personal data.

## When to Use

- Processing personal data of EU/EEA residents
- Building AI features that use user-provided content
- Implementing data subject access, deletion, or portability requests
- Preparing for GDPR compliance audits

---

## Key Requirements

| GDPR Article | Requirement | AI Implementation |
|-------------|-------------|-------------------|
| Art. 5 | Data minimization | Only store data needed for the task |
| Art. 6 | Lawful basis | Document basis (consent, legitimate interest) |
| Art. 13-14 | Transparency | Inform users AI processes their data |
| Art. 15 | Right of access | Export user data on request |
| Art. 17 | Right to erasure | Delete user data and derived embeddings |
| Art. 20 | Data portability | Export in machine-readable format |
| Art. 22 | Automated decisions | Allow human review for significant decisions |
| Art. 35 | DPIA | Conduct impact assessment for high-risk AI |

## Data Subject Rights API

```python
from fastapi import APIRouter
router = APIRouter(prefix="/gdpr")

@router.get("/export/{user_id}")
async def export_user_data(user_id: str):
    """Art. 15/20: Export all user data in JSON format."""
    data = {
        "profile": await db.get_user(user_id),
        "conversations": await db.get_conversations(user_id),
        "embeddings_count": await vector_store.count_by_user(user_id),
    }
    return {"user_id": user_id, "data": data, "exported_at": datetime.now().isoformat()}

@router.delete("/erase/{user_id}")
async def erase_user_data(user_id: str):
    """Art. 17: Delete all user data including derived data."""
    await db.delete_user(user_id)
    await db.delete_conversations(user_id)
    await vector_store.delete_by_metadata({"userId": user_id})
    await audit_log.record("gdpr_erasure", user_id=user_id)
    return {"status": "erased", "user_id": user_id}
```

## Data Minimization in Prompts

```python
def sanitize_for_llm(user_input: str) -> str:
    """Remove PII before sending to LLM."""
    import re
    sanitized = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
                       '[EMAIL]', user_input)
    sanitized = re.sub(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', '[PHONE]', sanitized)
    return sanitized
```

## Consent Tracking

```python
class ConsentRecord:
    user_id: str
    purpose: str  # "ai_processing", "analytics", "marketing"
    granted: bool
    timestamp: str
    source: str  # "signup_form", "settings_page", "api"
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Can't delete all user data | Embeddings not tagged with userId | Add userId to vector metadata |
| PII in LLM logs | No sanitization before API call | Sanitize user input before sending |
| No audit trail | Deletions not logged | Log all GDPR actions to immutable audit |
| DPIA not done | Assumed low risk | Conduct DPIA for any AI processing PII |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Defense in depth | Multiple layers, not single point |
| Least privilege always | Minimize blast radius |
| Audit log everything | Evidence for compliance and debugging |
| Automate scanning in CI | Catch issues before merge |
| Rotate credentials regularly | Reduce exposure window |
| Test security controls | Verify they actually work |

## Security Review Checklist

- [ ] No hardcoded secrets or credentials
- [ ] Managed Identity used for all Azure services
- [ ] Private endpoints for data-plane access
- [ ] Input validation on all user-facing endpoints
- [ ] Output filtering for PII and sensitive data
- [ ] Rate limiting configured
- [ ] Audit logging enabled

## Related Skills

- `fai-security-review-skill` — OWASP LLM Top 10 review
- `fai-secret-scanning` — Pre-commit secret detection
- `fai-threat-model` — STRIDE threat analysis
- `fai-guardrails-policy` — AI safety guardrails
