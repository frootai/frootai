---
name: fai-tune-12-model-serving-aks
description: "Tune Play 12 (Model Serving AKS) GPU node pools, vLLM configuration, autoscaling policies, and inference optimization."
---

# FAI Tune — Play 12: Model Serving on AKS

## TuneKit Configuration Files

```
solution-plays/12-model-serving-aks/config/
├── cluster.json          # AKS cluster and node pool config
├── inference.json        # vLLM/TGI serving configuration
├── autoscaling.json      # KEDA + HPA autoscaling rules
├── networking.json       # Ingress and load balancing
└── guardrails.json       # Performance and cost thresholds
```

## Step 1 — Validate GPU Node Pool Config

```json
// config/cluster.json
{
  "cluster_name": "aks-model-serving",
  "kubernetes_version": "1.29",
  "node_pools": [
    {
      "name": "system",
      "vm_size": "Standard_D4s_v5",
      "count": 3,
      "mode": "System",
      "os_type": "Linux"
    },
    {
      "name": "gpu",
      "vm_size": "Standard_NC24ads_A100_v4",
      "count": 2,
      "min_count": 1,
      "max_count": 8,
      "mode": "User",
      "gpu_driver": "nvidia",
      "taints": ["nvidia.com/gpu=true:NoSchedule"],
      "labels": { "workload": "inference" }
    }
  ],
  "networking": {
    "network_plugin": "azure",
    "network_policy": "calico",
    "service_cidr": "10.0.0.0/16"
  }
}
```

**GPU VM sizing:**

| VM Size | GPU | VRAM | Use Case | Cost/hr |
|---------|-----|------|----------|---------|
| NC24ads_A100_v4 | 1x A100 | 80GB | Large models (70B quantized) | ~$3.67 |
| NC48ads_A100_v4 | 2x A100 | 160GB | Very large models or high QPS | ~$7.35 |
| NC6s_v3 | 1x V100 | 16GB | Small models (<7B) | ~$0.90 |
| NC4as_T4_v3 | 1x T4 | 16GB | Budget inference (<7B) | ~$0.53 |

## Step 2 — Configure vLLM Serving

```json
// config/inference.json
{
  "engine": "vllm",
  "model": "meta-llama/Llama-3.1-8B-Instruct",
  "tensor_parallel_size": 1,
  "max_model_len": 8192,
  "gpu_memory_utilization": 0.90,
  "max_num_seqs": 256,
  "quantization": "awq",
  "dtype": "float16",
  "enforce_eager": false,
  "port": 8000,
  "served_model_name": "llama-3.1-8b",
  "api_compatible": "openai"
}
```

**Tuning checklist:**

| Parameter | Range | Default | Guidance |
|-----------|-------|---------|----------|
| `gpu_memory_utilization` | 0.80-0.95 | 0.90 | Higher = more sequences but risk OOM |
| `max_num_seqs` | 64-512 | 256 | Concurrent sequences — affects throughput |
| `quantization` | none/awq/gptq | awq | AWQ gives best speed/quality tradeoff |
| `tensor_parallel_size` | 1-8 | 1 | Multi-GPU parallelism for large models |

## Step 3 — Configure Autoscaling

```json
// config/autoscaling.json
{
  "hpa": {
    "min_replicas": 1,
    "max_replicas": 8,
    "target_gpu_utilization": 70,
    "scale_up_stabilization_seconds": 60,
    "scale_down_stabilization_seconds": 300
  },
  "keda": {
    "enabled": true,
    "triggers": [
      { "type": "prometheus", "metadata": { "query": "vllm_pending_requests > 50", "threshold": "1" } },
      { "type": "prometheus", "metadata": { "query": "vllm_gpu_utilization_percent", "threshold": "80" } }
    ]
  },
  "scale_to_zero": {
    "enabled": false,
    "idle_timeout_minutes": 30
  }
}
```

## Step 4 — Set Guardrails

```json
// config/guardrails.json
{
  "performance": {
    "max_latency_p95_ms": 2000,
    "min_throughput_tokens_per_second": 100,
    "max_queue_depth": 100
  },
  "reliability": {
    "min_replicas": 1,
    "health_check_interval_seconds": 10,
    "restart_on_oom": true,
    "max_restarts_before_alert": 3
  },
  "cost": {
    "max_gpu_nodes": 8,
    "prefer_spot_instances": true,
    "spot_max_price": -1,
    "budget_alert_threshold_usd": 10000
  }
}
```

## Validation Checklist

| Check | Expected | Command |
|-------|----------|---------|
| GPU nodes provisioned | 1-8 | `kubectl get nodes -l workload=inference` |
| vLLM healthy | Ready | `curl http://localhost:8000/health` |
| P95 latency | <=2000ms | Prometheus query |
| GPU utilization | 60-85% | `nvidia-smi` |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| OOM kills | Memory utilization too high | Lower `gpu_memory_utilization` to 0.85 |
| Slow scaling | Stabilization window too long | Reduce `scale_up_stabilization_seconds` to 30 |
| High costs | Too many GPU nodes idle | Enable spot instances or scale-to-zero for non-prod |
| Model loading fails | Insufficient VRAM | Upgrade VM size or enable quantization |
