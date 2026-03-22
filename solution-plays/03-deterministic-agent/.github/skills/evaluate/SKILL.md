# Evaluate RAG — Skill

> Layer 2 — Self-contained skill for running RAG quality evaluations.

## Description
Runs the RAG evaluation pipeline against test cases and reports quality metrics: groundedness, relevance, fluency, latency, and abstention rate.

## Prerequisites
- Python 3.10+
- `pip install openai azure-search-documents azure-identity`
- Deployed RAG endpoint (or local dev server running)
- `evaluation/test-set.jsonl` with test cases

## Execution
Run `eval.py` from this skill folder to evaluate the RAG pipeline.

## Metrics Thresholds
| Metric | Pass | Fail |
|--------|------|------|
| Groundedness | > 0.95 | < 0.90 |
| Relevance | > 0.90 | < 0.80 |
| Fluency | > 0.85 | < 0.75 |
| Latency p95 | < 3s | > 5s |
| Abstention | 100% | < 95% |

## References
- [evaluation/test-set.jsonl](../../evaluation/test-set.jsonl) — Test data
- [evaluation/eval.py](../../evaluation/eval.py) — Main evaluation script
- [config/openai.json](../../config/openai.json) — Model parameters
