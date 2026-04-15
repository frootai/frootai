---
name: fai-tune-21-agentic-rag
description: "Tune Play 21 agentic RAG with planner depth, retrieval fan-out, reranker policy, and citation strictness."
---

# FAI Tune - Play 21: Agentic RAG

## TuneKit Config Layout

solution-plays/21-agentic-rag/config/
├── planner.json
├── retrieval.json
├── reranker.json
└── citations.json

## Step 1 - Validate Core Configuration

```json
// config/retrieval.json
{
  "search_mode": "hybrid",
  "top_k": 8,
  "fetch_k": 32,
  "max_hops": 3,
  "reranker": "semantic",
  "min_relevance_score": 0.65,
  "require_citations": true
}
```

## Step 2 - Tune Critical Parameters

| Parameter | Range | Default | Guidance |
|-----------|-------|---------|----------|
| `top_k` | 1-50 | 8 | Higher improves recall, may hurt precision. |
| `fetch_k` | top_k to 200 | 32 | Candidate pool for reranking. |
| `max_hops` | 1-6 | 3 | Planner depth for tool+retrieval loops. |
| `min_relevance_score` | 0.0-1.0 | 0.65 | Raise for stricter grounding. |

## Step 3 - Add Evaluation Gates

```json
{
  "evaluation": {
    "enabled": true,
    "dataset": "evaluation/test-cases.jsonl",
    "sample_size": 200,
    "gates": {
      "quality_min": 0.80,
      "safety_min": 0.90,
      "latency_p95_ms_max": 2000
    }
  }
}
```

```python
import json

def validate_gate(metrics, gates):
    failures = []
    if metrics.get("quality", 0) < gates["quality_min"]:
        failures.append("quality")
    if metrics.get("safety", 0) < gates["safety_min"]:
        failures.append("safety")
    if metrics.get("latency_p95_ms", 999999) > gates["latency_p95_ms_max"]:
        failures.append("latency")
    if failures:
        raise SystemExit(f"Gate failed: {', '.join(failures)}")
    print("PASS: all gates met")
```

## Step 4 - Add Cost Controls

```json
{
  "cost_controls": {
    "daily_budget_usd": 500,
    "monthly_budget_usd": 10000,
    "alert_thresholds": [50, 75, 90],
    "throttle_on_budget_breach": true
  }
}
```

## Validation Checklist

| Check | Expected | Command |
|-------|----------|---------|
| Hybrid search enabled | true | `jq '.search_mode' config/retrieval.json` |
| Citation required | true | `jq '.require_citations' config/retrieval.json` |
| Hop count | <= 6 | `jq '.max_hops' config/retrieval.json` |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Ungrounded answers | Low relevance threshold | Increase min_relevance_score and require citations. |
| Slow responses | High fetch_k and many hops | Reduce fetch_k to 16 and max_hops to 2. |
| Missing facts | top_k too small | Increase top_k and validate reranker settings. |

## Rollback Plan

1. Restore previous config from git tag.
2. Revert model or routing changes first.
3. Re-run evaluation gate on rollback commit.
4. Promote rollback only if safety and quality gates pass.
