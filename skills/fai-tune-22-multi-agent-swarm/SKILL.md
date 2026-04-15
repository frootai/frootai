---
name: fai-tune-22-multi-agent-swarm
description: "Tune Play 22 swarm behavior with role assignment, consensus thresholds, conflict policy, and budget controls."
---

# FAI Tune - Play 22: Multi-Agent Swarm

## TuneKit Config Layout

solution-plays/22-multi-agent-swarm/config/
├── swarm.json
├── roles.json
├── consensus.json
└── safety.json

## Step 1 - Validate Core Configuration

```json
// config/consensus.json
{
  "strategy": "weighted_vote",
  "min_agents": 3,
  "max_agents": 12,
  "consensus_threshold": 0.67,
  "tie_breaker": "leader_agent",
  "max_rounds": 5
}
```

## Step 2 - Tune Critical Parameters

| Parameter | Range | Default | Guidance |
|-----------|-------|---------|----------|
| `consensus_threshold` | 0.50-0.95 | 0.67 | Higher confidence, slower convergence. |
| `max_agents` | 2-30 | 12 | More agents increase cost and latency. |
| `max_rounds` | 1-20 | 5 | Limit to avoid endless debate loops. |
| `leader_weight` | 1.0-5.0 | 2.0 | Bias toward orchestration lead. |

## Step 3 - Add Evaluation Gates

```json
{
  "evaluation": {
    "enabled": true,
    "dataset": "evaluation/test-cases.jsonl",
    "sample_size": 200,
    "gates": {
      "quality_min": 0.80,
      "safety_min": 0.90,
      "latency_p95_ms_max": 2000
    }
  }
}
```

```python
import json

def validate_gate(metrics, gates):
    failures = []
    if metrics.get("quality", 0) < gates["quality_min"]:
        failures.append("quality")
    if metrics.get("safety", 0) < gates["safety_min"]:
        failures.append("safety")
    if metrics.get("latency_p95_ms", 999999) > gates["latency_p95_ms_max"]:
        failures.append("latency")
    if failures:
        raise SystemExit(f"Gate failed: {', '.join(failures)}")
    print("PASS: all gates met")
```

## Step 4 - Add Cost Controls

```json
{
  "cost_controls": {
    "daily_budget_usd": 500,
    "monthly_budget_usd": 10000,
    "alert_thresholds": [50, 75, 90],
    "throttle_on_budget_breach": true
  }
}
```

## Validation Checklist

| Check | Expected | Command |
|-------|----------|---------|
| Consensus threshold | 0.50-0.95 | `jq '.consensus_threshold' config/consensus.json` |
| Max rounds | <= 20 | `jq '.max_rounds' config/consensus.json` |
| Agent bounds | min <= max | `jq '.min_agents <= .max_agents' config/consensus.json` |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| No convergence | Threshold too high | Lower consensus_threshold by 0.05. |
| Excessive costs | Too many agents/rounds | Reduce max_agents and max_rounds. |
| Conflicting outputs | Role overlap | Clarify roles.json boundaries and tie-breaker. |

## Rollback Plan

1. Restore previous config from git tag.
2. Revert model or routing changes first.
3. Re-run evaluation gate on rollback commit.
4. Promote rollback only if safety and quality gates pass.
