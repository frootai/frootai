---
name: "tune-dynamic-pricing-engine"
description: "Tune Dynamic Pricing Engine — elasticity sensitivity, change limits, margin floors, surge caps, A/B test config, competitor strategy, cost optimization."
---

# Tune Dynamic Pricing Engine

## Prerequisites

- Deployed pricing engine with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Price Constraints

```json
// config/guardrails.json — pricing constraints
{
  "pricing_constraints": {
    "min_margin_pct": 15,
    "max_daily_change_pct": 10,
    "max_weekly_change_pct": 20,
    "surge_max_multiplier": 2.0,
    "surge_notice_required": true,
    "surge_cooldown_hours": 4,
    "price_memory_session_min": 30,
    "no_cookie_based_pricing": true,
    "no_demographic_pricing": true,
    "price_gouging_max_increase_pct": 50,
    "display_original_price_on_discount": true,
    "rounding": "psychological",
    "rounding_targets": [0.99, 0.95, 0.49]
  }
}
```

Constraint tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `min_margin_pct` | 15% | Lower = more competitive pricing, risk loss |
| `max_daily_change_pct` | 10% | Lower = more stable, less responsive |
| `surge_max_multiplier` | 2.0× | Lower = less revenue during peaks, less PR risk |
| `price_memory_session_min` | 30 | Longer = more consistent UX, less optimization |

### Price Change Strategy by Category
| Category | Max Daily | Max Weekly | Reason |
|----------|----------|-----------|--------|
| Groceries/essentials | 5% | 10% | Price sensitivity, regulation |
| Electronics | 10% | 20% | Standard retail dynamic pricing |
| Fashion/seasonal | 15% | 30% | Short lifecycle, high variability |
| SaaS/subscriptions | 0% (lock-in) | N/A | Annual contract — no intra-term changes |
| Commodities | 20% | 40% | Market-driven, highly volatile |

## Step 2: Tune Elasticity Model

```json
// config/agents.json — elasticity model settings
{
  "elasticity_model": {
    "model_type": "gradient_boosting",
    "features": [
      "product_category", "brand_strength", "day_of_week", "month",
      "is_holiday", "competitor_price_ratio", "inventory_days_of_supply",
      "search_interest_index", "promotion_active", "price_history_30d_avg"
    ],
    "retrain_frequency": "weekly",
    "min_training_samples": 1000,
    "cross_elasticity": true,
    "seasonality_decomposition": true,
    "lookback_months": 6,
    "price_variation_requirement": {
      "min_distinct_prices": 5,
      "min_price_range_pct": 15
    }
  }
}
```

Elasticity tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `retrain_frequency` | weekly | Daily = more adaptive, more compute |
| `cross_elasticity` | true | Captures substitution effects between products |
| `lookback_months` | 6 | Shorter = recent behavior, miss seasonality |
| `min_distinct_prices` | 5 | Require sufficient price variation for robust estimation |

### Elasticity Interpretation Guide
| Elasticity | Interpretation | Pricing Strategy |
|-----------|---------------|-----------------|
| -2.0 to -3.0 | Highly elastic | Price-competitive, small changes matter |
| -1.0 to -2.0 | Elastic | Standard dynamic pricing |
| -0.5 to -1.0 | Inelastic | Premium pricing possible |
| > -0.5 | Very inelastic | Price increases have minimal demand impact |

## Step 3: Tune Optimization Objective

```json
// config/agents.json — optimization settings
{
  "optimization": {
    "primary_objective": "revenue",
    "secondary_objective": "margin",
    "weights": {"revenue": 0.6, "margin": 0.4},
    "inventory_pressure": {
      "low_stock_days": 7,
      "low_stock_action": "increase_price_5pct",
      "overstock_days": 90,
      "overstock_action": "allow_deeper_discount_15pct"
    },
    "competitor_strategy": {
      "position": "competitive",
      "max_premium_over_avg_pct": 5,
      "max_discount_below_avg_pct": 10,
      "price_match_enabled": false
    },
    "update_frequency": "hourly",
    "dampening_factor": 0.7
  }
}
```

Optimization tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| Revenue vs margin weights | 60/40 | More revenue = lower prices, more volume |
| `dampening_factor` | 0.7 | Higher = slower changes (less oscillation) |
| `competitor position` | competitive | "premium" = allow 10%+ over competitors |
| `update_frequency` | hourly | More frequent = more responsive, more compute |

## Step 4: Tune A/B Testing

```json
// config/agents.json — A/B test settings
{
  "ab_testing": {
    "min_sample_size": 1000,
    "max_test_duration_days": 14,
    "confidence_level": 0.95,
    "traffic_split_default": [0.5, 0.5],
    "max_price_variant_pct": 15,
    "metrics": ["conversion_rate", "revenue_per_visitor", "margin_per_unit"],
    "primary_metric": "revenue_per_visitor",
    "auto_conclude": true,
    "auto_apply_winner": false
  }
}
```

| Parameter | Default | Impact |
|-----------|---------|--------|
| `min_sample_size` | 1000 | Lower = faster conclusion, less reliable |
| `max_price_variant_pct` | 15% | Higher = test bigger changes, more risk |
| `auto_apply_winner` | false | true = auto-adopt best price (risky without review) |

## Step 5: Tune Model Configuration

```json
// config/openai.json
{
  "pricing_explanation": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 300
  },
  "market_analysis": {
    "model": "gpt-4o",
    "temperature": 0.2,
    "max_tokens": 1000
  },
  "ab_test_summary": {
    "model": "gpt-4o-mini",
    "temperature": 0.1,
    "max_tokens": 500
  }
}
```

| Task | Model | Why |
|------|-------|-----|
| Pricing explanation | gpt-4o-mini | Standard structured output, high volume |
| Market analysis | gpt-4o | Complex competitive landscape |
| A/B test summary | gpt-4o-mini | Statistical results interpretation |

## Step 6: Cost Optimization

```python
# Dynamic Pricing Engine cost per month (1000 products):
# ML:
#   - Azure ML (elasticity training, weekly): ~$30/month
#   - Model serving (real-time inference): ~$20/month
# Compute:
#   - Data Explorer Dev (transaction analytics): ~$130/month
#   - Event Hubs (sales event streaming): ~$11/month
#   - Functions (price engine): ~$10/month
# LLM:
#   - Pricing explanations (gpt-4o-mini): ~$3/month
#   - Market analysis (gpt-4o, weekly): ~$0.20/month
# Infrastructure:
#   - Container Apps: ~$15/month
#   - Cosmos DB Serverless: ~$10/month
# Competitor monitoring: ~$20/month (API fees)
# Total: ~$249/month for 1000 products
# ROI: 5%+ revenue lift on $1M+ monthly revenue = $50K+ additional

# Cost reduction:
# 1. Batch price updates (hourly → 4x daily): save ~50% Functions
# 2. gpt-4o-mini for all LLM tasks (already mostly done)
# 3. Reduce competitor refresh to 4x daily: save ~$10/month
# 4. Shared ADX across product lines: save ~$100/month
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Batch updates (4x daily) | ~$5/month | Less responsive to demand spikes |
| Reduce competitor refresh | ~$10/month | 6h stale competitor data |
| Shared ADX | ~$100/month | Multi-tenant complexity |
| ROI reference | 5%+ revenue lift | Pays back in first week |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_revenue.py --baseline evaluation/data/baseline_revenue/ --optimized evaluation/data/optimized_revenue/
python evaluation/eval_elasticity.py --test-data evaluation/data/price_experiments/
python evaluation/eval_fairness.py --test-data evaluation/data/pricing_logs/
python evaluation/eval_ab_tests.py --test-data evaluation/data/ab_results/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Revenue lift | baseline | > 5% | > 5% |
| Elasticity MAPE | baseline | < 15% | < 15% |
| Fairness compliance | baseline | 100% | 100% |
| Margin floor | baseline | 100% ≥ 15% | 100% |
| Monthly cost | ~$249 | ~$150 | < $300 |
