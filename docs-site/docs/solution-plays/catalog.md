---
sidebar_position: 2
title: "Play Catalog"
description: "Complete catalog of FrootAI Solution Plays — 23 production-ready AI blueprints organized by category, complexity, and Azure services."
---

# Play Catalog

The complete catalog of FrootAI Solution Plays. Each play is a **production-ready AI blueprint** with DevKit (agents, skills, instructions), TuneKit (config), infrastructure (Bicep), and evaluation pipelines. See the [Solution Plays Overview](./overview.md) for how plays are structured.

## Full Play Table

| # | Name | Category | Complexity | Key Azure Services |
|---|------|----------|------------|-------------------|
| **01** | Enterprise RAG | RAG | Intermediate | Azure OpenAI, AI Search, Blob Storage, App Service |
| **02** | AI Landing Zone | Infrastructure | Intermediate | VNet, Private Endpoints, Key Vault, Managed Identity |
| **03** | Deterministic Agent | Agents | Intermediate | Azure OpenAI (temp=0, seed), Structured Output |
| **04** | Call Center Voice AI | Voice | Advanced | Speech Services, Azure OpenAI, Event Hub, Container Apps |
| **05** | IT Ticket Resolution | Agents | Intermediate | Azure OpenAI, ServiceNow connector, Logic Apps |
| **06** | Document Intelligence | Document | Intermediate | Document Intelligence, Azure OpenAI, Blob Storage |
| **07** | Multi-Agent Service | Agents | Advanced | Azure OpenAI, Semantic Kernel, Container Apps |
| **08** | Copilot Studio Bot | Copilot | Beginner | Copilot Studio, Dataverse, Power Platform |
| **09** | AI Search Portal | RAG | Intermediate | AI Search, Azure OpenAI, App Service, CDN |
| **10** | Content Moderation | Security | Intermediate | Content Safety, Azure OpenAI, Event Grid |
| **11** | AI Landing Zone (Advanced) | Infrastructure | Advanced | Hub-Spoke VNet, Firewall, DNS, Policy, Governance |
| **12** | Model Serving on AKS | Infrastructure | Advanced | AKS (GPU nodes), vLLM, KEDA, Container Registry |
| **13** | Fine-Tuning Workflow | Fine-Tuning | Advanced | Azure AI Foundry, Azure OpenAI, MLflow |
| **14** | Cost-Optimized AI Gateway | Infrastructure | Intermediate | APIM, Azure OpenAI (multi-region), Redis Cache |
| **15** | Document Processing (Vision) | Document | Intermediate | GPT-4o Vision, Document Intelligence, Blob Storage |
| **16** | Copilot Teams Extension | Copilot | Intermediate | Teams, Bot Framework, Azure OpenAI |
| **17** | AI Observability | Observability | Intermediate | Application Insights, Log Analytics, KQL, Dashboards |
| **18** | Prompt Optimization | Agents | Intermediate | Azure OpenAI, DSPy, A/B Testing |
| **19** | Edge AI | Edge | Advanced | ONNX Runtime, IoT Hub, Container Instances |
| **20** | Real-Time Analytics | Real-Time | Advanced | Event Hub, Stream Analytics, Azure OpenAI, Cosmos DB |
| **21** | Agentic RAG | RAG | Advanced | Azure OpenAI, AI Search, Semantic Kernel, Function Calling |
| **22** | Swarm Orchestration | Agents | Advanced | Azure OpenAI, AutoGen/CrewAI, Container Apps |
| **23** | Browser Agent | Agents | Advanced | Azure OpenAI, Playwright, Container Apps |

## Category Breakdown

### 🔍 RAG & Search — Plays 01, 09, 21

Ground LLM responses in your data using retrieval-augmented generation:

- **01 — Enterprise RAG**: The foundational RAG pattern — chunking, embedding, hybrid search, semantic ranker, citations. Start here.
- **09 — AI Search Portal**: A user-facing search experience with faceted navigation, filters, and AI-powered answers.
- **21 — Agentic RAG**: RAG with agent autonomy — the agent decides when to search, what to search, and how to combine results.

### 🤖 Agents — Plays 03, 05, 07, 18, 22, 23

From single deterministic agents to distributed swarms:

- **03 — Deterministic Agent**: Zero-temperature, seed pinning, structured output. When you need consistent, verifiable results.
- **05 — IT Ticket Resolution**: Classify, route, and resolve IT tickets with AI. Integrates with ServiceNow.
- **07 — Multi-Agent Service**: Supervisor routes to specialist agents. The foundation for complex agentic workflows.
- **18 — Prompt Optimization**: Systematically improve prompts using DSPy optimizers and A/B testing.
- **22 — Swarm Orchestration**: Distributed agent teams with topology management and conflict resolution.
- **23 — Browser Agent**: AI agents that navigate and interact with web pages using Playwright.

### 🏗️ Infrastructure — Plays 02, 11, 12, 14

Production-grade Azure foundations for AI workloads:

- **02 — AI Landing Zone**: Secure foundation — VNet, private endpoints, managed identity, RBAC.
- **11 — AI Landing Zone (Advanced)**: Hub-spoke networking, Azure Firewall, DNS, governance policies.
- **12 — Model Serving on AKS**: Self-host open-source models on GPU-enabled AKS with vLLM.
- **14 — Cost-Optimized AI Gateway**: APIM-based gateway with semantic caching, model routing, token metering.

### 🔒 Security — Play 10

- **10 — Content Moderation**: End-to-end content safety pipeline with Azure AI Content Safety.

### 🎙️ Voice — Play 04

- **04 — Call Center Voice AI**: Real-time STT → LLM → TTS streaming for voice-based AI assistants.

### 📄 Document Processing — Plays 06, 15

- **06 — Document Intelligence**: Extract structured data from documents using Azure Document Intelligence.
- **15 — Document Processing (Vision)**: Multi-modal document analysis with GPT-4o Vision capabilities.

### 🧩 Copilot Extensions — Plays 08, 16

- **08 — Copilot Studio Bot**: Build a Copilot Studio bot with custom topics, generative answers, and Dataverse.
- **16 — Copilot Teams Extension**: Extend Microsoft Teams with an AI-powered bot using Bot Framework.

### 📊 Observability — Play 17

- **17 — AI Observability**: Monitor AI systems with custom KQL queries, dashboards, and alerting.

### 🧪 Fine-Tuning — Play 13

- **13 — Fine-Tuning Workflow**: End-to-end LoRA/QLoRA fine-tuning with data prep, training, and evaluation.

### 📡 Edge & Real-Time — Plays 19, 20

- **19 — Edge AI**: Deploy AI models to edge devices with ONNX Runtime and IoT Hub.
- **20 — Real-Time Analytics**: Stream processing with AI-powered analysis using Event Hub and Stream Analytics.

## Complexity Levels

| Level | Plays | Description |
|-------|-------|-------------|
| **Beginner** | 08 | Minimal code, visual tools, guided setup |
| **Intermediate** | 01, 02, 03, 05, 06, 09, 10, 14, 15, 16, 17, 18 | Standard Azure + AI patterns, moderate config |
| **Advanced** | 04, 07, 11, 12, 13, 19, 20, 21, 22, 23 | Complex architecture, multi-service, deep expertise |

## Get Started with Any Play

```bash
# 1. Browse plays
npx frootai list plays

# 2. Scaffold a play
npx frootai scaffold 01-enterprise-rag

# 3. Review the architecture
cat .github/copilot-instructions.md

# 4. Customize configuration
code config/openai.json config/guardrails.json

# 5. Deploy infrastructure (Azure plays)
az deployment group create --template-file infra/main.bicep \
  --parameters infra/parameters/dev.bicepparam

# 6. Use the builder agent
# In Copilot Chat: @builder Help me implement the core pipeline
```

:::tip Start with Play 01
If you're new to FrootAI, start with **Play 01 — Enterprise RAG**. It covers the most common AI pattern and teaches you the play structure. Then branch out to agents (Play 03/07), infrastructure (Play 02), or your specific use case.
:::

## Interactive Browser

For the full interactive play browser with filtering, search, and detailed architecture diagrams, visit:

👉 **[frootai.dev/solution-plays](https://frootai.dev/solution-plays)**

## Related Resources

- [Solution Plays Overview](./overview.md) — structure, kits, and how plays work
- [Workshop: Build a RAG Pipeline](../workshops/build-rag-pipeline.md) — hands-on with Play 01
- [Workshop: AI Landing Zone](../workshops/ai-landing-zone.md) — hands-on with Play 02
- [Workshop: Multi-Agent Service](../workshops/multi-agent-service.md) — hands-on with Play 07
- [T3: Production Patterns](../learning/t3-production-patterns.md) — architecture patterns used across plays
