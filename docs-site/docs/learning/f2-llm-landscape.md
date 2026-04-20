---
sidebar_position: 2
title: "F2: LLM Landscape"
description: "Navigate the model universe — proprietary vs open-weight models, model families, and a practical selection framework for Azure AI workloads."
---

# F2: LLM Landscape

Choosing the right model is the highest-leverage decision in any AI project. This module maps the model universe and gives you a decision framework. For foundational concepts, see [F1: GenAI Foundations](./f1-genai-foundations.md).

## Three Categories of Models

| Category | Definition | Examples | Self-Host? | Fine-Tune? |
|----------|-----------|----------|------------|------------|
| **Proprietary** | Closed weights, API-only access | GPT-4o, Claude Opus, Gemini Pro | ❌ | Limited (OpenAI fine-tuning API) |
| **Open-Weight** | Weights released, restricted license | Llama 3.1, Mistral Large, Gemma 2 | ✅ | ✅ |
| **Open-Source** | Weights + training code + data, permissive license | OLMo, Pythia, BLOOM | ✅ | ✅ |

:::info
"Open-weight" ≠ "open-source." Llama's license restricts commercial use above 700M MAU. Always check the license before deploying. See the [glossary](./f3-glossary.md) for formal definitions.
:::

## OpenAI / Azure OpenAI Family

The default choice for most enterprise workloads via Azure OpenAI Service.

| Model | Context | Strengths | Best For |
|-------|---------|-----------|----------|
| **GPT-4o** | 128K | Multimodal (text+image+audio), strong reasoning | General-purpose, complex RAG, agents |
| **GPT-4o-mini** | 128K | 60× cheaper than GPT-4o, fast | High-volume classification, extraction, routing |
| **GPT-4.1** | 1M | Massive context, superior instruction following | Long-document analysis, codebase Q&A |
| **GPT-4.1-mini** | 1M | Cost-efficient 1M context | Large context at lower cost |
| **GPT-4.1-nano** | 1M | Fastest, cheapest 4.1 variant | Edge, real-time, high-throughput |
| **o1** | 200K | Deep chain-of-thought reasoning | Math, science, complex logic |
| **o3** | 200K | Enhanced reasoning with tool use | Multi-step problem solving, coding |
| **o3-mini** | 200K | Budget reasoning model | Reasoning tasks at lower cost |
| **o4-mini** | 200K | Latest compact reasoning model | Agentic tasks with tool use |

:::tip Start Small
**80% of production workloads run fine on GPT-4o-mini or GPT-4.1-nano.** Start there and only upgrade when evaluation metrics show the smaller model fails. FrootAI Play 14 (Cost-Optimized Gateway) implements automatic model routing based on query complexity.
:::

## Anthropic Claude

| Model | Context | Key Differentiator |
|-------|---------|-------------------|
| **Claude Opus 4** | 200K | Strongest reasoning, extended thinking, agentic coding |
| **Claude Sonnet 4** | 200K | Best balance of speed and intelligence |
| **Claude Haiku 3.5** | 200K | Fastest, cheapest — strong for extraction |

**Claude vs GPT key differences:**
- Claude excels at **long-form analysis** and nuanced instruction following
- Claude's **extended thinking** is visible (scratchpad tokens shown in API)
- Azure does **not** host Claude — requires direct API or AWS Bedrock
- Claude supports **system prompts as a first-class feature** (not just `messages[0]`)

## Meta Llama

The leading open-weight family. Self-hostable on AKS (see FrootAI Play 12).

| Model | Parameters | Context | Notes |
|-------|-----------|---------|-------|
| **Llama 3.1** | 8B / 70B / 405B | 128K | Workhorse for self-hosting |
| **Llama 3.2** | 1B / 3B | 128K | Edge/mobile deployment |
| **Llama 3.2 Vision** | 11B / 90B | 128K | Multimodal (text + image) |
| **Llama 4 Scout** | 17B active (109B total) | 10M | Mixture-of-Experts, massive context |
| **Llama 4 Maverick** | 17B active (400B total) | 1M | MoE, strong multilingual |

:::info
Llama 4 uses **Mixture-of-Experts (MoE)** — only a fraction of parameters activate per token, giving large-model quality at small-model cost. The "17B active" means inference VRAM is similar to a 17B dense model.
:::

## Google Gemini

| Model | Context | Key Feature |
|-------|---------|-------------|
| **Gemini 2.0 Flash** | 1M | Fast, multimodal, tool use |
| **Gemini 2.5 Pro** | 1M | Strongest reasoning, thinking mode |
| **Gemini 2.5 Flash** | 1M | Cost-efficient with thinking budget control |

Gemini models are available on Azure AI via the model catalog (Models as a Service).

## Microsoft Phi — Small Language Models

| Model | Parameters | Context | Strength |
|-------|-----------|---------|----------|
| **Phi-4** | 14B | 16K | STEM reasoning rivaling larger models |
| **Phi-3.5-mini** | 3.8B | 128K | Long-context SLM |
| **Phi-3.5-MoE** | 42B (6.6B active) | 128K | MoE efficiency |
| **Phi-Silica** | — | — | On-device (Copilot+ PCs, NPU) |

:::tip
Phi models are ideal for **edge deployment** (Play 19) and **fine-tuning** (Play 13) — small enough to train on a single GPU, strong enough for focused tasks.
:::

## Model Selection Decision Framework

```
Start here: Can GPT-4o-mini / GPT-4.1-nano handle it?
  │
  ├─ YES → Use it. Done. ($0.15–$0.40 / 1M tokens)
  │
  └─ NO → What's failing?
       │
       ├─ Reasoning quality → Try o3-mini or GPT-4o
       ├─ Long context needed → GPT-4.1 (1M) or Gemini 2.5 Pro
       ├─ Multimodal (images) → GPT-4o or Llama 3.2 Vision
       ├─ Data sovereignty → Self-host Llama 3.1 on AKS
       ├─ Latency critical → Phi-4 on edge or GPT-4.1-nano
       └─ Cost critical at scale → Fine-tune a smaller model (Play 13)
```

:::warning
**Never choose a model based on benchmarks alone.** Always evaluate on YOUR data using YOUR metrics. FrootAI's evaluation framework (Play 17) automates this with groundedness, relevance, and coherence scoring.
:::

## Azure OpenAI Pricing Tiers

| Tier | How It Works | Best For |
|------|-------------|----------|
| **Pay-As-You-Go (PAYG)** | Per-token billing, shared capacity | Dev/test, variable workloads |
| **Provisioned (PTU)** | Reserved throughput units, predictable cost | Production with steady traffic |
| **Global** | Microsoft-managed routing across regions | Highest availability |
| **Data Zone** | Region-pinned for data residency | Compliance-sensitive workloads |

## Practical Comparison Table

| Capability | GPT-4o-mini | GPT-4o | GPT-4.1 | Claude Sonnet 4 | Llama 3.1 70B |
|-----------|-------------|--------|---------|-----------------|---------------|
| Cost (1M in/out) | $0.15/$0.60 | $2.50/$10 | $2/$8 | $3/$15 | Self-host |
| Context | 128K | 128K | 1M | 200K | 128K |
| Multimodal | ✅ | ✅ | ✅ | ✅ | Text only |
| Fine-tunable | ✅ | ✅ | ✅ | ❌ | ✅ |
| Self-hostable | ❌ | ❌ | ❌ | ❌ | ✅ |
| Structured Output | ✅ | ✅ | ✅ | ✅ | Via frameworks |

## Key Takeaways

1. **Default to the smallest viable model** — GPT-4o-mini or GPT-4.1-nano for 80% of tasks
2. **Use model routing** to send complex queries to expensive models and simple ones to cheap models
3. **Open-weight models** unlock data sovereignty, customization, and cost control at scale
4. **Evaluate on your data** — benchmark rankings don't predict performance on your specific task
5. **Reasoning models (o1/o3)** are for math, logic, and multi-step planning — not general chat

**← [F1: GenAI Foundations](./f1-genai-foundations.md)** | **[F3: AI Glossary →](./f3-glossary.md)**
