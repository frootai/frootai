---
name: evaluate-it-ticket-resolution
description: "Evaluate IT Ticket AI — test classification accuracy, routing correctness, SLA compliance, PII detection, resolution success rate. Use when: evaluate, test, quality."
---

# Evaluate IT Ticket Resolution

## When to Use
- Evaluate ticket classification accuracy across categories
- Measure auto-resolution success rate
- Validate SLA compliance and escalation timing
- Test PII detection and masking coverage
- Gate deployments with quality thresholds

## Quality Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Classification accuracy | ≥ 92% | Labeled test set comparison |
| Priority assignment accuracy | ≥ 95% | P1-P4 label match |
| Auto-resolution rate | ≥ 60% | Tickets resolved without human |
| SLA compliance | ≥ 95% | Tickets resolved within SLA window |
| PII detection recall | ≥ 99% | Known PII test patterns |
| First-response time | < 30 seconds | Time from creation to AI response |
| KB retrieval relevance | ≥ 0.8 | Groundedness of KB-sourced answers |
| False escalation rate | < 10% | Tickets unnecessarily sent to humans |

## Step 1: Prepare Test Dataset
Create labeled test cases in `evaluation/test-set.jsonl`:
```json
{"id": "t001", "ticket": "Cannot connect to VPN from home", "category": "Network", "priority": "P3", "resolution": "Reset VPN credentials in portal", "has_pii": false}
{"id": "t002", "ticket": "Laptop won't boot, employee ID 12345", "category": "Hardware", "priority": "P2", "resolution": "Submit hardware replacement request", "has_pii": true}
{"id": "t003", "ticket": "Production DB unreachable, 500 errors on main app", "category": "Software", "priority": "P1", "resolution": "escalate_to_human", "has_pii": false}
```
Minimum: 50 test cases spanning all categories and priorities.

## Step 2: Run Classification Evaluation
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics classification
```
- Compare predicted category vs labeled category
- Per-category precision, recall, F1
- Confusion matrix to identify systematic misclassifications
- Priority accuracy (P1 misclassified as P4 = critical failure)

## Step 3: Evaluate Auto-Resolution
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics resolution
```
- Track which tickets AI resolved successfully
- Measure KB retrieval relevance (groundedness score)
- Verify resolution matches expected answer semantically
- Flag cases where AI hallucinated a resolution

## Step 4: SLA Compliance Evaluation
- Simulate ticket lifecycle with timestamps
- Verify escalation triggers at correct SLA thresholds
- P1: escalate if no resolution in 45 minutes
- P2: escalate if no resolution in 3 hours
- Verify SLA clock pauses during "waiting for user" status

## Step 5: PII Detection Evaluation
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics pii
```
- Test with known PII patterns (SSN, credit cards, emails, phone numbers)
- Verify 99%+ recall (missing PII is a compliance violation)
- Check that masked output preserves ticket context for classification

## Step 6: Generate Quality Report
```bash
python evaluation/eval.py --all --output evaluation/report.json --ci-gate
```

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Deploy to production |
| Classification < 85% | Expand training examples for failing categories |
| Resolution < 50% | Improve KB content, add more runbooks |
| PII recall < 95% | Blockers — fix PII patterns before deploying |
| SLA compliance < 90% | Tune escalation timing, reduce resolution latency |

## Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Software vs Hardware confusion | Overlapping keywords ("screen") | Add disambiguation examples |
| P1 classified as P3 | Missing urgency keywords | Add "production", "outage", "down" to P1 patterns |
| Auto-resolution gives wrong answer | KB retrieval returns irrelevant doc | Improve chunking, add semantic reranking |
| PII missed in attachments | OCR not enabled | Enable document intelligence for attachments |
| False escalation spike | Confidence threshold too high | Lower from 0.9 to 0.85 |

## CI/CD Integration
```yaml
# Add quality gates to CI pipeline
- name: Classification Gate
  run: python evaluation/eval.py --metrics classification --ci-gate --threshold 0.92
- name: PII Detection Gate
  run: python evaluation/eval.py --metrics pii --ci-gate --threshold 0.99
- name: Resolution Gate
  run: python evaluation/eval.py --metrics resolution --ci-gate --threshold 0.60
```

## Evaluation Cadence
- **Pre-deployment**: Full evaluation suite (all metrics)
- **Weekly**: Classification accuracy check on new tickets
- **Monthly**: Full re-evaluation with updated test set
- **On KB update**: Re-evaluate resolution quality
