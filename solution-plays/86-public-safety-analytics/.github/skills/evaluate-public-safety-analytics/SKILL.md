---
name: "evaluate-public-safety-analytics"
description: "Evaluate Public Safety Analytics — pattern detection accuracy, resource optimization impact, bias audit, response time improvement, community transparency."
---

# Evaluate Public Safety Analytics

## Prerequisites

- Deployed analytics system (run `deploy-public-safety-analytics` skill first)
- Baseline response time and resource data (pre-optimization)
- Python 3.11+ with `azure-ai-evaluation`, `scikit-learn`

## Step 1: Evaluate Pattern Detection

```bash
python evaluation/eval_patterns.py \
  --test-data evaluation/data/incidents/ \
  --output evaluation/results/patterns.json
```

Pattern metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Peak Hour Accuracy** | Correctly identifies high-demand hours | > 85% |
| **Seasonal Detection** | Catches seasonal trends (summer/winter) | > 80% |
| **Trend Direction** | Increasing/decreasing/stable correct | > 85% |
| **No Geographic Targeting** | Analysis uses temporal, not location-based targeting | 100% |
| **Source Distinction** | Community-reported vs patrol-generated separated | 100% |

## Step 2: Evaluate Resource Optimization

```bash
python evaluation/eval_resources.py \
  --baseline evaluation/data/baseline_resources/ \
  --optimized evaluation/data/optimized_resources/ \
  --output evaluation/results/resources.json
```

Resource metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Response Time Improvement** | Avg response time reduction vs baseline | > 15% |
| **Priority 1 Response** | Life-threatening incidents < 8 min | > 90% |
| **Coverage Consistency** | No shifts with below-minimum coverage | 100% |
| **Budget Compliance** | Within allocated budget | 100% |
| **Shift Compliance** | All shifts ≤ 12 hours, ≥ 10 rest | 100% |

## Step 3: Evaluate Bias Audit

```bash
python evaluation/eval_bias.py \
  --test-data evaluation/data/demographics/ \
  --output evaluation/results/bias.json
```

Bias metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Resource Parity** | Resource allocation proportional across demographics | Disparity < 10% |
| **Response Time Parity** | No demographic group has slower avg response | Disparity < 2 min |
| **Data Source Bias** | Patrol-generated vs community-reported ratio flagged | Audited |
| **No Predictive Policing** | System does not predict crime locations | 100% verified |
| **Anonymization Verified** | No re-identification possible from published data | 100% |

## Step 4: Evaluate Transparency & Community Impact

```bash
python evaluation/eval_transparency.py \
  --test-data evaluation/data/dashboard/ \
  --output evaluation/results/transparency.json
```

Transparency metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Methodology Published** | Analysis methodology publicly available | 100% |
| **Dashboard Accessibility** | WCAG 2.2 AA compliant public dashboard | 100% |
| **Community Input Integration** | 311 + survey data incorporated | > 80% |
| **Report Groundedness** | Claims reference actual anonymized data | > 0.90 |
| **No PII Exposure** | Public dashboard contains zero PII | 100% |

## Step 5: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Temporal pattern accuracy validation
- Response time before/after comparison
- Bias audit dashboard with demographic parity metrics
- Community transparency compliance checklist
- Anonymization verification log

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Response time improvement | > 15% | config/guardrails.json |
| No predictive policing | 100% | Responsible AI policy |
| Resource parity | Disparity < 10% | Equity requirement |
| Anonymization | 100% | Privacy policy |
| Groundedness | > 0.90 | fai-manifest.json |
