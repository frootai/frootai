---
description: "Play 07 patterns — Multi-agent patterns — supervisor routing, turn limits, token budgets, cross-agent context passing."
applyTo: "**/*.py, **/*.ts"
waf:
  - "reliability"
  - "security"
---

# Play 07 — Multi-Agent Service Patterns — FAI Standards

## Orchestration Topologies

Three patterns — pick based on task coupling:

- **Sequential pipeline**: planner → executor → critic. Each agent receives prior agent's output. Use when steps are strictly dependent
- **Parallel fan-out**: supervisor dispatches independent subtasks, aggregates results. Use for batch analysis, multi-source research
- **Supervisor loop**: supervisor routes messages, evaluates progress, reassigns on stall. Use for open-ended reasoning with guardrails

```python
# Sequential pipeline — typed message passing
from dataclasses import dataclass, field
from typing import Any

@dataclass
class AgentMessage:
    sender: str
    receiver: str
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)
    trace_id: str = ""

async def run_pipeline(task: str, agents: list, ctx: "SharedContext") -> AgentMessage:
    msg = AgentMessage(sender="user", receiver=agents[0].name, content=task, trace_id=ctx.trace_id)
    for agent in agents:
        msg = await agent.process(msg, ctx)
        ctx.history.append(msg)
        if msg.metadata.get("halt"):
            break  # Critic flagged — stop pipeline
    return msg
```

## AutoGen ConversableAgent Setup

```python
from autogen import ConversableAgent, GroupChat, GroupChatManager

def create_agent(name: str, role: str, model: str, tools: list | None = None) -> ConversableAgent:
    """Each agent gets its own system prompt, model, and tool set."""
    return ConversableAgent(
        name=name,
        system_message=ROLE_PROMPTS[role],  # Load from config/agents.json
        llm_config={
            "config_list": [{"model": model, "api_key": os.environ["AZURE_OPENAI_API_KEY"],
                             "base_url": os.environ["AZURE_OPENAI_ENDPOINT"], "api_type": "azure"}],
            "temperature": AGENT_TEMPS.get(role, 0.1),
            "max_tokens": TOKEN_BUDGETS[role],  # Per-agent budget from config
        },
        human_input_mode="NEVER",
    )

planner = create_agent("planner", "planner", "gpt-4o")
executor = create_agent("executor", "executor", "gpt-4o")
critic = create_agent("critic", "critic", "gpt-4o-mini")  # Cheaper model for review
```

## GroupChat with Speaker Selection

```python
def custom_speaker_selection(last_speaker, group_chat):
    """Deterministic routing: planner → executor → critic → planner (loop)."""
    order = {"planner": "executor", "executor": "critic", "critic": "planner"}
    next_name = order.get(last_speaker.name, "planner")
    return next((a for a in group_chat.agents if a.name == next_name), None)

group_chat = GroupChat(
    agents=[planner, executor, critic],
    messages=[],
    max_round=12,  # Hard limit — prevents runaway loops
    speaker_selection_method=custom_speaker_selection,
    allow_repeat_speaker=False,
)
manager = GroupChatManager(groupchat=group_chat, llm_config=supervisor_llm_config)
```

## Tool Registration Per Agent

Least-privilege: each agent only sees tools it needs.

```python
# Planner gets read-only tools; executor gets write tools; critic gets none
from autogen import register_function

register_function(search_knowledge_base, caller=planner, executor=executor,
                  description="Search indexed documents. Read-only.")
register_function(execute_sql_query, caller=executor, executor=executor,
                  description="Run parameterized SQL. Write-capable.")
register_function(send_notification, caller=executor, executor=executor,
                  description="Send user notification via Service Bus.")
# Critic has NO tools — pure LLM reasoning to evaluate outputs
```

## Shared Context and Memory

```python
@dataclass
class SharedContext:
    trace_id: str
    session_id: str
    history: list[AgentMessage] = field(default_factory=list)
    scratchpad: dict[str, Any] = field(default_factory=dict)
    token_usage: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock, repr=False)

    async def write(self, key: str, value: Any, agent: str) -> None:
        async with self._lock:
            self.scratchpad[key] = {"value": value, "author": agent, "ts": time.time()}

    def budget_remaining(self, agent: str, budget: int) -> int:
        return max(0, budget - self.token_usage.get(agent, 0))
```

## Conflict Resolution

```python
async def resolve_conflict(responses: list[AgentMessage], strategy: str = "vote") -> AgentMessage:
    """When agents disagree on a result."""
    if strategy == "vote":
        # Majority wins — each agent scores alternatives
        scores = defaultdict(int)
        for r in responses:
            scores[r.content] += 1
        winner = max(scores, key=scores.get)
        return AgentMessage(sender="resolver", receiver="user", content=winner,
                            metadata={"strategy": "vote", "votes": dict(scores)})
    elif strategy == "supervisor":
        # Supervisor agent makes final call given all perspectives
        combined = "\n---\n".join(f"[{r.sender}]: {r.content}" for r in responses)
        return await supervisor.process(
            AgentMessage(sender="resolver", receiver="supervisor", content=combined,
                         metadata={"task": "resolve_conflict"}), ctx)
    raise ValueError(f"Unknown strategy: {strategy}")
```

## Token Budget Distribution

```python
# config/agents.json — per-agent token budgets
TOKEN_BUDGETS = {"planner": 2000, "executor": 4000, "critic": 1000}
TOTAL_SESSION_BUDGET = 15000  # Hard ceiling per user session

async def guarded_call(agent, msg, ctx):
    remaining = ctx.budget_remaining(agent.name, TOKEN_BUDGETS[agent.name])
    if remaining <= 0:
        raise TokenBudgetExceeded(agent.name)
    result = await agent.process(msg, ctx)
    usage = result.metadata.get("token_usage", 0)
    ctx.token_usage[agent.name] += usage
    if sum(ctx.token_usage.values()) > TOTAL_SESSION_BUDGET:
        raise SessionBudgetExceeded(ctx.session_id)
    return result
```

## Error Isolation

One agent crashing must not kill the session.

```python
async def safe_agent_step(agent, msg: AgentMessage, ctx: SharedContext) -> AgentMessage:
    try:
        return await asyncio.wait_for(guarded_call(agent, msg, ctx), timeout=30.0)
    except asyncio.TimeoutError:
        logger.warning("agent_timeout", extra={"agent": agent.name, "trace_id": ctx.trace_id})
        return AgentMessage(sender=agent.name, receiver=msg.sender, content="",
                            metadata={"error": "timeout", "skipped": True})
    except TokenBudgetExceeded:
        logger.warning("budget_exceeded", extra={"agent": agent.name, "trace_id": ctx.trace_id})
        return AgentMessage(sender=agent.name, receiver="supervisor",
                            content="Budget exceeded — requesting summarized handoff",
                            metadata={"error": "budget_exceeded"})
    except Exception as e:
        logger.exception("agent_failure", extra={"agent": agent.name, "trace_id": ctx.trace_id})
        return AgentMessage(sender=agent.name, receiver="supervisor", content="",
                            metadata={"error": str(e), "failed": True})
```

## Observability — Per-Agent Tracing

```python
from opentelemetry import trace

tracer = trace.get_tracer("play07.multi_agent")

async def traced_step(agent, msg, ctx):
    with tracer.start_as_current_span(f"agent.{agent.name}",
            attributes={"agent.role": agent.name, "trace_id": ctx.trace_id,
                         "session_id": ctx.session_id, "input_len": len(msg.content)}) as span:
        result = await safe_agent_step(agent, msg, ctx)
        span.set_attribute("output_len", len(result.content))
        span.set_attribute("tokens_used", result.metadata.get("token_usage", 0))
        span.set_attribute("error", result.metadata.get("error", ""))
        return result
```

## Human-in-the-Loop Checkpoints

```python
CHECKPOINT_ROLES = {"executor"}  # Require approval before executor writes

async def checkpoint_gate(agent, msg: AgentMessage, ctx: SharedContext) -> AgentMessage:
    if agent.name not in CHECKPOINT_ROLES:
        return await traced_step(agent, msg, ctx)
    if msg.metadata.get("approved"):
        return await traced_step(agent, msg, ctx)
    # Queue for human review — return pending status
    review_id = await review_queue.submit(agent.name, msg, ctx.session_id)
    return AgentMessage(sender=agent.name, receiver="user",
                        content=f"Action requires approval. Review ID: {review_id}",
                        metadata={"pending_review": review_id, "halt": True})
```

## Anti-Patterns

- ❌ All agents sharing one system prompt — eliminates specialization benefit
- ❌ No max_round limit on GroupChat — agents loop forever burning tokens
- ❌ Giving every agent every tool — violates least privilege, causes tool confusion
- ❌ Shared mutable state without locks — race conditions in parallel fan-out
- ❌ Single try/except around entire pipeline — one agent failure kills the session
- ❌ No per-agent token budget — one verbose agent consumes the entire session allowance
- ❌ Logging full inter-agent messages without PII redaction
- ❌ Hardcoded speaker selection order — can't adapt to task requirements

## WAF Alignment

| Pillar | Multi-Agent Implementation |
|---|---|
| **Reliability** | Error isolation per agent, 30s timeout, circuit breaker on tool calls, graceful degradation when agent fails |
| **Security** | Per-agent tool scoping (least privilege), Content Safety on all user-facing outputs, PII redaction in agent traces |
| **Cost Optimization** | Per-agent token budgets from config, session ceiling at 15K tokens, gpt-4o-mini for critic/review roles |
| **Operational Excellence** | OpenTelemetry span per agent step, structured logging with trace_id/session_id, agent-level metrics dashboards |
| **Performance Efficiency** | Parallel fan-out for independent subtasks, async tool execution, supervisor short-circuits on early success |
| **Responsible AI** | Human-in-the-loop checkpoints before write actions, conflict resolution with audit trail, supervisor override logging |
