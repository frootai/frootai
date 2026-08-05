# Architecture — Play 01: Enterprise RAG Q&A

## Overview

Production-grade Retrieval-Augmented Generation pipeline. Users ask questions, the system retrieves relevant documents via hybrid search (keyword + vector + semantic reranking), then generates grounded answers with citations using GPT-4o.

## Architecture Diagram

```mermaid
graph TB
    subgraph User Layer
        User[User / Client App]
    end

    subgraph Application Layer
        API[Container Apps<br/>REST API + Streaming]
        Auth[Managed Identity<br/>Zero-secret auth]
    end

    subgraph AI Layer
        Search[Azure AI Search<br/>Hybrid: BM25 + Vector + Semantic]
        OpenAI[Azure OpenAI<br/>GPT-4o — Answer Gen + Citations]
        Safety[Content Safety<br/>Hate · Violence · Self-harm · Sexual]
    end

    subgraph Data Layer
        Blob[Blob Storage<br/>PDFs · Word · HTML · Markdown]
        KV[Key Vault<br/>API Keys · Connection Strings]
    end

    subgraph Monitoring
        AppInsights[Application Insights<br/>Latency · Token Usage · Errors]
        LogAnalytics[Log Analytics<br/>KQL Queries · Alerts]
    end

    User -->|HTTPS| API
    API -->|Query| Search
    Search -->|Top-K Results| OpenAI
    OpenAI -->|Grounded Answer| API
    API -->|Response + Citations| User
    API -->|Auth| Auth
    Auth -->|Secrets| KV
    Blob -->|Indexer| Search
    OpenAI -->|Moderation| Safety
    API -->|Telemetry| AppInsights
    API -->|Logs| LogAnalytics

    style User fill:#3b82f6,color:#fff,stroke:#2563eb
    style API fill:#06b6d4,color:#fff,stroke:#0891b2
    style Search fill:#10b981,color:#fff,stroke:#059669
    style OpenAI fill:#10b981,color:#fff,stroke:#059669
    style Safety fill:#10b981,color:#fff,stroke:#059669
    style Blob fill:#f59e0b,color:#fff,stroke:#d97706
    style KV fill:#7c3aed,color:#fff,stroke:#6d28d9
    style Auth fill:#7c3aed,color:#fff,stroke:#6d28d9
    style AppInsights fill:#0ea5e9,color:#fff,stroke:#0284c7
    style LogAnalytics fill:#0ea5e9,color:#fff,stroke:#0284c7
```

## Data Flow

1. **Ingestion**: Documents (PDF, Word, HTML) uploaded to Blob Storage → AI Search Indexer processes and chunks them (512 tokens, semantic chunking, 10% overlap) → Vector embeddings generated via text-embedding-3-large
2. **Query**: User sends question → Container Apps API receives request → AI Search performs hybrid retrieval (BM25 keyword + vector similarity + semantic reranking) → Returns top-5 relevant chunks
3. **Generation**: Top-5 chunks passed as context to GPT-4o → Model generates answer grounded in the retrieved documents → Citations extracted and linked to source documents
4. **Safety**: Response passes through Content Safety filter → Blocks hate, violence, self-harm, sexual content → Response returned to user with citations
5. **Monitoring**: Every request logged to Application Insights (latency, token count, search score) → Log Analytics for KQL queries and alerting

## Service Roles

| Service | Layer | Role |
|---------|-------|------|
| Container Apps | Compute | API hosting, auto-scaling, HTTPS ingress |
| Azure AI Search | AI | Hybrid search index, semantic reranking |
| Azure OpenAI (GPT-4o) | AI | Answer generation with citation grounding |
| Content Safety | AI | Response moderation, category filtering |
| Blob Storage | Data | Document storage, indexing source |
| Key Vault | Security | API keys, connection strings, managed identity |
| Managed Identity | Security | Zero-secret service-to-service auth |
| Application Insights | Monitoring | APM, distributed tracing, custom AI metrics |
| Log Analytics | Monitoring | Centralized logging, KQL, alert rules |

## Security Architecture

- **Managed Identity**: All service-to-service auth — no connection strings in code
- **Key Vault**: API keys rotated automatically, referenced via `@Microsoft.KeyVault()`
- **Private Endpoints**: AI Search and OpenAI accessible only via VNet (production)
- **Content Safety**: All AI responses filtered before reaching users
- **RBAC**: Least-privilege roles per service principal

## Scaling

| Metric | Dev | Production | Enterprise |
|--------|-----|-----------|------------|
| Concurrent users | 5-10 | 100-500 | 1,000+ |
| Documents indexed | 1K | 100K | 1M+ |
| Requests/minute | 10 | 100 | 500+ |
| Container replicas | 1 | 2-5 | 5-20 |
| Search replicas | 1 | 2 | 3-6 |
