---
name: evaluate-ai-powered-devops
description: "Evaluate AI-Powered DevOps — measure incident response accuracy, risk score calibration, auto-remediation safety, alert correlation quality, MTTR reduction. Use when: evaluate, test AIOps."
---

# Evaluate AI-Powered DevOps

## When to Use
- Validate LLM root cause analysis accuracy on past incidents
- Calibrate deployment risk scoring against actual outcomes
- Test auto-remediation safety (does it fix without breaking?)
- Measure alert correlation quality (noise reduction)
- Calculate MTTR improvement vs manual incident response

## AIOps Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Root cause accuracy | ≥ 75% | LLM diagnosis matches actual cause |
| Risk score calibration | ±1 of actual outcome | Score vs deploy success/failure |
| Auto-remediation success | ≥ 95% | Fix applied without side effects |
| Alert correlation accuracy | ≥ 90% | Correctly grouped / total groups |
| MTTR reduction | ≥ 40% vs manual | Time to resolve with vs without AI |
| False positive (risk) | < 15% | Safe deploys flagged as risky |
| Auto-fix blast radius | 0 unintended | No collateral damage |
| Post-incident report quality | ≥ 4.0/5.0 | Ops team rating |

## Step 1: Test Root Cause Analysis
Replay historical incidents through LLM:
```json
{"incident": "API latency spike 2026-03-15", "alerts": ["cpu_high", "memory_warning", "latency_p99>5s"],
 "actual_cause": "Memory leak in connection pool", "expected_remediation": "Restart pods + fix pool cleanup"}
```
Minimum: 20 past incidents with known root cause.

## Step 2: Calibrate Risk Scoring
| Deploy # | Predicted Risk | Actual Outcome | Calibration |
|----------|---------------|----------------|-------------|
| 1 | 3 (Low) | Success | ✅ Correct |
| 2 | 8 (High) | Success | ❌ Over-predicted |
| 3 | 7 (High) | Failed (rolled back) | ✅ Correct |

Track 30+ deploys, compare predicted risk vs actual outcome.

## Step 3: Test Auto-Remediation Safety
- Simulate: high CPU → verify auto-scale triggers correctly
- Simulate: pod crash → verify restart (not delete)
- Simulate: disk full → verify log archival (not data deletion)
- Verify: risky remediation requires human approval
- Verify: blast radius check prevents multi-service impact

## Step 4: Measure MTTR Improvement
| Incident Type | Manual MTTR | AI-Assisted MTTR | Improvement |
|--------------|-------------|------------------|-------------|
| Service outage | 45 min | 15 min | 67% faster |
| Performance degradation | 60 min | 25 min | 58% faster |
| Security incident | 90 min | 40 min | 56% faster |
| Configuration error | 30 min | 10 min | 67% faster |

## Step 5: Generate Report
```bash
python evaluation/eval.py --all --output evaluation/devops-report.json --ci-gate
```

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Enable AI-powered incident response |
| Root cause < 60% | Improve context in LLM prompt (add logs, metrics) |
| Auto-fix causes issues | Raise confidence threshold, narrow allowed actions |
| Risk score over-predicts | Reduce change-size weight |
| MTTR not improved | Check if ops team is using AI suggestions |

## Evaluation Cadence
- **Pre-deployment**: Replay 20 historical incidents
- **Weekly**: Review auto-remediation actions taken
- **Monthly**: Calibrate risk scoring with deploy outcomes
- **Post-incident**: Add new incident to evaluation dataset

## Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| LLM says "unknown cause" | Insufficient log context | Add 5-min log window to prompt |
| Risk score always medium (5) | Weights not calibrated | Tune from 30+ deploy outcomes |
| Auto-fix restarts wrong pod | Multi-service deployment | Add pod label filtering |
| Correlated alerts split | Time window too narrow | Increase from 2 to 5 min |
| Post-incident report vague | Missing timeline | Include deploy + alert timeline |
| False alarm on weekend deploy | Time-of-day weight too high | Reduce or use separate weekend model |

## CI/CD Quality Gates
```yaml
- name: Risk Score Gate
  run: python evaluation/eval.py --metrics risk_calibration --ci-gate --tolerance 1
- name: Remediation Safety Gate
  run: python evaluation/eval.py --metrics remediation_safety --ci-gate --threshold 0.95
- name: MTTR Improvement Gate
  run: python evaluation/eval.py --metrics mttr --ci-gate --min-improvement 0.30
```

## Benchmark: Manual vs AI-Assisted Incident Response
| Phase | Manual | AI-Assisted | Savings |
|-------|--------|-------------|---------|
| Alert triage | 10 min | 1 min (auto-correlate) | 90% |
| Root cause | 20 min | 5 min (LLM analysis) | 75% |
| Remediation | 15 min | 2 min (auto-fix) | 87% |
| Post-mortem | 60 min | 10 min (auto-report) | 83% |
