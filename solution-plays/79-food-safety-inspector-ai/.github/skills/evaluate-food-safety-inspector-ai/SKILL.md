---
name: "evaluate-food-safety-inspector-ai"
description: "Evaluate Food Safety Inspector AI — violation detection accuracy, pattern identification, traceability completeness, recall readiness, regulatory compliance."
---

# Evaluate Food Safety Inspector AI

## Prerequisites

- Deployed food safety system (run `deploy-food-safety-inspector-ai` skill first)
- Historical inspection data with known violations
- Python 3.11+ with `azure-ai-evaluation`

## Step 1: Evaluate Violation Detection

```bash
python evaluation/eval_detection.py \
  --test-data evaluation/data/inspections/ \
  --output evaluation/results/detection.json
```

Detection metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **CCP Violation Detection** | Known violations caught by sensors | > 99% |
| **False Positive Rate** | Normal readings flagged as violations | < 5% |
| **Alert Latency** | Time from violation to alert | < 60 seconds |
| **Critical Limit Accuracy** | Correct limits applied per CCP | 100% |
| **Door-Open Debounce** | Transient spikes not flagged | > 90% filtered |

## Step 2: Evaluate Pattern Detection

```bash
python evaluation/eval_patterns.py \
  --test-data evaluation/data/patterns/ \
  --output evaluation/results/patterns.json
```

Pattern metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Recurring CCP Detection** | Known repeat violators identified | > 85% |
| **Trend Detection** | Trending-toward-limit caught before violation | > 80% |
| **Time Pattern Detection** | Shift-related patterns identified | > 75% |
| **Seasonal Detection** | Summer cooling issues anticipated | > 70% |
| **Actionable Recommendations** | Pattern explanation + corrective action | > 85% |
| **False Pattern Rate** | Random fluctuation flagged as pattern | < 15% |

## Step 3: Evaluate Traceability

```bash
python evaluation/eval_traceability.py \
  --test-data evaluation/data/lots/ \
  --output evaluation/results/traceability.json
```

Traceability metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Forward Trace Completeness** | Lot → all downstream products found | > 95% |
| **Backward Trace Completeness** | Product → source lot → supplier | > 95% |
| **One-Up-One-Back** | FSMA 204 immediate trace | 100% |
| **Trace Execution Time** | Time to complete a full trace | < 30 minutes |
| **Lot Data Completeness** | All required fields populated | > 98% |

## Step 4: Evaluate Recall Readiness

```bash
python evaluation/eval_recall.py \
  --test-data evaluation/data/recall_drills/ \
  --output evaluation/results/recall.json
```

Recall metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Recall Scope Accuracy** | Affected products correctly identified | > 95% |
| **Customer Notification Speed** | Time to generate notification list | < 1 hour |
| **Regulatory Report Generation** | FDA Form auto-generated | 100% |
| **No Over-Recall** | Only affected lots included (not entire product line) | > 90% |
| **Drill Completion Time** | Full recall simulation end-to-end | < 4 hours |

## Step 5: Evaluate Regulatory Compliance

```bash
python evaluation/eval_compliance.py \
  --test-data evaluation/data/regulatory/ \
  --output evaluation/results/compliance.json
```

Compliance metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **HACCP Plan Coverage** | All CCPs monitored with correct limits | 100% |
| **Record Retention** | Records kept for required duration | 100% (1+ year) |
| **Corrective Action Logged** | Every violation has corrective action | 100% |
| **Temperature Log Integrity** | No gaps in continuous monitoring | > 99% |
| **FDA/EFSA Report Format** | Auto-generated reports pass format check | 100% |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Violation detection accuracy per CCP
- Pattern detection precision/recall curves
- Traceability chain completeness heatmap
- Recall drill timeline analysis
- Regulatory compliance checklist scorecard

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| CCP violation detection | > 99% | FDA HACCP requirement |
| Alert latency | < 60 seconds | config/guardrails.json |
| Forward/backward trace | > 95% | FSMA 204 |
| HACCP plan coverage | 100% | Regulatory requirement |
| Corrective action logged | 100% | FDA 21 CFR 120 |
