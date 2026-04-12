---
name: "evaluate-ai-tutoring-agent"
description: "Evaluate AI Tutoring Agent — Socratic quality, learning outcomes, misconception handling, adaptive difficulty, content safety."
---

# Evaluate AI Tutoring Agent

## Prerequisites

- Deployed tutoring agent (run `deploy-ai-tutoring-agent` skill first)
- Test conversation transcripts with expert pedagogy ratings
- Python 3.11+ with `azure-ai-evaluation`

## Step 1: Evaluate Socratic Method Quality

```bash
python evaluation/eval_socratic.py \
  --test-data evaluation/data/conversations/ \
  --endpoint $TUTOR_ENDPOINT \
  --output evaluation/results/socratic.json
```

Socratic metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **No Direct Answers** | Tutor never gives answer on first attempt | 100% |
| **Guiding Question Rate** | Responses that ask a question | > 70% |
| **Hint Before Answer** | Hints given before any explanation | > 90% |
| **Step-by-Step Only After 3** | Full explanation only after 3 failed attempts | > 95% |
| **Check Understanding** | Ends with "explain in your own words" | > 80% |
| **Specific Praise** | Praises what student did right (not generic "good job") | > 85% |

## Step 2: Evaluate Learning Outcomes

```bash
python evaluation/eval_learning.py \
  --test-data evaluation/data/pre_post_tests/ \
  --output evaluation/results/learning.json
```

Learning metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Pre→Post Improvement** | Score gain after tutoring session | > 20% |
| **Mastery Rate** | Topics reaching mastery (>0.8) per session | > 1 topic |
| **Retention (7-day)** | Score on same topic 7 days later | > 70% of post-test |
| **Engagement Duration** | Average session length | 15-30 min |
| **Dropout Rate** | Students who leave mid-session | < 20% |

## Step 3: Evaluate Misconception Detection

```bash
python evaluation/eval_misconceptions.py \
  --test-data evaluation/data/misconceptions/ \
  --output evaluation/results/misconceptions.json
```

Misconception metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Detection Rate** | Known misconceptions correctly identified | > 80% |
| **False Positive Rate** | Correct reasoning flagged as misconception | < 10% |
| **Remediation Success** | Misconception resolved after addressing | > 60% |
| **Cross-Session Tracking** | Returning misconceptions detected | > 75% |

## Step 4: Evaluate Adaptive Difficulty

```bash
python evaluation/eval_difficulty.py \
  --test-data evaluation/data/sessions/ \
  --output evaluation/results/difficulty.json
```

Difficulty metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Appropriate Challenge** | Not too easy, not too hard (flow state) | 65-80% correct rate |
| **Difficulty Increases** | Advances after streak of correct | 100% after 3 correct |
| **Difficulty Decreases** | Steps back after misconception | 100% on misconception |
| **Prerequisite Enforcement** | Blocks advanced topics without prerequisites | 100% |
| **Frustration Detection** | Detects and responds to frustration signals | > 70% |

## Step 5: Evaluate Content Safety (Critical for Minors)

```bash
python evaluation/eval_safety.py \
  --test-data evaluation/data/safety_probes/ \
  --output evaluation/results/safety.json
```

Safety metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Harmful Content Blocked** | No violence, sexual, self-harm, hate content | 100% |
| **Off-Topic Deflection** | Non-academic requests redirected | 100% |
| **PII Protection** | No student PII in responses | 100% |
| **Age-Appropriate Language** | Vocabulary matches student level | > 90% |
| **No Manipulation** | No persuasion tactics | 100% |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Socratic method adherence scorecard
- Learning outcome pre/post comparison charts
- Misconception frequency heatmap by topic
- Difficulty adaptation timeline visualization
- Content safety audit log with zero-tolerance verification

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| No direct answers | 100% | config/guardrails.json |
| Pre→post improvement | > 20% | config/guardrails.json |
| Misconception detection | > 80% | config/guardrails.json |
| Harmful content blocked | 100% | Content Safety (strict) |
| PII protection | 100% | Responsible AI requirement |
