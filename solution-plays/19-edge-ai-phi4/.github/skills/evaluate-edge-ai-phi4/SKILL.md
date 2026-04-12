---
name: evaluate-edge-ai-phi4
description: "Evaluate Edge AI Phi-4 — benchmark inference speed, memory footprint, quality vs cloud model, offline reliability, battery impact. Use when: evaluate, benchmark edge performance."
---

# Evaluate Edge AI Phi-4

## When to Use
- Benchmark on-device inference speed and memory usage
- Compare edge model quality against cloud-hosted baseline (GPT-4o)
- Test offline reliability (no network scenarios)
- Measure battery impact on mobile/IoT devices
- Gate edge deployments with performance thresholds

## Edge Performance Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Inference latency (TTFT) | < 2s on edge, < 500ms on laptop | Time from prompt to first token |
| Tokens per second | ≥ 5 tok/s edge, ≥ 20 tok/s laptop | Streaming output timing |
| Peak memory usage | < device RAM × 80% | Process memory monitoring |
| Model load time | < 10s edge, < 3s laptop | Cold start timing |
| Quality vs cloud | ≥ 85% of GPT-4o quality | Side-by-side eval on test set |
| Offline success rate | 100% | Inference with network disabled |
| Battery impact | < 5% per 100 inferences | Battery level monitoring |
| Storage footprint | < 50% of device storage | Model + runtime size |

## Step 1: Benchmark Inference Speed
```bash
python evaluation/benchmark_edge.py --model models/phi4-int4/ \
  --prompts evaluation/test-set.jsonl --warmup 3 --iterations 50
```
Measure per device type:
- Time to load model (cold start)
- Time to first token (TTFT)
- Tokens per second (sustained generation)
- Peak RSS memory during inference

## Step 2: Quality Comparison (Edge vs Cloud)
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl \
  --models edge:models/phi4-int4/ cloud:gpt-4o \
  --metrics accuracy,coherence,completeness
```
- Run identical prompts through both models
- Score responses on accuracy, coherence, completeness (1-5)
- Calculate quality ratio: edge_score / cloud_score
- Target: ≥ 85% of cloud quality for edge-appropriate tasks

## Step 3: Quantization Quality Impact
| Test | FP16 Score | INT8 Score | INT4 Score |
|------|-----------|-----------|-----------|
| Classification | Baseline | Run test | Run test |
| Summarization | Baseline | Run test | Run test |
| Q&A | Baseline | Run test | Run test |
| Code generation | Baseline | Run test | Run test |

If any category drops > 5% from FP16 → use less aggressive quantization.

## Step 4: Offline Reliability Testing
- Disable network on device
- Run 100 inference requests
- Verify: 100% success rate, no hanging, graceful error for features needing cloud
- Test reconnection: after network restored, queued telemetry syncs

## Step 5: Resource Constraint Testing
- Run inference while other apps are active (simulate real usage)
- Monitor: does inference cause OOM kill?
- Test with low battery (< 20%) — does device throttle CPU?
- Test disk full scenario — graceful handling?

## Step 6: Generate Report
```bash
python evaluation/benchmark_edge.py --full-report --output evaluation/edge-report.json
```

### Edge Deployment Gate
| Result | Action |
|--------|--------|
| All PASS | Deploy to edge fleet |
| Latency > 5s | Use more aggressive quantization or smaller model |
| Quality < 80% of cloud | Specific task not suitable for edge — keep in cloud |
| OOM on device | Reduce model size, check other processes |
| Battery drain > 10%/100inf | Optimize batch size, reduce inference frequency |

## Common Issues

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Very slow first inference | Cold model load | Pre-load model at device boot |
| Output quality poor | Over-quantized | Switch INT4 → INT8 |
| Device runs hot | CPU at 100% sustained | Limit threads, add inference cooldown |
| Inconsistent results | Non-deterministic without seed | Set seed in ONNX Runtime session |
| Crashes after 100+ queries | Memory leak | Check session cleanup, use session pool |

## Evaluation Cadence
- **Pre-deployment**: Full benchmark on target device hardware
- **Per device type**: Re-benchmark when deploying to new hardware
- **On model update**: Full quality comparison edge vs cloud
- **Monthly**: Spot-check on deployed fleet (telemetry analysis)
