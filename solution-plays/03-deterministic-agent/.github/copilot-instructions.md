---
description: "Deterministic Agent domain knowledge — auto-injected into every Copilot conversation in this workspace"
applyTo: "**"
---

# Deterministic Agent — Domain Knowledge

This workspace implements a deterministic AI agent — zero-temperature, reproducible, guardrailed. The agent produces consistent outputs for the same inputs, abstains when uncertain, and never hallucinates.

## Deterministic Agent Principles (What the Model Gets Wrong)

### Temperature Must Be 0 (Not 0.1, Not "Low")
```python
# WRONG — 0.1 still produces variation between runs
response = client.chat.completions.create(model="gpt-4o", temperature=0.1, ...)

# CORRECT — temperature=0 for true determinism
response = client.chat.completions.create(model="gpt-4o", temperature=0, seed=42, ...)
```

### Seed Parameter for Reproducibility
```python
# Same seed + same input = same output (within model version)
response = client.chat.completions.create(
    model="gpt-4o",
    temperature=0,
    seed=42,                          # Fixed seed for reproducibility
    messages=[...],
)
fingerprint = response.system_fingerprint  # Log this — changes indicate model update
```

### Abstention Pattern (Refuse When Uncertain)
```python
SYSTEM_PROMPT = """You are a deterministic agent. Rules:
1. Answer ONLY if you are confident based on the provided context.
2. If uncertain, respond: {"action": "abstain", "reason": "Insufficient context for confident answer"}
3. NEVER guess, speculate, or provide uncertain information.
4. Include confidence score (0.0-1.0) with every response.
5. If confidence < 0.8, abstain instead of answering."""

# Response validation
if response.confidence < 0.8:
    return {"action": "abstain", "reason": response.reason}
```

### Output Validation (Structured Output Only)
```python
from pydantic import BaseModel, Field

class DeterministicResponse(BaseModel):
    action: str = Field(..., description="The action taken: answer, abstain, escalate")
    content: str | None = Field(None, description="Answer content if action=answer")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score")
    reasoning: str = Field(..., description="Step-by-step reasoning chain")
    sources: list[str] = Field(default_factory=list, description="Source references")

# Force structured output — no free-text responses
response = client.chat.completions.create(
    model="gpt-4o",
    temperature=0,
    response_format={"type": "json_schema", "json_schema": DeterministicResponse.model_json_schema()},
    messages=[...],
)
```

## Guardrail Patterns

### Input Validation
```python
def validate_input(query: str) -> bool:
    if len(query) > 2000: raise ValueError("Query exceeds 2000 char limit")
    if not query.strip(): raise ValueError("Empty query")
    # Content safety check
    safety_result = content_safety_client.analyze_text(text=query)
    if any(c.severity >= 4 for c in safety_result.categories_analysis):
        raise ValueError(f"Content safety violation: {safety_result}")
    return True
```

### Output Guardrails
```python
def validate_output(response: DeterministicResponse) -> DeterministicResponse:
    # Check for hallucination markers
    hallucination_phrases = ["I think", "probably", "might be", "I'm not sure", "it's possible"]
    if any(p in response.content.lower() for p in hallucination_phrases):
        return DeterministicResponse(action="abstain", confidence=0.0,
            reasoning="Response contained uncertainty markers — abstaining")
    # Verify confidence matches content
    if response.action == "answer" and response.confidence < 0.8:
        response.action = "abstain"
    return response
```

## Testing Deterministic Agents

| Test Type | What to Verify | How |
|-----------|---------------|-----|
| Reproducibility | Same input → same output (10 runs) | Run 10x with seed=42, compare outputs |
| Abstention | Uncertain queries → abstain response | Test with out-of-scope questions |
| Confidence calibration | Confidence scores correlate with accuracy | Compare confidence vs ground truth |
| Guardrail enforcement | Blocked content → rejection | Test with adversarial inputs |
| Structured output | Every response parses as valid JSON | Validate against Pydantic schema |
| Latency consistency | Response time variance < 20% | Measure p50/p95/p99 across runs |

## Common Mistakes in Deterministic Agents

| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| temperature=0.1 | Still produces variation | temperature=0 + seed parameter |
| Free-text responses | Unparseable, inconsistent format | Structured output (JSON schema) |
| No abstention logic | Agent guesses when unsure | Add confidence threshold (0.8) |
| No input validation | Prompt injection risk | Validate + content safety check |
| Logging full prompts | PII exposure | Log query hash + response metadata only |
| No fingerprint tracking | Silent model updates break determinism | Log system_fingerprint, alert on changes |
| No idempotency key | Duplicate requests produce side effects | Hash input → cache response |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | model, temperature (MUST be 0), seed, max_tokens |
| `config/guardrails.json` | confidence_threshold, abstention_rules, safety_levels |
| `config/agents.json` | agent chain behavior, escalation rules |

## Available Specialist Agents (optional)

| Agent | Use For |
|-------|---------|
| `@builder` | Implement deterministic agent pipeline, structured outputs, guardrails |
| `@reviewer` | Audit reproducibility, abstention logic, security, guardrail coverage |
| `@tuner` | Optimize confidence thresholds, latency, model selection, caching |

## Slash Commands
| Command | Action |
|---------|--------|
| `/deploy` | Deploy agent infrastructure |
| `/test` | Run reproducibility + guardrail tests |
| `/review` | Audit determinism + security |
| `/evaluate` | Evaluate confidence calibration + abstention rates |
