---
name: "evaluate-ai-data-marketplace"
description: "Evaluate AI Data Marketplace — quality scoring accuracy, privacy compliance, synthetic data fidelity, search relevance, license enforcement."
---

# Evaluate AI Data Marketplace

## Prerequisites

- Deployed data marketplace (run `deploy-ai-data-marketplace` skill first)
- Test datasets with known quality characteristics
- Python 3.11+ with `azure-ai-evaluation`, `sdv`

## Step 1: Evaluate Quality Scoring

```bash
python evaluation/eval_quality.py \
  --test-data evaluation/data/datasets/ \
  --output evaluation/results/quality.json
```

Quality metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Score Accuracy** | Quality score matches expert assessment | Within ±10 |
| **Dimension Accuracy** | Each of 5 dimensions matches manual check | > 85% |
| **Grade Consistency** | Same dataset → same grade across reruns | 100% |
| **Bad Data Detection** | Low-quality datasets correctly flagged | > 95% |
| **Freshness Accuracy** | Timeliness score reflects actual age | 100% |

## Step 2: Evaluate Privacy Compliance

```bash
python evaluation/eval_privacy.py \
  --test-data evaluation/data/privacy/ \
  --output evaluation/results/privacy.json
```

Privacy metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **PII Detection Rate** | Known PII fields detected | > 99% |
| **PII False Positive** | Non-PII flagged as PII | < 5% |
| **Anonymization Verified** | k-anonymity k≥5 maintained | 100% |
| **Re-identification Risk** | Risk score below threshold | < 0.5% |
| **Synthetic No Overlap** | Zero real records in synthetic | 100% |

## Step 3: Evaluate Synthetic Data Quality

```bash
python evaluation/eval_synthetic.py \
  --test-data evaluation/data/synthetic/ \
  --output evaluation/results/synthetic.json
```

Synthetic metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Statistical Fidelity** | Distributions match original | > 90% |
| **Correlation Preservation** | Column correlations maintained | > 85% |
| **ML Utility** | Model trained on synthetic performs similarly | Within 5% of original |
| **Privacy Guarantee** | Zero real records leaked | 100% |
| **Outlier Realism** | Synthetic outliers are plausible | > 80% |

## Step 4: Evaluate Search & Discovery

```bash
python evaluation/eval_search.py \
  --test-data evaluation/data/search_queries/ \
  --output evaluation/results/search.json
```

Search metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Precision@10** | Relevant datasets in top 10 | > 80% |
| **MRR** | Mean Reciprocal Rank | > 0.65 |
| **Schema Search** | Finds datasets by column name/type | > 85% |
| **Filter Accuracy** | Quality/privacy/license filters work correctly | 100% |

## Step 5: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Quality score distribution across catalog
- PII detection precision-recall curve
- Synthetic data fidelity metrics vs original
- Search relevance by query category
- License compliance audit trail

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| PII detection | > 99% | Privacy regulation |
| Synthetic no overlap | 100% | config/guardrails.json |
| Quality score accuracy | Within ±10 | config/guardrails.json |
| k-anonymity | k ≥ 5 | config/guardrails.json |
| Search Precision@10 | > 80% | config/guardrails.json |
