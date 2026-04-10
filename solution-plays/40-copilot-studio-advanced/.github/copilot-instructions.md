---
description: "Copilot Studio Advanced domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Copilot Studio Advanced — Domain Knowledge

This workspace implements advanced Copilot Studio scenarios — custom plugins with OpenAPI, generative AI orchestration, multi-turn conversations with entity extraction, Power Automate integration, and enterprise SSO.

## Advanced Copilot Studio (What the Model Gets Wrong)

### Custom Plugin via OpenAPI Spec
```json
{
  "schema_version": "v1",
  "name_for_human": "Order Lookup",
  "name_for_model": "order_lookup",
  "description_for_model": "Look up customer order status by order ID or customer email. Returns order details including status, items, and tracking.",
  "api": {
    "type": "openapi",
    "url": "https://api.contoso.com/.well-known/openapi.json"
  },
  "auth": { "type": "oauth2", "authorization_url": "https://login.microsoftonline.com/..." }
}
```

### Generative Orchestration (Beyond Topic Matching)
```yaml
# Traditional: rigid topic matching
trigger: "order status"  # Only matches exact phrases

# Advanced: generative orchestration
# Copilot Studio uses LLM to understand intent, extract entities,
# and route to the right topic/plugin WITHOUT exact phrase matching
# Enable: Settings → AI capabilities → Generative orchestration = On
```

### Multi-Turn Entity Extraction
```yaml
topic: OrderTracking
  trigger:
    description: "Customer wants to track an order"
  nodes:
    - askQuestion:
        text: "I can help you track your order. What's your order number?"
        entity: orderNumber
        validation: "^ORD-\\d{6}$"
    - condition:
        if: "orderNumber is set"
        then:
          - callPlugin: "order_lookup"
            input: { orderId: "=orderNumber" }
          - showAdaptiveCard: "orderStatusCard"
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Only keyword triggers | Misses intent variations | Enable generative orchestration |
| No entity validation | Accept malformed input | Regex validation on entity extraction |
| Plugin without auth | Security risk — open API | OAuth2 or API key authentication |
| No fallback topic | Bot says nothing on unknown intent | Generative fallback or escalate to human |
| Hardcoded API URLs | Breaks across environments | Use environment variables in plugin config |
| No adaptive cards | Plain text responses | Rich UI with Adaptive Cards for structured data |
| No Power Automate for complex logic | Try to do everything in topics | Offload: DB queries, multi-step workflows → Power Automate |
| No analytics tracking | Can't measure bot effectiveness | Enable conversation analytics + custom events |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | Generative answers model, temperature |
| `config/guardrails.json` | Content moderation, topic boundaries, auth settings |
| `config/agents.json` | Plugin registry, entity schemas, escalation rules |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Design advanced topics, custom plugins, Power Automate flows |
| `@reviewer` | Audit security (auth, permissions), conversation flow, UX |
| `@tuner` | Optimize intent recognition, entity extraction, response quality |

## Slash Commands
`/deploy` — Publish bot | `/test` — Test conversation flows | `/review` — Audit security | `/evaluate` — Analyze bot metrics
