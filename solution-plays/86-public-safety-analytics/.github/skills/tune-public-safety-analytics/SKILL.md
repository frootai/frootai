---
name: "tune-public-safety-analytics"
description: "Tune Public Safety Analytics — pattern sensitivity, resource constraints, bias thresholds, anonymization rules, response time targets, cost optimization."
---

# Tune Public Safety Analytics

## Prerequisites

- Deployed analytics system with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Pattern Detection

```json
// config/agents.json — pattern analysis settings
{
  "pattern_analysis": {
    "temporal_resolution": "hourly",
    "lookback_months": 12,
    "trend_window_months": 3,
    "peak_detection_threshold": 1.5,
    "seasonal_decomposition": true,
    "source_weighting": {
      "community_reported": 1.0,
      "patrol_generated": 0.7,
      "311_service": 0.8
    },
    "incident_categories": [
      "violent", "property", "traffic", "disorder", "medical", "fire"
    ],
    "exclude_from_analysis": ["patrol_generated_only_areas"],
    "aggregate_level": "district"
  }
}
```

Pattern tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `peak_detection_threshold` | 1.5× average | Lower = more peaks detected (noisier) |
| `patrol_generated` weight | 0.7 | Lower = reduce enforcement bias influence |
| `lookback_months` | 12 | Shorter = more responsive, miss seasonality |
| `aggregate_level` | district | Finer = block-level (risk geographic targeting) |

### Bias Mitigation Through Source Weighting
| Source | Weight | Rationale |
|--------|--------|-----------|
| Community-reported (911) | 1.0 | Most representative of actual need |
| 311 service requests | 0.8 | Community-initiated but lower urgency |
| Patrol-generated | 0.7 | Discounted — reflects patrol patterns, not actual incidents |
| Proactive enforcement | 0.5 | Most biased — directly reflects where officers are deployed |

## Step 2: Tune Resource Allocation

```json
// config/agents.json — resource optimization settings
{
  "resource_allocation": {
    "response_time_targets": {
      "priority_1_life_threat_min": 8,
      "priority_2_urgent_min": 15,
      "priority_3_non_urgent_min": 30
    },
    "shift_constraints": {
      "max_hours": 12,
      "min_rest_hours": 10,
      "overlap_min": 30,
      "minimum_active_units": 3
    },
    "staging_optimization": {
      "update_frequency_min": 15,
      "use_real_time_traffic": true,
      "hospital_proximity_weight": 0.2
    },
    "equity_constraint": {
      "max_response_time_disparity_min": 2,
      "max_resource_disparity_pct": 10,
      "audit_by_demographics": true
    }
  }
}
```

Resource tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `priority_1 target` | 8 min | Lower = more units needed, higher cost |
| `minimum_active_units` | 3 | Higher = better coverage, higher staffing cost |
| `max_response_time_disparity` | 2 min | Tighter = more equitable, harder to achieve |
| `staging update frequency` | 15 min | Faster = more responsive, more compute |

## Step 3: Tune Anonymization & Privacy

```json
// config/guardrails.json — privacy settings
{
  "anonymization": {
    "address_generalization": "block_level",
    "coordinate_rounding": 3,
    "remove_fields": ["suspect_name", "victim_name", "witness_name", "ssn", "dob", "phone"],
    "narrative_pii_scrub": true,
    "minimum_k_anonymity": 5,
    "suppress_small_counts": true,
    "small_count_threshold": 5,
    "retention_days": 365,
    "public_dashboard_aggregation": "census_tract"
  },
  "prohibited_capabilities": [
    "predictive_policing",
    "individual_targeting",
    "facial_recognition",
    "social_media_monitoring",
    "geographic_crime_prediction"
  ]
}
```

Privacy tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `coordinate_rounding` | 3 decimal (~100m) | More = coarser privacy, less = re-identification risk |
| `minimum_k_anonymity` | 5 | Higher = stronger privacy, may lose data points |
| `small_count_threshold` | 5 | Suppress cells with <5 incidents (prevent identification) |
| `prohibited_capabilities` | 5 items | Hard-coded restrictions — never tunable |

## Step 4: Tune Bias Detection

```json
// config/guardrails.json — bias audit settings
{
  "bias_audit": {
    "frequency": "monthly",
    "demographic_dimensions": ["census_tract_median_income", "census_tract_demographics"],
    "disparity_threshold_response_time_min": 2,
    "disparity_threshold_resource_pct": 10,
    "alert_on_violation": true,
    "auto_rebalance": false,
    "report_format": "public_accessible",
    "community_review_board_share": true
  }
}
```

| Check | Threshold | Action on Failure |
|-------|-----------|-------------------|
| Response time parity | < 2 min disparity | Flag + review staging positions |
| Resource allocation parity | < 10% disparity | Rebalance shift scheduling |
| Data source bias | Patrol-generated > 60% | Increase community reporting channels |
| Anonymization | k=5 verified | Block data publication until fixed |

## Step 5: Tune Model Configuration

```json
// config/openai.json
{
  "pattern_analysis": {
    "model": "gpt-4o",
    "temperature": 0,
    "max_tokens": 1000
  },
  "resource_recommendation": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 500
  },
  "community_report": {
    "model": "gpt-4o",
    "temperature": 0.2,
    "max_tokens": 2000
  }
}
```

| Task | Model | Why |
|------|-------|-----|
| Pattern analysis | gpt-4o | Complex temporal correlation |
| Resource recommendation | gpt-4o-mini | Structured optimization output |
| Community report | gpt-4o | Public-facing quality, transparency |

## Step 6: Cost Optimization

```python
# Public Safety Analytics cost per month:
# Data:
#   - Data Explorer Dev: ~$130/month
#   - Cosmos DB Serverless: ~$10/month
#   - Storage: ~$5/month
# Compute:
#   - Container Apps: ~$15/month
#   - Maps routing: ~$20/month (staging optimization)
# LLM:
#   - Pattern analysis (gpt-4o, weekly): ~$0.20
#   - Resource recommendations (gpt-4o-mini, daily): ~$0.30
#   - Community reports (gpt-4o, monthly): ~$0.15
# Dashboard:
#   - Power BI Embedded A1: ~$700/month (or use free web dashboard)
# Total: ~$880/month (with Power BI) or ~$180/month (web dashboard)

# Cost reduction:
# 1. Web dashboard instead of Power BI: save ~$700/month
# 2. Batch optimization (6h cycle vs 15 min): save ~$15/month Maps
# 3. Data Explorer Dev (already cheapest): N/A
# 4. Shared infrastructure across districts: save ~40%
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Web dashboard (no Power BI) | ~$700/month | Less interactive visualization |
| Batch staging optimization | ~$15/month | Less responsive to real-time changes |
| Multi-district sharing | ~40% per district | Multi-tenant complexity |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_patterns.py --test-data evaluation/data/incidents/
python evaluation/eval_resources.py --baseline evaluation/data/baseline/ --optimized evaluation/data/optimized/
python evaluation/eval_bias.py --test-data evaluation/data/demographics/
python evaluation/eval_transparency.py --test-data evaluation/data/dashboard/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Response time improvement | baseline | > 15% | > 15% |
| Resource parity | baseline | < 10% disparity | < 10% |
| No predictive policing | baseline | 100% verified | 100% |
| Anonymization | baseline | k=5 verified | k≥5 |
| Monthly cost | ~$880 | ~$180 | < $300 |
