---
description: "Agent coding standards — ReAct loop, tool selection, memory management, circuit breaker on tools."
applyTo: "**/*.py, **/*.ts, **/*.cs"
waf:
  - "reliability"
  - "security"
---

# Agent Coding Patterns — FAI Standards

## ReAct Loop Implementation

Every agent MUST use a bounded Reason → Act → Observe loop. Never recurse — iterate.

```python
async def react_loop(agent: Agent, task: str, max_steps: int = 15) -> AgentResult:
    memory = ConversationMemory(max_tokens=agent.token_budget)
    memory.add("system", agent.system_prompt)
    memory.add("user", task)

    for step in range(max_steps):
        with tracer.start_span(f"agent.step.{step}") as span:
            response = await llm.chat(memory.messages, response_format=AgentAction)
            span.set_attribute("tokens_used", response.usage.total_tokens)

            if response.parsed.action == "final_answer":
                return AgentResult(answer=response.parsed.argument, steps=step + 1)

            observation = await execute_tool(response.parsed.tool, response.parsed.argument)
            memory.add("assistant", response.parsed.model_dump_json())
            memory.add("tool", observation, name=response.parsed.tool)

    raise MaxIterationsExceeded(f"Agent failed to converge in {max_steps} steps")
```

- Hard cap `max_steps` from config — default 15, never exceed 30
- Log every step with span: tool name, latency, token delta, observation length
- Return step count in result for cost attribution

## Structured Output for Tool Calls

Force structured output — never parse free-text tool invocations.

```python
class AgentAction(BaseModel):
    thought: str = Field(description="Reasoning about what to do next")
    action: Literal["search", "calculate", "lookup", "final_answer"]
    argument: str = Field(description="Input to the selected tool")
    confidence: float = Field(ge=0, le=1, description="Confidence in this action")
```

- Use `response_format=AgentAction` or `tool_choice="required"` — never regex parsing
- Validate tool name against registered tool registry before execution
- Reject unknown tools with observation: `"Error: tool '{name}' not registered"`

## Tool Selection and Execution

```python
TOOL_REGISTRY: dict[str, Tool] = {}

async def execute_tool(name: str, argument: str) -> str:
    if name not in TOOL_REGISTRY:
        return f"Error: unknown tool '{name}'. Available: {list(TOOL_REGISTRY)}"
    tool = TOOL_REGISTRY[name]
    try:
        result = await asyncio.wait_for(tool.run(argument), timeout=tool.timeout_sec)
        return truncate(result, max_chars=tool.max_output_chars)
    except asyncio.TimeoutError:
        return f"Error: tool '{name}' timed out after {tool.timeout_sec}s"
    except ToolError as e:
        return f"Error: {e}"  # Feed error back as observation — let agent adapt
```

- Every tool has `timeout_sec` (default 30) and `max_output_chars` (default 4000)
- Tool errors become observations — never crash the loop, let the agent retry or pivot
- Truncate tool output to prevent context window blowout
- Circuit breaker per tool: open after 3 consecutive failures, cooldown 60s

## Memory Management

### Three-tier memory architecture:
1. **Conversation history** — current task messages, managed by `ConversationMemory`
2. **Working memory** — scratchpad for intermediate results within a task
3. **Long-term memory** — vector store for cross-session retrieval

```python
class ConversationMemory:
    def __init__(self, max_tokens: int = 12000):
        self.messages: list[Message] = []
        self.max_tokens = max_tokens

    def add(self, role: str, content: str, **kwargs):
        self.messages.append(Message(role=role, content=content, **kwargs))
        self._compact_if_needed()

    def _compact_if_needed(self):
        while self._token_count() > self.max_tokens:
            # Keep system + last user + last 2 tool results, summarize middle
            middle = self.messages[1:-3]
            summary = summarize(middle)
            self.messages = [self.messages[0], Message("system", summary)] + self.messages[-3:]
```

- Set `max_tokens` per agent role: builder=12000, reviewer=8000, tuner=6000
- Never drop system prompt or last user message during compaction
- Summarize evicted messages — never silently truncate

## Token Budget Management

```python
def check_budget(memory: ConversationMemory, step: int, max_steps: int) -> None:
    used = memory.total_tokens_used
    remaining_steps = max_steps - step
    per_step_avg = used / max(step, 1)
    projected = used + (per_step_avg * remaining_steps)
    if projected > memory.token_budget * 0.9:
        memory.force_compact()
        logger.warning("token_budget_pressure", used=used, projected=projected)
```

- Track cumulative tokens across ALL steps — not just last response
- Force compaction at 90% budget — don't wait for overflow
- Log token usage per step for FinOps attribution

## Error Recovery in Agent Loops

- Tool failure → feed error as observation, agent self-corrects (up to 2 retries per tool)
- LLM returns malformed output → re-prompt with "Your response was not valid JSON. Try again."
- LLM refuses (content filter) → log, return graceful degradation message
- Never retry the identical prompt — append the error context before retrying

```python
if not validate_output(response):
    memory.add("system", "Your last response was malformed. Respond as valid JSON.")
    retry_count += 1
    if retry_count > 2:
        raise AgentMalformedOutputError("Agent produced 3 consecutive invalid outputs")
    continue
```

## Multi-Agent Handoff

```python
class HandoffRequest(BaseModel):
    target_agent: str
    task_summary: str
    context: list[Message]  # Pruned — only relevant messages
    constraints: dict[str, Any]  # Token budget, max_steps for sub-agent

async def handoff(req: HandoffRequest) -> AgentResult:
    sub_agent = AGENT_REGISTRY[req.target_agent]
    sub_memory = ConversationMemory(max_tokens=req.constraints.get("max_tokens", 8000))
    for msg in req.context:
        sub_memory.add(msg.role, msg.content)
    return await react_loop(sub_agent, req.task_summary, max_steps=req.constraints.get("max_steps", 10))
```

- Parent agent owns the token budget — sub-agents get a slice, not unlimited
- Prune context before handoff — send task-relevant messages only
- Sub-agent results are observations to the parent — parent decides next action
- builder → reviewer → tuner chain: each handoff includes previous agent's output

## Agent State Machine

Valid states: `IDLE → REASONING → ACTING → OBSERVING → REASONING → ... → COMPLETE | FAILED`

- Transition only through defined edges — no state skipping
- `FAILED` only from `ACTING` (tool failure after retries) or `REASONING` (max iterations)
- Persist state on each transition for crash recovery in long-running agents

## Guardrails

### Input validation (before agent loop):
- Reject prompts exceeding `max_input_tokens` (default 2000)
- Run Prompt Shield / content safety before processing
- Strip system prompt injection attempts (messages with role manipulation)

### Output validation (after final_answer):
- Validate against output schema if defined (e.g., JSON matching `OutputModel`)
- Check groundedness score if retrieval was used — reject below threshold (default 0.7)
- PII scan on final output — redact before returning to user

## Tracing and Observability

- Every agent run gets a `trace_id` — propagated to all tool calls and LLM requests
- Log per step: `{trace_id, step, action, tool, latency_ms, tokens_in, tokens_out, observation_len}`
- Emit metrics: `agent.steps_total`, `agent.tokens_total`, `agent.tool_errors`, `agent.convergence_rate`
- Store full traces for evaluation — replay failed runs for debugging

## Anti-Patterns

- ❌ Unbounded loops — no `max_steps` or set to 999. Agent burns tokens forever
- ❌ Regex parsing tool calls from free-text — use structured output or `tool_choice`
- ❌ Silently dropping messages when context is full — summarize, never truncate
- ❌ Retrying identical prompts on failure — append error context before retry
- ❌ Giving sub-agents unlimited token budgets — parent must slice and cap
- ❌ Logging full conversation history — log step metadata, store traces separately
- ❌ Catching all exceptions in tool execution — let `TimeoutError` and `AuthError` propagate
- ❌ Tools without timeouts — one hanging API call blocks the entire loop
- ❌ Mixing agent state with tool state — agent is the loop, tools are pure functions
- ❌ Hardcoding tool lists in prompts — use dynamic registry injection

## WAF Alignment

| Pillar | Agent-Specific Practice |
|--------|------------------------|
| **Reliability** | Max iteration guard, tool circuit breakers, error-as-observation recovery, crash-safe state persistence |
| **Security** | Prompt Shield on input, PII scan on output, tool allowlist validation, no prompt injection via tool results |
| **Cost Optimization** | Token budget per agent, model routing by role (mini for review, full for reasoning), compaction at 90% |
| **Operational Excellence** | Trace ID per run, per-step structured logs, convergence rate metrics, trace replay for debugging |
| **Performance Efficiency** | Tool timeouts, output truncation, async tool execution, working memory vs full history |
| **Responsible AI** | Groundedness check on retrieval answers, content safety pre/post, human escalation on low confidence |
