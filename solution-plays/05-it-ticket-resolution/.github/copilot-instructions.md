---
description: "IT Ticket Resolution domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# IT Ticket Resolution — Domain Knowledge

This workspace implements AI-powered IT ticket resolution — automatic classification, routing, suggested resolution, and knowledge base retrieval for helpdesk tickets.

## IT Ticket AI Architecture (What the Model Gets Wrong)

### Ticket Processing Pipeline
```
Incoming Ticket → Classification (category, priority, sentiment) → Routing → Resolution Suggestion → Human Review → Close/Escalate
```

### Classification with Structured Output
```python
class TicketClassification(BaseModel):
    category: str = Field(..., description="IT category: hardware, software, network, access, other")
    priority: str = Field(..., description="P1-critical, P2-high, P3-medium, P4-low")
    sentiment: str = Field(..., description="frustrated, neutral, satisfied")
    suggested_team: str = Field(..., description="desktop-support, network-ops, security, app-support")
    confidence: float = Field(..., ge=0, le=1)

# Use structured output — never free-text classification
response = client.chat.completions.create(
    model="gpt-4o", temperature=0,
    response_format={"type": "json_schema", "json_schema": TicketClassification.model_json_schema()},
    messages=[{"role": "system", "content": CLASSIFICATION_PROMPT}, {"role": "user", "content": ticket_text}],
)
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Free-text classification | Unparseable, inconsistent categories | Structured JSON output with enum values |
| No priority from sentiment | Frustrated user + P4 = bad experience | Boost priority if sentiment=frustrated |
| Single-model for all tickets | Overkill for simple "reset password" tickets | Route simple→gpt-4o-mini, complex→gpt-4o |
| No knowledge base RAG | Agent invents solutions | Retrieve from KB before suggesting fix |
| No SLA tracking | Breached SLAs undetected | Track response time vs priority SLA |
| PII in ticket text | Logged credentials, personal data | Detect + mask PII before processing |
| No feedback loop | Model doesn't improve | Track resolution success rate per category |

## SLA Targets by Priority
| Priority | First Response | Resolution | Escalation |
|----------|--------------|------------|------------|
| P1 Critical | 15 min | 4 hours | After 2 hours |
| P2 High | 1 hour | 8 hours | After 4 hours |
| P3 Medium | 4 hours | 24 hours | After 12 hours |
| P4 Low | 8 hours | 72 hours | After 48 hours |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | model, temperature (0 for classification), max_tokens |
| `config/guardrails.json` | PII detection rules, content safety thresholds |
| `config/agents.json` | routing rules, escalation criteria, confidence thresholds |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement ticket classification, routing, KB integration |
| `@reviewer` | Audit classification accuracy, SLA compliance, PII handling |
| `@tuner` | Optimize routing rules, model selection, resolution accuracy |

## Slash Commands
`/deploy` — Deploy ticket AI | `/test` — Run classification tests | `/review` — Audit quality | `/evaluate` — Evaluate resolution metrics
