---
description: "Copilot extensibility — Graph connectors, plugin manifest, action design, M365 integration patterns."
applyTo: "**/*.json, **/*.ts"
waf:
  - "operational-excellence"
---

# Copilot Extensibility — FAI Standards

> Rules for building Microsoft 365 Copilot extensions: Graph connectors, declarative agents, API plugins, message extensions, and Copilot Studio integrations.

## Declarative Agents

Declarative agents are JSON manifests that customize Copilot's behavior without code. The manifest references instructions, capabilities, and actions.

```json
{
  "version": "v1.2",
  "name": "ContractAnalyzer",
  "description": "Analyzes legal contracts and highlights risks using company policy data.",
  "instructions": "$[file('instruction.txt')]",
  "capabilities": [
    { "name": "WebSearch", "available_content_sources": ["contoso.com"] },
    { "name": "GraphConnectors", "connections": [{ "connection_id": "contosoPolicies" }] },
    { "name": "OneDriveAndSharePoint", "items_by_url": [{ "url": "https://contoso.sharepoint.com/sites/Legal" }] }
  ],
  "actions": [{ "id": "riskAssessment", "file": "apiPlugin.json" }]
}
```

- `instructions` field: reference external `.txt` file via `$[file('...')]` — keep under 8,000 chars
- Capabilities are additive — only declare what the agent needs. Omit `WebSearch` if not required
- `GraphConnectors.connections[].connection_id` must match the external connection ID exactly
- `OneDriveAndSharePoint.items_by_url` scopes grounding to specific site collections or folders

## Graph Connectors

Graph connectors ingest external content into the Microsoft 365 index, making it available for Copilot grounding.

### Connection & Schema

```typescript
import { Client } from "@microsoft/microsoft-graph-client";

// Create connection — ID must be 3-32 alphanumeric, no hyphens
await client.api("/external/connections").post({
  id: "contosoPolicies",
  name: "Contoso Policies",
  description: "Internal HR and legal policy documents for Copilot grounding",
  activitySettings: { urlToItemResolvers: [{
    "@odata.type": "#microsoft.graph.externalConnectors.itemIdResolver",
    urlMatchInfo: { baseUrls: ["https://policies.contoso.com"], urlPattern: "/doc/(?<slug>[^/]+)" },
    itemId: "{slug}", priority: 1
  }]}
});

// Register schema — max 128 properties, wait for provisioning (poll operation status)
await client.api("/external/connections/contosoPolicies/schema").patch({
  baseType: "microsoft.graph.externalItem",
  properties: [
    { name: "title", type: "String", isSearchable: true, isQueryable: true, isRetrievable: true, labels: ["title"] },
    { name: "department", type: "String", isQueryable: true, isRetrievable: true, isRefinable: true },
    { name: "lastModified", type: "DateTime", isQueryable: true, isRetrievable: true, labels: ["lastModifiedDateTime"] }
  ]
});
```

### Ingesting External Items

```typescript
// Each item needs content, properties, and an ACL
await client.api("/external/connections/contosoPolicies/items/policy-42").put({
  acl: [{ type: "everyone", value: "everyone", accessType: "grant" }],
  properties: { title: "Remote Work Policy", department: "HR", lastModified: "2026-01-15T00:00:00Z" },
  content: { type: "text", value: "Full policy text for semantic indexing..." },
  activities: [{ "@odata.type": "#microsoft.graph.externalConnectors.externalActivity",
    type: "modified", startDateTime: "2026-01-15T00:00:00Z",
    performedBy: { type: "user", id: "aaaa-bbbb-cccc" }
  }]
});
```

- Always set `labels` on schema properties — Copilot uses `title`, `url`, `lastModifiedDateTime`, `iconUrl` for citations
- Set `isSearchable: true` only on text fields users would search by — not IDs or dates
- ACLs are mandatory — use `everyone` for public content, or Azure AD group/user IDs for scoped access
- Activities (`created`, `modified`, `commented`) improve ranking recency signals

## API Plugins

API plugins expose REST endpoints to Copilot as callable functions. They use an OpenAPI spec + plugin manifest.

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/copilot/plugin/v2.2/schema.json",
  "schema_version": "v2.2",
  "name_for_human": "Contoso Tickets",
  "description_for_human": "Search and create IT support tickets in the Contoso helpdesk system.",
  "namespace": "contosoTickets",
  "functions": [{
    "name": "searchTickets",
    "description": "Search open IT tickets by keyword, assignee, or priority. Returns ticket ID, title, status, and assignee.",
    "parameters": {
      "type": "object",
      "properties": {
        "query": { "type": "string", "description": "Search keyword matching ticket title or description" },
        "priority": { "type": "string", "enum": ["low", "medium", "high", "critical"], "description": "Filter by priority level" }
      },
      "required": ["query"]
    }
  }],
  "runtimes": [{
    "type": "OpenApi",
    "auth": { "type": "OAuthPluginVault", "reference_id": "contoso-oauth" },
    "spec": { "url": "apiDefinition.json" },
    "runs_for_functions": ["searchTickets"]
  }]
}
```

### Auth Patterns

- **OAuth 2.0** (`OAuthPluginVault`): preferred for production — register in Plugin Vault, use auth code flow with PKCE
- **API Key** (`ApiKeyPluginVault`): acceptable for internal APIs — key stored in Plugin Vault, sent via `x-api-key` header
- **None**: only for public read-only endpoints with no sensitive data
- Never embed secrets in the manifest — all credentials flow through Plugin Vault

### Semantic Descriptions for Discoverability

Copilot matches user intent to plugins via descriptions. Write them as if explaining to a colleague:

- ✅ `"Search open IT tickets by keyword, assignee, or priority. Returns ticket ID, title, status, and assignee."`
- ❌ `"Searches tickets"` — too vague, Copilot can't distinguish from other ticket tools
- ✅ Parameter descriptions: `"Filter by priority level"` with enum values listed
- ❌ Parameter descriptions: `"priority"` — restating the name teaches nothing

## Adaptive Cards & Confirmation Prompts

Actions that modify data must show a confirmation card before execution:

```json
{
  "type": "AdaptiveCard",
  "version": "1.5",
  "body": [
    { "type": "TextBlock", "text": "Create Ticket", "weight": "bolder", "size": "medium" },
    { "type": "FactSet", "facts": [
      { "title": "Title", "value": "${title}" },
      { "title": "Priority", "value": "${priority}" },
      { "title": "Assignee", "value": "${assignee}" }
    ]}
  ],
  "actions": [{ "type": "Action.Submit", "title": "Confirm", "data": { "verb": "createTicket" } }]
}
```

- Read-only functions (GET) return results directly — no confirmation needed
- Write operations (POST/PUT/DELETE) must render a confirmation card showing all parameters
- Use `FactSet` for structured data display — not free-text `TextBlock` dumps
- Adaptive Cards must target schema version `1.5` for M365 Copilot compatibility

## Teams Message Extensions

Message extensions surface as search-based or action-based commands in Copilot and Teams:

```json
{
  "composeExtensions": [{
    "botId": "${{BOT_ID}}",
    "commands": [{
      "id": "searchTickets",
      "type": "query",
      "title": "Search Tickets",
      "description": "Find IT support tickets by keyword or priority",
      "semanticDescription": "Use this when the user wants to find, look up, or search for existing IT helpdesk tickets by keyword, status, or assignee name.",
      "parameters": [{
        "name": "query",
        "title": "Search",
        "description": "Keyword to search in ticket title and description",
        "semanticDescription": "The search term the user wants to find tickets for. Can be a keyword, ticket number, or person name.",
        "inputType": "text"
      }]
    }]
  }]
}
```

- `semanticDescription` on commands AND parameters is critical — Copilot uses these to decide when to invoke
- Keep `description` short (UI display), put rich intent matching in `semanticDescription`
- Query commands return `composeExtension/queryResult` with preview cards + content cards

## Copilot Studio Custom Topics

For Copilot Studio integrations, use custom topics with plugin actions:

- Author topics in Copilot Studio with trigger phrases that don't overlap with other topics
- Connect to API plugins via the "Call an action" node — same plugin manifest format
- Use "Generative Answers" node pointed at Graph connector content for grounded responses
- Publish to Teams, M365 Copilot, or custom channels via the unified publish flow

## Citation & Attribution

- Graph connector items get automatic citations when `url` and `title` labels are set on schema
- API plugin responses include citations when the response JSON contains `url` and `title` fields
- Set `iconUrl` on external items for branded citation cards in Copilot responses
- Never return raw HTML in API responses — Copilot renders Adaptive Cards, not HTML

## Testing & Validation

- **Copilot Developer Portal**: test declarative agents and plugins before Teams Admin approval
- **Graph Explorer**: validate connector schema, item ingestion, and ACL queries
- Use `devPreview` manifest version during development — switch to `1.19+` for production
- Test with multiple M365 tenants to verify cross-tenant ACL behavior
- Validate plugin OpenAPI specs with `npx @microsoft/m365-spec-validator@latest apiDefinition.json`

## Anti-Patterns

- ❌ Connection IDs with hyphens or special characters — causes silent ingestion failures
- ❌ Omitting `labels` on schema properties — Copilot can't generate proper citations
- ❌ Generic function descriptions like `"does stuff"` — Copilot won't match user intent
- ❌ Skipping confirmation cards on write operations — violates M365 certification requirements
- ❌ Returning more than 10 results from a plugin function — Copilot truncates, wastes tokens
- ❌ Using `isSearchable: true` on non-text fields (dates, numbers) — degrades index quality
- ❌ Hardcoding tenant IDs or user IDs in connector ACLs — breaks multi-tenant deployments
- ❌ Plugin functions with >5 parameters — Copilot struggles to populate them from natural language
- ❌ Missing `semanticDescription` on message extension commands — Copilot defaults to `description` which is too short

## WAF Alignment

| Pillar | Copilot Extensibility Practices |
|---|---|
| **Security** | OAuth via Plugin Vault, ACL-scoped Graph items, no secrets in manifests, validate all plugin inputs |
| **Reliability** | Retry on Graph 429/503, poll schema provisioning status, idempotent item ingestion (PUT not POST) |
| **Cost Optimization** | Batch external item ingestion (max 4 concurrent), delta crawl instead of full re-index, limit plugin response size |
| **Operational Excellence** | Schema versioning via connection metadata, App Insights telemetry on plugin calls, automated connector provisioning via CI/CD |
| **Performance Efficiency** | Incremental crawl with change detection, cache plugin responses with ETag, async item ingestion with queue |
| **Responsible AI** | Content Safety on plugin responses, no PII in Graph item `content` without ACL scoping, attribution via citation labels |
