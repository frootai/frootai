---
name: "tune-supply-chain-ai"
description: "Tune Supply Chain AI — forecast model parameters, external signal weights, risk thresholds, safety stock levels, reorder triggers, reforecast frequency, cost optimization."
---

# Tune Supply Chain AI

## Prerequisites

- Deployed supply chain pipeline with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`
- Evaluation baseline from `evaluate-supply-chain-ai` skill

## Step 1: Tune Forecast Model

### Model Configuration
```json
// config/openai.json
{
  "forecasting": {
    "model": "prophet",
    "seasonality_mode": "multiplicative",
    "yearly_seasonality": true,
    "weekly_seasonality": true,
    "confidence_interval": 0.95,
    "changepoint_prior_scale": 0.05,
    "forecast_horizon_days": 90
  },
  "anomaly_explanation": {
    "model": "gpt-4o",
    "temperature": 0.2,
    "max_tokens": 500
  },
  "risk_analysis": {
    "model": "gpt-4o-mini",
    "temperature": 0.1
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `seasonality_mode` | multiplicative | "additive" for stable demand, "multiplicative" for variable |
| `confidence_interval` | 0.95 | Lower = narrower bands, higher = safer |
| `changepoint_prior_scale` | 0.05 | Higher = more responsive to trend changes |
| `forecast_horizon_days` | 90 | Shorter = more accurate, less planning time |

### Forecast Tuning Guide
| Symptom | Adjustment |
|---------|------------|
| MAPE > 15% | Add more external regressors, increase training window |
| CI too wide | Lower confidence_interval to 0.90 |
| Misses seasonal peaks | Switch to multiplicative seasonality |
| Slow to react to trends | Increase changepoint_prior_scale to 0.1 |
| Overfitting | Reduce changepoint_prior_scale to 0.01 |

## Step 2: Tune External Signals

```json
// config/agents.json
{
  "external_signals": {
    "weather": { "enabled": true, "weight": 0.15, "source": "openweathermap" },
    "holidays": { "enabled": true, "weight": 0.25, "source": "built-in" },
    "promotions": { "enabled": true, "weight": 0.30, "source": "marketing_calendar" },
    "economic_indicators": { "enabled": true, "weight": 0.10, "source": "fred_api" },
    "competitor_activity": { "enabled": false, "weight": 0.20, "source": "manual" }
  },
  "reforecast_triggers": {
    "sales_deviation_pct": 20,
    "external_event_detected": true,
    "schedule": "weekly",
    "emergency_reforecast": true
  }
}
```

Signal tuning:
| Signal | Default Weight | When to Increase |
|--------|---------------|------------------|
| Promotions | 0.30 | Frequent sales/discounts |
| Holidays | 0.25 | Seasonal products |
| Weather | 0.15 | Weather-sensitive (beverages, apparel) |
| Economic | 0.10 | Luxury/discretionary goods |
| Competitor | 0.20 (disabled) | Competitive market |

## Step 3: Tune Supplier Risk Thresholds

```json
// config/guardrails.json
{
  "supplier_risk": {
    "risk_weights": {
      "financial_health": 0.25,
      "delivery_reliability": 0.25,
      "quality_score": 0.20,
      "geo_risk": 0.15,
      "concentration_risk": 0.15
    },
    "thresholds": {
      "maintain": { "max_score": 40 },
      "diversify": { "max_score": 70 },
      "replace": { "min_score": 70 }
    },
    "alert_on_score_change": 15,
    "reassessment_frequency": "monthly"
  }
}
```

Risk tuning:
| Symptom | Adjustment |
|---------|------------|
| Too many "replace" recommendations | Raise replace threshold to 80 |
| Missing risky suppliers | Lower diversify threshold to 30 |
| Geo-risk overweighted | Reduce geo_risk weight to 0.10 |
| Want more frequent checks | Change reassessment to "weekly" |

## Step 4: Tune Inventory Optimization

```json
// config/guardrails.json
{
  "inventory": {
    "service_level": 0.95,
    "safety_stock_method": "z_score",
    "lead_time_buffer_days": 3,
    "ordering_cost": 50,
    "holding_cost_per_unit_per_year": 5,
    "review_period": "weekly",
    "min_order_quantity": 100,
    "max_order_quantity": 10000
  }
}
```

Inventory tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `service_level` | 0.95 | Higher = more safety stock, fewer stockouts |
| `lead_time_buffer_days` | 3 | Higher = more cushion, more carrying cost |
| `holding_cost_per_unit` | $5 | Affects EOQ calculation |
| `review_period` | weekly | More frequent = more responsive, more overhead |

## Step 5: Cost Optimization

```python
# Supply Chain AI cost breakdown:
# - ADX cluster (Dev tier): ~$150/month
# - Forecast computation (Prophet): ~$0 (CPU, local)
# - LLM anomaly explanation (gpt-4o): ~$0.01/explanation
# - Supplier risk analysis (gpt-4o-mini): ~$0.002/supplier
# - Container Apps (1 replica): ~$30/month
# - Total: ~$180/month + ~$0.01/forecast

# Cost reduction:
# 1. Use ADX free cluster for dev (save $150/month)
# 2. Reforecast weekly not daily (save 85% LLM cost)
# 3. Use gpt-4o-mini for risk analysis (already done)
# 4. Batch supplier assessments monthly (save 75%)
```

| Strategy | Savings | Trade-off |
|----------|---------|----------|
| ADX free tier (dev) | ~$150/month | 1 cluster, 10GB max |
| Weekly reforecast | ~85% LLM cost | Slower reaction to changes |
| Monthly risk assessment | ~75% risk cost | Less frequent alerts |
| Smaller forecast horizon | ~30% compute | Less planning visibility |

## Step 6: Verify Tuning Impact

```bash
python evaluation/eval_forecast.py --backtest-config evaluation/data/backtest-config.json
python evaluation/eval_supplier_risk.py --test-data evaluation/data/suppliers/
python evaluation/eval_inventory.py --test-data evaluation/data/inventory/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| MAPE | baseline | -3-5% | < 15% |
| CI calibration | baseline | +5-10% | > 90% |
| Supplier risk accuracy | baseline | +10% | > 80% |
| Service level | baseline | +2-3% | > 95% |
| Carrying cost | baseline | -15-20% | Improve |
| Total monthly cost | ~$180 | ~$80-120 | < $200 |
