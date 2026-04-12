---
name: deploy-multi-agent-service
description: "Deploy Multi-Agent Service — configure supervisor pattern, agent topology, handoff protocol, shared context store, timeout policies. Use when: deploy, provision."
---

# Deploy Multi-Agent Service

## When to Use
- Deploy multi-agent orchestration infrastructure
- Configure supervisor agent and worker agent topology
- Set up handoff protocol between agents
- Configure shared context store for inter-agent state
- Deploy timeout policies and circuit breakers

## Prerequisites
1. Azure CLI authenticated: `az account show`
2. Bicep CLI: `az bicep version`
3. Azure OpenAI with multiple model deployments
4. Azure Container Apps or AKS for agent hosting
5. Azure Redis or Cosmos DB for shared state

## Step 1: Validate Infrastructure
```bash
az bicep lint -f infra/main.bicep
az bicep build -f infra/main.bicep
```
Verify resources:
- Azure OpenAI (multiple deployments: gpt-4o for supervisor, gpt-4o-mini for workers)
- Azure Container Apps (one container per agent role)
- Azure Redis Cache (shared context store, agent state)
- Azure Service Bus (agent-to-agent message queue)
- Azure Monitor (distributed tracing across agents)

## Step 2: Deploy Azure Resources
```bash
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json
```

## Step 3: Configure Agent Topology
Define the agent graph in `config/agents.json`:

| Agent Role | Model | Responsibility | Timeout |
|-----------|-------|---------------|---------|
| Supervisor | gpt-4o | Task decomposition, routing, aggregation | 30s |
| Researcher | gpt-4o-mini | Information gathering, search | 20s |
| Analyst | gpt-4o | Data analysis, reasoning | 25s |
| Writer | gpt-4o-mini | Content generation, formatting | 15s |
| Validator | gpt-4o-mini | Output validation, quality check | 10s |

## Step 4: Configure Handoff Protocol
```python
# Handoff message format between agents
handoff = {
    "from_agent": "supervisor",
    "to_agent": "researcher",
    "task": "Find recent sales data for Q4",
    "context": { "shared_state_key": "task-123" },
    "deadline": "2026-01-01T00:00:30Z",  # 30s timeout
    "retry_policy": { "max_retries": 2, "backoff": "exponential" }
}
```

## Step 5: Configure Shared Context Store
- Use Azure Redis for fast inter-agent state sharing
- Key pattern: `task:{task_id}:agent:{agent_name}:state`
- TTL: 1 hour (auto-cleanup completed tasks)
- Max context size: 4KB per agent per task

## Step 6: Configure Safety Controls
- **Loop detection**: Max 10 handoffs per task (prevent infinite delegation loops)
- **Timeout cascade**: If worker times out, supervisor retries with different worker
- **Circuit breaker**: If agent fails 3 consecutive tasks, remove from topology
- **Cost cap**: Max $0.50 per task across all agents
- **Human escalation**: After 2 failed attempts, escalate to human

## Step 7: Smoke Test
```bash
python scripts/test_topology.py --task "Summarize Q4 sales and write a report"
python scripts/test_handoff.py --from supervisor --to researcher
python scripts/test_loop_detection.py --max-hops 15  # Should trigger at 10
python scripts/test_timeout.py --agent researcher --delay 25s  # Should timeout at 20s
```

## Post-Deployment Verification
- [ ] Supervisor correctly decomposes tasks into subtasks
- [ ] Handoffs between agents complete within timeout
- [ ] Shared context store accessible by all agents
- [ ] Loop detection triggers at configured threshold
- [ ] Circuit breaker activates on repeated failures
- [ ] Distributed tracing shows full agent chain
- [ ] Cost per task within budget cap

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Agent never responds | Container not started | Check Container Apps logs |
| Infinite delegation loop | No loop detection | Set max_handoffs in config |
| Context lost between agents | Redis key expired | Increase TTL |
| Supervisor picks wrong agent | Ambiguous task description | Improve routing prompt |
| High latency (>30s) | Sequential agent chain | Enable parallel subtasks |
| Cost spike | No cost cap | Set max_cost_per_task in config |
| Partial results | Worker timeout too short | Increase per-agent timeout |
| Conflicting outputs | No conflict resolution | Add validator agent as final step |
