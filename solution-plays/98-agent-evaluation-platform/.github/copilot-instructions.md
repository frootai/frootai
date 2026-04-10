---
description: "Agent Evaluation Platform domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Agent Evaluation Platform — Domain Knowledge

This workspace implements an AI agent evaluation platform — benchmarking agent capabilities, task completion scoring, multi-turn conversation quality, tool use accuracy, and safety/alignment testing across agent frameworks.

## Agent Evaluation Architecture (What the Model Gets Wrong)

### Multi-Dimensional Agent Scoring
```python
class AgentEvaluation(BaseModel):
    task_completion: float      # Did the agent complete the task? (0-1)
    accuracy: float             # Was the output correct? (0-1)
    tool_use_efficiency: float  # Optimal tool calls vs actual? (0-1)
    safety: float               # No harmful outputs? (0-1)
    latency: float              # Response time within SLA? (0-1)
    cost: float                 # Token cost reasonable? (0-1)
    conversation_quality: float # Natural, coherent, helpful? (0-1)

async def evaluate_agent(agent, test_suite: list[TestCase]) -> EvalReport:
    results = []
    for case in test_suite:
        # Run agent on test case
        output = await agent.run(case.input)
        
        # Score across dimensions
        score = AgentEvaluation(
            task_completion=check_task_completed(output, case.expected),
            accuracy=check_accuracy(output, case.ground_truth),
            tool_use_efficiency=check_tool_efficiency(output.tool_calls, case.optimal_tools),
            safety=check_safety(output),
            latency=1.0 if output.latency < case.sla_ms else 0.0,
            cost=1.0 if output.token_cost < case.cost_budget else 0.0,
            conversation_quality=await judge_conversation(output, model="gpt-4o"),
        )
        results.append(score)
    
    return EvalReport(scores=results, averages=average_scores(results))
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Accuracy only | Miss: tool efficiency, safety, cost, latency | Multi-dimensional: 7+ evaluation dimensions |
| LLM-as-judge without calibration | Judge model has its own biases | Calibrate judge with human annotations first |
| Single-turn tests only | Miss multi-turn degradation, context loss | Include 5-10 turn conversation test cases |
| No adversarial tests | Miss safety/alignment failures | Include prompt injection, jailbreak, harmful request tests |
| Same test set always | Agent overfits to known tests | Rotate test sets, add new cases monthly |
| No baseline comparison | Can't measure improvement | Compare against: previous version, human baseline, competitor agents |
| Ignore cost dimension | Agent works but costs $10/query | Track token cost per evaluation, set budget constraints |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | Judge model, evaluation model, temperature=0 |
| `config/guardrails.json` | Score thresholds per dimension, SLA targets, cost budgets |
| `config/agents.json` | Test suite definitions, baseline configs, scheduled evals |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement eval framework, test suites, scoring pipeline |
| `@reviewer` | Audit evaluation methodology, judge calibration, test coverage |
| `@tuner` | Optimize scoring weights, test case generation, baseline selection |

## Slash Commands
`/deploy` — Deploy eval platform | `/test` — Run evaluation suite | `/review` — Audit methodology | `/evaluate` — Generate eval report
