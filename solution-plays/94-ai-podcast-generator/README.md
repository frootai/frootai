# Play 94 — AI Podcast Generator 🎙️

> AI podcast production — script writing, multi-voice Neural TTS with SSML prosody, audio post-processing, music integration, automated publishing.

Build an AI podcast generator. GPT-4o writes conversational scripts in 4 formats (interview, monologue, debate, panel), Azure Neural TTS synthesizes multiple distinct voices with SSML prosody control, pydub handles post-processing (crossfades, -16 LUFS normalization, intro/outro music), and RSS feeds auto-publish to podcast directories.

## Quick Start
```bash
cd solution-plays/94-ai-podcast-generator
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .
# Use @builder to implement, @reviewer to audit, @tuner to optimize
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure OpenAI (gpt-4o) | Script generation + research (temp 0.7) |
| Azure Speech Service | Multi-voice Neural TTS with SSML |
| Azure Content Safety | Script content moderation |
| Azure AI Search (Basic) | Source material for research grounding |
| Azure Storage + CDN | Audio hosting + delivery |
| Container Apps | Generation API + management dashboard |

## Pre-Tuned Defaults
- Script: 4 formats · 150 words/min · source citations · conversational markers · humor
- Voice: 7 Neural voices · SSML prosody (rate, pitch, express-as) · 800ms speaker pauses
- Audio: -16 LUFS · 320kbps MP3 · 15s intro + 20s outro · crossfade transitions
- Publishing: RSS 2.0 with iTunes tags · SRT transcript · CDN delivery

## DevKit (AI-Assisted Development)
| Primitive | What It Does |
|-----------|-------------|
| `agent.md` | Root orchestrator with builder→reviewer→tuner handoffs |
| `copilot-instructions.md` | Podcast domain (script formats, SSML, TTS voices, audio production) |
| 3 agents | Builder (gpt-4o), Reviewer (gpt-4o-mini), Tuner (gpt-4o-mini) |
| 3 skills | Deploy (215+ lines), Evaluate (110+ lines), Tune (230+ lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` with agent routing |

## Cost Estimate
| Environment | Monthly (4 episodes) |
|-------------|---------|
| Dev/Test | $90–110 |
| Production | $100–150 |

## vs. Play 04 (Call Center Voice AI)
| Aspect | Play 04 | Play 94 |
|--------|---------|---------|
| Focus | Real-time call handling | Batch podcast production |
| Voice | STT + TTS (bidirectional) | TTS only (script → audio) |
| Format | Customer call (reactive) | Multi-format podcast (creative) |
| Processing | Real-time streaming | Batch post-processing + publishing |

📖 [Full documentation](spec/README.md) · 🌐 [frootai.dev/solution-plays/94-ai-podcast-generator](https://frootai.dev/solution-plays/94-ai-podcast-generator) · 📦 [FAI Protocol](spec/fai-manifest.json)
