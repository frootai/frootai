---
description: "Azure coding patterns and best practices for Climate Risk Assessor"
applyTo: "**/*.{py,ts,js,bicep,json}"
---

# Azure Coding Patterns — Climate Risk Assessor

## Authentication — Managed Identity First
Always use `DefaultAzureCredential` for Azure service authentication:

```python
from azure.identity import DefaultAzureCredential
from azure.ai.openai import AzureOpenAI

credential = DefaultAzureCredential()
client = AzureOpenAI(
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    azure_ad_token_provider=get_bearer_token_provider(credential, "https://cognitiveservices.azure.com/.default"),
    api_version="2024-12-01-preview"
)
```

**Never do this:**
```python
# ❌ WRONG: API key in code
client = AzureOpenAI(api_key="sk-abc123...")
# ❌ WRONG: API key from env without Managed Identity
client = AzureOpenAI(api_key=os.environ["OPENAI_API_KEY"])
```

## Azure SDK Error Handling
Wrap all Azure SDK calls with retry and proper error handling:

```python
from azure.core.exceptions import HttpResponseError, ServiceRequestError
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
async def call_azure_openai(prompt: str) -> str:
    try:
        response = await client.chat.completions.create(
            model=config["model"],
            messages=[{"role": "user", "content": prompt}],
            temperature=config["temperature"],
            max_tokens=config["max_tokens"]
        )
        return response.choices[0].message.content
    except HttpResponseError as e:
        if e.status_code == 429:
            logger.warning(f"Rate limited, retrying... (retry-after: {e.headers.get('Retry-After', 'unknown')})")
            raise  # Let tenacity handle retry
        elif e.status_code == 404:
            logger.error(f"Model deployment not found: {config['model']}")
            raise ValueError(f"Model {config['model']} not deployed")
        else:
            logger.error(f"Azure OpenAI error: {e.status_code} - {e.message}")
            raise
    except ServiceRequestError as e:
        logger.error(f"Network error calling Azure OpenAI: {e}")
        raise
```

## Key Vault Integration
Store and retrieve secrets using Azure Key Vault:

```python
from azure.keyvault.secrets import SecretClient

credential = DefaultAzureCredential()
secret_client = SecretClient(vault_url=os.environ["AZURE_KEY_VAULT_URL"], credential=credential)

# Retrieve secrets at startup, cache in memory
connection_string = secret_client.get_secret("database-connection-string").value
```

## Application Insights Logging
Use structured logging with correlation IDs:

```python
from azure.monitor.opentelemetry import configure_azure_monitor
from opentelemetry import trace

configure_azure_monitor(connection_string=os.environ["APPLICATIONINSIGHTS_CONNECTION_STRING"])
tracer = trace.get_tracer(__name__)

@tracer.start_as_current_span("process_request")
async def process_request(request_id: str, data: dict):
    span = trace.get_current_span()
    span.set_attribute("request.id", request_id)
    span.set_attribute("play.id", "72-climate-risk-assessor")
    # ... processing logic
    span.set_attribute("tokens.used", token_count)
    span.set_attribute("model.name", config["model"])
```

## Bicep Best Practices

### Module Pattern
```bicep
// Use modules for reusable resource groups
module openai 'modules/openai.bicep' = {
  name: 'openai-deployment'
  params: {
    location: location
    name: '${prefix}-openai'
    sku: environment == 'prod' ? 'S0' : 'S0'
    deployments: [
      { name: 'gpt-4o', model: { name: 'gpt-4o', version: '2024-11-20' }, sku: { name: 'GlobalStandard', capacity: 30 } }
      { name: 'text-embedding-3-large', model: { name: 'text-embedding-3-large', version: '1' }, sku: { name: 'Standard', capacity: 120 } }
    ]
  }
}
```

### Conditional Resources
```bicep
// Deploy monitoring only in production
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = if (environment == 'prod') {
  name: '${prefix}-logs'
  location: location
  properties: { retentionInDays: 90 }
}
```

### RBAC Role Assignments
```bicep
// Assign Cognitive Services User role to the app
resource openaiRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: openai
  name: guid(openai.id, app.id, cognitiveServicesUser)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesUser)
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

## Connection Patterns
- Use connection pooling for HTTP clients (set max connections)
- Configure timeouts: connect=5s, read=30s, total=60s
- Use async clients for I/O-bound operations
- Implement health check endpoints that verify all dependencies

## Environment Configuration
- Use `AZURE_*` environment variables for Azure endpoints
- Use `config/*.json` files for application parameters
- Never mix secrets with config — secrets go to Key Vault only
- Use `parameters.json` for Bicep deployment values

## Azure Resource Naming
Follow the convention: `{project}-{environment}-{resource-type}`
- Resource Group: `rg-fai-{env}`
- OpenAI: `oai-fai-{env}`
- Key Vault: `kv-fai-{env}`
- App Service: `app-fai-{env}`
- Storage: `stfrootai{env}` (no hyphens allowed)

## Cost Optimization Patterns
- Use `gpt-4o-mini` for classification/routing, `gpt-4o` for generation
- Cache frequent queries with Azure Cache for Redis (TTL based on data freshness)
- Set `max_tokens` to minimum needed — don't use unlimited
- Use Provisioned Throughput Units (PTU) for predictable high-volume workloads
- Auto-scale based on queue depth, not just CPU

## Testing Azure Integrations
```python
# Use environment variables to switch between test and prod
import pytest
from unittest.mock import AsyncMock, patch

@pytest.fixture
def mock_openai_client():
    client = AsyncMock()
    client.chat.completions.create.return_value = MockCompletion("test response")
    return client

async def test_process_request(mock_openai_client):
    with patch("app.client", mock_openai_client):
        result = await process_request("test-123", {"query": "test"})
        assert result is not None
        mock_openai_client.chat.completions.create.assert_called_once()
```
