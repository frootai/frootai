# Run Tests

> Slash command: /test
> Runs the test suite for the Enterprise RAG solution.

## Unit Tests
```bash
cd src && python -m pytest tests/ -v --tb=short
```

## Integration Tests
```bash
# Requires deployed Azure services
python -m pytest tests/integration/ -v --tb=long -k "test_search or test_openai"
```

## RAG Quality Tests
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --output results.json
```

## Expected Thresholds
| Metric | Target | Fail If Below |
|--------|--------|---------------|
| Groundedness | > 0.95 | < 0.90 |
| Relevance | > 0.90 | < 0.80 |
| Fluency | > 0.85 | < 0.75 |
| Latency (p95) | < 3s | > 5s |
| Abstention on off-topic | 100% | < 95% |

## After Testing
- Review results.json for any failed test cases
- Check Application Insights for error traces
- If quality dips below thresholds, review config/openai.json and config/search.json knobs
