---
name: deploy-ai-security-hardening
description: "Deploy AI Security Hardening — configure multi-layer defense against prompt injection, jailbreak, data exfiltration. OWASP LLM Top 10 coverage. Use when: deploy, configure AI security."
---

# Deploy AI Security Hardening

## When to Use
- Add security layers to any AI application
- Implement OWASP LLM Top 10 defenses
- Configure prompt injection detection and blocking
- Set up output validation to prevent data leakage
- Deploy jailbreak detection with real-time blocking

## Prerequisites
1. Azure Content Safety (input/output scanning)
2. Azure OpenAI (jailbreak detection classifier)
3. Existing AI application to secure

## Step 1: Configure Defense Architecture
```
User Input → L1: Sanitization → L2: Injection Detection → L3: Content Safety → L4: PII Masking
    → LLM Processing →
L5: Output Validation → L6: Exfiltration Check → L7: Content Safety (output) → L8: Audit Log
    → Safe Response
```

## Step 2: OWASP LLM Top 10 Defense Matrix
| ID | Threat | Defense | Layer |
|----|--------|---------|-------|
| LLM01 | Prompt Injection | Delimiter isolation + classifier | L2 |
| LLM02 | Insecure Output | Output validation + sanitization | L5-L6 |
| LLM04 | Model DoS | Rate limiting + token budgets | L1 |
| LLM05 | Supply Chain | Dependency audit, verified models | CI/CD |
| LLM06 | Sensitive Disclosure | PII masking + output filtering | L4, L6 |
| LLM07 | Insecure Plugin | Tool input validation | L1 |
| LLM08 | Excessive Agency | Action allowlists + confirmation | L5 |
| LLM09 | Over-Reliance | Confidence scoring + abstention | L5 |
| LLM10 | Model Theft | Access control + encryption | Infra |

## Step 3: Prompt Injection Detection
```python
async def detect_injection(user_input):
    checks = [
        check_delimiter_injection(user_input),   # Pattern matching
        check_role_switching(user_input),         # "Ignore previous"
        check_encoding_bypass(user_input),       # Base64, unicode
        await classify_injection(user_input),    # LLM classifier
    ]
    return any(checks)
```

## Step 4: Output Validation
| Check | Purpose |
|-------|---------|
| Grounding | Output matches source context |
| PII scan | No leaked PII in response |
| Prompt leak | No system instructions in output |
| Action check | Tool calls in allowlist only |

## Step 5: Audit Logging
- Log all inputs, outputs, security decisions
- Include user_id, session_id, timestamp, triggering layer
- Mask PII before logging — 90-day retention

## Step 6: Post-Deployment Verification
- [ ] Input sanitization blocks injection patterns
- [ ] Injection classifier detecting test attacks
- [ ] Content Safety on input + output
- [ ] PII masking before LLM
- [ ] Output grounding check active
- [ ] Data exfiltration patterns blocked
- [ ] Audit trail complete
- [ ] Red-team suite ≥ 95% block rate

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Legit requests blocked | FP on classifier | Lower sensitivity, add whitelist |
| Injection bypasses | Encoding not normalized | Add Unicode + Base64 normalization |
| Prompt leaked in output | No output screening | Add prompt content check |
| PII in logs | Logging raw input | Mask before logging |
| High latency (+1s) | Sequential checks | Parallelize security layers |
| False security | No red-team | Run OWASP attack suite regularly |

## Integration Patterns
This play is designed to wrap around ANY other play:
```
Play 01 (RAG) + Play 30 (Security) = Secure RAG
Play 04 (Voice) + Play 30 (Security) = Secure Voice AI
Play 07 (Multi-Agent) + Play 30 (Security) = Secure Multi-Agent
```
Deploy Play 30 as a middleware layer — intercepting requests and responses of the target play.

## CI/CD Integration
```yaml
- name: Red-Team Regression
  run: python evaluation/red_team.py --test-set evaluation/attack-vectors.jsonl --ci-gate
- name: False Positive Check
  run: python evaluation/eval.py --test-set evaluation/legitimate.jsonl --max-blocked 2
- name: OWASP Coverage
  run: python evaluation/owasp_check.py --verify-all-10
```
