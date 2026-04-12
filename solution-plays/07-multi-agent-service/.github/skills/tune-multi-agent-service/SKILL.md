---
name: tune-multi-agent-service
description: "Tune Multi-Agent Service — optimize routing rules, per-agent model selection, timeout values, context passing, cost per task. Use when: tune, optimize."
---

# Tune Multi-Agent Service

## When to Use
- Optimize supervisor routing decisions
- Tune per-agent model selection for cost vs quality
- Adjust timeout values based on observed latency
- Optimize context passing between agents
- Reduce cost per task while maintaining quality

## Tuning Dimensions

### Dimension 1: Supervisor Routing Optimization

| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| Routing model | gpt-4o | gpt-4o / gpt-4o-mini | Quality vs speed of routing |
| Max subtasks | 5 | 2-10 | More = thorough, fewer = faster |
| Parallel execution | Disabled | On/Off | Parallel = faster, sequential = more context |
| Routing temperature | 0.0 | 0.0-0.1 | Must be deterministic |
| Routing few-shot examples | 3 | 2-5 | More = better routing accuracy |

**Diagnostic**: Check routing accuracy with `python evaluation/eval.py --metrics routing`

### Dimension 2: Per-Agent Model Selection

| Agent Role | Default | Cost-Optimized | Quality-Optimized |
|-----------|---------|---------------|-------------------|
| Supervisor | gpt-4o | gpt-4o (keep) | gpt-4o (keep) |
| Researcher | gpt-4o-mini | gpt-4o-mini | gpt-4o |
| Analyst | gpt-4o | gpt-4o-mini | gpt-4o |
| Writer | gpt-4o-mini | gpt-4o-mini | gpt-4o |
| Validator | gpt-4o-mini | gpt-4o-mini | gpt-4o-mini |

**Rule**: Supervisor always uses the most capable model. Workers can be downgraded for cost.

### Dimension 3: Timeout Optimization

| Agent | Default | Min | Max | Diagnostic |
|-------|---------|-----|-----|-----------|
| Supervisor | 30s | 15s | 60s | Task decomposition time |
| Researcher | 20s | 10s | 40s | Search + retrieval time |
| Analyst | 25s | 15s | 45s | Analysis complexity |
| Writer | 15s | 8s | 30s | Content generation length |
| Validator | 10s | 5s | 20s | Validation check count |

**Optimization**: Set timeout = p95 observed latency + 20% buffer

### Dimension 4: Context Window Management

| Strategy | Context Size | Use Case |
|----------|-------------|----------|
| Full context | All prior agent outputs | Complex reasoning chains |
| Summary only | Supervisor summarizes before handoff | Long chains, token savings |
| Key-value store | Only relevant state passed | High-volume, cost-sensitive |
| Streaming | Token-by-token from prior agent | Real-time applications |

**Cost impact**: Full context can use 4x more tokens than summary-only mode.

### Dimension 5: Cost Per Task Optimization

**Baseline cost** (5-agent chain, all gpt-4o, full context):
- Supervisor: ~2000 tokens ($0.005)
- Researcher: ~3000 tokens ($0.0075)
- Analyst: ~4000 tokens ($0.01)
- Writer: ~2000 tokens ($0.005)
- Validator: ~1000 tokens ($0.0025)
- **Total: ~$0.03/task**

**Optimized** (mixed models, summary context):
- Supervisor: gpt-4o, 1500 tokens ($0.00375)
- Researcher: gpt-4o-mini, 2000 tokens ($0.0003)
- Analyst: gpt-4o-mini, 3000 tokens ($0.00045)
- Writer: gpt-4o-mini, 1500 tokens ($0.000225)
- Validator: gpt-4o-mini, 800 tokens ($0.00012)
- **Total: ~$0.005/task** (6x reduction)

## Safety Tuning

| Parameter | Default | Stricter | Looser |
|-----------|---------|---------|--------|
| Max handoffs per task | 10 | 5 | 15 |
| Max cost per task | $0.50 | $0.10 | $1.00 |
| Circuit breaker threshold | 3 failures | 2 failures | 5 failures |
| Human escalation trigger | 2 retries | 1 retry | 3 retries |

## Production Readiness Checklist
- [ ] Task completion rate ≥ 90%
- [ ] End-to-end latency < 30s at p95
- [ ] Cost per task within budget
- [ ] Loop detection tested and working
- [ ] Circuit breakers configured per agent
- [ ] Distributed tracing enabled across all agents
- [ ] Human escalation path tested
- [ ] Agent topology documented with routing rules
- [ ] Shared context store TTL configured
- [ ] Monitoring dashboards showing per-agent metrics

## Output: Tuning Report
After tuning, generate comparison:
- Task completion rate delta
- Cost per task reduction
- Latency improvement per agent
- Model routing recommendations
- Timeout adjustment recommendations
