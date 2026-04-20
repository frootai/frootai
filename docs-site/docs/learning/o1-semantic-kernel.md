---
sidebar_position: 8
title: "O1: Semantic Kernel"
description: "AI orchestration with Semantic Kernel — plugins, memory, planners, filters, and how SK compares to LangChain, LlamaIndex, and AutoGen for enterprise workloads."
---

# O1: Semantic Kernel

Raw LLM API calls don't survive production. You need **orchestration** — the middleware that handles prompt management, tool use, memory, error handling, and safety between your application and the model. This module covers Semantic Kernel, Microsoft's open-source SDK for AI orchestration. For the prompting and grounding techniques SK manages, see [R1: Prompt Engineering](./r1-prompt-engineering.md) and [R2: RAG Architecture](./r2-rag-architecture.md).

## Why Raw API Calls Break in Production

| Concern | Raw API Call | With Orchestration |
|---------|-------------|-------------------|
| **Prompt versioning** | Strings in code, no history | Versioned templates with variables |
| **Tool use** | Manual JSON parsing of function calls | Declarative plugin registration |
| **Memory** | Developer manages conversation history | Built-in chat history + vector memory |
| **Error handling** | Try/catch per call | Retry, fallback, circuit breaker |
| **Safety** | Manual content filtering | Pre/post filters with content safety |
| **Observability** | Custom logging | Built-in telemetry + OpenTelemetry |
| **Model switching** | Rewrite integration code | Change one config line |

## What Is Semantic Kernel?

**Semantic Kernel (SK)** is Microsoft's open-source AI orchestration SDK. It powers M365 Copilot, GitHub Copilot, and Azure AI Foundry internally.

- **Languages:** C#, Python, Java
- **License:** MIT
- **Philosophy:** Bring AI to your existing app (not rebuild around AI)
- **Design:** Plugin-first, enterprise-grade, model-agnostic

:::info
SK is not a framework you build inside — it's a library you add to your existing application. A typical integration is 50–200 lines of code on top of your current codebase.
:::

## Core Concepts

### The Kernel

The central object that wires everything together — services, plugins, memory, and filters:

```python
from semantic_kernel import Kernel
from semantic_kernel.connectors.ai.open_ai import AzureChatCompletion

kernel = Kernel()

kernel.add_service(AzureChatCompletion(
    deployment_name="gpt-4o",
    endpoint="https://my-oai.openai.azure.com/",
    # Uses DefaultAzureCredential automatically
))
```

### Plugins (Native + Prompt)

Plugins are SK's unit of reusable AI capability. Two types:

**Native plugins** — regular code the AI can call:

```python
from semantic_kernel.functions import kernel_function

class WeatherPlugin:
    @kernel_function(description="Get current weather for a city")
    def get_weather(self, city: str) -> str:
        # Call a real weather API here
        return f"Weather in {city}: 22°C, partly cloudy"

kernel.add_plugin(WeatherPlugin(), plugin_name="weather")
```

**Prompt plugins** — templated prompts with variables:

```python
from semantic_kernel.functions import KernelFunction
from semantic_kernel.prompt_template import PromptTemplateConfig

summarize = KernelFunction.from_prompt(
    prompt="Summarize this text in {{$style}} style:\n\n{{$input}}",
    plugin_name="text",
    function_name="summarize",
    template_format="semantic-kernel",
)
kernel.add_function(plugin=summarize)
```

### Memory

SK provides pluggable memory backends for conversation history and semantic recall:

| Memory Type | Use Case | Backend |
|-------------|----------|---------|
| **Chat history** | Multi-turn conversations | In-memory, Redis, Cosmos DB |
| **Vector memory** | Semantic search over past interactions | Azure AI Search, Qdrant, Chroma |
| **Text memory** | Key-value knowledge store | Any vector DB |

### Filters

Intercept and transform requests/responses at any point in the pipeline:

```python
from semantic_kernel.filters import FunctionInvocationFilter

class SafetyFilter(FunctionInvocationFilter):
    async def on_function_invocation(self, context, next):
        # Pre-processing: validate input
        if contains_pii(context.arguments["input"]):
            raise ValueError("PII detected in input")
        
        await next(context)  # Call the actual function
        
        # Post-processing: validate output
        context.result = mask_sensitive_data(context.result)

kernel.add_filter(SafetyFilter())
```

:::tip Combining Frameworks
SK is designed to coexist. Use SK for orchestration + LangChain for advanced chains + LlamaIndex for indexing — they're complementary, not competing. FrootAI Play 01 uses SK for orchestration with Azure AI Search for retrieval.
:::

## The Orchestration Landscape

| Framework | Language | Strengths | Best For |
|-----------|----------|-----------|----------|
| **Semantic Kernel** | C#, Python, Java | Enterprise-grade, plugin system, M365 integration, model-agnostic | .NET shops, M365/Azure ecosystem |
| **LangChain** | Python, JS | Largest ecosystem, LCEL chains, LangSmith observability | Rapid prototyping, Python-first teams |
| **LlamaIndex** | Python | Best-in-class data indexing, query engines, knowledge graphs | Data-heavy RAG, document Q&A |
| **Prompt Flow** | Python (Azure) | Visual flow editor, built-in evaluation, Azure-native | Azure AI Foundry users, low-code teams |
| **AutoGen** | Python | Multi-agent conversations, code execution sandbox | Multi-agent systems, research |
| **CrewAI** | Python | Role-based agents, task delegation | Team-of-agents patterns |

### Detailed Comparison

| Capability | SK | LangChain | LlamaIndex | AutoGen |
|------------|-----|-----------|------------|---------|
| **Plugin system** | ✅ Native + Prompt | ✅ Tools | ✅ Tools | ✅ Tools |
| **Memory** | ✅ Pluggable | ✅ Multiple | ✅ Built-in | ⚠️ Basic |
| **Streaming** | ✅ | ✅ | ✅ | ⚠️ Limited |
| **Multi-agent** | ⚠️ Via Agent Framework | ✅ LangGraph | ❌ | ✅ Native |
| **Evaluation** | ⚠️ External | ✅ LangSmith | ✅ Built-in | ⚠️ External |
| **Enterprise auth** | ✅ Entra ID native | ⚠️ Manual | ⚠️ Manual | ⚠️ Manual |
| **.NET support** | ✅ First-class | ❌ | ❌ | ⚠️ Experimental |
| **Azure integration** | ✅ Deep | ⚠️ Connectors | ⚠️ Connectors | ✅ Good |

## When to Use What

```
Is your team .NET / Azure-first?
  └─ YES → Semantic Kernel
  └─ NO → Continue...

Is it primarily a data/RAG problem?
  └─ YES → LlamaIndex (indexing) + SK or LangChain (orchestration)
  └─ NO → Continue...

Do you need multi-agent collaboration?
  └─ YES → AutoGen or CrewAI (with SK for individual agent orchestration)
  └─ NO → Continue...

Rapid prototyping with Python?
  └─ YES → LangChain
  └─ NO → Semantic Kernel (safe default for production)
```

## SK in FrootAI Solution Plays

| Play | How SK Is Used |
|------|---------------|
| **01 — Enterprise RAG** | Kernel + Azure AI Search plugin + chat history |
| **03 — Deterministic Agent** | Filters for input/output validation + structured output |
| **05 — IT Ticket Resolution** | Native plugin for ServiceNow API + routing |
| **07 — Multi-Agent Service** | SK Agent Framework for multi-agent orchestration |
| **14 — Cost-Optimized Gateway** | Model routing plugin (GPT-4o-mini → GPT-4o fallback) |

## Key Takeaways

1. **Orchestration is mandatory for production** — raw API calls accumulate technical debt
2. **SK is the safe default** for Azure/.NET teams — battle-tested in M365 Copilot
3. **Plugins are the core abstraction** — wrap every capability as a native or prompt plugin
4. **Filters give you safety rails** — intercept every request and response
5. **Frameworks are complementary** — combine SK + LlamaIndex + AutoGen as needed

For deterministic output strategies managed through SK filters, see [R3: Deterministic AI](./r3-deterministic-ai.md).
