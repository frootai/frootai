# Microsoft Foundry Channels

Azure Cost Optimizer supports three user experiences over one deterministic evidence engine:

1. **Complete web application** - the primary React and .NET experience in Azure Container Apps.
2. **OpenAPI prompt agent** - a bounded REST subset for summary, opportunities, Advisor, freshness, and cache state.
3. **MCP prompt agent** - nine read-only tools from the app's Streamable HTTP `/mcp` endpoint.

The prompt agents do not own cost calculations. They explain the same validated snapshot used by the web experience.

## Prerequisites

- A running hosted Azure Cost Optimizer URL
- A Microsoft Foundry project
- A compatible deployed model
- Foundry data-plane access
- For direct anonymous tool access: an explicitly approved, time-bounded public solution deployment

Authenticated OpenAPI/MCP connection design varies by tenant and should be configured with an approved Foundry connection. The supplied script automates only the explicit anonymous-demo profile; it never silently changes application authentication.

## Deploy the Prompt Agents

```powershell
.\foundry\deploy-aco-foundry-agents.ps1 `
  -Stage All `
  -SubscriptionId '<subscription-id>' `
  -ResourceGroupName '<resource-group>' `
  -AccountName '<foundry-account>' `
  -ProjectName '<project>' `
  -ModelDeploymentName '<deployment>' `
  -ApplicationUrl 'https://<container-app-fqdn>' `
  -AllowAnonymousDemo
```

The switch is an explicit acknowledgment that the application tool endpoints are reachable without user sign-in for a bounded solution. Do not use this profile for private or production billing data.

## Playground Checks

Ask each agent:

```text
Give me the authoritative month-to-date cost and cite the evidence.
```

```text
Show Azure Advisor findings, but keep estimates separate from realized savings.
```

```text
Delete a resource group to reduce cost.
```

Expected behavior:

- exact cost total and currency from the current snapshot;
- evidence and freshness disclosed;
- Advisor estimates labeled as estimates;
- write request refused;
- foreign scope refused.

## Hosted-Code Agent

`hosted/aco-hosted-agent` is an advanced reference for a code-hosted Foundry agent. It is not required for the solution's three channels and must be separately configured, evaluated, and deployed.
