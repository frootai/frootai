---
description: "Play 18 patterns — Prompt management patterns — version control, A/B testing, template variables, prompt libraries."
applyTo: "**/*.py, **/*.json"
waf:
  - "reliability"
  - "security"
---

# Play 18 — Prompt Management Patterns — FAI Standards

## Prompt Versioning

Semver prompt files tracked in git. Each prompt is a standalone YAML file with metadata:

```python
# prompts/classify-ticket/v2.1.0.yaml
# ---
# name: classify-ticket
# version: 2.1.0
# model: gpt-4o-mini
# temperature: 0.0
# author: ops-team
# created: 2026-03-15
# changelog: Added priority extraction, removed legacy category field

import yaml
from pathlib import Path

def load_prompt(name: str, version: str = "latest") -> dict:
    prompt_dir = Path(f"prompts/{name}")
    if version == "latest":
        versions = sorted(prompt_dir.glob("v*.yaml"), reverse=True)
        path = versions[0]
    else:
        path = prompt_dir / f"v{version}.yaml"
    return yaml.safe_load(path.read_text())
```

## Prompt Registry

Centralized store indexing all prompts with metadata, usage stats, and lineage:

```python
import hashlib, json
from datetime import datetime

class PromptRegistry:
    def __init__(self, registry_path: str = "config/prompt-registry.json"):
        self.registry = json.loads(Path(registry_path).read_text())

    def resolve(self, name: str, variant: str = "default") -> dict:
        entry = self.registry["prompts"][name]
        v = entry["variants"][variant]
        return {"template": v["template"], "model": v["model"],
                "temperature": v["temperature"], "version": v["version"]}

    def record_usage(self, name: str, variant: str, latency_ms: float, score: float):
        """Append usage telemetry for A/B analysis."""
        self.registry["prompts"][name]["variants"][variant]["calls"] += 1
        # Flush to Application Insights, not local file in production
```

## A/B Testing Prompts

Traffic splitting with metric comparison — variant assignment is deterministic per user:

```python
import hashlib

def assign_variant(user_id: str, experiment: str, variants: list[str]) -> str:
    seed = hashlib.sha256(f"{user_id}:{experiment}".encode()).hexdigest()
    bucket = int(seed[:8], 16) % 100
    # config/experiments.json defines splits: {"control": 50, "candidate": 50}
    cumulative = 0
    for v in variants:
        cumulative += variants[v]  # percentage
        if bucket < cumulative:
            return v
    return variants[-1]

def compare_variants(metrics: dict[str, list[float]]) -> str:
    """Returns winning variant if statistically significant (p < 0.05)."""
    from scipy.stats import mannwhitneyu
    control, candidate = metrics["control"], metrics["candidate"]
    stat, p = mannwhitneyu(control, candidate, alternative="two-sided")
    if p < 0.05:
        return "candidate" if sum(candidate)/len(candidate) > sum(control)/len(control) else "control"
    return "no_winner"
```

## Evaluation Pipeline

Automated quality scoring — runs in CI before any prompt version is promoted:

```python
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential

def evaluate_prompt(prompt_template: str, test_cases: list[dict], thresholds: dict) -> dict:
    client = AzureOpenAI(azure_ad_token_provider=DefaultAzureCredential())
    scores = {"groundedness": [], "relevance": [], "coherence": []}
    for case in test_cases:
        rendered = prompt_template.format(**case["variables"])
        response = client.chat.completions.create(
            model="gpt-4o", messages=[{"role": "user", "content": rendered}],
            temperature=0.0, max_tokens=case.get("max_tokens", 500))
        result = response.choices[0].message.content
        scores["groundedness"].append(score_groundedness(result, case["reference"]))
        scores["relevance"].append(score_relevance(result, case["query"]))
    averages = {k: sum(v)/len(v) for k, v in scores.items()}
    passed = all(averages[k] >= thresholds[k] for k in thresholds)
    return {"passed": passed, "scores": averages}
```

## Prompt Templates with Variables

Jinja2 templates with validation — reject undefined variables at render time:

```python
from jinja2 import Environment, StrictUndefined, BaseLoader

env = Environment(loader=BaseLoader(), undefined=StrictUndefined)

def render_prompt(template_str: str, variables: dict) -> str:
    template = env.from_string(template_str)
    return template.render(**variables)  # Raises UndefinedError on missing vars

# Template: "Classify this {{domain}} ticket: {{ticket_text}}\nPriority: {{priority_levels}}"
```

## DSPy for Prompt Optimization

Signatures define I/O contracts; optimizers compile optimal prompts from examples:

```python
import dspy

class TicketClassifier(dspy.Signature):
    """Classify IT support ticket into category and priority."""
    ticket_text: str = dspy.InputField(desc="raw ticket text")
    category: str = dspy.OutputField(desc="one of: hardware, software, network, access")
    priority: str = dspy.OutputField(desc="one of: P1, P2, P3, P4")

# BootstrapFewShot compiles optimal prompt from labeled examples
optimizer = dspy.BootstrapFewShot(metric=lambda pred, gold: pred.category == gold.category)
compiled = optimizer.compile(dspy.Predict(TicketClassifier), trainset=labeled_data)
compiled.save("prompts/ticket-classifier-compiled.json")
```

## Prompt Caching

Hash-based deduplication — identical prompts with identical params hit cache:

```python
import hashlib, json, redis

cache = redis.Redis.from_url("rediss://cache.redis.cache.windows.net:6380")

def cached_completion(messages: list[dict], model: str, temperature: float, ttl: int = 3600) -> str:
    key = hashlib.sha256(json.dumps({"m": messages, "model": model, "t": temperature},
                                     sort_keys=True).encode()).hexdigest()
    if cached := cache.get(f"prompt:{key}"):
        return json.loads(cached)
    result = client.chat.completions.create(model=model, messages=messages, temperature=temperature)
    content = result.choices[0].message.content
    cache.setex(f"prompt:{key}", ttl, json.dumps(content))
    return content
```

## Rollback to Previous Version

Atomic promotion with instant rollback — active version is a pointer, not a copy:

```python
def promote_prompt(name: str, version: str, registry_path: str = "config/prompt-registry.json"):
    registry = json.loads(Path(registry_path).read_text())
    entry = registry["prompts"][name]
    entry["previous_version"] = entry.get("active_version")
    entry["active_version"] = version
    Path(registry_path).write_text(json.dumps(registry, indent=2))

def rollback_prompt(name: str, registry_path: str = "config/prompt-registry.json"):
    registry = json.loads(Path(registry_path).read_text())
    entry = registry["prompts"][name]
    if prev := entry.get("previous_version"):
        entry["active_version"], entry["previous_version"] = prev, entry["active_version"]
        Path(registry_path).write_text(json.dumps(registry, indent=2))
```

## Prompt Chain Composition

Sequential chains where each step's output feeds the next — config-driven step ordering:

```python
def run_chain(chain_config: list[dict], initial_input: str) -> str:
    context = initial_input
    for step in chain_config:
        prompt = load_prompt(step["prompt_name"], step.get("version", "latest"))
        rendered = render_prompt(prompt["template"], {"input": context, **step.get("vars", {})})
        context = cached_completion([{"role": "user", "content": rendered}],
                                     model=step["model"], temperature=step["temperature"])
    return context

# config/chains.json: [{"prompt_name": "extract-entities", "model": "gpt-4o-mini", "temperature": 0},
#                       {"prompt_name": "synthesize-report", "model": "gpt-4o", "temperature": 0.3}]
```

## Meta-Prompting

Prompts that generate prompts — the meta-prompt produces domain-specific prompt templates:

```python
META_PROMPT = """Generate a classification prompt for the domain: {domain}.
Requirements: zero-shot, structured JSON output, max 200 tokens.
Include: system message, output schema, 2 few-shot examples.
Output as a valid YAML prompt file with version, model, and template fields."""

def generate_prompt(domain: str) -> str:
    return cached_completion([{"role": "user", "content": META_PROMPT.format(domain=domain)}],
                              model="gpt-4o", temperature=0.7)
```

## Prompt Compression

Reduce token count without losing semantic meaning — critical for cost optimization:

```python
def compress_prompt(prompt: str, target_ratio: float = 0.6) -> str:
    """LLMLingua-style compression: remove low-entropy tokens."""
    response = client.chat.completions.create(
        model="gpt-4o-mini", temperature=0.0,
        messages=[{"role": "system", "content": "Compress the following prompt to "
                   f"{int(target_ratio*100)}% of its length. Preserve all instructions, "
                   "constraints, and output format requirements. Remove only filler words."},
                  {"role": "user", "content": prompt}])
    return response.choices[0].message.content
```

## Configuration-Driven Prompt Selection

All prompt routing decisions come from `config/prompts.json` — zero hardcoded model or prompt choices:

```python
# config/prompts.json: {"routes": {"classification": {"prompt": "classify-v2", "model": "gpt-4o-mini"},
#                                   "summarization": {"prompt": "summarize-v3", "model": "gpt-4o"}}}
def route_prompt(task: str, config_path: str = "config/prompts.json") -> dict:
    config = json.loads(Path(config_path).read_text())
    route = config["routes"].get(task)
    if not route:
        raise ValueError(f"No prompt route configured for task: {task}")
    return load_prompt(route["prompt"])
```

## Anti-Patterns

- ❌ Prompts as inline strings — no versioning, no rollback, no audit trail
- ❌ A/B tests without statistical significance checks — coin-flip decisions
- ❌ Temperature > 0 for deterministic tasks (classification, extraction, routing)
- ❌ Prompt changes deployed without evaluation pipeline gate
- ❌ Manual prompt editing in production — all changes through git + CI/CD
- ❌ Unbounded prompt chains — cap at 5 steps, enforce total token budget
- ❌ Caching prompts with `temperature > 0` and expecting identical results
- ❌ Meta-prompting without human review of generated prompts before deployment

## WAF Alignment

| Pillar | Play 18 Prompt Management Implementation |
|--------|------------------------------------------|
| **Reliability** | Semver prompt files in git — rollback in seconds. Evaluation pipeline gates block broken prompts. Deterministic variant assignment (hash-based, no random). |
| **Security** | Prompt templates validated with StrictUndefined — no injection via unescaped variables. Registry access via RBAC. No secrets in prompt files. Content Safety on all LLM outputs. |
| **Cost Optimization** | Hash-based prompt caching (Redis, TTL from config). Prompt compression reduces token spend 30-40%. Model routing — gpt-4o-mini for simple tasks. DSPy compiles minimal few-shot sets. |
| **Operational Excellence** | Config-driven prompt selection — zero code changes for routing updates. A/B telemetry in Application Insights. CI evaluation pipeline before promotion. |
| **Performance Efficiency** | Cached completions avoid redundant API calls. Chain composition with streaming for sub-second TTFT. Batch evaluation in parallel with asyncio.gather. |
| **Responsible AI** | Evaluation pipeline scores groundedness + relevance before deployment. Meta-prompts reviewed by humans. Prompt audit trail in git history. |

### Operational Excellence
- Structured JSON logging with Application Insights + correlation IDs
- Custom metrics: latency p50/p95/p99, token usage, quality scores
- Automated Bicep deployment via GitHub Actions (staging → prod)
- Feature flags for gradual rollout, incident runbooks
