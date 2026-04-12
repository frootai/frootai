---
name: tune-low-code-ai-builder
description: "Tune Low-Code AI Builder — optimize pipeline execution speed, model selection per step type, template quality, deployment configuration, cost per pipeline run. Use when: tune, optimize builder."
---

# Tune Low-Code AI Builder

## When to Use
- Optimize pipeline execution speed (parallel step execution)
- Select optimal model per step type (classification → mini, generation → full)
- Improve template quality based on user feedback
- Optimize deployment configuration for cost
- Reduce cost per pipeline run

## Tuning Dimensions

### Dimension 1: Pipeline Execution Optimization

| Strategy | Before | After | Impact |
|----------|--------|-------|--------|
| Parallel independent steps | 10s (sequential) | 4s (parallel) | 60% faster |
| Cache AI step results | Always call LLM | Cache 5-min TTL | 40% fewer LLM calls |
| Batch small steps | 5 individual calls | 1 batch call | 80% fewer API calls |
| Pre-validate before execute | Fail at step 5 | Fail at validation | Instant feedback |
| Lazy connector init | All at start | On-demand | 50% faster start |

### Dimension 2: Per-Step Model Selection

| Step Type | Default | Cost-Optimized | Quality-Optimized |
|-----------|---------|---------------|-------------------|
| Classification | gpt-4o | gpt-4o-mini | gpt-4o |
| Entity extraction | gpt-4o | gpt-4o-mini | gpt-4o |
| Summarization | gpt-4o | gpt-4o-mini | gpt-4o |
| Generation (long) | gpt-4o | gpt-4o | gpt-4o |
| Validation | gpt-4o-mini | gpt-4o-mini | gpt-4o-mini |

**Cost impact**: Using gpt-4o-mini for simple steps saves 90% on those steps.

### Dimension 3: Template Quality Optimization

| Metric | How to Improve |
|--------|---------------|
| Success rate per template | Test with 50+ diverse inputs per template |
| Step error rate | Identify failing steps, improve prompts |
| User customization rate | If users always change step X → make it configurable |
| Template adoption | Track which templates are most/least used |
| Time to customize | Simplify configuration for common changes |

### Dimension 4: Deployment Configuration

| Component | Dev | Staging | Production |
|-----------|-----|---------|-----------|
| Container CPU | 0.25 | 0.5 | 1.0 |
| Container Memory | 0.5 GB | 1 GB | 2 GB |
| Min replicas | 0 (scale to zero) | 1 | 2 |
| Max replicas | 1 | 3 | 10 |
| Auto-shutdown | After 15 min idle | After 30 min | Never |

### Dimension 5: Cost Per Pipeline Run

| Component | Cost Driver | Optimization |
|-----------|------------|-------------|
| AI steps (LLM) | Tokens per step | Use gpt-4o-mini, cache results |
| Connectors | API calls | Batch reads, cache lookups |
| Container runtime | Running time | Scale to zero when idle |
| Storage | Pipeline definitions | Minimal (~1KB per pipeline) |

**Monthly estimate** (1000 pipeline runs/day, avg 5 steps):
- AI steps (mini): ~$75/mo
- Container (B1 equivalent): ~$50/mo
- Cosmos DB (serverless): ~$10/mo
- **Total: ~$135/mo** for complete low-code AI platform

## Production Readiness Checklist
- [ ] All templates executing successfully (≥ 95%)
- [ ] One-click deploy working for all pipeline types
- [ ] Parallel step execution configured
- [ ] Model routing per step type (mini for simple, full for complex)
- [ ] Error messages user-friendly
- [ ] Pipeline versioning with rollback
- [ ] Connector auth working for all configured sources
- [ ] Visual designer responsive on desktop + tablet
- [ ] Cost per run within budget

## Output: Tuning Report
After tuning, compare:
- Pipeline execution speed improvement
- Cost per run reduction (model routing)
- Template success rate improvement
- Deployment time reduction
- User satisfaction change

## Tuning Playbook
1. **Baseline**: Run all 5 templates with 20 sample inputs each, record success rate
2. **Speed**: Enable parallel execution for independent steps
3. **Models**: Route classification/validation to gpt-4o-mini, generation to gpt-4o
4. **Cache**: Enable LLM result caching (5-min TTL) for repeated inputs
5. **Templates**: Review user feedback, improve prompts in failing templates
6. **Deploy**: Right-size Container App config per environment
7. **Cost**: Calculate per-run cost, project at target volume
8. **Re-test**: Same 100 inputs, compare before/after
