---
name: "evaluate"
description: "Evaluate Pester Test Modernization (Play 101) quality using Azure AI Evaluation SDK"
---

# Evaluate — Pester Test Modernization

## Overview
This skill runs the evaluation pipeline for the Pester Test Modernization solution play, measuring quality metrics against production thresholds.

## Prerequisites
- Python 3.10+ with azure-ai-evaluation installed
- Azure credentials configured (DefaultAzureCredential)
- Test dataset at `evaluation/test-set.jsonl` (≥10 cases)
- Guardrail thresholds in `config/guardrails.json`

## Step 1: Validate Test Dataset
```bash
python -c "
import json
with open('evaluation/test-set.jsonl') as f:
    cases = [json.loads(line) for line in f if line.strip()]
print(f'Test cases: {len(cases)}')
assert len(cases) >= 10, 'Need at least 10 test cases'
print('Dataset validation passed')
"
```

## Step 2: Run Evaluation
```bash
python evaluation/eval.py \
  --test-set evaluation/test-set.jsonl \
  --config config/guardrails.json \
  --output evaluation/results.json
```

## Step 3: Check Metrics
| Metric | Threshold | Description |
|--------|-----------|-------------|
| Relevance | ≥ 0.80 | Response addresses the query |
| Groundedness | ≥ 0.85 | Response grounded in context |
| Coherence | ≥ 0.80 | Logically consistent output |
| Fluency | ≥ 0.85 | Grammatically correct |
| Safety | ≥ 0.95 | No harmful content |
| Latency p95 | ≤ 3s | Response time |

## Step 4: Generate Report
```bash
python evaluation/eval.py --report html --output evaluation/report.html
echo "Report generated at evaluation/report.html"
```

## Step 5: CI Gate Decision
```bash
python evaluation/eval.py --ci-gate --config config/guardrails.json
# Exit code 0 = PASS, 1 = FAIL
```

## Failure Remediation
- **Low relevance:** Check retrieval pipeline, improve chunking strategy
- **Low groundedness:** Tighten system prompt, require source citations
- **Low coherence:** Reduce temperature, add structured output format
- **Low safety:** Enable Content Safety API filtering
- **High latency:** Add caching, optimize query, reduce max_tokens

## Verification Checklist
- [ ] Test dataset has ≥10 diverse cases
- [ ] All metric thresholds defined in guardrails.json
- [ ] Evaluation script runs without errors
- [ ] All metrics exceed thresholds
- [ ] Report generated and accessible

## Troubleshooting
- **Azure credential error:** Run az login and verify DefaultAzureCredential works
- **Test dataset empty:** Ensure test-set.jsonl has at least 10 valid JSON lines
- **Low scores across all metrics:** Check if the model deployment is accessible
- **Timeout during evaluation:** Reduce test set size or increase timeout
- **Report generation fails:** Ensure evaluation/results.json was created successfully
- **CI gate returns non-zero:** Review individual metric scores in results.json
