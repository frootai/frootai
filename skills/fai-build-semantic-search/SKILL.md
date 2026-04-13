---
name: fai-build-semantic-search
description: 'Builds semantic similarity search with embedding generation and vector index.'
---

# Fai Build Semantic Search

Builds semantic similarity search with embedding generation and vector index.

## Overview

This skill provides a structured, repeatable procedure for builds semantic similarity search with embedding generation and vector index.. It can be used standalone as a LEGO block or auto-wired inside solution plays via the FAI Protocol.

**Category:** Build Tooling
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

Perform the primary operation: builds semantic similarity search with embedding generation and vector index..

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
| operational-excellence | Produces structured logs, integrates with CI/CD, follows IaC patterns |

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
npx frootai skill run fai-build-semantic-search
```

### Inside a Solution Play

When referenced in `fai-manifest.json`, this skill auto-wires with the play's context:

```json
{
  "primitives": {
    "skills": ["skills/fai-build-semantic-search/"]
  }
}
```

### Via Agent Invocation

Agents can invoke this skill using the `/skill` command in Copilot Chat.

## RAG Pipeline Reference

| Stage | Tool | Config |
|-------|------|--------|
| Chunking | Semantic chunker | 512 tokens, 10% overlap |
| Embedding | text-embedding-3-large | 3072 dimensions |
| Indexing | Azure AI Search | Hybrid (vector + BM25) |
| Retrieval | Hybrid search | 60% semantic, 40% keyword |
| Reranking | Semantic reranker | Top 5 after rerank |
| Generation | GPT-4o | temp=0.1, top_p=0.9 |

## Chunking Strategy

```python
from azure.ai.formrecognizer import DocumentAnalysisClient

# Semantic chunking preserves paragraph boundaries
chunks = semantic_chunk(
    text=document,
    max_tokens=512,
    overlap_tokens=50,
    respect_boundaries=True  # Don't split mid-sentence
)
```

## Search Configuration

```json
{
  "search_type": "hybrid",
  "semantic_weight": 0.6,
  "keyword_weight": 0.4,
  "top_k": 5,
  "min_score": 0.78,
  "reranker": "semantic",
  "filter": "category eq 'technical'"
}
```

## Notes

- This skill follows the FAI SKILL.md specification
- All outputs are deterministic when `dry_run=true`
- Integrates with FAI Engine for automated pipeline execution
- Part of the Build Tooling category in the FAI primitives catalog