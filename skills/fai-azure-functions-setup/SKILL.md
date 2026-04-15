---
name: fai-azure-functions-setup
description: |
  Configure Azure Functions for AI workloads with Managed Identity, plan sizing,
  durable orchestrations, and OpenTelemetry observability. Use when building
  serverless AI endpoints, background processors, or event-driven pipelines.
---

# Azure Functions for AI Workloads

Configure Functions for serverless AI with identity, scaling, retries, and observability.

## When to Use

- Building serverless API endpoints for AI inference
- Creating event-driven document processing pipelines
- Running background jobs (embedding generation, evaluation)
- Orchestrating multi-step AI workflows with Durable Functions

---

## Bicep Provisioning

```bicep
resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.11'
      appSettings: [
        { name: 'AzureWebJobsStorage__accountName', value: storageAccount.name }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'python' }
        { name: 'AZURE_OPENAI_ENDPOINT', value: openAI.properties.endpoint }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
      ]
    }
  }
}

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  sku: { name: 'EP1', tier: 'ElasticPremium' }
  properties: {
    reserved: true
    maximumElasticWorkerCount: 10
  }
}
```

## Python Function with OpenAI

```python
import azure.functions as func
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider
import json, logging

app = func.FunctionApp()

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)
client = AzureOpenAI(
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    azure_ad_token_provider=token_provider,
    api_version="2024-10-21",
)

@app.route(route="chat", methods=["POST"], auth_level=func.AuthLevel.FUNCTION)
async def chat(req: func.HttpRequest) -> func.HttpResponse:
    body = req.get_json()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": body["message"]}],
        temperature=0.3,
        max_tokens=1024,
    )
    return func.HttpResponse(
        json.dumps({"reply": response.choices[0].message.content}),
        mimetype="application/json",
    )

@app.blob_trigger(arg_name="blob", path="documents/{name}",
                   connection="AzureWebJobsStorage")
async def process_document(blob: func.InputStream):
    logging.info(f"Processing: {blob.name}, size: {blob.length}")
    content = blob.read().decode("utf-8")
    # Embed and index the document...
```

## Plan Sizing

| Plan | Min Instances | Scale-out | Cold Start | Best For |
|------|--------------|-----------|------------|----------|
| Consumption | 0 | 200 | Yes (seconds) | Dev, low-traffic |
| Flex Consumption | 0 | 1000 | Reduced | Variable traffic |
| Elastic Premium (EP1) | 1 | 20 | None | Production AI |
| Dedicated (P1v3) | 1 | 30 | None | Sustained high load |

**For AI workloads:** Use Elastic Premium with `min_instances=1` to eliminate cold starts.

## Retry Policy

```json
{
  "retry": {
    "strategy": "exponentialBackoff",
    "maxRetryCount": 5,
    "minimumInterval": "00:00:04",
    "maximumInterval": "00:15:00"
  }
}
```

## RBAC for Managed Identity

```bash
# Grant Function MI access to OpenAI
az role assignment create \
  --assignee-object-id $FUNC_MI_ID \
  --role "Cognitive Services OpenAI User" \
  --scope $OPENAI_RESOURCE_ID

# Grant access to Storage (for blob trigger)
az role assignment create \
  --assignee-object-id $FUNC_MI_ID \
  --role "Storage Blob Data Contributor" \
  --scope $STORAGE_RESOURCE_ID
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Cold start latency >5s | Consumption plan, no pre-warmed instances | Switch to Premium with min_instances ≥ 1 |
| 403 on OpenAI calls | MI missing RBAC role | Grant Cognitive Services OpenAI User |
| Blob trigger not firing | Storage connection using keys, not MI | Set AzureWebJobsStorage__accountName (MI-based) |
| Function timeout (5 min) | Long AI processing on Consumption | Increase timeout or use Durable Functions |
