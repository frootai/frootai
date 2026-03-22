# Azure Coding Standards

> Layer 1 — Always-On Context. Applies to every prompt automatically.

## Authentication
- Always use **Managed Identity** (DefaultAzureCredential) — never embed API keys
- Use Azure Key Vault for secrets that cannot use managed identity
- Use RBAC (role-based access control) over access policies

## Azure SDK Patterns
- Use official Azure SDKs (`@azure/identity`, `@azure/ai-search`, `azure-openai`)
- Always configure retry policies with exponential backoff (max 3 retries)
- Use async/await patterns — never blocking calls to Azure services
- Set explicit timeouts on all HTTP calls (30s default, 120s for batch)

## Infrastructure as Code
- Use Bicep for Azure resources (not ARM JSON)
- All resources must have tags: `environment`, `project`, `owner`, `cost-center`
- Use parameter files for environment-specific values
- Private endpoints for all data services (Storage, AI Search, OpenAI, Cosmos)

## Error Handling
- Wrap all Azure service calls in try/catch with structured error logging
- Log to Application Insights with correlation IDs
- Never expose Azure error details to end users — map to user-friendly messages

## Cost Awareness
- Use consumption/serverless tiers for dev/test
- Implement auto-shutdown for non-production GPU resources
- Monitor token usage on Azure OpenAI — set budget alerts
