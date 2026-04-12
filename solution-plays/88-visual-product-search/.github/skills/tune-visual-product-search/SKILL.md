---
name: "tune-visual-product-search"
description: "Tune Visual Product Search — embedding model selection, similarity thresholds, reranking weights, multi-modal fusion, catalog indexing, cost optimization."
---

# Tune Visual Product Search

## Prerequisites

- Deployed visual search with evaluation results available
- Access to `config/openai.json`, `config/search.json`, `config/guardrails.json`

## Step 1: Tune Visual Encoding

```json
// config/agents.json — visual encoder settings
{
  "visual_encoder": {
    "model": "clip-vit-large-patch14",
    "embedding_dimensions": 768,
    "preprocessing": {
      "resize": 224,
      "normalize": true,
      "remove_background": true,
      "center_crop": true
    },
    "fine_tuning": {
      "enabled": false,
      "dataset": "data/product_pairs/",
      "epochs": 10,
      "learning_rate": 1e-5
    },
    "batch_encoding": {
      "batch_size": 32,
      "use_gpu": true
    }
  }
}
```

Encoder tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `model` | clip-vit-large-patch14 | Larger = better accuracy, slower |
| `embedding_dimensions` | 768 | Higher = more precise, more storage |
| `remove_background` | true | Crucial for product matching quality |
| `fine_tuning.enabled` | false | true = much better domain accuracy, requires GPU training |

### Model Selection Guide
| Model | Dimensions | Speed | Accuracy | Use Case |
|-------|-----------|-------|----------|----------|
| CLIP ViT-B/32 | 512 | Fast | Good | High volume, cost-sensitive |
| CLIP ViT-L/14 (default) | 768 | Medium | Very good | Balanced |
| Florence-2 Large | 1024 | Slow | Excellent | Premium visual search |
| Domain fine-tuned CLIP | 768 | Medium | Best for domain | After 10K+ product images |

## Step 2: Tune Search & Similarity

```json
// config/search.json — search settings
{
  "search": {
    "algorithm": "hnsw",
    "hnsw_params": {
      "m": 4,
      "ef_construction": 400,
      "ef_search": 500
    },
    "similarity_metric": "cosine",
    "similarity_threshold": 0.65,
    "top_k_candidates": 20,
    "final_results": 10,
    "hybrid_search": {
      "enabled": true,
      "text_weight": 0.2,
      "vector_weight": 0.8
    },
    "filters": {
      "in_stock_boost": 1.5,
      "out_of_stock_penalty": 0.3,
      "price_range_enabled": true
    }
  }
}
```

Search tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `similarity_threshold` | 0.65 | Lower = more results (noisier), higher = fewer (miss subtle matches) |
| `top_k_candidates` | 20 | Higher = better reranking quality, slower |
| `in_stock_boost` | 1.5× | Higher = strongly prefer available products |
| `hybrid_search` | text 0.2 / vector 0.8 | More text weight = better for described products |

## Step 3: Tune Reranking

```json
// config/agents.json — reranking settings
{
  "reranking": {
    "weights": {
      "visual_similarity": 0.50,
      "in_stock": 0.15,
      "popularity": 0.15,
      "price_relevance": 0.10,
      "recency": 0.10
    },
    "personalization": {
      "enabled": false,
      "user_history_weight": 0.1,
      "browse_category_boost": 1.2
    },
    "diversity": {
      "enabled": true,
      "max_same_brand": 3,
      "max_same_price_tier": 5
    },
    "feedback_retrain_frequency": "weekly"
  }
}
```

Reranking tuning:
| Weight | Default | Increase When |
|--------|---------|--------------|
| `visual_similarity` | 0.50 | Search quality matters most (fashion, decor) |
| `in_stock` | 0.15 | High out-of-stock rate frustrates users |
| `popularity` | 0.15 | Social proof drives conversion |
| `price_relevance` | 0.10 | Price-sensitive market segment |
| `recency` | 0.10 | Fast-moving catalog (fashion seasons) |

## Step 4: Tune Multi-Modal Fusion

```json
// config/agents.json — multi-modal settings
{
  "multimodal": {
    "fusion_method": "weighted_average",
    "image_weight": 0.70,
    "text_weight": 0.30,
    "text_override_attributes": ["color", "size", "material"],
    "text_boost_attributes": ["brand", "style"],
    "no_text_fallback": "image_only",
    "text_encoding_model": "text-embedding-3-large"
  }
}
```

Fusion tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `image_weight` | 0.70 | Higher = image-dominant (visual fidelity) |
| `text_weight` | 0.30 | Higher = text refines more (good for attributes) |
| `text_override_attributes` | color, size, material | Text can override what image shows |

## Step 5: Tune Model Configuration

```json
// config/openai.json
{
  "attribute_extraction": {
    "model": "gpt-4o",
    "temperature": 0,
    "max_tokens": 200
  },
  "product_description": {
    "model": "gpt-4o-mini",
    "temperature": 0.2,
    "max_tokens": 150
  },
  "search_analytics": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 300
  }
}
```

| Task | Model | Why |
|------|-------|-----|
| Attribute extraction | gpt-4o | Vision model for color/pattern/material from images |
| Product description | gpt-4o-mini | Generate search-friendly text from attributes |
| Search analytics | gpt-4o-mini | Summarize click-through patterns |

## Step 6: Cost Optimization

```python
# Visual Product Search cost per month (100K catalog, 50K queries):
# Encoding:
#   - Catalog encoding (one-time): ~$5 (100K images × $0.00005)
#   - Delta encoding (new products): ~$0.50/month (1K new)
#   - Query encoding: ~$2.50/month (50K queries × $0.00005)
# Search:
#   - AI Search S1: ~$250/month
#   - Vector search queries: included in S1
# Storage:
#   - Product images (CDN): ~$15/month
#   - Cosmos DB (analytics): ~$10/month
# LLM:
#   - Attribute extraction (gpt-4o, 1K new/month): ~$0.50
#   - Analytics (gpt-4o-mini): ~$0.30
# Infrastructure:
#   - Container Apps: ~$15/month
#   - Content Safety: ~$5/month
# Total: ~$299/month for 50K queries

# Cost reduction:
# 1. Cache embeddings for repeat queries: save ~50% encoding
# 2. CLIP ViT-B/32 (smaller model): save ~30% encoding time
# 3. AI Search Basic (if <1M products): save $200/month
# 4. Reduce HNSW ef_search (speed vs accuracy): save compute
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Cache query embeddings | ~$1.25/month | Exact duplicate queries only |
| Smaller CLIP model | ~30% encoding | Lower visual accuracy |
| Search Basic | ~$200/month | 15M document limit |
| Lower ef_search | ~20% latency | Slightly lower recall |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_visual_match.py --test-data evaluation/data/query_images/
python evaluation/eval_multimodal.py --test-data evaluation/data/multimodal_queries/
python evaluation/eval_performance.py --endpoint $SEARCH_ENDPOINT
python evaluation/eval_engagement.py --test-data evaluation/data/click_logs/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Precision@10 | baseline | > 85% | > 85% |
| Latency p50 | baseline | < 200ms | < 200ms |
| Click-through rate | baseline | > 40% | > 40% |
| Zero results | baseline | < 5% | < 5% |
| Monthly cost | ~$299 | ~$100 | < $350 |
