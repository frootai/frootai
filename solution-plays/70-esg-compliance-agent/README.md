# Play 70 — ESG Compliance Agent 🌱

> AI ESG compliance — multi-framework scoring (GRI/SASB/CSRD/TCFD), evidence-based assessment, greenwashing detection, double materiality.

Build an ESG compliance agent. Score companies across GRI, SASB, CSRD, and TCFD frameworks, match evidence to requirements using AI Search + LLM evaluation, detect greenwashing with 5 indicator types, assess double materiality per CSRD mandate, and generate gap remediation priorities.

## Quick Start
```bash
cd solution-plays/70-esg-compliance-agent
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .
# Use @builder to implement, @reviewer to audit, @tuner to optimize
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure OpenAI (gpt-4o) | Evidence matching + greenwashing analysis |
| Azure AI Search | Sustainability report retrieval + evidence matching |
| Cosmos DB (Serverless) | Assessment history, framework requirements |
| Container Apps | ESG API + dashboard |

```mermaid
graph TB
    subgraph User Layer
        Analyst[ESG Analyst<br/>Compliance Dashboard · Report Builder · Evidence Portal]
    end

    subgraph Compliance API
        API[Container Apps<br/>Framework Mapper · Gap Analysis · Report Generator]
    end

    subgraph AI Engine
        OpenAI[Azure OpenAI — GPT-4o<br/>Regulatory Interpretation · Gap Analysis · Disclosure Drafting]
        DocIntel[Document Intelligence<br/>ESG Report Extraction · Evidence Processing]
    end

    subgraph Search & Knowledge
        Search[Azure AI Search<br/>Framework Index · Past Disclosures · Regulatory Updates]
    end

    subgraph Data Store
        Cosmos[Cosmos DB<br/>Compliance State · Framework Mappings · Evidence · Audit Trail]
        Blob[Blob Storage<br/>Framework Docs · Evidence Artifacts · Generated Reports]
    end

    subgraph Security
        KV[Key Vault<br/>API Keys · Signing Certs · Encryption Keys]
        MI[Managed Identity<br/>Zero-secret Auth]
    end

    subgraph Monitoring
        AppInsights[Application Insights<br/>Compliance Coverage · Extraction Accuracy · Agent Performance]
    end

    Analyst -->|Request Analysis| API
    API -->|Extract Data| DocIntel
    DocIntel -->|Structured Data| API
    API -->|Search Frameworks| Search
    API -->|Analyze & Draft| OpenAI
    OpenAI -->|Compliance Report| API
    API <-->|Compliance State| Cosmos
    API -->|Store Evidence| Blob
    Blob -->|Indexer| Search
    API -->|Report| Analyst
    API -->|Auth| MI
    MI -->|Secrets| KV
    API -->|Traces| AppInsights

    style Analyst fill:#3b82f6,color:#fff,stroke:#2563eb
    style API fill:#06b6d4,color:#fff,stroke:#0891b2
    style OpenAI fill:#10b981,color:#fff,stroke:#059669
    style DocIntel fill:#10b981,color:#fff,stroke:#059669
    style Search fill:#8b5cf6,color:#fff,stroke:#7c3aed
    style Cosmos fill:#f59e0b,color:#fff,stroke:#d97706
    style Blob fill:#f59e0b,color:#fff,stroke:#d97706
    style KV fill:#7c3aed,color:#fff,stroke:#6d28d9
    style MI fill:#7c3aed,color:#fff,stroke:#6d28d9
    style AppInsights fill:#0ea5e9,color:#fff,stroke:#0284c7
```

📐 [Full architecture details](architecture.md)

## Pre-Tuned Defaults
- Frameworks: CSRD + GRI + TCFD active · SASB optional · double materiality enabled
- Evidence: 0.7 confidence threshold · 12-month staleness limit · cross-reference optional
- Greenwashing: Medium sensitivity · 5 indicator types · quantification required
- Scoring: Mandatory 2.0× weight · A/B/C/D/F grade scale

## DevKit (AI-Assisted Development)
| Primitive | What It Does |
|-----------|-------------|
| `agent.md` | Root orchestrator with builder→reviewer→tuner handoffs |
| `copilot-instructions.md` | ESG domain (CSRD/GRI/SASB/TCFD, greenwashing, double materiality) |
| 3 agents | Builder (gpt-4o), Reviewer (gpt-4o-mini), Tuner (gpt-4o-mini) |
| 3 skills | Deploy (260 lines), Evaluate (113 lines), Tune (221 lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` with agent routing |

## Cost Estimate

| Service | Dev | Prod | Enterprise |
|---------|-----|------|------------|
| Azure OpenAI | $30 | $250 | $900 |
| Document Intelligence | $0 | $50 | $200 |
| Cosmos DB | $3 | $50 | $180 |
| Azure AI Search | $0 | $250 | $500 |
| Container Apps | $10 | $80 | $220 |
| Blob Storage | $2 | $20 | $60 |
| Key Vault | $1 | $3 | $10 |
| Application Insights | $0 | $20 | $70 |
| **Total** | **$46/mo** | **$723/mo** | **$2,140/mo** |

> Estimates based on Azure retail pricing. Actual costs vary by region, usage, and enterprise agreements.

💰 [Full cost breakdown](cost.json)

📖 [Full documentation](spec/README.md) · 🌐 [frootai.dev/solution-plays/70-esg-compliance-agent](https://frootai.dev/solution-plays/70-esg-compliance-agent) · 📦 [FAI Protocol](spec/fai-manifest.json)
