---
name: "evaluate-synthetic-data-factory"
description: "Evaluate Synthetic Data Factory quality — distribution fidelity (KS test), privacy (PII leakage, re-identification risk), data diversity, correlation preservation, downstream utility."
---

# Evaluate Synthetic Data Factory

## Prerequisites

- Deployed synthetic data factory (run `deploy-synthetic-data-factory` skill first)
- Reference real dataset for comparison (anonymized or authorized)
- Python 3.11+ with `sdv`, `scipy`, `presidio-analyzer`, `sklearn` packages
- Generated synthetic dataset(s) for evaluation

## Step 1: Prepare Evaluation Datasets

```bash
mkdir -p evaluation/data

# Pair: real reference + synthetic generated
# evaluation/data/eval-001.json
# {
#   "real_data": "evaluation/data/real-reference.csv",
#   "synthetic_data": "evaluation/data/synthetic-output.csv",
#   "schema": {"name": "string", "age": "int", "salary": "float", "dept": "categorical"},
#   "sensitive_columns": ["name", "email", "ssn"],
#   "category": "employee-records"
# }
```

## Step 2: Evaluate Distribution Fidelity

```bash
python evaluation/eval_fidelity.py \
  --real-data evaluation/data/real-reference.csv \
  --synthetic-data evaluation/data/synthetic-output.csv \
  --output evaluation/results/fidelity.json
```

Fidelity metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **KS Statistic (per column)** | Kolmogorov-Smirnov distribution similarity | < 0.1 |
| **KS p-value** | Probability distributions are same | > 0.05 |
| **Mean Absolute Error** | Mean difference across numeric columns | < 5% |
| **Category Distribution Match** | Chi-squared test for categorical columns | p > 0.05 |
| **Correlation Matrix Diff** | Frobenius norm of correlation difference | < 0.15 |
| **SDV Quality Score** | SDV library composite quality metric | > 0.80 |

Distribution fidelity breakdown:
1. **Numeric columns**: KS test, mean/std comparison, range preservation
2. **Categorical columns**: Chi-squared test, category frequency match
3. **Correlation preservation**: Pairwise correlation comparison (Pearson/Spearman)
4. **Joint distributions**: Multi-column relationship verification
5. **Temporal patterns**: Time-series autocorrelation (if applicable)

## Step 3: Evaluate Privacy

```bash
python evaluation/eval_privacy.py \
  --real-data evaluation/data/real-reference.csv \
  --synthetic-data evaluation/data/synthetic-output.csv \
  --output evaluation/results/privacy.json
```

Privacy metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **PII Leakage Rate** | Real PII found in synthetic output | 0% |
| **Re-identification Risk** | Can synthetic records be linked to real people | < 0.1% |
| **Nearest Neighbor Distance** | Min distance from synthetic to real records | > threshold |
| **Membership Inference** | Can attacker tell if real record was in training | AUC < 0.55 |
| **Attribute Inference** | Can attacker infer sensitive attributes | AUC < 0.60 |
| **PII Marker Compliance** | Synthetic markers (SYNTH- prefix) present | 100% |

Privacy evaluation procedures:
1. **PII scan**: Run Presidio on synthetic output → 0 real PII entities
2. **Record linkage**: Attempt to match synthetic→real records via quasi-identifiers
3. **Distance test**: Compute L2 distance between synthetic and nearest real record
4. **Membership inference attack**: Train classifier to distinguish real vs synthetic
5. **Marker verification**: All names start with "SYNTH-", emails use @synth-example.com

## Step 4: Evaluate Data Diversity

```bash
python evaluation/eval_diversity.py \
  --synthetic-data evaluation/data/synthetic-output.csv \
  --output evaluation/results/diversity.json
```

Diversity metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Uniqueness Rate** | Unique records / total records | > 95% |
| **Duplicate Rate** | Exact duplicate records | < 1% |
| **Value Coverage** | Unique values per categorical column vs real | > 80% |
| **Range Coverage** | Numeric range covered vs real data | > 90% |
| **Entropy** | Shannon entropy per column vs real | Within 10% |

## Step 5: Evaluate Downstream Utility

```bash
python evaluation/eval_utility.py \
  --real-data evaluation/data/real-reference.csv \
  --synthetic-data evaluation/data/synthetic-output.csv \
  --task "classification" \
  --target-column "churn" \
  --output evaluation/results/utility.json
```

Downstream utility metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Train-on-Synthetic, Test-on-Real** (TSTR) | Model accuracy when trained on synthetic | > 85% of real-trained |
| **Train-on-Real, Test-on-Synthetic** (TRTS) | Model predicts synthetic well | > 80% of real baseline |
| **F1 Parity** | F1 score ratio synthetic/real trained | > 0.85 |
| **Feature Importance Agreement** | Same top features identified | > 80% overlap |

Downstream utility is the ultimate test: if ML models trained on synthetic data perform comparably to real data, the synthetic data is useful.

## Step 6: Generate Evaluation Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md \
  --thresholds config/guardrails.json
```

Report includes:
- Distribution fidelity: KS test results per column with pass/fail
- Privacy: PII scan, re-identification risk, membership inference
- Diversity: uniqueness, coverage, entropy comparison
- Downstream utility: TSTR accuracy vs real-trained baseline
- Cost breakdown: generation cost per 1000 records by method

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| KS statistic | < 0.1 | config/guardrails.json |
| PII leakage | 0% | config/guardrails.json |
| Re-identification risk | < 0.1% | config/guardrails.json |
| Uniqueness rate | > 95% | config/guardrails.json |
| TSTR accuracy parity | > 85% | config/guardrails.json |
| Groundedness | > 0.85 | fai-manifest.json |
