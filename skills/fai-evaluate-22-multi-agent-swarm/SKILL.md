---
name: fai-evaluate-22-multi-agent-swarm
description: |
  Evaluate multi-agent swarm systems for coordination stability, conflict
  resolution, output coherence, and cost efficiency. Use when validating
  distributed agent teams working on shared tasks.
---

# Evaluate Multi-Agent Swarm (Play 22)

Evaluate distributed agent coordination, conflict resolution, and output quality.

## When to Use

- Validating multi-agent orchestration systems
- Measuring coordination efficiency (redundant work detection)
- Evaluating conflict resolution when agents disagree
- Benchmarking swarm cost vs single-agent approaches

---

## Evaluation Dimensions

| Dimension | Metric | Target |
|-----------|--------|--------|
| Task completion | Success rate | >= 0.90 |
| Coordination | Redundant work rate | <= 0.10 |
| Conflict resolution | Disagreement resolution rate | >= 0.95 |
| Output coherence | Consistency score | >= 0.85 |
| Cost efficiency | Cost vs single-agent | <= 1.5x |

## Swarm Evaluation

```python
def evaluate_swarm(test_tasks: list[dict], swarm_fn, single_agent_fn, judge) -> dict:
    swarm_scores, single_scores = [], []
    swarm_costs, single_costs = [], []
    for task in test_tasks:
        s_result = swarm_fn(task["input"])
        a_result = single_agent_fn(task["input"])
        swarm_scores.append(judge(s_result["output"], task["expected"]))
        single_scores.append(judge(a_result["output"], task["expected"]))
        swarm_costs.append(s_result["total_tokens"])
        single_costs.append(a_result["total_tokens"])

    avg = lambda l: sum(l)/len(l)
    return {
        "swarm_quality": avg(swarm_scores),
        "single_quality": avg(single_scores),
        "quality_delta": avg(swarm_scores) - avg(single_scores),
        "cost_ratio": avg(swarm_costs) / avg(single_costs),
        "swarm_justified": avg(swarm_scores) > avg(single_scores) * 1.05,
    }
```

## Coordination Metrics

```python
def measure_coordination(traces: list[dict]) -> dict:
    total_actions = sum(len(t["agent_actions"]) for t in traces)
    redundant = sum(1 for t in traces for a in t["agent_actions"]
                    if a.get("duplicate_of"))
    conflicts = sum(1 for t in traces for a in t["agent_actions"]
                    if a.get("conflict"))
    resolved = sum(1 for t in traces for a in t["agent_actions"]
                   if a.get("conflict_resolved"))
    return {
        "redundancy_rate": redundant / total_actions if total_actions else 0,
        "conflict_rate": conflicts / total_actions if total_actions else 0,
        "resolution_rate": resolved / conflicts if conflicts else 1.0,
    }
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Redundant work >20% | Poor task assignment | Improve supervisor's task decomposition |
| Agents conflict often | Overlapping responsibilities | Define clear agent boundaries |
| Swarm slower than single | Coordination overhead | Use swarm only for parallelizable tasks |
| Incoherent merged output | No output reconciliation | Add final synthesis/editing agent |

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
