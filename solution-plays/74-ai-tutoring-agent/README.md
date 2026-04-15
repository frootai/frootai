# Play 74 — AI Tutoring Agent 🎓

> Socratic AI tutor — adaptive difficulty, knowledge state tracking, misconception detection, personalized learning paths.

Build an intelligent tutoring agent that never gives direct answers. Uses Socratic questioning with 4-step hint progression, tracks student mastery via Bayesian Knowledge Tracing, detects and remediates misconceptions across sessions, and enforces strict content safety for minors.

## Quick Start
```bash
cd solution-plays/74-ai-tutoring-agent
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .
# Use @builder to implement, @reviewer to audit, @tuner to optimize
```

## Architecture

```mermaid
graph TB
    subgraph Learner Interface
        SWA[Static Web Apps<br/>Chat UI · Whiteboard · Progress Dashboard · Parent Portal]
    end

    subgraph Content Safety
        Safety[Azure AI Content Safety<br/>Age-Appropriate Filter · Prompt Shield · Custom Blocklists]
    end

    subgraph Knowledge Base
        Search[Azure AI Search<br/>Curriculum · Textbooks · Worked Examples · Prerequisite Graph]
    end

    subgraph AI Engine
        OpenAI[Azure OpenAI — GPT-4o<br/>Socratic Dialogue · Adaptive Hints · Misconception Detection]
    end

    subgraph Application
        API[Container Apps<br/>Tutoring API · Session Manager · Mastery Tracker · Difficulty Engine]
    end

    subgraph Data Store
        Cosmos[Cosmos DB<br/>Learner Profiles · Mastery Maps · Conversations · Assessments]
    end

    subgraph Security
        KV[Key Vault<br/>OAuth Secrets · Encryption Keys · COPPA Credentials]
        MI[Managed Identity<br/>Zero-secret Auth]
    end

    subgraph Monitoring
        AppInsights[Application Insights<br/>Engagement · Mastery Rates · Hint Effectiveness · Latency]
    end

    SWA -->|Learner Input| API
    API -->|Content Check| Safety
    Safety -->|Approved| API
    API -->|Curriculum Lookup| Search
    Search -->|Content + Examples| API
    API -->|Socratic Prompt| OpenAI
    OpenAI -->|Guided Response| API
    API -->|Response| SWA
    API <-->|Learner State| Cosmos
    API -->|Auth| MI
    MI -->|Secrets| KV
    API -->|Traces| AppInsights

    style SWA fill:#06b6d4,color:#fff,stroke:#0891b2
    style Safety fill:#ef4444,color:#fff,stroke:#dc2626
    style Search fill:#8b5cf6,color:#fff,stroke:#7c3aed
    style OpenAI fill:#10b981,color:#fff,stroke:#059669
    style API fill:#3b82f6,color:#fff,stroke:#2563eb
    style Cosmos fill:#f59e0b,color:#fff,stroke:#d97706
    style KV fill:#f97316,color:#fff,stroke:#ea580c
    style MI fill:#7c3aed,color:#fff,stroke:#6d28d9
    style AppInsights fill:#0ea5e9,color:#fff,stroke:#0284c7
```

📐 [Full architecture details](architecture.md)

## Pre-Tuned Defaults
- Socratic: 4-step hint progression · 3 attempts before explanation · always check understanding
- Difficulty: 5 levels · advance after 3 correct streak · retreat on misconception
- Knowledge: Bayesian tracking · 0.80 mastery threshold · 14-day misconception decay
- Safety: All severity thresholds at 0 (zero tolerance for minors)

## DevKit (AI-Assisted Development)
| Primitive | What It Does |
|-----------|-------------|
| `agent.md` | Root orchestrator with builder→reviewer→tuner handoffs |
| `copilot-instructions.md` | Tutoring domain (Socratic method, misconception handling, difficulty curves) |
| 3 agents | Builder (gpt-4o), Reviewer (gpt-4o-mini), Tuner (gpt-4o-mini) |
| 3 skills | Deploy (175+ lines), Evaluate (120+ lines), Tune (230+ lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` with agent routing |

## Cost Estimate

| Service | Dev | Prod | Enterprise |
|---------|-----|------|------------|
| Azure OpenAI | $30 | $350 | $1,500 |
| Cosmos DB | $3 | $95 | $360 |
| Azure AI Search | $0 | $250 | $500 |
| Static Web Apps | $0 | $9 | $9 |
| Container Apps | $10 | $120 | $350 |
| Azure AI Content Safety | $0 | $40 | $120 |
| Key Vault | $1 | $3 | $10 |
| Application Insights | $0 | $30 | $100 |
| **Total** | **$44** | **$897** | **$2,949** |

💰 [Full cost breakdown](cost.json)

## vs. Play 65 (AI Training Curriculum)
| Aspect | Play 65 | Play 74 |
|--------|---------|---------|
| Focus | Curriculum design + dependency graphs | Real-time Socratic tutoring |
| Interaction | Self-paced modules | Multi-turn adaptive conversation |
| AI Role | Generate learning paths | Guide student reasoning |
| Safety | Standard content safety | Strict (minors-grade, zero tolerance) |

📖 [Full documentation](spec/README.md) · 🌐 [frootai.dev/solution-plays/74-ai-tutoring-agent](https://frootai.dev/solution-plays/74-ai-tutoring-agent) · 📦 [FAI Protocol](spec/fai-manifest.json)
