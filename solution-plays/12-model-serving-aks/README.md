# Play 12 — Model Serving AKS ⚙️

> Deploy and serve LLMs on AKS with GPU nodes, vLLM, and auto-scaling.

Host your own models on Kubernetes. AKS with NVIDIA GPU node pools runs vLLM for high-throughput inference. Auto-scaling based on GPU utilization, health checks, and rolling deployments. Supports quantized models (GPTQ, AWQ) for cost efficiency.

## Quick Start
```bash
cd solution-plays/12-model-serving-aks

# Provision AKS with GPU node pool
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
az aks get-credentials --resource-group $RG --name $CLUSTER

code .  # Use @builder for K8s/GPU, @reviewer for security audit, @tuner for cost
```

## Architecture
| Service | Purpose |
|---------|---------|
| AKS (GPU nodes) | Kubernetes cluster with NVIDIA A100/V100 |
| vLLM / TGI | High-throughput LLM inference serving |
| Azure Container Registry | Model container image storage |
| HPA + Cluster Autoscaler | Auto-scaling on GPU utilization |

## Key Performance Targets
- Throughput: ≥500 tokens/sec per GPU · TTFT: <500ms · GPU utilization: 70-90%

## GPU Options
| VM | GPU | VRAM | Best For | Cost/hr |
|----|-----|------|----------|---------|
| NC6s_v3 | 1× V100 | 16GB | Models <7B | ~$3.06 |
| NC24ads_A100_v4 | 1× A100 | 80GB | Models 7B-70B | ~$3.67 |
| ND96asr_v4 | 8× A100 | 640GB | Models 70B+ | ~$27.20 |

## DevKit (GPU/Kubernetes-Focused)
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (AKS/GPU/vLLM), Reviewer (limits/security/health), Tuner (GPU util/spot/cost) |
| 3 skills | Deploy (142 lines), Evaluate (101 lines), Tune (112 lines) |
| 4 prompts | `/deploy` (GPU cluster), `/test` (inference endpoints), `/review` (security), `/evaluate` (throughput) |

**Note:** This is a GPU infrastructure + ML serving play. TuneKit covers quantization selection, vLLM config, K8s scaling rules, spot node pools, and cost per inference token — not AI quality metrics.

## Cost
| Dev | Prod |
|-----|------|
| $300–600/mo | $3K–20K+/mo |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/12-model-serving-aks](https://frootai.dev/solution-plays/12-model-serving-aks)
