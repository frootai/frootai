---
name: evaluate-multi-agent-swarm
description: "Evaluate Multi-Agent Swarm — measure consensus quality, bidding efficiency, vote agreement rate, parallel speedup, cost per swarm task. Use when: evaluate, benchmark swarm."
---

# Evaluate Multi-Agent Swarm

## When to Use
- Evaluate consensus quality (do votes converge on correct answer?)
- Measure bidding efficiency (right agent selected for right task?)
- Assess parallel speedup vs sequential execution
- Track cost per swarm task (agents × tokens × rounds)
- Gate deployments with swarm quality thresholds

## Swarm Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Consensus agreement rate | ≥ 80% | Votes agreeing / total votes |
| Task quality (winner) | ≥ 4.0/5.0 | Human eval of consensus output |
| Bidding accuracy | ≥ 85% | Best agent wins bid for task type |
| Parallel speedup | ≥ 2x vs sequential | Swarm time / single-agent time |
| Vote convergence rounds | ≤ 2 | Rounds to reach quorum |
| Cost per swarm task | < $0.15 | Tokens across all agents × rounds |
| Agent utilization | ≥ 60% | Active time / total time |
| Self-healing success | 100% | Task completes when agent fails |
| Deduplication rate | < 5% | Duplicate work across agents |

## Step 1: Prepare Swarm Test Set
```json
{"task": "Research and summarize cloud pricing trends", "type": "research", "expected_agents": 3, "expected_quality": 4}
{"task": "Analyze dataset and identify outliers", "type": "analysis", "expected_agents": 2, "expected_quality": 4}
{"task": "Write technical blog post on AI governance", "type": "writing", "expected_agents": 2, "expected_quality": 4}
```
Minimum: 30 tasks spanning different complexity levels and agent roles.

## Step 2: Evaluate Consensus Quality
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics consensus
```
- Compare consensus output vs individual agent outputs
- Is the consensus better than the best individual? (swarm advantage)
- Track disagreement patterns (which task types cause most conflict)

## Step 3: Evaluate Bidding Efficiency
- Did the right agents win bids for their specialty?
- Track: agent role vs task type matrix
- Measure: bid accuracy = correct role won / total bids
- Flag: tasks where non-specialist won (routing issue)

## Step 4: Compare Swarm vs Single Agent
| Metric | Single Agent | Swarm (3 agents) | Delta |
|--------|-------------|------------------|-------|
| Quality | Measure | Measure | Swarm advantage |
| Latency | Measure | Measure | Parallel speedup |
| Cost | Measure | Measure | Cost overhead |
| Reliability | Measure | Measure | Fault tolerance |

## Step 5: Test Self-Healing
- Kill one agent mid-task → verify swarm redistributes work
- Introduce slow agent → verify timeout and reassignment
- All agents disagree → verify fallback (human escalation or majority)

## Step 6: Generate Report
```bash
python evaluation/eval.py --all --output evaluation/report.json --ci-gate
```

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Deploy swarm to production |
| Consensus < 70% | Improve agent prompts, add validation round |
| Bidding wrong agent | Refine bid scoring, add task type classifier |
| Cost > $0.30/task | Reduce swarm size, use gpt-4o-mini for more agents |
| No parallel speedup | Check Service Bus throughput, reduce bidding timeout |

## Evaluation Cadence
- **Pre-deployment**: Full swarm evaluation on 30+ tasks
- **Weekly**: Consensus rate, bidding accuracy, cost tracking
- **Monthly**: Compare swarm vs single-agent on same tasks
- **On topology change**: Re-evaluate when adding/removing agent roles

## Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Always same output | One agent dominates votes | Add bid diversity bonus |
| Low consensus rate | Agents interpret task differently | Standardize task prompts |
| Swarm slower than single agent | Bidding overhead | Reduce bid timeout, fewer agents |
| Duplicate work | No dedup check | Add result hashing before voting |
| Cost runaway | Too many voting rounds | Set max_rounds=2, lower quorum |
| Agent never wins bids | Low confidence score | Retrain or replace underperforming agent |

## CI/CD Integration
```yaml
- name: Swarm Consensus Gate
  run: python evaluation/eval.py --metrics consensus --ci-gate --threshold 0.80
- name: Swarm Cost Gate
  run: python evaluation/eval.py --metrics cost --ci-gate --max-cost 0.15
- name: Self-Healing Test
  run: python evaluation/test_self_healing.py --kill-agent researcher --verify-completion
```
