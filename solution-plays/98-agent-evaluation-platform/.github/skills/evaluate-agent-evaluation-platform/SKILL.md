---
name: "evaluate-agent-evaluation-platform"
description: "Evaluate Agent Evaluation Platform — judge calibration, scoring consistency, test coverage, adversarial completeness, leaderboard accuracy."
---

# Evaluate Agent Evaluation Platform

## Prerequisites

- Deployed eval platform (run `deploy-agent-evaluation-platform` skill first)
- Human-annotated evaluation dataset for calibration
- Python 3.11+ with `azure-ai-evaluation`, `scikit-learn`

## Step 1: Evaluate Judge Calibration

```bash
python evaluation/eval_calibration.py \
  --human-annotations evaluation/data/human_scores/ \
  --output evaluation/results/calibration.json
```

Calibration metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Pearson Correlation** | Judge vs human score correlation | > 0.80 |
| **Cohen's Kappa** | Inter-rater agreement | > 0.70 |
| **Bias** | Systematic over/under scoring | Mean diff < 0.3 |
| **Per-Dimension Accuracy** | Correlation per eval dimension | > 0.75 each |
| **Edge Case Handling** | Correct scoring on ambiguous inputs | > 70% |

## Step 2: Evaluate Scoring Consistency

```bash
python evaluation/eval_consistency.py \
  --test-data evaluation/data/repeat_evals/ \
  --output evaluation/results/consistency.json
```

Consistency metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Reproducibility** | Same agent + same test → same score | Variance < 0.05 |
| **Cross-Judge Agreement** | Multiple judge models agree | > 85% |
| **Dimension Independence** | Dimensions don't have >0.8 correlation | Verified |
| **Score Distribution** | Not all clustered at one value | Std dev > 0.5 |

## Step 3: Evaluate Test Coverage

```bash
python evaluation/eval_coverage.py \
  --test-data evaluation/data/test_suites/ \
  --output evaluation/results/coverage.json
```

Coverage metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Task Type Coverage** | Single + multi-turn + tool + adversarial | All 4 present |
| **Difficulty Distribution** | Easy/medium/hard balanced | 30/40/30 |
| **Domain Coverage** | Test cases span target domains | > 80% domains |
| **Adversarial Coverage** | Injection + jailbreak + PII + social engineering | All 4 present |
| **Edge Case Count** | Unusual inputs tested | ≥ 10 edge cases |

## Step 4: Evaluate Leaderboard Validity

```bash
python evaluation/eval_leaderboard.py \
  --test-data evaluation/data/leaderboard/ \
  --output evaluation/results/leaderboard.json
```

Leaderboard metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Ranking Stability** | Rank doesn't change significantly across test sets | Top-3 stable |
| **Score Differentiation** | Can distinguish quality between agents | Score range > 20 |
| **Baseline Included** | Human or reference agent as comparison | Yes |
| **Version Tracking** | Same agent different versions comparable | Verified |

## Step 5: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Judge calibration scatter plot (human vs LLM scores)
- Score consistency heatmap across re-runs
- Test coverage sunburst chart
- Leaderboard with per-dimension breakdown
- Adversarial test pass/fail summary

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Judge-human correlation | > 0.80 | config/guardrails.json |
| Cohen's Kappa | > 0.70 | config/guardrails.json |
| Score reproducibility | Var < 0.05 | config/guardrails.json |
| All test types covered | 100% | config/guardrails.json |
| Adversarial coverage | All 4 types | Safety requirement |
