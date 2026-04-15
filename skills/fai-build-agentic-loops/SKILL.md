---
name: fai-build-agentic-loops
description: |
  Build agentic feedback loops with planner-critic iterations, stop conditions,
  budget-aware execution, and disk-based state. Use when implementing autonomous
  agents that iterate on their own output until quality thresholds are met.
---

# Agentic Loop Patterns

Build autonomous agent loops with planning, execution, critique, and improvement cycles.

## When to Use

- Agent needs to iterate on output until quality threshold is met
- Building plan-then-execute workflows (like Ralph Loop pattern)
- Need budget-aware execution that stops when token limit is reached
- Want fresh context per iteration to prevent drift

---

## Pattern 1: Basic Reflection Loop

```python
def agentic_loop(task: str, max_iterations: int = 4, quality_threshold: float = 0.85):
    """Generate, evaluate, improve until quality threshold or budget is met."""
    output = llm(f"Complete this task:\n{task}")
    total_tokens = 0

    for i in range(max_iterations):
        # Critique
        evaluation = llm(f"""Rate this output 0.0-1.0 on: correctness, completeness, clarity.
Task: {task}
Output: {output}
Return JSON: {{"score": float, "feedback": "string"}}""")

        result = json.loads(evaluation)
        total_tokens += count_tokens(output) + count_tokens(evaluation)

        if result["score"] >= quality_threshold:
            return {"output": output, "score": result["score"],
                    "iterations": i + 1, "tokens": total_tokens}

        # Improve
        output = llm(f"""Improve based on feedback: {result['feedback']}
Original task: {task}
Current output: {output}""")

    return {"output": output, "score": result["score"],
            "iterations": max_iterations, "tokens": total_tokens}
```

## Pattern 2: Plan-Execute-Verify (Ralph Loop)

```python
import json
from pathlib import Path

STATE_FILE = "IMPLEMENTATION_PLAN.md"

async def ralph_loop(client, max_iterations: int = 5):
    """Autonomous loop: each iteration gets fresh context from disk state."""
    for i in range(max_iterations):
        # Fresh session per iteration (prevents context drift)
        session = await client.create_session(working_directory=os.getcwd())

        # Read current state from disk
        plan = Path(STATE_FILE).read_text() if Path(STATE_FILE).exists() else "No plan yet"

        # Execute one task
        await session.send_and_wait(f"""Read {STATE_FILE}.
Pick the most important uncompleted task.
Implement it. Run tests. Update {STATE_FILE}. Commit.""", timeout=600_000)

        await session.destroy()

        # Check if all tasks are done
        plan = Path(STATE_FILE).read_text()
        if "[ ]" not in plan:
            return {"status": "complete", "iterations": i + 1}

    return {"status": "partial", "iterations": max_iterations}
```

## Pattern 3: Budget-Aware Execution

```python
class TokenBudget:
    def __init__(self, max_tokens: int = 50000):
        self.max_tokens = max_tokens
        self.used = 0

    def spend(self, tokens: int) -> bool:
        self.used += tokens
        return self.used < self.max_tokens

    @property
    def remaining(self) -> int:
        return max(0, self.max_tokens - self.used)

    @property
    def exhausted(self) -> bool:
        return self.used >= self.max_tokens

budget = TokenBudget(max_tokens=30000)

while not budget.exhausted:
    response = llm(prompt)
    if not budget.spend(response.usage.total_tokens):
        break  # Budget exceeded — stop gracefully
```

## Stop Conditions

| Condition | Check | Purpose |
|-----------|-------|---------|
| Quality met | score >= 0.85 | Task complete |
| Max iterations | i >= max_iterations | Prevent infinite loops |
| Budget exhausted | tokens >= token_budget | Cost control |
| No improvement | score_delta < 0.01 | Diminishing returns |
| Safety violation | safety_score < 0.5 | Stop unsafe generation |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Infinite loop | No stop conditions | Add max_iterations AND budget limit |
| Context drift after many iterations | Accumulated context | Use fresh session per iteration (Ralph pattern) |
| Quality plateaus | Same critique-improve cycle | Change critic model or add new evaluation dimension |
| High cost | Too many iterations with large model | Use mini for critique, 4o only for generation |
