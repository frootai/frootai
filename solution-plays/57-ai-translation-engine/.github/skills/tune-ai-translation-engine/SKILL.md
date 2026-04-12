---
name: "tune-ai-translation-engine"
description: "Tune AI Translation Engine — LLM refinement ratio, quality thresholds, glossary coverage, content type routing, batch config, cost per 1K words."
---

# Tune AI Translation Engine

## Prerequisites

- Deployed translation engine with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune LLM Refinement

```json
// config/openai.json
{
  "post_editing": {
    "model": "gpt-4o",
    "temperature": 0.3,
    "max_tokens": 2000,
    "content_types_requiring_llm": ["marketing", "legal", "medical"],
    "quality_threshold_for_llm": 3.5,
    "system_prompts": {
      "marketing": "Maintain brand voice, emotional impact. Adapt idioms, don't translate literally.",
      "legal": "Preserve legal precision, jurisdiction terminology, formal register.",
      "medical": "Standard medical terminology, clinical accuracy."
    }
  },
  "quality_scoring": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "dimensions": ["fluency", "accuracy", "terminology", "overall"]
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `temperature` | 0.3 | Higher = more creative adaptation |
| `content_types_requiring_llm` | 3 types | More types = higher quality, higher cost |
| `quality_threshold_for_llm` | 3.5 | Lower = more segments get LLM refinement |
| Content-specific prompts | Per type | Tailored instructions per domain |

### When to Apply LLM Refinement
| Content Type | LLM Required? | Why |
|-------------|---------------|-----|
| Marketing | YES | Brand voice, idioms, cultural adaptation |
| Legal | YES | Precision, jurisdiction terms |
| Medical | YES | Clinical accuracy, standard terminology |
| Technical docs | OPTIONAL | Usually correct from NMT |
| UI strings | NO | Short, NMT handles well |
| General | NO | NMT quality sufficient |

## Step 2: Tune Glossary

```json
// config/agents.json
{
  "glossary": {
    "url": "${GLOSSARY_URL}",
    "format": "tsv",
    "enforce_product_names": true,
    "product_names": ["Azure", "OpenAI", "Microsoft", "Teams", "Copilot", "FrootAI"],
    "update_frequency": "monthly",
    "auto_detect_missing_terms": true
  },
  "target_languages": ["de", "fr", "ja", "es", "pt-br", "zh-hans", "ko"],
  "locale_handling": {
    "default_variant": {
      "en": "en-US",
      "pt": "pt-BR",
      "zh": "zh-Hans"
    }
  }
}
```

Glossary tuning:
| Symptom | Adjustment |
|---------|------------|
| Product names translated | Add to product_names list |
| Wrong domain terms | Add to glossary.tsv |
| Inconsistent terms | Enable glossary enforcement |
| Missing terms detected | Review auto_detect results, add to glossary |

## Step 3: Tune Quality Thresholds

```json
// config/guardrails.json
{
  "quality": {
    "min_bleu_general": 40,
    "min_bleu_creative": 35,
    "min_comet": 0.80,
    "min_llm_overall": 3.5,
    "human_review_threshold": 3.0,
    "auto_approve_threshold": 4.0,
    "flag_for_review": true
  },
  "batch": {
    "max_batch_size": 1000,
    "checkpoint_interval": 100,
    "retry_on_failure": true,
    "max_retries": 3,
    "concurrent_documents": 5
  }
}
```

Quality workflow:
| Score | Action |
|-------|--------|
| > 4.0 | Auto-approve |
| 3.5-4.0 | Flag for optional review |
| 3.0-3.5 | Mandatory human review |
| < 3.0 | Reject + re-translate with LLM |

## Step 4: Cost Optimization

```python
# Translation engine cost breakdown per 1K words:
# - Azure Translator: ~$10/M chars = ~$0.05/1K words
# - LLM refinement (gpt-4o, 20% of content): ~$0.10/1K words
# - Quality scoring (gpt-4o-mini): ~$0.005/1K words
# - Total with LLM: ~$0.155/1K words
# - Total without LLM: ~$0.055/1K words

# Cost reduction:
# 1. Only LLM-refine marketing/legal/medical (save 60%)
# 2. Use gpt-4o-mini for quality scoring (already done)
# 3. Skip quality scoring for glossary-only segments
# 4. Batch translations for bulk discounts
# 5. Cache repeated segments (TM - translation memory)
```

| Strategy | Savings | Trade-off |
|----------|---------|----------|
| LLM only for 3 content types | ~60% LLM cost | General content not refined |
| Translation memory (cache) | ~20-40% | Stale translations possible |
| gpt-4o-mini for scoring | ~90% scoring cost | Slightly less nuanced |
| Skip scoring for simple | ~30% scoring | Less visibility |
| Batch (1000+ segments) | ~10% bulk | Slower per segment |

## Step 5: Verify Tuning Impact

```bash
python evaluation/eval_quality.py --test-data evaluation/data/
python evaluation/eval_glossary.py --test-data evaluation/data/
python evaluation/eval_markup.py --test-data evaluation/data/
python evaluation/eval_throughput.py

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| BLEU (general) | baseline | +3-5 | > 40 |
| COMET | baseline | +0.03-0.05 | > 0.80 |
| Glossary compliance | baseline | +5-10% | > 95% |
| Cost per 1K words | ~$0.155 | ~$0.08 | < $0.20 |
| Throughput | baseline | +30% | > 5000 wpm |
