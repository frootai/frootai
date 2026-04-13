---
description: "Azure AI Foundry config — Hub/Project RBAC, deployment types, evaluation pipeline, content filter config."
applyTo: "**/*.bicep, **/*.json"
waf:
  - "security"
  - "operational-excellence"
---

# Azure AI Foundry — FAI Standards

## Hub/Project Architecture

- **Hub** = shared infrastructure (networking, storage account, Key Vault, Container Registry, Application Insights). One Hub per region per environment.
- **Project** = team workspace scoped to a Hub. Each Project gets its own model deployments, connections, indexes, and Prompt Flow endpoints.
- Never share a Project across teams — create separate Projects under the same Hub for isolation.
- Hub owns the managed virtual network — Projects inherit its private endpoint configuration.

```bicep
resource hub 'Microsoft.MachineLearningServices/workspaces@2024-10-01' = {
  name: aiHubName
  kind: 'Hub'
  identity: { type: 'SystemAssigned' }
  properties: {
    storageAccount: storageAccount.id
    keyVault: keyVault.id
    applicationInsights: appInsights.id
    managedNetwork: { isolationMode: 'AllowInternetOutbound' }
  }
}
resource project 'Microsoft.MachineLearningServices/workspaces@2024-10-01' = {
  name: aiProjectName
  kind: 'Project'
  properties: { hubResourceId: hub.id }
}
```

## RBAC & Access Control

- **Azure AI Developer** — deploy models, create Prompt Flows, run evaluations. Assign to ML engineers.
- **Azure AI Inference Deployment Operator** — deploy/manage inference endpoints only. Assign to ops teams.
- **Reader** on Hub for developers who only need Project-level access.
- Never assign Owner/Contributor on Hub — use scoped custom roles.
- Assign roles at Project scope, not Hub — use `subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleId)`.

## Model Deployments

| Type | Use Case | Billing | SLA |
|------|----------|---------|-----|
| **Standard** | Single-region, dedicated capacity | Per-token | 99.9% |
| **Global-Standard** | Multi-region auto-routing, highest availability | Per-token | 99.99% |
| **Provisioned (PTU)** | Predictable throughput, latency-sensitive | Reserved PTUs | 99.9% |

- Default to **Global-Standard** for dev/test and variable workloads.
- Use **Provisioned** only when you need guaranteed throughput (>50 RPM sustained).
- Set `version_upgrade_option: 'OnceCurrentVersionExpired'` — never auto-upgrade in production.
- Always set `sku.capacity` explicitly — Foundry does not auto-scale deployments.

## Model Catalog

- **Azure OpenAI**: GPT-4o, GPT-4o-mini, o3-mini, text-embedding-3-large — first choice for most tasks.
- **Meta Llama 3.1/3.2**: Use via Models-as-a-Service (MaaS) for open-weight requirements or data sovereignty.
- **Mistral Large/Nemo**: MaaS serverless — strong for EU-region multilingual workloads.
- Pin model versions in config. Never use `latest` — causes silent behavior changes.

## Prompt Flow Orchestration

- Build all LLM chains as Prompt Flows — provides versioning, tracing, and managed endpoints.
- Use `flow.dag.yaml` for DAG-based flows, Python flex flows for complex branching.
- Connection references use Foundry connection names — never inline credentials.

```python
from promptflow.core import tool
from promptflow.connections import AzureOpenAIConnection

@tool
def answer_question(question: str, conn: AzureOpenAIConnection) -> str:
    from openai import AzureOpenAI
    client = AzureOpenAI(azure_endpoint=conn.api_base, api_key=conn.api_key, api_version="2024-12-01-preview")
    resp = client.chat.completions.create(
        model=conn.deployment_name, messages=[{"role": "user", "content": question}], temperature=0.3
    )
    return resp.choices[0].message.content
```

## Evaluation Pipelines

- Run evaluations before every production deployment — gate on quality thresholds.
- Built-in metrics: **groundedness** >= 4.0, **relevance** >= 4.0, **fluency** >= 4.0, **coherence** >= 4.0 (1-5 scale).
- Add **similarity** when comparing against golden answers. Add **F1 score** for extraction tasks.
- Log all evaluation runs to the Project for auditability.

```python
from azure.ai.evaluation import GroundednessEvaluator, RelevanceEvaluator
from azure.identity import DefaultAzureCredential

credential = DefaultAzureCredential()
groundedness = GroundednessEvaluator(credential=credential, azure_ai_project=project_scope)
result = groundedness(response="The Eiffel Tower is 330m tall.", context="The Eiffel Tower stands at 330 metres.")
# result["groundedness"] -> 5.0
```

## Content Filtering

- Every deployment MUST have a content filter policy — Foundry blocks unfiltered deployments by default.
- Minimum: `hate`, `sexual`, `self_harm`, `violence` at severity `medium` for both prompt and completion.
- Enable **Prompt Shields** (jailbreak + indirect injection detection) on all user-facing endpoints.
- Enable **Protected Material Detection** for code generation scenarios.
- Custom blocklists for domain-specific profanity or competitor names.

## Connections & Compute
- Use **Connections** for all external service credentials — Azure OpenAI, AI Search, Cosmos DB, custom APIs.
- Connection types: `AzureOpenAI`, `CognitiveSearch`, `CustomKeys`. Never store keys outside Connections.
- Compute instances: `Standard_DS3_v2` for Prompt Flow authoring, GPU SKUs only for fine-tuning.
- Serverless compute for evaluation runs — no idle cost.

## Index Creation for RAG

- Create indexes via Foundry's **Index** asset — wraps AI Search with automatic chunking and embedding.
- Supported sources: Azure Blob, local upload, Git repos, Azure Data Lake.
- Chunking: 512 tokens with 128-token overlap for general docs. Increase to 1024 for legal/code.
- Always specify the embedding model explicitly — `text-embedding-3-large` with 1536 dimensions.

## Tracing & Observability

- Foundry auto-traces Prompt Flow calls to the Hub's Application Insights — don't duplicate.
- Enable `APPLICATIONINSIGHTS_CONNECTION_STRING` on deployed endpoints for custom telemetry.
- Trace correlation: Foundry injects `x-ms-aml-run-id` — propagate through downstream calls.
- Monitor: token consumption per deployment, eval score trends, content filter trigger rates.

## Anti-Patterns

- Do not create Hubs per team — Hubs are shared infra. Use Projects for team isolation.
- Do not use API keys from the Azure Portal instead of `DefaultAzureCredential` and Connections.
- Do not deploy models without content filter policies — will fail in production.
- Do not skip evaluation pipeline — deploying flows without groundedness/relevance gates.
- Do not run fine-tuning on authoring compute — use dedicated GPU compute targets.
- Do not hardcode model versions or endpoint URLs — use Connections and config files.
- Do not share a single Project across environments (dev/staging/prod) — use separate Projects.
- Do not use `latest` model version — pin versions to avoid silent behavior changes.

## WAF Alignment

| Pillar | Foundry Implementation |
|--------|----------------------|
| **Security** | Managed Identity on Hub/Project, RBAC with AI Developer role, Key Vault-backed Connections, Content Safety filters, Private Endpoints on Hub managed network |
| **Reliability** | Global-Standard deployments for multi-region failover, eval gates before production, version pinning, health probes on managed endpoints |
| **Cost Optimization** | Standard deployments for variable load, serverless compute for evals, PTU only for sustained throughput, monitor token usage via App Insights |
| **Operational Excellence** | Prompt Flow versioning + managed endpoints, automated eval in CI/CD, tracing with Application Insights, Bicep IaC for Hub/Project |
| **Performance** | Provisioned throughput for latency-sensitive paths, streaming responses from managed endpoints, chunking tuned per document type |
| **Responsible AI** | Content filtering on every deployment, Prompt Shields enabled, evaluation with groundedness/relevance metrics, Protected Material Detection for code |