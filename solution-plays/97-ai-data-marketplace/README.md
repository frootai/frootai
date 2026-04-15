# Play 97 — AI Data Marketplace 📊

> Data commerce platform — dataset discovery with quality scoring, privacy-preserving sharing, synthetic data augmentation, license management, lineage tracking.

Build an AI data marketplace. 5-dimension quality scoring (completeness, consistency, accuracy, timeliness, uniqueness) grades every dataset, PII scanning + k-anonymity + differential privacy enable privacy-preserving sharing, Gaussian Copula generates synthetic data with verified zero real-record overlap, and Azure Purview tracks full data lineage.

## Quick Start
```bash
cd solution-plays/97-ai-data-marketplace
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .
# Use @builder to implement, @reviewer to audit, @tuner to optimize
```

## Architecture

```mermaid
graph TB
    subgraph Publishers
        Pub[Data Publishers<br/>Upload · Schema · Pricing · Privacy Config]
    end

    subgraph Consumers
        Con[Data Consumers<br/>Browse · Purchase · Download · Integrate]
    end

    subgraph API Gateway
        APIM[API Management<br/>Discovery · Purchase · Metering · Developer Portal · Rate Limits]
    end

    subgraph Privacy Engine
        AML[Azure Machine Learning<br/>DP Synthesis · Anonymization · Quality Scoring · Privacy Budget]
    end

    subgraph Dataset Repository
        Blob[Blob Storage<br/>Raw · Anonymized · Synthetic · Previews · Versioned Snapshots]
    end

    subgraph Catalog & State
        Cosmos[Cosmos DB<br/>Metadata · Publishers · Subscriptions · Transactions · Reviews]
    end

    subgraph Workflow Engine
        Func[Azure Functions<br/>Ingestion · Fulfillment · Metering · Notifications · Scheduling]
    end

    subgraph Security
        KV[Key Vault<br/>Dataset Keys · SAS Signing · Publisher Creds · Payment Secrets]
        MI[Managed Identity<br/>Zero-secret Auth]
    end

    subgraph Monitoring
        AppInsights[Application Insights<br/>API Latency · Downloads · Pipeline Duration · Conversions]
    end

    Pub -->|Upload Datasets| APIM
    Con -->|Browse & Purchase| APIM
    APIM -->|Catalog Queries| Cosmos
    APIM -->|Trigger Pipelines| Func
    Func -->|Orchestrate| AML
    AML -->|Read Raw| Blob
    AML -->|Write Anonymized| Blob
    Func -->|Generate SAS Tokens| Blob
    Con -->|Download| Blob
    Func -->|Update State| Cosmos
    Func -->|Auth| MI
    MI -->|Secrets| KV
    APIM -->|Traces| AppInsights
    AML -->|Pipeline Metrics| AppInsights

    style Pub fill:#8b5cf6,color:#fff,stroke:#7c3aed
    style Con fill:#06b6d4,color:#fff,stroke:#0891b2
    style APIM fill:#f59e0b,color:#fff,stroke:#d97706
    style AML fill:#10b981,color:#fff,stroke:#059669
    style Blob fill:#3b82f6,color:#fff,stroke:#2563eb
    style Cosmos fill:#f97316,color:#fff,stroke:#ea580c
    style Func fill:#14b8a6,color:#fff,stroke:#0d9488
    style KV fill:#ec4899,color:#fff,stroke:#db2777
    style MI fill:#7c3aed,color:#fff,stroke:#6d28d9
    style AppInsights fill:#0ea5e9,color:#fff,stroke:#0284c7
```

📐 [Full architecture details](architecture.md)

| Service | Purpose |
|---------|---------|
| Azure OpenAI (gpt-4o) | Dataset description + semantic search |
| Azure AI Search (Standard) | Dataset catalog with vector + semantic search |
| Azure Purview | Data lineage tracking + governance |
| Cosmos DB (Serverless) | Listings, transactions, reviews |
| Azure Storage | Dataset files, samples, synthetic outputs |
| Azure Functions | Quality scoring + privacy scanning |

## Pre-Tuned Defaults
- Quality: 5 dimensions · weighted composite · auto-delist below 40 · weekly refresh
- Privacy: Presidio PII scan · k=5 anonymity · Gaussian Copula synthetic · ε=1.0 differential privacy
- Search: Vector + semantic · facets (category, privacy, license) · quality + freshness boost
- Licensing: 5 license types · attribution tracking · usage limits · 80/20 revenue split

## DevKit (AI-Assisted Development)
| Primitive | What It Does |
|-----------|-------------|
| `agent.md` | Root orchestrator with builder→reviewer→tuner handoffs |
| `copilot-instructions.md` | Data marketplace domain (quality, privacy, synthetic, lineage) |
| 3 agents | Builder (gpt-4o), Reviewer (gpt-4o-mini), Tuner (gpt-4o-mini) |
| 3 skills | Deploy (225+ lines), Evaluate (110+ lines), Tune (225+ lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` with agent routing |

## Cost Estimate
| Service | Dev/mo | Prod/mo | Enterprise/mo |
|---------|--------|---------|---------------|
| Azure Machine Learning | $0 (Basic) | $450 (Standard) | $1,400 (Standard HA) |
| Azure Blob Storage | $5 (LRS Hot) | $120 (ZRS Hot + Cool) | $400 (GRS Hot + Cool + Archive) |
| Azure API Management | $5 (Consumption) | $700 (Standard) | $2,800 (Premium) |
| Azure Cosmos DB | $5 (Serverless) | $230 (4000 RU/s) | $700 (12000 RU/s) |
| Azure Functions | $0 (Consumption) | $200 (Premium EP2) | $500 (Premium EP3) |
| Key Vault | $1 (Standard) | $5 (Standard) | $20 (Premium HSM) |
| Application Insights | $0 (Free) | $40 (Pay-per-GB) | $120 (Pay-per-GB) |
| **Total** | **$16** | **$1,745** | **$5,940** |

💰 [Full cost breakdown](cost.json)

## vs. Play 62 (Federated Learning Pipeline)
| Aspect | Play 62 | Play 97 |
|--------|---------|---------|
| Focus | Train models without sharing data | Share/sell datasets with privacy |
| Privacy | Federated (data stays local) | Anonymize/synthesize before sharing |
| Output | Trained model | Quality-scored dataset listing |
| Governance | Differential privacy on gradients | PII scanning + lineage tracking |

📖 [Full documentation](spec/README.md) · 🌐 [frootai.dev/solution-plays/97-ai-data-marketplace](https://frootai.dev/solution-plays/97-ai-data-marketplace) · 📦 [FAI Protocol](spec/fai-manifest.json)
