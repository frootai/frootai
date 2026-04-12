---
name: evaluate-agentic-rag
description: "Evaluate Agentic RAG — measure retrieval quality, source selection accuracy, iteration efficiency, groundedness, citation accuracy, cost per query. Use when: evaluate, benchmark."
---

# Evaluate Agentic RAG

## When to Use
- Evaluate autonomous retrieval quality across query types
- Measure source selection accuracy (correct source chosen?)
- Assess iteration efficiency (fewer hops = faster, cheaper)
- Validate groundedness and citation accuracy
- Gate deployments with agentic retrieval thresholds

## Agentic RAG Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Groundedness | ≥ 0.90 | Azure AI Evaluation SDK |
| Relevance | ≥ 0.85 | Retrieved docs relevance to query |
| Source selection accuracy | ≥ 90% | Correct source chosen for query type |
| Avg retrieval hops | < 2.0 | Average iterations per query |
| Iteration reduction | ≥ 30% vs max | Queries resolved in 1 hop vs needing max |
| Citation accuracy | ≥ 95% | Citations link to correct source doc |
| Cache hit rate | ≥ 40% | Cached responses / total queries |
| Cost per query | < $0.05 | Tokens across all iterations |
| Self-eval accuracy | ≥ 85% | Agent correctly knows when to stop |

## Step 1: Prepare Multi-Source Test Set
```json
{"query": "What's our refund policy?", "expected_source": "knowledge-base", "expected_hops": 1}
{"query": "Latest Azure pricing changes", "expected_source": "web-search", "expected_hops": 1}
{"query": "Order status for customer 12345", "expected_source": "product-db", "expected_hops": 1}
{"query": "Compare our warranty vs competitor X", "expected_source": "knowledge-base+web-search", "expected_hops": 2}
```
Minimum: 50 test queries across single-source, multi-source, and iterative scenarios.

## Step 2: Evaluate Source Selection
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics source_selection
```
- Did the agent choose the right source for each query?
- Track: correct source, wrong source, unnecessary multi-source

## Step 3: Evaluate Iteration Efficiency
- Queries that resolve in 1 hop (ideal) vs 2-3 hops (acceptable) vs max hops (concern)
- Compare: iterative agent cost vs fixed RAG cost for same queries
- Target: 70% of queries resolve in ≤ 2 hops

## Step 4: Evaluate Self-Evaluation Quality
- Does the agent correctly assess when it has enough context?
- False positive: agent thinks it has enough but answer is wrong
- False negative: agent keeps searching when answer is already in context
- Track: self-eval triggered vs actual groundedness score

## Step 5: Compare vs Standard RAG (Play 01)
Run same test set through both Play 01 (fixed RAG) and Play 21 (agentic RAG):
| Metric | Standard RAG | Agentic RAG | Delta |
|--------|-------------|-------------|-------|
| Groundedness | Measure | Measure | Improvement |
| Multi-source coverage | N/A (single) | Measure | New capability |
| Cost per query | Measure | Measure | Cost overhead |
| Complex query accuracy | Measure | Measure | Key differentiator |

## Step 6: Generate Report
```bash
python evaluation/eval.py --all --output evaluation/report.json --ci-gate
```

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Deploy to production |
| Groundedness < 0.85 | Improve retrieval prompts, add more sources |
| Source selection < 80% | Refine tool descriptions, add routing examples |
| Avg hops > 3 | Raise self-eval threshold, improve first-hop quality |
| Cache hit < 20% | Lower similarity threshold, increase TTL |

## Evaluation Cadence
- **Pre-deployment**: Full multi-source evaluation suite
- **Weekly**: Source selection accuracy, cache hit rate
- **Monthly**: Full comparison vs standard RAG baseline
- **On source change**: Re-evaluate when adding/removing data sources

## Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Agent ignores available sources | Poor tool descriptions | Rewrite tool descriptions with clear use cases |
| Always uses max iterations | Self-eval threshold too high (0.99) | Lower to 0.85 |
| Bad citations | Source metadata not returned from tools | Include doc title + URL in tool response |
| Cache returns wrong answer | Similarity threshold too low | Raise from 0.85 to 0.92 |
| High cost on simple queries | No routing shortcut for FAQ | Add direct-answer path for high-confidence KB matches |
| Multi-source synthesis poor | No merge strategy | Add explicit "synthesize from multiple sources" in system prompt |

## CI/CD Integration
```yaml
- name: Agentic RAG Quality Gate
  run: python evaluation/eval.py --all --ci-gate
- name: Source Selection Gate
  run: python evaluation/eval.py --metrics source_selection --ci-gate --threshold 0.90
- name: Cost Gate
  run: python evaluation/eval.py --metrics cost_per_query --ci-gate --max-cost 0.05
```
