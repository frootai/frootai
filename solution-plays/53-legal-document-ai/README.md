# Play 53 — Legal Document AI

AI-powered legal document analysis — contract review, clause extraction with layout-aware parsing, risk scoring against industry benchmarks, redlining suggestions, version comparison, jurisdiction-aware analysis, UPL-safe disclaimers on every output, and attorney-client privilege markers.

## Architecture

```mermaid
graph TB
    subgraph Document Intake
        Upload[Document Upload<br/>PDF · DOCX · TIFF · Scanned Contracts]
        BulkImport[Bulk Import<br/>Existing Contract Libraries · M&A Due Diligence]
    end

    subgraph Document Processing
        DocIntel[Document Intelligence<br/>OCR · Layout Analysis · Table Extraction · Signatures]
        Chunking[Clause-Aware Chunking<br/>Section Detection · Hierarchy Preservation · Cross-References]
    end

    subgraph Knowledge Layer
        AISearch[Azure AI Search<br/>Hybrid Search · Semantic Ranking · Clause Library · Precedents]
        BlobStore[Azure Blob Storage<br/>Document Repository · Version History · Legal Hold · WORM]
    end

    subgraph AI Analysis Engine
        AOAI[Azure OpenAI<br/>Risk Assessment · Clause Analysis · Obligation Extraction]
        RiskEngine[Risk Scoring<br/>Deviation Analysis · Template Comparison · Jurisdictional Rules]
        Summary[Summarization<br/>Plain-Language Briefs · Executive Summaries · Key Terms]
    end

    subgraph Legal Metadata
        CosmosDB[Cosmos DB<br/>Risk Scores · Obligations · Deadlines · Review Status · Audit Trail]
    end

    subgraph User Interface
        ReviewUI[Legal Review Dashboard<br/>Risk Heatmap · Clause Navigator · Obligation Timeline]
        Reports[Compliance Reports<br/>Portfolio Risk · Regulatory Gaps · Audit Export]
    end

    subgraph Security
        KV[Key Vault<br/>API Keys · Encryption Keys · Service Credentials]
        MI[Managed Identity<br/>Zero-secret Auth]
    end

    subgraph Monitoring
        AppInsights[Application Insights<br/>Processing Throughput · Analysis Latency · Risk Distribution]
    end

    Upload -->|Ingest| DocIntel
    BulkImport -->|Batch| DocIntel
    DocIntel -->|Structured Text| Chunking
    Chunking -->|Clauses| AISearch
    Chunking -->|Original| BlobStore
    AISearch -->|Relevant Clauses| AOAI
    AOAI -->|Analysis| RiskEngine
    AOAI -->|Summaries| Summary
    RiskEngine -->|Scores| CosmosDB
    Summary -->|Briefs| CosmosDB
    CosmosDB -->|Data| ReviewUI
    CosmosDB -->|Analytics| Reports
    BlobStore -->|Documents| ReviewUI
    MI -->|Secrets| KV
    DocIntel -->|Traces| AppInsights

    style Upload fill:#3b82f6,color:#fff,stroke:#2563eb
    style BulkImport fill:#3b82f6,color:#fff,stroke:#2563eb
    style DocIntel fill:#10b981,color:#fff,stroke:#059669
    style Chunking fill:#10b981,color:#fff,stroke:#059669
    style AISearch fill:#f59e0b,color:#fff,stroke:#d97706
    style BlobStore fill:#f59e0b,color:#fff,stroke:#d97706
    style AOAI fill:#10b981,color:#fff,stroke:#059669
    style RiskEngine fill:#10b981,color:#fff,stroke:#059669
    style Summary fill:#10b981,color:#fff,stroke:#059669
    style CosmosDB fill:#f59e0b,color:#fff,stroke:#d97706
    style ReviewUI fill:#3b82f6,color:#fff,stroke:#2563eb
    style Reports fill:#3b82f6,color:#fff,stroke:#2563eb
    style KV fill:#7c3aed,color:#fff,stroke:#6d28d9
    style MI fill:#7c3aed,color:#fff,stroke:#6d28d9
    style AppInsights fill:#0ea5e9,color:#fff,stroke:#0284c7
```

> Full architecture details: [`architecture.md`](./architecture.md)

## How It Differs from Related Plays

| Aspect | Play 06 (Document Intelligence) | **Play 53 (Legal Document AI)** | Play 38 (Doc Understanding V2) |
|--------|-------------------------------|-------------------------------|-------------------------------|
| Domain | General document processing | **Legal contracts specifically** | Multi-page entity linking |
| Output | Extracted fields | **Clause risk scores + redline suggestions** | Structured extraction |
| Compliance | PII redaction | **UPL compliance + privilege markers** | Confidence thresholds |
| Benchmark | Schema-based | **Industry-standard clause benchmarks** | Entity linking accuracy |
| Legal Safety | N/A | **"Not legal advice" on every output** | N/A |
| Jurisdiction | N/A | **State/country-aware analysis** | N/A |

## DevKit Structure

```
53-legal-document-ai/
├── agent.md                              # Root orchestrator with handoffs
├── .github/
│   ├── copilot-instructions.md           # Domain knowledge (<150 lines)
│   ├── agents/
│   │   ├── builder.agent.md              # Clause extraction + risk + redline
│   │   ├── reviewer.agent.md             # UPL + privilege + PII
│   │   └── tuner.agent.md                # Clause library + benchmarks + cost
│   ├── prompts/
│   │   ├── deploy.prompt.md              # Deploy legal pipeline
│   │   ├── test.prompt.md                # Review sample contracts
│   │   ├── review.prompt.md              # Audit UPL compliance
│   │   └── evaluate.prompt.md            # Measure extraction accuracy
│   ├── skills/
│   │   ├── deploy-legal-document-ai/     # Doc Intel + clause + risk + redline
│   │   ├── evaluate-legal-document-ai/   # Clauses, risk, UPL, redline quality
│   │   └── tune-legal-document-ai/       # Clause library, benchmarks, UPL
│   └── instructions/
│       └── legal-document-ai-patterns.instructions.md
├── config/                               # TuneKit
│   ├── openai.json                       # Legal model (temp=0), redline config
│   ├── guardrails.json                   # Risk benchmarks, UPL rules
│   └── agents.json                       # Clause library, jurisdiction rules
├── infra/                                # Bicep IaC
│   ├── main.bicep
│   └── parameters.json
└── spec/                                 # SpecKit
    └── fai-manifest.json
```

## Quick Start

```bash
# 1. Deploy legal AI pipeline
/deploy

# 2. Review sample contracts
/test

# 3. Audit UPL compliance
/review

# 4. Measure extraction accuracy
/evaluate
```

## Key Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| Clause Detection | > 90% | Expected clauses found |
| Risk Calibration | > 80% | Scores match attorney assessment |
| UPL Compliance | 100% | Disclaimers + privilege markers |
| Redline Relevance | > 85% | Suggestions address identified risk |
| Critical Risk Detection | > 95% | High-severity risks caught |
| Cost per Contract | < $3.00 | 20-page MSA review |

## Cost Estimate

| Service | Dev | Prod | Enterprise |
|---------|-----|------|------------|
| Azure OpenAI | $100 | $900 | $3,500 |
| Azure AI Search | $0 | $250 | $1,000 |
| Azure Document Intelligence | $0 | $100 | $400 |
| Azure Blob Storage | $5 | $40 | $150 |
| Cosmos DB | $5 | $75 | $350 |
| Key Vault | $1 | $5 | $15 |
| Application Insights | $0 | $30 | $100 |
| Container Apps | $10 | $80 | $350 |
| **Total** | **$121** | **$1,480** | **$5,865** |

> Detailed breakdown with SKUs and optimization tips: [`cost.json`](./cost.json) · [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/)

## WAF Alignment

| Pillar | Implementation |
|--------|---------------|
| **Responsible AI** | UPL disclaimers, privilege markers, "not legal advice" on every output |
| **Security** | PII de-identification, Key Vault for secrets, no PII in LLM context |
| **Reliability** | Deterministic scoring (temp=0), clause-by-clause processing |
| **Cost Optimization** | gpt-4o-mini for classification, batch clause extraction, redline threshold |
| **Operational Excellence** | Clause library per contract type, jurisdiction rules, version comparison |
| **Performance Efficiency** | Layout extraction for structure, 5-section batching, cached benchmarks |
