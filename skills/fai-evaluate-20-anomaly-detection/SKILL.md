---
name: fai-evaluate-20-anomaly-detection
description: |
  Evaluate anomaly detection systems for signal quality, alert precision,
  false positive rates, and operational usability. Use when validating
  AI-powered monitoring and alerting pipelines.
---

# Evaluate Anomaly Detection (Play 20)

Evaluate anomaly detection for precision, recall, and operational alert quality.

## When to Use

- Validating anomaly detection model accuracy
- Tuning alert thresholds to reduce false positives
- Benchmarking detection latency for real-time systems
- Comparing detection algorithms (statistical vs ML)

---

## Evaluation Metrics

```python
def evaluate_anomaly_detector(predictions: list[bool], labels: list[bool]) -> dict:
    tp = sum(p and l for p, l in zip(predictions, labels))
    fp = sum(p and not l for p, l in zip(predictions, labels))
    fn = sum(not p and l for p, l in zip(predictions, labels))
    tn = sum(not p and not l for p, l in zip(predictions, labels))
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
    return {"precision": round(precision, 3), "recall": round(recall, 3),
            "f1": round(f1, 3), "false_positive_rate": round(fp / (fp + tn), 3) if (fp+tn) else 0}
```

## Alert Quality Assessment

| Metric | Target | Action if Failed |
|--------|--------|-----------------|
| Precision | >= 0.80 | Tighten threshold, reduce sensitivity |
| Recall | >= 0.90 | Loosen threshold or add detection rules |
| F1 Score | >= 0.85 | Balance precision/recall tradeoff |
| False positive rate | <= 0.05 | Reduce alert noise |
| Detection latency | <= 5 min | Reduce window size |

## Threshold Tuning

```python
def find_optimal_threshold(scores: list[float], labels: list[bool]) -> dict:
    best = {"threshold": 0, "f1": 0}
    for threshold in [i/100 for i in range(1, 100)]:
        preds = [s >= threshold for s in scores]
        metrics = evaluate_anomaly_detector(preds, labels)
        if metrics["f1"] > best["f1"]:
            best = {"threshold": threshold, **metrics}
    return best
```

## KQL Alert Query

```kql
// Detect latency anomalies
customMetrics
| where name == "ai.llm.latency_ms"
| summarize p95=percentile(value, 95), avg=avg(value) by bin(timestamp, 5m)
| extend is_anomaly = p95 > avg * 3  // 3x average = anomaly
| where is_anomaly == true
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Too many false positives | Threshold too sensitive | Increase threshold, use adaptive baseline |
| Missing real anomalies | Threshold too high | Lower threshold, add rule-based fallback |
| Alert fatigue | Too many non-actionable alerts | Group alerts, add severity routing |
| Slow detection | Large analysis window | Reduce to 1-5 minute windows |

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
