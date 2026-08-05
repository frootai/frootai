# Architecture — Play 06: Document Intelligence

## Overview

The Document Intelligence architecture provides an end-to-end pipeline for extracting, classifying, and structuring data from unstructured documents. Azure Document Intelligence handles OCR and layout analysis, while Azure OpenAI enriches extractions with entity recognition, summarization, and classification. An event-driven pipeline automatically processes documents as they arrive in Blob Storage, storing structured results in Cosmos DB for downstream consumption.

## Architecture Diagram

```mermaid
graph TB
    subgraph Ingest["Document Intake"]
        UPLOAD[Upload Portal<br/>Web / API / SFTP]
        BLOB[Blob Storage<br/>Document landing zone]
        EG[Event Grid<br/>Upload trigger]
    end

    subgraph Processing["Document Processing Pipeline"]
        ORCH[Container Apps<br/>Pipeline orchestrator]
        DI[Document Intelligence<br/>OCR + layout + tables]
        AOAI[Azure OpenAI<br/>Enrichment + classification]
    end

    subgraph Enrichment["AI Enrichment"]
        ENTITY[Entity Extraction<br/>Names, dates, amounts]
        CLASSIFY[Document Classifier<br/>Invoice, contract, form]
        SUMMARY[Summarizer<br/>Key points extraction]
    end

    subgraph Output["Structured Output"]
        COSMOS[Cosmos DB<br/>Extracted metadata]
        OUTBLOB[Blob Storage<br/>Processed output]
        INDEX[Search Index<br/>Full-text search]
    end

    subgraph Security["Security"]
        KV[Key Vault<br/>API keys & secrets]
        MI[Managed Identity<br/>Service auth]
    end

    subgraph Monitoring["Observability"]
        AI_INS[Application Insights<br/>Pipeline metrics]
        LA[Log Analytics<br/>Processing audit]
    end

    UPLOAD -->|documents| BLOB
    BLOB -->|new blob event| EG
    EG -->|trigger| ORCH
    ORCH -->|analyze| DI
    DI -->|raw extraction| ORCH
    ORCH -->|enrich| AOAI
    AOAI --> ENTITY
    AOAI --> CLASSIFY
    AOAI --> SUMMARY
    ENTITY -->|structured data| ORCH
    CLASSIFY -->|doc type| ORCH
    SUMMARY -->|summary| ORCH
    ORCH -->|store metadata| COSMOS
    ORCH -->|store processed| OUTBLOB
    ORCH -->|index| INDEX
    MI -->|auth| DI
    MI -->|auth| AOAI
    KV -->|secrets| ORCH
    ORCH -->|telemetry| AI_INS
    DI -->|extraction logs| LA
    ORCH -->|processing logs| LA

    style UPLOAD fill:#3b82f6,color:#fff
    style BLOB fill:#f59e0b,color:#fff
    style EG fill:#3b82f6,color:#fff
    style ORCH fill:#3b82f6,color:#fff
    style DI fill:#10b981,color:#fff
    style AOAI fill:#10b981,color:#fff
    style ENTITY fill:#10b981,color:#fff
    style CLASSIFY fill:#10b981,color:#fff
    style SUMMARY fill:#10b981,color:#fff
    style COSMOS fill:#f59e0b,color:#fff
    style OUTBLOB fill:#f59e0b,color:#fff
    style INDEX fill:#f59e0b,color:#fff
    style KV fill:#7c3aed,color:#fff
    style MI fill:#7c3aed,color:#fff
    style AI_INS fill:#0ea5e9,color:#fff
    style LA fill:#0ea5e9,color:#fff
```

## Data Flow

1. **Document upload** — users upload PDFs, images, or scanned documents via web portal, API, or SFTP
2. **Blob landing** — documents stored in the Blob Storage landing zone container
3. **Event trigger** — Event Grid fires a BlobCreated event to the Container Apps orchestrator
4. **OCR extraction** — Document Intelligence performs layout analysis, OCR, table detection, and key-value extraction
5. **AI enrichment** — Azure OpenAI processes raw extraction for entity recognition, classification, and summarization
6. **Classification** — document typed as invoice, contract, form, receipt, or correspondence
7. **Structured output** — extracted metadata (entities, amounts, dates, classifications) stored in Cosmos DB
8. **Processed storage** — enriched documents with annotations saved to output Blob container
9. **Search indexing** — structured data indexed for full-text and faceted search
10. **Audit logging** — every processing step logged with extraction confidence scores and timings

## Service Roles

| Service | Layer | Role |
|---------|-------|------|
| Blob Storage | Storage | Document landing zone and processed output archive |
| Event Grid | Compute | Event-driven trigger for new document processing |
| Container Apps | Compute | Pipeline orchestration — routing, batching, error handling |
| Document Intelligence | AI | OCR, layout analysis, table extraction, key-value pairs |
| Azure OpenAI | AI | Entity extraction, document classification, summarization |
| Cosmos DB | Storage | Extracted metadata, entity store, classification results |
| Key Vault | Security | API keys and Document Intelligence credentials |
| Application Insights | Monitoring | Pipeline throughput, extraction accuracy, processing time |
| Log Analytics | Monitoring | Processing audit trail, error diagnostics |

## Security Architecture

- **Managed Identity** — Container Apps authenticates to Document Intelligence, OpenAI, and Storage without credentials
- **Private endpoints** — Blob Storage, Cosmos DB, and AI services accessible only via private network
- **Encryption at rest** — all documents and extracted data encrypted with platform or customer-managed keys
- **Immutable storage** — compliance-critical documents stored with immutability policies (WORM)
- **RBAC** — document access scoped by classification; finance docs restricted to finance roles
- **PII detection** — extracted PII flagged and masked in logs; original retained only in secure storage
- **Key Vault** — all API keys and connection strings managed centrally with rotation policies
- **Content filtering** — Azure OpenAI content filters active to prevent harmful content in summaries

## Scaling

| Metric | Dev | Production | Enterprise |
|--------|-----|------------|------------|
| Documents/day | 50 | 2,000 | 20,000 |
| Pages/day | 200 | 10,000 | 50,000 |
| Container replicas | 1 (scale-to-zero) | 2-5 | 5-20 |
| Cosmos DB RU/s | 400 (serverless) | 4,000 | 40,000 |
| Blob storage/month | 10 GB | 500 GB | 2 TB |
| Processing latency (P95) | <30s | <15s | <10s |
| Extraction accuracy target | — | 90%+ | 95%+ |
