---
name: "deploy-foundry-local-on-device"
description: "Deploy Foundry Local On-Device AI — local model inference with Foundry Local SDK, hardware-aware model selection, hybrid cloud/local routing, offline caching."
---

# Deploy Foundry Local On-Device AI

## Prerequisites

- Windows 10/11 or Linux device with:
  - 8GB+ RAM (16GB+ recommended)
  - 10GB+ free disk for model cache
  - Optional: NVIDIA GPU with CUDA support
- Azure CLI authenticated (`az login`) for cloud fallback
- Python 3.11+ with `foundry-local` SDK
- Azure OpenAI deployment for cloud fallback
- `.env` file with: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `FOUNDRY_LOCAL_CACHE_PATH`

## Step 1: Install Foundry Local SDK

```bash
# Install Foundry Local SDK
pip install foundry-local

# Verify installation
python -c "from foundry_local import FoundryLocalClient; print('SDK installed')"

# Check device capabilities
python -c "
from foundry_local import FoundryLocalClient
client = FoundryLocalClient()
caps = client.get_device_capabilities()
print(f'RAM: {caps.ram_gb}GB')
print(f'GPU: {caps.gpu_name or \"None\"}')
print(f'VRAM: {caps.vram_gb or 0}GB')
print(f'Disk Free: {caps.disk_free_gb}GB')
print(f'Compatible Models: {len(client.list_models())}')
"
```

## Step 2: Select and Download Models

```python
# model_setup.py — hardware-aware model selection
from foundry_local import FoundryLocalClient

client = FoundryLocalClient()
caps = client.get_device_capabilities()

# Auto-select best model for this device
if caps.vram_gb and caps.vram_gb >= 8:
    # High-end: full precision model
    model_id = "Phi-4"
    quantization = "FP16"
elif caps.vram_gb and caps.vram_gb >= 4:
    # Mid-range: quantized GPU model
    model_id = "Phi-4-mini"
    quantization = "INT8"
elif caps.ram_gb >= 8:
    # CPU-only: small quantized model
    model_id = "Phi-3-mini"
    quantization = "INT4"
else:
    raise RuntimeError(f"Device has {caps.ram_gb}GB RAM — minimum 8GB required")

# Download model (cached locally, ~2-8GB depending on model)
print(f"Downloading {model_id} ({quantization})...")
client.download_model(model_id, quantization=quantization)
print(f"Model cached at: {client.cache_path}")
```

Hardware-to-model mapping:
| Device Class | RAM | GPU VRAM | Model | Quantization | Size | Speed |
|-------------|-----|----------|-------|-------------|------|-------|
| High-end PC | 32GB+ | 12GB+ | Phi-4 | FP16 | ~8GB | ~30 tok/s |
| Mid-range PC | 16GB | 6-8GB | Phi-4-mini | INT8 | ~4GB | ~25 tok/s |
| Low-end PC | 8GB | 0-4GB | Phi-3-mini | INT4 | ~2GB | ~15 tok/s |
| Edge/IoT | 4GB | None | Phi-3-mini | INT4 (CPU) | ~2GB | ~5 tok/s |

## Step 3: Implement Hybrid Cloud/Local Router

```python
# hybrid_router.py — local-first with cloud fallback
from foundry_local import FoundryLocalClient
from openai import AzureOpenAI
import os

class HybridInferenceRouter:
    def __init__(self, config):
        # Local client (Foundry Local SDK)
        self.local_client = FoundryLocalClient(
            cache_path=config.get("cache_path", "~/.foundry-local/models")
        )
        self.local_model = config["local_model"]

        # Cloud client (Azure OpenAI — fallback)
        self.cloud_client = AzureOpenAI(
            azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
            api_key=os.environ["AZURE_OPENAI_KEY"],
            api_version="2024-08-06",
        )
        self.cloud_model = config.get("cloud_model", "gpt-4o")

        # Routing config
        self.complexity_threshold = config.get("complexity_threshold", 0.6)
        self.max_local_tokens = config.get("max_local_tokens", 2048)
        self.fallback_on_error = config.get("fallback_on_error", True)

    async def generate(self, messages, **kwargs):
        complexity = self.classify_complexity(messages[-1]["content"])

        if complexity < self.complexity_threshold and self.local_available():
            try:
                return await self.local_inference(messages, **kwargs)
            except Exception as e:
                if self.fallback_on_error:
                    return await self.cloud_inference(messages, **kwargs)
                raise
        else:
            return await self.cloud_inference(messages, **kwargs)

    def classify_complexity(self, query: str) -> float:
        """Classify query complexity (0=simple, 1=complex)."""
        indicators = ["analyze", "compare", "synthesize", "evaluate", "design"]
        word_count = len(query.split())
        has_complex = any(w in query.lower() for w in indicators)
        return min(1.0, (word_count / 100) + (0.3 if has_complex else 0))

    def local_available(self) -> bool:
        """Check if local model is ready."""
        try:
            return self.local_client.is_model_loaded(self.local_model)
        except:
            return False
```

## Step 4: Provision Cloud Fallback

```bash
# Deploy Azure OpenAI for cloud fallback (only used when local can't handle)
az group create --name rg-frootai-foundry-local --location eastus2

az deployment group create \
  --resource-group rg-frootai-foundry-local \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json

az cognitiveservices account deployment create \
  --name openai-foundry-fallback \
  --resource-group rg-frootai-foundry-local \
  --deployment-name gpt-4o-fallback \
  --model-name gpt-4o \
  --model-version "2024-08-06" \
  --model-format OpenAI \
  --sku-capacity 10 --sku-name Standard

az keyvault secret set --vault-name kv-foundry-local \
  --name openai-key --value "$AZURE_OPENAI_KEY"
```

## Step 5: Configure Telemetry

```python
# telemetry.py — track local vs cloud usage
import json, time
from datetime import datetime

class InferenceTelemetry:
    def __init__(self, log_path="telemetry.jsonl"):
        self.log_path = log_path

    def log(self, source, model, latency_ms, tokens, cost_estimate):
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "source": source,  # "local" or "cloud"
            "model": model,
            "latency_ms": latency_ms,
            "tokens": tokens,
            "cost_estimate": cost_estimate,  # $0 for local
        }
        with open(self.log_path, "a") as f:
            f.write(json.dumps(entry) + "\n")
```

## Step 6: Verify Deployment

```bash
# Test local inference
python -c "
from foundry_local import FoundryLocalClient
client = FoundryLocalClient()
response = client.chat.completions.create(
    model='Phi-4-mini',
    messages=[{'role': 'user', 'content': 'What is 2+2?'}],
    temperature=0,
)
print(f'Local response: {response.choices[0].message.content}')
"

# Test cloud fallback
python -c "
from hybrid_router import HybridInferenceRouter
import asyncio, json
config = json.load(open('config/openai.json'))
router = HybridInferenceRouter(config)
result = asyncio.run(router.generate([{'role': 'user', 'content': 'Analyze the economic impact of AI on healthcare globally'}]))
print(f'Cloud fallback response: {result.choices[0].message.content[:100]}...')
"

# Test offline mode (disconnect network, try local)
# Disable network adapter, then:
python -c "
from foundry_local import FoundryLocalClient
client = FoundryLocalClient()
response = client.chat.completions.create(
    model='Phi-4-mini',
    messages=[{'role': 'user', 'content': 'Summarize: The quick brown fox jumps over the lazy dog.'}],
)
print(f'Offline response: {response.choices[0].message.content}')
"
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| SDK installed | `pip show foundry-local` | Version shown |
| Device capabilities | `get_device_capabilities()` | RAM/GPU detected |
| Model downloaded | Check cache directory | Model files present |
| Local inference | Simple prompt | Response in <2s |
| Cloud fallback | Complex prompt | GPT-4o response |
| Offline mode | Disconnect network, local query | Response without network |
| Telemetry | Check telemetry.jsonl | Entries logged |
| Model cache | Check disk usage | Model cached correctly |
| Hybrid routing | Mixed complexity queries | Correct source per query |

## Rollback Procedure

```bash
# Clear model cache (re-download fresh models)
rm -rf ~/.foundry-local/models/*

# Reset to cloud-only mode
# Set complexity_threshold to 0 in config/openai.json
python -c "import json; c=json.load(open('config/openai.json')); c['complexity_threshold']=0; json.dump(c, open('config/openai.json','w'), indent=2); print('Cloud-only mode enabled')"
```
