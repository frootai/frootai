---
description: "Monitoring standards — Application Insights, structured logging, custom metrics, alert thresholds."
applyTo: "**/*.py, **/*.ts, **/*.cs"
waf:
  - "operational-excellence"
---

# Observability & Monitoring — FAI Standards

## Structured Logging

Every log entry: JSON, correlation ID, no PII. Use Application Insights SDK — never raw `console.log` or `print`.

```python
# Python — structured logging with OpenTelemetry + App Insights
import logging, azure.monitor.opentelemetry as az_otel
from opentelemetry import trace

az_otel.configure_azure_monitor(connection_string=os.environ["APPLICATIONINSIGHTS_CONNECTION_STRING"])
tracer = trace.get_tracer(__name__)
logger = logging.getLogger(__name__)

def handle_chat(request: ChatRequest) -> ChatResponse:
    correlation_id = request.headers.get("x-correlation-id", str(uuid.uuid4()))
    with tracer.start_as_current_span("handle_chat", attributes={"correlation_id": correlation_id}):
        logger.info("chat_request", extra={
            "custom_dimensions": {
                "correlation_id": correlation_id,
                "model": request.model,
                "token_budget": request.max_tokens,
                "user_id_hash": hashlib.sha256(request.user_id.encode()).hexdigest()[:8],
            }
        })
```

```typescript
// TypeScript — Application Insights with W3C trace context
import { TelemetryClient } from "applicationinsights";
const client = new TelemetryClient(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING);

function trackLLMCall(model: string, correlationId: string, latencyMs: number, tokens: { prompt: number; completion: number }) {
  client.trackEvent({
    name: "llm_completion",
    properties: { correlationId, model, promptTokens: String(tokens.prompt), completionTokens: String(tokens.completion) },
    measurements: { latencyMs, totalTokens: tokens.prompt + tokens.completion },
  });
  client.trackMetric({ name: "llm_latency_ms", value: latencyMs, properties: { model } });
  client.trackMetric({ name: "token_usage", value: tokens.prompt + tokens.completion, properties: { model, type: "total" } });
}
```

## Custom Metrics

Track these metrics on every AI request — surface in Azure Monitor Metrics Explorer:

| Metric | Type | Labels | Purpose |
| --- | --- | --- | --- |
| `llm_latency_ms` | Histogram | model, endpoint | p50/p95/p99 response time |
| `token_usage` | Counter | model, type(prompt/completion) | Cost attribution per endpoint |
| `cache_hit_rate` | Gauge | cache_layer(semantic/exact) | Cache effectiveness |
| `groundedness_score` | Gauge | model, play_id | RAG quality per deployment |
| `retrieval_mrr` | Gauge | index, query_type | Search quality (Mean Reciprocal Rank) |
| `error_rate` | Counter | model, error_code, endpoint | 429s, 500s, content-filter blocks |
| `active_requests` | Gauge | endpoint | Concurrency pressure |

```python
# Python — custom metrics via OpenTelemetry
from opentelemetry.metrics import get_meter
meter = get_meter("fai.ai.metrics")

token_counter = meter.create_counter("token_usage", description="LLM tokens consumed", unit="tokens")
latency_hist = meter.create_histogram("llm_latency_ms", description="LLM call latency", unit="ms")
groundedness_gauge = meter.create_gauge("groundedness_score", description="RAG groundedness 0-5")

def record_completion(model: str, latency: float, prompt_tokens: int, completion_tokens: int, groundedness: float):
    labels = {"model": model}
    token_counter.add(prompt_tokens, {**labels, "type": "prompt"})
    token_counter.add(completion_tokens, {**labels, "type": "completion"})
    latency_hist.record(latency, labels)
    groundedness_gauge.set(groundedness, labels)
```

## Distributed Tracing — OpenTelemetry

Propagate W3C `traceparent` across all service boundaries. Every span must include: operation name, model, token count, correlation ID.

```typescript
// TypeScript — OpenTelemetry manual span for RAG pipeline
import { trace, SpanStatusCode } from "@opentelemetry/api";
const tracer = trace.getTracer("fai.rag.pipeline");

async function ragPipeline(query: string, correlationId: string) {
  return tracer.startActiveSpan("rag_pipeline", async (span) => {
    span.setAttribute("correlation_id", correlationId);
    const docs = await tracer.startActiveSpan("retrieve_documents", async (rSpan) => {
      const results = await searchIndex.search(query, { top: 10 });
      rSpan.setAttribute("doc_count", results.length);
      rSpan.setAttribute("search_score_top", results[0]?.score ?? 0);
      rSpan.end();
      return results;
    });
    const answer = await tracer.startActiveSpan("llm_generate", async (gSpan) => {
      const resp = await openai.chat.completions.create({ model: "gpt-4o", messages: buildPrompt(query, docs) });
      gSpan.setAttribute("model", "gpt-4o");
      gSpan.setAttribute("prompt_tokens", resp.usage?.prompt_tokens ?? 0);
      gSpan.setAttribute("completion_tokens", resp.usage?.completion_tokens ?? 0);
      gSpan.end();
      return resp.choices[0].message.content;
    });
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
    return answer;
  });
}
```

## KQL Dashboard Queries

```kql
// Latency percentiles by model — last 24h
customMetrics
| where name == "llm_latency_ms" and timestamp > ago(24h)
| extend model = tostring(customDimensions.model)
| summarize p50=percentile(value, 50), p95=percentile(value, 95), p99=percentile(value, 99), count=count() by model, bin(timestamp, 1h)
| order by timestamp desc

// Token cost per endpoint — daily rollup
customMetrics
| where name == "token_usage" and timestamp > ago(7d)
| extend model = tostring(customDimensions.model), token_type = tostring(customDimensions.type)
| summarize total_tokens = sum(value) by model, token_type, bin(timestamp, 1d)
| order by timestamp desc, model asc

// Error budget burn rate — 30-day rolling
let slo_target = 0.995;
requests
| where timestamp > ago(30d)
| summarize total = count(), failed = countif(success == false) by bin(timestamp, 1d)
| extend error_rate = todouble(failed) / total, budget_remaining = slo_target - (1.0 - todouble(failed) / total)
| project timestamp, error_rate, budget_remaining

// Groundedness score trend — detect quality regressions
customMetrics
| where name == "groundedness_score" and timestamp > ago(7d)
| extend model = tostring(customDimensions.model)
| summarize avg_score = avg(value), min_score = min(value), samples = count() by model, bin(timestamp, 1h)
| where avg_score < 3.5
| order by timestamp desc

// Cache effectiveness — hit rate over time
customMetrics
| where name in ("cache_hit", "cache_miss") and timestamp > ago(24h)
| summarize hits = countif(name == "cache_hit"), misses = countif(name == "cache_miss") by bin(timestamp, 1h)
| extend hit_rate = todouble(hits) / (hits + misses) * 100
```

## SLI / SLO / Error Budgets

| SLI | Target SLO | Measurement | Error Budget (30d) |
| --- | --- | --- | --- |
| Availability (non-5xx) | 99.5% | `requests` where `success==true` | 3.6h downtime |
| Latency p95 < 3s | 95% | `customMetrics` `llm_latency_ms` p95 | 36h of breach |
| Groundedness ≥ 4.0 | 90% | `customMetrics` `groundedness_score` | 72h below threshold |
| Cache hit rate ≥ 30% | 80% | `cache_hit / (hit + miss)` | 144h below target |

Burn rate alerts: page on-call if error budget burns >2% in 1h (fast burn) or >5% in 6h (slow burn).

## Alert Rules

```json
// Metric alert — latency spike (Azure Monitor)
{ "severity": 2, "criteria": { "metricName": "llm_latency_ms", "operator": "GreaterThan", "threshold": 5000, "timeAggregation": "Average", "windowSize": "PT5M" }, "action": "notify-oncall-slack" }

// Log alert — error rate spike
{ "severity": 1, "query": "requests | where timestamp > ago(5m) | summarize error_pct = 100.0 * countif(resultCode >= 500) / count() | where error_pct > 5", "frequency": "PT5M", "action": "page-oncall" }

// Budget alert — daily token spend exceeds forecast
{ "severity": 3, "query": "customMetrics | where name == 'token_usage' and timestamp > ago(1d) | summarize daily_tokens = sum(value) | where daily_tokens > 1000000", "frequency": "PT1H", "action": "notify-finops-channel" }
```

## Health Check Endpoint

```python
# /health — dependency-aware health probe
@app.get("/health")
async def health():
    checks = {
        "openai": await probe_openai(),       # completion w/ max_tokens=1
        "search_index": await probe_search(),  # empty query, expect 200
        "redis": await probe_redis(),          # PING
        "cosmos": await probe_cosmos(),        # read container metadata
    }
    status = "healthy" if all(c["ok"] for c in checks.values()) else "degraded"
    code = 200 if status == "healthy" else 503
    return JSONResponse({"status": status, "checks": checks, "timestamp": datetime.utcnow().isoformat()}, status_code=code)
```

## AI-Specific Telemetry

Track on EVERY completion call — not sampled, not optional:

- **Model version**: `gpt-4o-2024-08-06` not just `gpt-4o` — detect regressions on model updates
- **Groundedness score**: 0-5 from evaluation pipeline, alert on avg < 4.0 per hour
- **Retrieval quality**: MRR, NDCG@10, number of retrieved docs, search score of top result
- **Content filter triggers**: category + severity — trend for prompt injection attempts
- **Token efficiency**: `completion_tokens / prompt_tokens` ratio — detect prompt bloat

## Cost Monitoring

```kql
// Monthly cost projection by model
customMetrics
| where name == "token_usage" and timestamp > ago(30d)
| extend model = tostring(customDimensions.model), token_type = tostring(customDimensions.type)
| summarize tokens = sum(value) by model, token_type
| extend cost_per_1k = case(
    model == "gpt-4o" and token_type == "prompt", 0.0025,
    model == "gpt-4o" and token_type == "completion", 0.01,
    model == "gpt-4o-mini" and token_type == "prompt", 0.00015,
    model == "gpt-4o-mini" and token_type == "completion", 0.0006,
    0.001)
| extend estimated_cost = tokens / 1000.0 * cost_per_1k
| summarize total_cost = sum(estimated_cost) by model
```

## Anti-Patterns

- ❌ Logging full user prompts or completions — PII risk, storage cost explosion
- ❌ Sampling AI telemetry — miss quality regressions between samples
- ❌ Alert on raw error count instead of error rate — false positives during traffic spikes
- ❌ Single "is it up?" health check without dependency probing
- ❌ Tracking model as `gpt-4o` without version suffix — invisible model update regressions
- ❌ No correlation ID propagation — impossible to trace request across services
- ❌ Storing metrics in application logs instead of proper metric pipelines — bad for aggregation, expensive queries
- ❌ Setting SLOs without measuring — SLO must have a dashboard, alert, and runbook or it doesn't exist

## WAF Alignment

| Pillar | Monitoring Practice |
|--------|-------------------|
| **Reliability** | Health checks with dependency probing, SLI/SLO with error budgets, burn-rate alerts |
| **Security** | PII redaction before logging, audit trail for content filter triggers, no secrets in telemetry |
| **Cost Optimization** | Token usage per model/endpoint, daily cost projection KQL, budget alerts at 80%/100% |
| **Operational Excellence** | Structured JSON logging, OpenTelemetry distributed tracing, Azure Monitor workbooks |
| **Performance Efficiency** | Latency histograms (p50/p95/p99), cache hit rate tracking, concurrency pressure gauges |
| **Responsible AI** | Groundedness score trending, content filter trigger rates, model version tracking for bias audits |
