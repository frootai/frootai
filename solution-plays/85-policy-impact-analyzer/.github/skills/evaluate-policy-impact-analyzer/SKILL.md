---
name: "evaluate-policy-impact-analyzer"
description: "Evaluate Policy Impact Analyzer — provision extraction, stakeholder identification, cost-benefit accuracy, comment analysis, recommendation balance."
---

# Evaluate Policy Impact Analyzer

## Prerequisites

- Deployed policy analyzer (run `deploy-policy-impact-analyzer` skill first)
- Expert-reviewed policy assessments for comparison
- Python 3.11+ with `azure-ai-evaluation`

## Step 1: Evaluate Provision Extraction

```bash
python evaluation/eval_provisions.py \
  --test-data evaluation/data/policies/ \
  --output evaluation/results/provisions.json
```

Provision metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Extraction Recall** | Provisions found vs expert-identified | > 90% |
| **Schema Completeness** | All fields populated (not "N/A") | > 80% |
| **Accuracy** | Extracted info matches policy text | > 95% |
| **No Hallucination** | No invented provisions | 100% |
| **Affected Groups Complete** | All impacted groups identified | > 85% |

## Step 2: Evaluate Stakeholder Impact

```bash
python evaluation/eval_impact.py \
  --test-data evaluation/data/assessments/ \
  --output evaluation/results/impact.json
```

Impact metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Stakeholder Coverage** | Groups identified vs expert list | > 90% |
| **Cost Range Accuracy** | Estimated range contains actual cost | > 75% |
| **Benefit Identification** | Benefits identified per stakeholder | > 80% |
| **Distributional Accuracy** | Correctly identifies who gains/loses | > 85% |
| **Vulnerable Groups** | Low-income/disabled/elderly specifically assessed | 100% |
| **Evidence Sourcing** | Every quantitative claim has source | > 90% |

## Step 3: Evaluate Comment Analysis

```bash
python evaluation/eval_comments.py \
  --test-data evaluation/data/comments/ \
  --output evaluation/results/comments.json
```

Comment metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Campaign Detection** | Form letter campaigns identified | > 85% |
| **Theme Extraction** | Key themes match expert analysis | > 80% |
| **Sentiment Accuracy** | Correct support/oppose/neutral per provision | > 85% |
| **Representation Gap Detection** | Missing stakeholder voices identified | > 75% |
| **Deduplication Accuracy** | Unique comments correctly identified | > 90% |

## Step 4: Evaluate Recommendation Quality

```bash
python evaluation/eval_recommendations.py \
  --test-data evaluation/data/recommendations/ \
  --output evaluation/results/recommendations.json
```

Recommendation metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Balance** (expert judge) | Arguments for AND against presented | > 90% |
| **Evidence-Based** | Claims reference data/sources | > 90% |
| **Non-Partisan** | No partisan framing detected | 100% |
| **Alternatives Presented** | ≥2 alternative approaches with trade-offs | > 85% |
| **Uncertainty Acknowledged** | Gaps and unknowns stated explicitly | > 80% |
| **Groundedness** | Every claim traceable to evidence | > 0.90 |

## Step 5: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Provision extraction completeness by policy type
- Stakeholder impact accuracy by group
- Comment sentiment distribution by provision
- Recommendation balance scorecard
- Evidence sourcing audit trail

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Provision extraction | > 90% | config/guardrails.json |
| Evidence sourcing | > 90% | config/guardrails.json |
| Non-partisan | 100% | Government policy requirement |
| Vulnerable groups assessed | 100% | Equity requirement |
| Groundedness | > 0.90 | fai-manifest.json |
