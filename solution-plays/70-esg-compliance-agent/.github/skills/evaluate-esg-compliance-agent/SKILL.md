---
name: "evaluate-esg-compliance-agent"
description: "Evaluate ESG Compliance Agent quality — scoring accuracy, evidence matching, gap identification, greenwashing detection, framework coverage, double materiality."
---

# Evaluate ESG Compliance Agent

## Prerequisites

- Deployed ESG agent (run `deploy-esg-compliance-agent` skill first)
- Test companies with known ESG scores (verified by auditors)
- Python 3.11+ with `azure-ai-evaluation` package

## Step 1: Evaluate Scoring Accuracy

```bash
python evaluation/eval_scoring.py \
  --test-data evaluation/data/companies/ \
  --endpoint $ESG_ENDPOINT \
  --output evaluation/results/scoring.json
```

Scoring metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Overall Score Accuracy** | Matches auditor assessment | Within ±10 points |
| **Pillar Accuracy** | E/S/G individual pillar scores | Within ±15 points |
| **Gap Detection** | Known gaps correctly identified | > 85% |
| **Mandatory Requirement Coverage** | CSRD mandatory items assessed | 100% |
| **Framework Consistency** | Same data → consistent scores across frameworks | Variance < 5 |

Scoring by framework:
| Framework | Requirement Count | Accuracy Target |
|-----------|------------------|-----------------|
| CSRD | ~12 mandatory + optional | Within ±10 |
| GRI | 10 standards | Within ±12 |
| SASB | Industry-specific | Within ±15 |
| TCFD | 4 pillar areas | Within ±10 |

## Step 2: Evaluate Evidence Matching

```bash
python evaluation/eval_evidence.py \
  --test-data evaluation/data/evidence/ \
  --output evaluation/results/evidence.json
```

Evidence metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Match Precision** | Linked evidence actually supports requirement | > 85% |
| **Match Recall** | Available evidence found and linked | > 80% |
| **Confidence Calibration** | High confidence = actually supported | Correlation > 0.7 |
| **No Hallucinated Evidence** | Every evidence link exists | 100% |
| **Source Attribution** | Document source tracked | 100% |

## Step 3: Evaluate Greenwashing Detection

```bash
python evaluation/eval_greenwashing.py \
  --test-data evaluation/data/reports/ \
  --output evaluation/results/greenwashing.json
```

Greenwashing metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Detection Rate** | Known greenwashing cases caught | > 80% |
| **False Positive Rate** | Legitimate claims flagged | < 15% |
| **Indicator Coverage** | All 5 indicator types tested | 100% |
| **Actionability** (LLM judge) | Feedback is specific, correctable | > 4.0/5.0 |

## Step 4: Evaluate Double Materiality

```bash
python evaluation/eval_materiality.py \
  --test-data evaluation/data/materiality/ \
  --output evaluation/results/materiality.json
```

Materiality metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Impact Materiality** | Company→World effects identified | > 85% |
| **Financial Materiality** | World→Company risks identified | > 80% |
| **Topic Coverage** | All relevant ESG topics assessed | > 90% |
| **Stakeholder Alignment** | Matches stakeholder input | > 75% |

## Step 5: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Per-framework scoring breakdown
- Evidence linked vs unlinked heatmap
- Greenwashing indicator analysis
- Materiality matrix (impact vs financial)
- Gap remediation priority list

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Overall score accuracy | Within ±10 | config/guardrails.json |
| Evidence match precision | > 85% | config/guardrails.json |
| Greenwashing detection | > 80% | config/guardrails.json |
| Mandatory coverage | 100% | config/guardrails.json |
| No hallucinated evidence | 100% | config/guardrails.json |
| Groundedness | > 0.85 | fai-manifest.json |
