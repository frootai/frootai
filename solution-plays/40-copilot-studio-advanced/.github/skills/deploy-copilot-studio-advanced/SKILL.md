---
name: "deploy-copilot-studio-advanced"
description: "Deploy Copilot Studio Advanced — declarative agents, TypeSpec API plugins, Graph API data grounding, adaptive cards, SSO/OAuth2, Power Automate integration."
---

# Deploy Copilot Studio Advanced

## Prerequisites

- Azure CLI authenticated (`az login`)
- Microsoft 365 tenant with Copilot Studio license (Premium)
- Power Platform admin access for environment provisioning
- Azure subscription with these providers registered:
  - `Microsoft.CognitiveServices` (Azure OpenAI)
  - `Microsoft.KeyVault` (secret management)
- Node.js 18+ with TypeSpec compiler (`@typespec/compiler`)
- `.env` file with: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `POWER_PLATFORM_CLIENT_ID`, `GRAPH_TENANT_ID`, `GRAPH_CLIENT_SECRET`

## Step 1: Provision Azure Backend Infrastructure

```bash
# Create resource group for backend services
az group create --name rg-frootai-copilot-studio-advanced --location eastus2

# Deploy OpenAI + Key Vault + App Insights
az deployment group create \
  --resource-group rg-frootai-copilot-studio-advanced \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=prod

# Store secrets in Key Vault
az keyvault secret set --vault-name kv-copilot-studio-adv \
  --name openai-key --value "$AZURE_OPENAI_KEY"
az keyvault secret set --vault-name kv-copilot-studio-adv \
  --name graph-client-secret --value "$GRAPH_CLIENT_SECRET"
```

## Step 2: Create Declarative Agent

Declarative agents define structured behavior without custom code:

```json
// declarative-agent.json
{
  "$schema": "https://developer.microsoft.com/json-schemas/copilot/declarative-agent/v1.0/schema.json",
  "version": "v1.0",
  "name": "Enterprise Assistant",
  "description": "Advanced enterprise copilot with Graph grounding and custom plugins",
  "instructions": "$[file](instructions.md)",
  "capabilities": [
    {
      "name": "GraphConnectors",
      "connections": [
        { "connection_id": "sharepoint-knowledge-base" },
        { "connection_id": "servicenow-incidents" }
      ]
    },
    { "name": "WebSearch" },
    { "name": "CodeInterpreter" }
  ],
  "actions": [
    { "$ref": "plugins/api-plugin.json" }
  ],
  "conversation_starters": [
    { "text": "What are the latest policy updates?" },
    { "text": "Show me my team's open incidents" },
    { "text": "Summarize last week's project activity" }
  ]
}
```

Key configuration:
- **GraphConnectors**: Connect to SharePoint, ServiceNow, Confluence via Microsoft Graph connectors
- **Actions**: Reference API plugins for custom backend operations
- **Instructions**: Separate `.md` files for maintainable agent behavior
- **Conversation starters**: Guide users to high-value scenarios

## Step 3: Build TypeSpec API Plugin

```bash
# Initialize TypeSpec project
npx @typespec/compiler init --template @typespec/azure-tools

# Define API surface
cat > main.tsp << 'EOF'
import "@typespec/http";
import "@typespec/openapi3";

@service({ title: "Enterprise Operations API" })
@server("https://api.enterprise.contoso.com")
namespace EnterpriseOps;

@route("/incidents")
interface Incidents {
  @get list(@query status?: "open" | "closed" | "in-progress"): Incident[];
  @get read(@path id: string): Incident;
  @post create(@body incident: CreateIncident): Incident;
  @patch update(@path id: string, @body updates: UpdateIncident): Incident;
}

model Incident {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  assignee: string;
  status: "open" | "closed" | "in-progress";
  created: utcDateTime;
}
EOF

# Compile to OpenAPI 3.0
npx tsp compile . --emit @typespec/openapi3
```

Register as Copilot Studio API plugin:
```json
// plugins/api-plugin.json
{
  "$schema": "https://developer.microsoft.com/json-schemas/copilot/plugin/v2.2/schema.json",
  "schema_version": "v2.2",
  "name_for_human": "Enterprise Operations",
  "description_for_human": "Manage incidents, projects, and team operations",
  "namespace": "EnterpriseOps",
  "functions": [
    {
      "name": "listIncidents",
      "description": "List incidents filtered by status",
      "capabilities": { "response_semantics": { "data_path": "$" } }
    }
  ],
  "runtimes": [
    {
      "type": "OpenApi",
      "auth": { "type": "OAuthPluginVault" },
      "spec": { "url": "openapi.yaml" },
      "run_for_functions": ["listIncidents"]
    }
  ]
}
```

## Step 4: Configure SSO/OAuth2

```bash
# Register Entra ID app for SSO
az ad app create \
  --display-name "Copilot Studio Advanced" \
  --sign-in-audience AzureADMyOrg \
  --web-redirect-uris "https://token.botframework.com/.auth/web/redirect"

# Add API permissions
az ad app permission add \
  --id $APP_ID \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope  # User.Read
```

SSO configuration in Copilot Studio:
- **Authentication**: Azure Active Directory v2 with SSO
- **Token exchange URL**: `api://botid-{bot-id}`
- **Scopes**: `User.Read`, `Calendars.Read`, `Sites.Read.All`
- **Admin consent**: Required for Graph connector access

## Step 5: Configure Graph API Data Grounding

```python
# Graph connector for SharePoint knowledge base
from msgraph import GraphServiceClient
from azure.identity import ClientSecretCredential

credential = ClientSecretCredential(tenant_id, client_id, client_secret)
client = GraphServiceClient(credential)

# Create external connection for Copilot grounding
connection = {
    "id": "sharepoint-knowledge-base",
    "name": "Knowledge Base",
    "description": "Company policies and procedures",
    "connectorId": "sharepoint"
}

# Ingest items for grounding
items = client.external.connections.by_id("sharepoint-knowledge-base").items
```

Graph grounding provides:
- **SharePoint**: Documents, pages, lists
- **Outlook**: Emails, calendar events
- **Teams**: Messages, channels, files
- **Planner**: Tasks, plans, buckets
- **People**: Org chart, profiles, skills

## Step 6: Deploy Adaptive Card Responses

```json
// Adaptive card template for incident display
{
  "type": "AdaptiveCard",
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "version": "1.5",
  "body": [
    {
      "type": "TextBlock",
      "text": "${title}",
      "weight": "Bolder",
      "size": "Large"
    },
    {
      "type": "FactSet",
      "facts": [
        { "title": "Severity", "value": "${severity}" },
        { "title": "Status", "value": "${status}" },
        { "title": "Assignee", "value": "${assignee}" }
      ]
    }
  ],
  "actions": [
    {
      "type": "Action.OpenUrl",
      "title": "View Details",
      "url": "https://portal.contoso.com/incidents/${id}"
    }
  ]
}
```

## Step 7: Configure Power Automate Flows

```bash
# Export Power Automate solution for version control
pac solution export \
  --path ./power-automate/solution.zip \
  --name CopilotStudioAdvanced

# Import to target environment
pac solution import \
  --path ./power-automate/solution.zip \
  --environment $TARGET_ENV_ID
```

Power Automate integration:
- **Trigger**: Copilot Studio topic escalation
- **Actions**: Create ServiceNow ticket, send Teams notification, update SharePoint list
- **Approval**: Multi-stage approval with adaptive cards

## Step 8: Publish and Verify

```bash
# Publish bot to channels
# Teams, SharePoint, custom website, Dynamics 365

# Test via Bot Framework Emulator
npx @bfc/bot-framework-emulator

# Test via Copilot Studio test pane
# Navigate to: https://copilotstudio.microsoft.com → Test your copilot
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| Declarative agent loads | Test pane conversation | Agent responds with personality |
| API plugin routes | Call plugin function | Correct API endpoint hit |
| SSO works | Login prompt in Teams | Token exchange succeeds |
| Graph grounding | Ask about SharePoint content | Grounded response with sources |
| Adaptive cards render | Trigger card response | Card displays in Teams |
| Power Automate triggers | Escalation topic | Flow runs successfully |
| Admin controls | Admin portal | Settings accessible, audit log active |
| Multi-turn context | 3+ turn conversation | Context maintained across turns |
| Content safety | Harmful input test | Blocked with safety message |

## Rollback Procedure

```bash
# Revert Copilot Studio bot to previous version
# Use Copilot Studio portal: Settings → Bot versions → Restore previous

# Revert Power Automate solution
pac solution import --path ./power-automate/solution-previous.zip

# Revert backend infrastructure
az deployment group create \
  --resource-group rg-frootai-copilot-studio-advanced \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --rollback-on-error
```
