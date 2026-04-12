# Play 22 — Multi-Agent Swarm 🐝

> Decentralized agent teams with bidding, consensus voting, and parallel execution.

Unlike Play 07 (supervisor pattern), the swarm has no single coordinator. Agents bid for tasks competitively, execute in parallel, and vote on the best result through consensus. Self-healing: when an agent fails, the swarm redistributes work automatically.

## Quick Start
```bash
cd solution-plays/22-multi-agent-swarm
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .  # Use @builder for swarm topology, @reviewer for consensus audit, @tuner for swarm size
```

## How It Differs from Play 07 (Supervisor)
| Aspect | Play 07 (Supervisor) | Play 22 (Swarm) |
|--------|---------------------|------------------|
| Coordination | Central supervisor | Agents bid and vote |
| Task assignment | Top-down delegation | Competitive bidding |
| Quality control | Supervisor aggregates | Consensus voting |
| Failure handling | Supervisor reassigns | Self-healing |
| Single point of failure | Yes (supervisor) | No |

## Architecture
| Service | Purpose |
|---------|---------|
| Azure OpenAI (multi-deploy) | Per-agent model context |
| Azure Service Bus | Agent-to-agent pub/sub messaging |
| Redis Cache | Swarm state coordination (bids, votes) |
| Container Apps | Per-agent container hosting |

## Key Metrics
- Consensus: ≥80% · Bidding accuracy: ≥85% · Parallel speedup: ≥2x · Cost/task: <$0.15

## DevKit (Swarm-Focused)
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (swarm topology/bidding/consensus), Reviewer (vote quality/dedup), Tuner (swarm size/model mix/cost) |
| 3 skills | Deploy (106 lines), Evaluate (103 lines), Tune (102 lines) |
| 4 prompts | `/deploy` (swarm infra), `/test` (parallel execution), `/review` (consensus audit), `/evaluate` (swarm efficiency) |

## Cost
| Dev | Prod (5K tasks/day) |
|-----|---------------------|
| $150–350/mo | $4.5K–15K/mo (scales with swarm size) |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/22-multi-agent-swarm](https://frootai.dev/solution-plays/22-multi-agent-swarm)
