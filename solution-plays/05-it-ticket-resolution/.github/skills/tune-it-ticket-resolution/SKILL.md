---
name: tune-it-ticket-resolution
description: "Tune IT Ticket AI — optimize classification model, routing rules, confidence thresholds, SLA escalation timing, KB retrieval quality. Use when: tune, optimize."
---

# Tune IT Ticket Resolution

## When to Use
- Optimize classification accuracy for specific categories
- Tune confidence thresholds for auto-resolution vs escalation
- Optimize model routing for cost vs quality balance
- Adjust SLA escalation timing based on resolution patterns
- Improve KB retrieval quality for better auto-resolution

## Tuning Dimensions

### Dimension 1: Classification Optimization

| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| Temperature | 0.0 | 0.0-0.1 | Must be 0 for deterministic classification |
| Category count | 6 | 5-15 | More categories = lower per-category accuracy |
| Confidence threshold | 0.85 | 0.7-0.95 | Lower = more auto-routes, higher = more human |
| Few-shot examples | 3 per category | 2-5 | More examples = better accuracy, more tokens |
| System prompt length | 500 tokens | 300-800 | Too short = misclassification, too long = slow |

**Diagnostic**: Run `python evaluation/eval.py --metrics classification` to get per-category F1 scores.

**Optimization steps**:
1. If overall accuracy < 90%: Add more few-shot examples for failing categories
2. If P1 misclassified: Add urgency keywords ("outage", "down", "critical") to P1 definition
3. If category overlap high: Merge similar categories or add disambiguation rules
4. If latency > 2s: Reduce few-shot examples, switch to gpt-4o-mini

### Dimension 2: Routing & Escalation

| Parameter | Default | Recommendation | Why |
|-----------|---------|---------------|-----|
| Auto-resolve threshold | 0.85 | 0.80-0.90 | Balance auto-resolution rate vs accuracy |
| Max auto-attempts | 2 | 1-3 | Retry with rephrased query before escalating |
| Escalation trigger | Confidence < threshold | Also: sentiment negative | Frustrated users get human faster |
| P1 routing | Always human + AI | Never bypass human for P1 | P1 = production impact |
| P4 auto-close | After 48h resolved | After 24h with user confirmation | Faster ticket lifecycle |

### Dimension 3: KB Retrieval Optimization

| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| Search type | hybrid | keyword/vector/hybrid | Hybrid best for IT vocabulary |
| top_k | 5 | 3-10 | More = better recall, slower, higher cost |
| Relevance threshold | 0.75 | 0.6-0.9 | Below threshold = "I don't know" |
| Chunk size | 512 tokens | 256-1024 | Smaller = precise, larger = more context |
| Reranking | Enabled | On/Off | Enabled significantly improves relevance |

**Diagnostic**: Run `python evaluation/eval.py --metrics resolution` to measure KB relevance.

### Dimension 4: Model Routing for Cost

| Task | Model | Cost | Latency | Accuracy |
|------|-------|------|---------|----------|
| Classification | gpt-4o-mini | $0.15/1M | < 500ms | 92%+ |
| Resolution (simple) | gpt-4o-mini | $0.15/1M | < 800ms | 85%+ |
| Resolution (complex) | gpt-4o | $2.50/1M | < 1.5s | 95%+ |
| PII detection | Content Safety API | Fixed | < 200ms | 99%+ |

**Cost optimization strategy**:
- Route classification → gpt-4o-mini (fast, cheap, sufficient accuracy)
- Route simple tickets (FAQ-matches) → cached response (zero LLM cost)
- Route complex tickets → gpt-4o (quality matters for resolution)
- Monthly estimate (5000 tickets/day): ~$800/mo with routing vs ~$2,500 without

### Dimension 5: SLA Timing Optimization

| Priority | Default SLA | Tune When | Adjustment |
|----------|-------------|-----------|------------|
| P1 | 1 hour | Resolution time consistently > 45min | Auto-escalate at 30min |
| P2 | 4 hours | AI resolves 80%+ of P2 | Extend auto-resolve window to 2h |
| P3 | 8 hours | Low auto-resolution rate | Add more KB content for P3 categories |
| P4 | 24 hours | Tickets pile up | Enable auto-close after AI resolution |

## Production Readiness Checklist
- [ ] Classification accuracy ≥ 92% across all categories
- [ ] P1 priority never misclassified as P3/P4
- [ ] Auto-resolution rate ≥ 60%
- [ ] SLA compliance ≥ 95%
- [ ] PII detection recall ≥ 99%
- [ ] First-response time < 30 seconds
- [ ] ITSM integration bidirectional sync working
- [ ] Escalation path tested for all priority levels
- [ ] Model routing configured (classification → mini, resolution → full)
- [ ] KB content covers top 20 ticket categories

## Tuning Cadence
- **Weekly**: Review classification confusion matrix, adjust few-shot examples
- **Monthly**: Re-evaluate model routing cost vs accuracy trade-offs
- **Quarterly**: Review category taxonomy, merge/split categories based on volume
- **On accuracy drop**: Investigate new ticket patterns, expand training examples

## Output: Tuning Report
After tuning, generate a report comparing before/after:
- Classification accuracy delta per category
- Auto-resolution rate change
- Cost per ticket change
- SLA compliance improvement
