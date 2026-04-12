---
name: deploy-model-serving-aks
description: "Deploy Model Serving on AKS — provision GPU node pools, deploy vLLM/TGI containers, configure HPA, health probes, ACR, and ingress. Use when: deploy, provision, configure GPU cluster."
---

# Deploy Model Serving AKS

## When to Use
- Provision AKS cluster with NVIDIA GPU node pools
- Deploy LLM serving containers (vLLM, TGI, or custom)
- Configure horizontal pod autoscaler for inference workloads
- Set up ACR for model container images
- Configure ingress and load balancing for inference endpoints

## Prerequisites
1. Azure CLI + kubectl authenticated: `az aks get-credentials`
2. GPU quota approved in target region (NC/ND series)
3. Azure Container Registry (ACR) created
4. Model weights downloaded or accessible (HuggingFace, Azure Storage)
5. NVIDIA GPU operator or AKS GPU driver extension

## Step 1: Provision AKS Cluster
```bash
az aks create \
  --resource-group $RG --name $CLUSTER \
  --node-count 2 --node-vm-size Standard_D4s_v5 \
  --enable-managed-identity --attach-acr $ACR \
  --network-plugin azure --network-policy calico \
  --enable-addons monitoring
```

## Step 2: Add GPU Node Pool
```bash
az aks nodepool add \
  --resource-group $RG --cluster-name $CLUSTER \
  --name gpupool --node-count 1 \
  --node-vm-size Standard_NC24ads_A100_v4 \
  --node-taints sku=gpu:NoSchedule \
  --labels workload=inference
```

| GPU VM | GPU | VRAM | Use Case | Cost/hr |
|--------|-----|------|----------|---------|
| NC6s_v3 | 1× V100 | 16GB | Small models (<7B) | ~$3.06 |
| NC24ads_A100_v4 | 1× A100 | 80GB | Large models (7B-70B) | ~$3.67 |
| ND96asr_v4 | 8× A100 | 640GB | Massive models (70B+) | ~$27.20 |

## Step 3: Build & Push Serving Container
```bash
# vLLM-based serving
docker build -t $ACR.azurecr.io/vllm-serving:v1 -f Dockerfile.vllm .
docker push $ACR.azurecr.io/vllm-serving:v1
```

## Step 4: Deploy Model to AKS
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-serving
spec:
  replicas: 1
  template:
    spec:
      tolerations:
        - key: "sku"
          operator: "Equal"
          value: "gpu"
          effect: "NoSchedule"
      containers:
        - name: vllm
          image: ${ACR}/vllm-serving:v1
          resources:
            limits:
              nvidia.com/gpu: "1"
            requests:
              memory: "32Gi"
              cpu: "8"
          ports:
            - containerPort: 8000
          livenessProbe:
            httpGet: { path: /health, port: 8000 }
            initialDelaySeconds: 120
          readinessProbe:
            httpGet: { path: /health, port: 8000 }
            initialDelaySeconds: 60
```
```bash
kubectl apply -f k8s/deployment.yaml
```

## Step 5: Configure HPA (Horizontal Pod Autoscaler)
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: llm-serving-hpa
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: llm-serving }
  minReplicas: 1
  maxReplicas: 4
  metrics:
    - type: Pods
      pods:
        metric: { name: gpu_utilization }
        target: { type: AverageValue, averageValue: "80" }
```

## Step 6: Configure Ingress
```bash
kubectl apply -f k8s/ingress.yaml
# Verify endpoint
curl https://$INFERENCE_ENDPOINT/v1/models
```

## Step 7: Smoke Test
```bash
curl -X POST https://$ENDPOINT/v1/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"my-model","prompt":"Hello","max_tokens":50}'
```

## Post-Deployment Verification
- [ ] GPU nodes visible: `kubectl get nodes -l workload=inference`
- [ ] Pods running with GPU allocated: `kubectl describe pod llm-serving-*`
- [ ] Health probes passing (liveness + readiness)
- [ ] HPA configured and responding to load
- [ ] Inference endpoint returning responses
- [ ] Model loading time < 5 minutes
- [ ] GPU utilization visible in monitoring

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Pod pending (no GPU) | Insufficient GPU quota | Request quota increase in Azure portal |
| OOM killed | Model too large for VRAM | Use quantization (GPTQ/AWQ) or larger GPU |
| Slow cold start | Large model download | Pre-pull image, use ACR cache |
| GPU not detected | Missing driver | Install NVIDIA GPU operator |
| Health probe fails | Model still loading | Increase initialDelaySeconds (120-300s) |
| Low throughput | No batching | Enable continuous batching in vLLM |
