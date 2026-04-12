---
name: "evaluate-fai-meta-agent"
description: "Evaluate FAI Meta-Agent — routing accuracy, play recommendation relevance, DevKit completeness, cross-play compatibility, feedback loop effectiveness."
---

# Evaluate FAI Meta-Agent

## Prerequisites

- Deployed meta-agent (run `deploy-fai-meta-agent` skill first)
- Test queries with known best-play answers
- Python 3.11+ with `azure-ai-evaluation`

## Step 1: Evaluate Play Routing Accuracy

```bash
python evaluation/eval_routing.py \
  --test-data evaluation/data/routing_queries/ \
  --output evaluation/results/routing.json
```

Routing metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Top-1 Accuracy** | Best play is the first recommendation | > 75% |
| **Top-3 Accuracy** | Best play in top 3 recommendations | > 90% |
| **Domain Classification** | Correct domain identified | > 90% |
| **Industry Match** | Correct industry when specified | > 85% |
| **No Hallucinated Plays** | Only recommends plays that exist in catalog | 100% |

By query complexity:
| Query Type | Top-1 Target | Example |
|-----------|-------------|---------|
| Direct match | > 90% | "I need a RAG system" → Play 01 |
| Domain + industry | > 80% | "Healthcare document Q&A" → Play 01 + Play 46 |
| Ambiguous | > 60% | "I want AI for my business" → multiple relevant |

## Step 2: Evaluate Cross-Play Intelligence

```bash
python evaluation/eval_combinations.py \
  --test-data evaluation/data/combinations/ \
  --output evaluation/results/combinations.json
```

Combination metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Complementary Relevance** | Suggested complementary play is actually useful | > 80% |
| **Combination Validity** | Combined plays are architecturally compatible | > 95% |
| **Regulatory Match** | Compliance play suggested when regulation mentioned | > 90% |
| **No Redundant Pairs** | Two plays solving same problem not recommended together | 100% |

## Step 3: Evaluate DevKit Initialization

```bash
python evaluation/eval_devkit.py \
  --test-data evaluation/data/init_results/ \
  --output evaluation/results/devkit.json
```

DevKit metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **File Completeness** | All DevKit files created correctly | 100% |
| **Content Accuracy** | Generated files match play template | > 95% |
| **No Placeholder Content** | All files have real content (not stubs) | 100% |
| **Config Valid JSON** | All .json files parse correctly | 100% |
| **YAML Valid** | All .md files have valid frontmatter | 100% |

## Step 4: Evaluate Recommendation Quality

```bash
python evaluation/eval_quality.py \
  --test-data evaluation/data/recommendations/ \
  --output evaluation/results/quality.json
```

Quality metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Rationale Quality** (LLM judge) | Explanation is clear and accurate | > 4.0/5.0 |
| **User Context Adaptation** | Recommendation changes based on user context | Verified |
| **Cost Estimate Accuracy** | Provided cost matches play actual cost | Within ±30% |
| **Groundedness** | Every claim about a play is verifiable in catalog | > 0.95 |

## Step 5: Evaluate Feedback Loop

```bash
python evaluation/eval_feedback.py \
  --test-data evaluation/data/feedback/ \
  --output evaluation/results/feedback.json
```

Feedback metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Tracking Coverage** | Events tracked for recommended plays | > 90% |
| **Satisfaction Collection** | User ratings collected after deployment | > 30% response rate |
| **Routing Improvement** | Accuracy trend improving over time | Positive slope |
| **Abandoned Recommendations** | Recommended but never initialized | < 30% |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Routing accuracy confusion matrix (domain × play)
- Combination recommendation analysis
- DevKit initialization success rate
- User satisfaction distribution
- Feedback-driven routing improvement trend

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Top-3 routing accuracy | > 90% | config/guardrails.json |
| No hallucinated plays | 100% | config/guardrails.json |
| DevKit completeness | 100% | config/guardrails.json |
| Combination validity | > 95% | config/guardrails.json |
| Groundedness | > 0.95 | fai-manifest.json |
