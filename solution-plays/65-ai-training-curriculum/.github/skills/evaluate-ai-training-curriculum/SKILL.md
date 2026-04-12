---
name: "evaluate-ai-training-curriculum"
description: "Evaluate AI Training Curriculum quality — path completion rate, assessment validity, skill gain measurement, content quality, learner satisfaction."
---

# Evaluate AI Training Curriculum

## Prerequisites

- Deployed training curriculum (run `deploy-ai-training-curriculum` skill first)
- Test learner profiles with known skill levels
- Python 3.11+ with `azure-ai-evaluation` package

## Step 1: Evaluate Path Generation

```bash
python evaluation/eval_paths.py \
  --test-data evaluation/data/learners/ \
  --endpoint $TRAINING_ENDPOINT \
  --output evaluation/results/paths.json
```

Path metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Dependency Ordering** | Prerequisites before advanced | 100% |
| **Gap Identification** | Correct skills identified as gaps | > 95% |
| **Content Style Match** | Content matches learning preference | > 90% |
| **Timeline Accuracy** | Estimated weeks vs actual | Within 20% |
| **Personalization** | Paths differ for different profiles | > 90% unique |

## Step 2: Evaluate Assessment Quality

```bash
python evaluation/eval_assessments.py \
  --test-data evaluation/data/assessments/ \
  --judge-model gpt-4o \
  --output evaluation/results/assessments.json
```

Assessment metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Question Validity** (LLM judge) | Questions test intended skill | > 90% |
| **Difficulty Calibration** | Match stated difficulty level | > 85% |
| **Distractor Quality** | Wrong options aren't obviously wrong | > 80% |
| **Explanation Quality** | Feedback explains correct answer | > 4.0/5.0 |
| **Passing Score Calibration** | Passers actually demonstrate mastery | > 85% correlation |

## Step 3: Evaluate Learning Outcomes

```bash
python evaluation/eval_outcomes.py \
  --output evaluation/results/outcomes.json
```

Outcome metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Completion Rate** | Learners who finish their path | > 70% |
| **Skill Gain** | Pre-test → post-test improvement | > 30% gain |
| **Time to Competency** | Actually matches estimate | Within 25% |
| **Drop-off Points** | Modules where learners quit | Identify top 3 |
| **Learner Satisfaction** | Post-path survey (1-5) | > 4.0/5.0 |

## Step 4: Evaluate Content Quality

```bash
python evaluation/eval_content.py \
  --test-data evaluation/data/content/ \
  --judge-model gpt-4o \
  --output evaluation/results/content.json
```

Content metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Accuracy** (LLM judge) | Content is factually correct | > 95% |
| **Freshness** | Content reflects current practices | > 90% (within 6 months) |
| **Accessibility** | WCAG 2.1 AA compliant | 100% |
| **Engagement** (LLM judge) | Content is well-structured, clear | > 4.0/5.0 |

## Step 5: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Path generation quality per role type
- Assessment validity heatmap by skill × difficulty
- Completion funnel: enrolled → active → completed
- Skill gain distribution across learners
- Content freshness audit (last updated per module)
- Drop-off analysis: which modules have highest abandonment

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Dependency ordering | 100% | config/guardrails.json |
| Completion rate | > 70% | config/guardrails.json |
| Skill gain | > 30% | config/guardrails.json |
| Assessment validity | > 90% | config/guardrails.json |
| Content accuracy | > 95% | config/guardrails.json |
| Learner satisfaction | > 4.0/5.0 | config/guardrails.json |
| Groundedness | > 0.85 | fai-manifest.json |
