---
description: "Azure Front Door & WAF standards — global load balancing, WAF rules, caching, SSL offloading, origin protection."
applyTo: "**/*.py, **/*.ts, **/*.js, **/*.cs, **/*.bicep"
waf:
  - "security"
  - "reliability"
  - "cost-optimization"
  - "operational-excellence"
  - "performance-efficiency"
---

# Azure Front Door & — FAI Standards

## Service Overview

Azure Front Door & WAF provides global load balancing, WAF rules, caching, SSL offloading, origin protection. Available tiers/modes: Front Door Premium, WAF policies, CDN, Private Link origins.

## Authentication & Security

- Use `DefaultAzureCredential` for all service authentication — never API keys in production
- Store connection strings and secrets in Azure Key Vault, reference via environment variables
- Enable private endpoints for data-plane operations in production environments
- Configure diagnostic settings → central Log Analytics workspace for audit and troubleshooting
- Apply Azure Policy for governance: mandatory private endpoints, mandatory managed identity, allowed SKUs
- Enable TLS 1.2+ for all connections

## SDK Integration Patterns

```typescript
// Pattern: Config-driven client initialization with Managed Identity
import { DefaultAzureCredential } from "@azure/identity";

const credential = new DefaultAzureCredential();
const config = JSON.parse(fs.readFileSync("config/openai.json", "utf8"));

// Always load endpoints and settings from config — never hardcode
const client = new ServiceClient(config.endpoint, credential, {
  retryOptions: { maxRetries: 3, retryDelayInMs: 1000, maxRetryDelayInMs: 30000 }
});
```

## Error Handling

- Wrap all SDK calls in try/catch with structured error logging (Application Insights)
- Handle HTTP 429 (rate limited): respect Retry-After header, exponential backoff
- Handle HTTP 409 (conflict): implement conflict resolution strategy appropriate to service
- Handle HTTP 5xx (server error): retry with backoff, circuit breaker after 3 consecutive failures
- Log: operation name, duration, status code, correlation ID — never log secrets or PII

## Configuration Management

- All service parameters in `config/*.json` files — never hardcoded
- Environment-specific configurations via parameter files or environment variables
- Validate all configuration at startup — fail fast on missing required values
- Use feature flags for gradual service migration or A/B testing

## Key Patterns: OWASP CRS 3.2, custom rules, rate limiting, geo-filtering, bot protection

### Pattern 1: Resilient Connection
- Connection pooling with explicit limits (max connections from config)
- Health check endpoint that verifies service connectivity
- Graceful degradation when service unavailable (cached fallback, default response)

### Pattern 2: Cost-Aware Usage
- Monitor usage metrics (RU/s, transactions, storage) with Application Insights custom metrics
- Set alerts on cost anomalies (>120% of baseline)
- Right-size tier based on actual usage patterns (review monthly)
- Use serverless/consumption tier for dev, provisioned for production

### Pattern 3: Observable Operations
- Structured JSON logging with correlation IDs for distributed tracing
- Custom Application Insights metrics: latency p50/p95/p99, error rate, throughput
- Dashboards in Azure Workbooks or Grafana for operational visibility
- Alert rules: latency p95 > SLO, error rate > 1%, availability < 99.9%

## Monitoring & Alerting

- Enable diagnostic settings on the resource → Log Analytics workspace
- Configure metric alerts: latency, error rate, capacity utilization
- Create Azure Workbook dashboard for operational visibility
- Set up action groups: email + Teams/Slack webhook for P1 alerts
- Review Azure Advisor recommendations monthly

## Anti-Patterns

- ❌ Hardcoding connection strings or API keys in source code
- ❌ Not implementing retry logic on transient failures
- ❌ Missing health check endpoint for load balancer integration
- ❌ Public endpoints in production without VNet integration
- ❌ Not monitoring service-specific metrics (RU/s, queue depth, cache hit ratio)
- ❌ Using development/Basic SKU in production (SLA, performance, feature limitations)
- ❌ Not tagging resources (environment, project, play, managed-by)

## WAF Alignment

### Security
- DefaultAzureCredential, Key Vault for secrets, private endpoints, TLS 1.2+, diagnostic logs

### Reliability
- Retry with exponential backoff, circuit breaker, health checks, geo-redundancy where available

### Cost Optimization
- Right-size SKU, serverless for dev, reserved capacity for stable prod, usage monitoring

### Performance Efficiency
- Connection pooling, caching, async operations, batch processing where supported

### Operational Excellence
- Diagnostic settings, structured logging, KQL dashboards, alerts, Infrastructure as Code
