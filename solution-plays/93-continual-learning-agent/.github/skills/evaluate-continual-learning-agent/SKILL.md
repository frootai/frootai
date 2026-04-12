---
name: "evaluate-continual-learning-agent"
description: "Evaluate Continual Learning Agent — memory retrieval quality, reflection accuracy, knowledge distillation, learning curve, catastrophic forgetting."
---

# Evaluate Continual Learning Agent

## Prerequisites

- Deployed continual learning agent (run `deploy-continual-learning-agent` skill first)
- Multi-session test scenarios (≥20 sessions with varied tasks)
- Python 3.11+ with `azure-ai-evaluation`

## Step 1: Evaluate Memory Retrieval Quality

```bash
python evaluation/eval_memory.py \
  --test-data evaluation/data/retrieval_tests/ \
  --output evaluation/results/memory.json
```

Memory metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Episodic Recall Precision** | Retrieved episodes are relevant | > 80% |
| **Episodic Recall@5** | Correct episode in top 5 | > 85% |
| **Semantic Knowledge Accuracy** | Distilled knowledge is correct | > 90% |
| **Procedural Match** | Right skill matched to task type | > 85% |
| **Cross-Session Persistence** | Agent recalls previous session info | 100% |
| **Decay Compliance** | Old irrelevant memories fade appropriately | > 90% |

## Step 2: Evaluate Learning Curve

```bash
python evaluation/eval_learning.py \
  --test-data evaluation/data/learning_sessions/ \
  --output evaluation/results/learning.json
```

Learning metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Performance Improvement** | Task success rate over sessions | Positive trend |
| **Efficiency Improvement** | Time/tokens per task decreasing | > 10% reduction by session 10 |
| **Repeated Mistake Rate** | Same error not repeated after reflection | < 10% |
| **Knowledge Generalization** | Learned from task A → applies to similar B | > 60% |
| **Skill Acquisition Rate** | New procedures learned per 10 sessions | > 2 |

## Step 3: Evaluate Reflection Quality

```bash
python evaluation/eval_reflection.py \
  --test-data evaluation/data/reflections/ \
  --output evaluation/results/reflection.json
```

Reflection metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Reflection Accuracy** | Correctly identifies what went well/wrong | > 80% |
| **Actionable Insights** | Reflection suggests concrete improvements | > 75% |
| **Self-Correction** | Agent corrects approach based on reflection | > 60% |
| **No Hallucinated Lessons** | Lesson matches actual episode outcome | 100% |

## Step 4: Evaluate Catastrophic Forgetting Prevention

```bash
python evaluation/eval_forgetting.py \
  --test-data evaluation/data/long_term/ \
  --output evaluation/results/forgetting.json
```

Forgetting metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Critical Memory Retention** | Important lessons retained after 100+ sessions | > 95% |
| **Knowledge Conflict Resolution** | New knowledge doesn't corrupt old if contradictory | > 85% |
| **Capacity vs Quality** | Memory pruning doesn't remove important items | > 95% important retained |
| **Distillation Preserves Core** | Compressed episodes still retrievable via knowledge | > 90% |

## Step 5: Evaluate Privacy & Safety

```bash
python evaluation/eval_safety.py \
  --test-data evaluation/data/privacy/ \
  --output evaluation/results/safety.json
```

Safety metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **No PII in Memory** | Episodic memory doesn't store user PII | 100% |
| **Memory Isolation** | Multi-user: user A can't access user B's memory | 100% |
| **Harmful Pattern Rejection** | Agent doesn't learn harmful behaviors | 100% |
| **Right to Deletion** | User can request memory deletion | 100% supported |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Learning curve (performance vs session count)
- Memory retrieval precision@K chart
- Reflection quality scorecard
- Forgetting resistance over long-term
- Memory composition (episodic vs semantic vs procedural)

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Episodic recall precision | > 80% | config/guardrails.json |
| Performance improvement | Positive trend | config/guardrails.json |
| Critical memory retention | > 95% | config/guardrails.json |
| No PII in memory | 100% | Responsible AI |
| Memory isolation | 100% | Security |
