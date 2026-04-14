---
name: "prompt-version-manage"
description: "Version control prompts with A/B testing, rollback, and performance tracking"
---

# Prompt Version Management

Git-tracked prompt files with semantic versioning, A/B testing, rollback, and evaluation-gated promotion.

## Prompt File Structure

Store all prompts in a `prompts/` directory. Each prompt is a YAML file with metadata and the template body:

```
prompts/
├── summarize-ticket.yaml        # v2.1.0 (active)
├── classify-intent.yaml         # v1.3.0 (active)
├── extract-entities.yaml        # v1.0.0 (active)
└── archive/
    ├── summarize-ticket-v1.yaml # rolled back
    └── classify-intent-v1.yaml
```

### Prompt YAML Format

```yaml
# prompts/summarize-ticket.yaml
name: summarize-ticket
version: "2.1.0"
description: "Summarize support tickets into structured JSON"
model: gpt-4o
temperature: 0.2
max_tokens: 500
tags: [support, summarization, production]
created: "2026-03-15"
author: platform-team

template: |
  You are a support ticket analyst. Summarize the following ticket
  into structured JSON with fields: summary, category, priority, sentiment.

  Customer: {{ customer_name }}
  Ticket ID: {{ ticket_id }}
  Content:
  {{ ticket_body }}

  Respond ONLY with valid JSON. No markdown fences.
```

## Semantic Versioning for Prompts

Apply semver rules to prompt changes:

| Change Type | Version Bump | Example |
|-------------|-------------|---------|
| Fix typo, adjust whitespace | PATCH `2.1.0 → 2.1.1` | Fix trailing newline |
| Add field, tweak instructions | MINOR `2.1.0 → 2.2.0` | Add `sentiment` to output |
| Rewrite template, change model | MAJOR `2.1.0 → 3.0.0` | Switch from few-shot to CoT |

## Prompt Registry

Load prompts by name and version at runtime. The registry reads YAML files and resolves the active version from `config/prompts.json`:

```python
# prompt_registry.py
import yaml
from pathlib import Path
from jinja2 import Template

class PromptRegistry:
    def __init__(self, prompts_dir: str = "prompts", config_path: str = "config/prompts.json"):
        self.prompts_dir = Path(prompts_dir)
        self.active_versions = self._load_config(config_path)
        self._cache: dict[str, dict] = {}

    def _load_config(self, path: str) -> dict[str, str]:
        import json
        with open(path) as f:
            return json.load(f)["active_versions"]

    def get(self, name: str, version: str | None = None) -> dict:
        version = version or self.active_versions.get(name)
        cache_key = f"{name}@{version}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        prompt_file = self.prompts_dir / f"{name}.yaml"
        if not prompt_file.exists():
            raise FileNotFoundError(f"Prompt '{name}' not found in {self.prompts_dir}")

        with open(prompt_file) as f:
            prompt = yaml.safe_load(f)

        if version and prompt["version"] != version:
            # Check archive for the requested version
            archive = self.prompts_dir / "archive" / f"{name}-v{version.split('.')[0]}.yaml"
            if archive.exists():
                with open(archive) as f:
                    prompt = yaml.safe_load(f)
            else:
                raise ValueError(f"Version {version} not found for '{name}'")

        self._cache[cache_key] = prompt
        return prompt

    def render(self, name: str, variables: dict, version: str | None = None) -> str:
        prompt = self.get(name, version)
        template = Template(prompt["template"])
        return template.render(**variables)
```

## Active Version Config

`config/prompts.json` maps each prompt to its active version. CI/CD reads this to determine which version is live:

```json
{
  "active_versions": {
    "summarize-ticket": "2.1.0",
    "classify-intent": "1.3.0",
    "extract-entities": "1.0.0"
  },
  "ab_tests": {
    "summarize-ticket": {
      "control": "2.1.0",
      "variant": "3.0.0",
      "traffic_split": 0.2,
      "metric": "groundedness",
      "start_date": "2026-04-10"
    }
  }
}
```

## A/B Testing Prompts

Route a percentage of traffic to a candidate version and compare evaluation metrics:

```python
import random
from prompt_registry import PromptRegistry

class PromptRouter:
    def __init__(self, registry: PromptRegistry, config_path: str = "config/prompts.json"):
        import json
        with open(config_path) as f:
            self.ab_tests = json.load(f).get("ab_tests", {})
        self.registry = registry

    def resolve(self, name: str, variables: dict) -> tuple[str, str]:
        """Returns (rendered_prompt, version_used)."""
        if name in self.ab_tests:
            test = self.ab_tests[name]
            version = (
                test["variant"] if random.random() < test["traffic_split"]
                else test["control"]
            )
        else:
            version = None  # use active default

        rendered = self.registry.render(name, variables, version=version)
        used = version or self.registry.active_versions[name]
        return rendered, used
```

Log every call with the version used so you can compare metrics per version downstream.

## Rollback to Previous Version

Rollback is a one-line config change — update `config/prompts.json` and commit:

```python
def rollback_prompt(name: str, target_version: str, config_path: str = "config/prompts.json"):
    import json
    with open(config_path) as f:
        config = json.load(f)

    previous = config["active_versions"].get(name)
    config["active_versions"][name] = target_version

    # Remove any active A/B test for this prompt
    config.get("ab_tests", {}).pop(name, None)

    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)

    print(f"Rolled back '{name}': {previous} → {target_version}")
```

After rollback, `git commit -m "rollback: {name} to v{target_version}"` and deploy.

## Evaluation Before Promotion

Never promote a prompt version without running evaluation. Use a gate that checks groundedness, relevance, and coherence against thresholds:

```python
def evaluate_prompt_version(name: str, version: str, test_cases: list[dict],
                            thresholds: dict | None = None) -> bool:
    from prompt_registry import PromptRegistry

    thresholds = thresholds or {"groundedness": 4.0, "relevance": 4.0, "coherence": 4.0}
    registry = PromptRegistry()
    scores = {m: [] for m in thresholds}

    for case in test_cases:
        rendered = registry.render(name, case["variables"], version=version)
        result = call_llm(rendered)  # your LLM call wrapper
        eval_scores = run_evaluation(result, case["expected"])  # your eval function
        for metric in thresholds:
            scores[metric].append(eval_scores[metric])

    averages = {m: sum(s) / len(s) for m, s in scores.items()}
    passed = all(averages[m] >= thresholds[m] for m in thresholds)

    print(f"Eval '{name}' v{version}: {averages} — {'PASS' if passed else 'FAIL'}")
    return passed
```

## Prompt Template Variables

Use Jinja2 syntax for template variables. Keep variable names descriptive and document them in the YAML metadata:

```yaml
name: extract-entities
version: "1.0.0"
variables:
  - name: document_text
    required: true
    description: "Raw document content to extract entities from"
  - name: entity_types
    required: false
    default: "person, organization, location, date"
    description: "Comma-separated entity types to extract"

template: |
  Extract the following entity types from the document: {{ entity_types }}.

  Document:
  {{ document_text }}

  Return a JSON array of {type, value, confidence} objects.
```

## Migration Between Versions

When a major version changes the template contract (different variables, different output schema), create a migration note in the YAML:

```yaml
name: summarize-ticket
version: "3.0.0"
migration:
  from: "2.1.0"
  breaking_changes:
    - "Output adds 'urgency' field (string: low/medium/high/critical)"
    - "Removed 'priority' field — replaced by 'urgency'"
    - "Requires new variable: 'sla_tier'"
  rollback_safe: false

template: |
  You are a support ticket analyst. Given the SLA tier {{ sla_tier }},
  summarize this ticket with fields: summary, category, urgency, sentiment.
  ...
```

## Git Workflow

Track prompts in git like code. Use conventional commits:

```bash
# New prompt
git add prompts/extract-entities.yaml
git commit -m "feat(prompts): add extract-entities v1.0.0"

# Version bump after evaluation passes
git commit -m "feat(prompts): promote summarize-ticket to v3.0.0"

# Rollback
git commit -m "fix(prompts): rollback summarize-ticket to v2.1.0"

# Archive old version before overwriting
cp prompts/summarize-ticket.yaml prompts/archive/summarize-ticket-v2.yaml
git commit -m "chore(prompts): archive summarize-ticket v2.1.0"
```

## Checklist

- [ ] Each prompt has a YAML file with `name`, `version`, `template`
- [ ] `config/prompts.json` tracks active versions
- [ ] A/B tests define `traffic_split`, `metric`, and `start_date`
- [ ] Evaluation gate passes before any version promotion
- [ ] Rollback updates config and removes active A/B test
- [ ] Breaking changes documented in `migration` block
- [ ] Git history shows full prompt evolution
