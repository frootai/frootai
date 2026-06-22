---
description: "Play 17 patterns — AI observability patterns — OpenTelemetry spans, token metrics, quality dashboards, alert thresholds."
applyTo: "**/*.py, **/*.ts, **/*.bicep"
waf:
  - "reliability"
  - "security"
---

# Play 17 — AI Observability Patterns — FAI Standards

## OpenTelemetry Instrumentation for LLM Calls

Every LLM call emits a span with model name, token counts, latency, and status. Use semantic conventions for GenAI spans.

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from azure.monitor.opentelemetry.exporter import AzureMonitorTraceExporter

exporter = AzureMonitorTraceExporter(connection_string=os.environ["APPLICATIONINSIGHTS_CONNECTION_STRING"])
provider = TracerProvider()
provider.add_span_processor(BatchSpanProcessor(exporter))
trace.set_tracer_provider(provider)
tracer = trace.get_tracer("ai.observability")

async def traced_llm_call(prompt: str, model: str, config: dict) -> dict:
    correlation_id = uuid4().hex
    with tracer.start_as_current_span("llm.chat.completion") as span:
        span.set_attribute("gen_ai.system", "az.ai.openai")
        span.set_attribute("gen_ai.request.model", model)
        span.set_attribute("gen_ai.request.max_tokens", config["max_tokens"])
        span.set_attribute("gen_ai.request.temperature", config["temperature"])
        span.set_attribute("correlation_id", correlation_id)
        start = time.perf_counter()
        response = await client.chat.completions.create(model=model, messages=[{"role": "user", "content": prompt}])
        latency_ms = (time.perf_counter() - start) * 1000
        span.set_attribute("gen_ai.response.model", response.model)
        span.set_attribute("gen_ai.usage.prompt_tokens", response.usage.prompt_tokens)
        span.set_attribute("gen_ai.usage.completion_tokens", response.usage.completion_tokens)
        span.set_attribute("latency_ms", latency_ms)
        span.set_attribute("tenant_id", config.get("tenant_id", "default"))
        return {"content": response.choices[0].message.content, "correlation_id": correlation_id}
```

## Custom Metrics — Token Usage, Cache Hits, Quality Scores

```python
from opentelemetry import metrics

meter = metrics.get_meter("ai.metrics")
token_counter = meter.create_counter("ai.tokens.total", description="Total tokens consumed", unit="tokens")
cache_hit_rate = meter.create_histogram("ai.cache.hit_rate", description="Semantic cache hit ratio")
groundedness_score = meter.create_histogram("ai.quality.groundedness", description="Groundedness score 0-5")
latency_hist = meter.create_histogram("ai.latency_ms", description="LLM call latency", unit="ms")
error_counter = meter.create_counter("ai.errors.total", description="LLM call errors")

def record_llm_metrics(response, latency_ms: float, endpoint: str, tenant: str):
    labels = {"endpoint": endpoint, "model": response.model, "tenant": tenant}
    token_counter.add(response.usage.total_tokens, labels)
    latency_hist.record(latency_ms, labels)

def record_cache_hit(hit: bool, endpoint: str):
    cache_hit_rate.record(1.0 if hit else 0.0, {"endpoint": endpoint})

def record_quality(groundedness: float, relevance: float, correlation_id: str):
    groundedness_score.record(groundedness, {"correlation_id": correlation_id})
```

## Distributed Tracing Across RAG Pipeline

Propagate trace context through retrieval → reranking → generation → evaluation. Each stage is a child span with its own metrics.

```python
async def rag_pipeline(query: str, config: dict) -> dict:
    with tracer.start_as_current_span("rag.pipeline") as parent:
        parent.set_attribute("query_length", len(query))

        with tracer.start_as_current_span("rag.retrieve"):
            docs = await search_client.search(query, top=config["retrieval_top_k"])
            trace.get_current_span().set_attribute("docs_retrieved", len(docs))

        with tracer.start_as_current_span("rag.rerank"):
            ranked = rerank(docs, query)
            trace.get_current_span().set_attribute("docs_after_rerank", len(ranked))

        with tracer.start_as_current_span("rag.generate"):
            result = await traced_llm_call(build_prompt(query, ranked), config["model"], config)

        with tracer.start_as_current_span("rag.evaluate"):
            scores = evaluate_groundedness(result["content"], ranked)
            record_quality(scores["groundedness"], scores["relevance"], result["correlation_id"])
            parent.set_attribute("groundedness", scores["groundedness"])

        return result
```

## KQL Queries for AI Dashboards

### Token Usage by Model and Tenant
```kql
customMetrics
| where name == "ai.tokens.total"
| extend model = tostring(customDimensions.model), tenant = tostring(customDimensions.tenant)
| summarize TotalTokens=sum(value), RequestCount=count() by model, tenant, bin(timestamp, 1h)
| order by TotalTokens desc
```

### Latency Percentiles (P50/P95/P99)
```kql
customMetrics
| where name == "ai.latency_ms"
| extend endpoint = tostring(customDimensions.endpoint)
| summarize P50=percentile(value, 50), P95=percentile(value, 95), P99=percentile(value, 99)
    by endpoint, bin(timestamp, 15m)
| where P99 > 3000
```

### Cache Hit Rate by Endpoint
```kql
customMetrics
| where name == "ai.cache.hit_rate"
| extend endpoint = tostring(customDimensions.endpoint)
| summarize HitRate=avg(value) by endpoint, bin(timestamp, 1h)
| render timechart
```

### Model Performance Drift — Groundedness Over Time
```kql
customMetrics
| where name == "ai.quality.groundedness"
| summarize AvgScore=avg(value), P10=percentile(value, 10), SampleCount=count() by bin(timestamp, 1d)
| where AvgScore < 4.0 or P10 < 3.0
```

### Cost Tracking Per Tenant
```kql
customMetrics
| where name == "ai.tokens.total"
| extend model = tostring(customDimensions.model), tenant = tostring(customDimensions.tenant)
| extend cost_per_1k = case(model startswith "gpt-4o-mini", 0.00015, model startswith "gpt-4o", 0.0025, 0.001)
| summarize EstimatedCost=sum(value / 1000 * cost_per_1k) by tenant, model, bin(timestamp, 1d)
| order by EstimatedCost desc
```

## Alert Rules

| Alert | Condition | Severity | Window |
| --- | --- | --- | --- |
| High latency | P99 > 3000ms | Sev2 | 15 min |
| Error spike | Error rate > 5% | Sev1 | 5 min |
| Token budget breach | Daily tokens > 80% of budget | Sev3 | 1 hour |
| Groundedness drift | Avg score < 4.0 | Sev2 | 1 day |
| Cache miss surge | Hit rate < 30% for 30 min | Sev3 | 30 min |
| Model timeout | > 10 timeouts in 5 min window | Sev1 | 5 min |

## SLI/SLO Definitions for AI Services

| SLI | Target SLO | Measurement |
| --- | --- | --- |
| Availability | 99.9% | Successful responses / total requests |
| Latency P99 | < 3s | OpenTelemetry histogram `ai.latency_ms` |
| Groundedness | > 4.0 avg | Evaluation pipeline `ai.quality.groundedness` |
| Token budget | < 80% daily cap | `ai.tokens.total` aggregated daily per tenant |
| Error rate | < 1% | `ai.errors.total` / total request count |

## Azure Monitor Workbooks

- **Overview Pane**: Request volume, latency heatmap, error rate trend, active tenants
- **Model Pane**: Token usage by model, cost breakdown, PTU utilization, throttle events
- **Quality Pane**: Groundedness/relevance scores over time, drift alerts, evaluation pass rate
- **Cost Pane**: Per-tenant spend, model cost comparison, projected monthly cost
- **Incident Pane**: Correlated traces for failed requests, error classification, MTTR tracking

## Log Correlation and Incident Response

- Every request gets a `correlation_id` propagated through all spans and log entries
- Structured logs use `{"correlation_id": "...", "tenant_id": "...", "model": "...", "stage": "..."}`
- Incident runbook: alert fires → KQL drill-down by correlation_id → identify failing stage → check dependent service health → escalate with full trace link
- PII redaction BEFORE logging — never log raw user prompts or model outputs in production

## Anti-Patterns

- ❌ Logging raw prompts/completions — leaks PII, inflates storage costs
- ❌ Single monolithic span for entire RAG pipeline — no visibility into bottleneck stages
- ❌ Sampling at 100% in production — use adaptive sampling (1/N for high-volume endpoints)
- ❌ Alerting on averages instead of percentiles — P99 catches tail latency, averages hide it
- ❌ Hardcoded token budgets — use config-driven thresholds per tenant from `config/observability.json`
- ❌ Missing tenant attribution on metrics — impossible to do per-customer cost allocation
- ❌ Polling Application Insights instead of push-based alerts — adds latency to incident detection
- ❌ No baseline metrics before production — can't detect drift without a known-good reference

## WAF Alignment

| Pillar | Observability Requirement |
|--------|--------------------------|
| **Reliability** | Health probes on `/health`, circuit breaker metrics, retry counters, SLO burn-rate alerts |
| **Security** | PII redaction pre-logging, audit trail for model access, no secrets in telemetry attributes |
| **Cost Optimization** | Per-tenant token tracking, model cost attribution, budget alerts at 80%, adaptive sampling |
| **Operational Excellence** | Structured JSON logs, correlation IDs end-to-end, runbooks linked to alerts, Workbook dashboards |
| **Performance Efficiency** | Latency histograms per pipeline stage, cache hit tracking, async span export via `BatchSpanProcessor` |
| **Responsible AI** | Groundedness/relevance scoring in traces, quality drift detection, evaluation pass-rate SLI |

### Operational Excellence
- Structured JSON logging with Application Insights + correlation IDs
- Custom metrics: latency p50/p95/p99, token usage, quality scores
- Automated Bicep deployment via GitHub Actions (staging → prod)
- Feature flags for gradual rollout, incident runbooks
