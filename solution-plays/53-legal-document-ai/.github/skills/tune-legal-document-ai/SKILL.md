---
name: "tune-legal-document-ai"
description: "Tune Legal Document AI — clause library coverage, risk benchmarks per contract type, redline tone, UPL guardrails, jurisdiction rules, cost per contract review."
---

# Tune Legal Document AI

## Prerequisites

- Deployed legal AI pipeline with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`
- Evaluation baseline from `evaluate-legal-document-ai` skill

## Step 1: Tune Clause Library

### Clause Definitions per Contract Type
```json
// config/agents.json
{
  "clause_library": {
    "NDA": {
      "required": ["confidentiality", "non_disclosure", "term", "exceptions", "remedies"],
      "optional": ["return_of_materials", "injunctive_relief", "survival"]
    },
    "MSA": {
      "required": ["indemnification", "liability_cap", "termination", "governing_law", "payment_terms"],
      "optional": ["IP_assignment", "dispute_resolution", "force_majeure", "assignment", "amendment"]
    },
    "SLA": {
      "required": ["uptime_commitment", "response_time", "penalties", "credits"],
      "optional": ["exclusions", "measurement_method", "reporting"]
    },
    "Employment": {
      "required": ["compensation", "termination", "IP_assignment", "confidentiality"],
      "optional": ["non_compete", "non_solicitation", "benefits", "severance"]
    }
  },
  "jurisdiction_rules": {
    "California": { "non_compete": "generally_unenforceable", "note": "Bus. & Prof. Code §16600" },
    "New York": { "non_compete": "enforceable_if_reasonable", "note": "Blue-pencil doctrine" },
    "Delaware": { "non_compete": "enforceable_if_reasonable", "note": "Favorable corporate law" },
    "EU": { "non_compete": "limited_by_member_state", "note": "GDPR data protection obligations" }
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `required` clauses | Per type | More = stricter coverage, fewer missing-clause alerts |
| `optional` clauses | Per type | Include if present, don't flag if absent |
| Jurisdiction rules | 4 jurisdictions | Add more for international contracts |

## Step 2: Tune Risk Scoring Benchmarks

```json
// config/guardrails.json
{
  "risk_benchmarks": {
    "MSA": {
      "liability_cap": { "low": "> 2x contract value", "high": "< 1x or unlimited" },
      "indemnification": { "low": "mutual, capped", "high": "one-sided, uncapped" },
      "termination": { "low": "30-day notice, both sides", "high": "no clause or unilateral" },
      "payment_terms": { "low": "net 30", "high": "net 90+ or no terms" }
    },
    "NDA": {
      "term": { "low": "1-3 years", "high": "perpetual" },
      "exceptions": { "low": "standard carve-outs", "high": "no exceptions" },
      "confidentiality": { "low": "mutual, defined scope", "high": "one-sided, broad scope" }
    }
  },
  "scoring": {
    "model": "gpt-4o",
    "temperature": 0,
    "calibration_method": "benchmark_comparison",
    "score_range": [0, 1],
    "level_thresholds": { "low": 0.3, "medium": 0.6, "high": 0.8, "critical": 0.9 }
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `level_thresholds` | 0.3/0.6/0.8/0.9 | Adjust for risk appetite |
| Per-clause benchmarks | Per contract type | More specific = more accurate |
| `temperature` | 0 | Always 0 for legal (deterministic) |

## Step 3: Tune Redline Generation

```json
// config/openai.json
{
  "redlining": {
    "model": "gpt-4o",
    "temperature": 0.2,
    "max_tokens": 1000,
    "tone": "balanced",
    "favorable_to": "our_company",
    "redline_threshold": 0.5,
    "include_rationale": true,
    "system_prompt": "Suggest contract modifications. Be balanced but protective. Include rationale. Never give legal advice."
  },
  "clause_extraction": {
    "model": "gpt-4o",
    "temperature": 0,
    "max_sections_per_call": 5,
    "chunk_overlap_chars": 200
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `redline_threshold` | 0.5 | Lower = more redlines, higher = only high-risk |
| `tone` | balanced | "aggressive" for negotiation, "protective" for risk-averse |
| `temperature` | 0.2 | Slightly creative for suggestion variety |
| `max_sections_per_call` | 5 | Fewer = better accuracy, more API calls |

## Step 4: Tune UPL Guardrails

```json
// config/guardrails.json
{
  "upl_compliance": {
    "disclaimer_on_every_output": true,
    "disclaimer_text": "DRAFT — Suggestion for attorney review. This is not legal advice.",
    "privilege_marker": "ATTORNEY WORK PRODUCT — PRIVILEGED AND CONFIDENTIAL",
    "never_phrases": ["we advise", "you should", "you must", "legally required", "this constitutes", "in our legal opinion"],
    "always_phrases": ["for attorney review", "suggestion only", "consult legal counsel"],
    "scan_output_for_violations": true
  }
}
```

**UPL is non-negotiable.** Every output must have:
1. Disclaimer text
2. Privilege marker
3. Zero "never phrases"
4. At least one "always phrase"

## Step 5: Cost Optimization

```python
# Legal Document AI cost per contract review:
# - Document Intelligence (layout): ~$0.01/page
# - Clause extraction (gpt-4o, 5 chunks): ~$0.50
# - Risk scoring (gpt-4o, per clause, ~7 clauses): ~$1.05
# - Redlining (gpt-4o, ~3 high-risk): ~$0.45
# - Total (20-page MSA): ~$2.01

# Cost reduction:
# 1. Use gpt-4o-mini for contract classification (save $0.10)
# 2. Cache clause benchmarks (save $0.20/contract)
# 3. Only redline risk > 0.6 (fewer redlines = less cost)
# 4. Batch clause extraction (5 sections per call)
```

| Strategy | Savings | Trade-off |
|----------|---------|----------|
| gpt-4o-mini for classification | ~5% | Slightly less accurate typing |
| Cache benchmarks | ~10% | Stale if benchmarks updated |
| Higher redline threshold | ~20% | Miss medium-risk improvements |
| Batch clause extraction | ~15% | May miss cross-section references |

## Step 6: Verify Tuning Impact

```bash
python evaluation/eval_clauses.py --test-data evaluation/data/
python evaluation/eval_risk.py --test-data evaluation/data/
python evaluation/eval_upl.py --test-data evaluation/data/
python evaluation/eval_redlines.py --test-data evaluation/data/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Clause detection | baseline | +5-10% | > 90% |
| Risk calibration | baseline | +10-15% | > 80% |
| UPL compliance | 100% | 100% | 100% |
| Redline relevance | baseline | +10% | > 85% |
| Cost per review | ~$2.01 | ~$1.50 | < $3.00 |
