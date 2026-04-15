---
name: fai-cost-estimator
description: |
  Build workload cost estimates with scenario modeling, assumption tracking,
  and optimization levers for Azure AI deployments. Use when budgeting for
  new AI projects or reviewing existing spend.
---

# AI Workload Cost Estimator

Build cost estimates with scenario ranges, assumptions, and optimization paths.

## When to Use

- Budgeting for a new AI workload on Azure
- Comparing PAYG vs PTU for Azure OpenAI
- Presenting cost projections to stakeholders
- Identifying top cost optimization levers

---

## Cost Estimation Template

```markdown
## Cost Estimate: [Project Name]
**Date:** YYYY-MM-DD | **Author:** [name] | **Environment:** production

### Assumptions
- Daily active users: 1,000
- Avg queries/user/day: 10
- Avg prompt tokens: 500, completion tokens: 300
- Peak:average ratio: 3:1

### Monthly Estimate

| Service | SKU | Unit Cost | Usage | Monthly |
|---------|-----|-----------|-------|---------|
| Azure OpenAI (GPT-4o) | PAYG | $2.50/M in, $10/M out | 15M in, 9M out | $127.50 |
| Azure OpenAI (Embedding) | PAYG | $0.02/M | 30M | $0.60 |
| Azure AI Search | S1 | $250/mo | 1 unit | $250 |
| App Service | P1v3 | $138/mo | 2 instances | $276 |
| Cosmos DB | Autoscale | $0.008/RU/hr | 4000 RU | $23 |
| Storage | Hot LRS | $0.018/GB | 100 GB | $1.80 |
| **Total** | | | | **$679/mo** |
```

## Scenario Modeling

```python
def estimate_openai_cost(daily_users: int, queries_per_user: int,
                          avg_prompt_tokens: int, avg_completion_tokens: int,
                          model: str = "gpt-4o") -> dict:
    rates = {
        "gpt-4o": {"input": 2.50, "output": 10.00},
        "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    }
    r = rates[model]
    monthly_queries = daily_users * queries_per_user * 30
    input_cost = (monthly_queries * avg_prompt_tokens / 1_000_000) * r["input"]
    output_cost = (monthly_queries * avg_completion_tokens / 1_000_000) * r["output"]
    return {"model": model, "monthly_queries": monthly_queries,
            "input_cost": round(input_cost, 2), "output_cost": round(output_cost, 2),
            "total": round(input_cost + output_cost, 2)}

# Compare models
for model in ["gpt-4o", "gpt-4o-mini"]:
    print(estimate_openai_cost(1000, 10, 500, 300, model))
```

## PTU vs PAYG Decision

| Utilization | Recommendation | Savings |
|-------------|---------------|---------|
| < 30% | PAYG | N/A |
| 30-60% | Evaluate PTU | Break-even zone |
| > 60% sustained | PTU | 40-60% savings |

## Optimization Levers

| Lever | Savings | Effort |
|-------|---------|--------|
| Route simple queries to mini | 40-60% | Low |
| Semantic caching | 20-30% | Medium |
| Reduce chunk size (fewer tokens) | 10-20% | Low |
| PTU for sustained traffic | 40-60% | Medium |
| Right-size App Service plan | 20-40% | Low |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Estimate way off actual | Missing system prompt tokens | Count full message chain |
| Stakeholder sticker shock | No optimization plan | Present with cost optimization levers |
| PTU underutilized | Overestimated steady traffic | Start PAYG, switch at sustained 60% |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Start simple, add complexity when needed | Avoid over-engineering |
| Automate repetitive tasks | Consistency and speed |
| Document decisions and tradeoffs | Future reference for the team |
| Validate with real data | Don't rely on synthetic tests alone |
| Review with peers | Fresh eyes catch blind spots |
| Iterate based on feedback | First version is never perfect |

## Quality Checklist

- [ ] Requirements clearly defined
- [ ] Implementation follows project conventions
- [ ] Tests cover happy path and error paths
- [ ] Documentation updated
- [ ] Peer reviewed
- [ ] Validated in staging environment

## Related Skills

- `fai-implementation-plan-generator` — Planning and milestones
- `fai-review-and-refactor` — Code review patterns
- `fai-quality-playbook` — Engineering quality standards
