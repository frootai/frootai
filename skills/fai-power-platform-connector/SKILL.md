---
name: fai-power-platform-connector
description: |
  Build custom Power Platform connectors with OpenAPI definitions, authentication,
  triggers, and policy templates. Use when connecting Power Apps and Power
  Automate to custom APIs or AI services.
---

# Power Platform Custom Connector

Build custom connectors to expose APIs to Power Apps and Power Automate.

## When to Use

- Connecting Power Platform to custom REST APIs
- Exposing AI endpoints to low-code flows
- Creating reusable connectors for organization
- Adding authentication (OAuth2, API key) to connectors

---

## Connector Definition (apiDefinition.swagger.json)

```json
{
  "swagger": "2.0",
  "info": { "title": "AI Chat API", "version": "1.0.0" },
  "host": "api.example.com",
  "basePath": "/v1",
  "schemes": ["https"],
  "securityDefinitions": {
    "api_key": { "type": "apiKey", "in": "header", "name": "X-API-Key" }
  },
  "paths": {
    "/chat": {
      "post": {
        "operationId": "SendChat",
        "summary": "Send a chat message to AI",
        "parameters": [{
          "name": "body", "in": "body", "required": true,
          "schema": {
            "type": "object",
            "properties": {
              "message": { "type": "string", "description": "User message" },
              "model": { "type": "string", "default": "gpt-4o-mini" }
            },
            "required": ["message"]
          }
        }],
        "responses": {
          "200": {
            "description": "Success",
            "schema": {
              "type": "object",
              "properties": {
                "reply": { "type": "string" },
                "tokens": { "type": "integer" }
              }
            }
          }
        }
      }
    }
  }
}
```

## CLI Deployment

```bash
# Create connector
pac connector create --name "AI Chat" --openapi apiDefinition.swagger.json

# Update existing
pac connector update --name "AI Chat" --openapi apiDefinition.swagger.json
```

## Authentication Options

| Auth Type | Use When | Config |
|-----------|----------|--------|
| API Key | Simple service auth | Header or query param |
| OAuth 2.0 | User-delegated auth | Azure AD app registration |
| No Auth | Public APIs | None needed |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| 401 Unauthorized | Wrong auth config | Verify API key or OAuth settings |
| Actions not showing | Invalid OpenAPI | Validate swagger with editor.swagger.io |
| Connector not found | Wrong environment | Check connector environment scope |
| Response mapping fails | Schema mismatch | Match response schema to actual API |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Start simple, add complexity when needed | Avoid over-engineering |
| Automate repetitive tasks | Consistency and speed |
| Document decisions and tradeoffs | Future reference for the team |
| Validate with real data | Don't rely on synthetic tests alone |
| Review with peers | Fresh eyes catch blind spots |
| Iterate based on feedback | First version is never perfect |

## Quality Checklist

- [ ] Requirements clearly defined
- [ ] Implementation follows project conventions
- [ ] Tests cover happy path and error paths
- [ ] Documentation updated
- [ ] Peer reviewed
- [ ] Validated in staging environment

## Related Skills

- `fai-implementation-plan-generator` — Planning and milestones
- `fai-review-and-refactor` — Code review patterns
- `fai-quality-playbook` — Engineering quality standards
