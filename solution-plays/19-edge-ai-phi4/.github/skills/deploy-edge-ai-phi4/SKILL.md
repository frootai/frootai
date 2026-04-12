---
name: deploy-edge-ai-phi4
description: "Deploy Edge AI Phi-4 — convert Phi-4 to ONNX, quantize for edge devices, configure ONNX Runtime, set up IoT Hub cloud sync, build offline-capable inference. Use when: deploy, provision, configure edge AI."
---

# Deploy Edge AI Phi-4

## When to Use
- Deploy Phi-4 SLM to edge/on-device inference
- Convert model to ONNX format for cross-platform portability
- Quantize model (INT4/INT8) to fit device memory constraints
- Configure ONNX Runtime for optimal on-device performance
- Set up IoT Hub for model updates and telemetry sync

## Prerequisites
1. Python 3.10+ with onnxruntime, optimum, transformers
2. HuggingFace access to Phi-4 model weights
3. Target device specs (CPU, RAM, storage) documented
4. Azure IoT Hub for cloud-edge sync (optional)
5. ONNX Runtime installed on target device

## Step 1: Download and Convert to ONNX
```bash
# Download Phi-4 from HuggingFace
python scripts/download_model.py --model microsoft/phi-4 --output models/phi4-fp16

# Convert to ONNX
python -m optimum.exporters.onnx --model microsoft/phi-4 --task text-generation models/phi4-onnx/
```

## Step 2: Quantize for Edge
| Quantization | Model Size | RAM Required | Quality Loss | Speed |
|-------------|-----------|-------------|-------------|-------|
| FP16 (original) | ~7.5 GB | ~8 GB | 0% | 1x |
| INT8 | ~3.8 GB | ~4 GB | 1-2% | 1.5x |
| INT4 (GPTQ) | ~2.0 GB | ~2.5 GB | 2-4% | 2x |
| INT4 (AWQ) | ~2.0 GB | ~2.5 GB | 1-3% | 2.2x |

```bash
# Quantize to INT4 with ONNX Runtime
python scripts/quantize.py --model models/phi4-onnx/ \
  --output models/phi4-int4/ --bits 4 --method awq
```

**Device compatibility matrix**:
| Device | RAM | Storage | Recommended Quant |
|--------|-----|---------|------------------|
| Raspberry Pi 5 (8GB) | 8 GB | 32 GB | INT4 (AWQ) |
| NVIDIA Jetson Nano | 4 GB | 16 GB | INT4 only |
| Laptop (16GB RAM) | 16 GB | 256 GB | INT8 or FP16 |
| Azure IoT Edge (VM) | 8+ GB | 64 GB | INT8 |
| Windows PC (32GB) | 32 GB | 512 GB | FP16 (full) |

## Step 3: Configure ONNX Runtime
```python
import onnxruntime as ort

session_options = ort.SessionOptions()
session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
session_options.intra_op_num_threads = 4  # Match device CPU cores
session_options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL

# For GPU-enabled edge devices (Jetson, etc.)
providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
session = ort.InferenceSession("models/phi4-int4/model.onnx", session_options, providers=providers)
```

## Step 4: Configure IoT Hub Cloud Sync
```bash
# Register edge device
az iot hub device-identity create --hub-name $IOT_HUB --device-id edge-phi4-001

# Deploy model update via IoT Hub
az iot edge deployment create --hub-name $IOT_HUB \
  --deployment-id phi4-v2 --content deployment.json --target-condition "tags.model='phi4'"
```
- Model updates pushed from cloud to edge via IoT Hub
- Telemetry (inference count, latency, errors) synced back to cloud
- Offline queue: buffer telemetry when disconnected, sync on reconnect

## Step 5: Build Offline-Capable Pipeline
```python
# Offline inference (no cloud dependency)
def inference_offline(prompt, model_path="models/phi4-int4/"):
    session = load_onnx_session(model_path)
    tokens = tokenizer.encode(prompt)
    output = session.run(None, {"input_ids": tokens})
    return tokenizer.decode(output[0])

# With cloud fallback
def inference_hybrid(prompt):
    try:
        return inference_offline(prompt)  # Try local first
    except Exception:
        return call_cloud_api(prompt)     # Fallback to Azure OpenAI
```

## Step 6: Post-Deployment Verification
- [ ] Model loads on target device within memory budget
- [ ] Inference completes in < 2 seconds (edge) or < 500ms (laptop)
- [ ] Offline mode works (disconnect network, verify inference)
- [ ] IoT Hub sync: telemetry arriving from device
- [ ] Model update: push new version via IoT Hub, verify device updated
- [ ] Battery impact acceptable (if applicable)

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| OOM on device | Model too large for RAM | Use more aggressive quantization (INT4) |
| Slow inference (>5s) | CPU-only, no optimization | Enable graph optimization, reduce threads if IO-bound |
| ONNX load fails | Incompatible opset version | Re-export with matching ONNX Runtime version |
| Garbled output | Over-quantized | Switch from INT4 to INT8, check quality |
| IoT sync fails | Device offline too long | Increase queue buffer, implement reconnect |
| Model update stuck | Deployment not targeting device | Check IoT Hub target condition tag |
