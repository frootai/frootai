---
name: "evaluate-legal-document-ai"
description: "Evaluate Legal Document AI quality — clause extraction accuracy, risk score calibration, redline quality, UPL compliance, privilege marker presence, jurisdiction handling."
---

# Evaluate Legal Document AI

## Prerequisites

- Deployed legal AI pipeline (run `deploy-legal-document-ai` skill first)
- Test contract dataset with labeled clauses and risk levels
- Python 3.11+ with `azure-ai-evaluation` package
- Sample contracts annotated by attorneys (ground truth)

## Step 1: Prepare Evaluation Dataset

```bash
mkdir -p evaluation/data
# Each test: contract PDF + attorney annotations
# evaluation/data/contract-001.json
# {
#   "document": "contracts/sample-nda.pdf",
#   "type": "NDA",
#   "expected_clauses": ["confidentiality", "term", "exceptions", "remedies"],
#   "expected_risks": {"confidentiality": 0.3, "term": 0.2, "exceptions": 0.7},
#   "jurisdiction": "Delaware"
# }
```

Test categories:
- **NDAs**: 10 contracts (simple, mutual, one-way)
- **MSAs**: 5 contracts (enterprise, standard)
- **SLAs**: 5 contracts (cloud, managed services)
- **Employment**: 5 contracts (offer letters, contractor agreements)
- **Edge cases**: Non-English, handwritten amendments, multi-party (5)

## Step 2: Evaluate Clause Extraction

```bash
python evaluation/eval_clauses.py \
  --test-data evaluation/data/ \
  --pipeline-endpoint $PIPELINE_ENDPOINT \
  --output evaluation/results/clauses.json
```

Clause extraction metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Clause Detection Rate** | Expected clauses found | > 90% |
| **Clause Classification** | Correct clause type assigned | > 85% |
| **Clause Boundary Accuracy** | Correct text span identified | > 80% |
| **Missing Clause Detection** | Missing required clauses flagged | > 95% |
| **False Positives** | Non-clause text identified as clause | < 5% |

## Step 3: Evaluate Risk Scoring

```bash
python evaluation/eval_risk.py \
  --test-data evaluation/data/ \
  --output evaluation/results/risk.json
```

Risk scoring metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Score Calibration** | Risk scores match attorney assessment | > 80% within ±0.15 |
| **Severity Ranking** | Correct relative ordering of risks | > 85% |
| **Critical Detection** | Critical risks (>0.8) correctly identified | > 95% |
| **Benchmark Alignment** | Scores use industry-specific standards | > 90% |
| **Explanation Quality** (LLM judge) | Risk explanation is actionable | > 4.0/5.0 |

## Step 4: Evaluate UPL Compliance

```bash
python evaluation/eval_upl.py \
  --test-data evaluation/data/ \
  --output evaluation/results/upl.json
```

UPL compliance metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Disclaimer Present** | Every output has UPL disclaimer | 100% |
| **Privilege Marker** | "Attorney Work Product" on all docs | 100% |
| **No Legal Advice Language** | No "we advise", "you must" phrases | 0 violations |
| **Suggestion Language** | Uses "for review", "suggestion" framing | > 95% |
| **Human Review Requirement** | Explicitly recommends attorney review | 100% |

## Step 5: Evaluate Redline Quality

```bash
python evaluation/eval_redlines.py \
  --test-data evaluation/data/ \
  --judge-model gpt-4o \
  --output evaluation/results/redlines.json
```

Redline metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Relevance** | Redline addresses identified risk | > 85% |
| **Balanced** | Not excessively one-sided | > 4.0/5.0 |
| **Legally Sound** (LLM judge) | Suggestion makes legal sense | > 3.5/5.0 |
| **Implementable** | Can be directly inserted into contract | > 80% |
| **Coverage** | All high-risk clauses have redline suggestions | > 90% |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Clause detection | > 90% | config/guardrails.json |
| Risk calibration | > 80% | config/guardrails.json |
| UPL compliance | 100% | config/guardrails.json (non-negotiable) |
| Privilege markers | 100% | config/guardrails.json (non-negotiable) |
| Redline relevance | > 85% | config/guardrails.json |
| Groundedness | > 0.85 | fai-manifest.json |
