---
sidebar_position: 12
title: "O5: AI Infrastructure"
description: "AI infrastructure essentials — GPU vs CPU, VRAM sizing, precision formats, PTU vs PAYG, container patterns, and why AI workloads are fundamentally different from traditional web services."
---

# O5: AI Infrastructure

AI workloads are **memory-bound, not CPU-bound**. This single fact changes everything about how you provision, scale, and budget infrastructure. This module covers the hardware, sizing, and deployment patterns specific to AI. For the platform that manages AI deployments, see [O4: Azure AI Foundry](./o4-azure-ai-foundry.md). For cost optimization strategies, see the [Cost Optimization WAF pillar](./r3-deterministic-ai.md).

:::warning The Biggest Mistake
Treating AI inference like a traditional web service. Web apps scale with CPU cores and RAM. AI inference scales with **VRAM** — a completely different resource with different provisioning rules, costs, and constraints.
:::

## Traditional App vs AI Workload

| Dimension | Traditional Web App | AI Inference | AI Training |
|-----------|-------------------|--------------|-------------|
| **Bottleneck** | CPU, network I/O | VRAM, memory bandwidth | VRAM, interconnect |
| **Scaling unit** | CPU cores / instances | GPU VRAM | Multi-GPU clusters |
| **Latency** | 10–100ms | 500ms–10s (depends on tokens) | Hours to weeks |
| **Cost driver** | Compute hours | GPU hours + token count | GPU-hours × cluster size |
| **State** | Mostly stateless | KV-cache per request | Checkpoints, gradients |
| **Cold start** | Milliseconds | Seconds to minutes (model loading) | N/A (long-running) |

## CPU vs GPU vs TPU vs NPU

| Processor | Design | AI Role | Analogy |
|-----------|--------|---------|---------|
| **CPU** | Few powerful cores, general-purpose | Preprocessing, light inference | Master chef (1 person, any dish) |
| **GPU** | Thousands of simple cores, parallel math | Training + inference | Kitchen brigade (1000 cooks, one recipe) |
| **TPU** | Google's custom AI chip, matrix-optimized | Google Cloud training/inference | Purpose-built pasta machine |
| **NPU** | On-device neural processor | Edge AI, mobile inference | Microwave (quick, limited, local) |

For AI workloads, **GPU is the default choice**. CPUs work for small models (under 1B params) or when latency isn't critical.

## NVIDIA GPU Lineup for AI

| GPU | VRAM | Memory BW | FP16 TFLOPS | Best For | Azure VM |
|-----|------|-----------|-------------|----------|----------|
| **A10** | 24 GB | 600 GB/s | 125 | Small models, inference | NC A10 v4 |
| **A100** | 40/80 GB | 2 TB/s | 312 | Training + large inference | ND A100 v4 |
| **H100** | 80 GB | 3.35 TB/s | 990 | Large-scale training + inference | ND H100 v5 |
| **H200** | 141 GB | 4.8 TB/s | 990 | Very large models, high throughput | Coming |
| **B200** | 192 GB | 8 TB/s | 2,250 | Next-gen training | Coming |

:::info
Memory bandwidth matters as much as VRAM capacity. A model that fits in VRAM but starves on bandwidth will be slow. The H100's 3.35 TB/s bandwidth is why it dominates inference.
:::

## VRAM Sizing Formula

```
VRAM (GB) ≈ Parameters (Billions) × Bytes per Parameter
```

| Precision | Bytes/Param | 7B Model | 13B Model | 70B Model |
|-----------|-------------|----------|-----------|-----------|
| **FP32** | 4 | 28 GB | 52 GB | 280 GB |
| **FP16 / BF16** | 2 | 14 GB | 26 GB | 140 GB |
| **INT8** | 1 | 7 GB | 13 GB | 70 GB |
| **INT4** | 0.5 | 3.5 GB | 6.5 GB | 35 GB |

Add ~20% overhead for KV-cache, activations, and framework memory.

## Precision Formats

| Format | Bits | Quality | Speed | When to Use |
|--------|------|---------|-------|-------------|
| **FP32** | 32 | Perfect | Slowest | Training (loss calculation) |
| **FP16** | 16 | Near-perfect | 2× faster | Standard inference |
| **BF16** | 16 | Near-perfect (better range than FP16) | 2× faster | Training + inference (preferred) |
| **INT8** | 8 | Minimal loss | 4× faster | Production inference |
| **INT4** | 4 | Some quality loss | 8× faster | Edge/mobile, cost-optimized inference |

:::tip
For most production workloads: **train in BF16, serve in INT8**. You get 4× memory savings with minimal quality loss. Always benchmark against your evaluation suite before deploying quantized models — see [O4: Azure AI Foundry](./o4-azure-ai-foundry.md).
:::

## PTU vs PAYG on Azure OpenAI

| Dimension | PAYG (Pay-As-You-Go) | PTU (Provisioned Throughput Units) |
|-----------|---------------------|-----------------------------------|
| **Billing** | Per 1K tokens | Fixed monthly per PTU |
| **Latency** | Variable (shared infra) | Consistent (reserved capacity) |
| **Throughput** | Rate-limited (tokens/min) | Guaranteed minimum |
| **Cost at scale** | Linear with usage | Flat — cheaper above breakeven |
| **Best for** | Dev/test, variable workloads | Production with predictable volume |
| **Commitment** | None | Monthly or annual reservation |

**Breakeven rule of thumb**: if you consistently spend >$5K/month on PAYG for a single model, evaluate PTU.

## GPU Sizing Guide

| Model Size | Min VRAM (INT8) | Recommended GPU | Azure VM Series | Est. Cost/hr |
|-----------|-----------------|-----------------|-----------------|--------------|
| **1-3B** | 3 GB | A10 (24 GB) | NC4as T4 v3 | ~$0.53 |
| **7B** | 7 GB | A10 (24 GB) | NC A10 v4 | ~$0.91 |
| **13B** | 13 GB | A10 (24 GB) | NC A10 v4 | ~$0.91 |
| **34B** | 34 GB | A100 40GB | ND A100 v4 | ~$3.67 |
| **70B** | 70 GB | A100 80GB | ND A100 v4 | ~$3.67 |
| **70B (fast)** | 70 GB | H100 80GB | ND H100 v5 | ~$10.32 |
| **405B** | 200+ GB | Multi-GPU H100 | ND H100 v5 ×4 | ~$41.28 |

## Container Patterns for AI

### AKS with GPU Node Pools

```yaml
# GPU node pool configuration
apiVersion: v1
kind: Pod
metadata:
  name: llm-inference
spec:
  containers:
  - name: vllm
    image: vllm/vllm-openai:latest
    resources:
      limits:
        nvidia.com/gpu: 1   # Request 1 GPU
    env:
    - name: MODEL
      value: "meta-llama/Llama-3.1-8B-Instruct"
  nodeSelector:
    kubernetes.io/os: linux
    gpu-type: a100
```

### Container Apps (Serverless GPU — Preview)

Azure Container Apps now supports GPU workloads without managing node pools — ideal for inference endpoints with variable traffic.

| Pattern | AKS + GPU | Container Apps GPU | Azure OpenAI |
|---------|-----------|-------------------|--------------|
| **Control** | Full Kubernetes | Managed serverless | Fully managed |
| **Scaling** | Manual/KEDA | Automatic | Automatic |
| **Model choice** | Any model | Any model | OpenAI catalog |
| **Cost model** | VM hours | Per-second GPU | Per-token |
| **Complexity** | High | Medium | Low |

## Key Takeaways

1. AI workloads are **VRAM-bound** — plan infrastructure around GPU memory, not CPU
2. Use the VRAM formula: `Params (B) × Bytes/Param` + 20% overhead
3. **Train in BF16, serve in INT8** — the sweet spot for quality vs cost
4. PTU beats PAYG above ~$5K/month for consistent workloads
5. Start with Azure OpenAI (managed), graduate to AKS + GPU only when you need custom models or full control
6. Always benchmark quantized models against your evaluation suite before deploying
