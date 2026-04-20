---
sidebar_position: 10
title: "O3: MCP & Tools"
description: "Function calling, Model Context Protocol (MCP), A2A, and tool security — how LLMs interact with external systems, from basic tool use to the 'USB for AI' standard."
---

# O3: MCP & Tools

An LLM without tools is a brain in a jar — it can reason but can't act. **Tools** give AI models the ability to read databases, call APIs, execute code, and interact with the real world. This module covers the evolution from function calling to the Model Context Protocol (MCP) and Agent-to-Agent (A2A) protocol. For how agents orchestrate tools, see [O2: AI Agents Deep Dive](./o2-agents-deep-dive.md). For the orchestration layer managing tool calls, see [O1: Semantic Kernel](./o1-semantic-kernel.md).

## Why Tools Matter

| Without Tools | With Tools |
|---------------|------------|
| "The weather in Paris is usually mild" (hallucinated guess) | `get_weather("Paris")` → "Paris is 18°C and sunny right now" (real data) |
| "I think the stock price is around $150" | `get_stock("MSFT")` → "$421.53 as of market close" |
| "Here's how to send an email..." (instructions only) | `send_email(to, subject, body)` → "Email sent ✅" |

Tools transform LLMs from **know-it-alls** into **do-it-alls**.

## Function Calling: The Foundation

Function calling is the mechanism where the model generates structured JSON describing **which tool to call and with what arguments**. Your application then executes the function and returns results.

```python
import openai

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get current weather for a city",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "City name"},
                "units": {"type": "string", "enum": ["celsius", "fahrenheit"]}
            },
            "required": ["city"]
        }
    }
}]

response = openai.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Weather in Paris?"}],
    tools=tools
)
# Model returns tool_call JSON (NOT the result) — your app executes the function
# {"name": "get_weather", "arguments": {"city": "Paris", "units": "celsius"}}
```

:::info Key insight
The model **never executes** the function — it only generates the JSON call. Your application is the executor. This is a critical security boundary.
:::

## Tool Definition Schema

Every tool needs three things:

```json
{
  "name": "search_knowledge_base",
  "description": "Search internal docs for relevant information. Use when the user asks about company policies or procedures.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Search query" },
      "top_k": { "type": "integer", "description": "Number of results", "default": 5 }
    },
    "required": ["query"]
  }
}
```

The **description** is the most important field — it's what the model reads to decide when to use the tool. Write it like you're explaining to a new team member.

## Tool Choice Control

| `tool_choice` | Behavior | Use Case |
|---------------|----------|----------|
| `"auto"` | Model decides whether to call a tool | Default — let the model reason |
| `"none"` | Model cannot call any tools | Force text-only response |
| `"required"` | Model must call at least one tool | Ensure action is taken |
| `{"function": {"name": "X"}}` | Model must call specific function X | Force a particular tool |

## Parallel Tool Calling

Models can request **multiple tool calls in a single turn** when tasks are independent:

```
User: "What's the weather in Paris and Tokyo?"
Model: [get_weather("Paris"), get_weather("Tokyo")]  ← Two parallel calls
```

Execute them concurrently and return both results. This reduces round trips and latency.

## Model Context Protocol (MCP)

:::tip The "USB for AI" Analogy
Before USB, every device needed a custom cable. MCP does for AI tools what USB did for peripherals — **one standard protocol** for connecting any tool to any AI application.
:::

### MCP vs Function Calling

| Dimension | Function Calling | MCP |
|-----------|-----------------|-----|
| **Discovery** | Manual — hardcode tools per app | Automatic — client discovers tools from server |
| **Scope** | Per-application | Shared across applications |
| **Updates** | Redeploy app to add tools | Server adds tools, clients auto-discover |
| **Ecosystem** | Vendor-specific (OpenAI, Anthropic) | Open standard, any vendor |
| **Data access** | Tools only | Tools + Resources + Prompts |

### MCP Architecture

```
┌──────────────┐         ┌──────────────┐
│   AI App     │         │  MCP Server  │
│  (Client)    │◄───────►│              │
│              │  JSON   │  ☐ Tools     │
│  Claude      │  -RPC   │  ☐ Resources │
│  Copilot     │         │  ☐ Prompts   │
│  Custom App  │         │              │
└──────────────┘         └──────────────┘
```

MCP servers expose three capability types:

| Capability | What It Is | Example |
|------------|------------|---------|
| **Tools** | Functions the model can call | `search_docs`, `create_ticket`, `run_query` |
| **Resources** | Read-only data the model can access | File contents, database schemas, config values |
| **Prompts** | Reusable prompt templates | "Summarize this document", "Review this PR" |

### MCP Transport

| Transport | How It Works | Best For |
|-----------|-------------|----------|
| **stdio** | Server runs as child process, communicates via stdin/stdout | Local tools (VS Code, CLI) |
| **HTTP/SSE** | Server runs remotely, uses HTTP + Server-Sent Events | Remote/shared servers, cloud deployment |

### MCP Server Example

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "weather-server", version: "1.0.0" });

// Register a tool
server.tool("get_weather", { city: { type: "string" } }, async ({ city }) => {
  const data = await fetch(`https://api.weather.com/${city}`);
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

## A2A: Agent-to-Agent Protocol

While MCP connects models to **tools**, A2A connects **agents to other agents**:

| Protocol | Connects | Purpose |
|----------|----------|---------|
| **MCP** | Model ↔ Tool | Tool discovery and execution |
| **A2A** | Agent ↔ Agent | Task delegation between autonomous agents |

A2A enables an agent to discover other agents' capabilities, delegate subtasks, and receive results — without knowing the other agent's implementation.

## Security Best Practices

:::warning
Tools are the most dangerous part of an AI system. An LLM with unrestricted tool access can delete databases, send emails, or exfiltrate data.
:::

| Practice | Implementation |
|----------|---------------|
| **Least privilege** | Each tool gets minimum required permissions |
| **Sandboxing** | Code execution tools run in containers |
| **Rate limiting** | Max N tool calls per minute per user |
| **Audit logging** | Log every tool call with user, args, result |
| **Input validation** | Validate all tool arguments before execution |
| **Confirmation gates** | Destructive actions require human approval |
| **Timeout** | Kill tool calls exceeding 30s |

## Key Takeaways

1. **Function calling** is the foundation — model generates JSON, your app executes
2. Tool descriptions are critical — they guide the model's tool selection decisions
3. **MCP** standardizes tool discovery and sharing across AI applications
4. MCP exposes Tools + Resources + Prompts via stdio or HTTP/SSE transport
5. **A2A** extends the pattern from model↔tool to agent↔agent delegation
6. Security is non-negotiable: sandbox, rate-limit, audit, and gate every tool

For how agents use these tools in autonomous loops, see [O2: AI Agents Deep Dive](./o2-agents-deep-dive.md). For Azure-native deployment of tool-using AI, see [O4: Azure AI Foundry](./o4-azure-ai-foundry.md).
