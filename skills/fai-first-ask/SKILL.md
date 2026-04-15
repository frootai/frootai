---
name: fai-first-ask
description: |
  Define first-question strategies that maximize context clarity and reduce
  ambiguity before execution. Use when building AI assistants that need to
  gather requirements before acting.
---

# First Ask Strategy

Ask the right clarifying questions before executing to reduce rework.

## When to Use

- Building AI assistants that gather requirements
- Reducing ambiguity before code generation
- Implementing interactive planning workflows
- Training agents to ask before assuming

---

## Question Framework

```python
FIRST_ASK_TEMPLATE = """Before I start, I need to clarify a few things:

1. **What is the primary deliverable?**
   (code, config, document, architecture, analysis)

2. **What technology stack?**
   (Python/FastAPI, .NET/Minimal API, Node/Express, Bicep, Terraform)

3. **What environment?**
   (local dev, Azure dev, staging, production)

4. **What constraints matter most?**
   (cost, latency, security, compliance, time-to-deploy)

5. **What does "done" look like?**
   (tests pass, deploys successfully, meets SLA, approved by reviewer)
"""
```

## Structured Requirements Capture

```python
from pydantic import BaseModel
from typing import Optional

class Requirements(BaseModel):
    deliverable: str
    stack: str
    environment: str
    constraints: list[str]
    done_criteria: str
    additional_context: Optional[str] = None

def extract_requirements(user_message: str) -> Requirements:
    resp = client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Extract project requirements from the user message."},
            {"role": "user", "content": user_message},
        ],
        response_format=Requirements,
    )
    return resp.choices[0].message.parsed
```

## Ambiguity Detection

```python
AMBIGUITY_SIGNALS = [
    "build me a", "create an app", "set up", "help me with",
    "something like", "make it work", "fix this",
]

def needs_first_ask(message: str) -> bool:
    msg_lower = message.lower()
    return any(signal in msg_lower for signal in AMBIGUITY_SIGNALS)
```

## Anti-Patterns

| Pattern | Problem | Better |
|---------|---------|--------|
| "Build me an API" | No stack, no scope | "Build a FastAPI endpoint for chat with Pydantic validation" |
| "Fix the bug" | No reproduction steps | "The /health endpoint returns 500 when DB is cold" |
| "Make it faster" | No baseline or target | "Reduce P95 latency from 3s to under 1s" |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Agent asks too many questions | No limit on clarifications | Cap at 3-5 focused questions |
| User frustrated by questions | Questions too generic | Make questions specific to the detected domain |
| Still ambiguous after asking | User gave vague answers | Provide options: "A, B, or C?" |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Always include grounding rules | Prevents hallucination |
| Set explicit output format | Consistent, parseable responses |
| Use temperature 0-0.3 for factual tasks | Reduces randomness |
| Add few-shot examples for complex formats | Shows model the expected pattern |
| Test prompts with evaluation dataset | Measure quality objectively |
| Version control all prompts | Track changes, enable rollback |

## Prompt Quality Checklist

- [ ] Role clearly defined
- [ ] Output format specified (JSON schema, markdown, etc.)
- [ ] Grounding rule: "Answer ONLY from context"
- [ ] Safety rules: refuse harmful content
- [ ] Length constraint specified
- [ ] Few-shot examples for complex tasks
- [ ] Tested against evaluation dataset

## Related Skills

- `fai-prompt-builder` — Structured prompt construction
- `fai-boost-prompt` — Interactive prompt refinement
- `fai-basic-prompt-optimization` — Prompt quality patterns
- `fai-finalize-agent-prompt` — Production prompt validation
