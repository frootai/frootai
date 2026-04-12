---
name: tune-anomaly-detection
description: "Tune Anomaly Detection — optimize detection thresholds (σ levels), time windows, suppression rules, seasonal baselines, alert routing, false positive reduction. Use when: tune, optimize detection."
---

# Tune Anomaly Detection

## When to Use
- Optimize detection thresholds to balance precision vs recall
- Configure time windows for different metric types
- Set up suppression rules to reduce alert fatigue
- Implement seasonal baselines for time-dependent metrics
- Reduce false positives without missing real anomalies

## Tuning Dimensions

### Dimension 1: Detection Threshold Optimization

| Threshold | Detection Rate | False Positive Rate | Use Case |
|-----------|---------------|--------------------|---------| 
| 1.5σ | ~95% recall | ~25% FP | Extremely sensitive (security) |
| 2.0σ | ~90% recall | ~15% FP | High sensitivity (SLA metrics) |
| 2.5σ | ~85% recall | ~8% FP | Balanced (general operations) |
| 3.0σ | ~75% recall | ~3% FP | Low noise (cost metrics) |
| 4.0σ | ~60% recall | ~1% FP | Only major anomalies |

**Per-metric threshold tuning**:
| Metric | Recommended σ | Why |
|--------|--------------|-----|
| Error rate | 2.0σ | Sensitive — errors impact users directly |
| CPU usage | 2.5σ | Normal fluctuation is expected |
| Latency p99 | 2.0σ | User experience critical |
| Cost per hour | 3.0σ | Spikes may be legitimate (batch jobs) |
| Request count | 3.0σ | Traffic varies naturally |
| Memory usage | 2.5σ | Gradual leaks need detection |

### Dimension 2: Time Window Optimization

| Window | Detection Latency | False Positives | Best For |
|--------|------------------|----------------|---------|
| 1 minute | Very fast | High (noisy) | Real-time trading, security |
| 5 minutes | Fast | Medium | API error rates, availability |
| 15 minutes | Moderate | Low | Infrastructure metrics |
| 1 hour | Slow | Very low | Cost metrics, batch jobs |
| 1 day | Very slow | Minimal | Trend detection, capacity |

**Rule**: Shorter window = faster detection but noisier. Use 5-min for SLA metrics, 15-min for infra, 1-hour for cost.

### Dimension 3: Suppression Rules

| Rule | Implementation | Reduces |
|------|---------------|---------|
| Dedup window | Suppress duplicate alerts for same metric within 30 min | 50-70% volume |
| Maintenance window | Skip detection during known maintenance | Eliminates planned spikes |
| Auto-scaling filter | Ignore anomalies during scale events | Eliminates scaling noise |
| Dependency cascade | Group correlated alerts into single incident | 60-80% volume |
| Severity escalation | Start Sev 3, escalate if persists 15 min | Reduces Sev 1 noise |

### Dimension 4: Seasonal Baseline

| Pattern | Detection Method | Configuration |
|---------|-----------------|---------------|
| Daily (9-5 traffic) | Time-of-day baseline | Track hourly avg over 7 days |
| Weekly (Mon-Fri) | Day-of-week baseline | Track daily avg over 4 weeks |
| Monthly (billing cycle) | Monthly pattern | Track monthly avg over 3 months |
| Event-driven (sales) | Event calendar | Exclude known event periods |

```kql
// Seasonal baseline KQL
let hourly_baseline = metrics
| where timestamp between(ago(7d)..ago(1d))
| summarize avg_value=avg(value), std_value=stdev(value) 
  by hour_of_day=hourofday(timestamp), metric_name;

metrics
| where timestamp > ago(1h)
| extend hour_of_day = hourofday(timestamp)
| join kind=leftouter hourly_baseline on hour_of_day, metric_name
| extend z_score = abs(value - avg_value) / std_value
| where z_score > 2.5
```

### Dimension 5: Root Cause Analysis Tuning

| Parameter | Default | Optimized | Impact |
|-----------|---------|-----------|--------|
| Context window | 1 hour | 4 hours | More history = better analysis |
| Correlated metrics | Top 3 | Top 5 | More correlated data = better diagnosis |
| Deployment history | None | Last 24h | Deployment correlation = most common cause |
| LLM model | gpt-4o | gpt-4o | Keep full model for reasoning |
| Max tokens | 500 | 800 | Allow longer analysis for complex anomalies |

## Production Readiness Checklist
- [ ] Per-metric thresholds calibrated (not one-size-fits-all)
- [ ] Time windows matched to metric type
- [ ] Suppression rules reducing alert volume by ≥50%
- [ ] Seasonal baselines configured for time-dependent metrics
- [ ] False positive rate < 15%
- [ ] Detection latency < 5 min for critical metrics
- [ ] Root cause analysis providing actionable suggestions
- [ ] Alert routing verified (Sev 0 → PagerDuty, Sev 3 → dashboard)
- [ ] Dashboard showing anomaly timeline with severity

## Output: Tuning Report
After tuning, compare:
- False positive rate reduction
- Detection latency improvement
- Alert volume change (before vs after suppression)
- Per-metric threshold recommendations
- Root cause accuracy improvement
