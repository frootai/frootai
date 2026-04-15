---
name: fai-tune-07-multi-agent-service
description: "Tune Play 07 (Multi-Agent Service) agent orchestration, handoff rules, model routing, and inter-agent communication config."
---

# FAI Tune — Play 07: Multi-Agent Service

## TuneKit Configuration Files

```
solution-plays/07-multi-agent-service/config/
├── orchestration.json    # Agent routing and handoff rules
├── agents.json           # Per-agent model and behavior config
├── communication.json    # Inter-agent message passing
└── guardrails.json       # Quality and safety thresholds
```

## Step 1 — Validate Agent Orchestration Config

```json
// config/orchestration.json
{
  "topology": "supervisor",
  "supervisor_model": "gpt-4o",
  "supervisor_temperature": 0.3,
  "max_agent_turns": 10,
  "max_total_tokens": 32000,
  "handoff_strategy": "explicit",
  "conflict_resolution": "supervisor_decides",
  "parallel_execution": false,
  "timeout_per_agent_seconds": 60
}
```

**Topology options:**

| Topology | Description | When to Use |
|----------|-------------|-------------|
| `supervisor` | Central agent delegates to specialists | Most use cases — predictable routing |
| `round-robin` | Agents take turns sequentially | Pipeline processing (A→B→C) |
| `swarm` | Agents self-organize via handoffs | Complex, emergent workflows |
| `hierarchical` | Multi-level supervisor tree | Enterprise with team boundaries |

## Step 2 — Configure Per-Agent Models

```json
// config/agents.json
{
  "agents": [
    {
      "name": "researcher",
      "model": "gpt-4o",
      "temperature": 0.7,
      "max_tokens": 4096,
      "tools": ["web_search", "code_search"],
      "system_prompt_file": "prompts/researcher.md"
    },
    {
      "name": "coder",
      "model": "gpt-4o",
      "temperature": 0.2,
      "max_tokens": 8192,
      "tools": ["code_interpreter", "file_write"],
      "system_prompt_file": "prompts/coder.md"
    },
    {
      "name": "reviewer",
      "model": "gpt-4o-mini",
      "temperature": 0.0,
      "max_tokens": 2048,
      "tools": ["code_analysis"],
      "system_prompt_file": "prompts/reviewer.md"
    }
  ]
}
```

**Tuning checklist:**

| Parameter | Range | Default | Guidance |
|-----------|-------|---------|----------|
| Supervisor `temperature` | 0.0-0.5 | 0.3 | Lower = more predictable routing |
| `max_agent_turns` | 3-20 | 10 | Higher for complex multi-step tasks |
| `max_total_tokens` | 8K-128K | 32K | Budget across all agents combined |
| Reviewer `temperature` | 0.0 | 0.0 | Must be deterministic for reviews |

## Step 3 — Set Inter-Agent Communication

```json
// config/communication.json
{
  "message_format": "structured",
  "include_reasoning": true,
  "context_window_sharing": "summary",
  "max_context_per_handoff": 4096,
  "handoff_metadata": ["task_id", "priority", "attempt_count"],
  "dead_letter_handling": "escalate_to_supervisor"
}
```

## Step 4 — Set Guardrails

```json
// config/guardrails.json
{
  "quality": {
    "groundedness": 0.85,
    "task_completion_rate": 0.90,
    "inter_agent_agreement": 0.80
  },
  "safety": {
    "content_safety": "medium",
    "tool_execution_sandbox": true,
    "max_file_writes_per_session": 20,
    "blocked_tools_in_production": ["shell_exec"]
  },
  "cost": {
    "max_tokens_per_session": 50000,
    "prefer_mini_for_routing": true,
    "cache_agent_responses": true
  }
}
```

## Step 5 — Run Multi-Agent Evaluation

```python
import json

def evaluate_multi_agent(test_cases, config):
    results = {"task_completion": 0, "avg_turns": 0, "total_tokens": 0}
    for case in test_cases:
        outcome = run_multi_agent_session(case, config)
        results["task_completion"] += 1 if outcome["completed"] else 0
        results["avg_turns"] += outcome["turns"]
        results["total_tokens"] += outcome["tokens_used"]

    n = len(test_cases)
    results["task_completion"] /= n
    results["avg_turns"] /= n
    print(f"Task completion: {results['task_completion']:.1%}")
    print(f"Avg turns: {results['avg_turns']:.1f}")
    print(f"Total tokens: {results['total_tokens']:,}")
    return results
```

## Validation Checklist

| Check | Expected | Command |
|-------|----------|---------|
| Topology | supervisor or swarm | `jq '.topology' config/orchestration.json` |
| Max turns | 3-20 | `jq '.max_agent_turns' config/orchestration.json` |
| Sandbox enabled | true | `jq '.safety.tool_execution_sandbox' config/guardrails.json` |
| Token budget | <=50K/session | `jq '.cost.max_tokens_per_session' config/guardrails.json` |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Infinite agent loops | No turn limit | Set `max_agent_turns: 10` |
| High costs | All agents using gpt-4o | Use gpt-4o-mini for reviewer/router |
| Agent deadlock | Circular handoffs | Switch to `supervisor` topology |
| Context lost between agents | Window too small | Increase `max_context_per_handoff` |
