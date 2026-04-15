# Play 62 — Federated Learning Pipeline

Privacy-preserving distributed training — FedAvg server orchestration, client local training (data never leaves), differential privacy via Opacus, optional secure aggregation in Azure Confidential Computing enclaves, convergence monitoring, non-IID handling (FedProx/SCAFFOLD), and cross-organization collaboration protocols.

## Architecture

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Fed Server | Flower (flwr) + Container Apps | Round orchestration, aggregation, convergence |
| Client Training | PyTorch + Opacus DP | Local training on private data |
| Secure Aggregation | Azure Confidential Computing (SGX) | Hardware-enclave aggregation (optional) |
| Training Orchestration | Azure ML Workspace | Experiment tracking, compute management |
| Communication | TLS 1.3 | Encrypted client↔server |
| Secrets | Azure Key Vault | API keys, enclave attestation |

```mermaid
graph TB
    subgraph Orchestration Layer
        ML[Azure Machine Learning<br/>FL Orchestrator · Experiment Tracker]
        Registry[ML Model Registry<br/>Global Model Versions]
    end

    subgraph Secure Aggregation
        Enclave[Confidential Computing<br/>SGX Enclave · Secure Aggregation Server]
    end

    subgraph Data Silos
        Silo1[Silo Worker A<br/>Container Apps · Local Training]
        Silo2[Silo Worker B<br/>Container Apps · Local Training]
        Silo3[Silo Worker N<br/>Container Apps · Local Training]
    end

    subgraph Storage
        Blob[Blob Storage<br/>Model Checkpoints · Aggregated Snapshots]
    end

    subgraph Networking
        VNet[Virtual Network<br/>Private Endpoints · VPN Gateways]
    end

    subgraph Security
        KV[Key Vault<br/>Encryption Keys · Attestation Certs]
        MI[Managed Identity<br/>Zero-secret Auth]
    end

    subgraph Monitoring
        AppInsights[Application Insights<br/>Convergence Metrics · Silo Health]
        Logs[Log Analytics<br/>Audit Trail · Privacy Budget]
    end

    ML -->|Distribute Global Model| Enclave
    Enclave -->|Send Model| Silo1
    Enclave -->|Send Model| Silo2
    Enclave -->|Send Model| Silo3
    Silo1 -->|Encrypted Gradients| Enclave
    Silo2 -->|Encrypted Gradients| Enclave
    Silo3 -->|Encrypted Gradients| Enclave
    Enclave -->|Aggregated Update| ML
    ML -->|Store Checkpoint| Blob
    ML -->|Register Version| Registry
    Silo1 & Silo2 & Silo3 -->|Private Link| VNet
    Enclave -->|Private Link| VNet
    ML -->|Auth| MI
    MI -->|Secrets| KV
    ML -->|Traces| AppInsights
    Enclave -->|Audit| Logs

    style ML fill:#06b6d4,color:#fff,stroke:#0891b2
    style Registry fill:#06b6d4,color:#fff,stroke:#0891b2
    style Enclave fill:#7c3aed,color:#fff,stroke:#6d28d9
    style Silo1 fill:#10b981,color:#fff,stroke:#059669
    style Silo2 fill:#10b981,color:#fff,stroke:#059669
    style Silo3 fill:#10b981,color:#fff,stroke:#059669
    style Blob fill:#f59e0b,color:#fff,stroke:#d97706
    style VNet fill:#3b82f6,color:#fff,stroke:#2563eb
    style KV fill:#7c3aed,color:#fff,stroke:#6d28d9
    style MI fill:#7c3aed,color:#fff,stroke:#6d28d9
    style AppInsights fill:#0ea5e9,color:#fff,stroke:#0284c7
    style Logs fill:#0ea5e9,color:#fff,stroke:#0284c7
```

🏗️ [Full architecture details](architecture.md)

## How It Differs from Related Plays

| Aspect | Play 13 (Fine-Tuning) | **Play 62 (Federated Learning)** | Play 47 (Synthetic Data) |
|--------|----------------------|--------------------------------|--------------------------|
| Data | Centralized training data | **Data stays at client nodes (never centralized)** | Generated from scratch |
| Privacy | Access controls | **Differential privacy (ε budget)** | Privacy by construction |
| Training | Single-site | **Multi-site distributed** | N/A (generation, not training) |
| Output | Fine-tuned model | **Global federated model** | Synthetic dataset |
| Parties | Single organization | **Multi-organization collaboration** | Single organization |
| Compliance | Data handling policies | **GDPR/HIPAA data sovereignty** | GDPR synthetic data |

## Key Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| Rounds to Convergence | < 50 | Training rounds until stable loss |
| Global Accuracy | > 85% | Model accuracy on server test set |
| Accuracy vs Centralized | > 0.95 ratio | Federated nearly matches centralized |
| Epsilon Consumed | < budget | Total DP budget used |
| Data Isolation | 100% | No raw data transferred (non-negotiable) |
| Training Cost | Minimize | Client compute × rounds × clients |

## Cost Estimate

| Service | Dev | Prod | Enterprise |
|---------|-----|------|------------|
| Azure Machine Learning | $0 | $450 | $1,200 |
| Confidential Computing | $120 | $550 | $1,800 |
| Blob Storage | $5 | $40 | $120 |
| Container Apps | $15 | $200 | $600 |
| Key Vault | $1 | $15 | $40 |
| Virtual Network | $30 | $150 | $450 |
| Application Insights | $0 | $30 | $100 |
| Log Analytics | $0 | $20 | $60 |
| **Total** | **$171/mo** | **$1,455/mo** | **$4,370/mo** |

> Estimates based on Azure retail pricing. Actual costs vary by region, usage, and enterprise agreements.

💰 [Full cost breakdown](cost.json)

## WAF Alignment

| Pillar | Implementation |
|--------|---------------|
| **Security** | Data never leaves client, DP noise, Confidential Computing, TLS 1.3 |
| **Responsible AI** | Privacy-preserving training, gradient leakage prevention |
| **Reliability** | Convergence monitoring, non-IID handling, early stopping |
| **Cost Optimization** | Client selection, early stopping, model compression |
| **Operational Excellence** | Round tracking, client contribution monitoring, LLM convergence explanation |
| **Performance Efficiency** | Async training, FedProx for non-IID, straggler mitigation |
