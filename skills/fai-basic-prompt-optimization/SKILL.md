---
name: fai-basic-prompt-optimization
description: |
  Optimize baseline prompts with role framing, output constraints, few-shot examples,
  and deterministic output validation. Use when improving prompt quality, reducing
  hallucinations, or standardizing LLM output format.
---

# Prompt Optimization Patterns

Techniques for improving prompt quality, consistency, and safety.

## When to Use

- Prompts producing inconsistent or verbose output
- LLM hallucinating facts not in the provided context
- Need structured JSON/markdown output from free-form prompts
- Setting up prompt evaluation baselines

---

## Pattern 1: Role + Constraints + Format

```python
SYSTEM_PROMPT = """You are a technical documentation assistant.

Rules:
- Answer ONLY from the provided context. If the answer is not in the context, say "I don't know."
- Never fabricate URLs, citations, or code that isn't grounded in context.
- Output valid JSON matching the schema below.
- Keep responses under 200 words.

Output schema:
{"answer": "string", "confidence": "high|medium|low", "sources": ["string"]}"""

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Context: {context}\n\nQuestion: {question}"},
    ],
    temperature=0.2,
    response_format={"type": "json_object"},
)
```

## Pattern 2: Few-Shot Examples

```python
FEW_SHOT = [
    {"role": "user", "content": "Context: Azure Functions supports Python 3.11.\nQuestion: What Python versions are supported?"},
    {"role": "assistant", "content": '{"answer": "Python 3.11", "confidence": "high", "sources": ["Azure Functions supports Python 3.11."]}'},
    {"role": "user", "content": "Context: Azure SQL costs vary by tier.\nQuestion: How much does Azure SQL cost?"},
    {"role": "assistant", "content": '{"answer": "Costs vary by tier. Check Azure pricing calculator for specifics.", "confidence": "medium", "sources": ["Azure SQL costs vary by tier."]}'},
]

messages = [{"role": "system", "content": SYSTEM_PROMPT}] + FEW_SHOT + [
    {"role": "user", "content": f"Context: {context}\n\nQuestion: {question}"}
]
```

## Pattern 3: Chain of Thought

```python
COT_PROMPT = """Think step by step:
1. Identify the key entities in the question
2. Find relevant information in the context
3. Formulate a grounded answer
4. Rate your confidence

Wrap your reasoning in <thinking> tags, then provide the final answer as JSON."""
```

## Pattern 4: Output Validation

```python
import json
from pydantic import BaseModel, field_validator

class PromptResponse(BaseModel):
    answer: str
    confidence: str
    sources: list[str]

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v):
        assert v in ("high", "medium", "low"), f"Invalid confidence: {v}"
        return v

def safe_parse(raw: str) -> PromptResponse | None:
    try:
        return PromptResponse.model_validate_json(raw)
    except Exception:
        return None
```

## Temperature Guide

| Temperature | Use Case | Example |
|-------------|----------|---------|
| 0.0 | Deterministic extraction, classification | Entity extraction, sentiment |
| 0.2 | Factual Q&A, documentation | RAG answers, code review |
| 0.5 | Balanced creativity + accuracy | Email drafting, summaries |
| 0.8-1.0 | Creative generation | Brainstorming, marketing copy |

## Evaluation Baseline

```python
def evaluate_prompt(prompt_fn, dataset: list[dict], threshold: float = 0.8) -> dict:
    correct = 0
    for row in dataset:
        result = prompt_fn(row["context"], row["question"])
        parsed = safe_parse(result)
        if parsed and parsed.answer.strip() == row["expected"].strip():
            correct += 1
    accuracy = correct / len(dataset)
    return {"accuracy": accuracy, "passed": accuracy >= threshold, "n": len(dataset)}
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Verbose/inconsistent output | No output constraints | Add word limit + JSON response_format |
| Hallucinated facts | No grounding instruction | Add "answer ONLY from context" rule |
| JSON parse failures | Model not following schema | Add few-shot examples + lower temperature |
| Low accuracy on eval | Prompt too generic | Add domain-specific few-shot examples |
