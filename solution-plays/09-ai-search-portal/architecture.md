# Architecture — Play 09: AI Search Portal

## Overview

Enterprise search portal with semantic ranking and AI-powered answer summarization. Users search across organizational documents via a modern web UI with faceted navigation, filters, and natural language understanding. Azure AI Search handles hybrid retrieval (keyword + vector + semantic reranking), while GPT-4o generates concise answer summaries from top results.

## Architecture Diagram

```mermaid
graph TB
    subgraph User Layer
        Browser[Browser / SPA]
    end

    subgraph Edge Layer
        FrontDoor[Azure Front Door<br/>CDN + WAF + SSL Offloading]
    end

    subgraph Application Layer
        AppService[App Service<br/>React Frontend + REST API]
        Auth[Managed Identity<br/>Zero-secret auth]
    end

    subgraph AI Layer
        Search[Azure AI Search<br/>Hybrid: BM25 + Vector + Semantic Ranker]
        OpenAI[Azure OpenAI<br/>GPT-4o — Query Rewriting + Summaries]
        Embeddings[Azure OpenAI<br/>text-embedding-3-large]
    end

    subgraph Data Layer
        Blob[Blob Storage<br/>PDFs · Office · HTML · Markdown]
        Indexer[AI Search Indexer<br/>Scheduled Crawl + Change Detection]
        KV[Key Vault<br/>API Keys · Admin Keys]
    end

    subgraph Monitoring
        AppInsights[Application Insights<br/>Search Analytics + Query Metrics]
        LogAnalytics[Log Analytics<br/>KQL · Diagnostics · Alerts]
    end

    Browser -->|HTTPS| FrontDoor
    FrontDoor -->|Route| AppService
    AppService -->|NL Query| OpenAI
    OpenAI -->|Rewritten Query| Search
    Search -->|Top-K Results| OpenAI
    OpenAI -->|Answer Summary| AppService
    AppService -->|Response + Facets| Browser
    AppService -->|Auth| Auth
    Auth -->|Secrets| KV
    Blob -->|Documents| Indexer
    Indexer -->|Index + Vectorize| Search
    Indexer -->|Embeddings| Embeddings
    AppService -->|Telemetry| AppInsights
    Search -->|Diagnostics| LogAnalytics

    style Browser fill:#3b82f6,color:#fff,stroke:#2563eb
    style FrontDoor fill:#7c3aed,color:#fff,stroke:#6d28d9
    style AppService fill:#06b6d4,color:#fff,stroke:#0891b2
    style Auth fill:#7c3aed,color:#fff,stroke:#6d28d9
    style Search fill:#10b981,color:#fff,stroke:#059669
    style OpenAI fill:#10b981,color:#fff,stroke:#059669
    style Embeddings fill:#10b981,color:#fff,stroke:#059669
    style Blob fill:#f59e0b,color:#fff,stroke:#d97706
    style Indexer fill:#f59e0b,color:#fff,stroke:#d97706
    style KV fill:#7c3aed,color:#fff,stroke:#6d28d9
    style AppInsights fill:#0ea5e9,color:#fff,stroke:#0284c7
    style LogAnalytics fill:#0ea5e9,color:#fff,stroke:#0284c7
```

## Data Flow

1. **Ingestion**: Documents uploaded to Blob Storage → AI Search Indexer runs on schedule (or change-detected) → Documents chunked, vectorized via text-embedding-3-large, and indexed with metadata facets
2. **Search**: User types query in portal → GPT-4o rewrites natural language into optimized search query → AI Search performs hybrid retrieval (BM25 + vector + semantic reranking) → Returns top-10 results with facets
3. **Summarization**: Top-5 results passed to GPT-4o → Model generates a concise answer summary with source citations → Summary displayed above document results
4. **Navigation**: Users refine via facets (file type, date, department, author) → Direct search with filters → Results paginated and highlighted with keyword matches
5. **Analytics**: Every query logged — latency, result count, click-through, zero-result rate → Dashboards in Application Insights for search quality improvement

## Service Roles

| Service | Layer | Role |
|---------|-------|------|
| App Service | Compute | React SPA hosting, REST API, Entra ID authentication |
| Azure AI Search | AI | Hybrid index, semantic reranking, faceted navigation |
| Azure OpenAI (GPT-4o) | AI | Query rewriting, answer summarization with citations |
| Azure OpenAI (Embeddings) | AI | Document vectorization during indexing |
| Blob Storage | Data | Source document storage, indexing source |
| AI Search Indexer | Data | Scheduled document crawling, chunking, vectorization |
| Azure Front Door | Networking | Global CDN, WAF protection, SSL offloading |
| Key Vault | Security | Search admin keys, OpenAI API keys |
| Managed Identity | Security | Zero-secret service-to-service authentication |
| Application Insights | Monitoring | Search analytics, query latency, click-through rates |
| Log Analytics | Monitoring | Centralized logging, KQL queries, alerting |

## Security Architecture

- **Entra ID Authentication**: Users sign in via Microsoft Entra ID — SSO with corporate directory
- **Managed Identity**: App Service → AI Search and OpenAI via managed identity — no keys in code
- **Private Endpoints**: AI Search and OpenAI accessible only via VNet in production
- **Azure Front Door WAF**: OWASP rules, rate limiting, bot protection on the portal
- **RBAC on Index**: Search results filtered by user's security group membership

## Scaling

| Metric | Dev | Production | Enterprise |
|--------|-----|-----------|------------|
| Concurrent users | 5-10 | 200-500 | 2,000+ |
| Documents indexed | 5K | 500K | 5M+ |
| Queries/minute | 10 | 200 | 1,000+ |
| App Service instances | 1 | 2-5 | 5-10 |
| Search replicas | 1 | 2 | 3-6 |
| Search partitions | 1 | 1-2 | 3-12 |
