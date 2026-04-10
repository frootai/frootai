---
description: "Multi-Agent Service domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Multi-Agent Service — Domain Knowledge

This workspace implements a multi-agent orchestration service — multiple specialized AI agents collaborating via supervisor pattern, handoffs, and shared context.

## Multi-Agent Architecture (What the Model Gets Wrong)

### Supervisor Pattern (Not Peer-to-Peer)
```python
# WRONG — agents call each other directly (circular dependencies, no coordination)
agent_a.call(agent_b)  # Who's in charge? No oversight.

# CORRECT — supervisor orchestrates, agents report back
class Supervisor:
    def route(self, task: Task) -> Agent:
        if task.type == "research": return self.research_agent
        if task.type == "code": return self.coding_agent
        if task.type == "review": return self.review_agent
        return self.general_agent  # Fallback
    
    async def execute(self, task: Task) -> Result:
        agent = self.route(task)
        result = await agent.process(task)
        if result.needs_handoff:
            next_agent = self.route(result.handoff_task)
            result = await next_agent.process(result.handoff_task)
        return result
```

### Agent Handoff Protocol
```python
class HandoffResult(BaseModel):
    status: str  # "complete", "handoff", "escalate"
    output: Any
    handoff_to: str | None  # Target agent ID if handoff
    context: dict  # Shared context for next agent
    reasoning: str  # Why handoff is needed

# Anti-pattern: passing full conversation history (context explosion)
# Correct: pass only relevant context fields
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Peer-to-peer agent calls | No coordination, circular loops | Supervisor pattern — one orchestrator |
| Full conversation in handoff | Context overflow | Pass only relevant HandoffResult fields |
| No agent timeout | Stuck agent blocks pipeline | 30s timeout per agent, escalate on timeout |
| No shared state management | Agents duplicate work | Shared context store (Redis/Cosmos) |
| Homogeneous agents | All agents have same prompt | Specialized agents with distinct expertise |
| No conflict resolution | Agents disagree, loop forever | Supervisor makes final decision after 2 rounds |
| No observability | Can't trace agent interactions | Correlation ID through full agent chain |
| Single model for all agents | Overkill/underkill | Route: simple agents→mini, expert agents→4o |

### Agent Topology
| Pattern | When to Use | Agents |
|---------|------------|--------|
| Sequential | Linear pipeline (A→B→C) | ETL, approval workflows |
| Parallel | Independent subtasks | Research from multiple sources |
| Hierarchical | Supervisor + specialists | Customer service (intent→specialist) |
| Debate | Adversarial validation | Code review (author vs reviewer) |

## Evaluation Targets
| Metric | Target |
|--------|--------|
| Task completion rate | >= 90% |
| Avg handoffs per task | < 3 |
| Agent timeout rate | < 5% |
| Conflict resolution rate | >= 95% |
| End-to-end latency | < 10 seconds |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | per-agent model selection, temperature |
| `config/agents.json` | topology, routing rules, timeout, handoff protocol |
| `config/guardrails.json` | max handoffs, max rounds, escalation thresholds |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement agent topology, supervisor, handoff protocol |
| `@reviewer` | Audit agent interactions, loop detection, context management |
| `@tuner` | Optimize routing, model selection per agent, latency |

## Slash Commands
`/deploy` — Deploy multi-agent service | `/test` — Run integration tests | `/review` — Audit agent chain | `/evaluate` — Evaluate task completion
