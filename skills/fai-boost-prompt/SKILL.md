---
name: fai-boost-prompt
description: |
  Interactive prompt refinement workflow that interrogates scope, deliverables, and
  constraints to produce a high-quality task prompt. Use when an initial prompt is
  too vague and needs structured decomposition before execution.
---

# Boost Prompt

Refine vague prompts into precise, actionable task specifications through iterative questioning.

## When to Use

- Initial prompt is too vague or broad ("build me an API")
- Task has unclear deliverables or success criteria
- Need to decompose a large request before implementation
- Want a structured prompt that can be reused

---

## Refinement Process

### Step 1: Interrogate Scope

Ask clarifying questions to establish boundaries:

```markdown
## Scope Questions
1. What is the primary deliverable? (code, document, config, architecture)
2. What technology stack or framework? (Python/FastAPI, .NET/Minimal API, etc.)
3. What are the constraints? (time, cost, compliance, existing systems)
4. Who is the audience? (developers, end users, ops team)
5. What does "done" look like? (tests pass, deploys, meets SLA)
```

### Step 2: Define Output Format

```markdown
## Output Specification
- Format: [code | markdown | JSON | YAML | Bicep | diagram]
- Structure: [single file | multi-file | module | full project]
- Quality: [prototype | production-ready | enterprise-grade]
- Includes: [tests | docs | CI/CD | monitoring]
```

### Step 3: Add Anti-Hallucination Rules

```markdown
## Grounding Rules
- Only use APIs and libraries that exist as of April 2026
- Do not invent URLs, endpoints, or package names
- If unsure about a detail, state the assumption explicitly
- Cite documentation sources where applicable
```

### Step 4: Compose Final Prompt

```python
def compose_boosted_prompt(scope: dict, output: dict, rules: list[str]) -> str:
    """Assemble a structured prompt from refinement results."""
    sections = [
        f"## Task\n{scope['deliverable']}",
        f"## Stack\n{scope['stack']}",
        f"## Constraints\n" + "\n".join(f"- {c}" for c in scope['constraints']),
        f"## Output Format\n- Format: {output['format']}\n- Quality: {output['quality']}",
        f"## Grounding Rules\n" + "\n".join(f"- {r}" for r in rules),
        f"## Definition of Done\n{scope['done_criteria']}",
    ]
    return "\n\n".join(sections)
```

## Example: Vague → Boosted

**Before:** "Build me a chatbot"

**After:**
```markdown
## Task
Build a customer support chatbot that answers questions from a knowledge base.

## Stack
Python 3.11, FastAPI, Azure OpenAI (gpt-4o-mini), Azure AI Search for retrieval.

## Constraints
- Must use Managed Identity for all Azure auth
- Response latency < 2 seconds P95
- Budget: $500/month Azure cost
- GDPR compliant (no PII in logs)

## Output Format
- Format: Multi-file Python project
- Quality: Production-ready
- Includes: Dockerfile, unit tests, health endpoint, OpenAPI spec

## Grounding Rules
- Only use openai SDK v1.x API
- Do not invent custom Azure SDK methods
- State assumptions about index schema explicitly

## Definition of Done
- Chat endpoint returns grounded answers with citations
- Unit tests pass with >80% coverage
- Docker image builds and runs locally
- Health endpoint returns 200
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Boosted prompt still vague | Skipped scope questions | Go through all 5 scope questions explicitly |
| Output doesn't match expectations | No output format spec | Define format, structure, and quality level |
| Hallucinated dependencies | No grounding rules | Add anti-hallucination rules to every boosted prompt |
