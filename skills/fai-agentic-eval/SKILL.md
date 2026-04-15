---
name: fai-agentic-eval
description: |
  Patterns for evaluating and improving AI agent outputs. Use this skill when:
  - Implementing self-critique and reflection loops
  - Building evaluator-optimizer pipelines for quality-critical generation
  - Creating test-driven code refinement workflows
  - Designing rubric-based or LLM-as-judge evaluation systems
  - Measuring and improving agent response quality
---

# Agentic Evaluation Patterns

Patterns for self-improvement through iterative evaluation and refinement.

## Overview

Evaluation patterns enable agents to assess and improve their own outputs, moving beyond single-shot generation to iterative refinement loops.

```
Generate → Evaluate → Critique → Refine → Output
    ↑                              │
    └──────────────────────────────┘
```

## When to Use

- **Quality-critical generation**: Code, reports, analysis requiring high accuracy
- **Tasks with clear evaluation criteria**: Defined success metrics exist
- **Content requiring specific standards**: Style guides, compliance, formatting

---

## Pattern 1: Basic Reflection

Agent evaluates and improves its own output through self-critique.

```python
import json

def reflect_and_refine(task: str, criteria: list[str], max_iterations: int = 3) -> str:
    """Generate with reflection loop."""
    output = llm(f"Complete this task:\n{task}")

    for i in range(max_iterations):
        critique = llm(f"""Evaluate against criteria: {criteria}
Output: {output}
Rate each PASS/FAIL with feedback as JSON.""")

        data = json.loads(critique)
        if all(c["status"] == "PASS" for c in data.values()):
            return output

        failed = {k: v["feedback"] for k, v in data.items() if v["status"] == "FAIL"}
        output = llm(f"Improve to address: {failed}\nOriginal: {output}")

    return output
```

---

## Pattern 2: Evaluator-Optimizer Split

Separate generation and evaluation into distinct roles:

```python
class EvaluatorOptimizer:
    def __init__(self, threshold: float = 0.8):
        self.threshold = threshold

    def generate(self, task: str) -> str:
        return llm(f"Complete: {task}")

    def evaluate(self, output: str, task: str) -> dict:
        rubric = llm(f"""Score 0-1 on: accuracy, completeness, clarity.
Task: {task}
Output: {output}
Return JSON: {{"accuracy": float, "completeness": float, "clarity": float}}""")
        return json.loads(rubric)

    def optimize(self, output: str, scores: dict, task: str) -> str:
        weak = {k: v for k, v in scores.items() if v < self.threshold}
        return llm(f"Improve these aspects: {weak}\nTask: {task}\nCurrent: {output}")

    def run(self, task: str, max_rounds: int = 3) -> tuple[str, dict]:
        output = self.generate(task)
        for _ in range(max_rounds):
            scores = self.evaluate(output, task)
            if all(v >= self.threshold for v in scores.values()):
                return output, scores
            output = self.optimize(output, scores, task)
        return output, scores
```

---

## Pattern 3: LLM-as-Judge with Rubric

Use a structured rubric for consistent evaluation:

```python
RUBRIC = {
    "correctness": "Does the output accurately solve the task? (0-1)",
    "completeness": "Are all requirements addressed? (0-1)",
    "safety": "Is the output free of harmful content? (0-1)",
    "groundedness": "Are claims supported by provided context? (0-1)",
}

def judge(output: str, context: str, rubric: dict = RUBRIC) -> dict:
    prompt = f"""You are a strict evaluator. Score each dimension 0.0 to 1.0.
Context: {context}
Output to evaluate: {output}
Rubric: {json.dumps(rubric)}
Return JSON with scores and one-line justification per dimension."""
    return json.loads(llm(prompt))
```

---

## Pattern 4: Test-Driven Agent Refinement

Agent writes code, runs tests, fixes failures in a loop:

```python
async def test_driven_refine(task: str, test_command: str, max_attempts: int = 3):
    """Agent generates code and iterates until tests pass."""
    code = await agent.generate(task)
    write_file("solution.py", code)

    for attempt in range(max_attempts):
        result = run(test_command)
        if result.returncode == 0:
            return code, {"status": "pass", "attempts": attempt + 1}

        code = await agent.generate(f"""Fix failing tests.
Errors: {result.stderr}
Current code: {code}
Task: {task}""")
        write_file("solution.py", code)

    return code, {"status": "fail", "attempts": max_attempts}
```

---

## Pattern 5: Evaluation Dataset Pipeline

Build and run evaluation suites for systematic quality tracking:

```python
import csv

def run_eval_suite(dataset_path: str, agent_fn, metrics_fn) -> dict:
    """Run agent over dataset and collect metrics."""
    results = []
    with open(dataset_path) as f:
        for row in csv.DictReader(f):
            output = agent_fn(row["input"])
            scores = metrics_fn(output, row["expected"])
            results.append({**row, "output": output, **scores})

    # Aggregate
    avg = lambda key: sum(r[key] for r in results) / len(results)
    return {
        "count": len(results),
        "avg_accuracy": avg("accuracy"),
        "avg_groundedness": avg("groundedness"),
        "pass_rate": sum(1 for r in results if r["accuracy"] >= 0.8) / len(results),
    }
```

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Structured JSON output | Reliable parsing of critique results |
| Cap iteration count | Prevent infinite refinement loops |
| Separate evaluator model | Avoid self-bias — use different model for judging |
| Log every iteration | Track improvement trajectory for debugging |
| Fail fast on safety | Block output immediately on safety score < threshold |
