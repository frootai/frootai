---
description: "Custom connector standards — OpenAPI definition, auth configuration, throttling, testing."
applyTo: "**/*.json, **/*.yaml"
waf:
  - "security"
  - "reliability"
---

# Power Platform Custom Connectors — FAI Standards

## OpenAPI Definition
Every custom connector requires a valid OpenAPI 2.0 (Swagger) definition. Power Platform does not support OpenAPI 3.x.

```json
{
  "swagger": "2.0",
  "info": { "title": "Contoso API", "version": "1.0.0" },
  "host": "@connectionParameters('baseUrl')",
  "basePath": "/api/v1",
  "schemes": ["https"],
  "consumes": ["application/json"],
  "produces": ["application/json"],
  "securityDefinitions": {
    "oauth2_auth": {
      "type": "oauth2",
      "flow": "accessCode",
      "authorizationUrl": "https://login.microsoftonline.com/common/oauth2/authorize",
      "tokenUrl": "https://login.microsoftonline.com/common/oauth2/token",
      "scopes": { "api://contoso/.default": "Access Contoso API" }
    }
  }
}
```

- Set `host` dynamically via connection parameters — never hardcode environment-specific URLs
- Use `x-ms-api-annotation` for visibility (`important`, `advanced`, `internal`) on every operation
- Define `x-ms-summary` and `description` on all parameters — these surface in the Power Apps/Automate UX

## Actions, Triggers, and Pagination

```json
{
  "paths": {
    "/orders": {
      "get": {
        "operationId": "ListOrders",
        "summary": "List orders",
        "x-ms-visibility": "important",
        "x-ms-pageable": { "nextLinkName": "@odata.nextLink" },
        "parameters": [
          { "name": "$top", "in": "query", "type": "integer", "default": 50, "x-ms-summary": "Page size" }
        ]
      }
    },
    "/orders/webhook": {
      "x-ms-trigger": "single",
      "post": {
        "operationId": "OnNewOrder",
        "summary": "When a new order is created",
        "x-ms-trigger-hint": "Subscribe to new order events"
      }
    }
  }
}
```

- Triggers: `x-ms-trigger: single` (one item) or `batch` (array) — webhook triggers need subscribe/unsubscribe via `x-ms-notification-content`
- Pagination: `x-ms-pageable.nextLinkName` must match your API's next-page link property
- Polling triggers: return `Retry-After` header and HTTP 202 for no-new-data

## Authentication Types

```json
{
  "connectionParameters": {
    "token": {
      "type": "oauthSetting",
      "oAuthSettings": {
        "identityProvider": "aad",
        "clientId": "{from-env}",
        "scopes": ["api://contoso/.default"],
        "redirectMode": "Global"
      }
    }
  }
}
```

- **OAuth2 (AAD)**: preferred — `redirectMode: "Global"` for GCC/sovereign cloud compat
- **API Key**: header only (`x-api-key`), `"type": "securestring"` — never in query string
- **Basic Auth**: avoid; if required, password as `"type": "securestring"`

## Dynamic Schemas and Values

Use `x-ms-dynamic-values` for dropdown picklists (include `value-title`) and `x-ms-dynamic-schema` when response shape varies by input. Dynamic endpoints must respond within 5 seconds.

```json
{
  "x-ms-dynamic-values": {
    "operationId": "ListEntities",
    "value-collection": "value",
    "value-path": "id",
    "value-title": "displayName"
  }
}
```

## Policy Templates

```xml
<set-header name="X-Correlation-Id" existsAction="skip">
  <value>@(context.Request.Headers.GetValueOrDefault("x-ms-client-request-id","unknown"))</value>
</set-header>
<set-backend-service base-url="@connectionParameters('baseUrl')" />
```

- `set-header` for correlation IDs/versioning; `set-backend-service` for environment URL rewriting; never inject secrets via policies

## Custom Code (C# Script)

```csharp
public class Script : ScriptBase {
    public override async Task<HttpResponseMessage> ExecuteAsync() {
        var body = JObject.Parse(await this.Context.Request.Content.ReadAsStringAsync());
        body["timestamp"] = DateTime.UtcNow.ToString("o");
        this.Context.Request.Content = CreateJsonContent(body.ToString());
        var response = await this.Context.SendAsync(this.Context.Request, this.CancellationToken);
        return response;
    }
}
```

- Runs per-operation — keep under 5 seconds; only `Newtonsoft.Json` and `System.Net.Http` available
- Handle errors explicitly — unhandled exceptions return 500 to the flow

## Connection Parameters, Environment, and Branding

- Define `baseUrl` as a connection parameter — makers switch dev/test/prod without editing the connector
- Use environment variables in solutions: `@parameters('ContosoApiUrl')` for ALM-managed URLs
- Mark sensitive fields `"type": "securestring"` — encrypted at rest
- Icon: 1:1 PNG, 160×160px min, ≤1MB, transparent background; brand color as 6-char hex

## Error Responses and Throttling

```json
{ "error": { "code": "INVALID_ORDER_ID", "message": "Order ID must be a valid GUID." } }
```

- Return structured `error.code` + `error.message` — Power Automate surfaces these in run history
- HTTP 429 with `Retry-After` header — Power Platform auto-retries on throttling
- Default limit: 500 actions/minute per connection — use batch endpoints to reduce action count
- Never leak stack traces or internal paths in error responses

## Testing and Certification

- **Connector Test Tool**: validate each operation in the maker portal; **Postman**: import OpenAPI definition for auth flow testing
- Validate pagination end-to-end (iterate until `nextLink` is null) and test dynamic values with varied parameters
- Run `paconn validate` in CI — all operations need `summary`, `description`, `operationId`, `x-ms-visibility`
- Response schemas must cover success and error shapes; provide test account + sandbox to Microsoft reviewers

## Anti-Patterns

- ❌ Using OpenAPI 3.x — Power Platform only supports Swagger 2.0
- ❌ Hardcoding `host` instead of using connection parameters for environment-specific URLs
- ❌ Omitting `x-ms-visibility` — operations default to `advanced`, confusing makers
- ❌ Missing `x-ms-summary` on parameters — raw parameter names shown in UX
- ❌ Polling triggers without `Retry-After` — causes unnecessary API load; custom code exceeding 5s times out silently
- ❌ Returning HTML error pages instead of structured JSON error objects
- ❌ Storing secrets in connector JSON files committed to source control

## WAF Alignment

| Pillar | Connector Practice |
|---|---|
| **Security** | OAuth2 with AAD, `securestring` for secrets, no keys in source, HTTPS-only |
| **Reliability** | 429 + `Retry-After`, pagination via `nextLink`, webhook subscribe/unsubscribe cleanup |
| **Cost** | Batch endpoints to reduce action count, cache dynamic values server-side |
| **Ops Excellence** | `paconn validate` in CI, environment variables for ALM, structured error codes |
| **Performance** | Dynamic endpoints respond <5s, custom code <5s, paginated list operations |
| **Responsible AI** | Content filtering on AI-powered operations, transparent error messages to makers |
