---
name: evaluate-anomaly-detection
description: "Evaluate Anomaly Detection — measure precision, recall, F1 on labeled anomalies, false positive rate, detection latency, root cause accuracy. Use when: evaluate, benchmark detection."
---

# Evaluate Anomaly Detection

## When to Use
- Measure detection accuracy on labeled anomaly datasets
- Calculate false positive and false negative rates
- Evaluate detection latency (time to detect after anomaly starts)
- Test root cause analysis accuracy
- Gate deployment with detection quality thresholds

## Detection Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Precision | ≥ 85% | True anomalies / all alerts |
| Recall | ≥ 90% | Detected anomalies / all real anomalies |
| F1 Score | ≥ 0.87 | Harmonic mean of precision and recall |
| False positive rate | < 15% | False alerts / total alerts |
| Detection latency | < 5 min | Time from anomaly start to alert |
| Root cause accuracy | ≥ 70% | LLM suggestion matches actual cause |
| Alert fatigue score | < 3 alerts/day avg | Alert volume tracking |
| Mean time to resolution | Decreased vs baseline | Before/after comparison |

## Step 1: Prepare Labeled Dataset
```json
{"timestamp": "2026-04-01T10:00:00Z", "metric": "cpu_percent", "value": 95, "is_anomaly": true, "root_cause": "deployment_spike"}
{"timestamp": "2026-04-01T10:05:00Z", "metric": "cpu_percent", "value": 92, "is_anomaly": true, "root_cause": "deployment_spike"}
{"timestamp": "2026-04-01T10:10:00Z", "metric": "cpu_percent", "value": 45, "is_anomaly": false, "root_cause": null}
{"timestamp": "2026-04-01T10:15:00Z", "metric": "error_rate", "value": 0.15, "is_anomaly": true, "root_cause": "upstream_dependency"}
```
Minimum: 200 labeled data points across normal + anomalous periods.

## Step 2: Run Detection Accuracy Evaluation
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics detection_accuracy
```
- Calculate per-metric precision and recall
- Confusion matrix: true/false positive/negative counts
- Severity-weighted metrics (missing Sev 0 worse than missing Sev 3)

## Step 3: Evaluate Detection Latency
- Inject synthetic anomalies into metrics stream
- Measure time from injection to alert fire
- Breakdown: data ingestion + detection processing + alert routing
- Target: total < 5 minutes for Sev 0/1

## Step 4: Evaluate Root Cause Analysis
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics root_cause
```
- Compare LLM root cause suggestion to actual known cause
- Score: Exact match, Partial match, Wrong
- Track which anomaly types get good vs poor root cause analysis
- Verify LLM includes correlated metrics in analysis

## Step 5: Alert Fatigue Assessment
- Count alerts per day over 7-day period
- If > 5 alerts/day avg: threshold too sensitive
- Group by severity: are most alerts low-sev? (indicates noise)
- Track alert acknowledgment time: increasing = fatigue

## Step 6: Generate Report
```bash
python evaluation/eval.py --all --output evaluation/detection-report.json --ci-gate
```

### Detection Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Deploy detection pipeline to production |
| Recall < 80% | Lower detection threshold, add more detection methods |
| False positive > 25% | Raise threshold, add suppression rules |
| Detection latency > 10 min | Reduce time window, optimize pipeline |
| Root cause < 50% accurate | Enrich context in LLM prompt |

## Common Issues

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Missing real anomalies | Threshold too high (>3σ) | Lower to 2σ, add multiple detection methods |
| Alert storm | Auto-scaling triggers false alerts | Exclude scaling events, add cooldown window |
| Seasonal false positives | Not accounting for time-of-day | Use seasonal decomposition baseline |
| Multivariate anomaly missed | Only checking individual metrics | Enable multivariate detection |
| Root cause always generic | Insufficient context in prompt | Add deployment history, dependency map |

## Evaluation Cadence
- **Pre-deployment**: Full precision/recall evaluation on labeled data
- **Weekly**: False positive rate review, alert fatigue check
- **Monthly**: Re-evaluate with new labeled anomalies
- **On detection model update**: Full re-evaluation vs previous version
- **After major incident**: Add incident to labeled dataset, re-evaluate

## CI/CD Integration
```yaml
# Add detection quality gates to pipeline
- name: Detection Precision Gate
  run: python evaluation/eval.py --metrics detection_accuracy --ci-gate --min-precision 0.85
- name: False Positive Gate
  run: python evaluation/eval.py --metrics detection_accuracy --ci-gate --max-fp-rate 0.15
- name: Root Cause Accuracy Gate
  run: python evaluation/eval.py --metrics root_cause --ci-gate --min-accuracy 0.70
```
