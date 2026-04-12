---
name: evaluate-model-serving-aks
description: "Evaluate Model Serving AKS — benchmark inference throughput (tokens/sec), latency (TTFT, TPS), GPU utilization, pod health, scaling behavior. Use when: evaluate, benchmark, load test."
---

# Evaluate Model Serving AKS

## When to Use
- Benchmark inference throughput and latency
- Measure GPU utilization under load
- Test horizontal scaling behavior
- Validate health probes and pod recovery
- Gate deployments with performance thresholds

## Performance Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Throughput | ≥ 500 tokens/sec per GPU | Load test with concurrent requests |
| Time to First Token (TTFT) | < 500ms | Request-level timing |
| Tokens Per Second (TPS) | ≥ 30 per request | Streaming response timing |
| GPU utilization | 70-90% under load | nvidia-smi / DCGM metrics |
| Pod restart count | 0 during test | kubectl get pods |
| Scale-up time | < 3 minutes | HPA scaling latency |
| P99 latency | < 5 seconds | Tail latency under load |
| Error rate | < 0.1% | HTTP 5xx / total requests |

## Step 1: Baseline Performance
```bash
# Single request latency
python evaluation/benchmark.py --endpoint $ENDPOINT --requests 1 --concurrent 1

# Measure TTFT and TPS
python evaluation/benchmark.py --endpoint $ENDPOINT --requests 10 --concurrent 1 --metrics ttft,tps
```

## Step 2: Load Test
```bash
# Ramp up to 50 concurrent requests
python evaluation/benchmark.py --endpoint $ENDPOINT \
  --requests 500 --concurrent 50 --duration 300s \
  --output evaluation/load-test-report.json
```
Monitor during test:
```bash
# GPU utilization (in another terminal)
kubectl exec -it llm-serving-xxx -- nvidia-smi --loop=5

# Pod metrics
kubectl top pods -l app=llm-serving
```

## Step 3: Evaluate Scaling Behavior
- Start with 1 replica, send increasing load
- Verify HPA triggers scale-up at GPU utilization threshold
- Measure time from trigger to new pod serving requests
- Verify scale-down after load decreases (cooldown period)
- Check: does adding replicas linearly increase throughput?

## Step 4: Reliability Testing
- Kill a pod: `kubectl delete pod llm-serving-xxx` → verify auto-recovery
- Simulate GPU failure: taint node → verify pod migration
- Test with oversized requests (max_tokens=4096) → verify graceful handling
- Send malformed requests → verify error handling (no crash)

## Step 5: Model Quality Spot-Check
- Run 20 diverse prompts through the served model
- Compare output quality to cloud-hosted Azure OpenAI baseline
- Check for quantization artifacts (if using GPTQ/AWQ)
- Verify consistent outputs across pods (same weights loaded)

## Step 6: Generate Report
```bash
python evaluation/benchmark.py --endpoint $ENDPOINT --full-report --output evaluation/report.json
```

### Performance Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Approve for production traffic |
| Throughput < 300 tok/s | Enable continuous batching, check GPU type |
| TTFT > 1s | Reduce model size or use tensor parallelism |
| GPU util < 50% | Right-size to smaller GPU VM |
| GPU util > 95% | Add replicas or upgrade GPU VM |
| Pod restarts > 0 | Check OOM, increase memory limits |

## Common Issues

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Low throughput | Batching disabled | Enable continuous batching in vLLM config |
| High TTFT | Cold KV cache | Enable prefix caching |
| OOM crashes | VRAM exceeded | Use smaller model or AWQ quantization |
| Uneven load across pods | Sticky sessions | Use round-robin load balancing |
| Slow scale-up | Large container image | Pre-pull images, use init containers |

## Evaluation Cadence
- **Pre-deployment**: Full benchmark + load test
- **Weekly**: Spot-check latency and throughput
- **On model update**: Full re-benchmark comparing old vs new
- **On cluster change**: Re-evaluate after node pool modifications
