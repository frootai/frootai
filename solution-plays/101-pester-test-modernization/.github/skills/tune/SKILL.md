---
name: "tune"
description: "Tune Pester Test Modernization (Play 101) configuration for production readiness"
---

# Tune — Pester Test Modernization

## Overview
This skill tunes the Pester Test Modernization solution play configuration for optimal production performance, cost efficiency, and quality.

## Prerequisites
- Evaluation results available (`evaluation/results.json`)
- Access to config files in `config/` directory
- Understanding of production traffic patterns and SLAs

## Step 1: Review Current Configuration
```bash
echo "=== OpenAI Config ==="
cat config/openai.json | jq .
echo "=== Guardrails ==="
cat config/guardrails.json | jq .
echo "=== Model Comparison ==="
cat config/model-comparison.json | jq .
```

## Step 2: Model Selection Tuning
Review model-comparison.json and select optimal model for each task:
| Task | Recommended Model | Temperature | Max Tokens |
|------|------------------|-------------|------------|
| Classification/Routing | gpt-4o-mini | 0.0 | 100 |
| Generation/Synthesis | gpt-4o | 0.1-0.3 | 4096 |
| Embedding | text-embedding-3-large | N/A | N/A |
| Safety Check | content-safety-api | N/A | N/A |

## Step 3: Performance Tuning
```bash
# Tune based on evaluation results
python -c "
import json
results = json.load(open('evaluation/results.json'))
config = json.load(open('config/openai.json'))

# If latency is high, reduce max_tokens
if results.get('latency_p95_ms', 0) > 3000:
    config['max_tokens'] = min(config.get('max_tokens', 4096), 2048)
    print('Reduced max_tokens for latency')

# If groundedness is low, reduce temperature
if results.get('groundedness', 1.0) < 0.85:
    config['temperature'] = max(config.get('temperature', 0.1) - 0.05, 0.0)
    print('Reduced temperature for groundedness')

json.dump(config, open('config/openai.json', 'w'), indent=2)
print('Config tuned successfully')
"
```

## Step 4: Cost Optimization
- Verify model routing: cheap model for simple tasks, capable for complex
- Check caching: enable Redis cache for repeated queries (TTL 1-24 hours)
- Review SKUs: ensure production uses Standard tier, dev uses consumption
- Set token budgets: max daily/monthly token limits per deployment

## Step 5: Infrastructure SKU Tuning
```bash
# Verify production SKUs in Bicep
grep -n "sku" infra/main.bicep
# Ensure no Free/Basic tiers in production config
# Recommended: Standard or Premium for all production resources
```

## Step 6: Re-evaluate After Tuning
```bash
python evaluation/eval.py --config config/guardrails.json --output evaluation/tuned-results.json
python evaluation/eval.py --compare evaluation/results.json evaluation/tuned-results.json
```

## Step 7: Production Readiness Sign-off
- [ ] All evaluation metrics pass thresholds
- [ ] Model routing configured (cheap + capable)
- [ ] Caching enabled for repeated queries
- [ ] Production SKUs in Bicep (no Free/Basic)
- [ ] Token budgets and rate limits configured
- [ ] Auto-scale rules defined with max caps
- [ ] Monitoring alerts active
- [ ] Cost estimate within budget
