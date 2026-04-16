---
name: fai-azure-openai-integration
description: Deploy Azure OpenAI with model selection, PTU vs PAYG pricing tiers, content safety filters, token management strategies, and streaming patterns — maximizing cost efficiency and compliance for AI applications.
---

# FAI Azure OpenAI

Provisions Azure OpenAI with deployment choices (PAYG on-demand vs PTU reserved capacity), content safety guardrails, structured output enforcement, token budgeting and monitoring, and streaming patterns for latency-sensitive scenarios. Handles model selection matrices, cost trade-offs, and scaling strategies for enterprise RAG and agentic workloads.

## When to Invoke

| Signal | Example |
|--------|---------|
| Model deployment unclear | Pricing difference between PAYG and PTU |
| No content safety filtering | User inputs unmoderated; compliance risk |
| Token budget unconstrained | Runaway costs from inefficient prompting |
| Streaming response latency high | Wait for full completion instead of streaming |

## Workflow

### Step 1 — Deploy Azure OpenAI with Managed Identity

```bicep
// infra/openai.bicep
param openaiName string
param location string
param principalId string  // Managed Identity object ID

resource openaiAccount 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = {
  name: openaiName
  location: location
  kind: 'OpenAI'
  identity: { type: 'SystemAssigned' }
  sku: { name: 'S0' }
  properties: {
    customSubdomainName: openaiName
    networkAcls: {
      defaultAction: 'Deny'
      virtualNetworkRules: []
      ipRules: []
    }
    publicNetworkAccess: 'Disabled'  // Enforce Private Endpoint
  }
}

// Private Endpoint for network isolation
resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-04-01' = {
  name: '${openaiName}-pe'
  location: location
  properties: {
    privateLinkServiceConnections: [
      {
        name: '${openaiName}-pls'
        properties: {
          privateLinkServiceId: openaiAccount.id
          groupIds: ['account']
        }
      }
    ]
    subnet: {
      id: subnetId
    }
  }
}

// Grant Managed Identity Cognitive Services OpenAI User role
resource rbacOpenAIUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(openaiAccount.id, principalId)
  scope: openaiAccount
  properties: {
    principalId: principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'a01a6dcd-988c-4e7f-b3c9-f3be5899c45c')  // Cognitive Services OpenAI User
  }
}

output endpoint string = openaiAccount.properties.endpoint
output accountId string = openaiAccount.id
```

### Step 2 — Deploy Models with PAYG vs PTU Strategy

```bicep
// infra/deployments.bicep
param openaiAccountId string
param location string

// PAYG deployment: gpt-4o for on-demand inference (flexible, higher per-token cost)
resource gpt4oPayg 'Microsoft.CognitiveServices/accounts/deployments@2023-10-01-preview' = {
  name: '${split(openaiAccountId, '/')[8]}/gpt-4o-payg'
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4o'
      version: '2024-05-13'
    }
    scaleSettings: {
      scaleType: 'Standard'
      capacity: 1  // Auto-scales as needed; no reserved capacity
    }
  }
}

// PTU deployment: gpt-4o-mini for predictable workloads (reserved capacity, lower per-token cost)
resource gpt4oMiniPtu 'Microsoft.CognitiveServices/accounts/deployments@2023-10-01-preview' = {
  name: '${split(openaiAccountId, '/')[8]}/gpt-4o-mini-ptu'
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4o-mini'
      version: '2024-07-18'
    }
    scaleSettings: {
      scaleType: 'TokensPerMinute'
      capacity: 300000  // 300K tokens/min = ~$2,400/month predictable cost
    }
  }
}

// Embedding model (PAYG): text-embedding-3-large for vector search
resource embeddingPayg 'Microsoft.CognitiveServices/accounts/deployments@2023-10-01-preview' = {
  name: '${split(openaiAccountId, '/')[8]}/text-embedding-3-large'
  properties: {
    model: {
      format: 'OpenAI'
      name: 'text-embedding-3-large'
      version: '1'
    }
    scaleSettings: {
      scaleType: 'Standard'
      capacity: 1
    }
  }
}

output deployments array = [
  { name: 'gpt-4o-payg', type: 'chat', pricing: 'PAYG' }
  { name: 'gpt-4o-mini-ptu', type: 'chat', pricing: 'PTU' }
  { name: 'text-embedding-3-large', type: 'embedding', pricing: 'PAYG' }
]
```

### Step 3 — Content Safety Integration

```python
# app/safety_filter.py
from azure.ai.contentsafety import ContentSafetyClient
from azure.core.credentials import AzureKeyCredential
from azure.identity import DefaultAzureCredential
import os

# Initialize Content Safety client
credential = DefaultAzureCredential()
client = ContentSafetyClient(
    endpoint=os.environ["CONTENT_SAFETY_ENDPOINT"],
    credential=credential,
)

def check_input_safety(text: str) -> dict:
    """Analyze user input for harmful content before sending to LLM"""
    
    response = client.analyze_text(
        request={
            "text": text,
            "categories": ["Hate", "SelfHarm", "Sexual", "Violence"],
            "threshold": 2,  # 0=safe, 4=most severe
        }
    )
    
    violations = []
    for category in response.categorized_result:
        if category.severity >= 2:
            violations.append({
                "category": category.category,
                "severity": category.severity,
            })
    
    return {
        "is_safe": len(violations) == 0,
        "violations": violations,
    }

def check_output_safety(text: str) -> dict:
    """Analyze model response for harmful content before returning to user"""
    
    response = client.analyze_text(
        request={
            "text": text,
            "categories": ["Hate", "Sexual", "Violence"],
            "threshold": 2,
        }
    )
    
    if any(cat.severity >= 2 for cat in response.categorized_result):
        return {
            "is_safe": False,
            "sanitized": "[Response filtered due to safety violation]"
        }
    
    return {"is_safe": True, "sanitized": text}
```

### Step 4 — Token Budget Monitoring and Routing

```python
# app/token_router.py
from azure.ai.openai import AzureOpenAI
from azure.identity import DefaultAzureCredential
import os
from datetime import datetime, timedelta

class TokenRouter:
    def __init__(self):
        self.credential = DefaultAzureCredential()
        self.endpoint = os.environ["AZURE_OPENAI_ENDPOINT"]
        self.budget_tokens_per_day = 50_000_000  # 50M tokens
        self.budget_window = datetime.utcnow().date()
        self.tokens_used = 0
    
    def select_deployment(self, prompt_size: int) -> str:
        """Route to PAYG or PTU based on token budget and cost"""
        
        tokens_remaining = self.budget_tokens_per_day - self.tokens_used
        cost_payg = prompt_size * 0.000003  # gpt-4o PAYG: $3/1M tokens
        cost_ptu = 0  # No incremental cost if under PTU capacity
        
        if tokens_remaining < prompt_size:
            return "over_budget"
        
        # Use PTU if available capacity; fall back to PAYG
        if prompt_size < (300_000 * 0.8):  # 80% of PTU capacity
            return "gpt-4o-mini-ptu"
        else:
            return "gpt-4o-payg"
    
    def create_completion(self, prompt: str, model_preference: str = "auto"):
        """Create completion with token tracking"""
        
        client = AzureOpenAI(
            api_version="2024-05-01-preview",
            azure_endpoint=self.endpoint,
            azure_ad_token_provider=lambda: self.credential.get_token(
                "https://cognitiveservices.azure.com/.default"
            ).token,
        )
        
        deployment = self.select_deployment(len(prompt.split()))
        
        if deployment == "over_budget":
            raise Exception("Daily token budget exceeded")
        
        response = client.chat.completions.create(
            deployment_id=deployment,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=512,
        )
        
        # Track token usage
        self.tokens_used += response.usage.total_tokens
        
        return {
            "content": response.choices[0].message.content,
            "tokens_used": response.usage.total_tokens,
            "deployment": deployment,
            "budget_remaining": self.budget_tokens_per_day - self.tokens_used,
        }
```

### Step 5 — Streaming for Low-Latency Response

```python
# app/streaming_handler.py
from azure.ai.openai import AzureOpenAI
from azure.identity import DefaultAzureCredential
import os

def stream_completion(prompt: str, callback=None):
    """Stream response tokens as they arrive (lower TTFB, better UX)"""
    
    credential = DefaultAzureCredential()
    client = AzureOpenAI(
        api_version="2024-05-01-preview",
        azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        azure_ad_token_provider=lambda: credential.get_token(
            "https://cognitiveservices.azure.com/.default"
        ).token,
    )
    
    with client.chat.completions.create(
        deployment_id="gpt-4o-payg",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1024,
        stream=True,
    ) as response:
        full_content = ""
        for chunk in response:
            if chunk.choices[0].delta.content:
                token = chunk.choices[0].delta.content
                full_content += token
                
                if callback:
                    callback(token)  # Stream to client in real-time
    
    return full_content
```

## Model Selection Matrix

| Scenario | Recommended Model | Deployment | Cost per Query |
|----------|-------------------|-----------|-----------------|
| High-complexity reasoning (code, math) | gpt-4o | PAYG | $0.015 (avg 1K tokens) |
| Standard chat/classification | gpt-4o-mini | PTU | ~$0 (amortized) |
| Embeddings/semantic search | text-embedding-3-large | PAYG | $0.00026 (1K tokens) |
| Vision/multimodal analysis | gpt-4o (vision) | PAYG | $0.03 (per image) |

## PTU Sizing Reference

| Monthly Active Users | Recommended PTU Capacity | Monthly Cost | Breakeven vs PAYG |
|---------------------|------------------------|--------------|------------------|
| 1,000 | 50K tokens/min | $400 | 2.5M queries |
| 10,000 | 300K tokens/min | $2,400 | 15M queries |
| 100,000 | 2M tokens/min | $16,000 | 100M queries |

## WAF Alignment

| Pillar | Contribution |
|--------|-------------|
| Security | Content Safety filters prevent prompt injection and harmful outputs; Managed Identity eliminates API key exposure |
| Cost Optimization | PTU vs PAYG routing reduces spend on predictable workloads; token budgeting prevents runaway costs |
| Operational Excellence | Monitoring tracks token consumption per user/model; alerts on budget exceed |
| Responsible AI | Safety filters ensure moderated responses; logging enables compliance audits |

## Compatible Solution Plays

- **Play 01** — Enterprise RAG (embedding + chat deployment strategy)
- **Play 03** — Deterministic Agent (structured output with gpt-4o)
- **Play 14** — Cost-Optimized AI Gateway (multi-model routing)

## Notes

- PTU requires 1-month commitment; ideal for predictable, high-volume workloads
- PAYG scales automatically; use for variable or experimental workloads
- Enable content safety on both input and output; latency impact ~100-200ms
- Monitor token usage via Application Insights; set alerts at 80% of daily budget
- Streaming reduces TTFB (time-to-first-byte) by 50-70% vs batch inference
