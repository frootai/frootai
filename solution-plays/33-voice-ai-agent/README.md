# Play 33 — Voice AI Agent 🎙️

> Autonomous voice agent with dialog state, multi-turn conversations, and proactive actions.

An AI voice agent that goes beyond Play 04's inbound call handling. Dialog state machine manages multi-turn conversations, intent detection with entity extraction enables complex requests, and proactive actions let the agent initiate (reminders, follow-ups, notifications) — not just respond.

## Quick Start
```bash
cd solution-plays/33-voice-ai-agent
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .  # Use @builder for dialog/voice, @reviewer for compliance audit, @tuner for prosody/speed
```

## How It Differs from Play 04 (Call Center)
| Aspect | Play 04 (Call Center) | Play 33 (Voice Agent) |
|--------|----------------------|----------------------|
| Mode | Inbound phone calls | Any interface (phone, web, IoT) |
| Conversation | Single-intent | Multi-turn stateful dialog |
| State | Stateless per call | Persistent state machine |
| Actions | Respond + escalate | Proactive (initiate tasks) |
| Memory | Current call only | Remembers past interactions |

## Architecture
| Service | Purpose |
|---------|---------|
| Azure Speech (STT + TTS) | Voice recognition + neural voice synthesis |
| Azure OpenAI (gpt-4o + mini) | Dialog intelligence + intent classification |
| Cosmos DB | Dialog state persistence across sessions |
| Container Apps | Voice agent runtime |

## Key Metrics
- Intent accuracy: ≥92% · Dialog completion: ≥80% · Latency: <2s · Voice MOS: ≥4.0/5.0

## DevKit (Voice Agent-Focused)
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (dialog state/intent/voice loop), Reviewer (compliance/latency/UX), Tuner (prosody/flow/cost) |
| 3 skills | Deploy (109 lines), Evaluate (107 lines), Tune (106 lines) |
| 4 prompts | `/deploy` (dialog + voice), `/test` (interaction loop), `/review` (compliance), `/evaluate` (intent/quality) |

## Cost
| Conversation Length | Cost |
|---------------------|------|
| Short (3 turns) | ~$0.016 |
| Medium (8 turns) | ~$0.045 |
| Long (15 turns) | ~$0.088 |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/33-voice-ai-agent](https://frootai.dev/solution-plays/33-voice-ai-agent)
