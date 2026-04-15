---
name: fai-tune-05-it-ticket-resolution
description: "Tune Play 05 (IT Ticket Resolution) classifier routing, priority scoring, SLA thresholds, and escalation model config."
---

# FAI Tune — Play 05: IT Ticket Resolution

## TuneKit Configuration Files

All tunable parameters live in `config/` inside the solution play:

```
solution-plays/05-it-ticket-resolution/config/
├── classifier.json       # Ticket classification model settings
├── routing.json          # Team routing rules + priority matrix
├── sla.json              # SLA targets per priority level
├── escalation.json       # Auto-escalation triggers
└── guardrails.json       # Quality + safety thresholds
```

## Step 1 — Validate Classifier Model Config

The classifier routes incoming tickets to the correct resolution team:

```json
// config/classifier.json
{
  "model": "gpt-4o-mini",
  "temperature": 0.0,
  "max_tokens": 256,
  "categories": [
    "network", "hardware", "software", "access-control",
    "email", "vpn", "printer", "other"
  ],
  "confidence_threshold": 0.85,
  "fallback_category": "other",
  "few_shot_examples": 5,
  "structured_output": true
}
```

**Tuning checklist:**

| Parameter | Range | Default | Guidance |
|-----------|-------|---------|----------|
| `temperature` | 0.0 | 0.0 | Must be 0 for deterministic classification |
| `confidence_threshold` | 0.7-0.95 | 0.85 | Lower = more auto-routing; higher = more human review |
| `few_shot_examples` | 3-10 | 5 | More = better accuracy, higher token cost |
| `model` | gpt-4o-mini, gpt-4o | gpt-4o-mini | Mini sufficient for classification |

## Step 2 — Tune Priority and Routing Matrix

```json
// config/routing.json
{
  "priority_matrix": {
    "P1-critical": {
      "sla_response_minutes": 15,
      "sla_resolution_hours": 4,
      "auto_escalate_after_minutes": 30,
      "teams": ["infra-oncall", "security-oncall"]
    },
    "P2-high": {
      "sla_response_minutes": 60,
      "sla_resolution_hours": 8,
      "auto_escalate_after_minutes": 120,
      "teams": ["it-support-l2"]
    },
    "P3-medium": {
      "sla_response_minutes": 240,
      "sla_resolution_hours": 24,
      "auto_escalate_after_minutes": 480,
      "teams": ["it-support-l1"]
    },
    "P4-low": {
      "sla_response_minutes": 480,
      "sla_resolution_hours": 72,
      "auto_escalate_after_minutes": null,
      "teams": ["self-service"]
    }
  }
}
```

## Step 3 — Configure Escalation Rules

```json
// config/escalation.json
{
  "auto_escalate": true,
  "escalation_triggers": [
    { "condition": "sla_breach_warning", "threshold_percent": 80 },
    { "condition": "negative_sentiment", "threshold": 0.3 },
    { "condition": "repeated_reopens", "count": 3 },
    { "condition": "vip_requester", "auto_priority": "P2-high" }
  ],
  "notification_channels": ["teams", "email", "pagerduty"],
  "escalation_chain": ["l1-support", "l2-support", "manager"]
}
```

## Step 4 — Set Guardrails Thresholds

```json
// config/guardrails.json
{
  "response_quality": {
    "groundedness": 0.85,
    "relevance": 0.80,
    "coherence": 0.85,
    "min_response_length": 50,
    "max_response_length": 2000
  },
  "safety": {
    "pii_detection": true,
    "pii_mask_in_logs": true,
    "block_credential_sharing": true
  },
  "cost": {
    "max_tokens_per_ticket": 4096,
    "max_tokens_per_day": 500000,
    "preferred_model": "gpt-4o-mini"
  }
}
```

## Step 5 — Run Evaluation Pipeline

```python
from azure.ai.evaluation import evaluate, GroundednessEvaluator, RelevanceEvaluator

results = evaluate(
    data="evaluation/test-tickets.jsonl",
    evaluators={
        "groundedness": GroundednessEvaluator(model_config),
        "relevance": RelevanceEvaluator(model_config),
    }
)

for metric, score in results["metrics"].items():
    threshold = guardrails["response_quality"].get(metric, 0.8)
    status = "PASS" if score >= threshold else "FAIL"
    print(f"{status} {metric}: {score:.2f} (threshold: {threshold})")
```

## Validation Checklist

| Check | Expected | Command |
|-------|----------|---------|
| Classifier temperature | 0.0 | `jq '.temperature' config/classifier.json` |
| Confidence threshold | 0.7-0.95 | `jq '.confidence_threshold' config/classifier.json` |
| SLA P1 response | <=15 min | `jq '.priority_matrix["P1-critical"].sla_response_minutes' config/routing.json` |
| Groundedness score | >=0.85 | Run evaluation pipeline |
| PII masking enabled | true | `jq '.safety.pii_mask_in_logs' config/guardrails.json` |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Misclassified tickets | Low confidence threshold | Increase `few_shot_examples` to 8+ |
| SLA breaches | Escalation timing too slow | Reduce `auto_escalate_after_minutes` by 25% |
| High token costs | gpt-4o for simple tickets | Set `preferred_model` to gpt-4o-mini |
| PII in responses | Safety guardrails off | Set `pii_detection: true` |
