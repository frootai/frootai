---
name: fai-build-llm-evaluator
description: |
  Implement LLM evaluation pipelines with groundedness, relevance, coherence,
  safety metrics, and pass/fail gates. Use when measuring AI output quality,
  comparing model versions, or gating deployments on thresholds.
---

# LLM Evaluation Pipeline

Build evaluation pipelines to measure, compare, and gate AI output quality.

## When to Use

- Measuring groundedness and relevance of RAG answers
- Comparing model versions before promotion
- Gating deployments on quality thresholds
- Building regression test suites for prompt changes

---

## Evaluation Dataset

```jsonl
{"question": "What is circuit breaker?", "context": "A circuit breaker...", "expected": "A circuit breaker is..."}
{"question": "How to configure retry?", "context": "Retry policies use...", "expected": "Configure with backoff..."}
```

## Evaluator Functions

```python
import json

def evaluate_groundedness(answer: str, context: str, judge) -> float:
    resp = judge.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "system", "content": "Rate 0-1: Is the answer supported by context? Return JSON: {\"score\": float}"},
            {"role": "user", "content": f"Context: {context}\nAnswer: {answer}"}],
        temperature=0.0, response_format={"type": "json_object"},
    )
    return json.loads(resp.choices[0].message.content)["score"]

def evaluate_relevance(answer: str, question: str, judge) -> float:
    resp = judge.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "system", "content": "Rate 0-1: Does answer address question? Return JSON: {\"score\": float}"},
            {"role": "user", "content": f"Question: {question}\nAnswer: {answer}"}],
        temperature=0.0, response_format={"type": "json_object"},
    )
    return json.loads(resp.choices[0].message.content)["score"]
```

## Pipeline Runner

```python
def run_evaluation(dataset_path: str, generate_fn, judge, thresholds=None):
    thresholds = thresholds or {"groundedness": 0.8, "relevance": 0.8}
    results = []
    with open(dataset_path) as f:
        for line in f:
            row = json.loads(line)
            answer = generate_fn(row["question"], row["context"])
            scores = {
                "groundedness": evaluate_groundedness(answer, row["context"], judge),
                "relevance": evaluate_relevance(answer, row["question"], judge),
            }
            results.append({**row, "answer": answer, **scores})
    avg = lambda k: sum(r[k] for r in results) / len(results)
    summary = {k: avg(k) for k in thresholds}
    summary["passed"] = all(summary[k] >= v for k, v in thresholds.items())
    return summary
```

## Metric Reference

| Metric | Measures | Threshold |
|--------|----------|-----------|
| Groundedness | Claims supported by context | >= 0.80 |
| Relevance | Answer addresses question | >= 0.80 |
| Coherence | Logical flow and clarity | >= 0.75 |
| Safety | No harmful content | >= 0.95 |
| Latency P95 | Response time | <= 3000ms |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Low groundedness | Model hallucinating | Strengthen grounding rules in prompt |
| Inconsistent judge | High temperature | Set judge temperature to 0.0 |
| Eval too expensive | Using gpt-4o for judging | Use gpt-4o-mini as judge |
| False failures | Ambiguous test questions | Clean evaluation dataset |

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
