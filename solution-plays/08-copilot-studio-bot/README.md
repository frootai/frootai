# Play 08 — Copilot Studio Bot 💬

> Low-code enterprise bot with Copilot Studio, knowledge grounding, and Dataverse.

Build an enterprise chatbot without writing code. Copilot Studio provides the canvas, SharePoint and Dataverse supply the knowledge, AI Search grounds the answers. Deploys to Teams, web, and mobile.

## Quick Start
```bash
cd solution-plays/08-copilot-studio-bot
code .  # Use @builder for topics/flows, @reviewer for conversation audit, @tuner for triggers
# Navigate to copilotstudio.microsoft.com to create and publish
```

## Architecture
| Service | Purpose |
|---------|---------|
| Copilot Studio | Low-code bot canvas with topic design |
| SharePoint / Dataverse | Knowledge sources for grounded answers |
| AI Search | Semantic search across knowledge base |
| Power Platform | Actions and connectors |

## Key Metrics
- Topic trigger accuracy: ≥90% · Resolution rate: ≥65% · CSAT: ≥4.0/5.0

## DevKit
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (topics/auth), Reviewer (flow/security audit), Tuner (triggers/knowledge) |
| 3 skills | Deploy (100 lines), Evaluate (106 lines), Tune (101 lines) |

## Cost
| Dev | Prod |
|-----|------|
| $30–80/mo | $200–1K/mo |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/08-copilot-studio-bot](https://frootai.dev/solution-plays/08-copilot-studio-bot)
