---
description: "Play 22 patterns — Swarm patterns — supervisor delegation, specialist budgets, turn management, result synthesis."
applyTo: "**/*.py, **/*.ts"
waf:
  - "reliability"
  - "security"
---

# Play 22 — Swarm Orchestration Patterns — FAI Standards

## Swarm Topology Selection

Choose topology based on coordination complexity and agent autonomy:
- **Mesh** — every agent communicates with every other. Use only for ≤5 agents; O(n²) message overhead
- **Hub-spoke** — supervisor fans out to specialists, collects results. Default for Play 22
- **Hierarchical** — multi-level supervisors delegate sub-tasks to team leads. Use for 20+ agents

```python
from enum import Enum
from dataclasses import dataclass, field

class Topology(Enum):
    MESH = "mesh"           # All-to-all, ≤5 agents
    HUB_SPOKE = "hub-spoke" # Supervisor + specialists
    HIERARCHICAL = "hier"   # Tree of supervisors

@dataclass
class SwarmConfig:
    topology: Topology
    max_agents: int
    total_token_budget: int           # Shared across swarm
    load_shed_threshold: float = 0.85 # Drop low-priority at 85% capacity
    health_interval_sec: int = 30
    consensus_quorum: float = 0.6     # 60% agreement for voting

SWARM = SwarmConfig(
    topology=Topology.HUB_SPOKE,
    max_agents=12,
    total_token_budget=500_000,
)
```

## Agent Discovery and Registration

Every agent registers with a capability manifest. The registry enables dynamic routing.

```python
import uuid, time
from typing import Callable

@dataclass
class AgentRecord:
    agent_id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    role: str = ""
    capabilities: list[str] = field(default_factory=list)
    token_budget: int = 0
    tokens_used: int = 0
    status: str = "idle"             # idle | busy | draining | dead
    last_heartbeat: float = field(default_factory=time.time)

class AgentRegistry:
    def __init__(self) -> None:
        self._agents: dict[str, AgentRecord] = {}

    def register(self, role: str, capabilities: list[str], budget: int) -> str:
        rec = AgentRecord(role=role, capabilities=capabilities, token_budget=budget)
        self._agents[rec.agent_id] = rec
        return rec.agent_id

    def discover(self, capability: str) -> list[AgentRecord]:
        """Find alive agents with a given capability, sorted by remaining budget."""
        now = time.time()
        return sorted(
            [a for a in self._agents.values()
             if capability in a.capabilities
             and a.status != "dead"
             and now - a.last_heartbeat < 90],
            key=lambda a: a.token_budget - a.tokens_used, reverse=True,
        )

    def retire(self, agent_id: str) -> None:
        if rec := self._agents.get(agent_id):
            rec.status = "draining"
```

## Message Routing

Route tasks based on topic tags or content inspection. Never broadcast to all agents.

```python
@dataclass
class SwarmMessage:
    task_id: str
    topic: str               # e.g. "code-review", "research", "synthesis"
    payload: dict
    priority: int = 1        # 0=critical, 1=normal, 2=background
    max_tokens: int = 10_000

def route_message(msg: SwarmMessage, registry: AgentRegistry) -> str | None:
    """Topic-based routing with fallback to content-based capability match."""
    # 1. Topic-based: direct match on topic → capability
    candidates = registry.discover(msg.topic)
    if not candidates:
        # 2. Content-based: inspect payload keywords for capability match
        for kw in extract_keywords(msg.payload):
            candidates = registry.discover(kw)
            if candidates:
                break
    if not candidates:
        return None  # Dead-letter — no capable agent found
    # Pick agent with most remaining budget
    chosen = candidates[0]
    chosen.status = "busy"
    return chosen.agent_id
```

## Distributed State and Conflict Resolution

Shared state lives in a central store (Redis / Cosmos DB). When agents produce conflicting results:

- **Consensus** — all agents vote, accept result with ≥ `consensus_quorum` agreement
- **Priority** — highest-authority agent wins (supervisor > specialist)
- **Voting with tie-break** — majority vote; ties broken by the agent that used fewer tokens

```python
def resolve_conflict(results: list[dict], config: SwarmConfig) -> dict:
    """Majority-vote conflict resolution with token-efficiency tie-break."""
    from collections import Counter
    votes = Counter(r["answer"] for r in results)
    top_answer, top_count = votes.most_common(1)[0]
    quorum_met = top_count / len(results) >= config.consensus_quorum
    if quorum_met:
        return {"answer": top_answer, "confidence": top_count / len(results)}
    # Tie-break: prefer the result from the agent that used fewest tokens
    return min(results, key=lambda r: r["tokens_used"])
```

## Load Shedding

When swarm utilization exceeds `load_shed_threshold`, drop lowest-priority tasks first.

```python
def should_shed(queue: list[SwarmMessage], config: SwarmConfig, active: int) -> list[SwarmMessage]:
    utilization = active / config.max_agents
    if utilization < config.load_shed_threshold:
        return queue
    # Keep only priority 0-1 tasks; drop priority 2 (background)
    kept = [m for m in queue if m.priority <= 1]
    shed_count = len(queue) - len(kept)
    if shed_count:
        logger.warning("load_shed", extra={"dropped": shed_count, "utilization": utilization})
    return kept
```

## Token Budget Distribution

Distribute the total budget proportionally. Supervisors get a coordination tax; specialists split the rest by expected workload.

```python
def allocate_budgets(total: int, agents: list[AgentRecord]) -> None:
    supervisors = [a for a in agents if a.role == "supervisor"]
    specialists = [a for a in agents if a.role != "supervisor"]
    supervisor_share = int(total * 0.15)  # 15% coordination overhead
    specialist_pool = total - supervisor_share
    for s in supervisors:
        s.token_budget = supervisor_share // max(len(supervisors), 1)
    for s in specialists:
        s.token_budget = specialist_pool // max(len(specialists), 1)
```

## Agent Lifecycle: Spawn, Health Check, Retire

```python
async def lifecycle_loop(registry: AgentRegistry, config: SwarmConfig) -> None:
    while True:
        for agent_id, rec in list(registry._agents.items()):
            elapsed = time.time() - rec.last_heartbeat
            if elapsed > config.health_interval_sec * 3:
                rec.status = "dead"
                reassign_tasks(agent_id, registry)   # Fault tolerance
                logger.error("agent_dead", extra={"agent_id": agent_id})
            elif rec.tokens_used >= rec.token_budget:
                registry.retire(agent_id)            # Budget exhausted
        # Scale-out: spawn if queue depth > 2× active agents
        if pending_tasks() > 2 * active_count(registry) and active_count(registry) < config.max_agents:
            spawn_specialist(registry, config)
        await asyncio.sleep(config.health_interval_sec)
```

## Observability

Emit one trace span per agent per task. Aggregate at the swarm level.

- **Per-agent**: `agent_id`, `task_id`, `tokens_in`, `tokens_out`, `latency_ms`, `status`
- **Aggregate**: `swarm_utilization`, `tasks_completed`, `tasks_shed`, `conflict_count`, `p95_latency`
- Correlation: propagate `swarm_run_id` through all agent spans for end-to-end trace
- Alert on: agent death rate > 10%, utilization > 95% for 5 min, conflict rate > 30%

## Scale-Out: Dynamic Agent Pool

Unlike fixed multi-agent (static team, pre-assigned roles), swarm scales agents on demand:
- **Fixed multi-agent** — 3-5 agents, each with hardcoded role. Simple but can't handle load spikes
- **Dynamic swarm** — registry-based, spawn/retire by backpressure. Higher infra cost but elastic
- Rule: start with fixed multi-agent (Play 07). Graduate to swarm when task volume is unpredictable or agent specialization changes per request

## Anti-Patterns

- ❌ Mesh topology with >5 agents — message explosion, O(n²) routing, impossible to debug
- ❌ Broadcasting every message to all agents — wastes tokens, creates conflicts
- ❌ No token budget per agent — one runaway agent burns the entire swarm budget
- ❌ Polling-only health checks with no timeout — dead agents hold tasks indefinitely
- ❌ Synchronous fan-out — supervisor blocks until slowest agent finishes; use async gather
- ❌ No load shedding — queue grows unbounded, latency degrades for all tasks
- ❌ Spawning agents without a cap — runaway scaling eats all compute and token budget
- ❌ Single point of failure supervisor with no failover — entire swarm dies if supervisor crashes

## WAF Alignment

| Pillar | Swarm-Specific Pattern |
|---|---|
| **Reliability** | Agent restart + task reassignment on heartbeat timeout. Consensus quorum prevents single-agent failures from corrupting results. Drain before retire. |
| **Security** | Each agent gets scoped credentials (least privilege). Supervisor validates agent outputs before synthesis. Content Safety on all user-facing final answers. |
| **Cost Optimization** | Token budget caps per agent. Load shedding drops background tasks. Right-size agent pool — scale down idle specialists. Track tokens_used per agent in telemetry. |
| **Operational Excellence** | Per-agent trace spans with `swarm_run_id` correlation. Alert on death rate, utilization, conflict rate. Registry enables zero-downtime agent upgrades. |
| **Performance Efficiency** | Async fan-out for parallel specialist execution. Topic-based routing avoids unnecessary agent invocations. Dynamic pool scales with demand, not peak. |
| **Responsible AI** | Voting/consensus reduces single-agent hallucination risk. Supervisor reviews before final output. Audit trail of which agent produced which claim. |
