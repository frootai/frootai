---
name: "tune-ai-knowledge-management"
description: "Tune AI Knowledge Management — capture sources, dedup threshold, taxonomy depth, freshness TTL, expertise weights, retrieval boost, cost per knowledge item."
---

# Tune AI Knowledge Management

## Prerequisites

- Deployed KM system with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Knowledge Capture

```json
// config/agents.json
{
  "sources": {
    "teams": { "enabled": true, "channels": ["engineering", "product"], "capture_frequency": "hourly" },
    "sharepoint": { "enabled": true, "libraries": ["policies", "procedures"], "capture_frequency": "daily" },
    "servicenow": { "enabled": true, "categories": ["resolved"], "capture_frequency": "hourly" },
    "jira": { "enabled": true, "statuses": ["done", "closed"], "capture_frequency": "daily" },
    "meetings": { "enabled": true, "transcription": true, "min_duration_minutes": 15 }
  },
  "extraction": {
    "min_content_length": 50,
    "max_items_per_source": 10,
    "require_actionable": true,
    "exclude_small_talk": true
  }
}
```

Capture tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `capture_frequency` | hourly/daily | More frequent = fresher, more API calls |
| `min_content_length` | 50 chars | Lower = more items but more noise |
| `max_items_per_source` | 10 | Higher = more captured but more dedup work |
| `require_actionable` | true | false captures observational knowledge too |
| `min_duration_minutes` | 15 | Skip very short meetings |

## Step 2: Tune Deduplication

```json
// config/guardrails.json
{
  "deduplication": {
    "similarity_threshold": 0.95,
    "embedding_model": "text-embedding-3-small",
    "merge_strategy": "keep_latest",
    "cross_source_dedup": true
  },
  "freshness": {
    "default_ttl_days": 180,
    "per_category_ttl": {
      "Processes": 365,
      "Architecture": 365,
      "Competitive": 90,
      "Market": 90
    },
    "review_reminder_days_before_expiry": 14,
    "auto_archive_expired": true
  }
}
```

Dedup tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `similarity_threshold` | 0.95 | Lower = more aggressive dedup (risk removing unique) |
| `merge_strategy` | keep_latest | "keep_most_complete" for longer items |
| `cross_source_dedup` | true | Catches same knowledge from Teams + Jira |
| `default_ttl_days` | 180 | Longer for stable processes, shorter for market intel |

## Step 3: Tune Taxonomy

```json
// config/agents.json
{
  "taxonomy": {
    "max_depth": 3,
    "auto_create_subcategories": true,
    "min_items_for_subcategory": 5,
    "classification_model": "gpt-4o-mini",
    "custom_categories": []
  },
  "expertise": {
    "min_contributions_for_expert": 10,
    "decay_rate": 0.01,
    "recency_weight": 0.3,
    "frequency_weight": 0.5,
    "quality_weight": 0.2
  }
}
```

Expertise tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `min_contributions_for_expert` | 10 | Lower = more experts identified |
| `decay_rate` | 0.01 | Higher = old contributions count less |
| `recency_weight` | 0.3 | Higher = recent contributors ranked higher |
| `quality_weight` | 0.2 | Higher = good answers ranked higher |

## Step 4: Tune Model Config

```json
// config/openai.json
{
  "extraction": {
    "model": "gpt-4o",
    "temperature": 0.1,
    "max_tokens": 1000
  },
  "classification": {
    "model": "gpt-4o-mini",
    "temperature": 0
  },
  "search_enhancement": {
    "model": "gpt-4o-mini",
    "query_expansion": true
  }
}
```

| Task | Model | Why |
|------|-------|-----|
| Knowledge extraction | gpt-4o | Needs deep understanding |
| Taxonomy classification | gpt-4o-mini | Pattern matching, save cost |
| Entity extraction | gpt-4o-mini | Structured extraction |
| Search query expansion | gpt-4o-mini | Quick keyword addition |

## Step 5: Cost Optimization

```python
# Knowledge Management cost per 1000 captured items:
# - Extraction (gpt-4o): ~$0.05/item = $50
# - Classification (gpt-4o-mini): ~$0.002/item = $2
# - Embedding (text-embedding-3-small): ~$0.02/1K items = $0.02
# - AI Search index: ~$75/month (Standard)
# - Cosmos DB: ~$25/month
# - Container Apps: ~$30/month
# - Total: ~$130/month + ~$52/1000 items

# Cost reduction:
# 1. gpt-4o-mini for extraction of simple sources (save 90%)
# 2. Batch extraction (50 items per call) = fewer API calls
# 3. AI Search Basic tier for <100K items (save ~$50/month)
# 4. Skip extraction for very short content (<50 chars)
```

| Strategy | Savings | Trade-off |
|----------|---------|----------|
| gpt-4o-mini for simple sources | ~90% extraction | Lower quality for complex sources |
| Batch extraction | ~60% API overhead | Slight delay |
| AI Search Basic | ~65% search cost | Max 1M docs, 15 indexes |
| Skip short content | ~30% extraction | Miss brief but valuable knowledge |

## Step 6: Verify Tuning Impact

```bash
python evaluation/eval_capture.py --test-data evaluation/data/sources/
python evaluation/eval_dedup.py --test-data evaluation/data/duplicates/
python evaluation/eval_expertise.py
python evaluation/eval_freshness.py
python evaluation/eval_retrieval.py --test-data evaluation/data/queries/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Capture rate | baseline | +10-15% | > 80% |
| Duplicate detection | baseline | +3-5% | > 95% |
| Expert relevance | baseline | +10% | > 80% |
| NDCG@5 | baseline | +0.05-0.10 | > 0.70 |
| Monthly cost | ~$130 | ~$80-100 | < $150 |
