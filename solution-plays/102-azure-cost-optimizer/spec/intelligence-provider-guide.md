# ACO Intelligence Provider Guide

The cost evidence engine is provider-independent. Subscription selection, Cost Management, Advisor, Resource Graph, caching, deterministic totals, reports, and human review remain identical across intelligence providers.

## Provider Profiles

| Profile | Provider | Authentication | Status |
|---|---|---|---|
| Existing Microsoft Foundry project | `foundry` | Host Azure identity | Existing `AIProjectClient.AsAIAgent` path retained; not re-invoked for this slice |
| Existing Azure OpenAI deployment | `azure-openai` | `identity` | Implemented with pinned Azure.AI.OpenAI 2.1.0; live authorization/inference not verified |
| Existing Azure OpenAI deployment | `azure-openai` | `api-key` | Implemented with the same SDK; live authorization/inference not verified |
| Cost-only | `none` | No model credential | Deterministic cost views and reports; no model calls |

All model paths retain Microsoft Agent Framework, the same eight typed read-only tools, scope/report-bound sessions, evidence validation, and the current six-model-call, six-tool-call, 32,768-output-token, 150-second maximum budgets. Fast effort uses three model calls and three tool calls. Azure OpenAI SDK retries are disabled to avoid hidden HTTP amplification; the Foundry path is unchanged. There is no automatic provider or credential fallback.

## Guided Selection Contract

Configure the supplied backend, frontend, and infrastructure; do not regenerate them. The existing launcher first selects an enabled subscription, without changing the global Azure CLI default, then asks for a provider:

```text
Choose the intelligence provider:

1. Existing Microsoft Foundry project
2. Existing Azure OpenAI deployment using Azure identity
3. Existing Azure OpenAI deployment using an API key from the process environment
4. Cost-only (no model calls)
```

An explicit `-Provider` or `ACI_AI_PROVIDER` skips the menu. Only missing, nonsecret endpoint/deployment values are requested through the console. `-AzureOpenAIAuthMode` selects `identity` or `api-key`; identity is the default for Azure OpenAI.

`-CheckOnly` checks local runtime availability, the enabled subscription, resource-group read access, endpoint shape, and required configuration. It does not invoke a model, verify cost-data/model data-plane permissions, assign roles, provision resources, or change the CLI default. Its receipt says `configuration-checked`, not live-provider certified.

## Environment Variables

| Variable | Meaning |
|---|---|
| `ACI_AI_PROVIDER` | `foundry` (runtime default), `azure-openai`, or `none` |
| `ACI_DATA_PROFILE` | `solution_snapshot` always blocks model access, even with leaked provider settings or an API key; `live` permits the selected provider after safety/evidence checks |
| `AZURE_AI_PROJECT_ENDPOINT` | Foundry HTTPS project endpoint ending in `/api/projects/<project-name>` |
| `AZURE_AI_MODEL_DEPLOYMENT_NAME` | Existing Foundry deployment name |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI HTTPS resource root, such as `https://<resource>.openai.azure.com/`; no project/deployment/chat path, user info, query, or fragment |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | Existing Azure OpenAI deployment name |
| `AZURE_OPENAI_AUTH_MODE` | `identity` (default) or explicitly selected `api-key` |
| `AZURE_OPENAI_API_KEY` | Required only for `api-key`; externally supplied secret, never a launcher parameter |
| `ACI_SUBSCRIPTION_ID`, `ACI_TENANT_ID` | Explicit cost-data scope selected by the launcher |
| `ACI_HOSTING_PROFILE` | The launcher sets `local`. Existing `hosted_demo` uses the host's DefaultAzureCredential; hosted authorization is outside this slice |
| `AZURE_CLIENT_ID` | Optional existing managed-identity client ID used by the hosted credential |
| `ACI_AUTO_REFRESH` | The launcher sets `true` for initial live cost collection; this does not invoke the model |

Local identity uses the host's subscription-scoped Azure CLI credential. Hosted identity reuses the host's DefaultAzureCredential, including its managed-identity configuration. Neither adapter acquires credentials in snapshot mode. A leaked API key does not switch identity mode to key mode.

The source `config/openai.json` documents these choices; runtime selection uses the environment/configuration keys above, not JSON placeholder interpolation. The SDK pins the Azure OpenAI API version; a custom API-version override is not exposed in this slice.

## Start the Supplied Package

```powershell
.\ops\start-demo.ps1
.\ops\start-demo.ps1 -Provider azure-openai -AzureOpenAIAuthMode identity
.\ops\start-demo.ps1 -Provider azure-openai -AzureOpenAIAuthMode api-key
.\ops\start-demo.ps1 -Provider none
.\ops\start-demo.ps1 -Provider none -CheckOnly
```

Use `-FoundryProjectEndpoint`, `-AzureOpenAIEndpoint`, and `-ModelDeploymentName` for nonsecret inputs. The API-key example requires the secret to be supplied externally beforehand. Each invocation is an alternative, not a sequence to run together. Cost-only still collects live Azure cost evidence; it is not the offline snapshot profile.

A published package includes `ops/start-demo.ps1`, this guide, and `aco-system-prompt.md` beside the application DLL. The launcher detects the published assembly and runs it directly with the package content root. The ASP.NET Core 10 runtime and Azure CLI are sufficient for the live local launcher; no Node, npm, SDK, Docker, or source checkout is needed for an already built package.

From source, Node.js 24 and npm are needed only when rebuilding missing dashboard assets or using `-Rebuild`. The .NET 10 SDK is needed only when compiling the backend. `-Rebuild` is not supported on a published package. `-Port` selects an available loopback port; no existing host is stopped.

The service resolves the prompt only as `Path.Combine(AppContext.BaseDirectory, "aco-system-prompt.md")`. It never searches parent directories or uses the current working directory. Missing, empty, or unreadable prompt content disables AI while deterministic endpoints remain usable. The launcher rejects an AI-enabled package missing that prompt; `-Provider none` remains available.

For offline use, run the supplied DLL with `ACI_DATA_PROFILE=solution_snapshot` and `ACI_AI_PROVIDER=none` instead of the live launcher. That profile does not require Azure CLI or provider credentials. Local default data mode is snapshot; hosted default data mode remains live.

## Azure OpenAI API-Key Profile

Identity is preferred. API-key mode is an explicit compatibility option, not an authorization retry or fallback.

- Never paste an API key into Copilot Chat.
- Never pass an API key as a command-line argument.
- Never write an API key to source control, a delivery contract, a parameter file, or terminal output.
- Inject `AZURE_OPENAI_API_KEY` from an approved secret manager or a user-controlled non-echoing console flow before launching. The launcher has no key parameter and does not request or print the key.
- The launcher leaves the externally owned key untouched and restores every nonsecret process variable it changes on exit. The secret supplier is responsible for clearing the key from the parent process when finished.

## User Azure Requirements

For the local demo, each user needs:

- Azure CLI authenticated to the tenant containing the selected subscription
- An enabled subscription selected explicitly by the user
- Read access to Resource Graph and Advisor, normally through `Reader`
- Cost data access, normally through `Cost Management Reader`
- For AI-enabled modes only, access to one existing deployment through the selected provider; Azure OpenAI identity normally requires `Cognitive Services OpenAI User` on that resource
- The .NET 10 ASP.NET Core runtime; build tools only when rebuilding source

Role assignments must be prepared by an authorized administrator; the launcher never assigns them. No Docker daemon, database, ACR, Container Apps, Entra app registration, private network, or new Azure resource is required for the local demo. Hosted ingress/authentication and infrastructure changes are not part of this provider slice.

## Acceptance

A successful build is not proof of live provider access. No Azure resource operations or model calls are made as part of this slice's verification. Live Azure OpenAI identity and API-key validation remain pending explicit approval with a real deployment.

Before claiming a provider is live-ready, the owning integration workflow must verify:

1. The selected subscription remains explicit and the Azure CLI default is unchanged.
2. Real cost, Advisor, and Resource Graph evidence loads once and is cached.
3. One explicitly authorized ACO response is labeled AI-generated.
4. Numeric claims cite supplied evidence IDs.
5. Risks, missing evidence, and a human-reviewed next action are present.
6. Tenant IDs, subscription IDs, resource IDs, API keys, and raw billing rows are absent from model input and output.

No broad tuning, hosted certification, new model provisioning, or automatic live smoke test is implied by these changes.