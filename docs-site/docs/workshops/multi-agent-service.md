---
sidebar_position: 3
title: "Workshop: Multi-Agent Service"
description: "Hands-on workshop — build a multi-agent system with supervisor routing, specialist agents, guardrails, and evaluation. Based on Solution Play 07."
---

# Workshop: Multi-Agent Service

Build a **multi-agent AI system** where a supervisor agent routes user requests to specialized agents — research, analysis, and action — with guardrails, timeout enforcement, and quality evaluation.

| | |
|---|---|
| **Duration** | 120 minutes (5 parts) |
| **Level** | Advanced |
| **Solution Play** | [07 — Multi-Agent Service](../solution-plays/overview.md) |
| **You'll Build** | Supervisor → Research Agent + Analysis Agent + Action Agent with guardrails |

## Prerequisites

- **Azure subscription** with Azure OpenAI access (GPT-4o deployment)
- **Node.js 18+** or **Python 3.10+**
- **VS Code** with FrootAI extension
- Familiarity with [O2: AI Agents Deep Dive](../learning/o2-agents-deep-dive.md)

```bash
pip install openai azure-identity semantic-kernel  # Python
# OR: npm install openai @azure/identity           # Node.js
```

## Part 1: Scaffold (10 min)

```bash
npx frootai scaffold 07-multi-agent-service
cd 07-multi-agent-service
```

Explore the generated structure:

```
07-multi-agent-service/
├── .github/
│   ├── copilot-instructions.md
│   ├── agents/          # builder, reviewer, tuner
│   └── skills/          # agent-orchestration/SKILL.md
├── config/              # openai.json, guardrails.json
└── spec/                # fai-manifest.json
```

## Part 2: Review Configuration (20 min)

### Agent Guardrails

The `guardrails.json` defines safety boundaries for multi-agent interactions:

```json
{ "max_agent_hops": 5, "agent_timeout_seconds": 30, "max_total_tokens": 16000,
  "allow_agent_self_delegation": false, "require_supervisor_approval": true,
  "content_safety": { "enabled": true,
    "categories": ["hate", "self_harm", "sexual", "violence"] } }
```

:::warning Agent Loops
Without hop limits, agents delegate indefinitely, burning tokens. Always enforce `max_agent_hops` (5) and `agent_timeout_seconds` (30).
:::

### Supervisor Routing Configuration

```json
{ "supervisor": { "model": "gpt-4o", "routing_strategy": "intent_classification",
    "specialists": {
      "research": { "description": "Finds information", "model": "gpt-4o-mini",
                     "tools": ["search", "document_reader"] },
      "analysis": { "description": "Analyzes data, generates insights", "model": "gpt-4o",
                     "tools": ["calculator", "chart_generator"] },
      "action":   { "description": "Executes actions (email, tickets)", "model": "gpt-4o-mini",
                     "tools": ["email", "ticketing"], "require_confirmation": true }
    }
  }
}
```

## Part 3: Build the Supervisor (40 min)

The supervisor classifies user intent and delegates to the right specialist:

```python
from openai import AzureOpenAI

ROUTING_PROMPT = """You are a supervisor agent. Classify the user's request
and route to the appropriate specialist:
- "research": information lookup, knowledge questions
- "analysis": data analysis, comparisons, insights
- "action": tasks that change state (send email, create ticket)
Respond with JSON: {"agent": "<name>", "task": "<refined task>"}"""

class Supervisor:
    def __init__(self, client: AzureOpenAI):
        self.client = client
        self.specialists = {
            "research": ResearchAgent(client),
            "analysis": AnalysisAgent(client),
            "action": ActionAgent(client),
        }
        self.hop_count = 0
        self.max_hops = 5

    async def route(self, user_message: str) -> dict:
        if self.hop_count >= self.max_hops:
            return {"error": "Max delegation hops reached"}
        routing = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "system", "content": ROUTING_PROMPT},
                      {"role": "user", "content": user_message}],
            response_format={"type": "json_object"}, temperature=0)
        decision = json.loads(routing.choices[0].message.content)
        self.hop_count += 1
        specialist = self.specialists.get(decision["agent"])
        return await specialist.execute(decision["task"]) if specialist \
            else {"error": f"Unknown agent: {decision['agent']}"}
```

## Part 4: Build Specialists (30 min)

Each specialist has a focused system prompt and appropriate model:

```python
class ResearchAgent:
    SYSTEM_PROMPT = "You are a research specialist. Cite sources. Never fabricate."

    async def execute(self, task: str) -> dict:
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",  # Simple retrieval → cheaper model
            messages=[{"role": "system", "content": self.SYSTEM_PROMPT},
                      {"role": "user", "content": task}],
            temperature=0.1, max_tokens=2000)
        return {"agent": "research", "result": response.choices[0].message.content}

class AnalysisAgent:
    SYSTEM_PROMPT = "You are an analysis specialist. Use tables and quantitative data."

    async def execute(self, task: str) -> dict:
        response = self.client.chat.completions.create(
            model="gpt-4o",  # Complex reasoning → stronger model
            messages=[{"role": "system", "content": self.SYSTEM_PROMPT},
                      {"role": "user", "content": task}],
            temperature=0.2, max_tokens=3000)
        return {"agent": "analysis", "result": response.choices[0].message.content}

class ActionAgent:
    async def execute(self, task: str) -> dict:
        plan = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": "Plan the action. DO NOT execute. Return JSON."},
                      {"role": "user", "content": task}],
            response_format={"type": "json_object"}, temperature=0)
        return {"agent": "action", "requires_confirmation": True,
                "action_plan": json.loads(plan.choices[0].message.content)}
```

:::info Human-in-the-Loop
The action agent returns an action plan for **human approval** before execution — mitigating OWASP LLM #8 (Excessive Agency). See [T2: Responsible AI](../learning/t2-responsible-ai.md).
:::

## Part 5: Test & Evaluate (20 min)

### Integration Test

```python
supervisor = Supervisor(client)
result = await supervisor.route("What are the key features of Azure AI Search?")
assert result["agent"] == "research"
result = await supervisor.route("Compare GPT-4o vs GPT-4o-mini cost for 1M tokens")
assert result["agent"] == "analysis"
result = await supervisor.route("Send an email about the quarterly review")
assert result["requires_confirmation"] == True
```

### Evaluate Quality

| Metric | Target | Measures |
|--------|--------|----------|
| **Routing accuracy** | ≥ 95% | Does the supervisor pick the right specialist? |
| **Groundedness** | ≥ 4.0 | Are research answers grounded in sources? |
| **Relevance** | ≥ 4.0 | Do responses address the user's actual question? |
| **Coherence** | ≥ 4.0 | Are multi-agent responses logically consistent? |
| **Avg hops** | ≤ 2 | Are requests resolved efficiently? |
| **Latency** | < 10s P95 | Is the multi-hop overhead acceptable? |

## Cleanup

```bash
# Remove Azure resources
az group delete --name multi-agent-rg --yes --no-wait
```

## Next Steps

- Scale up with [Solution Play 22 — Swarm Orchestration](../solution-plays/catalog.md)
- Add RAG to your agents with [Workshop: Build a RAG Pipeline](./build-rag-pipeline.md)
- Study agent patterns in [O2: AI Agents Deep Dive](../learning/o2-agents-deep-dive.md)
