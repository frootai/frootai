---
name: "evaluate-exam-generation-engine"
description: "Evaluate Exam Generation Engine — question quality, Bloom's alignment, distractor plausibility, answer accuracy, coverage, bias detection."
---

# Evaluate Exam Generation Engine

## Prerequisites

- Deployed exam engine (run `deploy-exam-generation-engine` skill first)
- Test exams with expert-reviewed quality ratings
- Python 3.11+ with `azure-ai-evaluation`, `pyirt`

## Step 1: Evaluate Question Quality

```bash
python evaluation/eval_question_quality.py \
  --test-data evaluation/data/questions/ \
  --output evaluation/results/quality.json
```

Quality metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Groundedness** | Question based on provided material (not LLM training data) | > 0.90 |
| **Clarity** (LLM judge) | Unambiguous, well-worded | > 4.0/5.0 |
| **Answer Accuracy** | Correct answer actually correct (SME verified) | > 95% |
| **Bloom's Alignment** | Matches intended Bloom's level | > 85% |
| **No Duplicate Concepts** | Each question tests unique concept | 100% |
| **Learning Objective Coverage** | All objectives tested at least once | > 90% |

## Step 2: Evaluate Distractor Quality

```bash
python evaluation/eval_distractors.py \
  --test-data evaluation/data/mcq/ \
  --output evaluation/results/distractors.json
```

Distractor metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Plausibility** (LLM judge) | Distractors could fool partial-knowledge student | > 3.5/5.0 |
| **Length Similarity** | Distractor length within ±20% of correct answer | > 90% |
| **No Overlap** | Distractors don't repeat each other | 100% |
| **Misconception-Based** | Distractor maps to known misconception type | > 70% |
| **Selection Distribution** | After test: each distractor chosen by some students | No option < 5% |
| **Correct Answer Position** | Randomized across A/B/C/D | Chi-square p > 0.05 |

## Step 3: Evaluate Bloom's Distribution

```bash
python evaluation/eval_blooms.py \
  --test-data evaluation/data/exams/ \
  --output evaluation/results/blooms.json
```

Bloom's metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Remember** | 10-20% of questions | Within range |
| **Understand** | 20-30% of questions | Within range |
| **Apply** | 25-30% of questions | Within range |
| **Analyze** | 15-20% of questions | Within range |
| **Evaluate** | 5-10% of questions | Within range |
| **Create** | 5-10% of questions | Within range |
| **Level Accuracy** | Classifier agrees with intended level | > 85% |

## Step 4: Evaluate Item Response Theory (IRT)

```bash
python evaluation/eval_irt.py \
  --response-data evaluation/data/student_responses/ \
  --output evaluation/results/irt.json
```

IRT metrics (after first administration):
| Metric | Description | Target |
|--------|-------------|--------|
| **Discrimination (a)** | Differentiates high/low ability students | a > 0.5 |
| **Difficulty (b)** | Appropriate difficulty for target population | -2 < b < 2 |
| **Guessing (c)** | Low guessing rate on MCQs | c < 0.25 |
| **Item-Total Correlation** | Item score correlates with total score | r > 0.3 |
| **Reliability (Cronbach's α)** | Internal consistency of exam | α > 0.80 |
| **Test Information** | Information peak matches target ability | Within range |

## Step 5: Evaluate Fairness & Bias

```bash
python evaluation/eval_bias.py \
  --test-data evaluation/data/questions/ \
  --output evaluation/results/bias.json
```

Fairness metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Cultural Bias** | No culture-specific assumptions | 100% neutral |
| **Gender Bias** | Balanced pronoun/name usage | Within 40-60% split |
| **Differential Item Functioning** | No items favoring demographic groups | DIF < 0.1 |
| **Language Complexity** | Appropriate reading level for target | Within ±1 grade level |
| **Accessible Language** | No unnecessarily complex vocabulary | > 90% |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Question quality scorecard
- Bloom's taxonomy distribution chart
- Distractor plausibility analysis
- IRT item characteristic curves
- Fairness audit summary
- Recommendations for question pool improvement

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Answer accuracy | > 95% | config/guardrails.json |
| Groundedness | > 0.90 | fai-manifest.json |
| Bloom's alignment | > 85% | config/guardrails.json |
| Distractor plausibility | > 3.5/5.0 | config/guardrails.json |
| Cronbach's α | > 0.80 | Psychometric standard |
| Cultural/gender bias | 0 detected | Responsible AI |
