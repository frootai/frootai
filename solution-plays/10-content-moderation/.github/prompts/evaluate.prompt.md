# Evaluate RAG Quality

> Slash command: /evaluate
> Runs the full RAG evaluation pipeline and reports quality metrics.

## What This Does
1. Loads test cases from `evaluation/test-set.jsonl`
2. Sends each question through the RAG pipeline
3. Compares responses against ground-truth answers
4. Computes: groundedness, relevance, fluency, latency, abstention rate
5. Generates a quality report

## Run
```bash
python evaluation/eval.py \
  --test-set evaluation/test-set.jsonl \
  --config config/openai.json \
  --output evaluation/results.json
```

## Interpreting Results
| Metric | Great | OK | Action Needed |
|--------|-------|-----|---------------|
| Groundedness | > 0.95 | 0.90-0.95 | < 0.90 → tighten system prompt |
| Relevance | > 0.90 | 0.80-0.90 | < 0.80 → adjust search config |
| Fluency | > 0.85 | 0.75-0.85 | < 0.75 → adjust temperature |
| Latency p95 | < 2s | 2-5s | > 5s → check index/model SKU |
| Abstention | 100% | 95-100% | < 95% → add guardrails |

## Tuning Knobs (in order of impact)
1. `config/search.json` → hybrid_weight, top_k, threshold
2. `config/openai.json` → temperature, max_tokens, system_prompt
3. `config/chunking.json` → chunk_size, overlap, strategy
4. `config/guardrails.json` → blocked_topics, abstention_phrases
