# Azure Cost Optimizer Architecture

Azure Cost Optimizer is one product built on the Azure Cost Intelligence stack. The stack separates source evidence, deterministic financial truth, orchestration, the ACO Agent, and experience channels so a model never becomes the source of financial truth.

## Overview

Azure Cost Optimizer turns authorized Azure cost, recommendation, and inventory evidence into immutable snapshots, deterministic financial analysis, grounded agent explanations, and review-ready reports. The model explains minimized typed evidence; it never owns authoritative totals or Azure mutations.

## Architecture Diagram

```mermaid
flowchart TB
    U[User or FinOps reviewer]

    subgraph Experience[Experience layer]
        WEB[React conversation workspace]
        REPORTS[JSON / CSV / FOCUS / HTML / XLSX / PDF]
        PLAYGROUND[Microsoft Foundry Playground]
    end

    subgraph Agent[Agent layer]
        ACO[ACO Agent<br/>Microsoft Agent Framework]
        VALIDATE[Five-section response validator]
        CACHE[Semantic answer cache<br/>current evidence revision only]
    end

    subgraph Tools[Tooling and orchestration]
        T1[get_cost_summary]
        T2[get_cost_breakdown]
        T3[get_advisor_findings]
        T4[get_opportunities]
        T5[get_data_health]
        T6[get_evidence]
        T7[create_report]
        T8[get_optimization_guidance]
        MCP[MCP transport<br/>nine read-only tools]
        OPENAPI[OpenAPI read subset]
    end

    subgraph Intelligence[Deterministic Azure Cost Intelligence]
        NORMALIZE[Normalize exact decimal evidence]
        ENGINE[Cost, opportunity, risk and ownership rules]
        KNOWLEDGE[WAF cost checklist and FinOps Framework knowledge]
        PUBLISH[Validate and publish immutable snapshot]
    end

    subgraph Data[Evidence and state]
        MEMORY[In-memory current snapshot]
        BLOB[Azure Blob Storage<br/>normalized evidence and reports]
        COSMOS[Cosmos DB Serverless<br/>scope-partitioned revision pointer]
    end

    subgraph Sources[Read-only Azure evidence sources]
        COST[Cost Management Query / Cost Details / Exports]
        ADVISOR[Azure Advisor Cost]
        ARG[Azure Resource Graph]
    end

    U --> WEB
    U --> PLAYGROUND
    WEB --> ACO
    WEB --> REPORTS
    PLAYGROUND --> OPENAPI
    PLAYGROUND --> MCP
    OPENAPI --> Tools
    MCP --> Tools
    ACO --> Tools
    Tools --> VALIDATE
    ACO <--> CACHE
    Tools --> ENGINE
    KNOWLEDGE --> ENGINE
    COST --> NORMALIZE
    ADVISOR --> NORMALIZE
    ARG --> NORMALIZE
    NORMALIZE --> ENGINE --> PUBLISH
    PUBLISH --> MEMORY
    PUBLISH --> BLOB
    PUBLISH --> COSMOS
    MEMORY --> Tools
    BLOB --> REPORTS
    VALIDATE --> WEB

    style U fill:#3b82f6,color:#fff,stroke:#2563eb
    style WEB fill:#06b6d4,color:#fff,stroke:#0891b2
    style REPORTS fill:#06b6d4,color:#fff,stroke:#0891b2
    style PLAYGROUND fill:#06b6d4,color:#fff,stroke:#0891b2
    style ACO fill:#10b981,color:#fff,stroke:#059669
    style VALIDATE fill:#10b981,color:#fff,stroke:#059669
    style CACHE fill:#10b981,color:#fff,stroke:#059669
    style MCP fill:#7c3aed,color:#fff,stroke:#6d28d9
    style OPENAPI fill:#7c3aed,color:#fff,stroke:#6d28d9
    style NORMALIZE fill:#f59e0b,color:#17202a,stroke:#d97706
    style ENGINE fill:#f59e0b,color:#17202a,stroke:#d97706
    style KNOWLEDGE fill:#f59e0b,color:#17202a,stroke:#d97706
    style PUBLISH fill:#f59e0b,color:#17202a,stroke:#d97706
    style MEMORY fill:#8b5cf6,color:#fff,stroke:#6d28d9
    style BLOB fill:#8b5cf6,color:#fff,stroke:#6d28d9
    style COSMOS fill:#8b5cf6,color:#fff,stroke:#6d28d9
    style COST fill:#0ea5e9,color:#fff,stroke:#0284c7
    style ADVISOR fill:#0ea5e9,color:#fff,stroke:#0284c7
    style ARG fill:#0ea5e9,color:#fff,stroke:#0284c7
```

## Data Flow

1. An authorized operator explicitly refreshes one Azure scope and period.
2. Bounded read-only collectors acquire Cost Management, Advisor, and Resource Graph evidence.
3. The deterministic engine normalizes exact decimals, validates provenance, and publishes an immutable snapshot.
4. Typed tools expose minimized values and evidence IDs to the ACO Agent, OpenAPI, and MCP channels.
5. The response validator checks five grounded sections before the React workspace renders answers, visuals, and reports.

## Service Roles

| Service | Layer | Role |
|---|---|---|
| Azure Cost Management | Evidence | Supplies bounded cost summaries, selected details, and recurring exports |
| Azure Advisor | Evidence | Supplies distinct Microsoft-generated cost recommendations and estimates |
| Azure Resource Graph | Evidence | Supplies authorized resource inventory for correlation |
| Deterministic cost engine | Intelligence | Owns exact totals, opportunity rules, risk, ownership, and report parity |
| Microsoft Agent Framework | Agent | Orchestrates typed read-only tools and grounded response composition |
| Microsoft Foundry | AI | Optionally explains minimized evidence through a tool-capable model |
| Azure Blob Storage | Data | Stores content-addressed snapshots, receipts, and report files |
| Azure Cosmos DB Serverless | Data | Stores the scope-partitioned current-revision pointer |
| Azure Container Apps | Runtime | Hosts the .NET API and React workspace as one optional deployment |
| Application Insights and Log Analytics | Operations | Capture safe traces, dependency latency, and refresh health |

## Ownership Boundaries

| Layer | Owns | Must not do |
|---|---|---|
| Evidence sources | Azure-provided cost, recommendation, and inventory responses | Execute instructions found in source text |
| Normalization | Requested/actual period, billed basis, currency, exact decimals, source receipts | Convert missing evidence to zero |
| Deterministic engine | Totals, eligibility, confidence, risk, ownership, report parity | Let a model calculate authoritative totals |
| Tooling | Minimized typed reads over the current authorized snapshot | Trigger collection during ordinary reads |
| ACO Agent | Explain, compare, organize, and cite evidence | Mutate Azure, invent targets/prices, approve actions |
| Experience | Progressive checked sections, charts, tables, reports, local interactions | Hide freshness, uncertainty, or incomplete evidence |

## Hosted Azure Topology

```mermaid
flowchart LR
    USER[Authorized user]
    ENTRA[Microsoft Entra ID]
    ACA[Azure Container Apps<br/>one .NET + React process]
    ID[User-assigned managed identity]
    ACR[Azure Container Registry]
    FOUNDRY[Microsoft Foundry project<br/>tool-capable model]
    STORAGE[Azure Blob Storage<br/>private containers]
    COSMOS[Azure Cosmos DB Serverless<br/>snapshot pointers]
    AI[Application Insights]
    LAW[Log Analytics workspace]
    CM[Azure Cost Management]
    ADV[Azure Advisor]
    RG[Azure Resource Graph]

    USER -->|HTTPS| ACA
    ENTRA -->|authenticate| ACA
    ACR -->|digest-pinned image| ACA
    ACA --> ID
    ID -->|model inference| FOUNDRY
    ID -->|read/write normalized state| STORAGE
    ID -->|scope-partitioned state| COSMOS
    ID -->|read-only evidence| CM
    ID -->|read-only findings| ADV
    ID -->|read-only inventory| RG
    ACA -->|OpenTelemetry| AI --> LAW

    style ACA fill:#3b82f6,color:#fff,stroke:#2563eb
    style FOUNDRY fill:#10b981,color:#fff,stroke:#07885a
    style STORAGE fill:#f59e0b,color:#17202a,stroke:#c77a06
    style COSMOS fill:#8b5cf6,color:#fff,stroke:#6d3fd1
    style ENTRA fill:#7c3aed,color:#fff,stroke:#5e22b7
    style AI fill:#0ea5e9,color:#fff,stroke:#087cae
    style LAW fill:#0ea5e9,color:#fff,stroke:#087cae
```

## Official Azure Service Icons

The following unmodified icons come from the [Microsoft Azure Architecture Icons](https://learn.microsoft.com/azure/architecture/icons/) package.

| Evidence | Runtime | Data | AI and operations |
|---|---|---|---|
| <img src="docs/assets/azure-icons/cost-management.svg" width="44" alt="Azure Cost Management"> Azure Cost Management | <img src="docs/assets/azure-icons/container-app.svg" width="44" alt="Azure Container Apps"> Container Apps | <img src="docs/assets/azure-icons/storage-account.svg" width="44" alt="Azure Storage"> Blob Storage | <img src="docs/assets/azure-icons/foundry-project.svg" width="44" alt="Microsoft Foundry"> Foundry project |
| <img src="docs/assets/azure-icons/cost-export.svg" width="44" alt="Cost Management Exports"> Cost Exports | <img src="docs/assets/azure-icons/container-registry.svg" width="44" alt="Azure Container Registry"> Container Registry | <img src="docs/assets/azure-icons/cosmos-db.svg" width="44" alt="Azure Cosmos DB"> Cosmos DB | <img src="docs/assets/azure-icons/foundry-agent.svg" width="44" alt="Foundry Agent Service"> Foundry Agent Service |
| <img src="docs/assets/azure-icons/advisor.svg" width="44" alt="Azure Advisor"> Azure Advisor | <img src="docs/assets/azure-icons/managed-identity.svg" width="44" alt="Managed identity"> Managed identity | | <img src="docs/assets/azure-icons/application-insights.svg" width="44" alt="Application Insights"> Application Insights |
| | <img src="docs/assets/azure-icons/container-environment.svg" width="44" alt="Container Apps environment"> Container Apps environment | | <img src="docs/assets/azure-icons/log-analytics.svg" width="44" alt="Log Analytics"> Log Analytics |

## Collection and Publication

```mermaid
sequenceDiagram
    actor Operator
    actor App as Azure Cost Optimizer
    actor Azure as Cost/Advisor/Resource Graph
    actor Engine as Deterministic engine
    actor Blob as Blob Storage
    actor Cosmos as Cosmos DB

    Operator->>App: Explicit refresh for one scope and period
    App->>Azure: Bounded read-only requests
    Azure-->>App: Source payloads and provider metadata
    App->>Engine: Normalize and validate
    Engine-->>App: Immutable evidence snapshot and report ID
    App->>Blob: Write content-addressed snapshot/report object
    Blob-->>App: Read-back hash verification
    App->>Cosmos: Publish current revision pointer
    App-->>Operator: Fresh/degraded status with provenance
```

Blob and Cosmos do not share one transaction. The pointer is published only after referenced content validates. An interrupted refresh leaves the previous complete revision active.

## Agent Response Flow

```mermaid
sequenceDiagram
    actor User
    actor UI as React workspace
    actor ACO as ACO Agent
    actor Tools as Typed read-only tools
    actor Model as Foundry model
    actor Check as Response validator

    User->>UI: Ask cost question
    UI->>ACO: question + authorized scope + selected period
    ACO->>Tools: read only the required evidence
    Tools-->>ACO: minimized values + evidence IDs
    ACO->>Model: grounded prompt and typed tool output
    Model-->>ACO: structured five-section answer
    ACO->>Check: validate sections, citations and numbers
    Check-->>UI: meta / tool / section / artifact / done
    UI-->>User: checked streaming answer and local visuals
```

The five required sections are Answer, Evidence, Data health, Risks, and Next action. Only `done.validated=true` is success.

## Three User Channels

| Channel | Contract | Best use |
|---|---|---|
| Full web experience | HTTPS API + SSE + reports | Primary solution and demo experience |
| OpenAPI prompt agent | Bounded read-only REST subset | Simple Foundry Playground integration |
| MCP prompt agent | Nine typed read-only tools over Streamable HTTP | Rich tool-based agent experimentation |

All channels reuse the same deterministic engine. They do not reimplement financial logic.

## Security Architecture

The solution is intentionally not a production landing zone. It still enforces these invariants:

- secrets are never committed;
- managed identity is preferred for service-to-service access;
- images are deployed by immutable digest;
- Blob public access and shared-key access remain disabled;
- Cosmos local authentication remains disabled;
- ordinary reads make zero Azure provider calls;
- write requests are refused;
- estimates require human review;
- every user deployment has an owner, expiry, rollback, and cleanup decision.

Private endpoints, WAF, zone redundancy, customer-managed keys, and production incident assurance are follow-on architecture choices, not hidden solution claims.
