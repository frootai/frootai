# Play 07 — Multi-Agent Service 🤖

> Supervisor agent routes to specialist agents with shared state and handoff protocol.

A supervisor agent receives requests, classifies intent, and delegates to specialist agents. Each agent has its own model config, tools, and memory. Loop prevention and max-iteration guards keep costs predictable.

## Quick Start
```bash
cd solution-plays/07-multi-agent-service
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .  # Use @builder for topology, @reviewer for loop detection, @tuner for routing
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure OpenAI (gpt-4o + gpt-4o-mini) | Supervisor (4o) + worker agents (4o-mini) |
| Container Apps | Per-agent container hosting |
| Redis Cache | Shared context store for inter-agent state |
| Service Bus | Agent-to-agent message queue |

## Key Metrics
- Task completion: ≥90% · E2E latency: <30s · Cost per task: <$0.50

## DevKit
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (topology/handoffs), Reviewer (loop/conflict audit), Tuner (routing/model selection) |
| 3 skills | Deploy (107 lines), Evaluate (108 lines), Tune (109 lines) |

## Cost
| Dev | Prod |
|-----|------|
| $150–350/mo | $2K–7K/mo |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/07-multi-agent-service](https://frootai.dev/solution-plays/07-multi-agent-service)
