---
description: "Dataverse SDK standards — entity operations, metadata, batch requests, and Power Platform integration."
applyTo: "**/*.py, **/*.cs"
waf:
  - "reliability"
  - "operational-excellence"
---

# Dataverse — FAI Standards

## Connection & Authentication

- Use `ServiceClient` from `Microsoft.PowerPlatform.Dataverse.Client` — never the deprecated `CrmServiceClient`
- Authenticate via `DefaultAzureCredential` or app registration with client secret stored in Key Vault
- Reuse a single `ServiceClient` instance per lifetime scope — it manages its own connection pool
- Set `MaxConnectionTimeout` explicitly; default 120s is too long for most web scenarios

```csharp
// ✅ Preferred: ServiceClient with connection string
var client = new ServiceClient(
    "AuthType=ClientSecret;Url=https://org.crm.dynamics.com;" +
    $"ClientId={config["AppId"]};ClientSecret={secret};");

// ✅ Preferred: ServiceClient with TokenCredential
var client = new ServiceClient(
    new Uri("https://org.crm.dynamics.com"),
    new DefaultAzureCredential());
```

## CRUD Operations

- Use early-bound entity classes generated via `pac modelbuilder build` for compile-time safety
- Fall back to late-bound `Entity` only for generic/dynamic scenarios (e.g., metadata-driven UI)
- Always set `entity.KeyAttributes` for upsert operations — avoids duplicate-check round-trips
- Use `ColumnSet` with explicit column names — never `new ColumnSet(true)` (selects all columns)

```csharp
// ✅ Preferred: early-bound with explicit columns
var account = client.Retrieve("account", id, new ColumnSet("name", "revenue"));

// ❌ Avoided: select all columns
var account = client.Retrieve("account", id, new ColumnSet(true));
```

## Batch Operations

- Use `ExecuteMultipleRequest` for bulk writes (create/update/delete) — max 1000 per batch
- Set `ContinueOnError = true` unless the entire batch must be atomic
- For atomic multi-step operations, use `ExecuteTransactionRequest` (max 750 requests)
- Monitor `ExecuteMultipleResponse.IsFaulted` and iterate `Responses` for per-item error handling

```csharp
var batch = new ExecuteMultipleRequest {
    Requests = new OrganizationRequestCollection(),
    Settings = new ExecuteMultipleSettings {
        ContinueOnError = true,
        ReturnResponses = true
    }
};
foreach (var entity in entities)
    batch.Requests.Add(new CreateRequest { Target = entity });

var response = (ExecuteMultipleResponse)client.Execute(batch);
foreach (var item in response.Responses.Where(r => r.Fault != null))
    logger.LogError("Index {Idx} failed: {Msg}", item.RequestIndex, item.Fault.Message);
```

## Query Patterns

- **QueryExpression** — default choice for programmatic queries with joins and filters
- **FetchXML** — use for aggregates (`groupby`, `sum`, `avg`), linked-entity outer joins, and queries built from user-configurable XML
- **LINQ** — use only with early-bound context for simple projections; avoid complex joins (generates suboptimal FetchXML)
- Always apply `TopCount` or paging cookies for large result sets — never retrieve unbounded

```csharp
// ✅ Preferred: QueryExpression with paging
var query = new QueryExpression("contact") {
    ColumnSet = new ColumnSet("fullname", "emailaddress1"),
    TopCount = 500,
    Criteria = { Conditions = {
        new ConditionExpression("statecode", ConditionOperator.Equal, 0)
    }}
};
```

```xml
<!-- ✅ FetchXML for aggregation -->
<fetch aggregate="true">
  <entity name="opportunity">
    <attribute name="estimatedvalue" alias="total" aggregate="sum"/>
    <filter><condition attribute="statecode" operator="eq" value="0"/></filter>
  </entity>
</fetch>
```

## Plugin Development

- Implement `IPlugin` with a single `Execute` method — keep plugins stateless
- Obtain `ITracingService`, `IOrganizationServiceFactory`, and `IPluginExecutionContext` from `IServiceProvider`
- Never store state in plugin class fields — the platform caches and reuses instances
- Wrap all logic in try/catch and throw `InvalidPluginExecutionException` with user-friendly messages
- Target depth check: exit early if `context.Depth > 1` to prevent infinite loops
- Register plugins on the correct pipeline stage: PreValidation (10), PreOperation (20), PostOperation (40)

```csharp
public class AccountValidator : IPlugin {
    public void Execute(IServiceProvider serviceProvider) {
        var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
        var tracer = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
        if (context.Depth > 2) return; // guard infinite recursion

        try {
            var target = (Entity)context.InputParameters["Target"];
            if (string.IsNullOrWhiteSpace(target.GetAttributeValue<string>("name")))
                throw new InvalidPluginExecutionException("Account name is required.");
            tracer.Trace("Validated account: {0}", target.Id);
        } catch (InvalidPluginExecutionException) { throw; }
          catch (Exception ex) {
            tracer.Trace("Unhandled: {0}", ex);
            throw new InvalidPluginExecutionException("An error occurred validating the account.", ex);
        }
    }
}
```

## Solution & ALM

- Package customizations in managed solutions for production; unmanaged for dev only
- Use `pac solution export --managed` and `pac solution import` in CI/CD pipelines
- Store solution XML in source control via `pac solution unpack` — enables PR-based reviews
- Pin solution versions with semantic versioning; never overwrite a published version
- Use environment variables (`EnvironmentVariableDefinition`) for env-specific config — not hardcoded GUIDs

## Entity Relationships & Schema

- Prefer `Lookup` (N:1) over `Customer` type unless polymorphic reference to Account/Contact is required
- Use `Alternate Keys` for integration scenarios — avoids GUID coupling with external systems
- Set `CascadeConfiguration` explicitly on relationships — defaults (`Cascade.All`) cause unexpected deletes
- Virtual entities for read-only external data sources — no Dataverse storage cost, queryable via standard API

## Change Tracking & Integration

- Enable change tracking on entities used for incremental sync (`EntityMetadata.ChangeTrackingEnabled`)
- Use `RetrieveEntityChangesRequest` with a stored delta token — not date-based polling
- For high-volume integration, use Dataverse Web API with `$deltatoken` over OData
- Webhook registrations for event-driven integration — prefer Azure Service Bus over HTTP callbacks for reliability

## Power Fx (Canvas Apps / Custom Pages)

- Use `Patch()` for single-record writes, `ForAll()` + `Patch()` only for small batches (<100)
- Prefer `LookUp()` with indexed columns over `Filter().First()` — avoids full table scan
- Delegate-aware functions only: `Filter`, `Sort`, `Search`, `LookUp` — check delegation warnings
- Use `Concurrent()` for parallel data loads on screen init

## Security Model

- Use security roles with least-privilege — never assign System Administrator for integration accounts
- Prefer Business Unit scoping over Organization-wide access
- Use Column-level security for sensitive fields (SSN, salary, PII)
- Service principals (`S2S`) for server-to-server — not user credentials in unattended flows
- Field-level masking via Dataverse column security profiles, not custom plugin logic

## Anti-Patterns

- ❌ Using `CrmServiceClient` — deprecated, use `ServiceClient`
- ❌ `new ColumnSet(true)` — retrieves all columns, massive perf hit on wide entities
- ❌ Storing state in plugin class fields — platform reuses instances across executions
- ❌ Synchronous plugins with external HTTP calls — blocks the pipeline, 2-minute timeout
- ❌ Hardcoding GUIDs for environment-specific records — use environment variables or alternate keys
- ❌ `ExecuteMultipleRequest` with `ContinueOnError = false` and no error handling
- ❌ Using `Retrieve` inside a loop instead of a single `RetrieveMultiple` with `In` condition
- ❌ Date-based polling for integration sync — use change tracking with delta tokens
- ❌ Deploying unmanaged solutions to production — no clean uninstall path
- ❌ Assigning System Administrator role to application users or integration accounts

## WAF Alignment

| WAF Pillar | Dataverse Practice |
|---|---|
| **Reliability** | `ExecuteTransactionRequest` for atomicity; retry on `429`/`503` with `Retry-After` header; plugin depth guards; change tracking with delta tokens for resilient sync |
| **Security** | `DefaultAzureCredential` / S2S app registration; column-level security for PII; least-privilege security roles; managed solution deployment only |
| **Cost Optimization** | Explicit `ColumnSet` (never select-all); `TopCount` / paging on queries; batch with `ExecuteMultipleRequest` to reduce API calls; virtual entities for external read-only data |
| **Operational Excellence** | `ITracingService` for plugin diagnostics; `pac solution unpack` for source-controlled ALM; environment variables for config; CI/CD with `pac` CLI |
| **Performance Efficiency** | QueryExpression with indexed filters; FetchXML for server-side aggregation; `Concurrent()` in Power Fx; change tracking over full-sync polling |
| **Responsible AI** | Content Safety on AI-generated Dataverse records; PII column security profiles; audit logging enabled on sensitive entities |
