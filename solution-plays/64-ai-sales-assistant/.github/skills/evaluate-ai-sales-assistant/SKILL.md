---
name: "evaluate-ai-sales-assistant"
description: "Evaluate AI Sales Assistant quality — lead-to-close correlation, email response rate, scoring accuracy, talk track relevance, competitive intel freshness."
---

# Evaluate AI Sales Assistant

## Prerequisites

- Deployed sales assistant (run `deploy-ai-sales-assistant` skill first)
- Historical deal data for scoring validation
- Python 3.11+ with `azure-ai-evaluation` package

## Step 1: Evaluate Lead Scoring

```bash
python evaluation/eval_scoring.py \
  --test-data evaluation/data/leads/ \
  --endpoint $SALES_ENDPOINT \
  --output evaluation/results/scoring.json
```

Scoring metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Score-to-Close Correlation** | High scores close more deals | Pearson > 0.6 |
| **Temperature Accuracy** | Hot leads close, cold don't | > 80% |
| **ICP Match Precision** | Company fit correctly assessed | > 85% |
| **Engagement Signal Weight** | Behavioral signals predict conversion | Correlation > 0.5 |
| **Score Consistency** | Same lead → same score | 100% (temp=0) |
| **CRM Grounding** | No hallucinated company data | 100% |

## Step 2: Evaluate Email Quality

```bash
python evaluation/eval_emails.py \
  --test-data evaluation/data/emails/ \
  --judge-model gpt-4o \
  --output evaluation/results/emails.json
```

Email metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Personalization Score** | Uses lead's industry, role, activity | > 4.0/5.0 |
| **CTA Clarity** | Clear call-to-action | > 90% |
| **Response Rate** (historical) | Emails that got replies | > 15% |
| **Brand Compliance** | Matches company tone/guidelines | > 95% |
| **No Hallucination** | Company details from CRM only | 100% |
| **Length Compliance** | Under 150 words | > 95% |

## Step 3: Evaluate Competitive Intelligence

```bash
python evaluation/eval_intel.py \
  --test-data evaluation/data/competitors/ \
  --output evaluation/results/intel.json
```

Intel metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Win/Loss Grounding** | Battle card based on actual CRM data | 100% |
| **Freshness** | Data from last 90 days | > 80% of entries |
| **Actionability** (LLM judge) | Rep can use in conversation | > 4.0/5.0 |
| **Competitor Coverage** | Top 5 competitors have battle cards | 100% |

## Step 4: Evaluate Talk Track Quality

```bash
python evaluation/eval_talk_tracks.py \
  --test-data evaluation/data/leads/ \
  --judge-model gpt-4o \
  --output evaluation/results/talk_tracks.json
```

Talk track metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Relevance** (LLM judge) | Matches lead's industry and pain points | > 4.0/5.0 |
| **Specificity** | Uses concrete data points, not generic | > 85% |
| **Differentiator** | Highlights unique value proposition | > 80% |
| **Actionability** | Rep knows exactly what to say | > 4.0/5.0 |

## Step 5: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Score-to-close correlation | > 0.6 | config/guardrails.json |
| Email personalization | > 4.0/5.0 | config/guardrails.json |
| CRM grounding | 100% | config/guardrails.json |
| Response rate | > 15% | config/guardrails.json |
| Groundedness | > 0.85 | fai-manifest.json |
