---
name: evaluate-fine-tuning-workflow
description: "Evaluate Fine-Tuning — compare fine-tuned vs base model on task-specific benchmarks, check overfitting, measure improvement on target metrics. Use when: evaluate, benchmark, compare."
---

# Evaluate Fine-Tuning Workflow

## When to Use
- Compare fine-tuned model against base model
- Check for overfitting (training vs validation loss)
- Measure task-specific improvement metrics
- Validate model quality before deployment
- Gate promotion from staging to production

## Evaluation Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Task accuracy improvement | ≥ 10% over base | Side-by-side eval on test set |
| Training loss | Decreasing | Training logs |
| Validation loss | Decreasing (not diverging) | Training logs |
| Overfitting gap | < 0.1 (train_loss - val_loss) | Loss curve analysis |
| Format compliance | ≥ 98% | Output matches expected schema |
| Hallucination rate | ≤ base model | Factual accuracy test |
| Latency | ≤ base model + 10% | Inference timing |
| Cost per 1K tokens | Documented | Token pricing comparison |

## Step 1: Analyze Training Curves
```bash
python evaluation/analyze_training.py --job-id $JOB_ID
```
- Plot training loss vs validation loss over epochs
- **Healthy**: Both decreasing, gap < 0.1
- **Overfitting**: Training loss decreasing, validation increasing → reduce epochs
- **Underfitting**: Both high → increase epochs or learning rate

## Step 2: Prepare Evaluation Test Set
Create test samples NOT in training data:
```json
{"messages": [{"role": "user", "content": "What is the return window?"}], "expected": "30 days from purchase date", "category": "policy"}
{"messages": [{"role": "user", "content": "Can I get a refund for digital items?"}], "expected": "Digital items are non-refundable", "category": "policy"}
```
Minimum: 50 test samples, diverse across categories.

## Step 3: Side-by-Side Comparison
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl \
  --models base:gpt-4o-mini ft:$FINE_TUNED_MODEL \
  --metrics accuracy,format_compliance,hallucination
```
- Run identical prompts through both models
- Compare: accuracy, format adherence, response quality
- Score each response on 1-5 scale (automated + human spot-check)

## Step 4: Domain-Specific Evaluation
Depending on fine-tuning use case:
| Use Case | Key Metric | Test Method |
|----------|-----------|-------------|
| Classification | F1, precision, recall | Labeled test set |
| Extraction | Field accuracy | Ground truth comparison |
| Style transfer | Consistency score | Style classifier |
| Code generation | Pass@1 | Unit test execution |
| Summarization | ROUGE-L, BERTScore | Reference summaries |
| Q&A | Exact match, F1 | Ground truth answers |

## Step 5: Check for Regression
- Run base model's original benchmark suite on fine-tuned model
- Fine-tuned model should NOT regress on general capabilities
- If regression > 5%: training data may be too narrow (catastrophic forgetting)

## Step 6: Generate Evaluation Report
```bash
python evaluation/eval.py --full-report --output evaluation/report.json
```

### Promotion Gate Decision
| Result | Action |
|--------|--------|
| ≥10% improvement, no overfitting | Deploy to production |
| 5-10% improvement | Deploy with monitoring, plan more data |
| <5% improvement | Fine-tuning not justified — use prompt engineering |
| Overfitting detected | Reduce epochs, increase training data |
| Regression on general tasks | Reduce LoRA rank, add general data to mix |

## Common Evaluation Pitfalls

| Pitfall | Why Wrong | Fix |
|---------|----------|-----|
| Test set overlaps training | Inflated metrics | Verify no duplicates between sets |
| Only testing happy path | Misses edge cases | Include adversarial and edge test cases |
| No base model comparison | Can't prove improvement | Always compare to base model baseline |
| Single-metric evaluation | Misses regressions | Use multiple metrics across dimensions |
| No human evaluation | Automated may miss quality issues | Spot-check 20+ samples manually |

## Evaluation Cadence
- **Post-training**: Full evaluation before any deployment
- **Pre-promotion**: Side-by-side comparison at each stage (dev→staging→prod)
- **Monthly**: Re-evaluate with fresh test data on deployed model
- **On data update**: Re-evaluate if training data is augmented
- **On base model update**: Re-evaluate if Azure updates the base model version
