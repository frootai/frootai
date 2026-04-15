---
name: fai-tune-08-copilot-studio-bot
description: "Tune Play 08 (Copilot Studio Bot) topic routing, generative answers config, handoff triggers, and channel settings."
---

# FAI Tune — Play 08: Copilot Studio Bot

## TuneKit Configuration Files

```
solution-plays/08-copilot-studio-bot/config/
├── topics.json           # Topic routing and trigger phrases
├── generative.json       # Generative answers (GPT) settings
├── handoff.json          # Live agent handoff configuration
├── channels.json         # Teams, Web, Slack channel config
└── guardrails.json       # Safety and quality thresholds
```

## Step 1 — Configure Topic Routing

```json
// config/topics.json
{
  "fallback_behavior": "generative_answers",
  "topic_confidence_threshold": 0.75,
  "max_topic_suggestions": 3,
  "disambiguation_enabled": true,
  "greeting_topic": "Welcome",
  "escalation_topic": "Transfer to Agent",
  "custom_topics": [
    {
      "name": "Order Status",
      "trigger_phrases": ["where is my order", "track package", "delivery status"],
      "action": "api_call",
      "api_endpoint": "/api/orders/{orderId}/status"
    },
    {
      "name": "Return Request",
      "trigger_phrases": ["return item", "refund", "exchange"],
      "action": "guided_flow",
      "require_authentication": true
    }
  ]
}
```

## Step 2 — Tune Generative Answers (GPT)

```json
// config/generative.json
{
  "enabled": true,
  "model": "gpt-4o-mini",
  "temperature": 0.5,
  "max_tokens": 1024,
  "knowledge_sources": [
    { "type": "sharepoint", "url": "https://contoso.sharepoint.com/kb" },
    { "type": "website", "url": "https://help.contoso.com" },
    { "type": "dataverse", "table": "kb_articles" }
  ],
  "citation_style": "inline",
  "no_answer_response": "I don't have information about that. Let me connect you with a support agent.",
  "content_moderation": "strict"
}
```

**Tuning checklist:**

| Parameter | Range | Default | Guidance |
|-----------|-------|---------|----------|
| `temperature` | 0.3-0.7 | 0.5 | Lower = more factual; higher = more conversational |
| `max_tokens` | 256-2048 | 1024 | Keep short for chat; increase for detailed answers |
| `content_moderation` | strict/medium | strict | Always strict for customer-facing bots |
| `citation_style` | inline/footnote/none | inline | Inline builds trust with source links |

## Step 3 — Set Handoff Configuration

```json
// config/handoff.json
{
  "handoff_triggers": [
    { "condition": "user_requests_agent", "phrases": ["talk to human", "agent please"] },
    { "condition": "sentiment_negative", "threshold": -0.5 },
    { "condition": "topic_not_found", "after_attempts": 2 },
    { "condition": "authentication_required", "and_user_not_authed": true }
  ],
  "handoff_target": "dynamics_omnichannel",
  "context_transfer": {
    "include_conversation_history": true,
    "include_topic_detected": true,
    "include_sentiment_score": true,
    "max_history_messages": 10
  },
  "queue_message": "Connecting you with a support agent. Estimated wait: {wait_time}."
}
```

## Step 4 — Set Guardrails

```json
// config/guardrails.json
{
  "quality": {
    "topic_resolution_rate": 0.80,
    "user_satisfaction_target": 4.0,
    "avg_turns_to_resolution": 5
  },
  "safety": {
    "content_moderation": "strict",
    "block_competitor_mentions": true,
    "pii_masking_in_logs": true,
    "max_consecutive_bot_messages": 3
  },
  "cost": {
    "max_tokens_per_conversation": 8192,
    "max_generative_calls_per_hour": 1000,
    "cache_common_responses": true
  }
}
```

## Validation Checklist

| Check | Expected | Command |
|-------|----------|---------|
| Content moderation | strict | `jq '.content_moderation' config/generative.json` |
| Handoff triggers defined | >=2 | `jq '.handoff_triggers | length' config/handoff.json` |
| PII masking | true | `jq '.safety.pii_masking_in_logs' config/guardrails.json` |
| Token budget | <=8192/conversation | `jq '.cost.max_tokens_per_conversation' config/guardrails.json` |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Bot gives wrong answers | Knowledge source outdated | Refresh SharePoint/website index |
| Too many handoffs | Topic threshold too high | Lower `topic_confidence_threshold` to 0.65 |
| Users frustrated | No disambiguation | Enable `disambiguation_enabled: true` |
| High token costs | Long conversations | Reduce `max_tokens` to 512 for simple topics |
