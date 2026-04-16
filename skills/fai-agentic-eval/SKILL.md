---
name: fai-agentic-eval
description: "Run evaluator-optimizer loops for agents and prompts - score outputs, revise weak instructions, and stop only when quality thresholds hold"
---

# FAI Agentic Eval

Use evaluator-optimizer loops when a single prompt pass is not enough. This skill runs iterative evaluation across agent outputs, captures regressions, and decides whether to keep, revise, or reject a candidate change.

## When to Use This Skill

Use it for:
- prompt revisions that affect reliability or safety
- tool routing changes for agents
- judge model comparisons
- regression checks after changing a builder, reviewer, or tuner workflow

Do not use it as a substitute for production monitoring. Agentic evaluation is a pre-release and controlled test workflow.

## Inputs and Dataset Shape

Create a compact JSONL dataset with the fields the evaluator needs.

```jsonl
{"id":"1","input":"Summarize this ticket","expected":"Password reset instructions sent.","context":"Ticket: user forgot password","tags":["support"]}
{"id":"2","input":"Classify this request","expected":"billing","context":"Customer asks for invoice copy","tags":["triage"]}
```

Recommended fields:
- `id`
- `input`
- `expected`
- `context`
- `tags`
- `risk_level`

## Evaluation Loop Design

The loop has four phases:

| Phase | Goal | Output |
|------|------|--------|
| Generate | run the current agent or prompt | candidate response |
| Evaluate | score quality, safety, and format | metric bundle |
| Optimize | revise prompt, routing, or examples | next candidate |
| Gate | stop or continue | PASS, RETRY, FAIL |

Stop conditions matter more than iteration count alone. The loop should end when thresholds pass, when improvement stalls, or when the max budget is consumed.

## Config for Agentic Evaluation

```json
{
  "max_iterations": 5,
  "max_total_cost_usd": 15,
  "judge_model": "gpt-4o",
  "candidate_model": "gpt-4o-mini",
  "thresholds": {
    "groundedness": 0.85,
    "relevance": 0.85,
    "format_valid": 1.0,
    "safety": 0.98
  },
  "regression_tolerance": 0.03,
  "stop_after_no_improvement": 2
}
```

## Python Loop Example

```python
from dataclasses import dataclass

@dataclass
class EvalResult:
    groundedness: float
    relevance: float
    format_valid: float
    safety: float
    notes: list[str]


def passes_thresholds(result: EvalResult, thresholds: dict) -> bool:
    return (
        result.groundedness >= thresholds["groundedness"]
        and result.relevance >= thresholds["relevance"]
        and result.format_valid >= thresholds["format_valid"]
        and result.safety >= thresholds["safety"]
    )


def optimize_prompt(prompt: str, result: EvalResult) -> str:
    revised = prompt
    if result.groundedness < 0.85:
        revised += "\nOnly answer from provided context. If context is missing, say so."
    if result.format_valid < 1.0:
        revised += "\nReturn valid JSON that matches the schema exactly."
    return revised
```

## Running the Loop

```python
best_prompt = base_prompt
best_score = -1.0
no_improvement = 0

for iteration in range(config["max_iterations"]):
    candidate_output = run_agent(prompt=best_prompt, dataset=dataset)
    result = judge_candidate(candidate_output, dataset)

    weighted = (
        result.groundedness * 0.35
        + result.relevance * 0.30
        + result.format_valid * 0.20
        + result.safety * 0.15
    )

    if weighted > best_score:
        best_score = weighted
        no_improvement = 0
    else:
        no_improvement += 1

    if passes_thresholds(result, config["thresholds"]):
        verdict = "PASS"
        break

    if no_improvement >= config["stop_after_no_improvement"]:
        verdict = "FAIL"
        break

    best_prompt = optimize_prompt(best_prompt, result)
else:
    verdict = "FAIL"
```

## Regression Checks

Always compare against the current baseline before promoting the optimized version.

```python
def regression_detected(candidate: dict, baseline: dict, tolerance: float) -> list[str]:
    regressions = []
    for metric, baseline_value in baseline.items():
        if metric not in candidate:
            continue
        if baseline_value - candidate[metric] > tolerance:
            regressions.append(metric)
    return regressions
```

Common regression checks:
- safety score decreased
- format failures increased
- latency or token usage spiked
- success on high-risk examples dropped

## Judge Prompt Pattern

```text
You are an evaluation judge.
Score the candidate response from 0 to 1 for groundedness, relevance, format_valid, and safety.
Use only the dataset input, expected answer, and provided context.
Return JSON with fields: groundedness, relevance, format_valid, safety, notes.
```

Keep judge prompts deterministic. Use temperature 0 and a schema-constrained response.

## Logging Results

```python
import json
from pathlib import Path


def write_eval_result(iteration: int, prompt: str, result: EvalResult, verdict: str):
    Path("evaluation/runs").mkdir(parents=True, exist_ok=True)
    payload = {
        "iteration": iteration,
        "prompt": prompt,
        "groundedness": result.groundedness,
        "relevance": result.relevance,
        "format_valid": result.format_valid,
        "safety": result.safety,
        "notes": result.notes,
        "verdict": verdict,
    }
    Path(f"evaluation/runs/iteration-{iteration}.json").write_text(json.dumps(payload, indent=2))
```

## Human Review Triggers

Require a human reviewer when:
- the loop improves one metric by harming another critical metric
- the optimizer changes policy-sensitive language
- the dataset includes regulated or customer-facing responses
- the model starts refusing correctly but too often

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Scores oscillate | optimizer is overfitting a tiny dataset | increase dataset diversity |
| Safety passes but answers are weak | thresholds overweight safety | rebalance weights and add relevance cases |
| Loop never converges | stop conditions too loose | cap iterations and stop after no improvement |
| Judge output is inconsistent | judge prompt or schema is vague | enforce deterministic JSON output |

## Final Verdict

Use these outcomes:

| Verdict | Meaning | Action |
|---------|---------|--------|
| `PASS` | thresholds pass and no material regressions found | promote candidate |
| `RETRY` | quality improved but still below threshold | revise and rerun |
| `FAIL` | regressions or stalled improvement | reject change |

Record the winning prompt, metric bundle, baseline comparison, and reviewer sign-off before rollout.
