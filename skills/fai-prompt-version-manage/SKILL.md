---
name: fai-prompt-version-manage
description: |
  Version control prompts with file-based storage, A/B deployment, rollback,
  and performance tracking. Use when managing prompt changes across environments
  with audit trails and quality gates.
---

# Prompt Version Management

Version, deploy, and track prompts with rollback and A/B testing.

## When to Use

- Managing prompt changes across dev/staging/prod
- A/B testing prompt variants in production
- Rolling back prompt changes when quality drops
- Tracking prompt performance metrics over time

---

## File-Based Prompt Versioning

```
prompts/
  rag-answer/
    v1.0.md
    v1.1.md
    v2.0.md
    config.json
```

```json
{
  "name": "rag-answer",
  "active": "v2.0",
  "rollback": "v1.1",
  "variants": {
    "v1.0": {"status": "deprecated"},
    "v1.1": {"status": "rollback-ready"},
    "v2.0": {"status": "active", "deployed": "2026-04-15"}
  }
}
```

## Prompt Loader

```python
from pathlib import Path
import json

class PromptManager:
    def __init__(self, prompts_dir: str = "prompts"):
        self.dir = Path(prompts_dir)

    def load(self, name: str, version: str = None) -> str:
        config = json.loads((self.dir / name / "config.json").read_text())
        version = version or config["active"]
        return (self.dir / name / f"{version}.md").read_text()

    def rollback(self, name: str):
        config_path = self.dir / name / "config.json"
        config = json.loads(config_path.read_text())
        config["active"] = config["rollback"]
        config_path.write_text(json.dumps(config, indent=2))

    def list_versions(self, name: str) -> list[str]:
        return sorted(p.stem for p in (self.dir / name).glob("v*.md"))

pm = PromptManager()
prompt = pm.load("rag-answer")  # Gets active version
```

## A/B Deployment

```python
import hashlib

def ab_select(name: str, user_id: str, variants: list[str]) -> str:
    """Deterministic variant selection based on user ID."""
    hash_val = int(hashlib.md5(f"{name}:{user_id}".encode()).hexdigest(), 16)
    return variants[hash_val % len(variants)]

# Usage
variant = ab_select("rag-answer", user_id, ["v1.1", "v2.0"])
prompt = pm.load("rag-answer", version=variant)
```

## Performance Tracking

```python
def track_prompt_performance(name: str, version: str, metrics: dict):
    """Log prompt version + quality metrics for comparison."""
    entry = {"prompt": name, "version": version,
             "timestamp": datetime.now().isoformat(), **metrics}
    with open("prompt-metrics.jsonl", "a") as f:
        f.write(json.dumps(entry) + "\n")
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Wrong version served | Config not updated | Check config.json active field |
| Rollback not working | No rollback version set | Always maintain rollback pointer |
| A/B results skewed | Non-deterministic selection | Use hash-based assignment |
| Metric comparison invalid | Different traffic mix | Ensure same user segments per variant |
