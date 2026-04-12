# Play 05 — IT Ticket Resolution 🎫

> Auto-classify, route, and resolve IT tickets with event-driven AI.

Incoming tickets hit classification via GPT-4o-mini, the agent routes to the right team or auto-resolves known issues from knowledge base. ServiceNow integration syncs state bidirectionally.

## Quick Start
```bash
cd solution-plays/05-it-ticket-resolution
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .  # Use @builder for classification, @reviewer for SLA audit, @tuner for routing
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure OpenAI (gpt-4o-mini) | Ticket classification + auto-resolution |
| Azure AI Search | Knowledge base for auto-resolve answers |
| Logic Apps / Service Bus | Event-driven ticket processing |
| Key Vault | ITSM API credentials |

## Key Metrics
- Classification accuracy: ≥92% · Auto-resolution: ≥60% · SLA compliance: ≥95%

## DevKit
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (classification/routing), Reviewer (SLA/PII audit), Tuner (thresholds/cost) |
| 3 skills | Deploy (106 lines), Evaluate (109 lines), Tune (104 lines) |

## Cost
| Dev | Prod |
|-----|------|
| $50–150/mo | $800–2K/mo |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/05-it-ticket-resolution](https://frootai.dev/solution-plays/05-it-ticket-resolution)
