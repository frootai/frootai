---
name: "tune-climate-risk-assessor"
description: "Tune Climate Risk Assessor — scenario parameters, risk weights, time horizons, physical risk thresholds, TCFD reporting depth, cost optimization."
---

# Tune Climate Risk Assessor

## Prerequisites

- Deployed climate risk system with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Scenario Configuration

```json
// config/agents.json — scenario settings
{
  "scenarios": {
    "active": ["orderly", "disorderly", "hot_house"],
    "default": "disorderly",
    "custom_scenarios": [],
    "time_horizons": {
      "short": {"years": [1, 3], "label": "Near-term"},
      "medium": {"years": [3, 10], "label": "Medium-term"},
      "long": {"years": [10, 30], "label": "Long-term"}
    },
    "default_horizon": "medium",
    "ngfs_version": "v4",
    "temperature_targets": {
      "orderly": "1.5°C by 2100",
      "disorderly": "2.0°C by 2100",
      "hot_house": "3.0°C+ by 2100"
    }
  }
}
```

Scenario tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `active` scenarios | 3 | More = comprehensive, longer assessment time |
| `default` scenario | disorderly | Most relevant for regulatory reporting |
| `default_horizon` | medium | Short = urgent action, long = strategic planning |
| `ngfs_version` | v4 | Keep latest for regulatory compliance |

## Step 2: Tune Physical Risk Weights

```json
// config/guardrails.json — physical risk settings
{
  "physical_risk": {
    "hazard_weights": {
      "flood": 0.25,
      "heat_stress": 0.20,
      "sea_level_rise": 0.15,
      "wildfire": 0.20,
      "storm": 0.20
    },
    "exposure_metric": "asset_value_usd",
    "vulnerability_adjustments": {
      "insurance_coverage": -0.2,
      "adaptation_measures": -0.15,
      "building_resilience": -0.1
    },
    "score_scale": {"min": 0, "max": 100},
    "high_risk_threshold": 70,
    "critical_risk_threshold": 90
  }
}
```

Physical risk tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `hazard_weights` | Equal-ish | Sector-specific: coastal = sea_level higher |
| `exposure_metric` | asset_value_usd | Alternative: employee_count, revenue |
| `insurance_coverage` adjustment | -0.2 | Higher = less credit for insurance |
| `high_risk_threshold` | 70 | Lower = more assets flagged as high risk |

### Sector-Specific Weight Profiles
| Sector | Flood | Heat | Sea Level | Wildfire | Storm |
|--------|-------|------|-----------|----------|-------|
| Agriculture | 0.30 | 0.30 | 0.05 | 0.15 | 0.20 |
| Real Estate (coastal) | 0.25 | 0.10 | 0.35 | 0.10 | 0.20 |
| Energy (offshore) | 0.15 | 0.05 | 0.20 | 0.05 | 0.55 |
| Manufacturing | 0.25 | 0.25 | 0.10 | 0.20 | 0.20 |
| Default | 0.25 | 0.20 | 0.15 | 0.20 | 0.20 |

## Step 3: Tune Transition Risk Thresholds

```json
// config/guardrails.json — transition risk settings
{
  "transition_risk": {
    "carbon_intensity_high": 500,
    "carbon_intensity_medium": 100,
    "stranded_asset_threshold_pct": 20,
    "sector_transition_risk": {
      "oil_gas": "very_high",
      "coal": "very_high",
      "utilities": "high",
      "cement": "high",
      "steel": "high",
      "automotive": "medium",
      "agriculture": "medium",
      "technology": "low",
      "healthcare": "low"
    },
    "carbon_price_scenarios": {
      "orderly": {"2030": 75, "2040": 150, "2050": 250},
      "disorderly": {"2030": 25, "2040": 100, "2050": 500},
      "hot_house": {"2030": 10, "2040": 10, "2050": 10}
    }
  }
}
```

Transition tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `carbon_intensity_high` | 500 tCO₂e/M$ | Lower = more companies flagged |
| `stranded_asset_threshold_pct` | 20% | Lower = earlier warning |
| Carbon prices | NGFS v4 | Adjust for regional carbon markets (EU ETS, UK ETS) |

## Step 4: Tune TCFD Report Configuration

```json
// config/agents.json — reporting settings
{
  "reporting": {
    "framework": "tcfd",
    "include_opportunities": true,
    "financial_quantification": true,
    "narrative_depth": "detailed",
    "executive_summary_length": 500,
    "sector_benchmarking": true,
    "output_formats": ["html", "pdf", "json"],
    "language": "en",
    "recommendation_count": 5
  }
}
```

Reporting tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `narrative_depth` | detailed | "summary" = shorter, cheaper; "detailed" = comprehensive |
| `include_opportunities` | true | TCFD requires both risks AND opportunities |
| `financial_quantification` | true | false = qualitative only (less useful) |
| `sector_benchmarking` | true | Compares to sector peers (needs sector data) |

## Step 5: Tune Model Configuration

```json
// config/openai.json
{
  "scenario_analysis": {
    "model": "gpt-4o",
    "temperature": 0,
    "max_tokens": 1000,
    "system_prompt": "You are a climate risk analyst. Ground all statements in NGFS/IPCC data."
  },
  "tcfd_narrative": {
    "model": "gpt-4o",
    "temperature": 0.3,
    "max_tokens": 3000
  },
  "risk_explanation": {
    "model": "gpt-4o-mini",
    "temperature": 0.1,
    "max_tokens": 500
  },
  "financial_summary": {
    "model": "gpt-4o",
    "temperature": 0,
    "max_tokens": 1000
  }
}
```

| Task | Model | Why |
|------|-------|-----|
| Scenario analysis | gpt-4o | Critical accuracy — grounding in NGFS data |
| TCFD narrative | gpt-4o | Quality reporting for stakeholders |
| Risk explanation | gpt-4o-mini | Simpler pattern, cost-sensitive |
| Financial summary | gpt-4o | Numbers must be accurate |

## Step 6: Cost Optimization

```python
# Climate Risk Assessor cost per assessment:
# - Geospatial queries (Azure Maps): ~$0.05 per location
# - LLM scenario analysis (gpt-4o): ~$0.30 per scenario × 3 scenarios
# - LLM TCFD narrative (gpt-4o): ~$0.15
# - LLM risk explanations (gpt-4o-mini): ~$0.02 per risk × 10 risks
# - AI Search (knowledge base): ~$0.01
# - Total per assessment: ~$1.31
# - Infrastructure: Cosmos DB Serverless (~$5/month dev) + Container Apps (~$15/month)
# - Annual cost (100 companies quarterly): ~$544/year + infra

# Cost reduction:
# 1. Cache physical risk by grid cell (1km²) → save 80% geospatial queries
# 2. gpt-4o-mini for risk explanations (already done)
# 3. Annual assessment (not quarterly) = 75% fewer assessments
# 4. Batch NGFS queries (one API call per scenario, not per company)
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Cache geospatial | ~80% map queries | Stale if climate data updated |
| Annual assessment | ~75% | Less responsive to new climate data |
| Batch NGFS | ~60% API calls | Slight delay in scenario updates |
| Skip opportunities | ~15% LLM | Incomplete TCFD reporting |
| gpt-4o-mini for all | ~90% LLM | Lower narrative quality |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_physical_risk.py --test-data evaluation/data/locations/
python evaluation/eval_transition_risk.py --test-data evaluation/data/companies/
python evaluation/eval_scenarios.py --test-data evaluation/data/scenarios/
python evaluation/eval_tcfd.py --test-data evaluation/data/reports/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Physical risk correlation | baseline | > 0.85 | > 0.85 |
| TCFD coverage | baseline | 100% pillars | 100% |
| Groundedness | baseline | > 0.85 | > 0.85 |
| Scenario differentiation | baseline | > 20% | > 20% |
| Cost per assessment | ~$1.31 | ~$0.70 | < $1.00 |
