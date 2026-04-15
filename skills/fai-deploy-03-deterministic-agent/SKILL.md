---
name: fai-deploy-03-deterministic-agent
description: |
  Deploy Deterministic Agent (Play 03) with structured output enforcement,
  seed pinning, guardrail validation, and evaluation gates. Covers deployment
  of zero-temperature agents with JSON schema compliance.
---

# Deploy Deterministic Agent (Play 03)

Deploy agents with repeatable outputs, schema compliance, and safety guardrails.

## When to Use

- Deploying agents that must produce consistent structured output
- Enforcing JSON schema compliance on LLM responses
- Setting up evaluation gates for determinism verification
- Configuring zero-temperature deployments with seed pinning

---

## Configuration

```json
{
  "model": "gpt-4o",
  "temperature": 0,
  "seed": 42,
  "response_format": { "type": "json_schema", "json_schema": {
    "name": "analysis_result",
    "strict": true,
    "schema": {
      "type": "object",
      "properties": {
        "category": { "type": "string", "enum": ["bug", "feature", "question"] },
        "severity": { "type": "string", "enum": ["low", "medium", "high", "critical"] },
        "summary": { "type": "string" },
        "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
      },
      "required": ["category", "severity", "summary", "confidence"],
      "additionalProperties": false
    }
  }}
}
```

## Deployment

```bash
# Deploy with structured output config
az webapp deploy --resource-group rg-agent-prod \
  --name app-agent-prod --src-path dist/agent.zip

# Verify determinism
python tests/determinism/test_repeatable.py --seed 42 --runs 5
```

## Determinism Verification

```python
def verify_determinism(prompt: str, model: str, seed: int, runs: int = 5) -> dict:
    outputs = []
    for _ in range(runs):
        resp = client.chat.completions.create(
            model=model, seed=seed, temperature=0,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
        outputs.append(resp.choices[0].message.content)
    unique = len(set(outputs))
    return {"deterministic": unique == 1, "unique_outputs": unique, "runs": runs}
```

## Guardrail Validation

```python
from pydantic import BaseModel, field_validator

class AnalysisResult(BaseModel):
    category: str
    severity: str
    summary: str
    confidence: float

    @field_validator("confidence")
    @classmethod
    def check_confidence(cls, v):
        assert 0 <= v <= 1, f"Confidence {v} out of range"
        return v

def validate_output(raw: str) -> AnalysisResult:
    return AnalysisResult.model_validate_json(raw)
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Non-deterministic output | Missing seed or temp > 0 | Set seed + temperature=0 |
| Schema validation fails | Model ignores strict schema | Use response_format with strict=true |
| Guardrail bypass | No server-side validation | Always validate with Pydantic |
| Different results per deploy | Model version changed | Pin model version in deployment |
