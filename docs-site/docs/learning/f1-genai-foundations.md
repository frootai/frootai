---
sidebar_position: 1
title: "F1: GenAI Foundations"
description: "How Large Language Models work — tokens, parameters, context windows, embeddings, and generation settings explained for practitioners."
---

# F1: GenAI Foundations

This module covers the core mechanics of Generative AI. Understanding these fundamentals is essential before diving into [RAG](./f2-llm-landscape.md), [agents](./f4-agentic-os.md), or any FrootAI solution play.

## What Is a Large Language Model?

An LLM is a **statistical next-token predictor**. Given a sequence of tokens, it calculates probability distributions over the entire vocabulary and samples the next token. Repeat this thousands of times and you get coherent text, code, or structured output.

```
Input:  "The capital of France is"
Output: " Paris" (probability: 0.97)
```

:::info Key Insight
LLMs don't "understand" — they learn statistical patterns from trillions of tokens of training data. This is why **grounding** (connecting to real data) and **guardrails** (constraining outputs) are critical. See the [AI Glossary](./f3-glossary.md) for formal definitions.
:::

## Tokens — The Currency of AI

Tokens are sub-word units produced by **Byte-Pair Encoding (BPE)**. They are how models read, think, and charge.

| Text | Token Count | Ratio |
|------|-------------|-------|
| `"Hello, world!"` | 4 tokens | 1 token ≈ 1.3 words |
| `"Antidisestablishmentarianism"` | 6 tokens | 1 token ≈ 0.17 words |
| `{"name": "Alice"}` | 7 tokens | JSON is token-expensive |
| Average English prose | ~100 tokens | **1 token ≈ 0.75 words** |

**Cost formula:** `cost = (input_tokens × input_price) + (output_tokens × output_price)`

:::tip Token Budget
Always set `max_tokens` in production. An unbounded response can burn through your budget on a single runaway generation. FrootAI solution plays configure this in `config/openai.json`.
:::

## Key Generation Parameters

| Parameter | Range | Default | Effect |
|-----------|-------|---------|--------|
| `temperature` | 0–2 | 1.0 | Controls randomness. 0 = deterministic, 1 = balanced, 2 = creative chaos |
| `top_p` | 0–1 | 1.0 | Nucleus sampling — considers tokens within cumulative probability p |
| `max_tokens` | 1–128K | Model limit | Hard cap on output length |
| `seed` | int | None | Enables reproducible outputs (same seed + temp 0 = same result) |
| `frequency_penalty` | -2–2 | 0 | Reduces repetition of already-used tokens |

:::warning
Never set both `temperature` and `top_p` to non-default values simultaneously — they interact unpredictably. Pick one.
:::

## Context Windows — Model Memory

The context window is the maximum number of tokens a model can process in a single request (input + output combined).

| Model | Context Window | ~Pages of Text |
|-------|---------------|----------------|
| GPT-4o | 128K | ~200 pages |
| GPT-4o-mini | 128K | ~200 pages |
| GPT-4.1 | 1M | ~1,500 pages |
| Claude Sonnet 4 | 200K | ~300 pages |
| Llama 3.1 405B | 128K | ~200 pages |
| Gemini 2.5 Pro | 1M | ~1,500 pages |

Exceeding the context window causes **truncation** — the model silently drops older tokens. RAG (see [F2](./f2-llm-landscape.md)) solves this by retrieving only relevant chunks.

## Model Parameters & VRAM

When someone says "a 7B model," they mean 7 billion trainable weights. More parameters generally means better reasoning but higher infrastructure cost.

**VRAM formula:** `VRAM ≈ params × bytes_per_param × 1.2 (overhead)`

| Model Size | FP32 | FP16 | INT8 | INT4 |
|-----------|------|------|------|------|
| 7B | 28 GB | 14 GB | 7 GB | 3.5 GB |
| 13B | 52 GB | 26 GB | 13 GB | 6.5 GB |
| 70B | 280 GB | 140 GB | 70 GB | 35 GB |
| 405B | 1.6 TB | 810 GB | 405 GB | 203 GB |

## Quantization — Shrinking Models

Quantization reduces precision of model weights to lower VRAM and increase throughput:

- **FP32** — Full precision, baseline quality, 4 bytes/param
- **FP16/BF16** — Half precision, negligible quality loss, 2 bytes/param *(production standard)*
- **INT8** — 8-bit integers, ~1% quality loss, 1 byte/param
- **INT4 (GPTQ/AWQ)** — Aggressive compression, noticeable quality loss on complex reasoning

:::tip
For self-hosted models, start with **INT8** quantization — it offers the best quality-to-cost ratio. Only go to INT4 if VRAM is severely constrained. See FrootAI Play 12 for AKS model serving patterns.
:::

## Embeddings — Semantic Vectors

Embeddings convert text into dense vectors (e.g., 1536 or 3072 dimensions) where **semantic similarity = vector proximity**.

```
embed("king") - embed("man") + embed("woman") ≈ embed("queen")
```

Used for: semantic search, RAG retrieval, clustering, anomaly detection, recommendation. See [cosine similarity](./f3-glossary.md) in the glossary.

## Training vs Inference

| Aspect | Training | Inference |
|--------|----------|-----------|
| **Goal** | Learn weights from data | Generate outputs from learned weights |
| **Compute** | Thousands of GPUs, weeks/months | Single GPU or API call, milliseconds |
| **Cost** | $2M–$100M+ per frontier model | $0.15–$60 per 1M tokens |
| **Who does it** | OpenAI, Meta, Google, Anthropic | You, via API or self-hosted |

:::info
99% of FrootAI solution plays use **inference only** — calling pre-trained models via API. Plays 13 (Fine-Tuning) and 12 (Model Serving) cover the exceptions.
:::

## Practical Example — Azure OpenAI Chat Completion

```python
from openai import AzureOpenAI

client = AzureOpenAI(
    azure_endpoint="https://YOUR-RESOURCE.openai.azure.com",
    api_version="2024-12-01-preview",
    azure_deployment="gpt-4o",
    # Uses DefaultAzureCredential via AZURE_CLIENT_ID — never hardcode keys
)

response = client.chat.completions.create(
    model="gpt-4o",
    temperature=0.7,
    max_tokens=500,
    seed=42,
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Explain transformers in 3 sentences."},
    ],
)

print(response.choices[0].message.content)
# Usage: response.usage.prompt_tokens, response.usage.completion_tokens
```

## Key Takeaways

1. **Tokens** are the universal unit — understand them for cost, latency, and context management
2. **Temperature 0 + seed** gives deterministic outputs for reproducible pipelines
3. **Context window ≠ quality** — more context doesn't mean better answers (noise hurts)
4. **Quantization** makes self-hosting viable — INT8 is the sweet spot
5. **Always set `max_tokens`** — unbounded generation is a cost and safety risk

**Next:** [F2: LLM Landscape →](./f2-llm-landscape.md)
