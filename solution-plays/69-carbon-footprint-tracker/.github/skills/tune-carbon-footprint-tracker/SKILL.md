---
name: "tune-carbon-footprint-tracker"
description: "Tune Carbon Footprint Tracker — emission factors, Scope 3 spend classification, reporting frameworks, reduction priorities, data collection automation, factor update schedule."
---

# Tune Carbon Footprint Tracker

## Prerequisites

- Deployed carbon tracker with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Emission Factors

```json
// config/guardrails.json
{
  "emission_factors": {
    "source": "ghg_protocol_2024",
    "auto_update": true,
    "update_schedule": "annually",
    "fallback_source": "epa_2023",
    "custom_overrides": {},
    "grid_factor_regions": ["us", "eu", "uk", "germany", "france", "india", "china", "australia"]
  },
  "scope3": {
    "estimation_method": "spend_based",
    "prefer_supplier_specific": true,
    "llm_classification_model": "gpt-4o-mini",
    "default_factor_if_unknown": 0.30,
    "confidence_threshold": 0.7
  }
}
```

Factor tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `source` | ghg_protocol_2024 | Most widely accepted |
| `auto_update` | true | false = manual review before update |
| `default_factor_if_unknown` | 0.30 | Higher = more conservative estimate |
| `prefer_supplier_specific` | true | Actual data > estimation |
| `confidence_threshold` | 0.7 | LLM classification minimum confidence |

### Factor Source Comparison
| Source | Coverage | Accuracy | Update Frequency |
|--------|----------|----------|------------------|
| GHG Protocol | Global | Reference standard | Annual |
| EPA | US-focused | US-specific accuracy | Annual |
| DEFRA | UK-focused | UK-specific | Annual |
| ADEME | France/EU | EU-specific | Bi-annual |

## Step 2: Tune Scope 3 Classification

```json
// config/agents.json
{
  "scope3_classification": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "categories": [
      "cloud_computing", "office_supplies", "business_travel_air",
      "business_travel_rail", "professional_services", "food_catering",
      "electronics", "construction", "logistics", "marketing"
    ],
    "custom_categories": [],
    "few_shot_examples": 3,
    "batch_classification": true,
    "batch_size": 50
  }
}
```

Classification tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `categories` | 10 standard | Add industry-specific categories |
| `few_shot_examples` | 3 | More = better accuracy, more tokens |
| `batch_size` | 50 | Larger = fewer API calls |
| `custom_categories` | empty | Add for domain-specific spend |

## Step 3: Tune Reporting

```json
// config/agents.json
{
  "reporting": {
    "frameworks": ["ghg_protocol", "cdp", "tcfd"],
    "default_framework": "ghg_protocol",
    "report_frequency": "annually",
    "include_reduction_targets": true,
    "include_year_over_year": true,
    "base_year": 2020,
    "target_year": 2030,
    "target_reduction_pct": 46
  }
}
```

Reporting tuning:
| Framework | Key Configuration |
|-----------|-------------------|
| GHG Protocol | Base year, target year, intensity metrics |
| CDP | Governance, risks, strategy, targets (A-D scoring) |
| TCFD | Climate-related risks, scenario analysis |

## Step 4: Tune Data Collection

```json
// config/agents.json
{
  "data_connectors": {
    "utility_providers": { "enabled": true, "api_integration": true, "frequency": "monthly" },
    "travel_system": { "enabled": true, "source": "concur", "frequency": "weekly" },
    "erp": { "enabled": true, "source": "sap", "frequency": "monthly" },
    "fleet_management": { "enabled": true, "frequency": "weekly" },
    "manual_upload": { "enabled": true, "template_url": "/templates/emission-data.xlsx" }
  }
}
```

## Step 5: Tune Reduction Recommendations

```json
// config/openai.json
{
  "recommendations": {
    "model": "gpt-4o",
    "temperature": 0.3,
    "max_recommendations": 10,
    "include_roi": true,
    "include_timeframe": true,
    "priority_by": "emission_reduction_potential"
  },
  "classification": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "batch_size": 50
  }
}
```

## Step 6: Cost Optimization

```python
# Carbon Tracker cost breakdown:
# - LLM Scope 3 classification (gpt-4o-mini): ~$0.005/item
#   1000 spend items/quarter = ~$5/quarter
# - LLM report generation (gpt-4o): ~$0.10/report
# - LLM recommendations (gpt-4o): ~$0.05/set
# - Cosmos DB: ~$25/month
# - Container Apps: ~$30/month
# - Total: ~$56/month + ~$6/quarter for LLM

# Cost reduction:
# 1. Batch spend classification (50 items per call) — 90% fewer API calls
# 2. Cache classified categories for repeat vendors
# 3. Less frequent reporting (annual vs quarterly)
```

| Strategy | Savings | Trade-off |
|----------|---------|----------|
| Batch classification | ~90% LLM cost | Slight delay |
| Cache vendor categories | ~60% repeat classification | May miss vendor changes |
| Annual reports (not quarterly) | ~75% report cost | Less frequent visibility |
| Cosmos serverless | ~60% DB cost | Variable throughput |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_calculations.py --test-data evaluation/data/companies/
python evaluation/eval_scope3.py --test-data evaluation/data/spend/
python evaluation/eval_reporting.py
python evaluation/eval_recommendations.py --test-data evaluation/data/companies/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Scope 3 estimation | baseline | ±25% | Within ±25% |
| Spend classification | baseline | +5-10% | > 85% |
| Reporting compliance | baseline | 100% | 100% |
| Monthly cost | ~$56 | ~$35 | < $60 |
