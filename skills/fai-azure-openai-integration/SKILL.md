---
name: fai-azure-openai-integration
description: |
  Integrate Azure OpenAI into applications with model routing, structured output,
  content filtering, retry policies, and token tracking. Use when connecting apps
  to GPT-4o, GPT-4o-mini, or embedding models via Azure OpenAI Service.
---

# Azure OpenAI Integration

Connect applications to Azure OpenAI with resilient patterns, safety, and cost control.

## When to Use

- Adding LLM capabilities to an existing application
- Implementing structured output with JSON mode or response_format
- Setting up retry and fallback policies for production reliability
- Tracking token consumption for cost management

---

## Python SDK Integration

```python
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider
import os

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

client = AzureOpenAI(
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    azure_ad_token_provider=token_provider,
    api_version="2024-10-21",
    max_retries=3,
    timeout=30.0,
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Explain circuit breaker pattern"},
    ],
    temperature=0.3,
    max_tokens=1024,
)
print(response.choices[0].message.content)
```

## Structured Output

```python
from pydantic import BaseModel

class ReviewResult(BaseModel):
    category: str
    severity: str
    summary: str
    recommendation: str

response = client.beta.chat.completions.parse(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "Analyze code for security issues. Return structured JSON."},
        {"role": "user", "content": code_to_review},
    ],
    response_format=ReviewResult,
)
result: ReviewResult = response.choices[0].message.parsed
print(f"{result.severity}: {result.summary}")
```

## .NET Integration

```csharp
using Azure.AI.OpenAI;
using Azure.Identity;

var client = new AzureOpenAIClient(
    new Uri(Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT")!),
    new DefaultAzureCredential()
);

var chatClient = client.GetChatClient("gpt-4o-mini");
var response = await chatClient.CompleteChatAsync(
    [new UserChatMessage("Explain retry patterns")],
    new ChatCompletionOptions { Temperature = 0.3f, MaxOutputTokenCount = 1024 }
);
Console.WriteLine(response.Value.Content[0].Text);
```

## Token Tracking

```python
def call_with_tracking(prompt: str, model: str = "gpt-4o-mini") -> tuple[str, dict]:
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
    )
    usage = {
        "model": model,
        "prompt_tokens": response.usage.prompt_tokens,
        "completion_tokens": response.usage.completion_tokens,
        "total_tokens": response.usage.total_tokens,
        "estimated_cost": (response.usage.prompt_tokens * 0.0025 +
                          response.usage.completion_tokens * 0.01) / 1000,
    }
    return response.choices[0].message.content, usage
```

## Retry with Fallback

```python
import time

def call_with_fallback(prompt: str, primary="gpt-4o", fallback="gpt-4o-mini"):
    for model in [primary, fallback]:
        try:
            return client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
            )
        except Exception as e:
            if "429" in str(e) and model == primary:
                time.sleep(1)
                continue
            raise
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| 429 Too Many Requests | Token rate limit exceeded | Enable retry with backoff, add model routing to mini |
| 403 Forbidden | Missing Cognitive Services OpenAI User role | Grant RBAC to application MI |
| Content filter blocking | Default filter too aggressive | Create custom content filter policy |
| High latency on first call | Token cold start or DNS | Use connection pooling, warm up endpoint |
