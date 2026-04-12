---
name: "tune-research-paper-ai"
description: "Tune Research Paper AI — search relevance, extraction depth, synthesis style, citation format, gap analysis sensitivity, cost optimization."
---

# Tune Research Paper AI

## Prerequisites

- Deployed research AI with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Paper Search Configuration

```json
// config/agents.json — search settings
{
  "search": {
    "sources": ["semantic_scholar", "arxiv", "pubmed", "crossref"],
    "default_top_k": 50,
    "relevance_threshold": 0.7,
    "ranking_weights": {
      "relevance": 0.6,
      "citations": 0.3,
      "recency": 0.1
    },
    "dedup_method": "doi_then_title",
    "title_similarity_threshold": 0.85,
    "max_papers_per_source": 30,
    "year_range": {"min": 2018, "max": null},
    "include_preprints": true
  }
}
```

Search tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `relevance_threshold` | 0.7 | Lower = more papers (noisier), higher = fewer (may miss) |
| `ranking_weights.citations` | 0.3 | Higher = favor well-known papers, lower = include newer work |
| `ranking_weights.recency` | 0.1 | Higher = favor recent papers, lower = include seminal older papers |
| `year_range.min` | 2018 | Older = more comprehensive, newer = more current |
| `include_preprints` | true | false = peer-reviewed only (miss cutting-edge work) |

### Source Selection by Domain
| Research Domain | Recommended Sources | Why |
|---------------|-------------------|-----|
| Computer Science | Semantic Scholar + arXiv | arXiv has latest CS preprints |
| Biomedical | PubMed + Semantic Scholar | PubMed is the gold standard for biomed |
| Multidisciplinary | All 4 sources | Maximum coverage |
| Engineering | Semantic Scholar + Crossref | IEEE/ACM papers via Crossref DOIs |

## Step 2: Tune Extraction Configuration

```json
// config/agents.json — extraction settings
{
  "extraction": {
    "fields": ["objective", "methodology", "key_findings", "limitations", "future_work", "contributions"],
    "prefer_full_text": true,
    "fallback_to_abstract": true,
    "include_quantitative": true,
    "max_extraction_tokens": 500,
    "batch_size": 5,
    "cache_extractions": true,
    "cache_ttl_days": 30
  }
}
```

Extraction tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `prefer_full_text` | true | false = abstract-only (faster, less detailed) |
| `include_quantitative` | true | Crucial: "accuracy improved" vs "accuracy improved by 12%" |
| `max_extraction_tokens` | 500 | Higher = more detail per paper, higher cost |
| `batch_size` | 5 | Higher = fewer API calls, risk quality drop |
| `cache_ttl_days` | 30 | Longer = less re-extraction, may miss paper updates |

## Step 3: Tune Literature Synthesis

```json
// config/agents.json — synthesis settings
{
  "synthesis": {
    "grouping": "thematic",
    "min_papers_per_theme": 3,
    "max_themes": 6,
    "compare_contrast": true,
    "include_methodology_trends": true,
    "citation_format": "apa",
    "tone": "academic",
    "max_review_words": 3000,
    "include_gap_analysis": true
  }
}
```

Synthesis tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `grouping` | thematic | "chronological" = timeline, "methodological" = by technique |
| `min_papers_per_theme` | 3 | Lower = more themes, higher = only major themes |
| `citation_format` | APA | Options: APA, IEEE, Chicago, Harvard, custom |
| `max_review_words` | 3000 | Shorter = more concise, longer = more detail |

### Citation Format Reference
| Format | Example | Common In |
|--------|---------|-----------|
| APA | (Smith et al., 2024) | Social sciences, psychology |
| IEEE | [1] | Engineering, CS |
| Chicago | Smith (2024, p. 15) | Humanities |
| Harvard | (Smith 2024) | Business, management |

## Step 4: Tune Gap Analysis

```json
// config/guardrails.json — gap analysis settings
{
  "gap_analysis": {
    "min_gaps": 3,
    "max_gaps": 5,
    "require_evidence": true,
    "impact_levels": ["high", "medium", "low"],
    "include_suggested_approach": true,
    "gap_types": [
      "unanswered_question",
      "untried_methodology",
      "understudied_domain",
      "unresolved_contradiction",
      "scalability_gap"
    ]
  }
}
```

| Parameter | Default | Impact |
|-----------|---------|--------|
| `min_gaps` | 3 | Fewer = only highest-impact gaps |
| `require_evidence` | true | false = allow speculative gaps (less reliable) |
| `include_suggested_approach` | true | Actionable recommendations for researchers |

## Step 5: Tune Model Configuration

```json
// config/openai.json
{
  "paper_extraction": {
    "model": "gpt-4o",
    "temperature": 0,
    "max_tokens": 500
  },
  "literature_synthesis": {
    "model": "gpt-4o",
    "temperature": 0.3,
    "max_tokens": 4000
  },
  "gap_analysis": {
    "model": "gpt-4o",
    "temperature": 0.3,
    "max_tokens": 1000
  },
  "relevance_scoring": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 50
  },
  "citation_verification": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 100
  }
}
```

| Task | Model | Temperature | Why |
|------|-------|-------------|-----|
| Paper extraction | gpt-4o | 0 | Accuracy—must match paper content exactly |
| Literature synthesis | gpt-4o | 0.3 | Creative grouping while staying grounded |
| Gap analysis | gpt-4o | 0.3 | Some creativity needed for gap identification |
| Relevance scoring | gpt-4o-mini | 0 | Simple classification, high volume |
| Citation verification | gpt-4o-mini | 0 | DOI/author matching, straightforward |

## Step 6: Cost Optimization

```python
# Research Paper AI cost per literature review (50 papers):
# - Paper search (APIs): ~$0 (free tiers)
# - Extraction (gpt-4o, 50 papers × $0.02): ~$1.00
# - Synthesis (gpt-4o, 1 review): ~$0.15
# - Gap analysis (gpt-4o): ~$0.05
# - Relevance scoring (gpt-4o-mini, 100 candidates): ~$0.01
# - Citation verification (gpt-4o-mini, 50 papers): ~$0.01
# - Total per review: ~$1.22
# - Infrastructure: Container Apps (~$15) + Cosmos DB (~$5) + Search S1 (~$250)
# - 50 reviews/month: ~$331/month

# Cost reduction:
# 1. Cache extractions (papers don't change): save 80% extraction
# 2. Extract from abstracts only: save 50% extraction tokens
# 3. gpt-4o-mini for extraction: save 90% (lower detail quality)
# 4. Reduce default_top_k from 50 to 30: save 40% extraction
# 5. Search Basic SKU (if <1M papers in index): save $200/month
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Cache extractions | ~$0.80/review | N/A — papers are immutable |
| Abstract-only | ~$0.50/review | Miss methodology details |
| Fewer papers (30) | ~$0.40/review | Less comprehensive coverage |
| gpt-4o-mini extraction | ~$0.90/review | Less precise extraction |
| Search Basic | ~$200/month | 15M doc limit vs 100M |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_search.py --test-data evaluation/data/search_queries/
python evaluation/eval_extraction.py --test-data evaluation/data/papers/
python evaluation/eval_citations.py --test-data evaluation/data/reviews/
python evaluation/eval_synthesis.py --test-data evaluation/data/reviews/
python evaluation/eval_gaps.py --test-data evaluation/data/gap_analysis/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| No phantom citations | baseline | 100% | 100% |
| Extraction accuracy | baseline | > 90% | > 90% |
| Synthesis coherence | baseline | > 4.0/5.0 | > 4.0/5.0 |
| Gap validity | baseline | > 75% | > 75% |
| Cost per review | ~$1.22 | ~$0.50 | < $1.50 |
