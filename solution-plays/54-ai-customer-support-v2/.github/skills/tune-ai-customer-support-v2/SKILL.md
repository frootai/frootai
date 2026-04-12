---
name: "tune-ai-customer-support-v2"
description: "Tune AI Customer Support V2 — intent thresholds, escalation rules, response tone, KB indexing, channel templates, CSAT optimization, cost per resolution."
---

# Tune AI Customer Support V2

## Prerequisites

- Deployed support pipeline with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`
- Evaluation baseline from `evaluate-ai-customer-support-v2` skill

## Step 1: Tune Intent Classification

```json
// config/openai.json
{
  "intent_classification": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 200,
    "min_confidence": 0.7,
    "fallback_intent": "general_inquiry"
  },
  "response_generation": {
    "model": "gpt-4o",
    "temperature": 0.3,
    "max_tokens": 500,
    "tone": "friendly_professional"
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| Intent `model` | gpt-4o-mini | Faster + cheaper for classification |
| Response `model` | gpt-4o | Better quality for customer-facing |
| Response `temperature` | 0.3 | Higher = more creative but less accurate |
| `min_confidence` | 0.7 | Lower = fewer escalations, more risk |
| `tone` | friendly_professional | Options: casual, formal, empathetic |

## Step 2: Tune Escalation Rules

```json
// config/guardrails.json
{
  "escalation": {
    "sentiment_rules": {
      "frustrated_low_confidence": { "action": "escalate", "priority": "high" },
      "frustrated_high_confidence": { "action": "respond", "flag": true, "followup": "priority" },
      "neutral_low_confidence": { "action": "respond", "flag": true },
      "positive_any": { "action": "respond" }
    },
    "max_turns_before_escalation": 5,
    "min_confidence_to_respond": 0.6,
    "complaint_auto_escalate": true,
    "escalation_channels": ["teams_notification", "crm_ticket"],
    "target_escalation_rate": { "min": 0.15, "max": 0.25 }
  }
}
```

Escalation tuning guide:
| Symptom | Adjustment |
|---------|------------|
| Too many escalations (>25%) | Raise min_confidence to 0.8, increase max_turns |
| Too few escalations (<15%) | Lower min_confidence to 0.6, enable complaint auto-escalate |
| Frustrated customers not escalated | Lower frustrated_high_confidence to always escalate |
| Good conversations escalating | Review false escalation triggers, increase min_confidence |

## Step 3: Tune Knowledge Base

```json
// config/agents.json
{
  "knowledge_base": {
    "search_index": "support-knowledge",
    "top_k": 5,
    "score_threshold": 0.75,
    "semantic_reranking": true,
    "sources": [
      { "name": "faq", "weight": 1.0, "update": "weekly" },
      { "name": "product_docs", "weight": 0.8, "update": "on_release" },
      { "name": "policies", "weight": 0.9, "update": "quarterly" },
      { "name": "troubleshooting", "weight": 1.0, "update": "as_needed" }
    ]
  },
  "no_answer_response": "I don't have that information in my knowledge base. Let me connect you with a specialist who can help.",
  "max_context_chunks": 5
}
```

KB tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `top_k` | 5 | More = richer context, higher cost |
| `score_threshold` | 0.75 | Lower = more results, risk irrelevance |
| `semantic_reranking` | true | Better relevance, slight latency add |
| Source weights | 0.8-1.0 | Prioritize FAQ over product docs |

## Step 4: Tune Channel Templates

```json
// config/agents.json
{
  "channels": {
    "chat": {
      "max_response_length": 300,
      "format": "markdown",
      "emoji": true,
      "greeting": "Hi! I'm here to help"
    },
    "email": {
      "max_response_length": 800,
      "format": "html",
      "include_signature": true,
      "greeting": "Dear {customer_name}"
    },
    "voice": {
      "max_response_length": 150,
      "format": "ssml",
      "speaking_rate": "medium",
      "greeting": "Thank you for calling"
    }
  }
}
```

## Step 5: Cost Optimization

```python
# Customer support cost per conversation:
# - Intent classification (gpt-4o-mini): ~$0.002/turn
# - Response generation (gpt-4o): ~$0.01/turn
# - KB search (AI Search): ~$0.001/query
# - Session storage (Cosmos DB): ~$0.0001/conversation
# - Average conversation (3 turns): ~$0.037
# - 10,000 conversations/month: ~$370

# Cost reduction:
# 1. gpt-4o-mini for simple intents (order_status, FAQ): save 90%
# 2. Cache frequent KB queries: save 30% search cost
# 3. Template responses for top-5 intents: save 50% generation
# 4. Reduce max turns before escalation: fewer turns = less cost
```

| Strategy | Savings | Trade-off |
|----------|---------|----------|
| gpt-4o-mini for simple responses | ~60% gen cost | Slightly less nuanced |
| Cache top-50 KB queries | ~30% search cost | Stale answers possible |
| Template responses | ~50% for top intents | Less personalized |
| Lower max turns | ~20% per conversation | Earlier escalation |

## Step 6: Verify Tuning Impact

```bash
python evaluation/eval_intent.py --test-data evaluation/data/
python evaluation/eval_responses.py --test-data evaluation/data/ --judge-model gpt-4o
python evaluation/eval_escalation.py --test-data evaluation/data/
python evaluation/eval_resolution.py --test-data evaluation/data/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Intent accuracy | baseline | +5-8% | > 90% |
| Auto-resolution | baseline | +10-15% | > 60% |
| CSAT | baseline | +0.3-0.5 | > 4.0/5.0 |
| Escalation rate | baseline | optimize to 15-25% | 15-25% |
| Cost per conversation | ~$0.037 | ~$0.020 | < $0.05 |
