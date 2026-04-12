---
name: "tune-retail-inventory-predictor"
description: "Tune Retail Inventory Predictor — service level targets, safety stock formulas, forecast horizon, promotion effects, lead time tracking, cost optimization."
---

# Tune Retail Inventory Predictor

## Prerequisites

- Deployed inventory predictor with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Service Level & Safety Stock

```json
// config/guardrails.json — inventory targets
{
  "inventory_targets": {
    "service_level": {
      "default": 0.95,
      "by_category": {
        "essentials": 0.98,
        "regular": 0.95,
        "seasonal": 0.90,
        "clearance": 0.85
      }
    },
    "stockout_max_pct": 3,
    "overstock_max_days_supply": 90,
    "dead_stock_threshold_days": 90,
    "min_display_stock": 1,
    "safety_stock_method": "dynamic",
    "review_period_days": 1
  }
}
```

Service level tuning:
| Category | Service Level | Safety Stock | Why |
|----------|-------------|-------------|-----|
| Essentials (milk, bread) | 98% | High | Stockout = lost customer loyalty |
| Regular (canned goods) | 95% | Standard | Balanced cost vs availability |
| Seasonal (holiday items) | 90% | Low (pre-season buildup) | Overstock risk after season |
| Clearance (end of life) | 85% | Minimal | Reducing, not replenishing |
| New products | 95% | Category average | No history, use proxy |

### Safety Stock Impact
| Service Level | z-Score | Safety Stock Multiplier | Stockout Risk |
|-------------|---------|----------------------|--------------|
| 90% | 1.28 | 1.28 × σ × √LT | 10% |
| 95% (default) | 1.645 | 1.645 × σ × √LT | 5% |
| 98% | 2.05 | 2.05 × σ × √LT | 2% |
| 99% | 2.33 | 2.33 × σ × √LT | 1% |

## Step 2: Tune Forecast Model

```json
// config/agents.json — forecast settings
{
  "forecast": {
    "model_type": "lightgbm",
    "horizon_days": 14,
    "update_frequency": "daily",
    "retrain_frequency": "weekly",
    "features": {
      "temporal": ["day_of_week", "month", "is_weekend", "is_holiday", "week_of_year"],
      "lag": ["lag_1d", "lag_7d", "lag_14d", "lag_28d"],
      "rolling": ["rolling_7d_avg", "rolling_28d_avg", "rolling_7d_std"],
      "external": ["promotion_active", "weather_temp", "local_event"],
      "product": ["category", "brand", "price_tier"]
    },
    "slow_mover_threshold": 1,
    "slow_mover_model": "croston",
    "new_product_strategy": "category_baseline",
    "lookback_days": 730
  }
}
```

Forecast tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `horizon_days` | 14 | Longer = more lead time, lower accuracy |
| `update_frequency` | daily | Weekly = less compute, less responsive |
| `slow_mover_threshold` | 1 unit/day | Higher = more items use Croston |
| `lookback_days` | 730 (2 years) | Shorter = miss full seasonality |

## Step 3: Tune Promotion Effects

```json
// config/agents.json — promotion settings
{
  "promotions": {
    "effects_by_type": {
      "bogo": {"lift": 2.5, "post_dip": 0.7, "dip_days": 7},
      "pct_off_20": {"lift": 1.5, "post_dip": 0.9, "dip_days": 3},
      "pct_off_40": {"lift": 2.0, "post_dip": 0.8, "dip_days": 5},
      "bundle": {"lift": 1.3, "post_dip": 0.95, "dip_days": 2},
      "loyalty_exclusive": {"lift": 1.2, "post_dip": 1.0, "dip_days": 0}
    },
    "cannibalization_modeling": true,
    "halo_effect_modeling": true,
    "auto_increase_stock_before_promo": true,
    "promo_stock_buffer_pct": 20,
    "recalibrate_from_actuals": true,
    "recalibration_min_promos": 5
  }
}
```

Promotion tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `lift` by type | Category defaults | Calibrate from actual promo results |
| `post_dip` | 0.7-1.0 | Lower = bigger demand dip after promo |
| `promo_stock_buffer_pct` | 20% | Higher = fewer promo stockouts, more overstock risk |
| `cannibalization_modeling` | true | Adjusts substitutes' forecasts during promo |

## Step 4: Tune Lead Time & Suppliers

```json
// config/agents.json — supplier settings
{
  "suppliers": {
    "default_lead_time_days": 3,
    "lead_time_tracking": true,
    "lead_time_by_supplier": {
      "supplier_a": {"avg_days": 2, "std_days": 0.5, "reliability": 0.95},
      "supplier_b": {"avg_days": 5, "std_days": 1.5, "reliability": 0.85},
      "supplier_c": {"avg_days": 7, "std_days": 2.0, "reliability": 0.80}
    },
    "use_actual_lead_time": true,
    "lead_time_buffer_days": 1,
    "multi_supplier_strategy": "cheapest_reliable",
    "emergency_supplier_enabled": true
  }
}
```

| Supplier | Lead Time | Reliability | Use When |
|----------|----------|-------------|----------|
| Supplier A | 2 days ± 0.5 | 95% | Primary — fast + reliable |
| Supplier B | 5 days ± 1.5 | 85% | Bulk orders — cheaper |
| Supplier C | 7 days ± 2.0 | 80% | Specialty items only |
| Emergency | 1 day | 99% | Rush orders (premium cost) |

## Step 5: Tune Model Configuration

```json
// config/openai.json
{
  "anomaly_explanation": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 300
  },
  "replenishment_report": {
    "model": "gpt-4o-mini",
    "temperature": 0.2,
    "max_tokens": 800
  },
  "stockout_alert": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 200
  }
}
```

| Task | Model | Why |
|------|-------|-----|
| Anomaly explanation | gpt-4o-mini | Simple pattern matching, high volume |
| Replenishment report | gpt-4o-mini | Routine daily summaries |
| Stockout alert | gpt-4o-mini | Automated notification text |

> Note: This play is ML-heavy (demand forecasting) — LLM is only for explanation/reporting, not prediction.

## Step 6: Cost Optimization

```python
# Retail Inventory Predictor cost per month (1000 SKUs × 50 stores):
# ML:
#   - Azure ML training (weekly retrain): ~$30/month
#   - Model serving (daily forecasts): ~$15/month
# Data:
#   - Data Explorer Dev (sales analytics): ~$130/month
#   - Event Hubs (POS streaming): ~$11/month
# LLM:
#   - Anomaly explanations (gpt-4o-mini, ~50/day): ~$3/month
#   - Reports (gpt-4o-mini, daily): ~$1/month
# Infrastructure:
#   - Container Apps: ~$15/month
#   - Cosmos DB Serverless: ~$10/month
#   - Functions (reorder triggers): ~$5/month
# Total: ~$220/month for 50K SKU-store combinations
# ROI: 3% stockout reduction × $10M monthly revenue = $300K saved annually

# Cost reduction:
# 1. Batch forecasts (daily aggregated vs per-transaction): save ~$10/month
# 2. Shared ADX across store clusters: save ~$100/month
# 3. Reduce retrain frequency (weekly → bi-weekly): save ~$15/month
# 4. Skip LLM for routine alerts (template-based): save ~$3/month
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Batch forecasts | ~$10/month | Less responsive to intra-day demand |
| Shared ADX | ~$100/month | Multi-tenant queries may be slower |
| Bi-weekly retrain | ~$15/month | Slower to adapt to demand shifts |
| Template alerts | ~$3/month | Less natural language quality |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_forecast.py --test-data evaluation/data/sales_holdout/
python evaluation/eval_inventory.py --test-data evaluation/data/inventory_snapshots/
python evaluation/eval_replenishment.py --test-data evaluation/data/purchase_orders/
python evaluation/eval_promotions.py --test-data evaluation/data/promotion_results/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| WMAPE | baseline | < 15% | < 15% |
| Stockout rate | baseline | < 3% | < 3% |
| Service level | baseline | > 95% | > 95% |
| Overstock rate | baseline | < 10% | < 10% |
| Monthly cost | ~$220 | ~$100 | < $300 |
