---
description: "Play 19 patterns — Edge AI patterns — Phi-4 optimization, ONNX Runtime, quantization, batch size tuning, device constraints."
applyTo: "**/*.py, **/*.onnx"
waf:
  - "reliability"
  - "security"
---

# Play 19 — Edge AI with Phi-4 — FAI Standards

## Phi-4 Model Variants

| Variant | Params | Context | Use Case | RAM (INT4) |
| --- | --- | --- | --- | --- |
| Phi-4-mini | 3.8B | 128K | Chat, summarization, lightweight agents | ~2.5 GB |
| Phi-4-small | 7B | 128K | Reasoning, code gen, complex instructions | ~4.5 GB |
| Phi-4-medium | 14B | 128K | Enterprise accuracy, multi-step reasoning | ~8.5 GB |

- Default to Phi-4-mini for edge — fits in 4GB RAM devices
- Use Phi-4-small only when task accuracy requires it and device has 8GB+ RAM
- Phi-4-medium is server-class or high-end workstation only

## ONNX Runtime for Edge Inference

```python
import onnxruntime_genai as og

model_path = "/opt/models/phi-4-mini-int4-onnx"
model = og.Model(model_path)
tokenizer = og.Tokenizer(model)
params = og.GeneratorParams(model)
params.set_search_options(max_length=512, top_p=0.9, temperature=0.0)

prompt = "<|system|>You are a concise assistant.<|end|><|user|>Summarize this report.<|end|><|assistant|>"
input_tokens = tokenizer.encode(prompt)
params.input_ids = input_tokens

generator = og.Generator(model, params)
output_tokens = []
while not generator.is_done():
    generator.compute_logits()
    generator.generate_next_token()
    output_tokens.append(generator.get_next_tokens()[0])
response = tokenizer.decode(output_tokens)
```

- Use `onnxruntime-genai` — NOT raw `onnxruntime` — for generative models
- ONNX EP priority: `CUDAExecutionProvider` → `DmlExecutionProvider` → `CPUExecutionProvider`
- Set `temperature=0.0` for deterministic edge outputs — reproducibility matters on-device

## Quantization for Edge

```python
# Convert HuggingFace → ONNX INT4 for edge deployment
# Run ONCE on build machine, deploy the artifact
from onnxruntime_genai.models.builder import create_model
create_model(
    model_name="microsoft/Phi-4-mini-instruct",
    output_dir="./phi-4-mini-int4-onnx",
    precision="int4",                        # INT4 = smallest footprint
    execution_provider="cpu",                # Target EP
    cache_dir="./hf-cache"
)
```

| Format | Size (mini) | Latency | Quality Loss | When |
| --- | --- | --- | --- | --- |
| FP16 | ~7.6 GB | Baseline | None | GPU with VRAM headroom |
| INT8 | ~3.8 GB | ~1.2x faster | <1% | Mid-range devices |
| INT4 | ~2.0 GB | ~1.5x faster | 1-3% | Edge default — best size/quality |
| GGUF Q4_K_M | ~2.2 GB | ~1.4x faster | 1-2% | llama.cpp deployments |

- Always benchmark quantized vs FP16 on YOUR task before deploying — quality loss is task-dependent
- INT4 with ONNX Runtime is the sweet spot for edge: 2GB model, runs on CPU-only devices

## Model Download and Caching

```python
from huggingface_hub import snapshot_download
import os

cache_dir = os.environ.get("HF_HOME", "/opt/models/cache")

def download_model(repo_id: str = "microsoft/Phi-4-mini-instruct-onnx") -> str:
    """Download model with offline fallback. Returns local path."""
    local_path = os.path.join(cache_dir, repo_id.replace("/", "--"))
    if os.path.isdir(local_path):
        return local_path  # Already cached — skip network
    return snapshot_download(
        repo_id=repo_id,
        cache_dir=cache_dir,
        local_files_only=False,
        allow_patterns=["*.onnx", "*.onnx_data", "*.json", "tokenizer.*"],
    )
```

- Set `HF_HUB_OFFLINE=1` in production to prevent accidental downloads
- Pre-load models into device image — never download on first inference request
- Pin model revision (`revision="v1.2"`) — never pull `main` in production

## Latency Optimization

```python
# KV cache reuse for multi-turn conversations
params.set_search_options(
    max_length=256,         # Cap output — edge devices can't afford runaway generation
    past_present_share_buffer=True,  # Reuse KV cache memory
)

# batch_size=1 for interactive — no batching overhead on single requests
# batch_size>1 ONLY for offline batch processing (e.g., nightly document scan)
```

- First-token latency target: <500ms on Phi-4-mini INT4 on 4-core CPU
- Streaming token-by-token with `generator.get_next_tokens()` — never wait for full completion
- Pre-warm model at startup — load into memory before accepting requests
- Limit `max_length` aggressively: 256 for chat, 512 for summarization, 1024 max for reports

## Memory Footprint Management

```python
import psutil, logging

def check_memory_budget(model_size_gb: float, safety_margin: float = 0.3) -> bool:
    """Verify device has enough free RAM before loading model."""
    available_gb = psutil.virtual_memory().available / (1024 ** 3)
    required_gb = model_size_gb * (1 + safety_margin)  # 30% headroom for KV cache + OS
    if available_gb < required_gb:
        logging.error(f"Insufficient RAM: {available_gb:.1f}GB free, need {required_gb:.1f}GB")
        return False
    return True

# Gate model loading on memory check
if not check_memory_budget(model_size_gb=2.5):
    raise SystemExit("Device cannot support Phi-4-mini INT4 — upgrade RAM or use cloud fallback")
```

- Monitor RSS during inference — KV cache grows with sequence length
- Kill long sequences if RSS exceeds 80% of physical RAM
- One model per device — never hot-swap models, use separate containers

## Offline-First Architecture

```python
import httpx, logging

class HybridInference:
    """Local model primary, cloud fallback for complex queries."""

    def __init__(self, local_model, cloud_endpoint: str | None = None):
        self.local = local_model
        self.cloud_endpoint = cloud_endpoint

    def generate(self, prompt: str, complexity_score: float) -> str:
        if complexity_score < 0.7 or self.cloud_endpoint is None:
            return self._local_inference(prompt)
        try:
            return self._cloud_inference(prompt)
        except (httpx.ConnectError, httpx.TimeoutException):
            logging.warning("Cloud unreachable — falling back to local model")
            return self._local_inference(prompt)
```

- Local model handles 100% of requests when offline — cloud is optimization, not dependency
- Route to cloud ONLY for tasks local model scores <70% confidence on
- Queue failed cloud requests for retry when connectivity resumes (SQLite job queue)

## Azure IoT Edge Deployment

- Package model + runtime as IoT Edge module (Docker container, ARM64/AMD64)
- `createOptions`: set `--memory=4g --cpus=2` to isolate model from other modules
- Use IoT Edge module twin for config: `temperature`, `max_length`, model version
- Report inference metrics via D2C messages: latency, token count, fallback rate

## Model Updates (OTA)

```python
import hashlib

def validate_model_update(model_path: str, expected_sha256: str) -> bool:
    """Verify model integrity after OTA download."""
    sha = hashlib.sha256()
    with open(model_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha.update(chunk)
    return sha.hexdigest() == expected_sha256
```

- Never hot-swap a running model — download to staging dir, validate, then atomically swap symlink
- Rollback plan: keep previous model version on disk, revert symlink on validation failure
- Version model artifacts with semver in IoT Edge module twin: `"model_version": "1.2.0"`

## Privacy-Preserving Inference

- All inference runs on-device — no prompts, inputs, or outputs leave the device
- Telemetry is aggregate only: latency histograms, token count distributions, error rates
- Never log prompt content or model output — log only metadata (length, latency, model version)
- Disable HuggingFace telemetry in production: `HF_HUB_DISABLE_TELEMETRY=1`

## Anti-Patterns

- ❌ Downloading models at first inference — pre-load into device image at build time
- ❌ Using FP16 on CPU-only edge devices — inference will be 3-5x slower than INT4
- ❌ Running Phi-4-medium on <16GB RAM devices — OOM kills crash the edge node
- ❌ Calling cloud API as primary with local fallback — invert it: local primary, cloud fallback
- ❌ Hot-swapping models while inference is running — corrupts KV cache, produces garbage
- ❌ Logging prompts or outputs for "debugging" — violates privacy-preserving architecture
- ❌ Unbounded `max_length` — on edge, runaway generation exhausts RAM and blocks device
- ❌ Pulling `main` branch model in production — always pin revision hash or semver tag

## WAF Alignment

| Pillar | Edge AI Application |
|--------|-------------------|
| **Reliability** | Offline-first inference, graceful cloud fallback, model integrity validation, rollback on failed OTA |
| **Security** | On-device inference (data never leaves), SHA-256 model validation, no secrets on device, signed OTA |
| **Cost Optimization** | INT4 quantization (50% size reduction), CPU-only inference (no GPU cost), local-first routing |
| **Operational Excellence** | IoT Edge module twin config, aggregate telemetry, automated OTA with validation |
| **Performance Efficiency** | KV cache reuse, batch=1 for interactive, streaming token output, pre-warmed model |
| **Responsible AI** | Privacy-preserving (no data egress), deterministic outputs (temp=0), model versioning for auditability |
