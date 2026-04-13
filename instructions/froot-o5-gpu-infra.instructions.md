---
description: "GPU infrastructure standards — VRAM sizing, quantization selection, serving framework config, scaling rules."
applyTo: "**/*.yaml, **/*.py"
waf:
  - "performance-efficiency"
  - "cost-optimization"
---

# GPU Infrastructure — FAI Standards

> VRAM sizing, quantization selection, GPU SKU mapping, AKS node pools, serving frameworks, and multi-GPU inference.

## VRAM Sizing Rules

Estimate VRAM as **2× parameter count** for FP16, then adjust by quantization:

| Model Size | FP16   | INT8   | INT4 (GPTQ/AWQ) | GGUF Q4_K_M |
|------------|--------|--------|------------------|-------------|
| 7B         | 14 GB  | 7 GB   | 4 GB             | 4.5 GB      |
| 13B        | 26 GB  | 13 GB  | 7.5 GB           | 8 GB        |
| 34B        | 68 GB  | 34 GB  | 20 GB            | 21 GB       |
| 70B        | 140 GB | 70 GB  | 40 GB            | 42 GB       |

- Add **15-25%** overhead for KV cache, CUDA context, and activation memory
- KV cache scales with `batch_size × seq_len × num_layers × 2 × hidden_dim × precision_bytes`
- For long-context models (32k+), KV cache can exceed model weights — always benchmark

## Quantization Selection

- **FP16**: baseline accuracy, required for fine-tuning, 2× VRAM vs INT8
- **INT8 (bitsandbytes)**: <1% quality loss for most tasks, halves VRAM, good default for inference
- **GPTQ/AWQ (INT4)**: 1-3% quality loss, best throughput/VRAM ratio for serving at scale
- **GGUF Q4_K_M**: CPU-friendly fallback, acceptable for ≤13B models on edge/dev
- Always run eval benchmarks (MMLU, HumanEval) after quantization before promoting to production

```python
# Preferred: AWQ quantization for serving
from vllm import LLM
model = LLM(
    model="TheBloke/Llama-2-70B-AWQ",
    quantization="awq",
    tensor_parallel_size=2,       # 2× A100-80GB
    max_model_len=4096,
    gpu_memory_utilization=0.90,  # reserve 10% for KV cache headroom
)
```

## GPU SKU Selection (Azure)

| SKU                      | GPU         | VRAM  | Use Case                                  |
|--------------------------|-------------|-------|--------------------------------------------|
| Standard_NC24ads_A100_v4 | A100 80GB   | 80 GB | 70B INT4, 34B FP16, high-throughput serving |
| Standard_NC40ads_H100_v5 | H100 80GB   | 80 GB | 70B FP16 w/ tensor parallelism, training   |
| Standard_NC16as_T4_v3    | T4 16GB     | 16 GB | 7B FP16, 13B INT8, dev/staging             |
| Standard_NV36ads_A10_v5  | A10G 24GB   | 24 GB | 13B FP16, 34B INT4, cost-effective mid-tier |

- Never deploy 70B models on T4 — memory pressure causes OOM and silent degradation
- Use T4 for dev/staging only; A100/H100 for production serving
- Prefer NCSv3 over older NC SKUs (better $/TFLOP and driver support)

## AKS GPU Node Pools

```bicep
resource gpuNodePool 'Microsoft.ContainerService/managedClusters/agentPools@2024-01-01' = {
  name: 'gpua100'
  parent: aksCluster
  properties: {
    vmSize: 'Standard_NC24ads_A100_v4'
    count: 2
    minCount: 1
    maxCount: 4
    enableAutoScaling: true
    nodeLabels: {
      'gpu.nvidia.com/class': 'A100'
      'workload-type': 'ml-inference'
    }
    nodeTaints: [
      'nvidia.com/gpu=present:NoSchedule'
    ]
    osDiskSizeGB: 128
    osType: 'Linux'
    scaleSetPriority: 'Regular'  // Spot for training only
  }
}
```

- Always apply `nvidia.com/gpu=present:NoSchedule` taint — prevents CPU workloads on GPU nodes
- Pod tolerations must match: `tolerations: [{key: nvidia.com/gpu, operator: Exists, effect: NoSchedule}]`
- Install NVIDIA device plugin via `nvidia-device-plugin` DaemonSet or AKS GPU addon
- Set resource requests: `resources.limits: { nvidia.com/gpu: 1 }` — Kubernetes won't share GPUs without MIG

## vLLM Serving Configuration

```bash
# Production vLLM deployment
python -m vllm.entrypoints.openai.api_server \
  --model /models/llama-2-70b-awq \
  --quantization awq \
  --tensor-parallel-size 2 \
  --max-model-len 4096 \
  --gpu-memory-utilization 0.90 \
  --max-num-seqs 256 \
  --enable-chunked-prefill \
  --disable-log-requests \
  --port 8000
```

- `gpu-memory-utilization=0.90` — reserve 10% headroom to prevent OOM under burst
- `max-num-seqs` controls concurrent batch size — tune to maximize throughput without OOM
- Enable `--enable-chunked-prefill` for long-context workloads (reduces TTFT variance)
- For TGI: `--max-batch-prefill-tokens 4096 --max-total-tokens 8192 --max-input-length 4096`

## Multi-GPU Inference

- **Tensor parallelism (TP)**: split layers across GPUs on same node — use for models exceeding single GPU VRAM
- **Pipeline parallelism (PP)**: split stages across nodes — use when TP alone is insufficient
- TP=2 for 70B INT4 on 2×A100-80GB, TP=4 for 70B FP16 on 4×A100-80GB
- NVLink required for efficient TP (PCIe bottleneck kills throughput — verify with `nvidia-smi topo -m`)
- Never set TP > number of GPUs physically available — vLLM will silently fallback or crash

## CUDA Compatibility

- Pin CUDA version in container images: `FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04`
- Match PyTorch CUDA version to driver: `torch==2.3.0+cu124`
- Validate at startup: `torch.cuda.is_available()` and `torch.version.cuda`
- Driver ≥ 535.x for CUDA 12.x, ≥ 525.x for CUDA 11.8 — verify on GPU nodes before deployment

## Health Monitoring

```python
# GPU health probe for Kubernetes readiness
import subprocess, json

def gpu_health() -> dict:
    result = subprocess.run(
        ["nvidia-smi", "--query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu",
         "--format=csv,noheader,nounits"],
        capture_output=True, text=True
    )
    gpu_util, mem_used, mem_total, temp = result.stdout.strip().split(", ")
    mem_pct = float(mem_used) / float(mem_total) * 100
    healthy = float(temp) < 85 and mem_pct < 95
    return {"healthy": healthy, "gpu_util": gpu_util, "mem_pct": round(mem_pct, 1), "temp_c": temp}
```

- Alert when GPU utilization <10% sustained (over-provisioned) or >95% sustained (under-provisioned)
- Alert when GPU temperature >83°C — thermal throttling starts at 85°C on A100
- Track VRAM usage vs allocation — OOM kills are silent without monitoring
- Export metrics to Azure Monitor via Prometheus + NVIDIA DCGM exporter

## Batch Size Optimization

- Start with `max_num_seqs=1`, double until throughput plateaus or VRAM hits 90%
- Larger batches improve throughput but increase latency — optimize for SLO (p95 < 2s typical)
- For training: gradient accumulation to simulate large batches when VRAM is limited
- Profile with `torch.cuda.memory_summary()` to identify fragmentation

## Anti-Patterns

- ❌ Deploying FP16 models on GPUs with insufficient VRAM (causes OOM, swap thrashing)
- ❌ Running GPU node pools without taints (CPU pods scheduled on expensive GPU nodes)
- ❌ Using `gpu-memory-utilization=1.0` (no headroom for KV cache spikes → random OOM)
- ❌ Setting TP > physical GPU count (silent fallback to CPU or crash)
- ❌ Skipping quantization benchmarks before production (quality regression undetected)
- ❌ Using Spot/Low-priority VMs for inference (evictions cause request failures)
- ❌ Hardcoding CUDA version without pinning in Dockerfile (driver mismatch on node upgrade)
- ❌ No GPU health monitoring (thermal throttling and OOM go undetected for hours)
- ❌ Over-provisioning A100 for 7B models (T4 serves 7B FP16 at 1/10th the cost)

## WAF Alignment

| Pillar | GPU Infrastructure Rule |
|--------|------------------------|
| **Performance Efficiency** | Size GPU SKU to model VRAM + 15-25% headroom; use tensor parallelism for multi-GPU; tune batch size to maximize throughput within latency SLO |
| **Cost Optimization** | Use T4/A10G for ≤13B models; Spot VMs for training only; auto-scale GPU node pools to zero during off-hours; quantize to INT4/INT8 to reduce GPU count |
| **Reliability** | Taint GPU nodes; pin CUDA versions; health probes with `nvidia-smi`; graceful OOM handling with memory reservation; readiness gates on model load |
| **Operational Excellence** | DCGM Prometheus exporter → Azure Monitor; GPU utilization dashboards; automated node pool scaling; Bicep IaC for all GPU infrastructure |
| **Security** | Private container registries for model weights; no model download at runtime from public URLs; scan container images for CVEs; RBAC on GPU node pools |
