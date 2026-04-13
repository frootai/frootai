---
description: "Power Automate flow standards — error handling, parallel branches, approvals, SLA tracking."
applyTo: "**/*.json"
waf:
  - "reliability"
  - "operational-excellence"
---

# Power Automate — FAI Standards

## Flow Naming & Structure

- Name pattern: `[Env]-[App]-[Entity]-[Action]` — e.g., `PRD-CRM-Lead-QualifyAndRoute`
- Prefix child flows with `CF-` — e.g., `CF-Shared-SendApproval`
- Every action: rename from default to descriptive PascalCase — `Get_Account_Details` not `Get_item`
- Group related actions inside **Scope** blocks named by purpose: `Scope-ValidateInput`, `Scope-CallExternalAPI`
- Limit flow depth to 8 nesting levels — extract child flows beyond that

## Trigger Conditions & Filtering

Apply trigger conditions to prevent unnecessary runs — saves API calls and quota:
```json
{
  "conditions": [
    {
      "expression": "@equals(triggerOutputs()?['body/statuscode'], 'Active')"
    },
    {
      "expression": "@not(empty(triggerOutputs()?['body/email']))"
    }
  ]
}
```
- Dataverse triggers: add filtering attributes to fire only on relevant column changes
- Recurrence triggers: set time zone explicitly — never rely on UTC default for business logic
- When polling: set frequency to minimum needed cadence, use webhook triggers when available

## Error Handling with Scope + Configure Run After

Wrap risky operations in a try-catch-finally pattern using Scope blocks:
```json
{
  "Scope-TryProcess": {
    "type": "Scope",
    "actions": { "Call_External_API": { "type": "Http", "inputs": { "method": "POST" } } }
  },
  "Scope-CatchError": {
    "type": "Scope",
    "runAfter": { "Scope-TryProcess": ["Failed", "TimedOut"] },
    "actions": {
      "Log_Error": {
        "type": "Compose",
        "inputs": "@{result('Scope-TryProcess')}"
      },
      "Send_Alert": { "type": "ApiConnection", "inputs": {} }
    }
  },
  "Scope-Finally": {
    "type": "Scope",
    "runAfter": {
      "Scope-TryProcess": ["Succeeded", "Failed", "Skipped", "TimedOut"],
      "Scope-CatchError": ["Succeeded", "Failed", "Skipped", "TimedOut"]
    },
    "actions": { "Cleanup_Temp_Data": { "type": "Compose", "inputs": "done" } }
  }
}
```
- **Configure Run After** on catch scope: `Failed`, `TimedOut` — never leave it on `Succeeded` only
- Use `result('ScopeName')` to capture all action outcomes for logging
- Terminate with `Failed` status after catch if the error is unrecoverable

## Retry Policies

```json
{
  "retryPolicy": {
    "type": "exponential",
    "count": 4,
    "interval": "PT10S",
    "minimumInterval": "PT5S",
    "maximumInterval": "PT1H"
  }
}
```
- HTTP/API actions: exponential retry (4 attempts, 10s base, 1h max)
- Dataverse/SharePoint actions: fixed retry (3 attempts, 30s interval) — avoids throttling cascade
- Set `retryPolicy.type` to `none` on idempotency-unsafe operations (payment, provisioning)

## Expression Functions

```json
{
  "Safe_Null_Handling": "@coalesce(triggerOutputs()?['body/companyName'], 'Unknown')",
  "Format_Date": "@formatDateTime(utcNow(), 'yyyy-MM-dd HH:mm:ss')",
  "Parse_JSON_String": "@json(body('Get_Response')?['content'])",
  "Conditional_Value": "@if(equals(variables('Status'), 'Approved'), 'Process', 'Hold')",
  "String_Interpolation": "@concat('Order-', triggerOutputs()?['body/orderid'], '-', formatDateTime(utcNow(), 'yyyyMMdd'))",
  "Array_Filter": "@filter(body('List_Items')?['value'], item(), equals(item()?['status'], 'Active'))"
}
```
- Always use `coalesce()` or null-conditional `?[]` — raw property access on null crashes the flow
- `formatDateTime` with explicit format strings — never rely on locale-dependent defaults
- Parse JSON with schema validation — define expected schema in the Parse JSON action

## Variables & Compose

- Initialize ALL variables at flow top-level (outside loops/conditions) — Power Automate requirement
- Name pattern: `var_PascalCase` — e.g., `var_RetryCount`, `var_ProcessedItems`
- Prefer **Compose** over variables for intermediate transformations — Compose is stateless:
```json
{
  "Compose_CleanPayload": {
    "type": "Compose",
    "inputs": {
      "id": "@triggerOutputs()?['body/id']",
      "name": "@trim(triggerOutputs()?['body/fullname'])",
      "created": "@formatDateTime(triggerOutputs()?['body/createdon'], 'yyyy-MM-dd')"
    }
  }
}
```
- Use `Append to array variable` inside loops, never `Set variable` with `union()` concatenation

## Parallel Branches & Concurrency

- Use parallel branches for independent operations (e.g., send email + update CRM + log)
- Set `concurrency.repetitions` on Apply to Each — default is 1 (sequential), max is 50:
```json
{
  "Apply_to_each_record": {
    "type": "Foreach",
    "operationOptions": "Sequential",
    "runtimeConfiguration": { "concurrency": { "repetitions": 20 } }
  }
}
```
- Concurrency on triggers: limit to 1 for order-dependent processing (approval chains, sequential IDs)
- Do-Until loops: always set a `count` limit (default 60) and `timeout` (e.g., `PT1H`)

## Connection References & Environment Variables

- **Solution-aware flows only** — never build flows outside solutions for production workloads
- Use connection references (not embedded connections) — enables environment promotion without re-auth
- Environment variables for all environment-specific values:
  - SharePoint site URLs, email distribution lists, API endpoints, threshold values
  - Reference via `@parameters('env_ApiBaseUrl')` — never hardcode URLs
- Store secrets in Azure Key Vault, retrieve via the Key Vault connector — not environment variables

## Child Flows (Solution-Aware)

- Extract reusable logic into child flows with `Run a Child Flow` action
- Child flows must be solution-aware and in the same solution or a shared component solution
- Define explicit input/output parameters with types — avoid passing entire records
- Child flows cannot trigger other child flows beyond 5 levels deep — flatten if needed
- Use child flows for: shared approval logic, notification templates, data validation routines

## Approval Workflows

- Use the Approvals connector (not custom email-based) — provides audit trail, mobile support, adaptive cards
- Set timeout on `Wait for an approval` — default runs indefinitely, set `PT72H` or business SLA
- Handle all outcomes: Approve, Reject, Timeout — never assume approval
- Sequential approvals: chain `Start and wait` actions; parallel: use `Everyone must approve` type
- Store approval outcome + approver + timestamp in Dataverse for compliance audit

## DLP Policies & Governance

- Classify connectors: Business vs Non-Business vs Blocked — enforce at environment level
- HTTP connector (custom API calls) must be in Business group or blocked in non-dev environments
- Flows using premium connectors: document justification and get CoE approval
- Enable flow analytics in the CoE Starter Kit for usage monitoring and orphan detection

## Anti-Patterns

- ❌ Unnamed actions (`Apply_to_each`, `Condition`, `Get_item`) — rename everything descriptively
- ❌ No error handling — every flow needs at least one try-catch Scope pattern
- ❌ Hardcoded URLs, email addresses, or connection strings — use environment variables
- ❌ `Delay` actions for polling — use `When a record is updated` trigger or webhook instead
- ❌ Deeply nested conditions (>4 levels) — extract to child flow or use Switch action
- ❌ Using `Get items` without `$top` or `$filter` — fetches all records, hits delegation limits
- ❌ Variables inside Apply to Each for aggregation without concurrency=1 — race condition
- ❌ Ignoring flow checker warnings — resolve all before promoting to production

## WAF Alignment

| Pillar | Power Automate Practice |
|--------|------------------------|
| **Reliability** | Scope try-catch pattern, exponential retry, Configure Run After on Failed/TimedOut, Do-Until count+timeout limits |
| **Security** | Connection references (no embedded creds), Key Vault for secrets, DLP policies, least-privilege service accounts |
| **Cost Optimization** | Trigger conditions to prevent unnecessary runs, concurrency limits, Standard vs Premium connector choices |
| **Operational Excellence** | Solution-aware flows, environment variables, flow naming conventions, CoE analytics, flow checker zero-warnings |
| **Performance Efficiency** | Parallel branches, concurrency on Apply to Each, Compose over variables, Select action for array transforms |
| **Responsible AI** | Approval audit trails, human-in-the-loop for AI-generated actions, Content Safety on AI Builder outputs |
