---
name: deploy-prompt-management
description: "Deploy Prompt Management — set up prompt registry (Cosmos DB), versioned templates, A/B testing framework, injection defense layer, prompt analytics. Use when: deploy, provision, configure prompt platform."
---

# Deploy Prompt Management

## When to Use
- Set up a centralized prompt registry for all AI applications
- Configure versioned prompt templates with rollback capability
- Deploy A/B testing framework for prompt comparison
- Implement injection defense layer (input sanitization)
- Set up prompt analytics and usage tracking

## Prerequisites
1. Azure CLI authenticated: `az account show`
2. Cosmos DB for prompt storage (or existing instance)
3. Azure OpenAI for prompt testing
4. Azure Functions for prompt serving API
5. Application Insights for prompt analytics

## Step 1: Deploy Prompt Registry Infrastructure
```bash
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
```
Resources:
- Cosmos DB (prompt storage with versioning — container per environment)
- Azure Functions (prompt serving API — get/create/update/rollback)
- Application Insights (prompt usage analytics)
- Azure OpenAI (prompt testing endpoint)
- Key Vault (API keys, connection strings)

## Step 2: Initialize Prompt Registry Schema
```json
// Cosmos DB document structure
{
  "id": "system-prompt-rag-v3",
  "name": "RAG System Prompt",
  "version": 3,
  "status": "active",  // active | archived | testing
  "template": "Answer based ONLY on the provided context.\n...",
  "variables": ["context", "user_query", "max_tokens"],
  "metadata": {
    "author": "ai-team",
    "created": "2026-04-01T00:00:00Z",
    "tags": ["rag", "grounding", "production"],
    "token_count": 450,
    "model_compatibility": ["gpt-4o", "gpt-4o-mini"]
  },
  "ab_test": {
    "enabled": false,
    "variant_id": null,
    "traffic_split": null
  }
}
```

## Step 3: Deploy Prompt Serving API
```bash
# API endpoints
GET    /api/prompts/{name}?version=latest     # Get active prompt
GET    /api/prompts/{name}/versions            # List all versions
POST   /api/prompts/{name}                     # Create new version
PUT    /api/prompts/{name}/activate?version=3  # Activate specific version
POST   /api/prompts/{name}/rollback            # Rollback to previous
POST   /api/prompts/{name}/ab-test             # Start A/B test
GET    /api/prompts/{name}/analytics           # Usage analytics
```

## Step 4: Configure Injection Defense
| Defense Layer | Implementation | Purpose |
|--------------|---------------|---------|
| Input sanitization | Strip special tokens, escape delimiters | Prevent delimiter injection |
| Prompt armor | Wrap user input in clear boundaries | Isolate user content from instructions |
| Output validation | Check for prompt leakage | Prevent system prompt exposure |
| Rate limiting | Max 60 prompt retrievals/min | Prevent enumeration attacks |
| Audit logging | Log all prompt access | Track unauthorized usage |

## Step 5: Configure A/B Testing Framework
```json
// A/B test configuration
{
  "test_name": "rag-prompt-grounding-v2-vs-v3",
  "control": { "prompt_id": "system-prompt-rag-v2", "traffic": 50 },
  "variant": { "prompt_id": "system-prompt-rag-v3", "traffic": 50 },
  "metrics": ["groundedness", "relevance", "latency", "token_count"],
  "duration_days": 7,
  "min_samples": 1000,
  "significance_level": 0.05
}
```

## Step 6: Post-Deployment Verification
- [ ] Prompt registry API responding (GET /api/prompts)
- [ ] Version creation and activation working
- [ ] Rollback to previous version works
- [ ] Injection defense blocking malicious input
- [ ] A/B test framework splits traffic correctly
- [ ] Analytics tracking prompt usage per application
- [ ] Cosmos DB TTL configured for archived versions

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Prompt not found | Wrong version or name | Check name casing, verify active version |
| Template variables not replaced | Missing variable in request | Validate all variables provided at render time |
| A/B split uneven | Hash function bias | Use consistent hashing on user_id |
| Injection bypasses defense | Missing sanitization layer | Add input normalization before prompt assembly |
| High latency on prompt fetch | No caching | Add Redis cache (5-min TTL) for active prompts |
| Version conflict | Concurrent updates | Use optimistic concurrency with Cosmos DB etag |
