---
description: "AI Data Marketplace domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# AI Data Marketplace — Domain Knowledge

This workspace implements an AI data marketplace — dataset discovery, quality scoring, privacy-preserving data sharing, synthetic data augmentation, licensing management, and data lineage tracking.

## Data Marketplace Architecture (What the Model Gets Wrong)

### Dataset Discovery + Quality
```python
class DatasetListing(BaseModel):
    id: str
    name: str
    description: str
    schema: dict                # Column names, types, statistics
    quality_score: float        # 0-100 composite score
    freshness: str              # last_updated timestamp
    privacy_level: str          # public, anonymized, synthetic, confidential
    license: str                # CC-BY, commercial, restricted
    sample_available: bool      # Preview before purchase
    lineage: DataLineage        # Source → transformations → current state

async def score_data_quality(dataset: Dataset) -> QualityReport:
    checks = {
        "completeness": check_missing_values(dataset),      # % non-null
        "consistency": check_format_consistency(dataset),    # Schema compliance
        "accuracy": check_accuracy_sample(dataset),          # Spot-check against source
        "timeliness": check_freshness(dataset),              # Age of data
        "uniqueness": check_duplicates(dataset),             # Dedup rate
    }
    return QualityReport(scores=checks, overall=weighted_average(checks))
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| No quality scoring | Buyers get bad data, lose trust | 5-dimension quality score (completeness, consistency, accuracy, timeliness, uniqueness) |
| Share raw PII | Privacy violation, regulatory risk | Anonymize or synthesize before listing |
| No data preview | Buyers can't evaluate before purchasing | Provide sample subset + schema + statistics |
| No lineage tracking | Can't trace data provenance | Track: source → transformations → current state |
| No license management | Unclear usage rights | License metadata per dataset (CC-BY, commercial, restricted) |
| Static listings | Data goes stale without update | Freshness scoring + auto-refresh from source |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | LLM for dataset description generation, search |
| `config/guardrails.json` | Quality thresholds, privacy rules, license requirements |
| `config/agents.json` | Data sources, quality check schedule, marketplace rules |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement marketplace, quality scoring, privacy controls |
| `@reviewer` | Audit data quality, privacy compliance, license accuracy |
| `@tuner` | Optimize quality scoring, search relevance, pricing |

## Slash Commands
`/deploy` — Deploy marketplace | `/test` — Test quality scoring | `/review` — Privacy audit | `/evaluate` — Measure marketplace metrics
