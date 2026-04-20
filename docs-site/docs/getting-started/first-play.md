---
sidebar_position: 4
title: Your First Solution Play
description: Build and deploy your first FrootAI solution play — Enterprise RAG (Play 01) — from scaffolding through Azure deployment and evaluation.
---

# Your First Solution Play

This guide walks you through scaffolding, exploring, deploying, and evaluating **Play 01: Enterprise RAG Q&A** — the most popular FrootAI solution play.

## What You'll Build

A production-ready RAG (Retrieval-Augmented Generation) pipeline that deploys:

| Service | Purpose | SKU (Dev) |
|---------|---------|-----------|
| Azure OpenAI | LLM inference (GPT-4o) | S0, 30K TPM |
| Azure AI Search | Vector + hybrid retrieval | Basic |
| Azure Container Apps | Application hosting | Consumption |
| Azure Key Vault | Secrets management | Standard |

## Prerequisites

- FrootAI installed ([Installation](./installation))
- Azure CLI authenticated (`az login`)
- Azure subscription with Contributor role

## Step 1 — Choose Your Play

Browse available plays to find the right fit:

```bash
# List all 100 solution plays
npx frootai plays list

# Get details for Play 01
npx frootai plays get 01
```

:::tip
Use the [Configurator](https://frootai.dev/configurator) for an interactive recommendation wizard that matches your requirements to the best play.
:::

## Step 2 — Initialize the DevKit

Scaffold the complete play structure:

```bash
npx frootai init-devkit 01
cd solution-plays/01-enterprise-rag
```

This creates the full four-kit structure:

```
01-enterprise-rag/
├── .github/                        # DevKit — Copilot brain
│   ├── copilot-instructions.md     #   Always-on solution context (under 150 lines)
│   ├── agents/
│   │   ├── builder.agent.md        #   Builds the RAG pipeline
│   │   ├── reviewer.agent.md       #   Reviews security + quality
│   │   └── tuner.agent.md          #   Validates config + thresholds
│   ├── instructions/
│   │   └── rag-patterns.instructions.md
│   ├── skills/
│   │   └── rag-indexer/SKILL.md    #   Step-by-step indexing procedure
│   └── hooks/
│       └── guardrails.json         #   SessionStart event guardrails
├── config/                         # TuneKit — customer-tunable params
│   ├── openai.json                 #   Model, temperature, tokens
│   └── guardrails.json             #   Quality thresholds
├── spec/                           # SpecKit — architecture docs
│   └── 001-architecture.md
├── infra/                          # Infrastructure — Azure Bicep
│   ├── main.bicep
│   └── parameters.json
├── evaluation/                     # Evaluation pipeline
│   └── test-set.jsonl
└── fai-manifest.json               # FAI Protocol wiring
```

## Step 3 — Explore the Generated Files

### The Manifest (`fai-manifest.json`)

The manifest is the play's DNA — it wires everything together:

```json
{
  "play": "01-enterprise-rag",
  "version": "1.0.0",
  "context": {
    "knowledge": ["R2-RAG-Architecture", "O4-Azure-AI-Services"],
    "waf": ["security", "reliability", "cost-optimization"]
  },
  "primitives": {
    "agents": ["./.github/agents/builder.agent.md"],
    "instructions": ["./.github/copilot-instructions.md"],
    "skills": ["./.github/skills/rag-indexer"],
    "hooks": ["../../hooks/frootai-secrets-scanner/"],
    "guardrails": {
      "groundedness": 0.95,
      "coherence": 0.90,
      "safety": 0,
      "costPerQuery": 0.02
    }
  }
}
```

### TuneKit Config (`config/openai.json`)

Customer-tunable AI parameters — adjust these for your use case:

```json
{
  "model": "gpt-4o",
  "temperature": 0.3,
  "max_tokens": 4096,
  "top_p": 0.95,
  "fallback_model": "gpt-4o-mini"
}
```

## Step 4 — Deploy to Azure

### Create the Resource Group

```bash
PLAY="01-enterprise-rag"
ENV="dev"
RG="rg-frootai-${PLAY}-${ENV}"

az group create --name "$RG" --location eastus2 \
  --tags play="$PLAY" environment="$ENV" managed-by="frootai"
```

### Preview Changes

Always preview before deploying:

```bash
az deployment group what-if \
  --resource-group "$RG" \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --mode Incremental
```

### Deploy Infrastructure

```bash
az deployment group create \
  --resource-group "$RG" \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --name "frootai-${PLAY}-$(date +%Y%m%d)" \
  --mode Incremental
```

:::warning
Ensure you have sufficient Azure OpenAI quota in your target region. Request quota increases in the Azure Portal if needed.
:::

## Step 5 — Run Evaluation

### Validate Primitive Wiring

```bash
# Schema + naming + frontmatter validation
npm run validate:primitives

# Load play in the FAI Engine
node engine/index.js fai-manifest.json --status
```

### Run Quality Gates

```bash
# Evaluate against guardrail thresholds
node engine/index.js fai-manifest.json --eval
```

All guardrails defined in `fai-manifest.json` must pass:

| Metric | Threshold | What It Measures |
|--------|-----------|-----------------|
| Groundedness | ≥ 0.95 | Responses supported by retrieved sources |
| Coherence | ≥ 0.90 | Logical consistency and readability |
| Safety | 0 violations | No harmful content generated |
| Cost per Query | ≤ $0.02 | Token usage within budget |

### Post-Deployment Health Check

```bash
APP_URL="https://your-container-app.azurecontainerapps.io"

# Health check
curl -sf "${APP_URL}/health" | jq .

# Smoke test
curl -sf -X POST "${APP_URL}/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"query":"What is the onboarding process?"}' | jq '.answer'
```

## What's Next?

- **[FAI Protocol](../concepts/fai-protocol)** — understand how the manifest wires primitives
- **[Solution Plays](../concepts/solution-plays)** — explore all 100 plays
- **[Well-Architected Framework](../concepts/well-architected)** — the 6 WAF pillars
- **[How to Contribute](../contributing/how-to-contribute)** — create your own play
