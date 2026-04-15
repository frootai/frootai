---
name: fai-evaluate-18-prompt-management
description: |
  Evaluate prompt management systems for quality, governance, versioning
  compliance, and safe promotion readiness. Use when auditing prompt pipelines
  or gating prompt version deployments.
---

# Evaluate Prompt Management (Play 18)

Evaluate prompt quality, versioning compliance, and promotion readiness.

## When to Use

- Gating prompt version promotion to production
- Auditing prompt governance (who changed what, when)
- Measuring prompt quality regression across versions
- Validating A/B test statistical significance

---

## Evaluation Dimensions

| Dimension | Metric | Threshold |
|-----------|--------|-----------|
| Output quality | Accuracy on test set | >= 0.85 |
| Consistency | Same output for same input | >= 0.95 |
| Safety | No harmful content generated | >= 0.99 |
| Latency | Response time P95 | <= 2000ms |
| Token efficiency | Avg tokens per response | Decreasing trend |

## Quality Regression Test

```python
def evaluate_prompt_version(version: str, test_set: list[dict],
                             generate_fn, judge_fn) -> dict:
    scores = []
    for row in test_set:
        output = generate_fn(row["input"], prompt_version=version)
        score = judge_fn(output, row["expected"])
        scores.append(score)
    avg = sum(scores) / len(scores)
    return {"version": version, "avg_score": avg, "n": len(scores),
            "passed": avg >= 0.85}
```

## Version Comparison

```python
def compare_versions(v_old: str, v_new: str, test_set, generate_fn, judge_fn):
    old_result = evaluate_prompt_version(v_old, test_set, generate_fn, judge_fn)
    new_result = evaluate_prompt_version(v_new, test_set, generate_fn, judge_fn)
    delta = new_result["avg_score"] - old_result["avg_score"]
    return {"old": old_result, "new": new_result, "delta": delta,
            "improved": delta > 0, "safe_to_promote": delta >= -0.02}
```

## Governance Audit

```python
def audit_prompt_changes(registry, since_date: str) -> list[dict]:
    changes = []
    for name in registry.list_prompts():
        for version in registry.list_versions(name):
            meta = registry.get_metadata(name, version)
            if meta["created_at"] >= since_date:
                changes.append({"prompt": name, "version": version,
                    "author": meta["author"], "date": meta["created_at"]})
    return changes
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Quality regression on promote | No regression test | Gate promotion on eval threshold |
| Can't reproduce scores | Non-deterministic eval | Set judge temperature=0, fix seed |
| A/B test inconclusive | Too few samples | Run 1000+ requests per variant |
| Prompt drift in prod | No version pinning | Pin version in config, not "latest" |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Use gpt-4o-mini as judge | Cost-effective, sufficient for scoring |
| Set judge temperature to 0 | Reproducible evaluation scores |
| Minimum 100 test cases | Statistical significance |
| Version evaluation datasets | Track quality over time |
| Run eval before every deploy | Gate promotion on quality |
| Compare against baseline | Detect regressions, not just absolutes |

## Evaluation Pipeline

```
Dataset (JSONL) → Generate predictions → Score with judge → Aggregate → Pass/Fail gate
```

## Metric Thresholds

| Metric | Minimum | Target |
|--------|---------|--------|
| Groundedness | 0.80 | 0.90 |
| Relevance | 0.80 | 0.90 |
| Coherence | 0.75 | 0.85 |
| Safety | 0.95 | 0.99 |

## Related Skills

- `fai-evaluation-framework` — Reusable eval framework
- `fai-build-llm-evaluator` — LLM-as-judge implementation
- `fai-agentic-eval` — Agentic evaluation patterns
