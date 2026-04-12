---
name: "evaluate-ai-customer-support-v2"
description: "Evaluate AI Customer Support V2 quality — intent accuracy, resolution rate, CSAT score, escalation appropriateness, KB grounding, response quality across channels."
---

# Evaluate AI Customer Support V2

## Prerequisites

- Deployed support pipeline (run `deploy-ai-customer-support-v2` skill first)
- Test conversation dataset with labeled intents and outcomes
- Python 3.11+ with `azure-ai-evaluation` package

## Step 1: Prepare Evaluation Dataset

```bash
mkdir -p evaluation/data
# evaluation/data/conversation-001.json
# {
#   "messages": [{"role": "user", "content": "Where is my order ORD-12345?"}],
#   "expected_intent": "order_status",
#   "expected_slots": {"order_id": "ORD-12345"},
#   "expected_sentiment": "neutral",
#   "channel": "chat",
#   "expected_resolution": true
# }
```

Test categories:
- **Order queries**: Status, tracking, delays (15 conversations)
- **Returns/refunds**: Return requests, refund status (10 conversations)
- **Product questions**: Features, compatibility (10 conversations)
- **Technical issues**: Errors, troubleshooting (10 conversations)
- **Complaints**: Frustrated customers, escalation scenarios (10 conversations)
- **Multi-turn**: 3+ turn conversations with slot filling (5 conversations)

## Step 2: Evaluate Intent Classification

```bash
python evaluation/eval_intent.py \
  --test-data evaluation/data/ \
  --endpoint $SUPPORT_ENDPOINT \
  --output evaluation/results/intent.json
```

Intent metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Intent Accuracy** | Correct intent predicted | > 90% |
| **Slot Extraction** | Correct slots filled from message | > 85% |
| **Sentiment Detection** | Correct sentiment classification | > 85% |
| **Confidence Calibration** | High confidence = correct, low = uncertain | > 90% |
| **Multi-turn Context** | Intent correct with conversation history | > 85% |

## Step 3: Evaluate Response Quality

```bash
python evaluation/eval_responses.py \
  --test-data evaluation/data/ \
  --judge-model gpt-4o \
  --output evaluation/results/responses.json
```

Response quality metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **KB Grounding** | Response based on knowledge base only | > 95% |
| **Helpfulness** (LLM judge) | Actually answers the question | > 4.0/5.0 |
| **Tone Appropriateness** | Matches channel + sentiment | > 4.0/5.0 |
| **Personalization** | Uses customer name, order details | > 80% |
| **No Hallucination** | No made-up policies or information | > 98% |
| **Channel Formatting** | Correct format (markdown/HTML/SSML) | 100% |

## Step 4: Evaluate Escalation Logic

```bash
python evaluation/eval_escalation.py \
  --test-data evaluation/data/ \
  --output evaluation/results/escalation.json
```

Escalation metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Correct Escalation** | Should escalate → did escalate | > 95% |
| **False Escalation** | Shouldn't escalate → did | < 10% |
| **Escalation Rate** | % of conversations escalated | 15-25% (sweet spot) |
| **Priority Accuracy** | Correct priority (high/medium/low) | > 90% |
| **Time to Escalate** | Turns before escalation decision | < 3 turns |

## Step 5: Evaluate Resolution and CSAT

```bash
python evaluation/eval_resolution.py \
  --test-data evaluation/data/ \
  --output evaluation/results/resolution.json
```

Resolution metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Auto-Resolution Rate** | Resolved without human agent | > 60% |
| **First-Contact Resolution** | Resolved in single conversation | > 70% |
| **CSAT Score** | Customer satisfaction (1-5 scale) | > 4.0/5.0 |
| **Avg Handling Time** | Time from start to resolution | < 3 minutes (chat) |
| **Repeat Contact Rate** | Same issue within 7 days | < 10% |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Intent accuracy | > 90% | config/guardrails.json |
| KB grounding | > 95% | config/guardrails.json |
| Auto-resolution | > 60% | config/guardrails.json |
| CSAT | > 4.0/5.0 | config/guardrails.json |
| Escalation rate | 15-25% | config/guardrails.json |
| Groundedness | > 0.85 | fai-manifest.json |
