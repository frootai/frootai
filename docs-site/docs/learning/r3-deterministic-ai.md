---
sidebar_position: 7
title: "R3: Deterministic AI"
description: "Achieve consistent, verifiable AI outputs — the determinism spectrum, hallucination mechanics, temperature controls, structured output, grounding strategies, and multi-layer defense."
---

# R3: Deterministic AI

The core challenge: you want the **same input to produce the same output**, but LLMs are inherently probabilistic. True bit-for-bit determinism is impossible — but **functional determinism** (consistent, accurate, verifiable outputs) is achievable. This module shows you how. See [R1: Prompt Engineering](./r1-prompt-engineering.md) for the prompting techniques that underpin these strategies.

## The Determinism Spectrum

Not all tasks need the same level of consistency. Choose the right target:

| Level | Definition | Example | Acceptable? |
|-------|-----------|---------|-------------|
| **Exact** | Bit-for-bit identical output every time | `2 + 2 = 4` | ✅ Math, lookups |
| **Semantic** | Same meaning, different wording | "The sky is blue" / "Blue is the color of the sky" | ✅ Most production tasks |
| **Intent** | Same intent and action, varying detail | Two valid but differently-worded emails | ✅ Creative, drafting |
| **Approximate** | Roughly correct, may vary in accuracy | Summarizations that emphasize different points | ⚠️ Acceptable with review |
| **Chaotic** | Contradictory or fabricated across runs | Different answers to the same factual question | ❌ Never acceptable |

:::info GPU Floating-Point Non-Determinism
Even with `temperature=0` and `seed` set, identical API calls can produce different outputs. GPU floating-point arithmetic is non-associative — `(a + b) + c ≠ a + (b + c)` at float precision. Different GPU routing, batching, or hardware can shift token probabilities enough to change the selected token at decision boundaries. This is a hardware-level limitation, not a bug.
:::

## Why AI Hallucinates

Hallucination is a **feature of autoregressive generation**, not a bug. Understanding the mechanics helps you defend against it:

1. **Next-token prediction** — the model picks the most probable continuation, not the most truthful
2. **No knowledge boundary** — the model doesn't know what it doesn't know
3. **Training data noise** — conflicting or outdated information in training data
4. **Context window pressure** — as conversations grow, earlier context gets compressed
5. **Sycophancy bias** — models tend to agree with the user's stated position

**Key insight:** You can't eliminate hallucination — you can only reduce its frequency and catch it before it reaches users.

## The Determinism Toolkit

### Control Lever 1: Temperature & Sampling

| Parameter | Value | Effect | Use Case |
|-----------|-------|--------|----------|
| `temperature` | `0` | Greedy decoding — always picks highest-probability token | Factual Q&A, classification, extraction |
| `temperature` | `0.1–0.3` | Near-deterministic with slight variation | RAG, structured output |
| `temperature` | `0.7–1.0` | Balanced creativity and coherence | Drafting, brainstorming |
| `top_p` | `0.1` | Considers only top 10% probability mass | Very focused output |
| `top_k` | `5–10` | Considers only top-k tokens at each step | Not available in Azure OpenAI (use `top_p`) |
| `seed` | integer | Best-effort reproducibility (same seed → same output) | A/B testing, regression testing |

```python
# Maximum determinism settings
response = client.chat.completions.create(
    model="gpt-4o",
    temperature=0,
    seed=42,
    max_tokens=500,
    messages=[...],
)
# Check: response.system_fingerprint — if it changes, outputs may differ
```

### Control Lever 2: Structured Output

Force the model into a **constrained output space** where hallucination is structurally impossible:

```python
from pydantic import BaseModel

class ClassificationResult(BaseModel):
    category: str  # constrained to enum in JSON Schema
    confidence: float
    reasoning: str

response = client.beta.chat.completions.parse(
    model="gpt-4o",
    temperature=0,
    response_format=ClassificationResult,
    messages=[
        {"role": "system", "content": "Classify the support ticket."},
        {"role": "user", "content": "My VM won't start after resizing."},
    ],
)
result = response.choices[0].message.parsed
```

:::tip
JSON Schema constraints act as **guardrails at the decoding level**. The model physically cannot output tokens that violate the schema. This is stronger than prompting "respond in JSON" — which is a suggestion, not a constraint.
:::

### Control Lever 3: Grounding

Connect the model to **real data** so it generates from evidence, not memory:

| Strategy | How It Works | Determinism Gain |
|----------|-------------|-----------------|
| **RAG** | Retrieve relevant docs, inject into context | High — answer bounded by retrieved content |
| **System message constraints** | "Only use information from the provided context" | Medium — relies on model compliance |
| **Citation requirements** | "Cite sources as [1], [2]" | Medium — forces traceability |
| **Tool/function calling** | Model calls APIs for real-time data | High — answers come from verified sources |
| **Knowledge cutoff awareness** | "If you don't know, say 'I don't know'" | Medium — reduces fabrication |

See [R2: RAG Architecture](./r2-rag-architecture.md) for full implementation details.

## Multi-Layer Defense Architecture

No single technique is sufficient. Production systems stack multiple layers:

```
Layer 1: INPUT VALIDATION
  → Sanitize prompts, detect injection attempts, enforce length limits

Layer 2: PROMPT DESIGN
  → System message constraints, role prompting, few-shot examples

Layer 3: GENERATION CONTROLS
  → temperature=0, seed, max_tokens, structured output / JSON mode

Layer 4: GROUNDING
  → RAG retrieval, tool calling, citation requirements

Layer 5: OUTPUT VALIDATION
  → Groundedness check (≥4.0/5.0), content safety filter, schema validation

Layer 6: HUMAN OVERSIGHT
  → Confidence thresholds for escalation, feedback loops, audit logging
```

:::warning
Never rely on a single layer. Even with `temperature=0` + RAG + structured output, the model can still produce incorrect-but-plausible content. **Layer 5 (output validation)** is your last line of defense before the response reaches the user.
:::

## Evaluation: Measuring Determinism

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Groundedness** | ≥ 4.0 / 5.0 | Does the response use only retrieved evidence? |
| **Consistency** | ≥ 95% semantic match | Run same query 10×, compare outputs |
| **Accuracy** | ≥ 90% factual correctness | Human review against known-correct answers |
| **Refusal rate** | ≤ 5% false refusals | Model says "I don't know" when it should answer |
| **Hallucination rate** | ≤ 2% | Model fabricates facts not in context |

FrootAI Play 03 (Deterministic Agent) implements all six defense layers with automated evaluation. Play 01 (Enterprise RAG) applies grounding-focused determinism with groundedness scoring.

## Key Takeaways

1. **True determinism is impossible** — target **functional determinism** (semantic consistency)
2. **Hallucination is inherent** to autoregressive generation — defend in depth
3. **Stack all six layers** — no single technique is sufficient alone
4. **Structured output** is the strongest single lever — constrain at the decoding level
5. **Measure** with groundedness scores and consistency checks, not vibes

For orchestration patterns that manage these controls at scale, see [O1: Semantic Kernel](./o1-semantic-kernel.md).
