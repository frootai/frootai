---
name: "tune-policy-impact-analyzer"
description: "Tune Policy Impact Analyzer — stakeholder taxonomy, cost estimation methods, comment deduplication, evidence standards, non-partisan enforcement, cost optimization."
---

# Tune Policy Impact Analyzer

## Prerequisites

- Deployed policy analyzer with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Stakeholder Identification

```json
// config/agents.json — stakeholder settings
{
  "stakeholders": {
    "taxonomy": {
      "citizens": {
        "subgroups": ["general_public", "low_income", "elderly", "disabled", "rural", "minority", "veterans"],
        "always_assess": ["low_income", "elderly", "disabled"]
      },
      "businesses": {
        "subgroups": ["small_business_under_50", "mid_market", "enterprise", "startups", "nonprofits"],
        "size_thresholds": {"small": 50, "mid": 500}
      },
      "government": {
        "subgroups": ["federal_agencies", "state_government", "local_government", "tribal"]
      }
    },
    "auto_detect_industries": true,
    "vulnerable_group_priority": true,
    "minimum_stakeholder_groups": 3
  }
}
```

Stakeholder tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `always_assess` groups | 3 (low income, elderly, disabled) | Add more = more comprehensive, more analysis time |
| `auto_detect_industries` | true | false = use manual list only (risk missing groups) |
| `minimum_stakeholder_groups` | 3 | Higher = more comprehensive but more expensive |

## Step 2: Tune Cost-Benefit Estimation

```json
// config/guardrails.json — estimation settings
{
  "cost_benefit": {
    "estimation_method": "evidence_with_ranges",
    "confidence_levels": ["low", "medium", "high"],
    "range_width": {
      "low_confidence": 3.0,
      "medium_confidence": 1.5,
      "high_confidence": 0.5
    },
    "require_precedent": true,
    "precedent_search_depth": 10,
    "discount_rate": 0.03,
    "time_horizon_years": 10,
    "inflation_adjustment": true,
    "distributional_analysis": true,
    "qualitative_allowed": true
  }
}
```

Estimation tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `range_width (low)` | 3.0× | Wider = honest about uncertainty, less actionable |
| `require_precedent` | true | false = allow estimates without historical basis (riskier) |
| `discount_rate` | 3% | Standard government discount rate (OMB Circular A-94) |
| `distributional_analysis` | true | Who bears costs vs who receives benefits |

### Evidence Quality Hierarchy
| Evidence Level | Description | Confidence |
|---------------|-------------|-----------|
| Measured outcome | Actual data from similar policy implementation | High |
| Statistical model | Economic model with validated inputs | Medium-High |
| Expert estimate | Subject matter expert consensus | Medium |
| Analogical | Similar policy in different jurisdiction | Medium-Low |
| Theoretical | Economic theory without empirical validation | Low |

## Step 3: Tune Comment Analysis

```json
// config/agents.json — comment analysis settings
{
  "comment_analysis": {
    "deduplication": {
      "similarity_threshold": 0.85,
      "campaign_detection": true,
      "campaign_min_size": 10,
      "report_campaigns_separately": true
    },
    "theme_extraction": {
      "max_themes": 10,
      "min_comments_per_theme": 5,
      "hierarchy": true
    },
    "sentiment": {
      "categories": ["support", "oppose", "neutral", "mixed"],
      "per_provision": true,
      "confidence_threshold": 0.75
    },
    "representation": {
      "check_missing_voices": true,
      "expected_groups": ["affected_businesses", "consumer_advocates", "industry_associations"]
    }
  }
}
```

Comment tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `similarity_threshold` | 0.85 | Lower = catch more paraphrased form letters |
| `campaign_min_size` | 10 | Lower = flag smaller organized efforts |
| `max_themes` | 10 | Higher = more granular but harder to synthesize |
| `check_missing_voices` | true | Identifies who's NOT commenting (often most affected) |

## Step 4: Tune Non-Partisanship & Evidence Standards

```json
// config/guardrails.json — bias prevention settings
{
  "evidence_standards": {
    "require_source_citation": true,
    "min_sources_per_claim": 1,
    "source_diversity_required": true,
    "partisan_language_detection": true,
    "banned_framing": [
      "the right approach", "obviously correct",
      "common sense says", "everyone agrees"
    ],
    "balanced_presentation": {
      "arguments_for_required": true,
      "arguments_against_required": true,
      "alternative_approaches_min": 2
    },
    "quantitative_claims": {
      "require_range": true,
      "require_confidence_level": true,
      "require_data_source": true
    }
  }
}
```

| Rule | Enforcement | Rationale |
|------|-------------|-----------|
| Source citation | Required for all claims | Verifiability |
| Partisan language ban | Auto-detected + rejected | Government credibility |
| For AND against | Both required | Balanced analysis |
| Ranges not points | Required for all estimates | Honest uncertainty |
| Alternative approaches | Minimum 2 | Decision-maker flexibility |

## Step 5: Tune Model Configuration

```json
// config/openai.json
{
  "policy_analysis": {
    "model": "gpt-4o",
    "temperature": 0.2,
    "max_tokens": 3000
  },
  "provision_extraction": {
    "model": "gpt-4o",
    "temperature": 0,
    "max_tokens": 2000
  },
  "comment_analysis": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 500
  },
  "theme_extraction": {
    "model": "gpt-4o-mini",
    "temperature": 0.2,
    "max_tokens": 800
  }
}
```

| Task | Model | Temperature | Why |
|------|-------|-------------|-----|
| Policy analysis | gpt-4o | 0.2 | Nuanced analysis with evidence grounding |
| Provision extraction | gpt-4o | 0 | Zero hallucination — legal accuracy |
| Comment analysis | gpt-4o-mini | 0 | High volume sentiment classification |
| Theme extraction | gpt-4o-mini | 0.2 | Clustering requires some flexibility |

## Step 6: Cost Optimization

```python
# Policy Impact Analyzer cost per analysis:
# - Document extraction (Doc Intelligence): ~$0.05/page × 50 pages = ~$2.50
# - Provision extraction (gpt-4o): ~$0.30
# - Stakeholder impact (gpt-4o, ~5 groups × $0.10): ~$0.50
# - Evidence search (AI Search): ~$0.05
# - Comment analysis (gpt-4o-mini, ~1000 comments × $0.002): ~$2.00
# - Recommendation (gpt-4o): ~$0.15
# - Total per analysis: ~$5.50
# - Infrastructure: AI Search S1 (~$250) + Cosmos DB (~$10) + Container Apps (~$15)
# - 20 analyses/month: ~$385/month

# Cost reduction:
# 1. Cache precedent searches (same policy domain): save 60% search
# 2. Batch comment analysis (100 per API call): save 50% comment cost
# 3. gpt-4o-mini for stakeholder impact: save ~$0.40/analysis
# 4. AI Search Basic (if <1M documents): save $200/month
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Cache precedents | ~$0.03/analysis | May miss new precedents |
| Batch comments | ~$1.00/analysis | Slightly less per-comment precision |
| gpt-4o-mini impact | ~$0.40/analysis | Less nuanced stakeholder analysis |
| Search Basic | ~$200/month | 15M document limit |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_provisions.py --test-data evaluation/data/policies/
python evaluation/eval_impact.py --test-data evaluation/data/assessments/
python evaluation/eval_comments.py --test-data evaluation/data/comments/
python evaluation/eval_recommendations.py --test-data evaluation/data/recommendations/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Provision extraction | baseline | > 90% | > 90% |
| Evidence sourcing | baseline | > 90% | > 90% |
| Non-partisan | baseline | 100% | 100% |
| Comment campaign detection | baseline | > 85% | > 85% |
| Cost per analysis | ~$5.50 | ~$3.00 | < $10 |
