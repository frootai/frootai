---
name: "tune-esg-compliance-agent"
description: "Tune ESG Compliance Agent — framework requirements, evidence confidence thresholds, materiality criteria, greenwashing sensitivity, gap prioritization, assessment cadence."
---

# Tune ESG Compliance Agent

## Prerequisites

- Deployed ESG agent with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Framework Configuration

```json
// config/agents.json
{
  "frameworks": {
    "active": ["CSRD", "GRI", "TCFD"],
    "default": "CSRD",
    "csrd_options": {
      "double_materiality": true,
      "mandatory_only": false,
      "sector_specific": true
    },
    "gri_options": {
      "standards": "2021",
      "sector_standards": []
    }
  },
  "assessment": {
    "schedule": "annually",
    "continuous_monitoring": true,
    "alert_on_material_change": true,
    "stakeholder_input_required": true
  }
}
```

Framework tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `active` frameworks | 3 | More = wider coverage, more evidence needed |
| `double_materiality` | true | CSRD required — non-negotiable |
| `mandatory_only` | false | true = assess only mandatory CSRD items |
| `continuous_monitoring` | true | false = annual-only assessment |

## Step 2: Tune Evidence Matching

```json
// config/guardrails.json
{
  "evidence": {
    "confidence_threshold": 0.7,
    "min_evidence_per_requirement": 1,
    "evidence_staleness_months": 12,
    "cross_reference_required": false,
    "document_types": ["annual_report", "sustainability_report", "policy_doc", "audit_report", "certification"]
  },
  "scoring": {
    "mandatory_weight": 2.0,
    "optional_weight": 1.0,
    "evidence_absent_penalty": 0,
    "grade_scale": {
      "A": 80,
      "B": 60,
      "C": 40,
      "D": 20,
      "F": 0
    }
  }
}
```

Evidence tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `confidence_threshold` | 0.7 | Lower = more evidence accepted, risk false matches |
| `evidence_staleness_months` | 12 | Longer = accept older evidence |
| `cross_reference_required` | false | true = require multiple evidence sources |
| `mandatory_weight` | 2.0 | Higher = mandatory requirements impact score more |

### Evidence Confidence Guide
| Confidence | Interpretation | Action |
|-----------|---------------|--------|
| > 0.9 | Strong evidence clearly supports | Accept |
| 0.7-0.9 | Moderate evidence, mostly supports | Accept (default) |
| 0.5-0.7 | Weak evidence, partial support | Flag for review |
| < 0.5 | Insufficient evidence | Mark as gap |

## Step 3: Tune Greenwashing Detection

```json
// config/guardrails.json
{
  "greenwashing": {
    "enabled": true,
    "sensitivity": "medium",
    "indicators": ["vague_language", "cherry_picking", "no_evidence", "misleading_comparison", "symbolic_action"],
    "vague_terms": ["eco-friendly", "green", "sustainable", "carbon neutral", "net zero"],
    "require_quantification": true,
    "flag_unsubstantiated_claims": true
  }
}
```

Greenwashing tuning:
| Sensitivity | Behavior | Use Case |
|------------|----------|----------|
| Low | Flag only clear greenwashing | Internal self-assessment |
| Medium (default) | Flag vague language + missing evidence | Standard compliance |
| High | Flag any claim without quantified evidence | External audit preparation |

## Step 4: Tune Gap Prioritization

```json
// config/agents.json
{
  "gap_prioritization": {
    "severity_weights": {
      "critical": 10,
      "high": 5,
      "medium": 2,
      "low": 1
    },
    "priority_by": "severity_then_effort",
    "include_remediation": true,
    "include_effort_estimate": true,
    "include_deadline": true
  }
}
```

Gap priority:
| Severity | Criteria | Example |
|----------|----------|--------|
| Critical | Mandatory CSRD requirement with no evidence | Climate change mitigation missing |
| High | Material topic with weak evidence | Diversity policy exists but no data |
| Medium | Optional standard not addressed | Water reporting not provided |
| Low | Nice-to-have improvement | Better formatting of existing report |

## Step 5: Tune Model Configuration

```json
// config/openai.json
{
  "evidence_matching": {
    "model": "gpt-4o",
    "temperature": 0,
    "max_tokens": 500
  },
  "report_generation": {
    "model": "gpt-4o",
    "temperature": 0.3,
    "max_tokens": 3000
  },
  "greenwashing_analysis": {
    "model": "gpt-4o-mini",
    "temperature": 0
  },
  "gap_analysis": {
    "model": "gpt-4o-mini",
    "temperature": 0.1
  }
}
```

| Task | Model | Why |
|------|-------|-----|
| Evidence matching | gpt-4o | Critical accuracy — matches evidence to requirements |
| Report generation | gpt-4o | Quality reporting for stakeholders |
| Greenwashing | gpt-4o-mini | Pattern matching, simpler analysis |
| Gap analysis | gpt-4o-mini | Structured gap classification |

## Step 6: Cost Optimization

```python
# ESG Compliance cost per assessment:
# - Evidence matching (gpt-4o, ~20 requirements × 3 evidence docs): ~$0.60
# - Gap analysis (gpt-4o-mini): ~$0.05
# - Greenwashing check (gpt-4o-mini): ~$0.03
# - Report generation (gpt-4o): ~$0.15
# - AI Search queries: ~$0.05
# - Total per assessment: ~$0.88
# - Cosmos DB + Container Apps: ~$55/month
# - Annual cost (quarterly assessments): ~$58/year + infra

# Cost reduction:
# 1. Cache evidence matches between assessments (save 50%)
# 2. gpt-4o-mini for gap + greenwashing (already done)
# 3. Annual assessment (not quarterly) = 75% fewer evals
```

| Strategy | Savings | Trade-off |
|----------|---------|----------|
| Cache evidence | ~50% matching cost | May miss new evidence |
| Annual assessment | ~75% | Less frequent visibility |
| Skip non-material topics | ~30% | Narrower coverage |
| gpt-4o-mini for all | ~90% LLM | Lower evidence accuracy |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_scoring.py --test-data evaluation/data/companies/
python evaluation/eval_evidence.py --test-data evaluation/data/evidence/
python evaluation/eval_greenwashing.py --test-data evaluation/data/reports/
python evaluation/eval_materiality.py --test-data evaluation/data/materiality/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Score accuracy | baseline | Within ±10 | Within ±10 |
| Evidence matching | baseline | +5-10% | > 85% |
| Greenwashing detection | baseline | +10% | > 80% |
| Cost per assessment | ~$0.88 | ~$0.50 | < $1.00 |
