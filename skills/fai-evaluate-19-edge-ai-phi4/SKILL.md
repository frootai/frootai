---
name: fai-evaluate-19-edge-ai-phi4
description: |
  Evaluate Edge AI with Phi-4 for on-device inference performance, offline
  resilience, model size constraints, and quality parity with cloud models.
  Use when deploying small language models to edge devices.
---

# Evaluate Edge AI — Phi-4 (Play 19)

Evaluate on-device AI performance, offline capability, and quality tradeoffs.

## When to Use

- Benchmarking Phi-4 vs cloud models for edge deployment
- Measuring inference latency on constrained hardware
- Validating offline mode reliability
- Assessing quality parity between edge and cloud

---

## Benchmark Framework

```python
import time

def benchmark_edge_model(model_path: str, test_prompts: list[str],
                          device: str = "cpu") -> dict:
    from transformers import AutoModelForCausalLM, AutoTokenizer
    import torch

    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = AutoModelForCausalLM.from_pretrained(model_path,
        torch_dtype=torch.float16, device_map=device)

    latencies, token_counts = [], []
    for prompt in test_prompts:
        inputs = tokenizer(prompt, return_tensors="pt").to(device)
        start = time.monotonic()
        outputs = model.generate(**inputs, max_new_tokens=256)
        elapsed = (time.monotonic() - start) * 1000
        latencies.append(elapsed)
        token_counts.append(outputs.shape[-1])

    return {
        "model": model_path, "device": device,
        "latency_p50_ms": sorted(latencies)[len(latencies)//2],
        "latency_p95_ms": sorted(latencies)[int(len(latencies)*0.95)],
        "avg_tokens": sum(token_counts) / len(token_counts),
        "n": len(test_prompts),
    }
```

## Cloud vs Edge Quality Comparison

```python
def compare_edge_cloud(edge_fn, cloud_fn, test_set, judge_fn) -> dict:
    edge_scores, cloud_scores = [], []
    for row in test_set:
        edge_out = edge_fn(row["input"])
        cloud_out = cloud_fn(row["input"])
        edge_scores.append(judge_fn(edge_out, row["expected"]))
        cloud_scores.append(judge_fn(cloud_out, row["expected"]))
    return {
        "edge_avg": sum(edge_scores) / len(edge_scores),
        "cloud_avg": sum(cloud_scores) / len(cloud_scores),
        "quality_gap": (sum(cloud_scores) - sum(edge_scores)) / len(edge_scores),
    }
```

## Model Size Comparison

| Model | Parameters | Size (FP16) | Target Device |
|-------|-----------|-------------|---------------|
| Phi-4-mini | 3.8B | ~7.5 GB | Laptop, workstation |
| Phi-4 | 14B | ~28 GB | Server, high-end GPU |
| GPT-4o-mini (cloud) | — | API | Any (needs internet) |

## Offline Resilience Test

```python
def test_offline_mode(model_fn, prompts: list[str]) -> dict:
    """Test that edge model works without network."""
    import socket
    original = socket.socket.connect
    socket.socket.connect = lambda *a: (_ for _ in ()).throw(ConnectionError("Offline"))
    try:
        results = [model_fn(p) for p in prompts]
        success = sum(1 for r in results if r and len(r) > 10)
        return {"offline_success_rate": success / len(prompts)}
    finally:
        socket.socket.connect = original
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Inference too slow | Model too large for device | Use quantized (INT4) version |
| Quality gap >15% | Task too complex for small model | Keep complex tasks on cloud, simple on edge |
| OOM on device | Insufficient RAM | Reduce batch size or use streaming |
| Inconsistent outputs | No seed in generation | Set torch.manual_seed() |
