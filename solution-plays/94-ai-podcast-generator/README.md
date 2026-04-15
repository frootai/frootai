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

```mermaid
graph TB
    subgraph Content Sources
        Articles[Text Content<br/>Articles · Blog Posts · Research Papers · Newsletters · Transcripts]
    end

    subgraph Script Generation
        OpenAI[Azure OpenAI — GPT-4o<br/>Dialogue Writing · Speaker Personas · Banter · Transitions · Show Notes]
    end

    subgraph Voice Synthesis
        Speech[Azure AI Speech<br/>Neural Voices · SSML Prosody · Emotion · Pronunciation · 48kHz Output]
    end

    subgraph Production Pipeline
        Func[Azure Functions<br/>Ingestion · Script Orchestration · Audio Mixing · Normalization · RSS Generation]
    end

    subgraph Asset Storage
        Blob[Blob Storage<br/>Episodes (WAV/MP3/AAC) · Transitions · Jingles · Voice Profiles · Mastered Audio]
    end

    subgraph Distribution
        CDN[Azure CDN<br/>Global POPs · RSS Caching · Download Acceleration · Streaming Delivery]
    end

    subgraph Security
        KV[Key Vault<br/>Speech Keys · OpenAI Creds · CDN Secrets · Platform Tokens]
        MI[Managed Identity<br/>Zero-secret Auth]
    end

    subgraph Monitoring
        AppInsights[Application Insights<br/>Generation Latency · Synthesis Quality · Pipeline Throughput · Download Analytics]
    end

    Articles -->|Raw Content| Func
    Func -->|Generate Script| OpenAI
    OpenAI -->|Multi-Speaker Script| Func
    Func -->|Synthesize Voices| Speech
    Speech -->|Audio Segments| Func
    Func -->|Mixed Episodes| Blob
    Blob -->|Published Episodes| CDN
    CDN -->|Podcast Feed| Articles
    Func -->|Auth| MI
    MI -->|Secrets| KV
    Func -->|Traces| AppInsights

    style Articles fill:#6366f1,color:#fff,stroke:#4f46e5
    style OpenAI fill:#10b981,color:#fff,stroke:#059669
    style Speech fill:#ec4899,color:#fff,stroke:#db2777
    style Func fill:#14b8a6,color:#fff,stroke:#0d9488
    style Blob fill:#f59e0b,color:#fff,stroke:#d97706
    style CDN fill:#3b82f6,color:#fff,stroke:#2563eb
    style KV fill:#f97316,color:#fff,stroke:#ea580c
    style MI fill:#7c3aed,color:#fff,stroke:#6d28d9
    style AppInsights fill:#0ea5e9,color:#fff,stroke:#0284c7
```

📐 [Full architecture details](architecture.md)

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
| Service | Dev/mo | Prod/mo | Enterprise/mo |
|---------|--------|---------|---------------|
| Azure AI Speech | $5 (Free tier) | $250 (Standard Neural) | $800 (Custom Neural Voice) |
| Azure OpenAI | $20 (PAYG) | $280 (PAYG) | $1,000 (PTU Reserved) |
| Blob Storage | $2 (Hot LRS) | $40 (Hot LRS) | $150 (Hot GRS) |
| Azure CDN | $5 (Standard Microsoft) | $120 (Standard Verizon) | $400 (Premium Verizon) |
| Azure Functions | $0 (Consumption) | $180 (Premium EP2) | $450 (Premium EP3) |
| Key Vault | $1 (Standard) | $5 (Standard) | $10 (Standard) |
| Application Insights | $0 (Free) | $25 (Pay-per-GB) | $80 (Pay-per-GB) |
| **Total** | **$33** | **$900** | **$2,890** |

💰 [Full cost breakdown](cost.json)

## vs. Play 04 (Call Center Voice AI)
| Aspect | Play 04 | Play 94 |
|--------|---------|---------|
| Focus | Real-time call handling | Batch podcast production |
| Voice | STT + TTS (bidirectional) | TTS only (script → audio) |
| Format | Customer call (reactive) | Multi-format podcast (creative) |
| Processing | Real-time streaming | Batch post-processing + publishing |

📖 [Full documentation](spec/README.md) · 🌐 [frootai.dev/solution-plays/94-ai-podcast-generator](https://frootai.dev/solution-plays/94-ai-podcast-generator) · 📦 [FAI Protocol](spec/fai-manifest.json)
