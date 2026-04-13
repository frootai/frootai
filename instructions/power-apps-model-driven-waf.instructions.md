---
description: "Power Apps Model-driven standards — forms, views, business rules, Dataverse security."
applyTo: "**/*.xml"
waf:
  - "reliability"
  - "security"
---

# Power Apps Model-Driven — FAI Standards

## Form Customization

### OnLoad / OnSave / OnChange Handlers
- Register handlers via form designer event tab — never inline `<script>` in form XML
- Pass execution context as first parameter; use `formContext` (not deprecated `Xrm.Page`)
```typescript
// OnLoad — hide section based on optionset value
namespace Contoso.Account {
  export function onLoad(executionContext: Xrm.Events.EventContext): void {
    const formContext = executionContext.getFormContext();
    const category = formContext.getAttribute("accountcategorycode")?.getValue();
    formContext.ui.tabs.get("tab_details")?.sections.get("sec_premium")?.setVisible(category === 1);
  }

  export function onSave(executionContext: Xrm.Events.SaveEventContext): void {
    const formContext = executionContext.getFormContext();
    const revenue = formContext.getAttribute("revenue")?.getValue() ?? 0;
    if (revenue > 1_000_000 && !formContext.getAttribute("ownerid")?.getValue()) {
      executionContext.getEventArgs().preventDefault();
      formContext.ui.setFormNotification("Assign an owner for high-value accounts", "ERROR", "owner_required");
    }
  }

  export function onRevenueChange(executionContext: Xrm.Events.EventContext): void {
    const formContext = executionContext.getFormContext();
    const revenue = formContext.getAttribute("revenue")?.getValue() ?? 0;
    formContext.getAttribute("creditlimit")?.setValue(revenue * 0.1);
    formContext.getAttribute("creditlimit")?.setSubmitMode("always");
  }
}
```

### Business Rules vs Client Scripting
- **Business rules**: field visibility, requirement level, default values — no-code, runs server+client
- **Client script**: conditional logic across tabs, API calls, complex validation, ribbon interaction
- Never duplicate logic — if a business rule handles it, don't replicate in JS

## Ribbon / Modern Commanding
- Use modern commanding (Power Fx) over classic ribbon XML wherever possible
```
// Power Fx — enable button only for active records with permission
Self.Selected.Item.statecode = 0 &&
  LookUp(BU_Permissions, User = User().Email).CanApprove
```
- Classic `<EnableRule>` + `<DisplayRule>` for complex scenarios only (custom JS evaluation)
- Ribbon commands must check `formContext.data.entity.getIsDirty()` before navigation actions

## Views & FetchXML
- System views for org-wide defaults; personal views for user-specific filters
- Always add `<order>` and limit columns to what users actually need (max 8-10 columns)
```xml
<!-- Fetch active high-value accounts with owner, sorted by revenue desc -->
<fetch version="1.0" count="250" page="1">
  <entity name="account">
    <attribute name="name" />
    <attribute name="revenue" />
    <attribute name="ownerid" />
    <filter type="and">
      <condition attribute="statecode" operator="eq" value="0" />
      <condition attribute="revenue" operator="ge" value="500000" />
    </filter>
    <order attribute="revenue" descending="true" />
  </entity>
</fetch>
```
- Use `<link-entity>` sparingly — each join degrades performance; prefer Dataverse rollup columns

## Business Process Flows
- One active BPF per record at a time — switching BPFs resets stage data
- Stage gate validation via `OnPreStageChange` event — prevent advancing with incomplete data
- BPF entity records (`businessprocessflowinstance`) queryable — use for reporting/analytics
- Never hardcode stage IDs; look up by `stagename` attribute for solution portability

## Security Roles & Field-Level Security
- Custom roles: clone from a base role, never edit OOB roles directly
- Field-level security profiles for PII columns (SSN, salary, medical data)
- Principle of least privilege: business unit scoping > org-wide access
- Always test with a non-admin security role before deployment
- Environment variables for role GUIDs referenced in code — never hardcode

## Web Resources
- **Namespace convention**: `publisher_EntityName.js` (e.g., `contoso_Account.js`)
- One web resource per entity — consolidate handlers, reduce HTTP requests
- Upload minified bundles for production; source maps in dev solution only
- No jQuery or external CDN — use native `Xrm.WebApi` and `fetch` API
- `Xrm.Navigation.openWebResource()` for HTML web resources; size/position via `windowOptions`

## PCF Components
- Use `ReactControl` (virtual) for dataset/field components — full React lifecycle
- Standard control for DOM-heavy scenarios requiring direct element access
- `context.parameters` for input properties; `context.webAPI` for Dataverse CRUD
```typescript
// PCF — update Dataverse record on slider change
public updateView(context: ComponentFramework.Context<IInputs>): void {
  const threshold = context.parameters.threshold.raw ?? 50;
  this._slider.value = String(threshold);
  this._slider.onchange = () => {
    context.parameters.threshold.raw = Number(this._slider.value);
    this._notifyOutputChanged();
  };
}
```

## Dataverse Calculated & Rollup Columns
- Calculated columns for real-time derived values (full name, age from DOB, margin %)
- Rollup columns for aggregations (SUM, COUNT, AVG) — refresh interval is 12 hours (configurable)
- Never replicate rollup logic in plugins — let the platform handle aggregation
- Rollup recalculation on-demand: `CalculateRollupFieldRequest` in plugin or flow

## Solution Layers & Patches
- One unmanaged solution per project/team — never edit Default Solution directly
- Use patches for hotfixes; clone-and-merge for version upgrades
- Managed solutions in non-dev environments — block unmanaged customizations in production
- Solution checker (`pac solution check`) in CI — zero critical issues before import
- Publisher prefix: 3-5 chars, lowercase, consistent across all components

## Environment Variables
- Store connection refs, feature flags, API endpoints, tenant-specific config as env variables
- Access in Power Fx: `Environment.contoso_ApiBaseUrl`; in plugins: `EnvironmentVariableValueCollection`
- Never store secrets in env variables — use Azure Key Vault with custom connector
- Default values in solution; current values per environment (dev/test/prod)

## Async Plugin Patterns
- Register plugins async for non-blocking operations (audit logging, external sync, notifications)
- Async plugins execute in Async Service — retry 3 times with exponential backoff automatically
- Always check `IPluginExecutionContext.Depth` to prevent infinite loops (guard: `if (depth > 2) return`)
```csharp
// Async post-create plugin — sync account to external CRM
if (context.Depth > 2) return;
var account = (Entity)context.InputParameters["Target"];
var apiUrl = GetEnvironmentVariable(service, "contoso_ExternalCrmUrl");
using var http = new HttpClient();
http.DefaultRequestHeaders.Add("Authorization", $"Bearer {GetKeyVaultSecret("crm-api-key")}");
await http.PostAsJsonAsync($"{apiUrl}/accounts", MapToExternal(account));
```

## Dashboards & Charts
- System dashboards for org KPIs; personal dashboards for individual tracking
- Max 6 components per dashboard — avoid information overload
- Charts: use area/bar for trends, pie only for <6 categories, funnel for pipeline stages
- Interactive dashboards with global filters for entity-specific analytics (timeline + streams)
- Embed Power BI for complex analytics — avoid recreating BI logic in native charts

## Anti-Patterns
- ❌ Using deprecated `Xrm.Page` — always use `formContext` from execution context
- ❌ `setTimeout`/`setInterval` in form scripts — causes memory leaks across form navigation
- ❌ Synchronous `XMLHttpRequest` — blocks UI thread; use `Xrm.WebApi` (promise-based)
- ❌ Editing Default Solution or OOB security roles directly
- ❌ Hardcoding GUIDs (stage IDs, role IDs, view IDs) — breaks across environments
- ❌ FetchXML without `<filter>` on `statecode` — returns inactive records
- ❌ Multiple web resources per form for the same entity — consolidate into one namespace
- ❌ Sync plugins for external HTTP calls — causes platform timeout (2-minute limit)
- ❌ Storing secrets in environment variables or web resource config files

## WAF Alignment

| Pillar | Power Apps Model-Driven Practices |
|--------|----------------------------------|
| **Security** | Field-level security for PII, least-privilege roles, Key Vault for secrets, managed solution layering |
| **Reliability** | Async plugins with auto-retry, BPF stage gates, solution checker in CI, `Depth` guard in plugins |
| **Cost** | Right-size Dataverse capacity, rollup columns over plugin aggregation, limit view columns, PCF virtual controls |
| **Operational Excellence** | Solution patches for hotfixes, env variables per environment, publisher prefix convention, `pac solution check` |
| **Performance** | FetchXML with filters + ordering, consolidated web resources, async for external calls, PCF lazy rendering |
| **Responsible AI** | Content Safety on AI Builder outputs, PII column security profiles, audit logging on sensitive operations |
