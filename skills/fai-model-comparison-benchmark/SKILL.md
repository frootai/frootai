---
name: fai-model-comparison-benchmark
description: |
  Benchmark multiple AI models on cost, latency, and quality for a specific
  task. Use when selecting between GPT-4o, GPT-4o-mini, Claude, or other
  models for production deployment.
---

# Model Comparison Benchmark

Compare AI models on cost, latency, and quality to select the best fit.

## When to Use

- Choosing between models for a production use case
- Evaluating cost-quality tradeoff (4o vs mini)
- Benchmarking latency for real-time applications
- Building evidence for model selection decisions

---

## Benchmark Framework

```python
import time, json

def benchmark_model(model: str, client, test_prompts: list[str],
                    max_tokens: int = 500) -> dict:
    latencies, costs, qualities = [], [], []
    for prompt in test_prompts:
        start = time.monotonic()
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
        )
        elapsed = (time.monotonic() - start) * 1000
        latencies.append(elapsed)
        costs.append(estimate_cost(resp.usage, model))

    return {
        "model": model,
        "latency_p50_ms": sorted(latencies)[len(latencies)//2],
        "latency_p95_ms": sorted(latencies)[int(len(latencies)*0.95)],
        "avg_cost_per_call": sum(costs) / len(costs),
        "total_cost": sum(costs),
        "n": len(test_prompts),
    }
```

## Multi-Model Comparison

```python
def compare_models(models: list[str], client, prompts, judge) -> list[dict]:
    results = []
    for model in models:
        metrics = benchmark_model(model, client, prompts)
        # Add quality scoring
        quality_scores = []
        for prompt in prompts[:20]:  # Sample for quality
            resp = client.chat.completions.create(
                model=model, messages=[{"role": "user", "content": prompt}])
            score = judge_quality(resp.choices[0].message.content, prompt, judge)
            quality_scores.append(score)
        metrics["avg_quality"] = sum(quality_scores) / len(quality_scores)
        results.append(metrics)
    return sorted(results, key=lambda x: x["avg_quality"], reverse=True)
```

## Decision Matrix

| Factor | GPT-4o | GPT-4o-mini | When to Choose |
|--------|--------|-------------|---------------|
| Quality | Highest | Good | 4o for complex reasoning |
| Latency | Higher | Lower | mini for real-time chat |
| Cost | $2.50/M in | $0.15/M in | mini for high-volume |
| Context | 128K | 128K | Equal |
| Best for | Analysis, code gen | Classification, extraction | Match to task complexity |

## Output Report

```python
def print_report(results: list[dict]):
    print(f"{'Model':<20} {'P50 ms':<10} {'P95 ms':<10} {'Quality':<10} {'Cost/call':<12}")
    for r in results:
        print(f"{r['model']:<20} {r['latency_p50_ms']:<10.0f} "
              f"{r['latency_p95_ms']:<10.0f} {r['avg_quality']:<10.2f} "
              f"${r['avg_cost_per_call']:<11.4f}")
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Inconsistent quality scores | High temperature | Set temperature=0 for benchmarks |
| Latency varies wildly | Cold start or throttling | Warm up, run 50+ samples |
| Cost estimate wrong | Not counting system prompt | Include all message tokens |
| Mini beats 4o on task | Task is simple extraction | Use mini — save 94% cost |

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
