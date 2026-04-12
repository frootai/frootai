---
name: "tune-accessibility-learning-agent"
description: "Tune Accessibility Learning Agent — WCAG level targeting, severity thresholds, alt-text style, cognitive load limits, false positive reduction, cost optimization."
---

# Tune Accessibility Learning Agent

## Prerequisites

- Deployed accessibility agent with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune WCAG Target Level

```json
// config/guardrails.json — WCAG settings
{
  "wcag": {
    "target_level": "AA",
    "version": "2.2",
    "check_categories": ["perceivable", "operable", "understandable", "robust"],
    "severity_filter": {
      "report": ["critical", "serious", "moderate", "minor"],
      "block_deploy": ["critical", "serious"]
    },
    "automated_checks": true,
    "ai_enhanced_checks": true,
    "page_crawl_depth": 3
  }
}
```

WCAG level tuning:
| Level | Requirements | Use Case |
|-------|-------------|----------|
| A | 30 success criteria (minimum) | Internal tools (not recommended) |
| AA (default) | 50 success criteria | Enterprise standard, legal compliance |
| AAA | 78 success criteria | Government, healthcare, banking |

| Parameter | Default | Impact |
|-----------|---------|--------|
| `target_level` | AA | Higher = more issues flagged, stricter compliance |
| `severity_filter.block_deploy` | critical + serious | Remove serious = allow more to pass |
| `page_crawl_depth` | 3 | Higher = more pages audited, longer scan time |
| `ai_enhanced_checks` | true | false = faster, misses 40-60% of issues |

## Step 2: Tune Alt-Text Generation

```json
// config/agents.json — alt-text settings
{
  "alt_text": {
    "max_length": 125,
    "style": "concise_descriptive",
    "include_data_for_charts": true,
    "decorative_detection": true,
    "context_window_chars": 500,
    "language": "en",
    "avoid_prefixes": ["Image of", "Picture of", "Photo of", "Screenshot of"],
    "templates": {
      "logo": "{company_name} logo",
      "icon": "{action} icon",
      "chart": "{chart_type} showing {key_insight}",
      "photo": "{subject} {action_or_context}"
    }
  }
}
```

Alt-text tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `max_length` | 125 | Screen reader best practice — longer = more info, slower |
| `context_window_chars` | 500 | More surrounding text = better context-aware alt |
| `decorative_detection` | true | false = alt text on all images (redundant for decorative) |
| `include_data_for_charts` | true | Critical for data accessibility |

### Alt-Text Style Guide
| Image Type | Good Alt Text | Bad Alt Text |
|-----------|--------------|-------------|
| Logo | "Contoso logo" | "Image of company logo" |
| Chart | "Revenue grew 15% Q2→Q3" | "Chart" |
| Portrait | "Dr. Smith, Chief Medical Officer" | "Photo of a person" |
| Decorative | `alt=""` (empty) | "Decorative swirl pattern" |
| Button icon | "Search" | "Magnifying glass icon" |
| Screenshot | "Settings page showing dark mode toggle" | "Screenshot" |

## Step 3: Tune Cognitive Load Assessment

```json
// config/guardrails.json — cognitive load settings
{
  "cognitive_load": {
    "max_reading_grade": 8,
    "max_words_per_page": 2000,
    "max_navigation_depth": 3,
    "max_form_fields": 10,
    "max_concurrent_animations": 2,
    "color_palette_max": 6,
    "sentence_complexity": {
      "max_words_per_sentence": 25,
      "passive_voice_max_pct": 20,
      "jargon_detection": true
    }
  }
}
```

Cognitive load tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `max_reading_grade` | 8 | Lower = simpler language required |
| `max_words_per_page` | 2000 | Lower = shorter pages, more page breaks |
| `max_form_fields` | 10 | Lower = split long forms into wizards |
| `max_concurrent_animations` | 2 | 0 = no animations (safest for seizure/vestibular) |

### Content Type Profiles
| Content Type | Reading Level | Max Words | Form Fields |
|-------------|---------------|-----------|-------------|
| Public website | Grade 6-8 | 1500 | 5 |
| Enterprise app | Grade 8-10 | 2500 | 15 |
| Technical docs | Grade 10-12 | 3000 | N/A |
| Government | Grade 6 | 1000 | 5 |

## Step 4: Tune False Positive Reduction

```json
// config/guardrails.json — false positive settings
{
  "false_positive_management": {
    "known_exceptions": [
      {"rule": "color-contrast", "selector": ".decorative-text", "reason": "Decorative, not content"},
      {"rule": "link-name", "selector": ".icon-only-link[aria-label]", "reason": "Has aria-label"}
    ],
    "confidence_threshold": 0.7,
    "require_human_review_below": 0.5,
    "suppress_duplicate_per_page": true,
    "max_issues_per_rule": 10
  }
}
```

| Parameter | Default | Impact |
|-----------|---------|--------|
| `confidence_threshold` | 0.7 | Lower = more issues reported (higher noise) |
| `suppress_duplicate_per_page` | true | false = list every instance (verbose) |
| `max_issues_per_rule` | 10 | Higher = comprehensive, lower = focus on variety |

## Step 5: Tune Model Configuration

```json
// config/openai.json
{
  "cognitive_analysis": {
    "model": "gpt-4o",
    "temperature": 0,
    "max_tokens": 1000
  },
  "alt_text_generation": {
    "model": "gpt-4o",
    "temperature": 0.3,
    "max_tokens": 100
  },
  "remediation_suggestions": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 300
  },
  "reading_level_analysis": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 200
  }
}
```

| Task | Model | Why |
|------|-------|-----|
| Cognitive analysis | gpt-4o | Complex page understanding required |
| Alt-text generation | gpt-4o | Vision model needed for image analysis |
| Remediation suggestions | gpt-4o-mini | Templated fixes, cost-sensitive |
| Reading level | gpt-4o-mini | Text complexity is straightforward |

## Step 6: Cost Optimization

```python
# Accessibility Learning Agent cost per audit:
# - Playwright page crawl: ~$0 (compute only)
# - axe-core automated: ~$0 (open source, runs locally)
# - AI cognitive analysis (gpt-4o, ~5 pages × $0.02): ~$0.10
# - Alt-text generation (gpt-4o with vision, ~20 images × $0.01): ~$0.20
# - Remediation suggestions (gpt-4o-mini, ~30 issues × $0.001): ~$0.03
# - Reading level (gpt-4o-mini): ~$0.01
# - Total per audit: ~$0.34
# - Infrastructure: Container Apps (~$15) + Cosmos DB (~$5)
# - 500 audits/month: ~$190/month

# Cost reduction:
# 1. Cache alt-text for repeat images (save 80% vision cost)
# 2. Skip AI checks for pages with 0 automated issues (save ~50%)
# 3. gpt-4o-mini for cognitive analysis (save 90% LLM, lower quality)
# 4. Batch page analysis (5 pages per API call)
# 5. Rate-limit crawl depth for large sites
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Cache alt-text | ~$0.16/audit | May miss image changes |
| Skip AI on clean pages | ~50% AI cost | Miss AI-only detectable issues |
| Batch analysis | ~30% API calls | Slightly less per-page precision |
| Limit crawl depth | ~60% scan time | Miss deep-linked pages |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_wcag_detection.py --test-data evaluation/data/pages/
python evaluation/eval_alt_text.py --test-data evaluation/data/images/
python evaluation/eval_cognitive.py --test-data evaluation/data/pages/
python evaluation/eval_remediation.py --test-data evaluation/data/violations/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Violation detection | baseline | > 90% | > 90% |
| False positive rate | baseline | < 10% | < 10% |
| Alt-text quality | baseline | > 4.0/5.0 | > 4.0/5.0 |
| Fix accuracy | baseline | > 85% | > 85% |
| Cost per audit | ~$0.34 | ~$0.20 | < $0.50 |
