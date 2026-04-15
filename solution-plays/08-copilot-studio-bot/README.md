# Play 08 — Copilot Studio Bot 💬

> Low-code enterprise bot with Copilot Studio, knowledge grounding, and Dataverse.

Build an enterprise chatbot without writing code. Copilot Studio provides the canvas, SharePoint and Dataverse supply the knowledge, AI Search grounds the answers. Deploys to Teams, web, and mobile.

## Quick Start
```bash
cd solution-plays/08-copilot-studio-bot
code .  # Use @builder for topics/flows, @reviewer for conversation audit, @tuner for triggers
# Navigate to copilotstudio.microsoft.com to create and publish
```

## Key Metrics
- Topic trigger accuracy: ≥90% · Resolution rate: ≥65% · CSAT: ≥4.0/5.0

## DevKit
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (topics/auth), Reviewer (flow/security audit), Tuner (triggers/knowledge) |
| 3 skills | Deploy (100 lines), Evaluate (106 lines), Tune (101 lines) |

## Architecture

```mermaid
graph TB
    subgraph User Channels
        Teams[Microsoft Teams]
        Web[Web Chat Widget]
        M365[Microsoft 365 Copilot]
    end

    subgraph Bot Platform
        CS[Copilot Studio<br/>Topic management]
        GEN[Generative AI<br/>Fallback answers]
    end

    subgraph Knowledge
        SP[SharePoint Online<br/>Document libraries]
        DV[Dataverse<br/>Structured data]
    end

    subgraph Automation
        PA[Power Automate<br/>Workflow actions]
    end

    subgraph Monitoring
        AI_INS[Application Insights<br/>Bot analytics]
    end

    Teams -->|message| CS
    Web -->|message| CS
    M365 -->|message| CS
    CS -->|search| SP
    CS -->|query| DV
    CS -->|unmatched| GEN
    GEN -->|grounded answer| CS
    CS -->|trigger| PA
    CS -->|telemetry| AI_INS

    style Teams fill:#3b82f6,color:#fff
    style Web fill:#3b82f6,color:#fff
    style M365 fill:#3b82f6,color:#fff
    style CS fill:#10b981,color:#fff
    style GEN fill:#10b981,color:#fff
    style SP fill:#f59e0b,color:#fff
    style DV fill:#f59e0b,color:#fff
    style PA fill:#3b82f6,color:#fff
    style AI_INS fill:#0ea5e9,color:#fff
```

> 📐 [Full architecture details](architecture.md) — data flow, security architecture, scaling guide

## Cost Estimate

| Service | Dev/PoC | Production | Enterprise |
|---------|---------|-----------|------------|
| Copilot Studio | $0 (Trial) | $200 (Standard) | $800 (Standard + Packs) |
| Dataverse | $0 (Included) | $40 (Additional) | $120 (Enterprise) |
| SharePoint Online | $0 (M365 Included) | $0 (M365 Included) | $30 (Advanced Mgmt) |
| Power Automate | $0 (Included) | $100 (Per-flow) | $300 (Per-user) |
| Azure OpenAI (via CS) | $0 (Included) | $0 (Included) | $200 (BYOA) |
| Application Insights | $0 (Free) | $15 (Pay-per-GB) | $50 (Pay-per-GB) |
| Key Vault | $1 (Standard) | $2 (Standard) | $10 (Premium HSM) |
| **Total** | **$1/mo** | **$357/mo** | **$1,510/mo** |

> 💰 [Full cost breakdown](cost.json) — per-service SKUs, usage assumptions, optimization tips

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/08-copilot-studio-bot](https://frootai.dev/solution-plays/08-copilot-studio-bot)
