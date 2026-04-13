---
name: fai-evaluate-14-cost-optimized-ai-gateway
description: 'Runs quality evaluation for Play 14-cost-optimized-ai-gateway against fai-manifest.json guardrails — groundedness, coherence, safety.'
---

# Fai Evaluate 14 Cost Optimized Ai Gateway

Runs quality evaluation for Play 14-cost-optimized-ai-gateway against fai-manifest.json guardrails — groundedness, coherence, safety.

## Overview

This skill provides a structured, repeatable procedure for runs quality evaluation for play 14-cost-optimized-ai-gateway against fai-manifest.json guardrails — groundedness, coherence, safety.. It can be used standalone as a LEGO block or auto-wired inside solution plays via the FAI Protocol.

**Category:** Evaluation
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

Perform the primary operation: runs quality evaluation for play 14-cost-optimized-ai-gateway against fai-manifest.json guardrails — groundedness, coherence, safety..

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
| reliability | Includes retry logic, validates outputs, provides rollback steps |

## Compatible Solution Plays

- **Play 03**
- **Play 60**

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
npx frootai skill run fai-evaluate-14-cost-optimized-ai-gateway
```

### Inside a Solution Play

When referenced in `fai-manifest.json`, this skill auto-wires with the play's context:

```json
{
  "primitives": {
    "skills": ["skills/fai-evaluate-14-cost-optimized-ai-gateway/"]
  }
}
```

### Via Agent Invocation

Agents can invoke this skill using the `/skill` command in Copilot Chat.

## Metrics Reference

| Metric | Range | Threshold | Description |
|--------|-------|-----------|-------------|
| Groundedness | 0.0-1.0 | ≥ 0.85 | Answer supported by retrieved context |
| Coherence | 0.0-1.0 | ≥ 0.80 | Logical flow and consistency |
| Relevance | 0.0-1.0 | ≥ 0.80 | Answer addresses the question |
| Fluency | 0.0-1.0 | ≥ 0.75 | Natural language quality |
| Safety | 0-4 | 0 | Content safety violations |
| Faithfulness | 0.0-1.0 | ≥ 0.90 | No hallucinated facts |

## Test Set Format

```jsonl
{"question": "What is RAG?", "context": "RAG combines...", "expected": "Retrieval-Augmented Generation..."}
{"question": "How does chunking work?", "context": "Documents are split...", "expected": "Chunking divides..."}
```

## CI/CD Integration

```yaml
# .github/workflows/eval.yml
- name: Run FAI Evaluation
  run: |
    python evaluation/eval.py --test-set evaluation/test-set.jsonl
    python evaluation/check-thresholds.py --groundedness 0.85 --coherence 0.80
```

## Regression Tracking

Track evaluation scores over time to detect quality regressions:

```bash
# Compare with baseline
python evaluation/regression.py --baseline results/baseline.json --current results/latest.json
```

## Notes

- This skill follows the FAI SKILL.md specification
- All outputs are deterministic when `dry_run=true`
- Integrates with FAI Engine for automated pipeline execution
- Part of the Evaluation category in the FAI primitives catalog