---
name: fai-tutorial-generator
description: "Generate production-ready tutorials with prerequisites, runnable code, verification steps, and troubleshooting paths."
---

# FAI Tutorial Generator

## Purpose

Use this skill to create practical tutorials that users can execute end-to-end without guessing hidden steps.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| topic | Yes | Tutorial subject (for example: Azure OpenAI setup). |
| audience | Yes | Beginner, intermediate, advanced, or mixed. |
| runtime | No | Environment (Python, Node, .NET, Bash, etc.). |
| target_time_minutes | No | Time box for completion, default 30. |
| constraints | No | Cost, security, region, policy limits. |

## Output Contract

A complete tutorial must include all sections below:

1. Learning objective.
2. Prerequisites with exact versions.
3. Architecture summary.
4. Step-by-step implementation.
5. Verification commands.
6. Expected output examples.
7. Common failures and fixes.
8. Next-step improvements.

## Step 1 - Build a Strong Outline

```json
{
  "title": "Build a Cost-Optimized RAG API",
  "objective": "Deploy and test a small RAG API with guarded prompts.",
  "estimated_time_minutes": 45,
  "audience": "intermediate",
  "sections": [
    "Prerequisites",
    "Project setup",
    "Index creation",
    "API implementation",
    "Validation",
    "Troubleshooting"
  ]
}
```

## Step 2 - Generate Runnable Steps

Each step should include:

- Why the step exists.
- Exact command or code.
- Expected result.
- What to do if it fails.

```bash
# Example verification step
python -m pytest tests/test_smoke.py -q
```

```python
# Example expected output assertion
assert response.status_code == 200
assert "citations" in response.json()
```

## Step 3 - Add Validation Gates

| Gate | Pass Condition |
|------|----------------|
| Build gate | Project compiles/runs locally. |
| Functional gate | Key workflow returns expected output. |
| Reliability gate | Retry/fallback behavior works on transient failure. |
| Safety gate | Harmful/prompt-injection samples are blocked. |
| Cost gate | Estimated cost remains under budget threshold. |

## Step 4 - Include Troubleshooting Tree

| Symptom | Probable Cause | Fix |
|---------|----------------|-----|
| Command not found | Missing dependency or PATH issue | Install required tool and reopen shell. |
| Auth failure | Credential not set or expired | Re-authenticate and verify environment variables. |
| Timeout | Resource/network constraints | Increase timeout and validate endpoint health. |
| Wrong output format | Prompt/schema mismatch | Enforce strict output schema and re-test. |

## Step 5 - Add Quality Checklist

Before finalizing a tutorial, verify:

- No hidden assumptions.
- All commands are copy-paste runnable.
- Versions are pinned.
- Security-sensitive steps avoid hardcoded secrets.
- The tutorial can be completed within stated time.

## Authoring Template

```md
# <Tutorial Title>

## Objective
<One measurable goal>

## Prerequisites
- Tool A version x.y
- Tool B version x.y

## Steps
### 1. <Step>
Why:
Command/code:
Expected result:

## Verification
<commands and expected outputs>

## Troubleshooting
<table>

## Next Steps
<2-3 upgrades>
```

## Notes

- Prefer deterministic examples over vague pseudo-steps.
- Prefer short runnable snippets over long unexplained code dumps.
- Include both success criteria and failure diagnostics.
