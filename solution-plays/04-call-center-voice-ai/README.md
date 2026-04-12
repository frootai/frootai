# Play 04 — Call Center Voice AI 📞

> Voice-enabled customer service with real-time STT→LLM→TTS streaming.

Build a phone-answering AI agent. Azure Communication Services handles the call, Speech Service converts audio to text, GPT-4o processes intent and generates a response, then TTS speaks it back — all streaming in real time.

## Quick Start
```bash
cd solution-plays/04-call-center-voice-ai
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .  # Use @builder for voice pipeline, @reviewer for latency audit, @tuner for cost
```

## Architecture
| Service | Purpose |
|---------|---------|
| Communication Services | Call handling, WebSocket audio streaming |
| AI Speech (STT + TTS) | Real-time speech recognition + neural voice synthesis |
| Azure OpenAI (gpt-4o) | Intent detection + response generation |
| Content Safety | Filter inappropriate responses |

## Key Metrics
- Intent accuracy: ≥95% · Response latency: <2s · Resolution rate: ≥70%

## DevKit
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (STT/TTS pipelines), Reviewer (latency/compliance), Tuner (response time/cost) |
| 3 skills | Deploy (107 lines), Evaluate (102 lines), Tune (114 lines) |

## Cost
| Dev | Prod |
|-----|------|
| $200–400/mo | $2.5K–10K/mo |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/04-call-center-voice-ai](https://frootai.dev/solution-plays/04-call-center-voice-ai)
