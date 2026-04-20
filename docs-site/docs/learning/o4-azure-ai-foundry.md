---
sidebar_position: 11
title: "O4: Azure AI Foundry"
description: "Azure AI Foundry — the unified platform for building, evaluating, and deploying AI at enterprise scale. Hub/Project model, Model Catalog, evaluation pipelines, and Prompt Flow."
---

# O4: Azure AI Foundry

Azure AI Foundry is Microsoft's **unified platform for building, evaluating, and deploying AI applications** at enterprise scale. Think of it as the control plane for your entire AI lifecycle — from model selection through production monitoring. For the orchestration SDKs that build on Foundry, see [O1: Semantic Kernel](./o1-semantic-kernel.md). For infrastructure underpinning Foundry deployments, see [O5: AI Infrastructure](./o5-infrastructure.md).

:::tip Think of it this way
If Azure Resource Manager (ARM) is the control plane for Azure infrastructure, **Azure AI Foundry is the control plane for AI workloads** — model deployment, prompt management, evaluation, and safety all in one place.
:::

## Evolution

```
Azure ML Studio (2015)  →  Azure AI Studio (2023)  →  Azure AI Foundry (GA 2024+)
   ML training only         AI + ML unified             Full AI lifecycle platform
                            Preview                      Production-ready
```

Each generation expanded scope: ML-only → AI experiments → enterprise AI lifecycle management.

## Three Interfaces, One Platform

| Interface | Best For | Example |
|-----------|----------|---------|
| **Portal** ([ai.azure.com](https://ai.azure.com)) | Exploration, visual evaluation, prompt playground | Try models, compare outputs, review evals |
| **Python SDK** (`azure-ai-projects`) | Programmatic access, CI/CD integration, automation | Build evaluation pipelines, deploy models |
| **CLI** (`az ml`) | Scripting, infrastructure automation | Provision hubs/projects in pipelines |

All three interfaces manage the same underlying resources — choose based on your workflow.

## Hub and Project Model

Foundry uses a **two-tier workspace hierarchy** that separates shared infrastructure from team workspaces:

```
┌────────────────────────────────────────┐
│              AI Hub                     │
│  Shared: connections, compute,          │
│  networking, security policies          │
│                                         │
│  ┌──────────────┐  ┌──────────────┐    │
│  │  Project A   │  │  Project B   │    │
│  │  Team Alpha  │  │  Team Beta   │    │
│  │  - Endpoints │  │  - Endpoints │    │
│  │  - Evals     │  │  - Evals     │    │
│  │  - Flows     │  │  - Flows     │    │
│  └──────────────┘  └──────────────┘    │
└────────────────────────────────────────┘
```

### Hub (Organization Level)

| Responsibility | What It Manages |
|---------------|-----------------|
| **Connections** | Azure OpenAI, AI Search, Storage — shared across projects |
| **Compute** | Shared compute instances for training and inference |
| **Networking** | Private endpoints, VNet integration, firewall rules |
| **Security** | RBAC policies, managed identity, Key Vault integration |
| **Governance** | Content safety policies, model access controls |

### Project (Team Level)

| Responsibility | What It Manages |
|---------------|-----------------|
| **Endpoints** | Model deployments specific to this team |
| **Evaluations** | Quality metrics, test datasets, evaluation runs |
| **Prompt Flow** | RAG/agent orchestration flows |
| **Data** | Datasets, indexes, and data connections |
| **Artifacts** | Prompt versions, flow snapshots, evaluation history |

:::info Hub ↔ Project relationship
One Hub → many Projects. Projects inherit the Hub's connections and security. Teams get isolation (their own endpoints, evals, data) while sharing expensive infrastructure (compute, networking).
:::

## Model Catalog

Foundry's Model Catalog provides access to **1,700+ models** from multiple providers:

| Provider | Notable Models | Deployment Type |
|----------|---------------|-----------------|
| **OpenAI** | GPT-4o, GPT-4o-mini, o1, o3 | Managed (Azure OpenAI) |
| **Meta** | Llama 3.1 (8B/70B/405B) | Serverless API or Managed Compute |
| **Mistral** | Mistral Large, Mixtral | Serverless API |
| **Cohere** | Command R, Command R+ | Serverless API |
| **Microsoft** | Phi-3, Phi-3.5, Florence | Serverless API or Managed Compute |

### Deployment Types

| Type | How It Works | Billing | Best For |
|------|-------------|---------|----------|
| **Serverless API** | Pay-per-token, no infrastructure to manage | Token-based pricing | Variable/unpredictable workloads |
| **Managed Compute** | Dedicated VM(s) running the model | VM hourly rate | Consistent high throughput, custom models |
| **Global** | Microsoft-hosted, multi-region | Token-based pricing | Highest availability, lowest latency |

For GPU sizing and PTU vs PAYG decisions, see [O5: AI Infrastructure](./o5-infrastructure.md).

## Evaluation Pipelines

Foundry provides **built-in evaluation** for measuring AI quality — critical for production deployments:

### Built-in Metrics

| Metric | What It Measures | Scale | Target |
|--------|-----------------|-------|--------|
| **Groundedness** | Are claims supported by the provided context? | 1–5 | ≥ 4.0 |
| **Relevance** | Does the response address the user's question? | 1–5 | ≥ 4.0 |
| **Coherence** | Is the response logically structured and readable? | 1–5 | ≥ 4.0 |
| **Fluency** | Is the language natural and grammatically correct? | 1–5 | ≥ 4.0 |
| **Similarity** | How close is the response to a ground truth answer? | 1–5 | ≥ 3.5 |

### Running Evaluations

```python
from azure.ai.projects import AIProjectClient
from azure.ai.evaluation import GroundednessEvaluator, RelevanceEvaluator

project = AIProjectClient.from_connection_string(conn_str)

# Create evaluators
groundedness = GroundednessEvaluator(model_config)
relevance = RelevanceEvaluator(model_config)

# Evaluate a dataset
results = project.evaluations.create(
    data="test_dataset.jsonl",
    evaluators={
        "groundedness": groundedness,
        "relevance": relevance,
    },
)
print(results.metrics)
# {"groundedness": 4.3, "relevance": 4.1}
```

:::warning
Never deploy an AI application without running evaluations first. Evaluation is not optional — it's the **quality gate** between development and production. Set minimum thresholds and fail the pipeline if they're not met.
:::

## Prompt Flow

Prompt Flow is Foundry's **visual orchestration tool** for building RAG and agent pipelines:

```
┌──────────┐    ┌─────────────┐    ┌──────────┐    ┌──────────┐
│  Input    │───►│  Embedding  │───►│  Search  │───►│  LLM     │──► Output
│  (query)  │    │  (vectorize)│    │  (retrieve)│   │  (generate)│
└──────────┘    └─────────────┘    └──────────┘    └──────────┘
```

| Feature | Description |
|---------|-------------|
| **Visual editor** | Drag-and-drop DAG for prompt chains |
| **Variants** | A/B test different prompts side by side |
| **Bulk testing** | Run flows against test datasets |
| **Deployment** | One-click deploy to managed endpoint |
| **Tracing** | Step-by-step execution trace for debugging |

## When to Use What

| Scenario | Use |
|----------|-----|
| Quick model experimentation | Portal playground |
| Building a RAG pipeline | Prompt Flow + AI Search connection |
| Automated evaluation in CI/CD | Python SDK + evaluation pipeline |
| Deploying to production | Managed endpoint with content safety |
| Multi-team AI development | Hub + per-team Projects |

## Key Takeaways

1. **Azure AI Foundry** is the unified control plane for the AI lifecycle — build, evaluate, deploy, monitor
2. The **Hub/Project model** separates shared infrastructure from team workspaces
3. The **Model Catalog** provides 1,700+ models with serverless or managed deployment options
4. **Evaluation pipelines** with built-in metrics are essential quality gates before production
5. **Prompt Flow** provides visual orchestration for RAG and agent pipelines
6. Use the Portal for exploration, SDK for automation, CLI for infrastructure scripting
