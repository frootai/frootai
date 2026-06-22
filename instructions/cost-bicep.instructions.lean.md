---
description: "Cost Bicep standards — Bicep cost optimization — consumption SKUs, auto-shutdown, tags for cost centers, budget resources."
applyTo: "**/*.bicep"
waf:
  - "security"
  - "reliability"
  - "cost-optimization"
  - "operational-excellence"
---

# Cost Bicep — FAI Standards

## Core Rules

- Follow the principle of least privilege for all operations
- Use configuration files for all tunable parameters — never hardcode
- Implement structured JSON logging with correlation IDs
- Error handling with retry and exponential backoff for external calls
- Health check endpoints for load balancer integration
- Input validation and sanitization at all system boundaries
- PII detection and redaction before logging or analytics storage
- DefaultAzureCredential for all Azure service authentication

## Implementation Patterns

- Config-driven: all parameters from `config/*.json`
- Retry with exponential backoff: base=1s, max=30s, maxRetries=3
- Connection pooling for database and HTTP clients
- Async/parallel processing for independent operations
- Streaming responses (SSE) for real-time UX
- Batch operations for bulk processing
- Cache with TTL from configuration
- Graceful shutdown on SIGTERM

## Code Quality

- TypeScript strict mode or Python type hints everywhere
- No `any` types — proper interfaces and type guards
- Structured JSON logging — never console.log
- Try/catch on every async operation
- Functions ≤ 50 lines, files ≤ 300 lines
- kebab-case files, camelCase TS, snake_case Python
- JSDoc/docstrings on all public functions

## Testing

- Unit tests for business logic (80%+ coverage)
- Integration tests for SDK interactions
- E2E tests for critical user journeys
- Mutation testing for critical paths
- No flaky tests — fix or quarantine

## Security Checklist

- [ ] DefaultAzureCredential for all Azure auth
- [ ] Secrets in Key Vault only
- [ ] Private endpoints for production
- [ ] Content Safety for user-facing outputs
- [ ] Input validation and sanitization
- [ ] PII detection and redaction
- [ ] CORS explicit allowlist
- [ ] TLS 1.2+ enforced
- [ ] Dependency audit in CI

## Anti-Patterns

- ❌ Hardcoded API keys or connection strings
- ❌ console.log instead of structured logging
- ❌ Missing error handling on async operations
- ❌ Public endpoints in production without auth
- ❌ Unbounded queries without pagination
- ❌ Not implementing health check endpoint
- ❌ Logging PII or secrets

## WAF Alignment

### Security
- Managed Identity, Key Vault, private endpoints, Content Safety

### Reliability
- Retry with backoff, circuit breaker, health checks, graceful degradation

### Cost Optimization
- Right-sized resources, caching, batch operations, token budgets

### Operational Excellence
- Structured logging, App Insights, CI/CD, feature flags, alerts
