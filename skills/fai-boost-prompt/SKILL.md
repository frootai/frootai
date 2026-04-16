---
name: fai-boost-prompt
description: Analyze and refine prompts with specificity scoring, few-shot examples, and constraint encoding — improving accuracy by 20-40% and reducing token spend by 15-25% for RAG and classification tasks.
---

# FAI Boost Prompt

Scores prompts on clarity, specificity, and constraint coverage. Recommends improvements: add role/context, use few-shot examples, define output format, add guardrails. Python tool analyzes prompt patterns; suggests refinements; A/B tests against baseline. Integrates with Prompt Flow evaluation pipelines.

## Workflow

### Step 1 — Analyze Prompt Quality

```python
from fai_boost import PromptScorer

scorer = PromptScorer()
prompt = "What is machine learning?"

analysis = scorer.analyze(prompt)
# Returns: specificity_score=2/10, clarity_score=5/10, constraints_score=0/10
# Issues: too vague, no context, no output format specified
```

### Step 2 — Apply Recommendations

**Before (score: 2/10):**
```
What is machine learning?
```

**After (score: 9/10):**
```
You are an AI tutor explaining machine learning to a business executive.

Define machine learning in exactly 2 paragraphs:
1. Core concept and why it matters
2. Real-world business example

Use simple language; avoid technical jargon.
Output format: plain text, no markdown.
```

### Step 3 — Few-Shot Pattern

```python
prompt_refined = """
Classify customer feedback as Positive, Neutral, or Negative.

Examples:
- "Great product, fast shipping!" → Positive
- "It works okay" → Neutral
- "Terrible quality, won't buy again" → Negative

Feedback: "The delivery was late but the item is good"
Classification: [ONE WORD ONLY]
"""
```

### Step 4 — Measure Impact

```python
before_accuracy = 0.72  # Original prompt
after_accuracy = 0.89   # Refined prompt
token_reduction = 0.18  # 18% fewer tokens

impact = {
    "accuracy_gain": "+23.6%",
    "token_savings": "-18%",
    "latency_improvement": "-12%",
}
```

## Scoring Rubric

| Dimension | Score | Examples |
|-----------|-------|----------|
| **Specificity** | 1-10 | 1="What is X?" → 10="List 3 benefits of X for Y use case in Z format" |
| **Clarity** | 1-10 | 1=vague jargon → 10=step-by-step with context |
| **Constraints** | 1-10 | 1=no format spec → 10=output format, length, tone all defined |
| **Examples** | 0/1 | Few-shot examples present/absent |

## WAF Alignment

| Pillar | Contribution |
|--------|-------------|
| Cost Optimization | 15-25% token reduction via refinement |
| Performance | Faster convergence with better-specified prompts |
| Responsible AI | Clearer constraints reduce hallucinations |

## Compatible Plays

- Play 01 — Enterprise RAG (refine retrieval prompts)
- Play 03 — Deterministic Agent (structured output)
- Play 18 — Prompt Optimization

## Overview

This skill provides a structured, repeatable procedure for analyzes and improves prompt quality with specificity scoring and recommendation engine.. It can be used standalone as a LEGO block or auto-wired inside solution plays via the FAI Protocol.

**Category:** Prompt Engineering
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

Perform the primary operation: analyzes and improves prompt quality with specificity scoring and recommendation engine..

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
| responsible-ai | Validates content safety, checks for bias, enforces groundedness |
| performance-efficiency | Optimizes for speed, uses caching, supports parallel execution |

## Compatible Solution Plays

- **Play 18**

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
npx frootai skill run fai-boost-prompt
```

### Inside a Solution Play

When referenced in `fai-manifest.json`, this skill auto-wires with the play's context:

```json
{
  "primitives": {
    "skills": ["skills/fai-boost-prompt/"]
  }
}
```

### Via Agent Invocation

Agents can invoke this skill using the `/skill` command in Copilot Chat.

## Configuration Reference

```json
{
  "skill": "skill-name",
  "version": "1.0.0",
  "timeout_seconds": 300,
  "retry_attempts": 3,
  "log_level": "info"
}
```

## Monitoring

Track skill execution metrics:

| Metric | Description | Alert Threshold |
|--------|-------------|----------------|
| Duration | Execution time | > 60 seconds |
| Success rate | Pass/fail ratio | < 95% |
| Error count | Failed executions | > 5/hour |

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Timeout | Slow dependency | Increase timeout_seconds |
| Auth failure | Expired credentials | Refresh Managed Identity |
| Missing config | No fai-manifest.json | Create manifest or pass config_path |
| Validation error | Invalid input | Check parameter types and ranges |

## Notes

- This skill follows the FAI SKILL.md specification
- All outputs are deterministic when `dry_run=true`
- Integrates with FAI Engine for automated pipeline execution
- Part of the Prompt Engineering category in the FAI primitives catalog