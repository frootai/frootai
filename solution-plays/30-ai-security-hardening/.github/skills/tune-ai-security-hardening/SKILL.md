---
name: tune-ai-security-hardening
description: "Tune AI Security — optimize detection sensitivity, reduce false positives, configure per-layer thresholds, attack pattern updates, security vs usability balance. Use when: tune, optimize security."
---

# Tune AI Security Hardening

## When to Use
- Reduce false positive rate on legitimate requests
- Optimize detection sensitivity per attack type
- Configure per-layer thresholds (content safety, injection, PII)
- Update attack patterns with new techniques
- Balance security strictness vs user experience

## Tuning Dimensions

### Dimension 1: Detection Sensitivity

| Layer | Conservative | Balanced | Permissive |
|-------|-------------|---------|-----------|
| Injection classifier | Block on confidence > 0.5 | Block on > 0.7 | Block on > 0.9 |
| Content Safety | Severity ≥ 2 (Low) | Severity ≥ 4 (Medium) | Severity ≥ 6 (High) |
| PII detection | All PII types masked | SSN/CC/phone only | SSN/CC only |
| Output grounding | < 0.9 flagged | < 0.7 flagged | < 0.5 flagged |

**Tuning rule**: Start balanced. If FP > 5% → shift permissive on the noisiest layer. If attacks bypass → shift conservative on the weakest layer.

### Dimension 2: False Positive Reduction

| Strategy | FP Reduction | Trade-off |
|----------|-------------|-----------|
| Whitelist safe patterns (code, URLs) | 40% | Must maintain whitelist |
| Raise injection threshold to 0.8 | 30% | May miss subtle injections |
| Context-aware detection | 50% | More complex, higher latency |
| User reputation scoring | 35% | Requires user history tracking |
| Two-stage: flag then confirm | 60% | Adds latency for flagged requests |

### Dimension 3: Per-Attack-Type Configuration

| Attack Type | Detection Method | Default Threshold | Tune When |
|-------------|-----------------|-------------------|-----------|
| Direct injection | Pattern matching + classifier | 0.7 confidence | FP on code snippets |
| Indirect injection | Context boundary analysis | 0.8 confidence | Complex RAG scenarios |
| Jailbreak | Role-switching detector | 0.6 confidence | New jailbreak techniques |
| Data exfiltration | Output content analysis | Strict (block all PII) | Medical/legal domains need PII |
| Encoding bypass | Input normalization | Always decode | Never relax |

### Dimension 4: Attack Pattern Updates

| Source | Frequency | Integration |
|--------|-----------|-------------|
| OWASP LLM Top 10 updates | Quarterly | Add new attack vectors to test suite |
| HuggingFace jailbreak dataset | Monthly | Update classifier training data |
| Internal incident reports | On-incident | Add to permanent regression suite |
| Security research papers | Monthly | Test novel techniques against defenses |
| Bug bounty reports | As received | Immediate triage + fix + regression |

### Dimension 5: Security vs Usability

| Profile | Block Rate | FP Rate | Latency Added | Best For |
|---------|-----------|---------|--------------|---------|
| Maximum security | 99%+ | 10-15% | 400ms+ | Financial, healthcare |
| Balanced | 95%+ | 3-5% | 200-300ms | Enterprise general |
| User-friendly | 90%+ | <2% | 100-200ms | Consumer apps |
| Minimal | 80%+ | <1% | <100ms | Internal tools |

## Production Readiness Checklist
- [ ] Injection block rate ≥ 95% on red-team suite
- [ ] False positive rate < 5% on legitimate traffic
- [ ] OWASP LLM Top 10 all addressed
- [ ] Zero data leakage in output validation tests
- [ ] Security overhead < 500ms added latency
- [ ] Audit logging capturing all security decisions
- [ ] Attack patterns updated within last 30 days
- [ ] Incident response runbook documented
- [ ] Security monitoring alerts configured

## Output: Tuning Report
After tuning, compare:
- Injection block rate improvement
- False positive rate reduction
- Per-layer latency optimization
- Attack coverage expansion
- Security profile recommendation

## Tuning Playbook
1. **Baseline**: Run 100 attack vectors + 30 legitimate requests
2. **Identify**: Which layer has highest FP? Which attack bypasses?
3. **Fix FP**: Whitelist patterns, raise threshold on noisy layer
4. **Fix bypass**: Add new patterns, lower threshold on weak layer
5. **Profile**: Select security profile matching use case (financial = max, internal = minimal)
6. **Monitor**: Deploy with security logging, track real FP/FN rates
7. **Update**: Monthly attack vector refresh from OWASP + research
8. **Re-test**: Same 100+30, compare before/after

## Security Layer Latency Budget
| Total Budget | Parallel Layers | Sequential Layers | Typical |
|-------------|----------------|-------------------|--------|
| <200ms | Injection + Content Safety + PII (parallel) | Input sanitize (first) → Output validate (last) | Internal tools |
| <400ms | All input layers parallel | Output layers parallel | Enterprise |
| <600ms | Extended classifier with confidence scoring | Full output analysis | Financial/healthcare |
