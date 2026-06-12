# 🏗️ FrootAI Bicep Registry — Solution Accelerator

> Reusable Azure infrastructure modules for AI workloads. Built on [Azure Verified Modules (AVM)](https://azure.github.io/Azure-Verified-Modules/).

## Status & Scope (Phase 3 OT-11 — May 3, 2026)

> **This folder is documentation-only.** It explains the AVM-first philosophy that all FrootAI solution plays follow. **No Bicep modules live here.** The actual per-play `infra/` Bicep modules live in the **sister repo** at [`c:\CodeSpace\frootai\solution-plays\<NN-name>\infra\`](https://github.com/frootai/frootai/tree/main/solution-plays).

| Concern | Where it lives |
|---------|----------------|
| Per-play infra modules (`main.bicep`, AVM references) | Sister repo `solution-plays/NN-name/infra/` |
| AVM module catalog (the table below) | This README — narrative explainer only |
| Distribution / release of AVM module wrappers | None — we use AVM directly via `br/public:avm/...` |

**OT-11 verdict:** **Keep as-is.** This folder is not duplicate code with sister `infra/`; it is the strategic narrative for why we use AVM modules instead of authoring our own. It belongs in `frootai-core` (distribution monorepo) because the Solution Accelerator philosophy applies to every channel that ships infra (CLI deploy templates, Function-app templates, etc.), not just the per-play deployments in sister.

## Philosophy

FrootAI infrastructure follows the **Solution Accelerator** approach:

1. **Skeleton structure** — Each play ships with a single `infra/main.bicep` as a starting point
2. **Agent-driven expansion** — Your co-coder (Copilot) can split `main.bicep` into separate modules (function app, storage, OpenAI as standalone files)
3. **Azure Verified Modules** — We leverage Microsoft-maintained AVM modules wherever possible. You don't maintain the infra code — Microsoft does.

```bicep
// Example: Using Azure Verified Modules in a FrootAI solution play
module openai 'br/public:avm/res/cognitive-services/account:0.9.1' = {
  name: 'openaiDeployment'
  params: {
    name: 'frootai-openai-${uniqueString(resourceGroup().id)}'
    location: location
    kind: 'OpenAI'
    sku: 'S0'
    managedIdentities: { systemAssigned: true }
    deployments: [
      { name: 'gpt-4o', model: { format: 'OpenAI', name: 'gpt-4o', version: '2024-11-20' }, sku: { name: 'Standard', capacity: 10 } }
    ]
  }
}

module search 'br/public:avm/res/search/search-service:0.7.1' = {
  name: 'aiSearch'
  params: {
    name: 'frootai-search-${uniqueString(resourceGroup().id)}'
    location: location
    sku: 'standard'
    semanticSearch: 'standard'
    managedIdentities: { systemAssigned: true }
  }
}
```

## Available Modules

| Module | AVM Reference | Description | Source Play |
|--------|--------------|------------|------------|
| `ai-landing-zone` | `avm/res/network/virtual-network` + `avm/res/network/private-endpoint` | VNet + PE + RBAC + GPU quota | Play 02, 11 |
| `openai-deployment` | `avm/res/cognitive-services/account` | Azure OpenAI with managed identity | Play 01, 03 |
| `ai-search-index` | `avm/res/search/search-service` | AI Search with semantic ranking | Play 01, 09 |
| `container-app-ai` | `avm/res/app/container-app` | Container App for AI workloads | Play 01, 03, 07 |
| `apim-ai-gateway` | `avm/res/api-management/service` | APIM with AI policies (caching, tokens) | Play 14 |
| `aks-gpu-cluster` | `avm/res/container-service/managed-cluster` | AKS with GPU node pools | Play 12 |
| `doc-intelligence` | `avm/res/cognitive-services/account` | Document Intelligence pipeline | Play 06, 15 |
| `speech-services` | `avm/res/cognitive-services/account` | Communication Services + Speech | Play 04 |

## How It Works

```
solution-plays/XX-name/
└── infra/
    ├── main.bicep              ← Skeleton (starting point)
    └── parameters.json         ← Configurable knobs

Your co-coder can expand this to:
    ├── main.bicep              ← Orchestrator
    ├── modules/
    │   ├── openai.bicep        ← Uses AVM: avm/res/cognitive-services/account
    │   ├── search.bicep        ← Uses AVM: avm/res/search/search-service
    │   ├── storage.bicep       ← Uses AVM: avm/res/storage/storage-account
    │   └── networking.bicep    ← Uses AVM: avm/res/network/virtual-network
    └── parameters.json
```

> **Key insight**: The agent decides the architecture. We give the skeleton. The AVM modules are maintained by Microsoft. You focus on the AI layer.

## Azure Verified Modules (AVM)

FrootAI leverages [AVM](https://azure.github.io/Azure-Verified-Modules/) — Microsoft-maintained, tested, and versioned Bicep modules:

- **Registry**: `br/public:avm/res/...` (public Bicep registry)
- **Maintained by**: Microsoft Azure teams
- **Benefits**: Tested, secure by default, kept up-to-date, WAF-aligned
- **Browse**: [AVM Module Index](https://azure.github.io/Azure-Verified-Modules/indexes/bicep/)

## Contributing

Extract a reusable module from any solution play's `infra/main.bicep` and submit a PR.
See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.
