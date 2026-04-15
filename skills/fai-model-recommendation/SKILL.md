---
name: fai-model-recommendation
description: |
  Recommend AI models based on task requirements, cost constraints, latency
  targets, and quality thresholds. Use when selecting between Azure OpenAI
  models or comparing cloud vs edge deployment.
---

# AI Model Recommendation

Select the right model by matching task requirements to model capabilities.

## When to Use

- Choosing between GPT-4o, GPT-4o-mini, Phi-4, or other models
- Optimizing cost vs quality tradeoff for a specific task
- Evaluating cloud vs edge deployment options
- Building model routing logic for production

---

## Decision Matrix

| Task Type | Recommended | Why | Cost |
|-----------|------------|-----|------|
| Simple Q&A | GPT-4o-mini | Sufficient quality, 94% cheaper | $0.15/M |
| Complex analysis | GPT-4o | Best reasoning capability | $2.50/M |
| Code generation | GPT-4o | Higher accuracy on complex code | $2.50/M |
| Classification | GPT-4o-mini | Fast, cheap, high accuracy | $0.15/M |
| Extraction | GPT-4o-mini | Structured output works well | $0.15/M |
| Embeddings | text-embedding-3-small | Best cost/quality ratio | $0.02/M |
| On-device | Phi-4-mini (3.8B) | No internet required | Free (compute) |

## Recommendation Engine

```python
def recommend_model(task: dict) -> dict:
    if task.get("offline_required"):
        return {"model": "phi-4-mini", "deployment": "edge",
                "reason": "Offline requirement — edge model"}

    complexity = task.get("complexity", "medium")
    budget = task.get("max_cost_per_1k", 0.01)

    if complexity == "low" or budget < 0.001:
        return {"model": "gpt-4o-mini", "deployment": "cloud",
                "reason": "Low complexity or tight budget"}

    if complexity == "high" and budget >= 0.005:
        return {"model": "gpt-4o", "deployment": "cloud",
                "reason": "Complex task with sufficient budget"}

    return {"model": "gpt-4o-mini", "deployment": "cloud",
            "reason": "Default — good balance of cost and quality"}
```

## Model Comparison Template

```markdown
| Dimension | GPT-4o | GPT-4o-mini | Phi-4-mini |
|-----------|--------|-------------|------------|
| Quality | ★★★★★ | ★★★★☆ | ★★★☆☆ |
| Latency | Medium | Fast | Fastest (local) |
| Cost | $$$$ | $ | Free (compute) |
| Context | 128K | 128K | 8K |
| Offline | No | No | Yes |
| Best for | Analysis | Q&A, extraction | Classification |
```

## Production Routing

```python
MODEL_ROUTES = {
    "classification": "gpt-4o-mini",
    "extraction": "gpt-4o-mini",
    "summarization": "gpt-4o-mini",
    "analysis": "gpt-4o",
    "code_generation": "gpt-4o",
    "creative_writing": "gpt-4o",
}

def route_to_model(task_type: str) -> str:
    return MODEL_ROUTES.get(task_type, "gpt-4o-mini")
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Quality too low with mini | Task is too complex | Upgrade to gpt-4o for that task type |
| Cost too high with 4o | Using 4o for simple tasks | Route classification/extraction to mini |
| Edge model hallucinating | Small model limitations | Use for simple tasks only, cloud for complex |
| Latency spikes | Model cold start | Use streaming, warm connections |

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
