---
name: "evaluate-creative-ai-studio"
description: "Evaluate Creative AI Studio quality — brand voice fidelity, content originality, variation diversity, platform adaptation quality, image safety, A/B performance."
---

# Evaluate Creative AI Studio

## Prerequisites

- Deployed creative AI studio (run `deploy-creative-ai-studio` skill first)
- Test campaign briefs with brand voice reference
- Python 3.11+ with `azure-ai-evaluation`, `textstat` packages
- Azure OpenAI for LLM-as-judge content quality assessment

## Step 1: Prepare Evaluation Dataset

```bash
mkdir -p evaluation/data

# Each test case: campaign brief + brand config + expected quality
# evaluation/data/campaign-001.json
# {
#   "brief": "Launch blog post for new AI-powered search feature",
#   "brand_voice": {"tone": "professional", "forbidden": ["revolutionary"]},
#   "platforms": ["linkedin", "twitter", "blog"],
#   "expected_variations": 3,
#   "category": "product-launch"
# }
```

Test categories:
- **Product Launch**: New feature announcements (5 briefs)
- **Thought Leadership**: Industry insights, opinion pieces (5 briefs)
- **Social Media**: Short-form engagement content (5 briefs)
- **Email Marketing**: Newsletter, drip campaigns (5 briefs)
- **Visual Campaigns**: Image + copy combination (5 briefs)

## Step 2: Evaluate Brand Voice Fidelity

```bash
python evaluation/eval_brand.py \
  --test-data evaluation/data/ \
  --brand-config config/guardrails.json \
  --judge-model gpt-4o \
  --output evaluation/results/brand.json
```

Brand voice metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Tone Consistency** (LLM judge) | Content matches specified tone | > 4.0/5.0 |
| **Forbidden Word Compliance** | No forbidden words in output | 100% |
| **Voice Adherence** | Uses correct person (we/our) | > 95% |
| **Style Match** | Sentence length, structure, formatting | > 85% |
| **Brand Personality Score** | Overall brand alignment | > 4.0/5.0 |

## Step 3: Evaluate Content Quality

```bash
python evaluation/eval_quality.py \
  --test-data evaluation/data/ \
  --judge-model gpt-4o \
  --output evaluation/results/quality.json
```

Content quality metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Readability** (Flesch-Kincaid) | Reading ease score | 60-80 (accessible) |
| **Engagement** (LLM judge) | Hook strength, CTA effectiveness | > 4.0/5.0 |
| **Originality** | Unique content, not template-like | > 4.0/5.0 |
| **Relevance** | Content addresses the brief | > 4.5/5.0 |
| **Grammar/Spelling** | Error-free output | > 99% |
| **CTA Clarity** | Clear call-to-action present | > 90% |

## Step 4: Evaluate Variation Diversity

```bash
python evaluation/eval_diversity.py \
  --test-data evaluation/data/ \
  --output evaluation/results/diversity.json
```

Diversity metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Semantic Similarity** | Cosine distance between variations | < 0.7 (different enough) |
| **Structural Diversity** | Different formats, lengths, hooks | > 3/5 dimensions different |
| **Vocabulary Overlap** | Shared unique words between variations | < 40% |
| **Hook Uniqueness** | Different opening approaches | 100% unique hooks |
| **All Viable** | Each variation standalone usable | > 90% |

## Step 5: Evaluate Platform Adaptation

```bash
python evaluation/eval_platform.py \
  --test-data evaluation/data/ \
  --output evaluation/results/platform.json
```

Platform metrics:
| Metric | Platform | Criteria | Target |
|--------|----------|----------|--------|
| **Character Limit** | Twitter | ≤ 280 chars | 100% |
| **Character Limit** | LinkedIn | ≤ 3000 chars | 100% |
| **Tone Match** | LinkedIn | Professional | > 4.0/5.0 |
| **Tone Match** | Twitter | Concise+engaging | > 4.0/5.0 |
| **Tone Match** | Instagram | Visual+casual | > 4.0/5.0 |
| **Hashtag Count** | Instagram | 5-15 hashtags | > 90% |
| **Hashtag Count** | Twitter | 1-2 hashtags | > 90% |
| **CTA Platform-fit** | All | Platform-appropriate CTA | > 85% |

## Step 6: Evaluate Image Safety

```bash
python evaluation/eval_images.py \
  --test-data evaluation/data/ \
  --output evaluation/results/images.json
```

Image metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Content Safety** | All generated images pass moderation | 100% |
| **Brand Appropriateness** | Images match brand aesthetic | > 4.0/5.0 |
| **Brief Relevance** | Images match campaign brief | > 4.0/5.0 |
| **Copyright Safety** | No copyrighted characters/logos | 100% |

## Step 7: Generate Evaluation Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md \
  --thresholds config/guardrails.json
```

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Brand tone consistency | > 4.0/5.0 | config/guardrails.json |
| Forbidden word compliance | 100% | config/guardrails.json |
| Content readability | 60-80 FK | config/guardrails.json |
| Variation semantic similarity | < 0.7 | config/guardrails.json |
| Platform char limits | 100% compliance | config/guardrails.json |
| Image content safety | 100% | config/guardrails.json |
