---
name: fai-tune-03-deterministic-agent
description: |
  Tune Deterministic Agent (Play 03) for output repeatability, schema compliance,
  and guardrail calibration. Use when optimizing agents that must produce
  consistent, structured outputs.
---

# Tune Deterministic Agent (Play 03)

Optimize agent configuration for repeatable outputs and schema compliance.

## When to Use

- Agent outputs vary between runs (non-deterministic)
- Schema validation failure rate too high
- Guardrail thresholds need calibration
- Temperature or seed settings need tuning

---

## Determinism Config

```json
{
  "model": "gpt-4o",
  "temperature": 0,
  "seed": 42,
  "max_tokens": 1024,
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "classification",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {
          "category": { "type": "string", "enum": ["bug", "feature", "question"] },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
        },
        "required": ["category", "confidence"],
        "additionalProperties": false
      }
    }
  }
}
```

## Repeatability Test

```python
def test_determinism(prompt: str, model: str, seed: int, runs: int = 10) -> dict:
    outputs = []
    for _ in range(runs):
        resp = client.chat.completions.create(
            model=model, seed=seed, temperature=0,
            messages=[{"role": "user", "content": prompt}],
        )
        outputs.append(resp.choices[0].message.content)
    unique = len(set(outputs))
    return {"deterministic": unique == 1, "unique": unique, "runs": runs}
```

## Guardrail Calibration

```python
def calibrate_thresholds(eval_results: list[dict]) -> dict:
    """Find thresholds that pass 95% of good examples and fail 95% of bad."""
    from numpy import percentile
    good = [r["score"] for r in eval_results if r["label"] == "good"]
    bad = [r["score"] for r in eval_results if r["label"] == "bad"]
    return {
        "recommended_threshold": percentile(good, 5),  # 95% of good passes
        "false_positive_rate": sum(1 for b in bad if b >= percentile(good, 5)) / len(bad),
    }
```

## Schema Compliance Check

```python
from pydantic import BaseModel, ValidationError

def check_compliance(outputs: list[str], schema: type[BaseModel]) -> dict:
    valid = 0
    errors = []
    for out in outputs:
        try:
            schema.model_validate_json(out)
            valid += 1
        except ValidationError as e:
            errors.append(str(e)[:100])
    return {"compliance_rate": valid / len(outputs), "sample_errors": errors[:5]}
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Non-deterministic output | Temperature > 0 or no seed | Set temperature=0, seed=42 |
| Schema validation fails | Model ignores strict mode | Use response_format with strict=true |
| Confidence always 1.0 | No calibration data | Train on diverse examples |
| Different results per deploy | Model version changed | Pin model version in config |
