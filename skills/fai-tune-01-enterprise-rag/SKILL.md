---
name: fai-tune-01-enterprise-rag
description: |
  Tune Enterprise RAG (Play 01) configuration for retrieval quality, latency,
  cost efficiency, and guardrail thresholds. Use when optimizing an existing
  RAG deployment for production performance.
---

# Tune Enterprise RAG (Play 01)

Optimize RAG configuration for retrieval quality, latency, and cost.

## When to Use

- RAG quality scores below target thresholds
- Latency exceeding SLOs on search or generation
- Token costs growing faster than usage
- Fine-tuning guardrail thresholds after initial eval

---

## Tuning Dimensions

| Dimension | Config | Range | Impact |
|-----------|--------|-------|--------|
| Chunk size | config/chunking.json | 256-1024 tokens | Retrieval precision |
| Top K | config/search.json | 3-10 | Context quality vs cost |
| Temperature | config/openai.json | 0-0.5 | Creativity vs determinism |
| Vector weight | config/search.json | 0.3-0.9 | Semantic vs keyword |
| Max tokens | config/openai.json | 512-2048 | Response length vs cost |
| Reranker | config/search.json | on/off | Quality vs latency |

## Eval-Driven Tuning

```python
def tune_parameter(param_name: str, values: list, eval_fn, dataset_path: str):
    """Test each value, pick best based on eval score."""
    results = []
    for value in values:
        config = load_config()
        config[param_name] = value
        save_config(config)
        score = eval_fn(dataset_path)
        results.append({"value": value, **score})
        print(f"{param_name}={value} → groundedness={score['groundedness']:.3f}")
    best = max(results, key=lambda r: r["groundedness"])
    return best
```

## Common Tuning Playbook

```markdown
1. Baseline eval → Record current scores
2. Tune chunk_size: test 256, 512, 768, 1024
3. Tune top_k: test 3, 5, 7, 10
4. Tune vector_weight: test 0.3, 0.5, 0.7, 0.9
5. Tune temperature: test 0.0, 0.1, 0.2, 0.3
6. Final eval → Compare to baseline
7. Deploy if improved, rollback if not
```

## Guardrail Thresholds

```json
{
  "guardrails": {
    "groundedness": 0.85,
    "relevance": 0.80,
    "safety": 0.95,
    "latency_p95_ms": 3000
  }
}
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Low groundedness | Chunks too large, bad context | Reduce chunk size to 512, increase top_k |
| High latency | Reranker + large top_k | Disable reranker or reduce top_k |
| High cost | Using gpt-4o for everything | Route simple queries to mini |
| Inconsistent quality | High temperature | Lower to 0.1-0.2 for factual Q&A |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Tune one parameter at a time | Isolate impact of each change |
| Always measure before and after | Evidence-based tuning |
| Use evaluation dataset for comparison | Objective quality measurement |
| Keep previous config for rollback | Instant revert if quality drops |
| Document tuning decisions | Future reference for the team |
| Automate tuning evaluation | Reduce manual effort |

## Tuning Workflow

```
1. Baseline eval → record current scores
2. Change ONE parameter
3. Re-run eval → compare to baseline
4. If improved → keep change, update baseline
5. If regressed → revert change
6. Repeat for next parameter
```

## Related Skills

- `fai-tune-01-enterprise-rag` — RAG tuning playbook
- `fai-evaluation-framework` — Eval infrastructure
- `fai-inference-optimization` — Latency and cost optimization
