---
name: deploy-multi-agent-swarm
description: "Deploy Multi-Agent Swarm — configure decentralized agent topology, bidding protocol, consensus voting, parallel execution, conflict resolution, swarm state store. Use when: deploy, provision swarm."
---

# Deploy Multi-Agent Swarm

## When to Use
- Deploy a decentralized multi-agent system (no single supervisor)
- Configure bidding protocol for task assignment
- Set up consensus voting for quality decisions
- Enable parallel execution with conflict resolution
- Deploy swarm state coordination (Redis/Cosmos DB)

## How Swarm Differs from Multi-Agent Service (Play 07)
| Aspect | Play 07 (Supervisor) | Play 22 (Swarm) |
|--------|---------------------|------------------|
| Coordination | Central supervisor decides | Agents bid and vote |
| Task assignment | Top-down delegation | Competitive bidding |
| Quality control | Supervisor aggregates | Consensus voting |
| Failure handling | Supervisor reassigns | Swarm self-heals |
| Scalability | Limited by supervisor | Horizontally scalable |
| Single point of failure | Supervisor is SPOF | No SPOF |

## Prerequisites
1. Azure CLI authenticated: `az account show`
2. Azure OpenAI with multiple deployments (agents need separate context)
3. Azure Service Bus (agent-to-agent pub/sub messaging)
4. Redis or Cosmos DB (swarm state coordination)
5. Container Apps (per-agent container hosting)

## Step 1: Deploy Infrastructure
```bash
az bicep lint -f infra/main.bicep
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
```

## Step 2: Configure Swarm Topology
```json
{
  "swarm": {
    "agents": [
      { "role": "researcher", "model": "gpt-4o-mini", "instances": 3 },
      { "role": "analyst", "model": "gpt-4o", "instances": 2 },
      { "role": "writer", "model": "gpt-4o-mini", "instances": 2 },
      { "role": "validator", "model": "gpt-4o-mini", "instances": 2 }
    ],
    "bidding": { "timeout_ms": 5000, "min_bids": 2 },
    "consensus": { "method": "majority_vote", "min_votes": 3, "quorum": 0.6 },
    "max_parallel": 5,
    "max_rounds": 3
  }
}
```

## Step 3: Configure Bidding Protocol
| Phase | Duration | What Happens |
|-------|----------|-------------|
| Task broadcast | 0s | Task published to all agents via Service Bus |
| Bidding window | 0-5s | Agents assess task, submit bid with confidence score |
| Selection | 5s | Top N bids selected (by confidence × past accuracy) |
| Execution | 5-30s | Selected agents execute in parallel |
| Voting | 30-35s | All agents vote on best result |
| Consensus | 35s | Majority-approved result returned |

## Step 4: Configure Consensus Mechanism
| Method | Min Agents | Use Case |
|--------|-----------|----------|
| Majority vote | 3+ | General-purpose decisions |
| Weighted vote | 3+ | Expert agents get more weight |
| Unanimous | All | Safety-critical decisions |
| First-past-threshold | 1+ | Speed-optimized (accept first good-enough) |

## Step 5: Deploy Swarm State Store
- Redis for fast in-flight state (bids, votes, partial results)
- Cosmos DB for durable history (task logs, agent performance)
- Key pattern: `swarm:{task_id}:bids`, `swarm:{task_id}:votes`

## Step 6: Post-Deployment Verification
- [ ] Agents register in swarm (visible in agent registry)
- [ ] Bidding protocol working (agents bid within timeout)
- [ ] Consensus voting producing majority-accepted results
- [ ] Parallel execution not exceeding max_parallel
- [ ] Conflict resolution handling disagreements
- [ ] Swarm self-healing when an agent fails
- [ ] Cost per swarm task tracked

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| No bids received | Agents not subscribed to topic | Check Service Bus subscriptions |
| Always same agent wins | Bidding not diverse | Rotate winners, add cooldown |
| Consensus never reached | Quorum too high (1.0) | Lower to 0.6 |
| Conflicting results | No conflict resolution | Add validator vote as tiebreaker |
| High cost | Too many agents bidding | Reduce swarm size, use fewer roles |
| Slow response | Sequential voting | Parallelize bid + vote phases |

## Architecture Diagram
```
Task → Service Bus (broadcast) → All Agents (bid) → Selection → Parallel Execution
                                                        ↓
                                             Results → Consensus Vote → Best Output
                                                        ↓
                                             Disagreement? → Extra Round or Human Escalation
```
