---
name: fai-load-test-ai-endpoint
description: "Load test an AI endpoint with k6/Locust for p95 latency and error rates"
---

# Load Test AI Endpoint

Validate LLM endpoint capacity, latency distribution, and throttling behavior under realistic concurrent load before production deployment.

## Azure Load Testing Setup

Create an Azure Load Testing resource and configure it to target your Azure OpenAI or model-serving endpoint:

```bash
az load create --name alt-fai-dev --resource-group rg-fai-dev --location eastus2
az load test create --load-test-resource alt-fai-dev \
  --test-id llm-capacity-test --display-name "LLM Capacity Validation" \
  --resource-group rg-fai-dev \
  --test-plan tests/load/locustfile.py --test-type LOCUST \
  --engine-instances 4
```

Grant the load testing resource Managed Identity access to your AOAI endpoint so tests authenticate without embedding keys.

## Locust Test Script — Chat Completions

```python
# tests/load/locustfile.py
import json, time, os
from locust import HttpUser, task, between, events
from azure.identity import DefaultAzureCredential

AOAI_ENDPOINT = os.environ["AZURE_OPENAI_ENDPOINT"]      # https://xxx.openai.azure.com
DEPLOYMENT = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")
API_VERSION = "2024-12-01-preview"

# Realistic prompt payloads — vary length to simulate real traffic
PROMPTS = [
    {"role": "user", "content": "Summarize the key changes in the Q3 earnings report for Contoso Ltd, focusing on revenue growth, operating margins, and forward guidance."},
    {"role": "user", "content": "You are a senior Azure architect. Design a high-availability deployment for a RAG pipeline serving 500 concurrent users with p99 latency under 3 seconds. Include compute, storage, and networking components."},
    {"role": "user", "content": "Translate this contract clause to French and flag any ambiguous legal terms:\n'The indemnifying party shall hold harmless the indemnified party from all claims arising out of or related to the performance of services under this agreement.'"},
    {"role": "user", "content": "Explain quantum entanglement to a 10-year-old in exactly three sentences."},
    {"role": "user", "content": "Write a Python function that implements exponential backoff retry with jitter for HTTP requests. Include type hints and a docstring."},
]

credential = DefaultAzureCredential()

class AoaiChatUser(HttpUser):
    wait_time = between(1, 3)
    host = AOAI_ENDPOINT

    def on_start(self):
        token = credential.get_token("https://cognitiveservices.azure.com/.default")
        self.client.headers.update({
            "Authorization": f"Bearer {token.token}",
            "Content-Type": "application/json",
        })

    @task(5)
    def chat_completion(self):
        """Standard (non-streaming) chat completion."""
        import random
        payload = {
            "messages": [{"role": "system", "content": "You are a helpful assistant."},
                         random.choice(PROMPTS)],
            "max_tokens": 512,
            "temperature": 0.7,
        }
        start = time.perf_counter()
        with self.client.post(
            f"/openai/deployments/{DEPLOYMENT}/chat/completions?api-version={API_VERSION}",
            json=payload, catch_response=True, name="chat_completion",
        ) as resp:
            ttft = time.perf_counter() - start
            if resp.status_code == 200:
                body = resp.json()
                tokens = body["usage"]["completion_tokens"]
                duration = time.perf_counter() - start
                events.request.fire(
                    request_type="CUSTOM", name="tokens_per_sec",
                    response_time=tokens / duration, response_length=0,
                    exception=None, context={},
                )
                resp.success()
            elif resp.status_code == 429:
                resp.failure(f"Throttled — retry-after: {resp.headers.get('retry-after', '?')}s")
            else:
                resp.failure(f"HTTP {resp.status_code}: {resp.text[:200]}")

    @task(2)
    def chat_completion_stream(self):
        """Streaming chat completion — measures TTFT and total stream time."""
        import random
        payload = {
            "messages": [{"role": "system", "content": "You are a concise assistant."},
                         random.choice(PROMPTS)],
            "max_tokens": 256, "temperature": 0.7, "stream": True,
        }
        start = time.perf_counter()
        first_chunk_time = None
        chunk_count = 0
        with self.client.post(
            f"/openai/deployments/{DEPLOYMENT}/chat/completions?api-version={API_VERSION}",
            json=payload, catch_response=True, name="chat_stream", stream=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"HTTP {resp.status_code}")
                return
            for line in resp.iter_lines():
                if line and line.startswith(b"data: ") and line != b"data: [DONE]":
                    chunk_count += 1
                    if first_chunk_time is None:
                        first_chunk_time = time.perf_counter() - start
            total = time.perf_counter() - start
            if first_chunk_time:
                events.request.fire(
                    request_type="CUSTOM", name="ttft_ms",
                    response_time=first_chunk_time * 1000,
                    response_length=0, exception=None, context={},
                )
            resp.success()
```

## Key Metrics to Capture

| Metric | Target (PTU) | Target (PAYG) | Why It Matters |
|--------|-------------|---------------|----------------|
| Latency p50 | < 800ms | < 1.5s | Median user experience |
| Latency p95 | < 2s | < 4s | Tail latency under load |
| Latency p99 | < 4s | < 8s | Worst-case SLA compliance |
| TTFT (streaming) | < 300ms | < 600ms | Perceived responsiveness |
| Throughput (req/min) | ≥ PTU capacity | Varies | Validates provisioned capacity |
| Tokens/sec | ≥ 60/user | ≥ 30/user | Output generation speed |
| Error rate (429s) | < 1% | < 5% | Throttling threshold |
| Error rate (5xx) | 0% | < 0.1% | Backend stability |

## PTU Capacity Validation

Run a stepped load test that ramps from 10% to 120% of your provisioned capacity to find the exact throttling cliff:

```yaml
# tests/load/ptu-capacity-test.yml
testName: PTU Capacity Validation
testPlan: locustfile.py
engineInstances: 4
configurationOverrides:
  AZURE_OPENAI_ENDPOINT: ${{ env.AZURE_OPENAI_ENDPOINT }}
  AZURE_OPENAI_DEPLOYMENT: gpt-4o
loadProfile:
  - duration: 120   # 2 min warmup at 20 users
    users: 20
  - duration: 180   # 3 min at 50% capacity
    users: 50
  - duration: 180   # 3 min at 80% capacity
    users: 80
  - duration: 180   # 3 min at 100% capacity
    users: 100
  - duration: 120   # 2 min at 120% — expect throttling
    users: 120
failureCriteria:
  - "avg(response_time_ms) > 3000, action: stop"
  - "percentage(error) > 10, action: stop"
  - "p99(response_time_ms) > 8000, action: stop"
```

At 120% load, expect 429 responses. Record the `retry-after` header values — they reveal AOAI's token-bucket refill rate for your PTU allocation.

## Throttling Behavior Analysis

When the test completes, analyze throttling patterns:

```python
# scripts/analyze_load_results.py
import pandas as pd

df = pd.read_csv("tests/load/results_stats_history.csv")
df["timestamp"] = pd.to_datetime(df["Timestamp"], unit="s")

# Identify throttling onset — first 429 response
throttle_start = df[df["# failures"] > 0].iloc[0]["timestamp"] if (df["# failures"] > 0).any() else None

# Calculate metrics per load stage
for stage_users in [20, 50, 80, 100, 120]:
    stage = df[df["User count"] == stage_users]
    if stage.empty:
        continue
    print(f"\n--- {stage_users} concurrent users ---")
    print(f"  p50: {stage['50%'].mean():.0f}ms")
    print(f"  p95: {stage['95%'].mean():.0f}ms")
    print(f"  p99: {stage['99%'].mean():.0f}ms")
    print(f"  RPS: {stage['Requests/s'].mean():.1f}")
    print(f"  Error%: {(stage['# failures'].sum() / stage['# requests'].sum() * 100):.1f}%")

if throttle_start:
    print(f"\nThrottling onset: {throttle_start} (at ~{df[df['timestamp'] == throttle_start]['User count'].values[0]} users)")
```

## CI Integration — Pre-Production Gate

Add load testing as a deployment gate in your GitHub Actions pipeline:

```yaml
# .github/workflows/load-test.yml
name: Load Test Gate
on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string

jobs:
  load-test:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    permissions:
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - uses: azure/load-testing@v1
        with:
          loadTestConfigFile: tests/load/ptu-capacity-test.yml
          loadTestResource: alt-fai-dev
          resourceGroup: rg-fai-dev

      - name: Fail on SLA breach
        if: failure()
        run: |
          echo "::error::Load test failed — p99 latency or error rate exceeded thresholds"
          echo "Review results in Azure Portal → Load Testing → Test Runs"
          exit 1
```

Call this workflow from your deploy pipeline as a gate before production:

```yaml
# In your main deploy workflow
deploy-staging:
  # ... deploy to staging ...

load-test-gate:
  needs: deploy-staging
  uses: ./.github/workflows/load-test.yml
  with:
    environment: staging

deploy-production:
  needs: load-test-gate
  # ... only runs if load test passes ...
```

## Checklist

- [ ] Locust script uses Managed Identity (no API keys in test code)
- [ ] Prompt payloads vary in length to simulate real traffic distribution
- [ ] Streaming and non-streaming endpoints both tested
- [ ] Stepped load profile hits 120% of PTU capacity to find throttling cliff
- [ ] Failure criteria auto-stop tests when SLAs breach (saves cost)
- [ ] TTFT measured separately from total completion time for streaming
- [ ] CI pipeline blocks production deploy on load test failure
- [ ] Results exported for trend analysis across releases
