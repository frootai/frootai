---
name: fai-azure-functions-setup
description: Scaffold Azure Functions apps with HTTP/Event Hub/Service Bus triggers, input/output bindings, Managed Identity, Application Insights, and local development setup — enabling serverless AI microservices in minutes.
---

# FAI Azure Functions

Provisions Azure Functions with Common Language Runtime (CLR), Python, or Node.js; wires triggers and bindings for HTTP, Event Grid, and Service Bus; integrates Managed Identity, structured logging, and Application Insights. Prevents Functions setup friction: boilerplate trigger code, credential management, and local debugging setup.

## When to Invoke

| Signal | Example |
|--------|---------|
| Serverless microservices needed | Document embedding function on blob upload |
| Event-driven workflows missing | Manual polling instead of trigger-based functions |
| CI/CD deployment is manual | Functions deployed via portal or local CLI |
| Observability is unclear | No structured traces or custom metrics |

## Workflow

### Step 1 — Create Function App

```bicep
// infra/functions.bicep
param location string
param functionAppName string
param storageAccountId string
param appInsightsId string

resource hostingPlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '${functionAppName}-plan'
  location: location
  kind: 'Linux'
  sku: {
    name: 'EP1'  // Elastic Premium for serverless scaling
    tier: 'ElasticPremium'
  }
}

resource functionApp 'Microsoft.Web/sites@2023-01-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    httpsOnly: true
    serverFarmId: hostingPlan.id
    siteConfig: {
      appSettings: [
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;...' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'python' }
        { name: 'APPINSIGHTS_INSTRUMENTATIONKEY', value: reference(appInsightsId).InstrumentationKey }
      ]
      linuxFxVersion: 'PYTHON|3.11'
      functionAppScaleLimit: 200
    }
  }
}
```

### Step 2 — HTTP Trigger with Managed Identity

```python
# functions/CompletionHandler/__init__.py
import azure.functions as func
from azure.ai.openai import AzureOpenAI
from azure.identity import DefaultAzureCredential
import logging

# Initialize client once (outside function for warm start)
client = AzureOpenAI(
    api_version="2024-02-01",
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    azure_ad_token_provider=lambda: DefaultAzureCredential().get_token(
        "https://cognitiveservices.azure.com/.default"
    ).token,
)

async def main(req: func.HttpRequest, context: func.Context) -> func.HttpResponse:
    logger = logging.getLogger(context.function_name)
    
    try:
        req_body = req.get_json()
        prompt = req_body["prompt"]
        
        logger.info(f"Processing completion request: {context.invocation_id}")
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=512,
        )
        
        return func.HttpResponse(
            json.dumps({
                "status": "success",
                "response": response.choices[0].message.content,
                "request_id": context.invocation_id,
            }),
            status_code=200,
            mimetype="application/json"
        )
    
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": "Invalid request", "details": str(e)}),
            status_code=400,
        )
```

### Step 3 — Event Hub Trigger for Streaming Ingestion

```python
# functions/EmbeddingBatchProcessor/__init__.py
import azure.functions as func
from azure.ai.openai import AzureOpenAI
import json

async def main(events: func.EventHubEvent):
    for event in events:
        documents = json.loads(event.get_body().decode('utf-8'))
        
        embeddings = client.embeddings.create(
            input=[d["text"] for d in documents],
            model="text-embedding-3-large",
        )
        
        for doc, embedding in zip(documents, embeddings.data):
            # Store in Cosmos DB with vector index
            container.upsert_item({
                "id": doc["id"],
                "content": doc["text"],
                "vector_embedding": embedding.embedding,
            })
```

### Step 4 — Service Bus Trigger for Reliability

```python
# functions/ReliableWorker/__init__.py
import azure.functions as func
from azure.service bus import ServiceBusClient
from azure.identity import DefaultAzureCredential
import logging

async def main(msg: func.ServiceBusMessage):
    logger = logging.getLogger("ReliableWorker")
    
    try:
        payload = json.loads(msg.get_body().decode('utf-8'))
        logger.info(f"Processing job: {payload['job_id']}")
        
        # Process work
        result = await do_work(payload)
        
        # Mark complete
        await msg.complete()
        logger.info(f"Job {payload['job_id']} completed")
        
    except Exception as e:
        # Automatic retry (Service Bus default: 10 times, exponential backoff)
        logger.error(f"Job failed: {str(e)}")
        # Message goes back to queue on exception
        raise
```

### Step 5 — Output Binding to Cosmos

```python
# functions/SaveResults/__init__.py
import azure.functions as func
import json

def main(
    req: func.HttpRequest,
    outputDocument: func.Out[func.AsJson],
) -> func.HttpResponse:
    
    document_id = req.params.get('id')
    result_data = req.get_json()
    
    # Output binding automatically saves to Cosmos DB
    outputDocument.set(func.AsJson({
        "id": document_id,
        "timestamp": datetime.utcnow().isoformat(),
        "results": result_data,
    }))
    
    return func.HttpResponse("Saved", status_code=200)
```

Output binding declaration in `function.json`:

```json
{
  "scriptFile": "function_app.py",
  "bindings": [
    {
      "authLevel": "function",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req"
    },
    {
      "type": "cosmosDB",
      "direction": "out",
      "name": "outputDocument",
      "databaseName": "ai-workload",
      "collectionName": "results",
      "connectionStringSetting": "AzureCosmosDBConnectionString",
      "createIfNotExists": false
    }
  ]
}
```

## Trigger Reference

| Trigger | Use Case | Scalability |
|---------|----------|------------|
| HTTP | REST API, webhooks | Auto-scale (Elastic Premium: 200 instances) |
| Event Hub | Streaming telemetry | Partition-based parallel processing |
| Service Bus | Reliable async work | Competing consumers with dead-letter |
| Blob | Document processing | One function per blob write |
| Timer | Scheduled tasks | Single instance only |

## WAF Alignment

| Pillar | Contribution |
|--------|-------------|
| Security | Managed Identity eliminates API key exposure; no local auth needed |
| Reliability | Service Bus dead-letter queue captures failed messages; retry policies built-in |
| Cost Optimization | Serverless scales to zero when idle; pay-per-execution pricing |
| Operational Excellence | Application Insights captures traces automatically; correlation IDs for request tracing |

## Compatible Solution Plays

- **Play 01** — Enterprise RAG (embedding function on doc upload)
- **Play 07** — Multi-Agent Service (agent orchestration function)
- **Play 37** — DevOps AI (automated remediation function)

## Notes

- Elastic Premium plan enables reserved instances and auto-scaling
- Avoid storing credentials in app settings; use Managed Identity for all Azure service access
- Application Insights integration is automatic with runtime extensions; no instrumentation code needed
- Local debugging: `func start --build` to debug locally; use Azure Storage Emulator for bindings
