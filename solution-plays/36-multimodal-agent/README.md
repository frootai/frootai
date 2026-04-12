# Play 36 — Multimodal Agent 🎨🎤📝

> Unified agent that processes text + images + audio with cross-modal synthesis.

A general-purpose multimodal AI agent that handles any combination of text, images, and audio input. GPT-4o vision analyzes images, Azure Speech transcribes audio, and the agent synthesizes information across modalities to produce coherent responses. Content safety covers all input and output modalities.

## Quick Start
```bash
cd solution-plays/36-multimodal-agent
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .  # Use @builder for multimodal pipeline, @reviewer for safety audit, @tuner for cost
```

## How It Differs from Play 15 (DocProc)
| Aspect | Play 15 (DocProc) | Play 36 (Multimodal Agent) |
|--------|------------------|--------------------------|
| Focus | Document processing | Any modality combination |
| Input | PDFs/images (documents) | Text + images + audio + video |
| Output | Structured JSON extraction | Conversational responses |
| Agent type | Batch pipeline | Interactive conversational |

## Architecture
| Service | Purpose |
|---------|---------|
| Azure OpenAI (gpt-4o) | Vision analysis, text generation, cross-modal |
| Azure Speech Service | Audio transcription (STT) + voice output (TTS) |
| Content Safety | Per-modality content filtering |
| Container Apps | Multimodal agent runtime |

## Key Metrics
- Image accuracy: ≥85% · Audio WER: <10% · Cross-modal: ≥80% · Safety: 100%

## DevKit (Multimodal-Focused)
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (modality routing/vision/synthesis), Reviewer (safety across modalities), Tuner (detail level/parallel/cost) |
| 3 skills | Deploy (103 lines), Evaluate (104 lines), Tune (107 lines) |
| 4 prompts | `/deploy` (multimodal pipeline), `/test` (cross-modal), `/review` (per-modality safety), `/evaluate` (accuracy) |

## Cost Per Request
| Input | Cost |
|-------|------|
| Text only | ~$0.005 |
| Image + text | ~$0.008-0.015 |
| Audio + text | ~$0.01 |
| All modalities | ~$0.023 |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/36-multimodal-agent](https://frootai.dev/solution-plays/36-multimodal-agent)
