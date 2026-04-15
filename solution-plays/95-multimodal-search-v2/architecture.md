# Architecture — Play 95: Multimodal Search Engine V2 — Unified Search Across Images, Text, Code, and Audio with Cross-Modal Reasoning

## Overview

Next-generation multimodal search engine that provides unified search across images, text, code, and audio content with cross-modal reasoning — enabling queries like "find the architecture diagram that matches this code snippet" or "show me presentations where someone discussed this concept." Azure AI Search provides the unified index with hybrid vector + keyword search, supporting text embeddings, image embeddings, code embeddings, and audio transcription embeddings in a single searchable index with cross-modal ranking and semantic reranking. Azure AI Vision handles image understanding — generating visual embeddings for similarity search, performing object detection and scene classification, extracting text from images via OCR, generating captions for text-based image retrieval, and answering visual questions for cross-modal reasoning. Azure AI Speech converts audio content into searchable text — speech-to-text transcription with speaker diarization, timestamp-aligned word-level indexing, language identification for multilingual audio, and audio segment tagging for temporal search. Azure OpenAI (GPT-4o) provides the cross-modal reasoning layer — understanding natural language queries that span modalities, synthesizing results from multiple modalities into coherent answers, expanding queries across modal boundaries, and generating conversational search refinement. Container Apps host the search API and processing pipelines — query orchestration, modality-specific indexing workers, embedding generation, result ranking and fusion, and the search UI backend. Designed for enterprise knowledge bases, digital asset management, media libraries, research repositories, code search platforms, e-learning content discovery, and any organization with heterogeneous content across multiple modalities.

## Architecture Diagram

```mermaid
graph TB
    subgraph Content Sources
        Text[Text Content<br/>Documents · Articles · Wikis · PDFs]
        Images[Image Content<br/>Photos · Diagrams · Charts · Screenshots]
        Code[Code Content<br/>Repositories · Snippets · Notebooks · APIs]
        Audio[Audio Content<br/>Meetings · Podcasts · Lectures · Calls]
    end

    subgraph Indexing Pipeline
        Vision[Azure AI Vision<br/>Embeddings · Object Detection · OCR · Captioning · VQA]
        Speech[Azure AI Speech<br/>Transcription · Diarization · Timestamps · Language ID]
        ACA[Container Apps<br/>Query Engine · Indexing Workers · Embedding Gen · Result Fusion]
    end

    subgraph Unified Index
        Search[Azure AI Search<br/>Hybrid Vector + Keyword · Cross-Modal Rank · Semantic Rerank · Facets]
    end

    subgraph Reasoning Layer
        OpenAI[Azure OpenAI — GPT-4o<br/>Query Understanding · Cross-Modal Synthesis · Expansion · Refinement]
    end

    subgraph Storage
        Blob[Blob Storage<br/>Source Files · Embeddings · Thumbnails · Transcripts · Queue Artifacts]
    end

    subgraph Security
        KV[Key Vault<br/>AI Creds · Search Keys · Storage Keys · Source Tokens]
        MI[Managed Identity<br/>Zero-secret Auth]
    end

    subgraph Monitoring
        AppInsights[Application Insights<br/>Query Latency · Relevance (MRR/NDCG) · Embedding Throughput · Cache Hits]
    end

    Text --> ACA
    Images --> Vision
    Code --> ACA
    Audio --> Speech
    Vision -->|Image Embeddings + Metadata| ACA
    Speech -->|Transcripts + Timestamps| ACA
    ACA -->|Index Documents| Search
    ACA -->|Cross-Modal Reasoning| OpenAI
    OpenAI -->|Enhanced Results| ACA
    Search -->|Search Results| ACA
    ACA <-->|Content Store| Blob
    ACA -->|Auth| MI
    MI -->|Secrets| KV
    ACA -->|Traces| AppInsights

    style Text fill:#6366f1,color:#fff,stroke:#4f46e5
    style Images fill:#ec4899,color:#fff,stroke:#db2777
    style Code fill:#14b8a6,color:#fff,stroke:#0d9488
    style Audio fill:#f43f5e,color:#fff,stroke:#e11d48
    style Vision fill:#a855f7,color:#fff,stroke:#9333ea
    style Speech fill:#f97316,color:#fff,stroke:#ea580c
    style ACA fill:#3b82f6,color:#fff,stroke:#2563eb
    style Search fill:#10b981,color:#fff,stroke:#059669
    style OpenAI fill:#22c55e,color:#fff,stroke:#16a34a
    style Blob fill:#f59e0b,color:#fff,stroke:#d97706
    style KV fill:#ef4444,color:#fff,stroke:#dc2626
    style MI fill:#7c3aed,color:#fff,stroke:#6d28d9
    style AppInsights fill:#0ea5e9,color:#fff,stroke:#0284c7
```

## Data Flow

1. **Multimodal Content Ingestion**: Container Apps receive content from diverse sources through modality-specific pipelines — text content: documents (PDF, DOCX, Markdown, HTML) parsed and chunked with overlap for context preservation (512-token chunks with 128-token overlap), metadata extracted (title, author, date, tags), text embeddings generated via Azure OpenAI text-embedding-3-large (3072 dimensions); image content: routed to Azure AI Vision for visual embedding generation (1024-dimension Florence vectors), object detection and scene classification for structured metadata, OCR for text-in-image extraction (diagrams with labels, screenshots with UI text, whiteboards), automatic caption generation for text-based image retrieval; code content: parsed with language-aware tokenization (supporting 40+ languages), AST-based semantic chunking (function/class/module boundaries), code embeddings generated via specialized code embedding models, identifier extraction and API surface indexing; audio content: routed to Azure AI Speech for transcription with speaker diarization, timestamp-aligned word-level indexing for temporal search ("jump to where they discussed X"), language identification for multilingual audio corpora → All modalities produce a unified document schema: content embedding vector + text representation + structured metadata + source reference + modality tag
2. **Unified Index Construction**: Azure AI Search maintains the cross-modal index — each indexed document contains: vector field (embedding for similarity search), text field (content or generated description for keyword search), metadata fields (modality, source, date, tags, dimensions/duration/language), and cross-reference fields (related documents across modalities) → Hybrid search combines vector similarity and BM25 keyword matching with configurable weights per modality — image search emphasizes vector similarity while code search weights keyword matching more heavily; semantic ranker applies cross-modal relevance scoring that understands conceptual similarity across modalities ("architecture diagram" in image caption matches "system design" in text document); faceted navigation enables filtering by modality, date range, content type, language, and source system → Index refreshed incrementally via change detection — new content indexed within minutes, modified content re-embedded and re-indexed, deleted content purged from index
3. **Cross-Modal Query Processing**: When a user submits a search query, Container Apps orchestrate multi-stage processing — query understanding: GPT-4o analyzes the natural language query to determine: target modalities (explicit: "find images of..." vs. implicit: "how does the auth flow work" could match diagrams, code, and docs), search intent (lookup, comparison, exploration, question-answering), and query decomposition for complex multi-part queries → Query expansion: GPT-4o generates modality-specific query variants — a query like "show me the database schema" expands to: text search "database schema ERD data model", image search "entity relationship diagram database tables", code search "CREATE TABLE schema migration model definition" → Parallel search execution: all modality-specific queries dispatched simultaneously to AI Search, each with modality-appropriate ranking weights → Result fusion: cross-modal results merged using reciprocal rank fusion (RRF) with modality diversity enforcement — ensures top results include relevant items from multiple modalities rather than all results from a single dominant modality
4. **Cross-Modal Reasoning & Synthesis**: For complex queries requiring reasoning across modalities, GPT-4o synthesizes insights — "What does this architecture look like in code?": retrieves architecture diagram (image), extracts component relationships, finds matching code implementations, and presents a unified view; "Summarize all content about authentication": aggregates text documentation, code implementations, architecture diagrams, and meeting recordings discussing auth, producing a comprehensive multi-modal summary → Visual question answering: for image-specific queries ("What database is shown in this diagram?"), Azure AI Vision VQA provides direct answers from images, enhanced by GPT-4o reasoning with surrounding text context → Code-to-diagram matching: code embeddings matched against diagram embeddings to find visual representations of implemented patterns → Conversational search refinement: users can iteratively refine searches through natural language ("now filter to only the Python implementations" or "show me something similar but for the payment service")
5. **Result Delivery & Analytics**: Container Apps serve the unified search experience — results presented in a modality-aware UI: text results with highlighted snippets, image results with thumbnails and captions, code results with syntax-highlighted previews, audio results with playable segments and transcript highlights → Search quality metrics tracked in Application Insights: query latency by modality (target: <300ms for text, <500ms for image, <800ms for cross-modal), relevance metrics (MRR@10, NDCG@10) measured via implicit feedback (click-through, dwell time) and explicit feedback (thumbs up/down), embedding generation throughput, indexing pipeline latency, cache hit rates → A/B testing framework for search ranking algorithm improvements — comparing different fusion strategies, reranking models, and query expansion approaches with statistical significance testing

## Service Roles

| Service | Layer | Role |
|---------|-------|------|
| Azure AI Search | Index | Unified multimodal index — hybrid vector + keyword search, cross-modal ranking, semantic reranking, faceted filtering |
| Azure AI Vision | Processing | Image embeddings, object detection, scene classification, OCR, captioning, visual question answering |
| Azure AI Speech | Processing | Audio transcription, speaker diarization, timestamp alignment, language identification for audio indexing |
| Azure OpenAI (GPT-4o) | Reasoning | Query understanding, cross-modal synthesis, query expansion, conversational refinement, result summarization |
| Container Apps | Compute | Search API, query orchestration, modality indexing pipelines, embedding workers, result fusion, UI backend |
| Blob Storage | Storage | Source content, generated embeddings, thumbnails, transcripts, indexing artifacts |
| Key Vault | Security | AI service credentials, search admin keys, storage keys, content source API tokens |
| Application Insights | Monitoring | Query latency, relevance scores (MRR, NDCG), embedding throughput, indexing health, user engagement |

## Security Architecture

- **Content Access Control**: Search results filtered by user permissions — document-level ACLs synced from source systems ensure users only see content they're authorized to access across all modalities
- **Managed Identity**: All service-to-service auth via managed identity — zero credentials in code for AI Search, Vision, Speech, OpenAI, Container Apps, Blob Storage
- **Data Classification**: Content classified by sensitivity level at ingestion — public, internal, confidential, restricted; search index maintains classification metadata; restricted content excluded from cross-modal synthesis to prevent information leakage
- **Embedding Privacy**: Raw embeddings stored in AI Search are not invertible to source content, but co-located metadata enables retrieval; access to raw embeddings restricted to indexing service accounts
- **RBAC**: Search users access query API with content-filtered results; content administrators manage indexing pipelines and source connections; search engineers access relevance metrics and ranking configuration; platform admins manage infrastructure and security policies
- **Encryption**: All content encrypted at rest (AES-256) and in transit (TLS 1.2+); Blob Storage uses customer-managed keys for sensitive content; AI Search index encrypted at rest
- **Audit Logging**: All search queries logged with user identity, query text, result set, and click-through — supporting compliance requirements and search quality analysis

## Scaling

| Metric | Dev | Production | Enterprise |
|--------|-----|-----------|------------|
| Indexed documents | 5K | 1M-10M | 50M-500M |
| Images indexed | 1K | 500K-5M | 20M-100M |
| Audio hours indexed | 10 | 5K-50K | 200K-1M |
| Search queries/sec | 5 | 100-500 | 2,000-10,000 |
| Embedding generations/day | 500 | 50K-500K | 2M-10M |
| Cross-modal queries/sec | 1 | 20-100 | 500-2,000 |
| P95 text search latency | 500ms | 200ms | 100ms |
| P95 cross-modal latency | 3s | 800ms | 400ms |
