---
name: deploy-edge-ai-deployment
description: "Deploy Edge AI — package models into containers, configure IoT Edge modules, set up fleet deployment with canary rollouts, layered deployments, offline-capable. Use when: deploy, provision edge fleet."
---

# Deploy Edge AI Deployment

## When to Use
- Package any AI model into an IoT Edge-compatible container
- Deploy AI modules to a fleet of edge devices via IoT Hub
- Configure canary rollouts (test on 5% before full fleet)
- Set up layered deployments (base + model + config layers)
- Enable offline operation with local model fallback

## How Play 34 Differs from Play 19 (Edge AI Phi-4)
| Aspect | Play 19 (Phi-4 Edge) | Play 34 (Edge Deployment) |
|--------|---------------------|--------------------------|
| Focus | One specific model (Phi-4) | Any model deployment to edge |
| Optimization | ONNX quantization | Container packaging + fleet ops |
| Scope | Single device | Fleet of devices (100s-1000s) |
| Updates | IoT Hub push | Staged rollouts with canary |
| Runtime | ONNX Runtime only | Docker containers (any runtime) |

## Prerequisites
1. Azure IoT Hub with device fleet registered
2. Azure Container Registry (ACR) for edge module images
3. IoT Edge runtime installed on target devices
4. AI model packaged (ONNX, TensorFlow, PyTorch, or custom)

## Step 1: Package Model as Container
```dockerfile
FROM mcr.microsoft.com/azureml/onnxruntime:latest
COPY model/ /app/model/
COPY src/ /app/src/
EXPOSE 8080
CMD ["python", "src/serve.py", "--model", "/app/model/model.onnx"]
```
```bash
docker build -t $ACR.azurecr.io/edge-ai-module:v1.0 .
docker push $ACR.azurecr.io/edge-ai-module:v1.0
```

## Step 2: Configure IoT Edge Deployment Manifest
```json
{
  "modulesContent": {
    "$edgeAgent": {
      "properties.desired": {
        "modules": {
          "ai-inference": {
            "type": "docker",
            "settings": { "image": "$ACR/edge-ai-module:v1.0" },
            "env": { "MODEL_PATH": { "value": "/app/model" } }
          }
        }
      }
    }
  }
}
```

## Step 3: Configure Fleet Deployment Strategy
| Strategy | Devices | Use Case |
|----------|---------|----------|
| Single device | 1 | Development testing |
| Canary (5%) | 5% of fleet | Validate on subset before full rollout |
| Staged (25% → 50% → 100%) | Gradual | Production rollout with monitoring |
| Blue-green | Full fleet, two versions | Instant rollback capability |

```bash
# Canary deployment (5% of fleet)
az iot edge deployment create --deployment-id canary-v2 \
  --hub-name $IOT_HUB --content deployment.json \
  --target-condition "tags.ring='canary'" --priority 10
```

## Step 4: Configure Layered Deployments
```
Base layer:    IoT Edge runtime + monitoring agent (all devices)
Model layer:   AI model container (per device type)
Config layer:  Device-specific config (per location/region)
```

## Step 5: Configure Offline Operation
- Model runs locally with no cloud dependency
- Telemetry queued when offline, synced on reconnect
- Model updates cached, applied on next connection
- Health monitoring continues offline (local watchdog)

## Step 6: Post-Deployment Verification
- [ ] Model container running on target devices
- [ ] Inference endpoint responding on device
- [ ] Canary deployment healthy (no errors on subset)
- [ ] Fleet deployment progressing through stages
- [ ] Offline mode working (disconnect → verify inference)
- [ ] Rollback tested (revert to previous version)
- [ ] Telemetry flowing to IoT Hub
- [ ] Device health monitoring active

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Module won't start | Image pull failure | Check ACR credentials on device |
| OOM on device | Model too large | Quantize model or use smaller device |
| Deployment stuck | Target condition wrong | Verify device tags match condition |
| Canary fails | Model incompatible with device | Check CPU arch (ARM vs x64) |
| Offline mode broken | Cloud dependency in code | Mock cloud calls with local fallback |
| Rollback doesn't work | No previous version stored | Always keep N-1 version in ACR |
