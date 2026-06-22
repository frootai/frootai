---
description: "Play 12 patterns — Model serving patterns — vLLM config, GPU scheduling, health probes, autoscaling, quantization selection."
applyTo: "**/*.yaml, **/*.py"
waf:
  - "reliability"
  - "security"
---

# Play 12 — Model Serving on AKS Patterns — FAI Standards

## vLLM Deployment on AKS

### GPU Node Pool with NVIDIA Device Plugin
```yaml
# AKS GPU node pool — Standard_NC24ads_A100_v4 for production serving
apiVersion: v1
kind: NodePool
metadata:
  name: gpu-serving
spec:
  vmSize: Standard_NC24ads_A100_v4
  nodeCount: 2
  maxCount: 6
  enableAutoScaling: true
  nodeLabels:
    workload: model-serving
    gpu-type: a100
  nodeTaints:
    - key: nvidia.com/gpu
      effect: NoSchedule
---
# NVIDIA device plugin — required for GPU resource discovery
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: nvidia-device-plugin
  namespace: kube-system
spec:
  selector:
    matchLabels:
      name: nvidia-device-plugin
  template:
    spec:
      tolerations:
        - key: nvidia.com/gpu
          operator: Exists
          effect: NoSchedule
      containers:
        - name: nvidia-device-plugin
          image: nvcr.io/nvidia/k8s-device-plugin:v0.15.0
          securityContext:
            allowPrivilegeEscalation: false
```

### vLLM Deployment with Model Loading
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vllm-mistral-7b
spec:
  replicas: 2
  template:
    spec:
      nodeSelector:
        gpu-type: a100
      tolerations:
        - key: nvidia.com/gpu
          effect: NoSchedule
      containers:
        - name: vllm
          image: vllm/vllm-openai:v0.5.4
          args:
            - --model=mistralai/Mistral-7B-Instruct-v0.3
            - --tensor-parallel-size=1        # 2 for 70B+ models across GPUs
            - --max-model-len=32768
            - --gpu-memory-utilization=0.90    # Reserve 10% for KV cache headroom
            - --enable-chunked-prefill
            - --max-num-batched-tokens=8192    # Continuous batching window
            - --swap-space=4                   # GiB CPU swap for KV cache overflow
            - --dtype=auto
          env:
            - name: HUGGING_FACE_HUB_TOKEN
              valueFrom:
                secretKeyRef: { name: hf-secret, key: token }
            # Azure Blob model loading alternative:
            - name: AZURE_STORAGE_ACCOUNT
              value: modelstorage
            - name: AZURE_STORAGE_CONTAINER
              value: model-artifacts
          resources:
            requests:
              nvidia.com/gpu: "1"       # Must match limits — no overcommit
              memory: "24Gi"
              cpu: "8"
            limits:
              nvidia.com/gpu: "1"
              memory: "32Gi"
              cpu: "12"
          ports:
            - containerPort: 8000
          # Health probes — vLLM native endpoints
          livenessProbe:
            httpGet: { path: /health, port: 8000 }
            initialDelaySeconds: 120    # Model loading takes 60-180s
            periodSeconds: 15
            failureThreshold: 3
          readinessProbe:
            httpGet: { path: /health, port: 8000 }
            initialDelaySeconds: 90
            periodSeconds: 10
          startupProbe:
            httpGet: { path: /health, port: 8000 }
            initialDelaySeconds: 30
            periodSeconds: 10
            failureThreshold: 30        # Up to 5min for large model load
```

## KEDA Autoscaling
```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: vllm-scaler
spec:
  scaleTargetRef:
    name: vllm-mistral-7b
  minReplicaCount: 2
  maxReplicaCount: 8
  cooldownPeriod: 300               # 5min — avoid thrashing on GPU nodes
  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://prometheus:9090
        metricName: vllm_num_requests_waiting
        query: avg(vllm:num_requests_waiting{model="mistral-7b"})
        threshold: "10"             # Scale when avg queue > 10
    - type: prometheus
      metadata:
        metricName: vllm_gpu_cache_usage
        query: avg(vllm:gpu_cache_usage_perc{model="mistral-7b"})
        threshold: "85"             # Scale when KV cache > 85%
```

## Model Loading from Azure Blob
```python
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient
import subprocess, os

def download_model(account: str, container: str, model_prefix: str, local_path: str):
    """Download model weights from Azure Blob before vLLM startup."""
    credential = DefaultAzureCredential()
    client = BlobServiceClient(f"https://{account}.blob.core.windows.net", credential)
    container_client = client.get_container_client(container)

    os.makedirs(local_path, exist_ok=True)
    for blob in container_client.list_blobs(name_starts_with=model_prefix):
        dest = os.path.join(local_path, blob.name.split("/")[-1])
        with open(dest, "wb") as f:
            f.write(container_client.download_blob(blob).readall())

    # Launch vLLM with local model path
    subprocess.run([
        "python", "-m", "vllm.entrypoints.openai.api_server",
        "--model", local_path,
        "--tensor-parallel-size", os.getenv("TP_SIZE", "1"),
    ])
```

## Canary Deployment with Model Versioning
```yaml
# Istio VirtualService — 90/10 canary split
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: inference-canary
spec:
  hosts: [inference.internal]
  http:
    - route:
        - destination:
            host: vllm-mistral-7b-v2    # New model version
            port: { number: 8000 }
          weight: 10
        - destination:
            host: vllm-mistral-7b-v1    # Stable version
            port: { number: 8000 }
          weight: 90
      retries:
        attempts: 2
        retryOn: 5xx,reset,connect-failure
```

## GPU Infrastructure (Bicep)
```bicep
resource aksCluster 'Microsoft.ContainerService/managedClusters@2024-06-01' existing = {
  name: aksName
}

resource gpuPool 'Microsoft.ContainerService/managedClusters/agentPools@2024-06-01' = {
  parent: aksCluster
  name: 'gpuserving'
  properties: {
    vmSize: 'Standard_NC24ads_A100_v4'
    count: 2
    minCount: 1
    maxCount: 6
    enableAutoScaling: true
    scaleSetPriority: environment == 'dev' ? 'Spot' : 'Regular'  // Spot for dev = 60-70% savings
    spotMaxPrice: environment == 'dev' ? json('0.8') : json('-1')
    nodeLabels: { workload: 'model-serving' }
    nodeTaints: [ 'nvidia.com/gpu=true:NoSchedule' ]
    osSKU: 'Ubuntu'
    mode: 'User'
  }
}
```

## Monitoring Queries
```python
# Prometheus metrics to track — export from vLLM automatically
CRITICAL_METRICS = {
    "vllm:gpu_cache_usage_perc":       "KV cache saturation — scale at >85%",
    "vllm:num_requests_waiting":       "Queue depth — alert at >20 sustained",
    "vllm:avg_generation_throughput":   "Tokens/sec — baseline per GPU type",
    "vllm:e2e_request_latency_seconds": "P95 latency — SLO target <2s",
    "DCGM_FI_DEV_GPU_UTIL":           "GPU utilization — target 70-85%",
    "DCGM_FI_DEV_GPU_TEMP":           "GPU temperature — alert at >85°C",
    "DCGM_FI_DEV_FB_USED":            "GPU memory used — correlate with OOM",
}
```

## Anti-Patterns

- ❌ Requesting GPU limits without matching requests — scheduler can't bin-pack
- ❌ `gpu-memory-utilization=1.0` — leaves no headroom for KV cache spikes, causes OOM
- ❌ Missing startupProbe — kubelet kills pods during 3min model load
- ❌ Autoscaling on CPU/memory instead of queue depth — GPU workloads don't correlate
- ❌ Single replica without PodDisruptionBudget — node drain kills inference
- ❌ Storing model weights in container image — 30GB+ images, 10min+ pull times
- ❌ No tensor parallelism for 70B+ models — single GPU OOM, use `--tensor-parallel-size=2`
- ❌ Spot instances for production inference — preemption causes request failures

## WAF Alignment

| Pillar | Play 12 Implementation |
|--------|----------------------|
| **Reliability** | startupProbe (5min budget), PodDisruptionBudget `minAvailable: 1`, multi-replica serving, canary with automatic rollback on P95 > 3s |
| **Security** | Managed Identity for Blob/ACR, network policies isolating GPU nodes, no HF token in pod spec (use K8s Secret + CSI driver) |
| **Cost Optimization** | Spot GPU nodes for dev/test (60-70% savings), KEDA scale-to-min during off-hours, right-size `gpu-memory-utilization` to avoid over-provisioning |
| **Operational Excellence** | Prometheus + Grafana dashboards (GPU util, queue depth, latency P95), vLLM `/metrics` endpoint, Azure Monitor Container Insights |
| **Performance Efficiency** | Continuous batching (`max-num-batched-tokens=8192`), chunked prefill, KV cache swap to CPU, tensor parallelism for models >40GB |
| **Responsible AI** | Content Safety sidecar on inference egress, prompt/response logging for audit (PII-redacted), model versioning with evaluation gates |
