---
description: "AI Customer Support V2 domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# AI Customer Support V2 — Domain Knowledge

This workspace implements advanced AI customer support — multi-channel (chat, email, voice), intent classification with slot filling, knowledge-grounded responses, sentiment-aware escalation, and agent handoff.

## Customer Support Architecture (What the Model Gets Wrong)

### Multi-Channel Processing
```python
async def handle_customer_query(channel: str, message: Message) -> Response:
    # 1. Normalize input across channels
    normalized = normalize_input(channel, message)  # chat/email/voice → unified format
    
    # 2. Intent + sentiment classification
    intent = await classify_intent(normalized)
    # {"intent": "order_status", "slots": {"order_id": "ORD-12345"}, "sentiment": "frustrated", "confidence": 0.92}
    
    # 3. Sentiment-aware routing
    if intent.sentiment == "frustrated" and intent.confidence < 0.7:
        return await escalate_to_human(normalized, reason="frustrated + low confidence")
    
    # 4. Knowledge-grounded response
    kb_results = await search_knowledge_base(intent)
    response = await generate_grounded_response(normalized, kb_results, intent)
    
    # 5. Format for channel
    return format_for_channel(channel, response)  # Markdown→chat, HTML→email, SSML→voice
```

### Escalation Decision Matrix
| Sentiment | Confidence | Action |
|-----------|-----------|--------|
| Positive + High (>0.85) | Auto-respond with KB answer |
| Positive + Low (<0.7) | Auto-respond + flag for review |
| Neutral + High | Auto-respond |
| Neutral + Low | Suggest answer + human review |
| Frustrated + High | Auto-respond + priority human follow-up |
| Frustrated + Low | **Immediate human escalation** |

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Ignore sentiment | Frustrated customer gets robotic response | Detect sentiment, adjust tone, escalate when frustrated |
| No knowledge grounding | AI invents policies | Ground responses in KB — "I don't know" if not in KB |
| Same response format all channels | Email gets chat-style, voice gets markdown | Format per channel: markdown/HTML/SSML |
| No escalation path | Customer stuck with AI forever | Sentiment + confidence → human escalation rules |
| No conversation context | Each message treated independently | Session memory: track intent history, filled slots |
| No CSAT feedback loop | Don't know if responses helped | Post-interaction survey, track resolution rate |
| Generic responses | "Thank you for contacting us" × 100 | Personalize with customer name, order details, history |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | Response model, temperature (0.3 for support — friendly but factual) |
| `config/guardrails.json` | Escalation thresholds, sentiment rules, max auto-responses |
| `config/agents.json` | Channel configs, KB sources, handoff rules |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement multi-channel support, intent classification, KB integration |
| `@reviewer` | Audit response quality, escalation logic, CSAT tracking |
| `@tuner` | Optimize intent accuracy, reduce escalation rate, improve CSAT |

## Slash Commands
`/deploy` — Deploy support AI | `/test` — Test with sample conversations | `/review` — Audit quality | `/evaluate` — Measure resolution + CSAT
