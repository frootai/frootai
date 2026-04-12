---
name: tune-multi-agent-swarm
description: "Tune Multi-Agent Swarm — optimize swarm size, bidding strategy, voting thresholds, agent model selection, parallel execution limits, cost per task. Use when: tune, optimize swarm."
---

# Tune Multi-Agent Swarm

## When to Use
- Optimize swarm size (number of agents per role)
- Tune bidding strategy (timeout, scoring, cooldown)
- Adjust voting thresholds for consensus quality
- Configure per-role model selection for cost
- Balance parallel execution vs cost

## Tuning Dimensions

### Dimension 1: Swarm Size Optimization

| Size | Agents | Quality | Cost | Latency | Best For |
|------|--------|---------|------|---------|---------|
| Minimal | 3 | Good | Low | Fast | Simple tasks |
| Standard | 5-7 | High | Medium | Medium | General-purpose |
| Large | 10+ | Highest | High | Slower | Complex, reliability-critical |

**Rule**: Start with 3 agents. Add more only if consensus quality < 80%.
Each additional agent costs ~$0.02-$0.05 per task in token usage.

### Dimension 2: Bidding Strategy

| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| Bid timeout | 5s | 2-10s | Shorter = faster, may miss good bids |
| Min bids required | 2 | 1-5 | More = better selection, slower |
| Scoring formula | confidence × accuracy | Custom | Weight past performance |
| Winner cooldown | None | 0-3 tasks | Prevents monopolization |
| Bid diversity bonus | None | 0-20% | Encourage different approaches |

### Dimension 3: Consensus Voting

| Method | Quorum | Quality | Speed | Cost |
|--------|--------|---------|-------|------|
| First-past-threshold | 1 vote > 0.9 | Medium | Fastest | Lowest |
| Majority vote | 50%+1 | High | Medium | Medium |
| Supermajority | 67%+1 | Very High | Slower | Higher |
| Weighted expert vote | N/A | Highest | Medium | Medium |

**Tuning**: Start majority. If quality insufficient → weighted expert. If cost too high → first-past-threshold.

### Dimension 4: Per-Role Model Selection

| Role | Default | Cost-Optimized | Quality-Optimized |
|------|---------|---------------|------------------|
| Researcher | gpt-4o-mini | gpt-4o-mini | gpt-4o |
| Analyst | gpt-4o | gpt-4o-mini | gpt-4o |
| Writer | gpt-4o-mini | gpt-4o-mini | gpt-4o |
| Validator | gpt-4o-mini | gpt-4o-mini | gpt-4o-mini |

**Cost impact**: All gpt-4o (~$0.15/task) vs mixed (~$0.05/task) = 3x savings.

### Dimension 5: Cost Per Swarm Task

| Component | 3-Agent Swarm | 7-Agent Swarm |
|-----------|-------------|-------------|
| Bidding (all agents evaluate) | $0.01 | $0.025 |
| Execution (winners only) | $0.03 | $0.05 |
| Voting (all agents) | $0.01 | $0.025 |
| State coordination | $0.001 | $0.001 |
| **Total** | **~$0.05** | **~$0.10** |

**Monthly estimate** (5K tasks/day):
- 3-agent swarm: ~$7,500/mo
- 7-agent swarm: ~$15,000/mo
- With gpt-4o-mini for most roles: reduce by ~60%

## Production Readiness Checklist
- [ ] Consensus agreement rate ≥ 80%
- [ ] Bidding assigns correct role ≥ 85%
- [ ] Parallel speedup ≥ 2x vs single agent
- [ ] Cost per task within budget
- [ ] Self-healing tested (agent failure recovery)
- [ ] Deduplication < 5% (no redundant work)
- [ ] Vote convergence ≤ 2 rounds
- [ ] Max parallel agents limit enforced
- [ ] Service Bus throughput sufficient for swarm size

## Output: Tuning Report
After tuning, compare:
- Swarm size vs quality trade-off
- Bidding accuracy improvement
- Consensus rate change
- Cost per task reduction
- Parallel speedup achieved

## Tuning Playbook (Step-by-Step)
1. **Baseline**: Run 30 tasks with default settings, record all metrics
2. **Right-size**: If consensus already >90%, try fewer agents (cost savings)
3. **Model mix**: Switch non-critical roles to gpt-4o-mini, re-evaluate quality
4. **Voting**: If consensus <80%, try weighted expert voting
5. **Bidding**: If wrong agent wins >15%, add task type classifier
6. **Parallel**: If no speedup, check Service Bus throughput bottleneck
7. **Cost**: Calculate cost per quality point — optimize the ratio
8. **Re-baseline**: Run same 30 tasks, compare all metrics before/after
