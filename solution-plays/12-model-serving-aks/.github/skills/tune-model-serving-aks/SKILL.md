---
name: tune-model-serving-aks
description: "Tune Model Serving AKS — optimize GPU utilization, quantization level, batch size, spot node pools, auto-scaling rules, cost per inference. Use when: tune, optimize, reduce cost."
---

# Tune Model Serving AKS

## When to Use
- Optimize GPU utilization (target 70-90%)
- Choose optimal quantization level for cost vs quality
- Configure batch size and continuous batching
- Set up spot node pools for cost savings
- Tune auto-scaling rules for workload patterns
- Reduce cost per inference token

## Tuning Dimensions

### Dimension 1: Quantization Selection

| Method | VRAM Reduction | Quality Loss | Speed | Best For |
|--------|---------------|-------------|-------|---------|
| None (FP16) | Baseline | 0% | 1x | Max quality, enough VRAM |
| GPTQ (4-bit) | ~75% | 1-3% | 1.2-1.5x | Most production workloads |
| AWQ (4-bit) | ~75% | 1-2% | 1.3-1.6x | Balanced quality/speed |
| GGUF (Q4_K_M) | ~75% | 2-4% | 1.1-1.3x | CPU/mixed inference |
| bitsandbytes (8-bit) | ~50% | <1% | 0.9x | Quality-sensitive, limited VRAM |

**Decision rule**: Start with AWQ 4-bit. If quality drops >3% on eval set, switch to 8-bit or FP16.

### Dimension 2: vLLM Serving Configuration

| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| `max-model-len` | Auto | 2048-32768 | Lower = more concurrent requests |
| `gpu-memory-utilization` | 0.9 | 0.7-0.95 | Higher = more KV cache, fewer OOMs |
| `max-num-batched-tokens` | Auto | 2048-8192 | Higher = more throughput, more latency |
| `max-num-seqs` | 256 | 16-512 | Concurrent sequences in batch |
| `enable-prefix-caching` | False | True/False | True = faster TTFT for repeated prefixes |
| `tensor-parallel-size` | 1 | 1-8 | Multi-GPU parallelism |

### Dimension 3: Kubernetes Scaling

| Strategy | Configuration | When to Use |
|----------|--------------|-------------|
| HPA on GPU util | Scale at 80% GPU | General-purpose serving |
| HPA on queue depth | Scale at 10 pending | Bursty workloads |
| KEDA on custom metric | Scale on tokens/sec | Fine-grained control |
| Scheduled scaling | Pre-scale at peak hours | Predictable traffic patterns |
| Cluster autoscaler | Add nodes when pods pending | Node-level elasticity |

**HPA configuration**:
- Scale-up: trigger at 80% GPU util, no cooldown
- Scale-down: trigger at 30% GPU util, 10-minute cooldown
- Min replicas: 1 (or 0 with KEDA scale-to-zero)
- Max replicas: based on GPU quota and budget

### Dimension 4: Spot Node Pools

| Aspect | Regular | Spot | Savings |
|--------|---------|------|---------|
| Price | 100% | 10-40% of regular | 60-90% |
| Eviction | Never | Possible (30s notice) | — |
| SLA | 99.95% | None | — |
| Use case | Production serving | Batch inference, dev/test | — |

**Spot strategy**:
- Production: regular nodes for base load + spot for burst
- Dev/test: 100% spot (accept occasional evictions)
- Batch: 100% spot with checkpointing

### Dimension 5: Cost Per Inference

**Cost breakdown** (A100 80GB, ~$3.67/hr):
| Component | Calculation | Cost |
|-----------|-----------|------|
| GPU compute | $3.67/hr ÷ 500 tok/s = | ~$0.000002/token |
| Cluster mgmt | ~$0.10/hr (AKS free tier) | Negligible |
| Networking | ~$0.01/GB egress | ~$0.0001/request |
| Storage (model) | ~$0.018/GB/month | ~$50/month (per model) |
| ACR | ~$5/month (Basic) | Fixed |

**Monthly estimate** (10M tokens/day):
- GPU (1 A100): ~$2,642/mo (regular) or ~$792 (spot)
- With reserved instance (1y): ~$1,850/mo (30% savings)
- With spot + reserved: ~$550/mo (lowest)

**Optimization strategies**:
1. Right-size GPU: Don't use A100 for 7B model (NC6s_v3 sufficient)
2. Quantize: 4-bit AWQ reduces VRAM, allows smaller GPU
3. Spot for non-critical: batch inference, dev workers
4. Reserved for production: 30-60% savings for committed workloads
5. Scale to zero: KEDA when no traffic (dev/staging)

## Production Readiness Checklist
- [ ] GPU utilization 70-90% under production load
- [ ] Quantization tested — quality delta < 3% vs FP16
- [ ] HPA configured with appropriate scaling metrics
- [ ] Spot node pool for burst capacity (if applicable)
- [ ] Health probes (liveness + readiness) passing
- [ ] Model loading < 5 minutes on cold start
- [ ] Continuous batching enabled for throughput
- [ ] Pod disruption budget set (minAvailable: 1)
- [ ] NVIDIA DCGM exporter for GPU monitoring
- [ ] Cost alerts configured for GPU spend

## Output: Tuning Report
After tuning, compare before/after:
- Throughput delta (tokens/sec/GPU)
- TTFT improvement
- GPU utilization change
- Cost per 1M tokens reduction
- Quantization quality impact
