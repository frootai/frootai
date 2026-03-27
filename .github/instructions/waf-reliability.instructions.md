---
applyTo: "**/*.{ts,js,py,bicep,json,yaml,yml}"
---
# Reliability — Azure Well-Architected Framework

When implementing or reviewing code, enforce these reliability principles:

## Retry & Circuit Breaker
- All external API calls MUST have retry logic with exponential backoff
- Use circuit breaker pattern for downstream dependencies
- Default: 3 retries, 1s/2s/4s backoff with jitter

## Health Checks
- Every service MUST expose a `/health` endpoint
- Health checks MUST verify downstream dependencies (DB, AI endpoints, search)
- Return 200 with `{"status":"healthy"}` or 503 with degraded component list

## Graceful Degradation
- If Azure OpenAI is unavailable, fall back to cached responses or static content
- If Azure AI Search is down, degrade to keyword search or return top-N cached results
- Never return a 500 to the user — always return a meaningful fallback

## Data Resilience
- Enable soft-delete on all storage accounts and Cosmos DB
- Configure geo-redundant storage (GRS) for production
- Implement idempotent operations for all write paths

## Timeouts
- HTTP client timeouts: 30s for AI endpoints, 10s for search, 5s for metadata
- Queue message visibility timeout: 5 minutes minimum
- Function execution timeout: match to expected AI response time + buffer
