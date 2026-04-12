---
name: tune-ai-observability
description: "Tune AI Observability — optimize sampling rates, alert thresholds, log retention tiers, KQL query performance, Log Analytics cost. Use when: tune, optimize monitoring cost."
---

# Tune AI Observability

## When to Use
- Optimize sampling rates to reduce cost without losing visibility
- Tune alert thresholds to reduce noise (false positives)
- Configure retention tiers for cost-effective data storage
- Optimize KQL dashboard query performance
- Reduce Log Analytics monthly spend

## Tuning Dimensions

### Dimension 1: Sampling Rate Optimization

| Telemetry Type | Default | High-Volume | Low-Volume | Impact |
|---------------|---------|-------------|-----------|--------|
| Requests | 100% | 10-25% | 100% | Lower cost, may miss rare errors |
| Dependencies | 100% | 25-50% | 100% | Track external call patterns |
| Traces (verbose) | 100% | 5-10% | 100% | Biggest cost driver |
| Custom metrics | 100% | 100% (keep all) | 100% | Aggregated, low cost |
| Exceptions | 100% | 100% (keep all) | 100% | Never sample errors |

**Rule**: Never sample exceptions or custom metrics. Sample verbose traces aggressively in high-volume production.

```python
# Adaptive sampling configuration
from azure.monitor.opentelemetry import configure_azure_monitor
configure_azure_monitor(
    sampling_ratio=0.25,  # Sample 25% of requests
    # Exceptions always captured at 100%
)
```

### Dimension 2: Alert Threshold Tuning

| Alert | Default Threshold | If Too Noisy | If Missing Events |
|-------|------------------|-------------|------------------|
| High latency | p95 > 5s for 5 min | Increase to 10s or 15 min window | Lower to 3s |
| Error rate | >5% for 10 min | Increase to 10% or 30 min | Lower to 2% |
| Cost spike | >2× baseline daily | Use weekly baseline instead | Use 1.5× |
| Quality drop | Groundedness <0.7 for 1h | Lower to 0.6 or extend window | Raise to 0.75 |
| Availability | <99% for 5 min | Check if maintenace windows excluded | <99.5% |

**Methodology**:
1. Run for 7 days with default thresholds
2. Count false positives per alert rule
3. If false positive rate >10%: widen threshold or time window
4. If MTTD >10 min: tighten threshold

### Dimension 3: Log Retention Tiers

| Tier | Retention | Cost | Use For |
|------|-----------|------|---------|
| Analytics (hot) | 30-90 days | $2.76/GB | Active querying, dashboards |
| Archive | 1-7 years | $0.02/GB | Compliance, rare investigations |
| Basic | 8 days | $0.55/GB | High-volume, low-value logs |
| Delete | Immediate | — | Never-needed telemetry |

**Optimization**: Move verbose traces to Basic tier after 30 days. Archive security logs for 1 year. Delete debug logs immediately in production.

### Dimension 4: KQL Query Optimization

| Pattern | Slow | Fast | Why |
|---------|------|------|-----|
| Time range | `where timestamp > ago(30d)` | `where timestamp > ago(1d)` | 30x less data scanned |
| Columns | `| project *` | `| project timestamp, name, value` | Less memory |
| Aggregation | `summarize by many_columns` | `summarize by 2-3 columns` | Lower cardinality |
| Join | `join kind=inner` on large tables | Materialize + join | Pre-aggregate |
| Filter order | Filter after join | Filter before join | Less data in join |

```kql
// SLOW: scans all data, projects everything
traces | where timestamp > ago(30d) | project *

// FAST: narrow time, specific columns, filter first
traces 
| where timestamp > ago(1d)
| where operation_Name == "generation"
| project timestamp, duration, customDimensions.model
| summarize avg(duration) by bin(timestamp, 1h)
```

### Dimension 5: Cost Optimization

**Monthly cost estimate** (10M events/day):

| Component | Default | Optimized | Savings |
|-----------|---------|-----------|---------|
| Log Analytics ingestion | $830/mo (10GB/day) | $415/mo (25% sampling) | 50% |
| Retention (90 days) | $250/mo | $100/mo (30d hot + archive) | 60% |
| Alert rules | $10/mo (10 rules) | $10/mo | — |
| Dashboard queries | ~$0 | ~$0 | — |
| **Total** | **$1,090/mo** | **$525/mo** | **52%** |

**Top 3 cost levers**:
1. **Sampling** on verbose traces (biggest single reducer)
2. **Retention tiers** (archive old data at 1/100th the cost)
3. **Log level** in production (Warning not Debug)

## Production Readiness Checklist
- [ ] Sampling configured (100% errors, 25% traces)
- [ ] Alert thresholds calibrated (< 10% false positive rate)
- [ ] Retention tiers set (hot 30d, archive 1y for compliance)
- [ ] KQL dashboards optimized (< 30s load time)
- [ ] Cost within budget (track daily ingestion volume)
- [ ] PII scrubbing verified post-sampling
- [ ] No debug-level logging in production
- [ ] Action groups tested (email, Teams, PagerDuty actually deliver)

## Output: Tuning Report
After tuning, compare:
- Monthly Log Analytics cost reduction
- False positive alert rate improvement
- Dashboard query performance improvement
- Sampling impact on error detection (verify no missed incidents)
- Retention tier cost savings projection
