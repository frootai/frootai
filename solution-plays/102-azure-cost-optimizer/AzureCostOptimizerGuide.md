# Azure Cost Optimizer Guide

This guide takes you from a clean VS Code workspace to a validated local experience and, when approved, an Azure Container Apps deployment with Microsoft Foundry agent channels.

The guide is intentionally progressive. Complete one stage, check the result, and then continue. Advanced options are clearly marked.

## 1. What You Will Build

Azure Cost Optimizer is the product. Azure Cost Intelligence is the evidence and decision-support stack underneath it.

The solution:

- reads one explicitly selected Azure subscription;
- collects Azure Cost Management, Azure Advisor, and Azure Resource Graph evidence;
- keeps authoritative totals in deterministic decimal logic;
- exposes typed read-only tools to one ACO Agent;
- streams a five-section checked answer;
- renders charts, tables, decision paths, ownership plans, and reports;
- optionally exposes the same evidence through OpenAPI and MCP prompt agents;
- runs locally or as one Azure Container App.

It does not change Azure resources or claim realized savings.

Read [architecture.md](architecture.md) before setup. It explains the stack and both local and hosted data flows.

## 2. Solution Tracks

Choose the smallest track that meets your goal.

| Track | Outcome | Typical time |
|---|---|---:|
| A. Local sample | Product tour with bundled evidence and no Azure/model calls | 10-15 minutes |
| B. Local live | Real subscription evidence on localhost; model optional | 20-35 minutes plus Azure waits |
| C. Hosted web | Complete frontend and API in Azure Container Apps | 45-90 minutes plus build/provisioning |
| D. Foundry channels | OpenAPI and MCP prompt agents in Foundry Playground | 30-60 minutes after Track C |

Times are planning estimates, not guarantees.

## 3. Prerequisites

### Required for local sample

- Windows 11 or a supported PowerShell environment
- .NET 10 SDK
- Node.js 24 and npm
- VS Code
- GitHub Copilot Chat

### Also required for live Azure or deployment

- Azure CLI
- Azure Bicep CLI through `az bicep`
- Access to an enabled Azure subscription
- Permission to read Cost Management, Advisor, and Resource Graph
- For deployment: permission to create or reuse the selected resources and role assignments

### Also required for model-enabled operation

- An existing Microsoft Foundry project and model deployment, or approval to create them
- Foundry data-plane access for the selected user or managed identity

Check the workstation:

```powershell
.\ops\doctor.ps1 -Track Local
```

For Azure deployment checks:

```powershell
.\ops\doctor.ps1 -Track Azure
```

For Foundry channel checks:

```powershell
.\ops\doctor.ps1 -Track Foundry
```

Expected result: a JSON report with `status: ready`. The doctor never installs software and never changes Azure.

## 4. Open the Copilot Delivery Contract

In VS Code, select **ACO Builder** in the agent picker and send:

```text
Start the Azure Cost Optimizer solution. Ask me the setup questions one at a time, recommend conservative defaults, and stop before every Azure write or paid model action.
```

The builder asks for:

1. solution track;
2. subscription and tenant;
3. authority level: read-only, contributor/grant authority, or unsure;
4. region;
5. naming prefix and resource group;
6. cost source: Query, Cost Details, or Exports;
7. provider: Foundry, Azure OpenAI, or cost-only;
8. existing model reuse or separately approved model creation;
9. local-only or hosted experience;
10. authentication profile and allowed users;
11. organization-required tags, including any approved `SecurityControl` value;
12. spend, expiry, rollback, and cleanup approvals.

The agent must not infer these answers from subscription ownership.

## 5. Select the Correct Azure Context

Sign in directly in the terminal. Never paste credentials or tokens into chat.

```powershell
az login --tenant <tenant-id>
az account list --query "[?state=='Enabled'].{Name:name,Id:id,Tenant:tenantId}" --output table
```

Record your selection without changing the global CLI default:

```powershell
$env:ACO_SUBSCRIPTION_ID = '<subscription-id>'
$env:ACO_TENANT_ID = '<tenant-id>'
az account show --subscription $env:ACO_SUBSCRIPTION_ID --output table
```

Check that the subscription tenant matches your intended tenant.

## 6. Choose a Naming Strategy

Use a short lowercase prefix that identifies team and purpose. The scripts add deterministic suffixes where global uniqueness is required.

Recommended pattern:

```text
Prefix:       <team>-aco-<environment>
ResourceGroup: rg-<team>-aco-<environment>-<region-code>
Example:       contoso-aco-lab
Example RG:    rg-contoso-aco-lab-eus2
```

Set solution values:

```powershell
$env:ACO_PREFIX = 'contoso-aco-lab'
$env:ACO_RESOURCE_GROUP = 'rg-contoso-aco-lab-eus2'
$env:ACO_LOCATION = 'eastus2'
$env:ACO_OWNER = '<your-alias>'
$env:ACO_EXPIRES_ON = '2026-10-01'
```

Names must not contain user tenant IDs, email addresses, or secrets.

## 7. Organization Policy Tags

Some managed subscriptions enforce policy through approved tags. A tag such as `SecurityControl=Ignore` is an organization-specific exception, not a universal Azure setting and not a security feature.

Only set it when your subscription owner or solution operator confirms that exact value is approved:

```powershell
$env:ACO_SECURITY_CONTROL = 'Ignore'
```

Otherwise leave it unset:

```powershell
Remove-Item Env:ACO_SECURITY_CONTROL -ErrorAction SilentlyContinue
```

The Bicep templates keep Blob public access disabled, Cosmos local authentication disabled, and TLS enabled. Public network reachability for a solution is different from anonymous data access.

## 8. Track A: Run the Product Locally with Sample Evidence

Install locked frontend dependencies and build the product:

```powershell
npm run restore:web
npm run build:web
npm run build:backend
```

Start the sample profile:

```powershell
.\ops\start-solution.ps1 -Mode Sample -Port 8080
```

Open:

```text
http://127.0.0.1:8080
```

Expected result:

- `OFFLINE SAMPLE` is visible;
- charts and reports work;
- no Azure provider or model call occurs;
- Ask ACO explains that AI is disabled in sample mode.

Stop with `Ctrl+C` in the owned terminal.

## 9. Track B: Connect Live Cost Evidence Locally

### 9.1 Verify read access

```powershell
.\ops\start-solution.ps1 `
  -Mode Live `
  -SubscriptionId $env:ACO_SUBSCRIPTION_ID `
  -Provider None `
  -CheckOnly
```

The receipt is private. Do not post raw subscription, tenant, principal, or endpoint values in shared chat.

### 9.2 Start cost-only mode

```powershell
.\ops\start-solution.ps1 `
  -Mode Live `
  -SubscriptionId $env:ACO_SUBSCRIPTION_ID `
  -Provider None `
  -CostSource Query `
  -Port 8080
```

The app does not collect at startup. Click **Refresh data** only after read authorization is confirmed.

### 9.3 Compare financial parity

Compare the app with Azure Cost Management using:

- the same subscription;
- the exact requested dates;
- `ActualCost`;
- the billed basis;
- the same currency;
- the displayed collection time.

Record differences as pending until explained. Do not refresh repeatedly to force a match.

## 10. Select a Model

Choose one option.

| Choice | When to use |
|---|---|
| Cost-only | No model access, no paid inference, deterministic dashboard/reports only |
| Reuse Foundry deployment | Preferred when a compatible project/model already exists |
| Reuse Azure OpenAI | Supported identity or protected API-key alternative |
| Create model | Only after region, quota, SKU, capacity, cost, expiry, and RBAC approval |

Recommended solution model characteristics:

- supports tool calling and structured JSON output;
- can complete up to six bounded model rounds for a full review;
- has sufficient output/reasoning budget for the five checked sections;
- is deployed in an approved US region for this solution profile.

Do not hardcode a model name in shared instructions. Availability and capacity change.

### Reuse Microsoft Foundry

```powershell
$env:AZURE_AI_PROJECT_ENDPOINT = 'https://<foundry-account>.services.ai.azure.com/api/projects/<project>'
$env:AZURE_AI_MODEL_DEPLOYMENT_NAME = '<deployment-name>'

.\ops\start-solution.ps1 `
  -Mode Live `
  -SubscriptionId $env:ACO_SUBSCRIPTION_ID `
  -Provider Foundry `
  -FoundryProjectEndpoint $env:AZURE_AI_PROJECT_ENDPOINT `
  -ModelDeploymentName $env:AZURE_AI_MODEL_DEPLOYMENT_NAME `
  -Port 8080
```

Foundry access is data-plane access. Subscription Owner alone does not prove it.

## 11. Validate Locally

Run the complete local gate:

```powershell
npm run validate
```

The gate checks:

- user-safe files and unresolved placeholders;
- JSON/YAML/frontmatter and FAI references;
- Bicep compilation;
- .NET tests;
- frontend type/build tests;
- desktop/mobile Playwright response tests;
- source/OpenAPI/tool-contract consistency;
- no private runtime artifacts in the package tree.

For a running instance:

```powershell
$env:ACO_BASE_URL = 'http://127.0.0.1:8080'
npm run verify:runtime
```

## 12. Azure Hosted Architecture

The full solution host uses:

- Azure Container Registry for the immutable image;
- Azure Container Apps for one frontend/API process;
- user-assigned managed identity;
- private Blob containers for normalized evidence and reports;
- Cosmos DB Serverless for scope-partitioned current-state pointers;
- Application Insights and Log Analytics for bounded telemetry;
- Microsoft Foundry for model inference;
- Azure Cost Management, Advisor, and Resource Graph as read-only evidence sources.

The default user profile uses Microsoft Entra authentication. A public-anonymous demo is not the default and must be explicitly approved as a time-bounded solution exception.

## 13. Provision the Solution Foundation

Review the plan before any write:

```powershell
.\ops\solution-infra.ps1 `
  -Stage Plan `
  -SubscriptionId $env:ACO_SUBSCRIPTION_ID `
  -Location $env:ACO_LOCATION `
  -ResourceGroupName $env:ACO_RESOURCE_GROUP `
  -Prefix $env:ACO_PREFIX `
  -Owner $env:ACO_OWNER `
  -ExpiresOn $env:ACO_EXPIRES_ON
```

Inspect `.solution/infra-what-if.json`.

Apply only after approval:

```powershell
.\ops\solution-infra.ps1 `
  -Stage Apply `
  -SubscriptionId $env:ACO_SUBSCRIPTION_ID `
  -Location $env:ACO_LOCATION `
  -ResourceGroupName $env:ACO_RESOURCE_GROUP `
  -Prefix $env:ACO_PREFIX `
  -Owner $env:ACO_OWNER `
  -ExpiresOn $env:ACO_EXPIRES_ON
```

Expected foundation:

- one solution resource group;
- managed identity;
- Basic ACR;
- Container Apps environment;
- Storage account and private containers;
- Cosmos DB Serverless database/container;
- Application Insights and Log Analytics;
- one Foundry account/project for the full sandbox path. Azure OpenAI remains an explicit reuse alternative and is not created by the foundation.

## 14. Deploy or Reuse a Foundry Model

Model creation is deliberately separate because availability, quota, SKU, and cost vary.

Use GitHub Copilot:

```text
Use the Microsoft Foundry model deployment workflow. Check capacity for my selected region, recommend a tool-capable model for the ACO Agent, show SKU/capacity/cost implications, and stop before deployment for approval.
```

After deployment, record only the project endpoint and deployment name in your protected local environment.

## 15. Build the Container Image

Use ACR remote build; local Docker is not required:

```powershell
.\ops\solution-image.ps1 `
  -SubscriptionId $env:ACO_SUBSCRIPTION_ID `
  -ResourceGroupName $env:ACO_RESOURCE_GROUP `
  -RegistryName '<acr-name>' `
  -Tag 'solution-v1'
```

The script resolves the tag to an immutable digest. Deploy only the digest.

## 16. Deploy the Full Web Experience

### 16.1 Prepare Microsoft Entra authentication

Plan the application registration first:

```powershell
.\ops\solution-auth.ps1 `
  -Stage Plan `
  -TenantId $env:ACO_TENANT_ID `
  -ApplicationName "$env:ACO_PREFIX-signin" `
  -ApplicationUrl 'https://<expected-container-app-fqdn>' `
  -ExpiresOn $env:ACO_EXPIRES_ON
```

Apply only after reviewing `.solution/auth-plan.json`:

```powershell
.\ops\solution-auth.ps1 `
  -Stage Apply `
  -TenantId $env:ACO_TENANT_ID `
  -ApplicationName "$env:ACO_PREFIX-signin" `
  -ApplicationUrl 'https://<expected-container-app-fqdn>' `
  -ExpiresOn $env:ACO_EXPIRES_ON
```

The secret is written only to ignored `.solution/auth.private.json` and is never printed. Copy its values and the foundation/image outputs into a private parameters file:

```powershell
Copy-Item .\infra\solution.parameters.example.json .\.solution\app.parameters.json
code .\.solution\app.parameters.json
```

The expected Container Apps hostname is `<container-app-name>.<environment-default-domain>`. The foundation outputs include the environment domain.

### 16.2 Plan and apply the application

Generate and review what-if:

```powershell
.\ops\solution-app.ps1 `
  -Stage Plan `
  -SubscriptionId $env:ACO_SUBSCRIPTION_ID `
  -ResourceGroupName $env:ACO_RESOURCE_GROUP `
  -ParametersFile '.solution/app.parameters.json'
```

Apply after review:

```powershell
.\ops\solution-app.ps1 `
  -Stage Apply `
  -SubscriptionId $env:ACO_SUBSCRIPTION_ID `
  -ResourceGroupName $env:ACO_RESOURCE_GROUP `
  -ParametersFile '.solution/app.parameters.json'
```

The deployment is incremental. Unexpected delete, replace, role, region, or spend changes block apply.

## 17. Configure Authentication and Roles

Use least privilege at the narrowest supported scope.

| Principal | Typical access | Purpose |
|---|---|---|
| Authorized user | Cost Management Reader and Reader | Cost evidence and inventory |
| Container identity | AcrPull | Pull image |
| Container identity | Storage Blob Data Contributor on required containers | Hosted snapshot/report objects |
| Container identity | Cosmos native data role on one database/container | Current snapshot pointers |
| Container identity | Foundry model data-plane role | Inference |
| Operator | Explicit refresh/application administration | Time-bounded solution operations |

Role names are candidates, not proof of sufficient permissions. Verify required operations before assignment. Never grant automatically.

## 18. Three Experience Channels

### Channel 1: OpenAPI prompt agent

This channel exposes a bounded REST subset to a Microsoft Foundry prompt agent.

```powershell
.\foundry\deploy-aco-foundry-agents.ps1 `
  -Stage OpenApiAgent `
  -SubscriptionId $env:ACO_SUBSCRIPTION_ID `
  -ResourceGroupName $env:ACO_RESOURCE_GROUP `
  -AccountName '<foundry-account>' `
  -ProjectName '<project>' `
  -ModelDeploymentName '<deployment>' `
  -ApplicationUrl 'https://<container-app-fqdn>'
```

Validate in Foundry Playground with a summary, Advisor, freshness, cross-scope refusal, and write refusal.

### Channel 2: MCP prompt agent

Enable `/mcp` only behind the selected hosted authorization profile. The server exposes nine read-only tools over the same deterministic engine.

```powershell
.\foundry\deploy-aco-foundry-agents.ps1 `
  -Stage McpAgent `
  -SubscriptionId $env:ACO_SUBSCRIPTION_ID `
  -ResourceGroupName $env:ACO_RESOURCE_GROUP `
  -AccountName '<foundry-account>' `
  -ProjectName '<project>' `
  -ModelDeploymentName '<deployment>' `
  -ApplicationUrl 'https://<container-app-fqdn>'
```

### Channel 3: Complete web application

Use the Container Apps URL. This is the primary solution experience and includes the complete frontend, reports, evidence drawer, charts, tables, streaming ACO response, and explicit refresh.

The optional hosted-code agent under `foundry/hosted/` is an advanced reference, not required for the three-channel solution.

## 19. Hosted Smoke Tests

```powershell
.\ops\solution-smoke.ps1 `
  -Url 'https://<container-app-fqdn>' `
  -ScopeAlias 'solution-scope'
```

Validate:

- live and ready health;
- authentication boundary;
- current evidence status;
- last 7 days, last 30 days, and month-to-date;
- service and resource-group charts;
- Advisor, WAF, FinOps, RACI, Agile, decision path, and action cards;
- reports: JSON, CSV, HTML, FOCUS, XLSX, PDF;
- MCP read-only annotations and cross-scope denial;
- no horizontal overflow at desktop/mobile widths.

## 20. Pre-Demo Procedure

Run once before the solution, not repeatedly:

```powershell
.\ops\pre-demo.ps1 `
  -Url 'https://<container-app-fqdn>' `
  -SubscriptionId $env:ACO_SUBSCRIPTION_ID `
  -ExportName '<approved-cost-export-name>' `
  -ResourceGroupName $env:ACO_RESOURCE_GROUP
```

The procedure triggers one approved export, refreshes evidence, prints the current total for portal comparison, and runs the ten-question stability pass.

A repeated question can return quickly from semantic cache. Cached output is revalidated against the current snapshot; speed is not evidence of fabrication.

## 21. Rollback

Record the previous digest and configuration fingerprint before every app promotion.

```powershell
.\ops\solution-app.ps1 `
  -Stage Rollback `
  -SubscriptionId $env:ACO_SUBSCRIPTION_ID `
  -ResourceGroupName $env:ACO_RESOURCE_GROUP `
  -PreviousImageDigest '<registry/repository@sha256:...>'
```

Rollback changes only the application image after a reviewed what-if. It does not remove shared resources, roles, data, Foundry projects, or logs.

## 22. Cleanup

Cleanup is optional, explicit, and limited to the solution-owned resource group.

Preview:

```powershell
.\ops\solution-cleanup.ps1 `
  -Stage Plan `
  -SubscriptionId $env:ACO_SUBSCRIPTION_ID `
  -ResourceGroupName $env:ACO_RESOURCE_GROUP
```

Delete only after approval:

```powershell
.\ops\solution-cleanup.ps1 `
  -Stage Apply `
  -SubscriptionId $env:ACO_SUBSCRIPTION_ID `
  -ResourceGroupName $env:ACO_RESOURCE_GROUP `
  -ConfirmResourceGroupName $env:ACO_RESOURCE_GROUP
```

Shared models, registries, identities, or resource groups are never deleted by this command.

## 23. Troubleshooting

### The dashboard says warming

Wait for the explicitly selected period refresh to finish. Check:

```powershell
Invoke-RestMethod 'http://127.0.0.1:8080/api/v1/cache-status?scope=solution-scope&period=mtd'
```

### Owner but model access fails

Owner is management-plane authority, not Foundry data-plane access. Verify the Foundry role on the account/project.

### The same question is instant

The semantic cache can replay a validated answer only inside the current evidence revision. Refresh changes the report/revision and retires the old scope.

### Cost total differs from the portal

Recheck scope, start/end convention, Actual cost, currency, collection time, and excluded rows. Do not average or silently adjust totals.

### A recommendation repeats

Advisor can return separate findings with the same title. ACO groups the family but preserves each estimate and evidence reference. Never sum overlapping estimates before review.

## 24. Completion Checklist

- [ ] Correct subscription and tenant selected
- [ ] Authority level recorded
- [ ] Naming, region, owner, expiry, and policy tags recorded
- [ ] Local sample passes
- [ ] Live evidence authorized and fresh
- [ ] Portal parity compared or explicitly pending
- [ ] Model choice and inference approval recorded
- [ ] Local tests pass
- [ ] Bicep compiles
- [ ] What-if reviewed with no unexpected changes
- [ ] Image pinned by digest
- [ ] Hosted health and authentication pass
- [ ] OpenAPI and MCP agents validated if selected
- [ ] Reports and UI checked at desktop/mobile sizes
- [ ] Rollback digest recorded
- [ ] Cleanup ownership recorded

## 25. What This Solution Does Not Certify

The solution does not certify production security, private networking, high availability, disaster recovery, financial realization, or organizational compliance. Treat those as separate architecture and assurance initiatives.
