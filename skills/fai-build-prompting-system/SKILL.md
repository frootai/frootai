---
name: fai-build-prompting-system
description: |
  Build prompt management with template versioning, variable injection, guardrails,
  output validation, and A/B testing. Use when managing prompts at scale across
  multiple AI features.
---

# Prompt Management System

Build versioned, testable, and guarded prompt systems for production AI.

## When to Use

- Managing 10+ prompts across multiple features
- Need version control and rollback for prompt changes
- Implementing A/B testing of prompt variants
- Adding guardrails and output validation

---

## Prompt Template

```python
from dataclasses import dataclass
from string import Template

@dataclass
class PromptTemplate:
    name: str
    version: str
    system: str
    user: str
    temperature: float = 0.3

    def render(self, **vars) -> list[dict]:
        return [
            {"role": "system", "content": Template(self.system).safe_substitute(vars)},
            {"role": "user", "content": Template(self.user).safe_substitute(vars)},
        ]

RAG_V2 = PromptTemplate(
    name="rag-answer", version="2.0",
    system="You are a $domain assistant. Answer ONLY from context.\nRules: $rules",
    user="Context:\n$context\n\nQuestion: $question",
)
```

## Prompt Registry

```python
class PromptRegistry:
    def __init__(self):
        self._prompts = {}
    def register(self, prompt):
        self._prompts.setdefault(prompt.name, {})[prompt.version] = prompt
    def get(self, name, version="latest"):
        versions = self._prompts[name]
        return versions[max(versions.keys())] if version == "latest" else versions[version]

registry = PromptRegistry()
registry.register(RAG_V2)
```

## Output Guardrails

```python
from pydantic import BaseModel

class GuardedOutput(BaseModel):
    answer: str
    confidence: str
    sources: list[str]

def execute(prompt, client, **vars):
    messages = prompt.render(**vars)
    resp = client.chat.completions.create(
        model="gpt-4o-mini", messages=messages,
        temperature=prompt.temperature,
        response_format={"type": "json_object"},
    )
    return GuardedOutput.model_validate_json(resp.choices[0].message.content)
```

## A/B Testing

```python
def ab_prompt(name, variants, user_id):
    idx = hash(f"{name}:{user_id}") % len(variants)
    return registry.get(name, variants[idx])
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Prompt regression | No version control | Use registry with versions |
| Parse failures | Model ignoring schema | Add few-shot + lower temp |
| A/B inconclusive | Small sample | Run 1000+ per variant |
| Guardrail bypass | No validation | Always validate with Pydantic |
