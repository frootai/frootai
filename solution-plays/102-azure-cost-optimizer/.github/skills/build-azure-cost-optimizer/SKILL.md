---
name: build-azure-cost-optimizer
description: "Use when starting or continuing the Azure Cost Optimizer public solution: select a track, verify prerequisites, configure subscription/provider/model choices, run locally, and prepare deployment inputs."
---

# Build Azure Cost Optimizer Solution

## Purpose

Guide one user from a clean workstation to a validated local Azure Cost Optimizer. Use the complete supplied v99 source; do not scaffold a second app or redesign the frontend.

## Read First

1. `AzureCostOptimizerGuide.md`
2. `architecture.md`
3. `spec/solution-delivery-contract.v1.json`
4. `spec/runtime-contract.v1.json`
5. `config/guardrails.json`

## Decision Interview

Ask one question at a time:

- Track: sample, live-local, hosted web, or Foundry channels
- Explicit subscription and tenant
- Authority: read-only, grant authority, or unsure
- Region, prefix, resource group, owner, expiry
- Query, Cost Details, or Exports
- Cost-only, existing provider, or approved model creation
- Entra authentication or explicit public demo exception
- Organization-required policy tags
- Spend/inference bounds
- Rollback and cleanup owners

Record decisions under `.solution/`; never commit them.

## Local Sample

```powershell
.\ops\doctor.ps1 -Track Local
npm run setup
npm run validate
.\ops\start-solution.ps1 -Mode Sample -Port 8080
```

Expected: sample label, working reports/visuals, zero provider/model calls.

## Live-Local

Run the Azure doctor and CheckOnly first. Pass the selected subscription explicitly. Do not change the Azure CLI default.

```powershell
.\ops\start-solution.ps1 -Mode Live -SubscriptionId <id> -Provider None -CheckOnly
```

Start cost-only before model activation. Collection remains explicit. Query gets one attempt; Cost Details is a separately selected alternative and is never automatic fallback.

## Provider Selection

- Prefer Microsoft Foundry through Azure identity.
- Azure OpenAI identity or protected API key are supported alternatives.
- Owner does not prove model data-plane access.
- Model creation requires current capacity/region/SKU guidance, cost bounds, expiry and approval.
- Never pass API keys through chat or command arguments.

## Financial Acceptance

Compare the app with Cost Management using identical subscription, dates, Actual cost basis, currency, and collection time. Keep parity pending until explained. Advisor values are estimates and can overlap.

## Completion

Report track, masked scope, evidence provenance, parity, provider/model status, local URL, validation results, blockers, and next decision. Do not call sample, stale, cost-only, or parity-pending states full live success.
