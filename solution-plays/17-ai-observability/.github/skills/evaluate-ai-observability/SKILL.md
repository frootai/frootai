---
name: evaluate-ai-observability
description: "Evaluate AI Observability — audit telemetry completeness, alert coverage, PII in logs, dashboard accuracy, data retention compliance. Use when: evaluate, audit monitoring."
---

# Evaluate AI Observability

## When to Use
- Audit telemetry coverage (are all AI pipeline stages instrumented?)
- Verify alert rules cover critical failure scenarios
- Check for PII leakage in logs and traces
- Validate dashboard accuracy against actual metrics
- Assess data retention compliance

## Observability Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Telemetry coverage | 100% of pipeline stages | Trace completeness check |
| Alert coverage | All critical scenarios | Alert rule inventory vs failure modes |
| PII in logs | 0 instances | Automated PII scan on log samples |
| Dashboard latency | < 30s refresh | Dashboard load timing |
| Data retention | Compliant with policy | Retention config vs requirement |
| False alert rate | < 5% | Alerts fired vs actual incidents |
| Mean time to detect (MTTD) | < 5 minutes | Incident detection timing |
| Metric cardinality | < 10K unique series | Metrics Explorer check |

## Step 1: Audit Telemetry Coverage
```kql
// Check which pipeline stages have traces (last 24h)
traces
| where timestamp > ago(24h)
| distinct operation_Name
| sort by operation_Name
```
Expected stages: retrieval, generation, safety-check, response, caching.
Missing stage = blind spot in observability.

## Step 2: Audit Alert Coverage
| Failure Mode | Alert Exists? | Threshold | Action |
|-------------|--------------|-----------|--------|
| Service down | ✅ / ❌ | Availability < 99% | PagerDuty |
| High latency | ✅ / ❌ | p95 > 5s | Teams |
| Error spike | ✅ / ❌ | >5% error rate | PagerDuty |
| Cost overrun | ✅ / ❌ | Daily >2× baseline | Email |
| Quality drop | ✅ / ❌ | Groundedness <0.7 | PagerDuty |
| Security block spike | ✅ / ❌ | >10% blocked | Teams |

Every ❌ is a gap — create the alert.

## Step 3: PII Scan
```kql
// Search for potential PII in traces (last 7 days)
traces
| where timestamp > ago(7d)
| where message matches regex @"\b\d{3}-\d{2}-\d{4}\b"  // SSN pattern
    or message matches regex @"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b"  // Email
    or message matches regex @"\b\d{16}\b"  // Credit card
| project timestamp, operation_Name, message
| take 100
```
- **Zero PII allowed** in production logs
- If found: add telemetry processor to scrub before export
- Check both structured and unstructured log fields

## Step 4: Dashboard Accuracy
- Compare dashboard numbers to raw KQL queries
- Verify aggregation logic (sum vs avg vs percentile)
- Check time range alignment (UTC vs local)
- Test dashboard with no data (shows "no data" not errors)

## Step 5: Data Retention Compliance
| Data Type | Requirement | Configured | Compliant? |
|----------|------------|-----------|-----------|
| Application logs | 90 days | Check LA workspace | ✅ / ❌ |
| Custom metrics | 90 days | Check retention setting | ✅ / ❌ |
| Distributed traces | 90 days | Check sampling settings | ✅ / ❌ |
| Security logs | 1 year | Check archive policy | ✅ / ❌ |
| PII-containing data | 30 days max | Check scrubbing + TTL | ✅ / ❌ |

## Step 6: Generate Report
```bash
python evaluation/eval.py --all --output evaluation/observability-report.json
```

### Observability Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Observability stack production-ready |
| Missing stages in traces | Instrument missing pipeline components |
| Alert gaps found | Create missing alert rules |
| PII detected | Add telemetry processor, re-scan |
| Retention non-compliant | Adjust workspace retention settings |

## Common Issues

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Traces missing spans | Context not propagated | Pass trace context headers |
| Metrics cardinality explosion | High-cardinality dimension | Remove user_id from custom dimensions |
| Dashboard shows wrong numbers | Aggregation mismatch | Verify KQL aggregation logic |
| Alerts too noisy | Threshold too sensitive | Increase threshold, add over-time condition |
| Log Analytics expensive | Verbose logging | Set min log level to Warning |

## Evaluation Cadence
- **Pre-deployment**: Full observability audit checklist
- **Weekly**: Review alert fire rate, false positive ratio
- **Monthly**: PII scan, retention compliance check
- **Quarterly**: Full telemetry coverage audit
- **On pipeline change**: Verify new stages are instrumented
