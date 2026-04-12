---
name: "tune-ai-data-marketplace"
description: "Tune AI Data Marketplace — quality scoring weights, privacy techniques, synthetic fidelity, search relevance, pricing strategy, cost optimization."
---

# Tune AI Data Marketplace

## Prerequisites

- Deployed data marketplace with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Quality Scoring

```json
// config/guardrails.json — quality settings
{
  "quality_scoring": {
    "dimensions": {
      "completeness": {"weight": 0.25, "threshold_excellent": 0.98, "threshold_poor": 0.70},
      "consistency": {"weight": 0.20, "checks": ["data_type", "format", "range"]},
      "accuracy": {"weight": 0.25, "sample_size": 100, "verification_method": "source_comparison"},
      "timeliness": {"weight": 0.15, "excellent_days": 7, "poor_days": 365},
      "uniqueness": {"weight": 0.15, "excellent_dup_rate": 0.01, "poor_dup_rate": 0.20}
    },
    "overall_grade_scale": {
      "A": 90, "B": 75, "C": 60, "D": 40, "F": 0
    },
    "auto_delist_below": 40,
    "refresh_schedule": "weekly"
  }
}
```

Quality tuning:
| Dimension | Weight | Adjust When |
|-----------|--------|-------------|
| Completeness | 25% | Higher for ML training data (nulls = bad) |
| Accuracy | 25% | Higher for financial/medical data (accuracy critical) |
| Consistency | 20% | Higher for integration (schema compliance) |
| Timeliness | 15% | Higher for market/news data (stale = useless) |
| Uniqueness | 15% | Higher for CRM data (duplicates waste storage) |

## Step 2: Tune Privacy Controls

```json
// config/guardrails.json — privacy settings
{
  "privacy": {
    "pii_scanner": {
      "model": "presidio",
      "entities": ["PERSON", "EMAIL", "PHONE", "SSN", "CREDIT_CARD", "ADDRESS", "DATE_OF_BIRTH"],
      "confidence_threshold": 0.85,
      "custom_patterns": [],
      "scan_on_upload": true
    },
    "anonymization": {
      "method": "k_anonymity",
      "k": 5,
      "quasi_identifiers": ["age", "zip_code", "gender"],
      "sensitive_attributes": [],
      "generalization_hierarchy": {
        "age": [5, 10, 20],
        "zip_code": [3, 2, 1]
      }
    },
    "synthetic_data": {
      "generator": "gaussian_copula",
      "min_rows_for_training": 1000,
      "fidelity_target": 0.90,
      "privacy_budget_epsilon": 1.0,
      "verify_no_real_records": true
    },
    "re_identification_risk": {
      "max_acceptable": 0.005,
      "assessment_method": "prosecutor_model"
    }
  }
}
```

Privacy tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `k` (k-anonymity) | 5 | Higher = stronger privacy, more data generalization |
| `pii_confidence_threshold` | 0.85 | Lower = catch more PII (more false positives) |
| `fidelity_target` | 0.90 | Higher = better synthetic quality, harder to achieve |
| `privacy_budget_epsilon` | 1.0 | Lower = stronger differential privacy, less utility |

## Step 3: Tune Search & Discovery

```json
// config/search.json — marketplace search
{
  "search": {
    "index_fields": ["name", "description", "schema_summary", "tags", "provider"],
    "vector_search": true,
    "embedding_model": "text-embedding-3-large",
    "semantic_ranking": true,
    "facets": ["category", "privacy_level", "license", "quality_grade"],
    "default_filters": {
      "quality_score_min": 60,
      "privacy_level": "any"
    },
    "boost_factors": {
      "quality_score": 1.3,
      "freshness": 1.2,
      "popularity": 1.1
    }
  }
}
```

Search tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `quality_score_min` | 60 | Higher = only show quality data |
| `quality boost` | 1.3× | Higher = quality data ranked first |
| `freshness boost` | 1.2× | Higher = recent data preferred |

## Step 4: Tune Licensing & Pricing

```json
// config/agents.json — marketplace settings
{
  "licensing": {
    "supported_licenses": ["cc_by_4", "cc_by_sa_4", "commercial", "research_only", "restricted"],
    "enforce_attribution": true,
    "track_usage": true,
    "usage_limits_per_license": {
      "cc_by_4": {"downloads": "unlimited", "commercial_use": true},
      "research_only": {"downloads": 10, "commercial_use": false},
      "restricted": {"downloads": 1, "nda_required": true}
    }
  },
  "pricing": {
    "model": "per_download",
    "free_sample": true,
    "sample_rows": 100,
    "price_factors": ["row_count", "quality_score", "exclusivity"],
    "min_price_usd": 0,
    "currency": "USD",
    "revenue_split": {"provider": 0.80, "platform": 0.20}
  }
}
```

## Step 5: Tune Model Configuration

```json
// config/openai.json
{
  "dataset_description": {
    "model": "gpt-4o",
    "temperature": 0.3,
    "max_tokens": 500
  },
  "quality_explanation": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 300
  },
  "search_query_expansion": {
    "model": "gpt-4o-mini",
    "temperature": 0.2,
    "max_tokens": 100
  }
}
```

| Task | Model | Why |
|------|-------|-----|
| Dataset description | gpt-4o | Rich, informative listing text |
| Quality explanation | gpt-4o-mini | Structured quality report |
| Query expansion | gpt-4o-mini | Synonym expansion for search |

## Step 6: Cost Optimization

```python
# AI Data Marketplace cost per month:
# Search:
#   - AI Search S1: ~$250/month
# Compute:
#   - Container Apps: ~$15/month
#   - Functions (quality scoring): ~$10/month
#   - Azure Purview: ~$100/month (lineage)
# LLM:
#   - Dataset descriptions (gpt-4o, ~100/month): ~$2/month
#   - Quality explanations (gpt-4o-mini): ~$0.50/month
#   - Search queries (gpt-4o-mini): ~$1/month
# Storage:
#   - Dataset files: ~$20/month (varies with catalog size)
#   - Cosmos DB: ~$10/month
# Total: ~$409/month

# Cost reduction:
# 1. Skip Purview (manual lineage): save ~$100/month
# 2. AI Search Basic: save ~$200/month
# 3. gpt-4o-mini for descriptions: save ~$1.50/month
# 4. Synthetic generation on-demand only: save compute
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Skip Purview | ~$100/month | Manual lineage tracking |
| Search Basic | ~$200/month | 15M listing limit |
| On-demand synthetic | Variable | Longer generation wait time |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_quality.py --test-data evaluation/data/datasets/
python evaluation/eval_privacy.py --test-data evaluation/data/privacy/
python evaluation/eval_synthetic.py --test-data evaluation/data/synthetic/
python evaluation/eval_search.py --test-data evaluation/data/search_queries/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Quality score accuracy | baseline | Within ±10 | Within ±10 |
| PII detection | baseline | > 99% | > 99% |
| Synthetic fidelity | baseline | > 90% | > 90% |
| Search Precision@10 | baseline | > 80% | > 80% |
| Monthly cost | ~$409 | ~$110 | < $500 |
