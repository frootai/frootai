---
description: "Play 08 patterns — Copilot Studio patterns — topics, generative answers, knowledge sources, channel deployment, Dataverse integration."
applyTo: "**/*.json"
waf:
  - "reliability"
  - "security"
---

# Play 08 — Copilot Studio Bot Patterns — FAI Standards

## Topic Design

Structure topics with specific trigger phrases (5-10 per topic) and entity extraction:

```yaml
# topic: OrderStatus
triggerPhrases:
  - "Where is my order"
  - "Track order {orderNumber}"
  - "Order status for {orderNumber}"
  - "When will my package arrive"
entities:
  orderNumber:
    type: regex
    pattern: "ORD-[0-9]{6}"
    required: true
    reprompt: "Please provide your order number (format: ORD-123456)"
```

- One topic per intent — never overload a topic with multiple unrelated flows
- Use slot filling for required entities before calling backend actions
- Set topic-level `maxTurns: 5` to prevent infinite conversation loops
- Redirect to fallback topic after 2 failed entity extraction attempts

## Generative Answers & Knowledge Sources

```json
{
  "generativeAnswers": {
    "enabled": true,
    "moderationLevel": "high",
    "knowledgeSources": [
      { "type": "sharepoint", "url": "https://contoso.sharepoint.com/sites/kb" },
      { "type": "website", "url": "https://docs.contoso.com", "depthLimit": 3 },
      { "type": "dataverse", "table": "kb_articles", "filter": "statecode eq 0" },
      { "type": "file", "name": "product-catalog.pdf" }
    ],
    "contentModeration": {
      "blockSensitiveTopics": true,
      "customBlockedPhrases": ["competitor-name", "internal-only"],
      "noAnswerMessage": "I can only help with Contoso product questions."
    }
  }
}
```

- Set moderation to `high` for customer-facing bots — blocks off-topic and harmful content
- Scope knowledge sources narrowly — one SharePoint site beats entire tenant search
- Use `noAnswerMessage` to guide users when generative answers can't find grounding
- Review AI-generated answers in Analytics → track groundedness weekly

## Plugin Actions

### Power Automate Cloud Flow Connector
```yaml
# Plugin action: CreateTicket
type: powerAutomate
flowId: "env://flows/create-support-ticket"
inputs:
  summary: "=Topic.Description"
  priority: "=Topic.Priority"
  customerEmail: "=System.User.Email"
outputs:
  ticketId: "=outputs('Create_item')?['body/ID']"
timeout: 30s
errorHandling:
  message: "I couldn't create your ticket. Please try again or call support."
```

### Custom Connector (OpenAPI)
```json
{
  "connectorId": "/providers/Microsoft.PowerApps/apis/contoso-erp",
  "operationId": "GetInventory",
  "authentication": { "type": "oAuth2", "identityProvider": "aad" },
  "inputs": { "sku": "{Topic.ProductSKU}" }
}
```

- Always set `timeout` on plugin actions — default 120s is too long for chat UX
- Use environment variables (`env://`) for flow IDs — never hardcode GUIDs across environments
- Return structured data from flows — bot parses JSON, not free text
- Wrap plugin calls in condition nodes: check `IsSuccess` before presenting results

## Adaptive Cards for Rich UIs

```json
{
  "type": "AdaptiveCard",
  "version": "1.5",
  "body": [
    { "type": "TextBlock", "text": "Order ${orderNumber}", "weight": "bolder", "size": "medium" },
    { "type": "FactSet", "facts": [
      { "title": "Status", "value": "${status}" },
      { "title": "ETA", "value": "${estimatedDelivery}" }
    ]},
    { "type": "ActionSet", "actions": [
      { "type": "Action.Submit", "title": "Track Package", "data": { "action": "trackPackage", "orderId": "${orderId}" } }
    ]}
  ]
}
```

- Target Adaptive Cards v1.5 for Teams, v1.3 for web chat compatibility
- Use `Action.Submit` for bot interactions, `Action.OpenUrl` for external links
- Keep cards under 30KB — Teams rejects larger payloads silently
- Test cards at adaptivecards.io/designer before embedding in topics

## Authentication

```yaml
authentication:
  sso:
    provider: "Microsoft Entra ID"
    scopes: ["User.Read", "Sites.Read.All"]
    tokenExchange: true  # silent SSO in Teams
  manual:
    provider: "OAuth2"
    authorizationUrl: "https://login.contoso.com/authorize"
    tokenUrl: "https://login.contoso.com/token"
    scopes: ["api://contoso-erp/.default"]
```

- Enable SSO with `Require users to sign in` for internal bots — seamless in Teams
- Use manual OAuth only for third-party systems (Salesforce, ServiceNow)
- Store client secrets in environment variables — never in topic configuration
- Validate token claims (`aud`, `iss`, `roles`) in custom connector auth policies

## Channel Deployment

| Channel | Config | Gotcha |
|---------|--------|--------|
| Teams | App manifest v1.17+, `webApplicationInfo` for SSO | Requires admin consent for org-wide install |
| Web chat | `<iframe>` with token endpoint, custom canvas styling | Token endpoint must enforce domain allowlist |
| Omnichannel | Dynamics 365 routing rules, queue assignment | Agent handoff requires Omnichannel license |
| Facebook/SMS | Channel-specific adapter, webhook validation | No Adaptive Cards — falls back to plain text |

- Publish to Teams via admin center — not side-loading in production
- Web chat: generate tokens server-side, never expose Direct Line secret in client JS
- Test each channel independently — Adaptive Cards render differently per surface

## Analytics & CSAT

- Track `Resolution Rate`, `Escalation Rate`, `Avg Turns to Resolution`, `CSAT Score` in Copilot Analytics
- Set up custom KPIs in Power BI: connect to Dataverse `conversationtranscript` table
- Use `Ask a survey question` node at topic end — target CSAT ≥ 4.0/5.0
- Monitor `Abandon Rate` per topic — >40% signals poor topic design or missing triggers

## Fallback & Live Agent Handoff

```
# Power Fx — escalation condition
If(
    Topic.ConsecutiveFailures >= 2 || Topic.UserSentiment = "negative",
    Escalate({ Summary: Topic.ConversationSummary, Queue: "Tier1" }),
    Topic.GoTo("Rephrase")
)
```

- Escalate with full conversation context — agent sees summary + transcript
- Set `waitTimeMessage` when queue is >2 min — offer callback option
- Route by skill: billing → finance queue, technical → engineering queue
- Bot resumes if agent closes without resolving — don't dead-end the user

## Multilingual Support

- Use `System.User.Language` to detect locale, route to language-specific topics
- Maintain separate knowledge sources per language — don't rely solely on auto-translation
- Generative answers translate well for Tier-1 languages (EN/ES/FR/DE/JA/PT)
- For Tier-2 languages: curate translated topic responses, use generative only as fallback

## Environment Management & ALM

```yaml
environments:
  dev:
    purpose: "authoring + testing"
    dataverse: "contoso-dev"
    publishTarget: "internal-testers"
  test:
    purpose: "UAT with production knowledge sources"
    dataverse: "contoso-test"
    publishTarget: "stakeholder-group"
  prod:
    purpose: "live customer traffic"
    dataverse: "contoso-prod"
    publishTarget: "all-users"

alm:
  transport: "managed-solutions"
  pipeline: "Power Platform Pipelines"
  steps:
    - export: "dev → unmanaged solution"
    - build: "solution checker (no critical issues)"
    - deploy: "test → managed, smoke test, approve"
    - release: "prod → managed, canary 10% → full rollout"
```

- Always use managed solutions for test/prod — unmanaged only in dev
- Include bot + flows + connectors + environment variables in the same solution
- Run Solution Checker in CI — block deployment on critical/high severity findings
- Use connection references and environment variables — never environment-specific bindings

## Anti-Patterns

- ❌ Single mega-topic handling all intents — impossible to maintain or analyze
- ❌ Generative answers without content moderation — bot answers off-topic questions
- ❌ Hardcoded flow GUIDs — breaks on import to test/prod environments
- ❌ Exposing Direct Line secret in client-side JavaScript
- ❌ No fallback topic — user hits dead end on unrecognized input
- ❌ Skipping solution checker before deploying to production
- ❌ Using unmanaged solutions in prod — creates import conflicts and blocks updates
- ❌ Authentication disabled on internal bots — any user can access sensitive data flows

## WAF Alignment

| Pillar | Play 08 Implementation |
| --- | --- |
| Security | Entra ID SSO, OAuth2 for connectors, token validation, content moderation on all generative answers |
| Reliability | Timeout on plugin actions (30s), fallback topics, escalation after 2 failures, Omnichannel queue overflow routing |
| Cost | GPT-4o-mini for generative answers, scoped knowledge sources (fewer tokens), monitor consumed AI message capacity |
| Operational Excellence | ALM via managed solutions, Power Platform Pipelines, Solution Checker in CI, conversation analytics dashboards |
| Performance | Adaptive Card caching, async flow execution, knowledge source depth limits, topic-level turn caps |
| Responsible AI | Content moderation `high`, custom blocked phrases, CSAT surveys, conversation transcript review for bias |

### Operational Excellence
- Structured JSON logging with Application Insights + correlation IDs
- Custom metrics: latency p50/p95/p99, token usage, quality scores
- Automated Bicep deployment via GitHub Actions (staging → prod)
- Feature flags for gradual rollout, incident runbooks
