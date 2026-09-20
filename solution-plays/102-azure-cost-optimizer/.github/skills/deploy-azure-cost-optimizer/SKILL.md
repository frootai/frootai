---
name: deploy-azure-cost-optimizer
description: "Use when planning or deploying the user Azure Cost Optimizer foundation, model, immutable image, Container App, OpenAPI/MCP agents, smoke tests, rollback, pre-demo refresh, or cleanup."
---

# Deploy Azure Cost Optimizer Solution

## Preconditions

- `npm run validate` passes.
- Subscription, tenant, authority, region, naming, owner, expiry and tags are recorded.
- Exact Azure reads/writes, roles, model spend, deployment and cleanup have separate approvals.
- The global Azure CLI default remains unchanged.

## Foundation

Run `ops/solution-infra.ps1 -Stage Plan`. Review `.solution/infra-what-if.json`. Unexpected delete, replacement, role, region, resource, or spend change blocks apply. Apply uses Incremental mode.

The foundation creates the solution-owned resource group, identity, ACR, Container Apps environment, Storage, Cosmos Serverless, Application Insights, Log Analytics and Foundry project. The model deployment remains a separate availability/cost decision.

## Policy Metadata

`SecurityControl` is optional organization policy metadata. Set a value only when the user's subscription owner approves that exact value. It does not replace secure resource configuration or authorization.

## Model

Use current Microsoft Foundry workflows to check model capability, region, quota, SKU, capacity and price. Recommend a tool-capable structured-output model. Stop before model deployment and paid inference.

## Image

Use `ops/solution-image.ps1`. ACR remote build avoids local Docker. Resolve the tag to an immutable digest and place only the digest in `.solution/app.parameters.json`.

## Authentication

Default to Container Apps Easy Auth. Use `ops/solution-auth.ps1 -Stage Plan`, review, and then Apply. It writes the client secret only to ignored `.solution/auth.private.json` with restricted local ACLs and never prints the secret.

Public-anonymous mode is a separately approved, time-bounded demo exception. It must never be presented as production hosting.

## Application

Run `ops/solution-app.ps1 -Stage Plan`. Review the saved what-if, then Apply. Capture previous image digest and non-image configuration fingerprint before promotion.

## Channels

The web application is primary. Optionally create:

- OpenAPI prompt agent over the bounded REST subset;
- MCP prompt agent over nine read-only tools.

The supplied Foundry script requires `-AllowAnonymousDemo`; authenticated agent tools require approved Foundry connections and are not silently synthesized.

## Smoke

Run `ops/solution-smoke.ps1`. Model smoke is optional and requires `-IncludeAgent` plus inference approval. Validate periods, evidence, reports, write refusal, MCP, desktop/mobile and no overflow.

## Rollback

Run `ops/solution-app.ps1 -Stage Rollback -PreviousImageDigest <digest>`. It performs what-if before the image rollback. Do not delete shared resources or evidence during rollback.

## Pre-Demo

Run `ops/pre-demo.ps1` once with an approved export. It triggers one export, refreshes MTD evidence, prints the portal-comparison total and optionally runs ten model questions.

## Cleanup

Run `ops/solution-cleanup.ps1 -Stage Plan`. Apply requires the exact resource-group name and refuses groups missing solution ownership tags. Shared resources outside the solution group are never deleted.
