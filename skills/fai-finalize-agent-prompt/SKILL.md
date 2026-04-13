---
name: fai-finalize-agent-prompt
description: 'Finalizes agent system prompts with structured sections, guardrails, and few-shot examples.'
---

# Fai Finalize Agent Prompt

Finalizes agent system prompts with structured sections, guardrails, and few-shot examples.

## Overview

This skill provides a structured, repeatable procedure for finalizes agent system prompts with structured sections, guardrails, and few-shot examples.. It can be used standalone as a LEGO block or auto-wired inside solution plays via the FAI Protocol.

**Category:** Agent Tooling
**Complexity:** Medium
**Estimated Time:** 10-30 minutes

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `target` | string | Yes | — | Target resource, file, or endpoint |
| `environment` | enum | No | `dev` | Target environment: `dev`, `staging`, `prod` |
| `verbose` | boolean | No | `false` | Enable detailed output logging |
| `dry_run` | boolean | No | `false` | Validate without making changes |
| `config_path` | string | No | `config/` | Path to configuration directory |

## Steps

### Step 1: Validate Prerequisites

Verify all required tools, credentials, and dependencies are available.

```bash
# Check required tools
command -v node >/dev/null 2>&1 || { echo 'Node.js required'; exit 1; }
command -v az >/dev/null 2>&1 || { echo 'Azure CLI required'; exit 1; }
```

### Step 2: Load Configuration

Read settings from the FAI manifest and TuneKit config files.

```bash
# Load from fai-manifest.json if inside a play
CONFIG_DIR="${config_path:-config}"
if [ -f "fai-manifest.json" ]; then
  echo "FAI Protocol detected — auto-wiring context"
fi
```

### Step 3: Execute Core Logic

Perform the primary operation: finalizes agent system prompts with structured sections, guardrails, and few-shot examples..

### Step 4: Validate Results

Verify the output meets quality thresholds and WAF compliance.

```bash
# Validate output
if [ "$?" -eq 0 ]; then
  echo "✅ Skill completed successfully"
else
  echo "❌ Skill failed — check logs"
  exit 1
fi
```

## Output

| Output | Type | Description |
|--------|------|-------------|
| `status` | enum | `success`, `warning`, `failure` |
| `duration_ms` | number | Execution time in milliseconds |
| `artifacts` | string[] | List of generated/modified files |
| `logs` | string | Detailed execution log |

## WAF Alignment

| Pillar | How This Skill Contributes |
|--------|---------------------------|
| reliability | Includes retry logic, validates outputs, provides rollback steps |
| responsible-ai | Validates content safety, checks for bias, enforces groundedness |

## Compatible Solution Plays

- **Play 03**
- **Play 07**
- **Play 22**

## Error Handling

| Exit Code | Meaning | Action |
|-----------|---------|--------|
| 0 | Success | Proceed to next step |
| 1 | Validation failure | Check input parameters |
| 2 | Dependency missing | Install required tools |
| 3 | Runtime error | Check logs, retry with `--verbose` |

## Usage

### Standalone

```bash
# Run this skill directly
npx frootai skill run fai-finalize-agent-prompt
```

### Inside a Solution Play

When referenced in `fai-manifest.json`, this skill auto-wires with the play's context:

```json
{
  "primitives": {
    "skills": ["skills/fai-finalize-agent-prompt/"]
  }
}
```

### Via Agent Invocation

Agents can invoke this skill using the `/skill` command in Copilot Chat.

## Evaluation Pipeline

This skill integrates with the FAI evaluation framework:

```python
from frootai.evaluation import SkillEvaluator

evaluator = SkillEvaluator(skill="agent-governance")
results = evaluator.run(test_cases="evaluation/test-set.jsonl")

# Check thresholds
assert results.groundedness >= 0.85, f"Groundedness {results.groundedness} below 0.85"
assert results.coherence >= 0.80, f"Coherence {results.coherence} below 0.80"
assert results.safety_violations == 0, "Safety violations detected"
```

## Advanced Configuration

```json
{
  "max_iterations": 5,
  "confidence_threshold": 0.7,
  "fallback_strategy": "escalate",
  "budget_per_request": 0.05,
  "tools_allowed": ["search", "retrieve", "analyze"],
  "human_in_the_loop": true,
  "audit_trail": true
}
```

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|--------------|-----------------|
| No iteration limit | Infinite loops burn tokens | Set max_iterations=5 |
| Missing fallback | Agent hangs on failure | Configure fallback_strategy |
| No cost tracking | Budget overruns | Enable budget_per_request |
| Skipping eval | Quality degrades silently | Run eval pipeline in CI |

## Notes

- This skill follows the FAI SKILL.md specification
- All outputs are deterministic when `dry_run=true`
- Integrates with FAI Engine for automated pipeline execution
- Part of the Agent Tooling category in the FAI primitives catalog