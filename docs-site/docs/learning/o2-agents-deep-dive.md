---
sidebar_position: 9
title: "O2: AI Agents Deep Dive"
description: "From chatbots to autonomous agents — the agent loop, frameworks (AutoGen, CrewAI, LangChain, Microsoft Agent Framework), multi-agent patterns, and production guardrails."
---

# O2: AI Agents Deep Dive

An LLM is a brain in a jar — impressive reasoning, zero ability to act. An **AI agent** wraps that brain with memory, tools, and a planning loop so it can observe the world, decide what to do, execute actions, and learn from results. This module covers the full spectrum from chatbot to multi-agent swarm. For orchestration primitives agents build on, see [O1: Semantic Kernel](./o1-semantic-kernel.md). For the tool protocols agents use, see [O3: MCP & Tools](./o3-mcp-tools.md).

## What Is an AI Agent?

```
Agent = LLM + Memory + Tools + Planning
```

| Component | Role | Example |
|-----------|------|---------|
| **LLM** | Reasoning engine — understands language, generates plans | GPT-4o, Claude, Llama 3 |
| **Memory** | Short-term (conversation) + long-term (vector store) context | Chat history, Cosmos DB, Redis |
| **Tools** | Functions the agent can invoke to affect the real world | Search API, database query, email sender |
| **Planning** | Strategy for decomposing goals into steps | ReAct, Chain-of-Thought, Tree-of-Thought |

:::tip The Autonomy Heuristic
**Talks** → Assistant · **Suggests** → Copilot · **Acts** → Agent.
If it waits for every instruction, it's an assistant. If it proactively suggests next steps, it's a copilot. If it takes action on your behalf, it's an agent.
:::

## Chatbot vs Agent

| Dimension | Chatbot | Agent |
|-----------|---------|-------|
| **Interaction** | Reactive Q&A — user asks, bot answers | Goal-driven — user sets objective, agent pursues it |
| **Decision making** | Template matching or single LLM call | Multi-step reasoning with planning loops |
| **Tool access** | None or scripted integrations | Dynamic tool selection and chaining |
| **State** | Stateless or simple session memory | Rich short-term + long-term memory |
| **Autonomy** | Low — follows scripts | High — decomposes goals, adapts, retries |
| **Error handling** | "I don't understand" | Retries, alternative tools, escalation |

## Agent vs Copilot vs Assistant

| Trait | Assistant | Copilot | Agent |
|-------|-----------|---------|-------|
| **Autonomy** | Low | Medium | High |
| **Initiative** | Responds to commands | Proactively suggests | Acts independently |
| **Scope** | Single task | Workflow augmentation | End-to-end goal completion |
| **Human role** | Driver | Co-driver | Passenger (with override) |
| **Example** | Siri setting a timer | GitHub Copilot suggesting code | Agent booking flights + hotel for a trip |

## The Evolution of AI Systems

```
Rule-Based Bot → LLM Chatbot → RAG Chatbot → Tool-Using Assistant → AI Agent → Multi-Agent System
     ↓               ↓              ↓                 ↓                 ↓              ↓
  Hard-coded     Free-form      Grounded in       Can call APIs     Autonomous      Agents
  if/else        responses      your data         and functions     planning loop   collaborate
```

Each stage adds a capability: natural language → knowledge → action → autonomy → collaboration.

## The Core Agent Loop

Every agent, regardless of framework, runs a variation of this loop:

```
┌─────────────────────────────────────┐
│  1. OBSERVE  ← User goal or env    │
│  2. THINK    ← LLM reasons + plans │
│  3. ACT      ← Execute tool/action │
│  4. OBSERVE  ← Check results       │
│  5. REPEAT or STOP                  │
└─────────────────────────────────────┘
```

The **ReAct** pattern (Reason + Act) is the most common implementation: the LLM produces a `Thought` → `Action` → `Observation` cycle until the task is complete or a stop condition is met.

```python
# Simplified agent loop (pseudocode)
def agent_loop(goal: str, tools: list, max_hops: int = 10):
    memory = [{"role": "user", "content": goal}]
    for hop in range(max_hops):
        response = llm.chat(memory, tools=tools)
        if response.finish_reason == "stop":
            return response.content  # Done
        # Execute tool call
        result = execute_tool(response.tool_calls[0])
        memory.append({"role": "tool", "content": result})
    raise TimeoutError("Agent exceeded max hops")
```

:::warning
Always set `max_hops` (or equivalent). Without it, an agent can loop forever — burning tokens and money. Start with 10 hops, increase only if your use case demands it.
:::

## Agent Frameworks Comparison

| Framework | Language | Strength | Pattern | Best For |
|-----------|----------|----------|---------|----------|
| **AutoGen** | Python | Multi-agent conversations, code execution | ConversableAgent + GroupChat | Research, coding tasks, multi-agent debate |
| **CrewAI** | Python | Task delegation, role-based agents | Crew → Agent → Task with delegation | Business workflows, content pipelines |
| **LangChain** | Python/JS | LCEL chains, extensive tool ecosystem | AgentExecutor, LangGraph for cycles | RAG, tool-heavy pipelines, prototyping |
| **Semantic Kernel** | C#/Python/Java | Enterprise-grade, Azure-native | Plugins + Planners + Filters | Production .NET/Java apps, Azure integration |
| **Microsoft Agent Framework** | Python | Production SDK, Azure Foundry integration | Agent Service with tools + state | Enterprise deployment with eval + monitoring |

:::info When to use what
- **Prototyping** → LangChain (fastest ecosystem, most examples)
- **Multi-agent research** → AutoGen (built for agent conversations)
- **Enterprise .NET** → Semantic Kernel (first-class C# support)
- **Production Python** → Microsoft Agent Framework (Foundry integration)
- **Business process** → CrewAI (intuitive role/task model)
:::

## Multi-Agent Patterns

### Supervisor Pattern
One orchestrator agent delegates to specialist agents and aggregates results.

```
        ┌─────────────┐
        │  Supervisor  │
        └──┬───┬───┬───┘
           │   │   │
      ┌────┘   │   └────┐
      ▼        ▼        ▼
  Researcher  Coder  Reviewer
```

### Swarm Pattern
Agents self-organize without central control. Each agent decides when to hand off to another.

### Pipeline Pattern
Sequential handoff — Agent A → Agent B → Agent C. Each agent transforms and passes output forward. Ideal for content generation (research → write → edit → publish).

### Debate Pattern
Two+ agents argue opposing positions. A judge agent synthesizes the best answer. Useful for complex analysis where multiple perspectives improve accuracy.

## Production Guardrails

| Guardrail | Why | Implementation |
|-----------|-----|----------------|
| **Max hops** | Prevent infinite loops | `max_iterations=10` in agent config |
| **Token budget** | Control cost per request | `max_tokens` per hop + total budget |
| **Timeout** | Prevent hung agents | 60s per tool call, 5min per task |
| **Audit trail** | Compliance + debugging | Log every thought/action/observation |
| **Human-in-the-loop** | Safety for destructive actions | Require approval for writes/deletes |
| **Sandboxing** | Prevent code execution escapes | Docker containers for code agents |
| **Content safety** | Block harmful outputs | Azure Content Safety on every response |

For infrastructure to run agents at scale, see [O5: AI Infrastructure](./o5-infrastructure.md). For evaluation of agent quality, see [O4: Azure AI Foundry](./o4-azure-ai-foundry.md).

## Key Takeaways

1. **Agent = LLM + Memory + Tools + Planning** — each component is necessary
2. The agent loop (Observe → Think → Act) is universal across all frameworks
3. Multi-agent patterns (Supervisor, Swarm, Pipeline, Debate) solve different coordination needs
4. Production agents need guardrails: max hops, token budgets, timeouts, audit trails
5. Choose your framework based on language, deployment target, and collaboration pattern — not hype
