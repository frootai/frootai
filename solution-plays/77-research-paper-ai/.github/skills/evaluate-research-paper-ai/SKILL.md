---
name: "evaluate-research-paper-ai"
description: "Evaluate Research Paper AI — extraction accuracy, citation verification, synthesis quality, gap identification, search relevance."
---

# Evaluate Research Paper AI

## Prerequisites

- Deployed research AI (run `deploy-research-paper-ai` skill first)
- Expert-reviewed literature reviews for comparison
- Python 3.11+ with `azure-ai-evaluation`

## Step 1: Evaluate Paper Search Quality

```bash
python evaluation/eval_search.py \
  --test-data evaluation/data/search_queries/ \
  --output evaluation/results/search.json
```

Search metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Precision@20** | Relevant papers in top 20 results | > 80% |
| **Recall** | Known relevant papers found | > 70% |
| **Source Coverage** | Papers found across multiple databases | ≥ 2 sources |
| **Deduplication Accuracy** | Correctly merged same paper from different sources | > 95% |
| **Recency Bias** | Not over-indexing on old/new papers | Balanced |

## Step 2: Evaluate Structured Extraction

```bash
python evaluation/eval_extraction.py \
  --test-data evaluation/data/papers/ \
  --output evaluation/results/extraction.json
```

Extraction metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Objective Accuracy** | Correctly identifies research question | > 90% |
| **Methodology Completeness** | Captures methods, datasets, models | > 85% |
| **Key Findings Accuracy** | Includes correct quantitative results | > 85% |
| **Limitations Coverage** | Captures author-stated limitations | > 80% |
| **No Hallucination** | Every extracted fact exists in the paper | 100% |
| **"Not Reported" Accuracy** | Correctly identifies missing information | > 90% |

## Step 3: Evaluate Citation Accuracy

```bash
python evaluation/eval_citations.py \
  --test-data evaluation/data/reviews/ \
  --output evaluation/results/citations.json
```

Citation metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **DOI Verification** | All cited DOIs resolve correctly | 100% |
| **Author Match** | Cited author names match actual paper | > 98% |
| **Year Accuracy** | Cited year matches publication year | > 99% |
| **No Phantom Citations** | Every citation references a real paper | 100% |
| **Citation Relevance** | Cited paper supports the claim made | > 90% |
| **Citation Format** | Consistent APA/IEEE/custom format | > 95% |

## Step 4: Evaluate Literature Synthesis Quality

```bash
python evaluation/eval_synthesis.py \
  --test-data evaluation/data/reviews/ \
  --output evaluation/results/synthesis.json
```

Synthesis metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Thematic Grouping** | Organized by theme, not chronology | > 90% |
| **Cross-Paper Comparison** | Compares/contrasts findings | > 85% |
| **Coherence** (LLM judge) | Flows logically, well-structured | > 4.0/5.0 |
| **Coverage** | All major themes from papers addressed | > 85% |
| **Academic Tone** | Appropriate scholarly language | > 90% |
| **Groundedness** | Every claim traceable to cited paper | > 0.90 |

## Step 5: Evaluate Research Gap Identification

```bash
python evaluation/eval_gaps.py \
  --test-data evaluation/data/gap_analysis/ \
  --output evaluation/results/gaps.json
```

Gap metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Gap Validity** (expert judge) | Identified gap is a real gap | > 75% |
| **Evidence Support** | Gap grounded in cited paper limitations | > 80% |
| **Actionability** | Suggested approach is feasible | > 70% |
| **Impact Rating Accuracy** | High-impact gaps correctly rated | > 75% |
| **Novelty** | Gap not already addressed by included papers | 100% |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Search precision/recall curves by database
- Extraction accuracy per field heatmap
- Citation verification audit trail
- Synthesis quality distribution
- Gap validation scorecard
- End-to-end pipeline latency breakdown

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| No phantom citations | 100% | config/guardrails.json |
| No hallucinated extractions | 100% | config/guardrails.json |
| DOI verification | 100% | config/guardrails.json |
| Groundedness | > 0.90 | fai-manifest.json |
| Synthesis coherence | > 4.0/5.0 | config/guardrails.json |
