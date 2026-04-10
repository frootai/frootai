---
description: "Foundry Local On-Device domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Foundry Local On-Device — Domain Knowledge

This workspace implements Azure AI Foundry Local — running AI models on-device using the Foundry Local SDK, with model catalog selection, hardware-aware optimization, and hybrid cloud/local inference.

## Foundry Local Architecture (What the Model Gets Wrong)

### Foundry Local SDK Setup
```python
# WRONG — always call cloud API
response = openai_client.chat.completions.create(model="gpt-4o", ...)

# CORRECT — local inference with Foundry Local
from foundry_local import FoundryLocalClient

# Initialize (downloads model on first run, caches locally)
client = FoundryLocalClient()

# List available models for this device's hardware
models = client.list_models()  # Filtered by device capabilities (GPU, RAM, disk)

# Run inference locally (no network required)
response = client.chat.completions.create(
    model="Phi-4-mini",  # Runs on device
    messages=[{"role": "user", "content": "Explain quantum computing simply."}],
    temperature=0,
)
```

### Hardware-Aware Model Selection
| Device Class | RAM | GPU | Recommended Models | Quantization |
|-------------|-----|-----|-------------------|-------------|
| High-end PC | 32GB+ | RTX 4090 | Phi-4, Llama 3.1 8B | FP16 |
| Mid-range PC | 16GB | RTX 3060 | Phi-4-mini, Phi-3.5 | INT8 |
| Low-end PC | 8GB | Integrated | Phi-3-mini | INT4 |
| Edge/IoT | 4GB | None | Phi-3-mini (CPU) | INT4 |

### Hybrid Cloud/Local Strategy
```python
async def hybrid_inference(query: str, complexity: str) -> Response:
    if complexity == "simple" and local_model_available():
        # Local inference — free, fast, offline
        return await foundry_local.generate(query)
    else:
        # Cloud inference — for complex queries needing GPT-4o
        return await azure_openai.generate(query)
    
# Complexity classifier runs locally (fast, no API cost)
def classify_complexity(query: str) -> str:
    if len(query.split()) < 15: return "simple"
    if any(w in query.lower() for w in ["analyze", "compare", "synthesize"]): return "complex"
    return "simple"
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Cloud-only inference | Fails offline, costs money, latency | Local-first with cloud fallback |
| Wrong model for hardware | OOM crash or slow inference | Check device capabilities, select matching model |
| No model caching | Re-downloads model on every start | Foundry Local caches automatically, verify cache path |
| Same prompt for local + cloud | Local models need simpler prompts | Optimize prompts per model capability |
| No graceful degradation | Local fails → error instead of cloud fallback | Try local → catch → fallback to cloud |
| Ignoring disk space | Large models fill disk | Check available disk before download (Phi-4 ~4GB) |
| No telemetry | Can't compare local vs cloud quality | Log both, compare accuracy/latency/cost |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | Local model name, cloud fallback model, temperature |
| `config/guardrails.json` | Complexity threshold, memory limits, model cache path |
| `config/agents.json` | Hybrid routing rules, fallback behavior, telemetry settings |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Set up Foundry Local, configure models, implement hybrid routing |
| `@reviewer` | Audit hardware compatibility, fallback logic, offline capability |
| `@tuner` | Optimize model selection per device, complexity routing, cost savings |

## Slash Commands
`/deploy` — Configure local models | `/test` — Test local inference | `/review` — Audit hybrid logic | `/evaluate` — Compare local vs cloud
