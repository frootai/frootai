---
name: fai-evaluation-framework
description: |
  Define a reusable evaluation framework with scoring rubrics, dataset management,
  judge configuration, and reproducible run patterns. Use when standardizing
  AI evaluation across multiple projects or teams.
---

# AI Evaluation Framework

Build a reusable evaluation framework with rubrics, datasets, and reproducible runs.

## When to Use

- Standardizing evaluation across multiple AI projects
- Creating reusable judge functions and scoring rubrics
- Managing evaluation datasets with versioning
- Setting up CI-integrated quality gates

---

## Framework Architecture

```
eval/
  datasets/
    v1.0/test-set.jsonl
    v1.1/test-set.jsonl
  rubrics/
    groundedness.py
    relevance.py
    safety.py
  runners/
    run_eval.py
    compare.py
  reports/
    2026-04-15-run.json
```

## Rubric Definition

```python
from dataclasses import dataclass
from typing import Callable

@dataclass
class Rubric:
    name: str
    description: str
    score_fn: Callable[[str, str, any], float]
    threshold: float

    def evaluate(self, output: str, reference: str, judge=None) -> dict:
        score = self.score_fn(output, reference, judge)
        return {"rubric": self.name, "score": score,
                "passed": score >= self.threshold}

groundedness_rubric = Rubric(
    name="groundedness",
    description="Are all claims supported by provided context?",
    score_fn=lambda out, ref, judge: judge_groundedness(out, ref, judge),
    threshold=0.80,
)
```

## Evaluation Runner

```python
import json
from datetime import datetime

def run_evaluation(dataset_path: str, predict_fn, rubrics: list[Rubric],
                    judge=None) -> dict:
    with open(dataset_path) as f:
        dataset = [json.loads(l) for l in f]

    all_scores = {r.name: [] for r in rubrics}
    for row in dataset:
        output = predict_fn(row["input"])
        for rubric in rubrics:
            result = rubric.evaluate(output, row.get("expected", ""), judge)
            all_scores[rubric.name].append(result["score"])

    summary = {}
    for name, scores in all_scores.items():
        avg = sum(scores) / len(scores)
        rubric = next(r for r in rubrics if r.name == name)
        summary[name] = {"avg": round(avg, 3), "passed": avg >= rubric.threshold}

    report = {"timestamp": datetime.now().isoformat(), "dataset": dataset_path,
              "n": len(dataset), "metrics": summary,
              "overall_passed": all(m["passed"] for m in summary.values())}
    return report
```

## Dataset Versioning

```bash
# Create new dataset version
cp eval/datasets/v1.0/test-set.jsonl eval/datasets/v1.1/test-set.jsonl
# Edit v1.1, then update runner config
```

## CI Gate

```yaml
- name: Run AI Evaluation
  run: |
    python eval/runners/run_eval.py \
      --dataset eval/datasets/v1.1/test-set.jsonl \
      --threshold-groundedness 0.80 \
      --threshold-relevance 0.80
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Scores not reproducible | Random seed not set | Fix judge seed and temperature=0 |
| Dataset too small | <50 rows | Expand to 100+ for statistical significance |
| Eval too expensive | Running full dataset on every PR | Sample 50 rows for PR, full on merge |
| Rubric too strict | Threshold set without baseline | Run baseline eval first, then set threshold |
