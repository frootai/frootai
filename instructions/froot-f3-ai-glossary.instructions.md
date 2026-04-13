---
description: "AI glossary consistency — use standard FAI terminology, avoid ambiguous AI terms in code comments."
applyTo: "**"
waf:
  - "operational-excellence"
---

# Froot F3 Ai Glossary — WAF-Aligned Coding Standards

> AI glossary consistency — use standard FAI terminology, avoid ambiguous AI terms in code comments.

## Core Rules

- Follow the principle of least privilege for all operations and access controls
- Use configuration files (`config/*.json`) for all tunable parameters — never hardcode values
- Implement structured JSON logging with correlation IDs via Application Insights
- Error handling with retry and exponential backoff (base=1s, max=30s, 3 retries) for external calls
- Health check endpoints at `/health` for load balancer integration and instance rotation
- Input validation and sanitization at all system boundaries — reject invalid before processing
- PII detection and redaction before logging, analytics storage, or telemetry
- `DefaultAzureCredential` for all Azure service authentication — no API keys in production
- Content Safety API integration for all user-facing AI outputs

## Implementation Patterns

### Config-Driven Development
- Read ALL parameters from `config/*.json` — temperature, thresholds, endpoints, model names
- Environment-specific configuration via parameter files or environment variables
- Validate configuration at startup — fail fast on missing required values
- Feature flags for gradual rollout and A/B testing

### Azure SDK Integration
```typescript
// Pattern: Managed Identity + config-driven + error handling
import { DefaultAzureCredential } from "@azure/identity";
const credential = new DefaultAzureCredential();
const config = JSON.parse(fs.readFileSync("config/openai.json", "utf8"));

async function callService(operation: string) {
  const correlationId = crypto.randomUUID();
  try {
    const result = await client.operation({ ...config, correlationId });
    telemetry.trackEvent({ name: operation, properties: { correlationId, duration: elapsed } });
    return result;
  } catch (error) {
    telemetry.trackException({ exception: error, properties: { correlationId, operation } });
    if (error.statusCode === 429) await backoff(attempt); // Retry-After
    throw error;
  }
}
```

### Resilience Patterns
- Retry with exponential backoff: `delay = min(baseDelay * 2^attempt + jitter, maxDelay)`
- Circuit breaker: open after 50% failure rate in 30s window, half-open after cooldown
- Connection pooling for database and HTTP clients (max connections from config)
- Graceful shutdown on SIGTERM — drain in-flight requests, close connections, flush telemetry

### Performance Patterns
- Streaming responses (SSE/WebSocket) for real-time user experience
- Async/parallel processing for independent operations (`Promise.all` / `asyncio.gather`)
- Cache with TTL from configuration (Redis or in-memory)
- Batch operations for bulk processing (embeddings: max 16/call, classification: batch)

## Code Quality Standards

- TypeScript with `strict: true` in tsconfig OR Python with type hints on all functions
- No `any` types in TypeScript — define proper interfaces, type guards, discriminated unions
- Structured JSON logging only — never `console.log` in production code
- Every `async` operation wrapped in try/catch with actionable, context-rich error messages
- No commented-out code — use feature flags or remove. No TODO without linked issue number
- Functions ≤ 50 lines, files ≤ 300 lines — extract when growing beyond limits
- Consistent naming: camelCase (TypeScript), snake_case (Python), kebab-case (files/folders)
- JSDoc/docstrings on all public functions with parameter descriptions and return types

## Testing Requirements

- Unit tests for business logic (80%+ coverage target, measured in CI)
- Integration tests for Azure SDK interactions (mock with nock/responses/WireMock)
- End-to-end tests for critical user journeys (Playwright/Cypress)
- Mutation testing for critical paths (Stryker for TS, mutmut for Python)
- No flaky tests — fix root cause or quarantine with tracking issue
- Evaluation pipeline (`eval.py`) passes all quality thresholds before production

## Security Checklist

- [ ] `DefaultAzureCredential` for all Azure service authentication
- [ ] Secrets stored exclusively in Azure Key Vault
- [ ] Private endpoints for data-plane operations in production
- [ ] Content Safety API for all user-facing LLM outputs
- [ ] Input validation and sanitization (prompt injection defense)
- [ ] PII detection and redaction before logging
- [ ] CORS with explicit origin allowlist (never `*` in production)
- [ ] TLS 1.2+ enforced on all connections
- [ ] Dependency audit (`npm audit` / `pip audit`) in CI pipeline
- [ ] Rate limiting per user/IP (60 req/min default)

## Anti-Patterns

- ❌ Hardcoding API keys, connection strings, or secrets in source code
- ❌ Using `console.log` instead of structured Application Insights logging
- ❌ Missing error handling on async operations (unhandled promise rejections)
- ❌ Public endpoints in production without authentication and authorization
- ❌ Unbounded queries without pagination or result limits
- ❌ Not implementing health check endpoint (load balancer can't detect unhealthy)
- ❌ Logging PII, full user prompts, or secret values — even in debug mode
- ❌ Using `temperature > 0.5` in production without documented justification
- ❌ Deploying without Content Safety enabled for user-facing endpoints

## WAF Alignment

### Security
- DefaultAzureCredential for all auth — zero API keys in code
- Key Vault for secrets, certificates, encryption keys
- Private endpoints for data-plane in production
- Content Safety API, PII detection + redaction, input validation

### Reliability
- Retry with exponential backoff (3 retries, 1-30s jitter)
- Circuit breaker (50% failure → open 30s)
- Health check at /health with dependency status
- Graceful degradation, connection pooling, SIGTERM handling

### Cost Optimization
- max_tokens from config — never unlimited
- Model routing (gpt-4o-mini for classification, gpt-4o for reasoning)
- Semantic caching with Redis (TTL from config)
- Right-sized SKUs, FinOps telemetry (token usage per request)

### Operational Excellence
- Structured JSON logging with Application Insights + correlation IDs
- Custom metrics: latency p50/p95/p99, token usage, quality scores
- Automated Bicep deployment via GitHub Actions (staging → prod)
- Feature flags for gradual rollout, incident runbooks
