---
name: "evaluate-responsible-ai-dashboard"
description: "Evaluate Responsible AI Dashboard quality — fairness metric coverage, incident tracking completeness, compliance evidence gaps, executive summary quality, alert reliability."
---

# Evaluate Responsible AI Dashboard

## Prerequisites

- Deployed RAI dashboard (run `deploy-responsible-ai-dashboard` skill first)
- Test AI systems registered with sample metrics
- Python 3.11+ with `fairlearn`, `azure-ai-evaluation` packages

## Step 1: Evaluate Fairness Coverage

```bash
python evaluation/eval_fairness_coverage.py \
  --dashboard-endpoint $DASHBOARD_ENDPOINT \
  --output evaluation/results/fairness.json
```

Fairness coverage metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Systems Monitored** | % of production AI systems tracked | 100% |
| **Metric Completeness** | All 4 fairness metrics computed per system | 100% |
| **Intersectional Coverage** | Multi-attribute combinations tested | > 80% |
| **Refresh Cadence** | Metrics updated weekly or better | 100% compliance |
| **Threshold Enforcement** | Alert fired on fairness violation | 100% |
| **Historical Trend** | 6+ months of historical data | 100% of active systems |

Fairness metric requirements per system:
| System Risk Level | Required Metrics | Cadence |
|------------------|-----------------|--------|
| High (EU AI Act) | All 4 + intersectional | Weekly |
| Medium | Demographic parity + disparate impact | Bi-weekly |
| Low | Demographic parity | Monthly |

## Step 2: Evaluate Incident Tracking

```bash
python evaluation/eval_incidents.py \
  --dashboard-endpoint $DASHBOARD_ENDPOINT \
  --output evaluation/results/incidents.json
```

Incident tracking metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Incident Capture Rate** | All safety events logged | 100% |
| **Severity Classification** | Correct critical/high/medium/low | > 90% |
| **Root Cause Documented** | Root cause provided for resolved | > 80% |
| **Resolution Time (critical)** | Time from open to resolved | < 24 hours |
| **Alert Delivery** | Critical alerts reach responsible parties | 100% |
| **Trend Analysis** | Incident patterns identified | Quarterly |

## Step 3: Evaluate Compliance Evidence

```bash
python evaluation/eval_compliance.py \
  --dashboard-endpoint $DASHBOARD_ENDPOINT \
  --output evaluation/results/compliance.json
```

Compliance evidence metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Evidence Completeness** | All required docs present per framework | > 90% |
| **Model Card Coverage** | Systems with complete model cards | 100% |
| **Audit Trail** | Actions logged with timestamps | 100% |
| **Framework Coverage** | EU AI Act, EEOC, NIST RMF tracked | As applicable |
| **Gap Resolution Time** | Time from gap detection to closure | < 30 days |

## Step 4: Evaluate Executive Summary

```bash
python evaluation/eval_summary.py \
  --dashboard-endpoint $DASHBOARD_ENDPOINT \
  --judge-model gpt-4o \
  --output evaluation/results/summary.json
```

Summary quality metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Readability** | Non-technical stakeholders understand | > 4.0/5.0 |
| **Accuracy** | Summary matches underlying data | > 95% |
| **Actionability** | Clear next steps listed | > 85% |
| **Traffic-light Correctness** | Red/yellow/green matches status | 100% |
| **Brevity** | 1 page or less | 100% |

## Step 5: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md \
  --thresholds config/guardrails.json
```

Report includes:
- Fairness coverage heatmap across all systems
- Incident severity distribution and trends
- Compliance evidence scorecard per framework
- Executive summary quality assessment
- Recommendations for uncovered systems

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Systems monitored | 100% | config/guardrails.json |
| Fairness metrics complete | 100% | config/guardrails.json |
| Incident capture | 100% | config/guardrails.json |
| Model card coverage | 100% | config/guardrails.json |
| Compliance evidence | > 90% | config/guardrails.json |
| Groundedness | > 0.85 | fai-manifest.json |
