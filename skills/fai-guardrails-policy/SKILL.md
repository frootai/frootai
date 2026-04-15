---
name: fai-guardrails-policy
description: |
  Define AI guardrails with enforceable content safety thresholds, output validation,
  escalation paths, and governance evidence. Use when implementing safety policies
  for production AI systems.
---

# AI Guardrails Policy

Define and enforce safety thresholds, content filters, and escalation controls.

## When to Use

- Deploying AI to production with safety requirements
- Implementing content safety filtering
- Setting up output validation with Pydantic schemas
- Creating escalation paths for edge cases

---

## Guardrails Configuration

```json
{
  "guardrails": {
    "content_safety": {
      "enabled": true,
      "categories": ["hate", "violence", "self_harm", "sexual"],
      "severity_threshold": 2,
      "action": "block"
    },
    "groundedness": {
      "threshold": 0.80,
      "action": "warn"
    },
    "pii_detection": {
      "enabled": true,
      "categories": ["email", "phone", "ssn", "credit_card"],
      "action": "redact"
    },
    "output_validation": {
      "schema_enforcement": true,
      "max_tokens": 2000
    }
  }
}
```

## Content Safety Check

```python
from azure.ai.contentsafety import ContentSafetyClient
from azure.identity import DefaultAzureCredential

safety_client = ContentSafetyClient(endpoint, DefaultAzureCredential())

def check_safety(text: str, threshold: int = 2) -> dict:
    from azure.ai.contentsafety.models import AnalyzeTextOptions
    result = safety_client.analyze_text(AnalyzeTextOptions(text=text))
    violations = [c for c in result.categories_analysis if c.severity >= threshold]
    return {"safe": len(violations) == 0, "violations": [
        {"category": v.category, "severity": v.severity} for v in violations]}
```

## Output Validation Pipeline

```python
from pydantic import BaseModel, field_validator

class SafeOutput(BaseModel):
    answer: str
    confidence: float
    sources: list[str]

    @field_validator("confidence")
    @classmethod
    def check_range(cls, v):
        assert 0 <= v <= 1, "Confidence must be 0-1"
        return v

def guardrailed_generate(prompt: str, context: str) -> SafeOutput:
    # 1. Check input safety
    input_check = check_safety(prompt)
    if not input_check["safe"]:
        return SafeOutput(answer="I cannot process this request.",
                          confidence=0, sources=[])

    # 2. Generate
    raw = generate_answer(prompt, context)

    # 3. Check output safety
    output_check = check_safety(raw)
    if not output_check["safe"]:
        return SafeOutput(answer="Response filtered for safety.",
                          confidence=0, sources=[])

    # 4. Validate structure
    return SafeOutput.model_validate_json(raw)
```

## Escalation Matrix

| Condition | Action | Owner |
|-----------|--------|-------|
| Content safety violation | Block + log | Automated |
| Groundedness < 0.5 | Escalate to human | Support team |
| Repeated user violations | Rate limit + notify | Trust & Safety |
| System prompt extraction attempt | Block + alert | Security team |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| False positives blocking valid content | Threshold too strict | Raise severity threshold from 2 to 4 |
| Guardrails bypassed | Only checking output, not input | Check both input AND output |
| No audit trail | Violations not logged | Log every safety check result |
| Schema validation fails silently | No error handling | Wrap in try/except, return safe fallback |
