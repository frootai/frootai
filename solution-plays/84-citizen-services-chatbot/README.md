# Play 84 — Citizen Services Chatbot 🏛️

> Government AI chatbot — multi-lingual citizen support, WCAG-compliant, form assistance, permit tracking, complaint routing with human escalation.

Build a government citizen services chatbot. Temperature-zero responses ensure factual accuracy, Azure Translator provides 10+ language support, WCAG 2.2 AA accessibility is built-in, complaint routing classifies and tickets to correct departments, and human escalation is always one click away.

## Quick Start
```bash
cd solution-plays/84-citizen-services-chatbot
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .
# Use @builder to implement, @reviewer to audit, @tuner to optimize
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure OpenAI (gpt-4o, temp=0) | Factual citizen conversation handling |
| Azure AI Search (Standard) | Government knowledge base (services, FAQs, forms) |
| Azure Translator | Multi-lingual support (10+ languages) |
| Azure Content Safety | Content moderation for citizen interactions |
| Azure Bot Service | Omni-channel (web, Teams, WhatsApp) |
| Cosmos DB (Serverless) | Conversation history, complaint tickets |

## Pre-Tuned Defaults
- Language: Grade 8 reading level · 20 max words/sentence · jargon replacement
- Multi-lingual: 10 languages · auto-detect · custom government glossaries
- Privacy: No PII in chat · 30-day retention · no behavioral tracking · AI disclosure
- Routing: 7 departments · confidence 0.80 · escalation after 2 failed attempts

## DevKit (AI-Assisted Development)
| Primitive | What It Does |
|-----------|-------------|
| `agent.md` | Root orchestrator with builder→reviewer→tuner handoffs |
| `copilot-instructions.md` | Government domain (non-partisan, plain language, WCAG, privacy) |
| 3 agents | Builder (gpt-4o), Reviewer (gpt-4o-mini), Tuner (gpt-4o-mini) |
| 3 skills | Deploy (210+ lines), Evaluate (120+ lines), Tune (230+ lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` with agent routing |

## Cost Estimate
| Environment | Monthly |
|-------------|---------|
| Dev/Test | $80–120 |
| Production (5K conversations) | $400–500 |

## vs. Play 08 (Copilot Studio Bot)
| Aspect | Play 08 | Play 84 |
|--------|---------|---------|
| Focus | Enterprise internal bot (M365) | Government citizen-facing bot |
| Language | English (enterprise) | 10+ languages mandatory |
| Privacy | Internal RBAC | GDPR/CCPA, no behavioral tracking |
| Tone | Professional | Plain language (grade 8), non-partisan |
| Escalation | Help desk tickets | Human agent always available |

📖 [Full documentation](spec/README.md) · 🌐 [frootai.dev/solution-plays/84-citizen-services-chatbot](https://frootai.dev/solution-plays/84-citizen-services-chatbot) · 📦 [FAI Protocol](spec/fai-manifest.json)
