---
name: deploy-ai-observability
description: "Deploy AI Observability — configure Application Insights, Log Analytics, KQL dashboards, distributed tracing, token/cost metrics, alert rules for AI workloads. Use when: deploy, configure monitoring."
---

# Deploy AI Observability

## When to Use
- Set up Application Insights for AI workload monitoring
- Configure distributed tracing across AI pipeline stages
- Create KQL dashboards for token usage, latency, quality metrics
- Set up alert rules for anomalies, cost spikes, quality drops
- Configure custom metrics for AI-specific telemetry

## Prerequisites
1. Azure CLI authenticated: `az account show`
2. Bicep CLI: `az bicep version`
3. Existing AI workload to monitor (any Play 01-100)
4. Log Analytics workspace (or create new)
5. Azure Monitor access for alert configuration

## Step 1: Deploy Monitoring Infrastructure
```bash
az bicep lint -f infra/main.bicep
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
```
Resources:
- Application Insights (workspace-based)
- Log Analytics Workspace (90-day retention)
- Azure Monitor Action Groups (email, Teams, PagerDuty)
- Azure Dashboard (shared workbook)

## Step 2: Instrument AI Application
```python
# OpenTelemetry + Azure Monitor exporter
from azure.monitor.opentelemetry import configure_azure_monitor
configure_azure_monitor(connection_string=os.environ["APPLICATIONINSIGHTS_CONNECTION_STRING"])

# Custom AI metrics
from opentelemetry import metrics
meter = metrics.get_meter("ai-workload")
token_counter = meter.create_counter("ai.tokens.total", description="Total tokens consumed")
latency_hist = meter.create_histogram("ai.latency.ms", description="AI call latency")
quality_gauge = meter.create_up_down_counter("ai.quality.score", description="Quality score")
```

## Step 3: Configure AI-Specific Telemetry
| Metric | Type | What to Track |
|--------|------|-------------|
| `ai.tokens.input` | Counter | Input tokens per request |
| `ai.tokens.output` | Counter | Output tokens per request |
| `ai.tokens.cost` | Counter | Dollar cost per request |
| `ai.latency.ttft` | Histogram | Time to first token |
| `ai.latency.total` | Histogram | Total request latency |
| `ai.quality.groundedness` | Gauge | Groundedness score |
| `ai.quality.relevance` | Gauge | Relevance score |
| `ai.safety.blocked` | Counter | Content safety blocks |
| `ai.cache.hit` | Counter | Semantic cache hits |
| `ai.error.rate` | Counter | Failed AI calls |

## Step 4: Create KQL Dashboards
```kql
// Token usage by model (last 24h)
customMetrics
| where name startswith "ai.tokens"
| summarize total=sum(value) by model=tostring(customDimensions.model), bin(timestamp, 1h)
| render timechart

// Latency percentiles
customMetrics
| where name == "ai.latency.total"
| summarize p50=percentile(value, 50), p95=percentile(value, 95), p99=percentile(value, 99)
  by bin(timestamp, 1h)
| render timechart

// Cost per tenant
customMetrics
| where name == "ai.tokens.cost"
| summarize cost=sum(value) by tenant=tostring(customDimensions.tenant)
| top 10 by cost desc
```

## Step 5: Configure Alert Rules
| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| High latency | p95 > 5s for 5 min | Warning (Sev 2) | Email + Teams |
| Error spike | Error rate > 5% for 10 min | Critical (Sev 1) | PagerDuty |
| Cost spike | Daily cost > 2× baseline | Warning (Sev 2) | Email |
| Quality drop | Groundedness < 0.7 for 1 hour | Critical (Sev 1) | PagerDuty |
| Safety block spike | Blocks > 10% for 15 min | Warning (Sev 2) | Teams |
| Token budget exceeded | Monthly tokens > budget | Info (Sev 3) | Email |

## Step 6: Configure Distributed Tracing
```python
# Trace AI pipeline stages
with tracer.start_as_current_span("ai-pipeline") as span:
    span.set_attribute("ai.model", "gpt-4o")
    span.set_attribute("ai.play", "01-enterprise-rag")
    
    with tracer.start_as_current_span("retrieval"):
        # Search + retrieve context
    
    with tracer.start_as_current_span("generation"):
        # LLM call
    
    with tracer.start_as_current_span("safety-check"):
        # Content safety validation
```

## Post-Deployment Verification
- [ ] Application Insights receiving telemetry
- [ ] Custom AI metrics appearing in Metrics Explorer
- [ ] KQL dashboards rendering with live data
- [ ] Alert rules configured and test-fired
- [ ] Distributed traces showing full pipeline
- [ ] No PII in logs (verify with sample data)
- [ ] Retention configured per compliance requirements

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| No telemetry appearing | Missing connection string | Set `APPLICATIONINSIGHTS_CONNECTION_STRING` env var |
| Custom metrics not showing | Wrong meter name | Verify meter name matches KQL query |
| Alerts not firing | Threshold too high | Lower threshold, verify action group |
| Traces incomplete | Missing span context propagation | Use W3C trace context headers |
| PII in logs | Unfiltered user input | Add telemetry processor to scrub PII |
| High Log Analytics cost | Verbose log level | Set to Warning in production |
