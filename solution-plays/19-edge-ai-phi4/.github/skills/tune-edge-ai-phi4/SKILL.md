---
name: tune-edge-ai-phi4
description: "Tune Edge AI Phi-4 — optimize quantization level, ONNX Runtime threads, prompt compression, cloud sync frequency, hybrid inference routing. Use when: tune, optimize edge performance."
---

# Tune Edge AI Phi-4

## When to Use
- Select optimal quantization level for device constraints
- Configure ONNX Runtime for best on-device performance
- Compress prompts to reduce inference time
- Configure cloud sync frequency and offline strategy
- Set up hybrid inference (edge for simple, cloud for complex)

## Tuning Dimensions

### Dimension 1: Quantization Level Selection

| Level | Size | RAM | Quality Loss | Speed | Best For |
|-------|------|-----|-------------|-------|---------|
| FP16 | 7.5 GB | 8 GB | 0% | 1x | Laptops with 16+ GB RAM |
| INT8 | 3.8 GB | 4 GB | 1-2% | 1.5x | Moderate devices (8 GB RAM) |
| INT4 AWQ | 2.0 GB | 2.5 GB | 1-3% | 2.2x | Edge devices (4-8 GB RAM) |
| INT4 GPTQ | 2.0 GB | 2.5 GB | 2-4% | 2x | Budget edge devices |

**Decision rule**: Start with INT4 AWQ. If quality drops >3% on eval → upgrade to INT8. If device has 16+ GB → use FP16.

### Dimension 2: ONNX Runtime Configuration

| Parameter | Default | Edge (4 core) | Laptop (8 core) | Impact |
|-----------|---------|-------------|----------------|--------|
| `intra_op_num_threads` | CPU count | 4 | 8 | Match physical cores |
| `inter_op_num_threads` | 1 | 1 | 2 | Parallelism between ops |
| `execution_mode` | Sequential | Sequential | Parallel | Edge: sequential (less RAM) |
| `graph_optimization_level` | ALL | ALL | ALL | Always enable |
| `enable_mem_pattern` | True | True | True | Reduces memory allocation |
| `enable_cpu_mem_arena` | True | False on low-mem | True | Disable if RAM < 4GB |

### Dimension 3: Prompt Compression for Edge

| Technique | Token Reduction | Quality Impact | Complexity |
|-----------|----------------|---------------|-----------|
| Short system prompt | 40-60% | Low | Low |
| No few-shot examples | 30-50% | Medium (5-10%) | Low |
| Abbreviate instructions | 15-25% | Low | Low |
| Remove formatting rules | 10-15% | Low | Low |
| Dynamic prompt by task | Varies | None | Medium |

**Edge prompt budget** (2048 context window on quantized model):
| Component | Budget |
|-----------|--------|
| System prompt | ≤ 200 tokens (10%) |
| User query | ≤ 200 tokens (10%) |
| Response space | ≥ 1600 tokens (80%) |

**Rule**: No few-shot examples on edge (too expensive). Use system prompt only.

### Dimension 4: Cloud Sync Strategy

| Strategy | Sync Interval | Data Sent | Best For |
|----------|-------------|-----------|---------|
| Real-time | Every request | Full telemetry | Always-connected devices |
| Batched | Every 15 min | Aggregated metrics | Intermittent connectivity |
| Daily | Every 24 hours | Summary only | Low-bandwidth devices |
| Manual | On-demand | Full or summary | Offline-first devices |

**Sync payload optimization**:
- Send aggregated metrics (count, avg latency, error count) not raw requests
- Compress telemetry with gzip before sync
- Queue on device when offline, batch-sync on reconnect
- Max queue size: 1000 events (prevent storage overflow on device)

### Dimension 5: Hybrid Inference Routing

| Query Type | Route | Latency | Quality | Cost |
|-----------|-------|---------|---------|------|
| Simple Q&A | Edge (Phi-4) | <2s | Good | $0 |
| Classification | Edge (Phi-4) | <1s | Good | $0 |
| Complex reasoning | Cloud (GPT-4o) | <3s | Best | $0.01 |
| Long document | Cloud (GPT-4o) | <5s | Best | $0.03 |
| Offline (any) | Edge (Phi-4) | <2s | Good | $0 |

**Routing logic**:
```python
def route_inference(prompt, is_online):
    if not is_online:
        return "edge"
    if len(tokenizer.encode(prompt)) < 500 and is_simple_task(prompt):
        return "edge"  # Fast, free
    return "cloud"     # Quality-critical, needs full model
```

**Cost impact**: 70% of queries routable to edge = 70% cost reduction vs all-cloud.

## Production Readiness Checklist
- [ ] Quantization level validated (quality loss < 3%)
- [ ] ONNX Runtime threads configured for target device
- [ ] Prompt compressed for edge context window
- [ ] Cloud sync strategy configured and tested
- [ ] Hybrid routing logic implemented and tested
- [ ] Offline mode verified (100% success no-network)
- [ ] Model load time < 10s on target device
- [ ] Memory usage < 80% of device RAM
- [ ] Battery impact documented and acceptable

## Output: Tuning Report
After tuning, compare:
- Quantization level impact (quality vs speed vs size)
- ONNX Runtime config impact on inference speed
- Prompt compression savings (tokens reduced)
- Hybrid routing cost savings (% queries on edge)
- Cloud sync bandwidth reduction
