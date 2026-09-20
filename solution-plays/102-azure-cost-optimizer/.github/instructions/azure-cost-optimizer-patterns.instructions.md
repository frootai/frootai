---
description: "Domain patterns for Azure Cost Intelligence evidence, finance, optimization, reporting, Foundry agent tools, and dashboard behavior"
applyTo: "{src,tests,evaluation}/**/*.{cs,ts,tsx,json,jsonl}"
---

# Azure Cost Optimizer Patterns

- Keep collection, normalization, deterministic analysis, reporting, agent explanation, and UI interaction as explicit boundaries.
- Represent money with decimal values plus currency and billed/effective basis.
- Preserve requested period separately from actual source period.
- Record tenant, scope, API/schema version, collected time, completeness, counts, and content hash on every source receipt.
- Treat missing evidence as unknown and incomplete pages as incomplete.
- Treat Advisor and retail pricing as estimates; realized savings require post-change evidence.
- Build all exports from one immutable report object.
- Restrict provider calls to refresh jobs. UI filters and charts use local state.
- Coalesce identical refreshes and honor Retry-After with validated snapshot fallback.
- Keep model input minimized and typed. Every numeric answer cites evidence.
- Refuse Azure write operations in the MVP.
- Keep FinOps Hub and Microsoft 365 channels optional until the baseline passes.

## Required Test Cases

Cover credits, mixed currency rejection, billed/effective separation, subscription-scoped charges, partial source data, duplicate refreshes, 429 fallback, cross-tenant access, stale evidence, unsupported model numbers, write refusal, report parity, zero-call UI interaction, and mobile layout.
