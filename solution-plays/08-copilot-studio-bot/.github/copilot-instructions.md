---
description: "Copilot Studio Bot domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Copilot Studio Bot — Domain Knowledge

This workspace implements a Microsoft Copilot Studio bot — declarative agent with topics, actions, knowledge sources, and Microsoft 365 integration.

## Copilot Studio Architecture (What the Model Gets Wrong)

### Declarative Agent (Not Code-First)
```yaml
# Copilot Studio uses declarative topics, NOT imperative code
# WRONG — writing a chatbot from scratch with code
# CORRECT — define topics + triggers + actions in Copilot Studio YAML/JSON

# Topic structure:
topic:
  name: "Order Status"
  trigger: 
    phrases: ["where is my order", "track order", "order status"]
  actions:
    - askQuestion: "What is your order number?"
    - callAction: "LookupOrder"
    - showMessage: "Your order {{orderStatus}} is {{deliveryDate}}"
```

### Microsoft Graph API Integration
```python
# WRONG — direct database queries
result = db.query("SELECT * FROM orders WHERE id = ?", order_id)

# CORRECT — use Microsoft Graph for M365 data
from msgraph import GraphServiceClient
graph_client = GraphServiceClient(credential)
# Search emails, SharePoint, Teams messages via Graph
results = graph_client.search.query(requests=[{"entityTypes": ["message"], "query": {"queryString": query}}])
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Code-first bot | Ignores Copilot Studio's declarative power | Use topics + triggers + actions |
| No fallback topic | Bot says "I don't understand" forever | Add fallback → escalate to human |
| Direct DB access | Bypasses M365 governance | Use Graph API connectors |
| No authentication | Bot accessible without login | Azure AD SSO + conditional access |
| Hardcoded responses | Inflexible, no personalization | Dynamic responses from knowledge sources |
| No conversation history | Each turn loses context | Use Copilot Studio conversation state |
| Single language | Excludes non-English users | Enable multi-language in Copilot Studio |
| No analytics | Can't measure bot effectiveness | Enable Copilot Analytics dashboard |

### Knowledge Sources
| Source | Connector | Use Case |
|--------|-----------|----------|
| SharePoint | Built-in | Company policies, HR docs |
| Dataverse | Built-in | CRM data, service records |
| Web pages | URL indexer | Product docs, FAQ pages |
| Custom API | Power Automate | Backend systems, ERP |
| Azure AI Search | Custom connector | Large document collections |

## Evaluation Targets
| Metric | Target |
|--------|--------|
| Intent recognition accuracy | >= 90% |
| Resolution without human | >= 65% |
| User satisfaction (CSAT) | >= 4.0/5.0 |
| Avg conversation turns | < 5 |
| Fallback/escalation rate | < 20% |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | Generative answers model, temperature |
| `config/guardrails.json` | content moderation, topic boundaries |
| `config/agents.json` | topic routing, escalation rules |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Design topics, configure connectors, set up authentication |
| `@reviewer` | Audit conversation flows, security, compliance |
| `@tuner` | Optimize topic triggers, knowledge source relevance |

## Slash Commands
`/deploy` — Publish bot | `/test` — Test conversation flows | `/review` — Audit quality | `/evaluate` — Analyze bot metrics
