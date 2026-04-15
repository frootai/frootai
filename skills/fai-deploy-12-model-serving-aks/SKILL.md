---
name: fai-deploy-12-model-serving-aks
description: |
  Deploy Play 12 Model Serving on AKS with GPU node pools, vLLM, KEDA autoscaling, and Prometheus monitoring. Covers Helm deployment, model loading, throughput validation, and rollback.
---

# Deploy Model Serving on AKS (Play 12)

Production deployment workflow for this solution play.

## When to Use

- Deploying self-hosted LLM inference on AKS
- Setting up vLLM or TGI with GPU node pools
- Promoting model serving from dev → prod cluster
- Validating throughput and latency SLOs

---

## Infrastructure Stack

| Service | Purpose | SKU |
|---------|---------|-----|
| AKS | Kubernetes cluster | Standard + GPU pool |
| GPU Node Pool | NVIDIA A100/H100 | NC-series |
| vLLM | Model inference engine | Helm chart |
| KEDA | Request-based autoscaling | Add-on |
| Prometheus + Grafana | Inference monitoring | Managed |
| ACR | Container images | Premium |

## Deployment Steps

```bash
# 1. Add GPU node pool
az aks nodepool add \
  --resource-group rg-aks-prod \
  --cluster-name aks-inference-prod \
  --name gpupool --node-count 2 \
  --node-vm-size Standard_NC24ads_A100_v4 \
  --labels workload=inference

# 2. Deploy vLLM with Helm
helm upgrade --install vllm charts/vllm \
  --namespace inference --create-namespace \
  --set model=meta-llama/Llama-3.3-70B-Instruct \
  --set gpu.count=2 --set replicas=2

# 3. Deploy KEDA scaler
kubectl apply -f infra/keda-scaler.yaml

# 4. Run throughput benchmark
python tests/smoke/test_inference_throughput.py \
  --endpoint http://vllm.inference.svc:8000 \
  --concurrent 50 --min-tps 120 --max-latency-p99 2000
```

## Rollback Procedure

```bash
# Rollback to previous Helm revision
helm rollback vllm --namespace inference

# Scale down GPU pool if needed
az aks nodepool scale \
  --resource-group rg-aks-prod \
  --cluster-name aks-inference-prod \
  --name gpupool --node-count 0
```

## Health Check

```bash
kubectl get pods -n inference -l app=vllm
curl -s http://vllm.inference.svc:8000/health | jq .
# Expected: {"status":"ready","model":"loaded","gpu_memory_utilization":0.85}
```

## Troubleshooting

### GPU out-of-memory on model load

Reduce tensor-parallel-size or use a quantized model (AWQ/GPTQ). Check gpu.count matches allocated GPUs.

### Throughput below SLO

Enable continuous batching. Increase max-num-seqs. Check if KEDA is scaling pods. Monitor GPU utilization with nvidia-smi.

### Pod stuck in Pending state

Check GPU node pool has available capacity. Verify tolerations match GPU node taints. Use kubectl describe pod for events.

## Post-Deploy Checklist

- [ ] All infrastructure resources provisioned and healthy
- [ ] Application deployed and responding on all endpoints
- [ ] Smoke tests passing with expected thresholds
- [ ] Monitoring dashboards showing baseline metrics
- [ ] Alerts configured for error rate, latency, and cost
- [ ] Rollback procedure tested and documented
- [ ] Incident ownership and escalation path confirmed
- [ ] Post-deploy review scheduled within 24 hours

## Definition of Done

Deployment is complete when infrastructure is provisioned, application is serving traffic, smoke tests pass, monitoring is active, and another engineer can reproduce the process from this skill alone.
