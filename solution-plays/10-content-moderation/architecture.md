# Architecture — Play 10: Content Moderation

## Overview

AI-powered content moderation pipeline using Azure AI Content Safety. Incoming user-generated content (text, images) is submitted via API Management, queued for processing, analyzed by Content Safety for severity scoring across categories (hate, violence, self-harm, sexual), checked against custom blocklists, and routed through configurable action policies (allow, flag, block, escalate). All decisions are audited in Cosmos DB for compliance.

## Architecture Diagram

```mermaid
graph TB
    subgraph Client Layer
        App[Client Application<br/>Web · Mobile · API]
    end

    subgraph API Gateway
        APIM[API Management<br/>Rate Limiting + Auth + Routing]
    end

    subgraph Processing Pipeline
        Queue[Service Bus<br/>Moderation Queue + Dead Letter]
        Func[Azure Functions<br/>Pre-process + Route + Post-process]
    end

    subgraph AI Layer
        ContentSafety[Content Safety<br/>Hate · Violence · Self-harm · Sexual]
        PromptShield[Prompt Shields<br/>Jailbreak + Injection Detection]
        Blocklist[Custom Blocklists<br/>Domain-specific Blocked Terms]
    end

    subgraph Data Layer
        Cosmos[Cosmos DB<br/>Audit Trail + Severity Scores]
        KV[Key Vault<br/>API Keys · Certificates]
    end

    subgraph Monitoring
        AppInsights[Application Insights<br/>Block Rates + Latency + Categories]
        LogAnalytics[Log Analytics<br/>Compliance Audit · KQL · Alerts]
    end

    App -->|Submit Content| APIM
    APIM -->|Enqueue| Queue
    Queue -->|Trigger| Func
    Func -->|Analyze Text/Image| ContentSafety
    Func -->|Check Prompts| PromptShield
    Func -->|Check Terms| Blocklist
    ContentSafety -->|Severity Scores| Func
    Func -->|Store Decision| Cosmos
    Func -->|Result Callback| App
    APIM -->|Auth| KV
    Func -->|Telemetry| AppInsights
    Func -->|Audit Logs| LogAnalytics

    style App fill:#3b82f6,color:#fff,stroke:#2563eb
    style APIM fill:#06b6d4,color:#fff,stroke:#0891b2
    style Queue fill:#f59e0b,color:#fff,stroke:#d97706
    style Func fill:#06b6d4,color:#fff,stroke:#0891b2
    style ContentSafety fill:#10b981,color:#fff,stroke:#059669
    style PromptShield fill:#10b981,color:#fff,stroke:#059669
    style Blocklist fill:#10b981,color:#fff,stroke:#059669
    style Cosmos fill:#f59e0b,color:#fff,stroke:#d97706
    style KV fill:#7c3aed,color:#fff,stroke:#6d28d9
    style AppInsights fill:#0ea5e9,color:#fff,stroke:#0284c7
    style LogAnalytics fill:#0ea5e9,color:#fff,stroke:#0284c7
```

## Data Flow

1. **Submission**: Client app submits content (text or image) via API Management → Rate limiting and API key authentication applied → Content enqueued to Service Bus moderation queue
2. **Pre-processing**: Azure Function triggered by queue message → Content normalized (encoding, length truncation) → Custom blocklist fast-check for known-bad terms
3. **Analysis**: Content Safety API called for multi-category severity scoring (0-6 scale) → Prompt Shields check for jailbreak and injection patterns → Scores aggregated across all checks
4. **Decision**: Action policy applied based on severity thresholds — Allow (score 0-1), Flag for review (score 2-3), Block (score 4+), Escalate (score 6) → Decision recorded in Cosmos DB with full audit trail
5. **Response**: Result callback sent to client app (allow/block/flag status) → Blocked content returns generic safe message → Flagged content queued for human review

## Service Roles

| Service | Layer | Role |
|---------|-------|------|
| API Management | Gateway | Rate limiting, authentication, request routing |
| Service Bus | Messaging | Async moderation queue, dead-letter for failures |
| Azure Functions | Compute | Moderation pipeline orchestration, policy engine |
| Content Safety | AI | Multi-category content analysis, severity scoring |
| Prompt Shields | AI | Jailbreak detection, prompt injection defense |
| Custom Blocklists | AI | Domain-specific term blocking, fast-reject path |
| Cosmos DB | Data | Audit trail, moderation decisions, appeal records |
| Key Vault | Security | API keys, certificates, managed identity |
| Application Insights | Monitoring | Moderation metrics, latency, category distribution |
| Log Analytics | Monitoring | Compliance audit logging, KQL queries, alerts |

## Security Architecture

- **API Management**: API key + OAuth2 authentication, per-client rate limiting
- **Managed Identity**: Functions → Content Safety and Cosmos DB via managed identity
- **Key Vault**: All secrets and certificates stored securely, auto-rotated
- **Data Privacy**: Raw content TTL'd in Cosmos DB (30 days), only metadata retained long-term
- **Compliance Logging**: Every moderation decision logged immutably in Log Analytics
- **VNet Integration**: Functions and Cosmos DB behind private endpoints (enterprise)

## Scaling

| Metric | Dev | Production | Enterprise |
|--------|-----|-----------|------------|
| Content items/minute | 10 | 500 | 5,000+ |
| Concurrent moderations | 5 | 50 | 200+ |
| Avg latency per item | <2s | <1s | <500ms |
| Function instances | 1 | 5-20 | 20-100 |
| Cosmos DB RU/s | Serverless | 400 | 2,000+ |
| Service Bus throughput | Basic | Standard | Premium |
