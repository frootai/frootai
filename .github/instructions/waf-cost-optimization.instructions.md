---
applyTo: "**/*.{ts,js,py,bicep,json,yaml,yml}"
description: "Cost optimization patterns — model routing, token budgets, right-sizing, caching, and FinOps practices aligned to Azure Well-Architected Framework."
---
# Cost Optimization — Azure Well-Architected Framework

When implementing or reviewing code, enforce these cost optimization principles:

## Right-Sizing
- Use consumption-based pricing (Serverless, Functions) for variable workloads
- Use reserved instances for steady-state production workloads
- Default to the smallest viable SKU — scale up based on metrics, not assumptions
- Use Azure AI model routing: GPT-4o-mini for simple tasks, GPT-4o for complex

## AI Cost Control
- Implement token budgets per request (max_tokens in config)
- Cache frequent AI responses (TTL-based, semantic dedup)
- Use prompt compression to reduce input tokens
- Monitor cost per request and alert on anomalies
- Consider fine-tuned smaller models for high-volume, narrow tasks

## Infrastructure
- Use auto-scaling with appropriate min/max bounds
- Enable auto-shutdown for dev/test environments
- Use spot instances for batch processing workloads
- Tag all resources with cost center, environment, and owner

## Monitoring
- Set up Azure Cost Management budgets with alerts at 50%, 80%, 100%
- Review cost reports weekly — identify unused or underutilized resources
- Use Azure Advisor cost recommendations

## Development
- Use free/dev tiers for development (AI Search Free, App Service Free/B1)
- Share dev resources across team where safe (shared AI Search index)
- Use local emulators where available (Cosmos DB, Storage)
