---
name: fai-api-endpoint-generator
description: 'Generates REST API endpoints with input validation, error handling, and OpenAPI documentation.'
---

# Fai Api Endpoint Generator

Generates REST API endpoints with input validation, error handling, and OpenAPI documentation.

## Overview

This skill provides a structured, repeatable procedure for generates rest api endpoints with input validation, error handling, and openapi documentation.. It can be used standalone as a LEGO block or auto-wired inside solution plays via the FAI Protocol.

**Category:** API Development
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

Perform the primary operation: generates rest api endpoints with input validation, error handling, and openapi documentation..

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
| performance-efficiency | Optimizes for speed, uses caching, supports parallel execution |
| security | Validates credentials, enforces least-privilege, scans for secrets |

## Compatible Solution Plays

- **Play 14**
- **Play 52**

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
npx frootai skill run fai-api-endpoint-generator
```

### Inside a Solution Play

When referenced in `fai-manifest.json`, this skill auto-wires with the play's context:

```json
{
  "primitives": {
    "skills": ["skills/fai-api-endpoint-generator/"]
  }
}
```

### Via Agent Invocation

Agents can invoke this skill using the `/skill` command in Copilot Chat.

## API Patterns

### Request Validation

```typescript
import { z } from "zod";

const RequestSchema = z.object({
  query: z.string().min(1).max(2000),
  top_k: z.number().int().min(1).max(50).default(5),
  filters: z.record(z.string()).optional(),
});
```

### Response Format

```json
{
  "status": "success",
  "data": { "results": [] },
  "metadata": {
    "duration_ms": 245,
    "tokens_used": 150,
    "model": "gpt-4o",
    "cached": false
  }
}
```

### Error Responses

```json
{
  "status": "error",
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Retry after 30 seconds.",
    "retry_after": 30
  }
}
```

## Rate Limiting

| Tier | Requests/min | Tokens/min | Burst |
|------|-------------|------------|-------|
| Free | 10 | 5,000 | 20 |
| Standard | 60 | 50,000 | 120 |
| Enterprise | 300 | 500,000 | 600 |

## Notes

- This skill follows the FAI SKILL.md specification
- All outputs are deterministic when `dry_run=true`
- Integrates with FAI Engine for automated pipeline execution
- Part of the API Development category in the FAI primitives catalog