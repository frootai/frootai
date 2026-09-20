# Integration Guide

## Cost Management

Use Cost Management Query for bounded summaries and track request, Query Processing Unit, entity, tenant, and client-type quota headers when supplied. Use Cost Details `2025-03-01` only after capability negotiation: it is an EA/MCA path, does not support resource-group or management-group scopes, accepts at most one month per request, and exposes up to 13 months of history. Cache the result and never automatically retry its generation POST. Use recurring Exports when detail ingestion is large or continuous; Microsoft guidance identifies Exports as the scalable path and recommends moving above roughly 2 GB of monthly detail.

Refresh current cost details at most daily. Azure source data generally updates every four hours, so more frequent polling increases throttle risk without producing fresher results.

The 24-hour degraded snapshot age is a serving ceiling, not universal analytical freshness. Each recommendation rule declares its own evidence-age and coverage requirements. Reads never start refresh work; only an explicit operator command or configured schedule can do so.

## Azure Advisor

Use stable `2025-01-01` and filter Category to Cost at the service boundary. Preserve subscription-scoped findings and resource-scoped findings separately. Advisor values are recommendation evidence, not realized savings or approval.

## Resource Graph and Monitor

Use Resource Graph `2022-10-01` with projected columns and bounded pagination. Normalize only syntactically valid Azure resource IDs; count unsupported records and reduce completeness instead of silently dropping them.

Use Monitor metrics `2023-10-01` for one reviewed rightsizing profile. Prefer the metrics batch API for multiple resources to reduce throttling. Rightsizing requires 14–28 days, at least 95% metric coverage, and CPU, memory, disk, network, owner, lock, and SKU evidence appropriate to the resource.

## Prices and Commitments

Retail Prices `2023-01-01-preview` is unauthenticated list-price evidence. It is not the customer's billed rate. Prefer authorized billing price evidence when available. Keep reservation and savings-plan scenarios separate from observed charges and realized outcomes.

## FOCUS and FinOps Toolkit

Normalize Azure data against the declared FOCUS 1.2 profile. Preserve source-native fields needed for reconciliation and record conformance checks. General FOCUS 1.4 publication is not proof that every Azure export conforms to 1.4.

Use FinOps Hub only when multi-scope, multi-tenant, long-retention, Power BI, or large export analytics justify it. It is an optional source adapter. The Microsoft FinOps Framework informs Inform, Optimize, and Operate workflow states; it does not replace financial data validation.

## Microsoft Foundry

The preferred solution path uses a Foundry project model through Microsoft Agent Framework and a local Responses-compatible endpoint. Project endpoint and model deployment come from environment configuration. Authentication uses Azure identity.

The ACO Agent receives typed minimized evidence and never raw billing exports. Foundry tracing records safe metadata and hashes, not full cost rows or credentials. Prompt agents are the fastest managed path; a hosted agent is appropriate only when custom container execution is required. The baseline local application does not require creating a hosted agent.

Foundry Toolkit Agent Inspector is the recommended demonstration client after Azure liveliness, validated live evidence, and the ACO activation receipt pass.

## Microsoft 365 Agents Toolkit

Agents Playground can demonstrate a later ACO channel without a full tenant setup. Keep it outside the baseline because Teams publishing adds Bot registration, authentication, tenant consent, tunneling, packaging, and channel-specific testing.

The M365 adapter calls the existing ACO API. It does not own collection, financial logic, opportunity rules, or reports.

## Public Hosted Demo

Container Apps may expose public ingress for a time-bounded solution, but all financial endpoints require Microsoft Entra authentication. The browser uses authorization code with PKCE. The API validates the tenant-specific v2 issuer, audience, signature, expiry, not-before, principal, and app roles. `CostOptimizer.Reader` can view and ask over entitled scopes; `CostOptimizer.Operator` can also refresh and create reports. A deny-by-default tenant + principal + role entitlement maps to allowed scope aliases, and report downloads additionally require owner and scope. Use managed identity for Azure and Foundry calls, minimum zero/maximum one replicas initially, TLS, health probes, bounded concurrency, and explicit expiry and retention.

Blob Storage holds immutable raw FOCUS/source objects and report files. Cosmos DB Serverless holds hot scope-partitioned inventory, summaries, opportunities, report metadata, data health, and the current revision pointer. Publication validates Blob hashes first, then uses one Cosmos transactional batch within `/scopePartition`. A cold start reads that partition and validates referenced Blob hashes; it does not rebuild a local database.

Use one singleton `CosmosClient` with `DefaultAzureCredential`, point reads where possible, continuation tokens, and explicit partition keys. Store monetary amounts as canonical decimal strings, not JSON numbers. Keep raw cost rows out of Cosmos. Use `/principalPartition` with a seven-day TTL for conversation metadata.

Private networking, Front Door/WAF, zone redundancy, and enterprise policy are extension decisions based on the target environment; they are not required to run the baseline solution.

## Environment Variables

The derived product may define:

- `AZURE_AI_PROJECT_ENDPOINT`
- `AZURE_AI_MODEL_DEPLOYMENT_NAME`
- `ACI_TENANT_ID`
- `ACI_SUBSCRIPTION_ID`
- `ACI_ALLOWED_SCOPE`
- `ACI_PROFILE`
- `ACI_PAID_INFERENCE_ENABLED`
- `ACI_DATA_DIRECTORY`
- `APPLICATIONINSIGHTS_CONNECTION_STRING`

No values belong in source control. Startup validates combinations and prints presence only, never values.
