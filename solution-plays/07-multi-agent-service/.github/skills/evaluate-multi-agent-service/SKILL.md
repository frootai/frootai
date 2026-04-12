---
name: evaluate-multi-agent-service
description: "Evaluate Multi-Agent Service — test task completion rate, handoff efficiency, loop detection, conflict resolution, end-to-end latency. Use when: evaluate, test."
---

# Evaluate Multi-Agent Service

## When to Use
- Evaluate multi-agent task completion quality
- Measure handoff efficiency and latency
- Test loop detection and safety controls
- Validate conflict resolution between agents
- Gate deployments with quality thresholds

## Quality Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Task completion rate | ≥ 90% | End-to-end task success tracking |
| Handoff success rate | ≥ 98% | Agent-to-agent message delivery |
| End-to-end latency | < 30 seconds | Full task timing |
| Loop detection accuracy | 100% | Intentional loop test scenarios |
| Cost per task | < $0.50 | Token usage across all agents |
| Agent utilization | > 70% | Active time vs idle time |
| Conflict resolution rate | ≥ 95% | Conflicting output reconciliation |
| Human escalation rate | < 10% | Tasks requiring human intervention |

## Step 1: Prepare Test Scenarios
Create multi-agent test cases in `evaluation/test-set.jsonl`:
```json
{"id": "ma001", "task": "Research and summarize Azure pricing changes", "expected_agents": ["researcher", "writer"], "expected_output_contains": "pricing", "max_latency_s": 30}
{"id": "ma002", "task": "Analyze sales data and create chart recommendations", "expected_agents": ["analyst", "writer"], "expected_output_contains": "chart", "max_latency_s": 25}
{"id": "ma003", "task": "Review code PR and suggest improvements", "expected_agents": ["researcher", "analyst", "validator"], "expected_output_contains": "suggestion", "max_latency_s": 30}
```
Minimum: 20 test scenarios covering different agent combinations.

## Step 2: Evaluate Task Completion
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics task_completion
```
- Track which tasks completed successfully end-to-end
- Per-agent-chain success rate (which combinations work best)
- Identify tasks that consistently fail (prompt engineering needed)
- Measure output quality (relevance, completeness, coherence)

## Step 3: Evaluate Handoff Efficiency
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics handoff
```
- Handoff latency per agent pair
- Context preservation across handoffs (is state lost?)
- Retry rate (how often do handoffs need retrying?)
- Message queue depth (backpressure detection)

## Step 4: Test Safety Controls
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics safety
```
- **Loop detection**: Submit tasks designed to cause loops
- **Timeout enforcement**: Submit slow tasks, verify timeout triggers
- **Circuit breaker**: Simulate agent failures, verify circuit opens
- **Cost cap**: Submit expensive tasks, verify cap enforcement
- **Human escalation**: Verify escalation triggers correctly

## Step 5: Evaluate Cost Efficiency
- Track token usage per agent per task
- Compare cost of multi-agent vs single-agent on same tasks
- Identify agents that consume disproportionate tokens
- Measure cache hit rate for repeated subtasks

## Step 6: Generate Quality Report
```bash
python evaluation/eval.py --all --output evaluation/report.json --ci-gate
```

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Deploy to production |
| Task completion < 85% | Improve supervisor routing prompt |
| Handoff failures > 5% | Check message queue, increase timeouts |
| Loop detection gaps | Fix max_handoffs configuration |
| Cost per task > $1.00 | Switch workers to gpt-4o-mini, add caching |
| Latency > 45s | Enable parallel subtasks, reduce agent chain |

## Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Supervisor delegates everything | Too many agent options | Reduce topology, clarify agent roles |
| Worker returns partial results | Timeout too short | Increase per-agent timeout |
| Conflicting agent outputs | No validator in chain | Add validator as final aggregation step |
| Same subtask sent twice | No dedup in supervisor | Add task ID tracking in shared state |
| Agent stuck waiting | Deadlock in handoff chain | Implement timeout + supervisor retry |
| High cost on simple tasks | Using gpt-4o for all agents | Route simple subtasks to gpt-4o-mini |

## Evaluation Cadence
- **Pre-deployment**: Full evaluation on all test scenarios
- **Weekly**: Spot-check task completion on production traffic sample
- **Monthly**: Full re-evaluation with new task scenarios
- **On topology change**: Re-evaluate when adding/removing agents
- **On model change**: Side-by-side comparison old vs new model per agent

## CI/CD Integration
```yaml
- name: Multi-Agent Quality Gate
  run: python evaluation/eval.py --all --ci-gate
```
