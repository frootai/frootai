---
name: tune-ai-powered-devops
description: "Tune AI-Powered DevOps — optimize alert correlation windows, risk scoring weights, remediation confidence, incident prompt quality, cost. Use when: tune, optimize AIOps."
---

# Tune AI-Powered DevOps

## When to Use
- Optimize alert correlation time windows and grouping
- Calibrate risk scoring weights from deploy history
- Tune auto-remediation confidence thresholds
- Improve LLM incident analysis prompt quality
- Reduce false positives in risk scoring

## Tuning Dimensions

### Dimension 1: Alert Correlation Tuning

| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| Time window | 5 min | 2-15 min | Wider = more grouped, narrower = more incidents |
| Service grouping | Same service | Service chain | Chain = catches cascading failures |
| Max alerts per incident | 100 | 20-500 | Too low = splits real incidents |
| Dedup window | 1 min | 30s-5 min | Prevents repeat alerts counting as separate |

**Tuning rule**: Start at 5 min. If incidents split → widen. If unrelated grouped → narrow.

### Dimension 2: Risk Scoring Weight Calibration

| Factor | Default | After 30 Deploys | After 100 Deploys |
|--------|---------|-----------------|-------------------|
| Change size | 0.25 | Adjust from data | Adjust from data |
| Blast radius | 0.30 | Adjust from data | Adjust from data |
| Time of day | 0.10 | Adjust from data | Adjust from data |
| Author exp | 0.10 | Adjust from data | Adjust from data |
| Test coverage | 0.15 | Adjust from data | Adjust from data |
| Dependencies | 0.10 | Adjust from data | Adjust from data |

**Method**: Compare predicted risk vs actual outcome. Increase weight for factors that predict failures well.

### Dimension 3: Remediation Confidence

| Action Type | Default Threshold | Conservative | Aggressive |
|------------|------------------|-------------|-----------|
| Restart pod | 0.95 | 0.99 | 0.90 |
| Scale up | 0.90 | 0.95 | 0.85 |
| Rotate certificate | 0.99 | 0.99 | 0.95 |
| Archive logs | 0.85 | 0.90 | 0.80 |
| Rollback deploy | 0.80 | 0.95 | 0.70 |
| Database fix | N/A (always human) | N/A | N/A |

### Dimension 4: Incident Analysis Prompt

| Optimization | Before | After | Impact |
|-------------|--------|-------|--------|
| Add logs to context | Generic analysis | "Based on these error logs..." | +30% accuracy |
| Add deployment timeline | "Something failed" | "Deploy at 14:00, errors at 14:05" | +25% root cause |
| Add dependency map | Isolated analysis | "Service A depends on Service B" | +20% cascade detection |
| Add past remediation | Suggests new fix | "Last time this was fixed by..." | +40% action quality |

### Dimension 5: Cost Per Incident

| Component | Cost | Optimization |
|-----------|------|-------------|
| LLM analysis (gpt-4o) | ~$0.05/incident | Use gpt-4o-mini for triage, gpt-4o for full analysis |
| Alert processing | ~$0.001/alert | Batch process, correlate before LLM |
| Risk scoring | ~$0.01/deploy | Cache for same commit |
| Auto-remediation | ~$0.001/action | Only Azure API calls |

**Monthly estimate** (50 incidents/mo, 200 deploys/mo):
- Incident analysis: ~$2.50/mo
- Risk scoring: ~$2.00/mo
- Auto-remediation: negligible
- **Total: ~$5/mo** for AI cost (infrastructure cost separate)

## Production Readiness Checklist
- [ ] Alert correlation grouping correctly (≥ 90%)
- [ ] Risk scoring calibrated (±1 of actual outcome)
- [ ] Auto-remediation tested for all safe actions
- [ ] Human approval gate for risky remediations
- [ ] MTTR improved ≥ 40% vs manual
- [ ] Post-incident reports actionable
- [ ] Notification channels connected
- [ ] Incident history feeding back into analysis
- [ ] Blast radius check preventing multi-service impact

## Output: Tuning Report
After tuning, compare:
- Alert correlation improvement (noise reduction %)
- Risk score calibration delta
- Auto-remediation success rate
- MTTR reduction
- False positive rate change

## Tuning Playbook
1. **Baseline**: Replay 20 past incidents, record LLM accuracy
2. **Correlation**: Adjust time window based on actual incident patterns
3. **Risk weights**: Compare 30 deploys: predicted vs actual outcome
4. **Remediation**: Start conservative (0.95), lower for proven safe actions
5. **Prompt**: Add logs + deploy timeline + dependency map to analysis
6. **MTTR**: Measure time-to-resolve with vs without AI assistance
7. **Cost**: Confirm AI cost < $5/mo (negligible vs ops time saved)
8. **Re-test**: Same 20 incidents, compare before/after
