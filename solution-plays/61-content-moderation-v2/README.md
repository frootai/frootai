# Play 61 — Content Moderation V2

Advanced multi-modal content moderation — Azure Content Safety for text+image+video, custom category blocklists, per-category severity thresholds, severity-based routing (auto-block/human-review/flag), Service Bus review queues with SLA-based priority, appeal workflows with different-reviewer requirement, and streaming moderation.

## Architecture

```mermaid
graph TB
    subgraph Content Sources
        UGC[User-Generated Content<br/>Posts · Comments · Messages · Uploads]
        AIOutput[AI-Generated Content<br/>Chatbot Responses · Generated Text · Summaries]
        Media[Media Content<br/>Images · Videos · Profile Photos · Attachments]
    end

    subgraph First-Pass Moderation
        ContentSafety[Azure AI Content Safety<br/>Text · Image · Prompt Shield · Groundedness · Custom Categories]
    end

    subgraph Context-Aware Analysis
        AOAI[Azure OpenAI<br/>Sarcasm · Coded Language · Cultural Context · Nuance]
    end

    subgraph Severity Routing
        ServiceBus[Azure Service Bus<br/>Priority Queues · Topics · Subscriptions · Dead Letter]
        HighQ[Immediate Action Queue<br/>Auto-Remove · Law Enforcement · < 1 min SLA]
        MedQ[Human Review Queue<br/>Moderator Dashboard · 15 min SLA]
        LowQ[Batch Review Queue<br/>Grouped Review · Consistency Checks]
    end

    subgraph Moderation Ops
        CosmosDB[Cosmos DB<br/>Decisions · Violations · Trust Scores · Appeals · Precedents]
        BlobStore[Azure Blob Storage<br/>Evidence · Snapshots · Training Data · Archives]
    end

    subgraph Moderator Interface
        Dashboard[Moderation Dashboard<br/>Review Queue · AI Context · Decision Tools · Analytics]
        Appeals[Appeals Portal<br/>User Appeals · Re-Evaluation · Resolution Tracking]
    end

    subgraph Security
        KV[Key Vault<br/>API Keys · Connection Strings · Signing Keys]
        MI[Managed Identity<br/>Zero-secret Auth]
    end

    subgraph Monitoring
        AppInsights[Application Insights<br/>Latency · Queue Depth · False Rates · Moderator Metrics]
    end

    UGC -->|Submit| ContentSafety
    AIOutput -->|Check| ContentSafety
    Media -->|Analyze| ContentSafety
    ContentSafety -->|Ambiguous| AOAI
    ContentSafety -->|High Severity| ServiceBus
    AOAI -->|Classified| ServiceBus
    ServiceBus -->|Critical| HighQ
    ServiceBus -->|Medium| MedQ
    ServiceBus -->|Low| LowQ
    HighQ -->|Auto-Action| CosmosDB
    MedQ -->|Queue| Dashboard
    LowQ -->|Batch| Dashboard
    Dashboard -->|Decisions| CosmosDB
    ContentSafety -->|Evidence| BlobStore
    CosmosDB -->|History| Dashboard
    Appeals -->|Re-Evaluate| AOAI
    Appeals -->|Records| CosmosDB
    MI -->|Secrets| KV
    ContentSafety -->|Traces| AppInsights

    style UGC fill:#3b82f6,color:#fff,stroke:#2563eb
    style AIOutput fill:#3b82f6,color:#fff,stroke:#2563eb
    style Media fill:#3b82f6,color:#fff,stroke:#2563eb
    style ContentSafety fill:#10b981,color:#fff,stroke:#059669
    style AOAI fill:#10b981,color:#fff,stroke:#059669
    style ServiceBus fill:#f59e0b,color:#fff,stroke:#d97706
    style HighQ fill:#ef4444,color:#fff,stroke:#dc2626
    style MedQ fill:#f59e0b,color:#fff,stroke:#d97706
    style LowQ fill:#0ea5e9,color:#fff,stroke:#0284c7
    style CosmosDB fill:#f59e0b,color:#fff,stroke:#d97706
    style BlobStore fill:#f59e0b,color:#fff,stroke:#d97706
    style Dashboard fill:#3b82f6,color:#fff,stroke:#2563eb
    style Appeals fill:#3b82f6,color:#fff,stroke:#2563eb
    style KV fill:#7c3aed,color:#fff,stroke:#6d28d9
    style MI fill:#7c3aed,color:#fff,stroke:#6d28d9
    style AppInsights fill:#0ea5e9,color:#fff,stroke:#0284c7
```

> Full architecture details: [`architecture.md`](./architecture.md)

## How It Differs from Play 10 (Content Moderation v1)

| Aspect | Play 10 (v1) | **Play 61 (V2)** |
|--------|-------------|-----------------|
| Modalities | Text only | **Text + image + video** |
| Categories | Built-in only | **Built-in + custom blocklists** |
| Routing | Binary (block/allow) | **4-tier: block/review/flag/allow** |
| Review | No human review | **Service Bus queue with SLA per category** |
| Appeals | None | **Full appeal workflow with different reviewer** |
| Thresholds | Global | **Per-category severity thresholds** |
| Explanation | None | **Category + severity + policy reference** |

## Key Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| Precision (violence) | > 95% | Blocked content is actually violent |
| Recall (self-harm) | > 98% | Self-harm content not missed |
| False Positive Rate | < 3% | Safe content incorrectly blocked |
| Text Latency | < 200ms | Real-time text moderation |
| Queue Wait (self-harm) | < 15 min | Critical category SLA |
| Appeal Success Rate | 5-15% | Healthy appeal overturn range |

## Cost Estimate

| Service | Dev | Prod | Enterprise |
|---------|-----|------|------------|
| Azure AI Content Safety | $0 | $200 | $800 |
| Azure OpenAI | $50 | $400 | $1,500 |
| Cosmos DB | $5 | $150 | $600 |
| Azure Service Bus | $5 | $50 | $700 |
| Azure Blob Storage | $3 | $30 | $100 |
| Key Vault | $1 | $5 | $15 |
| Application Insights | $0 | $30 | $100 |
| **Total** | **$64** | **$865** | **$3,815** |

> Detailed breakdown with SKUs and optimization tips: [`cost.json`](./cost.json) · [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/)

## WAF Alignment

| Pillar | Implementation |
|--------|---------------|
| **Responsible AI** | Self-harm lowest thresholds, per-category tuning, cultural context |
| **Security** | Content Safety API, Key Vault, data not stored after moderation |
| **Reliability** | Service Bus for reliable queuing, dead-letter for failed reviews |
| **Cost Optimization** | gpt-4o-mini for explanations, skip LLM for clear cases |
| **Operational Excellence** | SLA-based review routing, appeal audit trail |
| **Performance Efficiency** | <200ms text, parallel multi-modal, video frame sampling |
