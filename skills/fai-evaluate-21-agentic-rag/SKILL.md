---
name: fai-evaluate-21-agentic-rag
description: |
  Evaluate Agentic RAG systems for grounding fidelity, tool-use reliability,
  multi-step orchestration quality, and citation accuracy. Use when validating
  AI agents that combine retrieval with tool execution.
---

# Evaluate Agentic RAG (Play 21)

Evaluate agents that combine retrieval, reasoning, and tool execution.

## When to Use

- Validating RAG agents that use tools (search, calculate, API calls)
- Measuring grounding when agents combine multiple sources
- Evaluating multi-step reasoning chains
- Benchmarking agent task completion rates

---

## Evaluation Dimensions

| Dimension | Measures | Method |
|-----------|----------|--------|
| Grounding | Facts supported by retrieved context | LLM-as-judge |
| Tool accuracy | Correct tool selected and called | Exact match |
| Task completion | End-to-end task success | Binary pass/fail |
| Citation quality | Sources correctly attributed | Manual + automated |

## Agentic Eval Pipeline

```python
def evaluate_agentic_rag(test_cases: list[dict], agent_fn, judge) -> dict:
    results = []
    for case in test_cases:
        trace = agent_fn(case["input"])  # Returns {answer, tools_used, sources}
        scores = {
            "grounding": judge_grounding(trace["answer"], trace["sources"], judge),
            "tool_accuracy": case["expected_tools"] == trace["tools_used"],
            "task_complete": judge_task_completion(trace["answer"], case["expected"], judge),
            "citation_accuracy": check_citations(trace["answer"], trace["sources"]),
        }
        results.append({**case, **scores})

    return {dim: sum(r[dim] for r in results) / len(results)
            for dim in ["grounding", "tool_accuracy", "task_complete", "citation_accuracy"]}
```

## Tool-Use Evaluation

```python
def evaluate_tool_selection(traces: list[dict], expected: list[dict]) -> dict:
    correct = 0
    for trace, exp in zip(traces, expected):
        if set(trace["tools_used"]) == set(exp["expected_tools"]):
            correct += 1
    return {"tool_selection_accuracy": correct / len(traces),
            "n": len(traces)}
```

## Multi-Step Reasoning Check

```python
def check_reasoning_chain(trace: dict) -> dict:
    steps = trace.get("reasoning_steps", [])
    return {
        "num_steps": len(steps),
        "has_retrieval": any("search" in s["action"] for s in steps),
        "has_reasoning": any("think" in s["action"] for s in steps),
        "final_grounded": trace.get("grounding_score", 0) >= 0.8,
    }
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Low grounding | Agent not using retrieved context | Strengthen system prompt grounding rules |
| Wrong tool selected | Tool descriptions ambiguous | Improve tool descriptions and examples |
| Incomplete tasks | Agent stops too early | Increase max iterations, add completion check |
| Missing citations | No citation instruction | Add "cite sources as [1], [2]" to system prompt |

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
