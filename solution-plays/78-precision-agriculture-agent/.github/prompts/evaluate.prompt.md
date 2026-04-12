---
mode: "agent"
description: "Evaluate Precision Agriculture Agent (Play 78) quality metrics"
agent: "tuner"
tools: ["terminal", "file", "search"]
---

# Evaluate Precision Agriculture Agent Quality

You are evaluating the FrootAI Precision Agriculture Agent solution play (Play 78).

## Prerequisites
1. Python 3.10+ with azure-ai-evaluation SDK installed
2. Azure credentials configured (DefaultAzureCredential)
3. Test dataset available at `evaluation/test-set.jsonl`
4. Config files loaded from `config/` directory

## Step 1: Prepare Test Dataset
Verify the test dataset has sufficient coverage:
```bash
python -c "
import jsonlines
with jsonlines.open('evaluation/test-set.jsonl') as reader:
    cases = list(reader)
    print(f'Test cases: {len(cases)}')
    print(f'Categories: {set(c.get("category", "default") for c in cases)}')
"
```
Minimum: 10 diverse test cases covering normal, edge, and adversarial scenarios.

## Step 2: Run Evaluation Pipeline
Execute the evaluation script:
```bash
python evaluation/eval.py --config config/guardrails.json --test-set evaluation/test-set.jsonl
```

## Step 3: Metric Definitions
The evaluation measures these quality dimensions:

| Metric | Description | Threshold | Weight |
|--------|-------------|-----------|--------|
| **Relevance** | Response addresses the user's question | ≥ 0.80 | 25% |
| **Groundedness** | Response is grounded in provided context | ≥ 0.85 | 30% |
| **Coherence** | Response is logically consistent | ≥ 0.80 | 15% |
| **Fluency** | Response is grammatically correct | ≥ 0.85 | 10% |
| **Safety** | No harmful/inappropriate content | ≥ 0.95 | 15% |
| **Latency** | Response time p95 | ≤ 3000ms | 5% |

## Step 4: Interpret Results
After running evaluation:
1. Check overall weighted score (must be ≥ 0.80 for production)
2. Identify any individual metric below threshold
3. Review worst-performing test cases for patterns
4. Check safety score — must be 0.95+ (non-negotiable)

## Step 5: CI Gate Decision
Based on results, make a go/no-go decision:
- **PASS (all green):** All metrics above threshold → approve for deployment
- **WARN (yellow):** One metric within 5% of threshold → deploy with monitoring
- **FAIL (red):** Any metric below threshold → block deployment, fix issues

## Step 6: Generate Report
Create an evaluation report for stakeholders:
```bash
python evaluation/eval.py --report html --output evaluation/report.html
```

## Failure Remediation
If evaluation fails:
- **Low relevance:** Review retrieval pipeline, improve chunking, add missing knowledge
- **Low groundedness:** Tighten system prompt, add source citation requirement
- **Low coherence:** Reduce temperature, add output structure requirements
- **Low safety:** Enable Content Safety API, add content filtering rules
- **High latency:** Add caching, optimize retrieval, reduce max_tokens

## Re-evaluation
After fixes, re-run the full pipeline and compare results:
```bash
python evaluation/eval.py --compare evaluation/previous-results.json
```
