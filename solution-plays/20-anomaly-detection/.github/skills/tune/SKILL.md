# Tune Config — Skill

> Layer 2 — Self-contained skill for tuning AI configuration knobs.

## Description
Validates and optimizes the TuneKit configuration files (config/*.json) for production readiness. Checks value ranges, detects placeholder/default values, and suggests improvements.

## Prerequisites
- `jq` installed for JSON validation
- Config files present: config/openai.json, config/search.json, config/chunking.json, config/guardrails.json

## Execution
Run `tune-config.sh` from this skill folder to validate all configs.

## What It Checks
| Config | Key | Expected Range |
|--------|-----|---------------|
| openai.json | temperature | 0.0 - 0.3 |
| openai.json | max_tokens | 500 - 4000 |
| search.json | top_k | 3 - 10 |
| search.json | threshold | 0.7 - 0.95 |
| chunking.json | chunk_size | 256 - 1024 |
| guardrails.json | blocked_topics | non-empty array |

## References
- [config/openai.json](../../config/openai.json)
- [config/search.json](../../config/search.json)
- [config/chunking.json](../../config/chunking.json)
- [config/guardrails.json](../../config/guardrails.json)
