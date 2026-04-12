---
name: "tune-property-valuation-ai"
description: "Tune Property Valuation AI — comp search parameters, adjustment factors, model features, confidence intervals, bias mitigation, cost optimization."
---

# Tune Property Valuation AI

## Prerequisites

- Deployed valuation system with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Comparable Search Parameters

```json
// config/agents.json — comp search settings
{
  "comp_search": {
    "search_radius_km": 2,
    "max_radius_km": 8,
    "expand_if_fewer_than": 3,
    "recency_months": 6,
    "max_recency_months": 12,
    "sqft_tolerance_pct": 20,
    "max_comps_considered": 15,
    "final_comp_count": 5,
    "similarity_weights": {
      "distance": 0.25,
      "sqft_diff": 0.20,
      "age_diff": 0.15,
      "condition_match": 0.15,
      "recency": 0.15,
      "feature_match": 0.10
    }
  }
}
```

Comp search tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `search_radius_km` | 2 | Wider = more comps but less comparable locations |
| `recency_months` | 6 | Longer = more comps but older sales (market shift risk) |
| `sqft_tolerance_pct` | 20% | Wider = more comps, larger adjustments needed |
| `final_comp_count` | 5 | More = stable estimate, USPAP requires minimum 3 |

### Market-Specific Profiles
| Market Type | Radius | Recency | Comps |
|------------|--------|---------|-------|
| Dense urban | 1 km | 3 months | 7+ |
| Suburban | 2 km | 6 months | 5 |
| Rural | 8 km | 12 months | 3 (minimum) |
| Luxury ($1M+) | 5 km | 9 months | 5 |

## Step 2: Tune Adjustment Factors

```json
// config/agents.json — adjustment settings
{
  "adjustments": {
    "sqft_living": {"per_sqft": 150, "cap_pct": 15},
    "bedrooms": {"per_unit": 15000},
    "bathrooms": {"per_unit": 10000},
    "garage": {"per_car": 12000},
    "pool": {"value": 20000},
    "fireplace": {"value": 5000},
    "basement_finished": {"per_sqft": 75},
    "condition": {
      "excellent_to_good": -10000,
      "good_to_average": -8000,
      "average_to_fair": -12000,
      "fair_to_poor": -15000
    },
    "age": {"per_year": -500, "cap_years": 20},
    "lot_size": {"per_sqft": 5, "cap_pct": 10},
    "max_net_adjustment_pct": 25,
    "max_gross_adjustment_pct": 30,
    "recalibrate_frequency": "quarterly"
  }
}
```

Adjustment calibration:
| Factor | Method | Update Frequency |
|--------|--------|-----------------|
| $/sqft | Paired sales analysis (matched pairs) | Quarterly |
| Bedroom | Regression coefficient from sales data | Semi-annual |
| Pool | Market-specific (warm vs cold climate) | Annual |
| Condition | Appraiser-informed scale | Annual |
| Age/Year built | Depreciation curve from market data | Annual |

### Paired Sales Methodology
```python
# Find pairs of similar properties that differ in ONE feature
# Compare sale prices to derive adjustment factor
pairs = find_paired_sales(feature="pool", control_features=["sqft", "beds", "location"])
pool_value = mean([pair.with_feature.price - pair.without_feature.price for pair in pairs])
# Result: pool adds ~$20,000 in this market
```

## Step 3: Tune Confidence Intervals

```json
// config/guardrails.json — confidence settings
{
  "confidence": {
    "default_range_pct": 8,
    "min_range_pct": 5,
    "max_range_pct": 20,
    "adjust_by_comp_quality": true,
    "widen_factors": {
      "few_comps": {"threshold": 3, "widen_pct": 3},
      "old_comps": {"threshold_months": 9, "widen_pct": 2},
      "distant_comps": {"threshold_km": 5, "widen_pct": 2},
      "high_adjustment": {"threshold_pct": 20, "widen_pct": 3},
      "unique_property": {"widen_pct": 5}
    }
  }
}
```

| Scenario | Default Range | Widened To |
|----------|-------------|-----------|
| Strong comps (5+, recent, close) | ±8% | ±8% |
| Few comps (3) | ±8% | ±11% |
| Old comps (>9 months) | ±8% | ±10% |
| Unique property (no close match) | ±8% | ±13% |
| Rural + few + old combined | ±8% | ±18% |

## Step 4: Tune Bias Mitigation

```json
// config/guardrails.json — fair lending settings
{
  "bias_mitigation": {
    "protected_features_excluded": ["race", "ethnicity", "religion", "national_origin", "sex", "familial_status", "disability"],
    "proxy_correlation_max": 0.30,
    "disparate_impact_range": [0.80, 1.25],
    "geographic_parity_max_variance": 0.03,
    "audit_frequency": "monthly",
    "automated_bias_check_on_every_valuation": false,
    "batch_bias_check_frequency": "weekly"
  }
}
```

| Check | Frequency | Action on Failure |
|-------|-----------|-------------------|
| Protected features excluded | Every model train | Block deployment |
| Proxy variable correlation | Monthly | Flag + investigate |
| Disparate impact ratio | Weekly | Retrain with debiasing |
| Geographic parity | Monthly | Adjust by neighborhood |

## Step 5: Tune Model Configuration

```json
// config/openai.json
{
  "valuation_narrative": {
    "model": "gpt-4o",
    "temperature": 0.2,
    "max_tokens": 1500
  },
  "comp_explanation": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 300
  },
  "market_summary": {
    "model": "gpt-4o-mini",
    "temperature": 0.2,
    "max_tokens": 500
  }
}
```

| Task | Model | Why |
|------|-------|-----|
| Valuation narrative | gpt-4o | Professional-grade appraisal report quality |
| Comp explanation | gpt-4o-mini | Straightforward comparison text |
| Market summary | gpt-4o-mini | Standard market trend description |

## Step 6: Cost Optimization

```python
# Property Valuation AI cost per valuation:
# - Comp search (AI Search): ~$0.01
# - Maps (geolocation + distance): ~$0.02
# - ML model inference: ~$0.001
# - LLM narrative (gpt-4o): ~$0.08
# - LLM comp explanation (gpt-4o-mini, 5 comps): ~$0.01
# - Total per valuation: ~$0.12
# - Infrastructure: AI Search S1 (~$250) + Cosmos DB (~$10) + Container Apps (~$15)
# - 1000 valuations/month: ~$395/month

# Cost reduction:
# 1. gpt-4o-mini for narrative: save ~$0.07/valuation (lower quality)
# 2. Cache comp data (same neighborhood, 24h): save 60% search
# 3. AI Search Basic (if <1M properties): save $200/month
# 4. Batch valuations (bulk portfolio): save 30% API calls
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| gpt-4o-mini narrative | ~$70/month | Less professional report tone |
| Cache comps | ~$0.006/val | Stale if new sale posted |
| Search Basic | ~$200/month | 15M property limit |
| Batch processing | ~30% compute | Slight delay for bulk |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_accuracy.py --test-data evaluation/data/holdout_sales/
python evaluation/eval_comps.py --test-data evaluation/data/comp_quality/
python evaluation/eval_adjustments.py --test-data evaluation/data/adjustments/
python evaluation/eval_bias.py --test-data evaluation/data/demographics/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Median APE | baseline | < 8% | < 8% |
| Within ±10% | baseline | > 75% | > 75% |
| Disparate impact | baseline | 0.80-1.25 | 0.80-1.25 |
| Comp relevance | baseline | > 4.0/5.0 | > 4.0/5.0 |
| Cost per valuation | ~$0.12 | ~$0.06 | < $0.20 |
