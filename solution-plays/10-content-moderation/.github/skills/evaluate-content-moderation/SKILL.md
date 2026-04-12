---
name: evaluate-content-moderation
description: "Evaluate Content Moderation — test true positive rate, false positive rate, moderation latency, custom category detection, human review volume. Use when: evaluate."
---

# Evaluate Content Moderation

## When to Use
- Evaluate content moderation accuracy (true/false positive rates)
- Measure moderation latency and throughput
- Validate custom blocklist effectiveness
- Test category detection across content types
- Gate deployments with quality thresholds

## Quality Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| True positive rate (recall) | ≥ 95% | Known harmful content detected |
| False positive rate | < 5% | Safe content incorrectly blocked |
| Moderation latency (p50) | < 100ms | Per-request timing |
| Moderation latency (p95) | < 200ms | Tail latency |
| Blocklist detection rate | 100% | All blocklist terms caught |
| Category accuracy | ≥ 90% per category | Correct category assignment |
| Human review volume | < 5% of total | Flagged for manual review |
| Image moderation accuracy | ≥ 90% | Image classification correctness |

## Step 1: Prepare Test Dataset
Create labeled content samples in `evaluation/test-set.jsonl`:
```json
{"id": "m001", "text": "How can I reset my password?", "label": "safe", "categories": []}
{"id": "m002", "text": "Violent content example here", "label": "harmful", "categories": ["Violence"], "severity": 4}
{"id": "m003", "text": "Text containing CompetitorName product", "label": "blocklist", "blocklist_match": "competitor-names"}
{"id": "m004", "text": "Borderline content needing human review", "label": "review", "categories": ["Hate"], "severity": 2}
```
Minimum: 100 samples (50 safe, 30 harmful across categories, 10 blocklist, 10 edge cases).

## Step 2: Evaluate Detection Accuracy
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics accuracy
```
- Per-category true positive rate (Hate, Violence, SelfHarm, Sexual)
- Per-category false positive rate
- Confusion matrix across categories
- Severity level accuracy (is severity 4 content detected at threshold 4?)

## Step 3: Evaluate Blocklist Effectiveness
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics blocklist
```
- All blocklist terms detected (must be 100%)
- No false blocklist matches on legitimate content
- Test partial matches and case sensitivity
- Measure blocklist lookup latency overhead

## Step 4: Evaluate Moderation Latency
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics latency
```
- p50, p95, p99 latency per request
- Latency by content length (short text vs long document)
- Latency by modality (text vs image)
- Throughput under load (concurrent requests)

## Step 5: Edge Case Testing
- **Multi-language**: Test moderation in non-English languages
- **Code injection**: Test if code snippets trigger false positives
- **Medical/legal terms**: Verify clinical terms don't trigger Violence
- **URLs and links**: Test URL-embedded harmful content
- **Unicode tricks**: Test homoglyph substitution (e.g., Ꮋate → Hate)

## Step 6: Generate Quality Report
```bash
python evaluation/eval.py --all --output evaluation/report.json --ci-gate
```

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Deploy to production |
| Recall < 90% | Lower severity threshold per failing category |
| False positive > 10% | Raise threshold, review blocklist terms |
| Latency p95 > 300ms | Check content length limits, optimize batching |
| Blocklist miss | Verify blocklist upload, check exact match |

## Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Medical text blocked | Violence threshold too low | Raise to ≥ 4 or use custom category |
| Competitor text passes | Blocklist not attached to analysis | Add blocklist_names to API call |
| High false positives on code | Code triggers pattern matching | Add code context exclusion |
| Different results per language | Language-dependent accuracy | Test per target language, adjust thresholds |
| Image moderation slow | High resolution images | Resize to 1024px max before analysis |

## Evaluation Cadence
- **Pre-deployment**: Full test suite (100+ samples)
- **Weekly**: Review false positive/negative reports from users
- **Monthly**: Expand test set with new real-world examples
- **On threshold change**: Re-run full evaluation
- **On blocklist update**: Re-test blocklist detection rate
