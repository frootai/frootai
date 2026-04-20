---
sidebar_position: 4
title: Well-Architected Framework
description: FrootAI aligns every primitive to the 6 WAF pillars — Reliability, Security, Cost Optimization, Operational Excellence, Performance Efficiency, and Responsible AI.
---

# Well-Architected Framework

FrootAI aligns every primitive, play, and protocol element to the **6 pillars** of the Azure Well-Architected Framework (WAF). This isn't optional — WAF alignment is enforced at the protocol level via `fai-manifest.json`.

## The 6 Pillars

| Pillar | Key Principles | Example Enforcement |
|--------|---------------|---------------------|
| 🛡️ **Security** | Identity, network, data protection, AI-specific security | Managed Identity, Key Vault, content safety filters |
| 🔄 **Reliability** | Retry, circuit breaker, health checks, graceful degradation | Exponential backoff, `/health` endpoints, cached fallbacks |
| 💰 **Cost Optimization** | Model routing, token budgets, right-sizing, FinOps | GPT-4o-mini triage, `costPerQuery` guardrails |
| ⚙️ **Operational Excellence** | CI/CD, observability, IaC, incident management | Structured logging, App Insights, Bicep templates |
| ⚡ **Performance Efficiency** | Caching, streaming, async patterns, bundle optimization | Response caching, SSE streaming, CDN for static assets |
| 🤖 **Responsible AI** | Content safety, groundedness, fairness, transparency | Azure AI Content Safety, groundedness ≥ 0.95, source citations |

## Security

Every FrootAI solution enforces:

- **Never hardcode secrets** — use Azure Managed Identity and Key Vault
- **RBAC with least-privilege** — Microsoft Entra ID for user authentication
- **Private endpoints** for all PaaS services in production
- **Content safety filters** on all AI endpoints
- **Rate limiting** AI API calls per user/tenant
- **Input sanitization** — validate and sanitize all prompts before sending to models

```json title="fai-manifest.json — Security WAF"
{
  "context": {
    "waf": ["security"]
  }
}
```

## Reliability

- All external API calls **must** have retry logic with exponential backoff (3 retries: 1s/2s/4s with jitter)
- Every service **must** expose a `/health` endpoint verifying downstream dependencies
- If Azure OpenAI is unavailable, fall back to cached responses or static content
- HTTP client timeouts: 30s for AI endpoints, 10s for search, 5s for metadata

```json title="config/guardrails.json — Reliability thresholds"
{
  "thresholds": {
    "coherence": 0.90,
    "groundedness": 0.95
  }
}
```

## Cost Optimization

- Use **model routing**: GPT-4o-mini for simple tasks, GPT-4o for complex reasoning
- Implement **token budgets** per request via `max_tokens` in config
- Cache frequent AI responses with TTL-based semantic deduplication
- Set `costPerQuery` guardrails in `fai-manifest.json`
- Default to the smallest viable SKU — scale up based on metrics, not assumptions

```json title="config/openai.json — Cost controls"
{
  "model": "gpt-4o",
  "max_tokens": 4096,
  "fallback_model": "gpt-4o-mini"
}
```

:::tip
Use the FrootAI [Cost Estimator](https://frootai.dev/configurator) to calculate monthly Azure costs for any solution play at dev or production scale.
:::

## Operational Excellence

- All deployments **must** go through CI/CD pipelines — no manual deployments
- Use **conventional commits** (`feat:`, `fix:`, `docs:`, `chore:`)
- All infrastructure **must** be defined in Bicep/Terraform — no portal clicks
- Structured logging with correlation IDs across all services
- Application Insights for APM, distributed tracing, and custom AI metrics

```bash
# Validate consistency before every release
npm run validate:primitives
node engine/index.js fai-manifest.json --status
```

## Performance Efficiency

- Target: **< 3s** for simple queries, **< 10s** for complex multi-step reasoning
- Use **streaming responses** for AI chat interfaces
- Implement response caching for repeated queries (semantic similarity > 0.95)
- Parallelize independent AI calls (search + glossary lookup)
- Use appropriate `top_k` for RAG scenarios (5–10 for most use cases)

## Responsible AI

- **All** user-facing AI responses must pass through Azure AI Content Safety
- RAG responses **must** cite sources — never generate unsourced claims
- Implement groundedness checks (score ≥ 0.95 on 0–1 scale)
- Always include "AI-generated" disclaimers on outputs
- Critical decisions **must** have human-in-the-loop validation

```json title="config/guardrails.json — Responsible AI thresholds"
{
  "content_safety": {
    "hate": 0,
    "violence": 0,
    "self_harm": 0,
    "sexual": 0
  }
}
```

:::danger
Content safety thresholds must be **zero** for all categories in production — zero tolerance for harmful content.
:::

## WAF in the FAI Protocol

Every primitive can declare WAF alignment in its frontmatter:

```markdown title="agents/fai-security-reviewer.agent.md"
---
description: "Reviews code for OWASP LLM Top 10 vulnerabilities"
waf: ["security", "responsible-ai"]
plays: ["30-ai-security-hardening"]
---
```

The `fai-manifest.json` enforces play-level WAF pillars. The FAI Engine validates that a play's declared pillars are covered by its primitives:

```json title="fai-manifest.json"
{
  "context": {
    "waf": ["security", "reliability", "cost-optimization", "responsible-ai"]
  }
}
```

### Valid WAF Pillar Values

These are the **only** valid values in `waf` arrays:

| Value | Pillar |
|-------|--------|
| `security` | Identity, network, data protection, AI security |
| `reliability` | Retry, circuit breaker, health checks, degradation |
| `cost-optimization` | Model routing, token budgets, right-sizing |
| `operational-excellence` | CI/CD, observability, IaC, incidents |
| `performance-efficiency` | Caching, streaming, async, optimization |
| `responsible-ai` | Content safety, groundedness, fairness |

## Next Steps

- **[FAI Protocol](./fai-protocol)** — how WAF is enforced at the protocol level
- **[Primitives](./primitives)** — how each primitive type declares WAF alignment
- **[PR Checklist](../contributing/pr-checklist)** — WAF validation in pull requests
