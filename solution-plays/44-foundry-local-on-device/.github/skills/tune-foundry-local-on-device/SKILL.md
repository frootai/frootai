---
name: "tune-foundry-local-on-device"
description: "Tune Foundry Local On-Device AI — model selection per device class, complexity routing thresholds, quantization levels, prompt optimization for local models, cost savings maximization."
---

# Tune Foundry Local On-Device AI

## Prerequisites

- Deployed Foundry Local with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`
- Evaluation baseline from `evaluate-foundry-local-on-device` skill
- Device hardware capabilities known

## Step 1: Tune Model Selection

### Device-Specific Model Configuration
```json
// config/openai.json
{
  "local": {
    "model": "Phi-4-mini",
    "quantization": "INT8",
    "cache_path": "~/.foundry-local/models",
    "temperature": 0,
    "max_tokens": 2048,
    "seed": 42,
    "warmup_on_start": true
  },
  "cloud": {
    "model": "gpt-4o",
    "endpoint": "${AZURE_OPENAI_ENDPOINT}",
    "temperature": 0.1,
    "max_tokens": 4096
  },
  "model_profiles": {
    "high_end": { "model": "Phi-4", "quantization": "FP16", "max_tokens": 4096 },
    "mid_range": { "model": "Phi-4-mini", "quantization": "INT8", "max_tokens": 2048 },
    "low_end": { "model": "Phi-3-mini", "quantization": "INT4", "max_tokens": 1024 },
    "edge": { "model": "Phi-3-mini", "quantization": "INT4", "max_tokens": 512 }
  }
}
```

Tuning levers:
| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| `model` | Phi-4-mini | Phi-3-mini→Phi-4 | Larger = better quality, more RAM |
| `quantization` | INT8 | INT4/INT8/FP16 | Lower bits = faster, less memory, lower quality |
| `max_tokens` | 2048 | 512-4096 | Higher = longer responses, more memory |
| `warmup_on_start` | true | true/false | true = faster first query, uses memory immediately |
| `seed` | 42 | null/int | Fixed = reproducible, null = varied |

### Quantization Trade-offs
| Quantization | Memory | Speed | Quality | Best For |
|-------------|--------|-------|---------|----------|
| FP16 | 100% | Baseline | Best | High-end with 12GB+ VRAM |
| INT8 | ~50% | +20% faster | -5% quality | Mid-range 6-8GB VRAM |
| INT4 | ~25% | +40% faster | -15% quality | CPU-only or limited VRAM |

## Step 2: Tune Complexity Router

### Routing Configuration
```json
// config/agents.json
{
  "routing": {
    "complexity_threshold": 0.6,
    "max_local_query_length": 500,
    "force_local_categories": ["simple_qa", "translation", "spelling"],
    "force_cloud_categories": ["code_review", "long_analysis", "creative_writing"],
    "keyword_routing": {
      "local": ["define", "translate", "spell", "calculate", "summarize briefly"],
      "cloud": ["analyze in depth", "compare and contrast", "write a story", "review this code"]
    }
  },
  "fallback": {
    "on_local_error": "cloud",
    "on_cloud_error": "local_retry",
    "max_retries": 2,
    "timeout_ms": 30000
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `complexity_threshold` | 0.6 | Lower = more to cloud (better quality), higher = more local (cheaper) |
| `max_local_query_length` | 500 chars | Longer queries → cloud (local context window smaller) |
| `force_local_categories` | 3 types | Bypass classifier for known-simple tasks |
| `force_cloud_categories` | 3 types | Bypass classifier for known-complex tasks |
| `timeout_ms` | 30000 | How long to wait for local before cloud fallback |

### Router Optimization
```python
# If routing accuracy < 85%:
#   - Add more keyword_routing examples
#   - Fine-tune complexity_threshold using evaluation data
#   - Add domain-specific rules for your use case

# If over-routing to cloud > 10%:
#   - Increase complexity_threshold from 0.6 to 0.7
#   - Add more force_local_categories
#   - Reduce max_local_query_length threshold

# If under-routing to cloud > 10%:
#   - Decrease complexity_threshold from 0.6 to 0.5
#   - Add more force_cloud_categories
#   - Lower max_local_query_length to 300
```

## Step 3: Tune Prompt Optimization for Local Models

```json
// config/prompt-optimization.json
{
  "local_prompt_adjustments": {
    "simplify_instructions": true,
    "max_system_prompt_tokens": 200,
    "remove_few_shot_examples": true,
    "prefer_direct_questions": true
  },
  "cloud_prompt_pass_through": true,
  "prompt_templates": {
    "local_system": "You are a helpful assistant. Answer concisely.",
    "cloud_system": "You are a helpful assistant. Provide detailed, well-structured answers with examples."
  }
}
```

Local model prompt rules:
| Rule | Why | Example |
|------|-----|---------|
| Short system prompts (<200 tokens) | Limited context window | "Answer concisely" → not "You are an expert in..." |
| Direct questions | Better accuracy with simple prompts | "What is X?" → not "Can you explain X in detail?" |
| No few-shot examples | Wastes context window on small models | Single-shot only |
| JSON mode explicit | Local models need explicit format | "Return JSON: {key: value}" |
| One task per prompt | Local models struggle with multi-step | Split complex into multiple simple calls |

## Step 4: Tune Offline Mode

```json
// config/guardrails.json
{
  "offline": {
    "enabled": true,
    "pre_download_models": true,
    "cache_integrity_check": "startup",
    "disk_space_warning_threshold_gb": 5,
    "max_models_cached": 3,
    "graceful_degradation": {
      "complex_query_offline_response": "This query requires cloud processing which is currently unavailable. Here is a simplified local response:",
      "max_offline_tokens": 1024
    }
  },
  "hardware": {
    "min_ram_gb": 8,
    "min_disk_free_gb": 10,
    "gpu_required": false,
    "warn_if_no_gpu": true
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `cache_integrity_check` | startup | "none" for faster start, "startup" for safety |
| `max_models_cached` | 3 | More = flexibility, more disk used |
| `max_offline_tokens` | 1024 | Lower = less resource usage in constrained mode |
| `disk_space_warning_threshold_gb` | 5 | Alert before disk runs out |

## Step 5: Cost Optimization

```python
# Foundry Local cost optimization strategies:
#
# 1. Maximize local inference rate (target >70%)
#    - Tune complexity_threshold to 0.7 (more to local)
#    - Add domain-specific force_local_categories
#    - Optimize prompts for local model accuracy
#
# 2. Right-size the model
#    - Use Phi-3-mini INT4 if accuracy >80% on your use case
#    - Only use Phi-4 FP16 if quality parity <0.75 with smaller models
#    - INT8 is the sweet spot for most devices
#
# 3. Reduce cloud fallback cost
#    - Use gpt-4o-mini instead of gpt-4o for fallback (~90% savings)
#    - Cache frequent cloud responses locally
#    - Batch cloud queries when online (process queue)
#
# 4. Hardware efficiency
#    - Warmup model on start (avoids cold start latency spike)
#    - Unload model when idle >30min (free RAM)
#    - Use swap for RAM-constrained devices (slower but works)
```

Cost comparison (1000 queries/month):
| Strategy | Cloud Cost | Local Cost | Total | Savings |
|----------|-----------|------------|-------|---------|
| Cloud-only (gpt-4o) | $10.00 | $0 | $10.00 | — |
| Cloud-only (gpt-4o-mini) | $1.00 | $0 | $1.00 | — |
| Hybrid 60/40 (gpt-4o) | $4.00 | ~$0.50 electricity | $4.50 | 55% |
| Hybrid 80/20 (gpt-4o-mini) | $0.20 | ~$0.50 | $0.70 | 30% |
| Local-only (offline) | $0 | ~$0.50 | $0.50 | 95% |

## Step 6: Verify Tuning Impact

```bash
# Re-run evaluation
python evaluation/eval_quality.py --test-data evaluation/data/
python evaluation/eval_latency.py --test-data evaluation/data/
python evaluation/eval_cost.py --telemetry-log telemetry.jsonl
python evaluation/eval_offline.py --test-data evaluation/data/offline/
python evaluation/eval_router.py --test-data evaluation/data/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Local accuracy | baseline | +5-10% | > 80% |
| Quality parity | baseline | +0.05-0.10 | > 0.75 |
| Local inference rate | baseline | +10-20% | > 60% |
| Routing accuracy | baseline | +10% | > 85% |
| Cost savings | baseline | +10-15% | > 50% |
| Offline success | baseline | +5% | > 95% |
