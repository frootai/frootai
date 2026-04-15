---
name: fai-threat-model
description: |
  Conduct threat modeling for AI applications with STRIDE analysis, trust
  boundaries, attack surface mapping, and mitigation priorities. Use when
  assessing security risks before production deployment.
---

# AI Threat Modeling

Model threats for AI applications with STRIDE and trust boundary analysis.

## When to Use

- Before deploying an AI application to production
- Assessing new features that change the attack surface
- Compliance reviews requiring threat documentation
- Training teams on AI-specific threat patterns

---

## STRIDE for AI Applications

| Threat | AI Example | Mitigation |
|--------|-----------|-----------|
| **S**poofing | Fake user identity to access AI | OAuth2/MI auth, no anonymous access |
| **T**ampering | Modify training data or prompts | Input validation, prompt integrity |
| **R**epudiation | Deny AI-generated actions | Audit logging, immutable trails |
| **I**nformation Disclosure | PII leaked via LLM output | PII filtering, output validation |
| **D**enial of Service | Token exhaustion attack | Rate limiting, token budgets |
| **E**levation of Privilege | Prompt injection to bypass controls | Input sanitization, guardrails |

## Trust Boundary Diagram

```
┌─────────────────────────────────────────────┐
│ UNTRUSTED: Internet                         │
│  [User Browser] ──HTTPS──→ [WAF/CDN]       │
└────────────────────────────┬────────────────┘
                             │
┌────────────────────────────▼────────────────┐
│ DMZ: API Gateway (APIM)                     │
│  - Rate limiting                            │
│  - Auth validation                          │
│  - Input sanitization                       │
└────────────────────────────┬────────────────┘
                             │ MI Auth
┌────────────────────────────▼────────────────┐
│ TRUSTED: Application VNet                   │
│  [API] → [Azure OpenAI] (Private Endpoint)  │
│  [API] → [AI Search] (Private Endpoint)     │
│  [API] → [Cosmos DB] (Private Endpoint)     │
│  [API] → [Key Vault] (Private Endpoint)     │
└─────────────────────────────────────────────┘
```

## AI-Specific Threats

| Threat | Description | Mitigation |
|--------|------------|-----------|
| Prompt injection | User manipulates system behavior | Input sanitization, system prompt protection |
| Data exfiltration | LLM reveals training data | Content filtering, output validation |
| Model abuse | Excessive API calls for non-intended use | Rate limiting, usage monitoring |
| Supply chain | Compromised model or package | Pin versions, verify checksums |
| Jailbreak | Bypassing safety guardrails | Multi-layer content safety, red teaming |

## Threat Assessment Template

```markdown
| # | Threat | Category | Likelihood | Impact | Risk | Mitigation | Status |
|---|--------|----------|-----------|--------|------|-----------|--------|
| 1 | Prompt injection | Elevation | High | High | Critical | Input sanitization + guardrails | In progress |
| 2 | PII in responses | Info Disc. | Medium | High | High | Output filtering | Done |
| 3 | Token exhaustion | DoS | Medium | Medium | Medium | Rate limiting | Done |
| 4 | Model version drift | Tampering | Low | Medium | Low | Pin model version | Planned |
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Threats missed | No systematic approach | Use STRIDE for each component |
| Risk overestimated | No likelihood assessment | Rate likelihood AND impact separately |
| Model incomplete | Missing trust boundaries | Draw boundary diagram FIRST |
| Mitigations not implemented | No tracking | Add status column to threat register |

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
