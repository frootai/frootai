---
name: "evaluate-ai-translation-engine"
description: "Evaluate AI Translation Engine quality — BLEU/COMET scores, glossary compliance, LLM refinement impact, locale correctness, markup preservation, throughput."
---

# Evaluate AI Translation Engine

## Prerequisites

- Deployed translation engine (run `deploy-ai-translation-engine` skill first)
- Test corpus with reference translations (human-translated)
- Python 3.11+ with `sacrebleu`, `azure-ai-evaluation` packages

## Step 1: Prepare Evaluation Dataset

```bash
mkdir -p evaluation/data
# Each test: source text + human reference translations
# evaluation/data/translation-001.json
# {
#   "source": "Our compliance solution ensures data residency.",
#   "source_lang": "en",
#   "references": {"de": "Unsere Compliance-L\u00f6sung...", "fr": "Notre solution de conformit\u00e9..."},
#   "content_type": "marketing",
#   "has_glossary_terms": ["compliance", "data residency"]
# }
```

Test categories:
- **General text**: Standard business content (20 segments)
- **Marketing**: Brand voice, creative copy (10 segments)
- **Legal**: Contract clauses, terms (10 segments)
- **Technical docs**: API documentation, manuals (10 segments)
- **HTML content**: Markup-embedded text (5 segments)
- **Glossary-heavy**: Product names, domain terms (5 segments)

## Step 2: Evaluate Translation Quality

```bash
python evaluation/eval_quality.py \
  --test-data evaluation/data/ \
  --engine-endpoint $ENGINE_ENDPOINT \
  --output evaluation/results/quality.json
```

Quality metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **BLEU Score** | N-gram overlap with reference | > 40 (general), > 35 (creative) |
| **COMET Score** | Neural quality estimation | > 0.80 |
| **LLM Judge (fluency)** | Natural-sounding in target | > 4.0/5.0 |
| **LLM Judge (accuracy)** | Meaning preserved | > 4.0/5.0 |
| **LLM Judge (terminology)** | Domain terms correct | > 4.0/5.0 |
| **LLM Refinement Lift** | Quality gain from post-editing | +0.3-0.5 COMET |

Quality by content type:
| Content Type | BLEU Target | LLM Refinement |
|-------------|------------|----------------|
| General | > 45 | Optional |
| Marketing | > 35 | Required (brand voice) |
| Legal | > 40 | Required (precision) |
| Technical | > 45 | Optional |

## Step 3: Evaluate Glossary Compliance

```bash
python evaluation/eval_glossary.py \
  --test-data evaluation/data/ \
  --glossary glossaries/enterprise-glossary.tsv \
  --output evaluation/results/glossary.json
```

Glossary metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Term Compliance** | Glossary terms translated correctly | > 95% |
| **Product Name Preservation** | Product names not translated | 100% |
| **Consistency** | Same term translated same way everywhere | > 98% |
| **Missing Terms** | Domain terms not in glossary | Track + flag |

## Step 4: Evaluate Markup Preservation

```bash
python evaluation/eval_markup.py \
  --test-data evaluation/data/ \
  --output evaluation/results/markup.json
```

Markup metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **HTML Tags Preserved** | All tags intact after translation | 100% |
| **Markdown Preserved** | Headers, links, bold, code blocks | 100% |
| **No Broken Tags** | Valid HTML output | 100% |
| **Attribute Preservation** | href, class, id unchanged | 100% |

## Step 5: Evaluate Throughput

```bash
python evaluation/eval_throughput.py \
  --output evaluation/results/throughput.json
```

Throughput metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Words per Minute** | Translation throughput | > 5000 wpm (basic) |
| **With LLM Refinement** | Throughput including post-editing | > 500 wpm |
| **Batch Document Speed** | Pages per hour (document translation) | > 100 pages/hr |
| **Latency (single segment)** | API response time | < 500ms (basic), < 3s (LLM) |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| BLEU (general) | > 40 | config/guardrails.json |
| COMET | > 0.80 | config/guardrails.json |
| Glossary compliance | > 95% | config/guardrails.json |
| Product name preservation | 100% | config/guardrails.json |
| Markup preservation | 100% | config/guardrails.json |
