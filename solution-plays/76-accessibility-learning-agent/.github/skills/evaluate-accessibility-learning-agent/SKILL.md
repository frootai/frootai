---
name: "evaluate-accessibility-learning-agent"
description: "Evaluate Accessibility Learning Agent — WCAG detection accuracy, alt-text quality, cognitive load calibration, false positive rate, remediation effectiveness."
---

# Evaluate Accessibility Learning Agent

## Prerequisites

- Deployed accessibility agent (run `deploy-accessibility-learning-agent` skill first)
- Test pages with known WCAG violations (expert-verified)
- Python 3.11+ with `azure-ai-evaluation`

## Step 1: Evaluate WCAG Detection Accuracy

```bash
python evaluation/eval_wcag_detection.py \
  --test-data evaluation/data/pages/ \
  --output evaluation/results/wcag.json
```

WCAG detection metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Violation Detection Rate** | Known violations correctly flagged | > 90% |
| **False Positive Rate** | Compliant elements incorrectly flagged | < 10% |
| **Severity Accuracy** | Correct severity (critical/serious/moderate/minor) | > 85% |
| **WCAG Criterion Accuracy** | Correct WCAG success criterion cited | > 90% |
| **Coverage by Category** | Perceivable + Operable + Understandable + Robust | All 4 |

Detection by WCAG principle:
| Principle | Automated | AI-Enhanced | Combined Target |
|-----------|-----------|-------------|----------------|
| Perceivable (1.x) | > 80% | > 90% | > 92% |
| Operable (2.x) | > 70% | > 85% | > 88% |
| Understandable (3.x) | > 60% | > 85% | > 85% |
| Robust (4.x) | > 90% | > 90% | > 95% |

## Step 2: Evaluate Alt-Text Quality

```bash
python evaluation/eval_alt_text.py \
  --test-data evaluation/data/images/ \
  --output evaluation/results/alt_text.json
```

Alt-text metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Descriptiveness** (human judge) | Alt text conveys image purpose | > 4.0/5.0 |
| **Context Awareness** | Uses surrounding page context | > 85% |
| **Length Compliance** | ≤ 125 characters | > 95% |
| **No "Image of" Prefix** | Doesn't start with "Image of" or "Picture of" | 100% |
| **Decorative Detection** | Decorative images get empty alt | > 80% |
| **Chart/Graph Data** | Includes key data point for data visualizations | > 85% |
| **Text in Image** | Includes embedded text content | > 90% |

## Step 3: Evaluate Cognitive Load Assessment

```bash
python evaluation/eval_cognitive.py \
  --test-data evaluation/data/pages/ \
  --output evaluation/results/cognitive.json
```

Cognitive load metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Reading Level Accuracy** | Matches Flesch-Kincaid/Gunning Fog reference | Within ±1 grade |
| **Complexity Detection** | Correctly flags high-complexity pages | > 80% |
| **Plain Language Score** | Correlation with expert assessment | r > 0.75 |
| **Navigation Depth** | Correctly measures clicks-to-content | 100% accurate |

## Step 4: Evaluate Remediation Quality

```bash
python evaluation/eval_remediation.py \
  --test-data evaluation/data/violations/ \
  --output evaluation/results/remediation.json
```

Remediation metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Fix Accuracy** | Suggested fix resolves the violation | > 85% |
| **Code Correctness** | Suggested HTML/ARIA is valid | > 95% |
| **Effort Accuracy** | Correct effort estimate (low/medium/high) | > 80% |
| **Priority Accuracy** | Most impactful issues prioritized first | > 90% |
| **No New Violations** | Applied fix doesn't create new issues | 100% |

## Step 5: Evaluate Screen Reader Compatibility

```bash
python evaluation/eval_screen_reader.py \
  --test-data evaluation/data/pages/ \
  --output evaluation/results/screen_reader.json
```

Screen reader metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Heading Hierarchy** | Logical H1→H2→H3 structure | > 90% |
| **Form Label Association** | All inputs have associated labels | > 95% |
| **ARIA Role Validity** | ARIA roles used correctly | > 95% |
| **Landmark Coverage** | Main, nav, header, footer present | > 85% |
| **Reading Order** | DOM order matches visual layout | > 80% |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- WCAG compliance scorecard (A / AA / AAA)
- Violation heatmap by principle × severity
- Alt-text quality distribution chart
- Cognitive load assessment dashboard
- Remediation progress tracker
- Screen reader compatibility audit trail

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Violation detection | > 90% | config/guardrails.json |
| False positive rate | < 10% | config/guardrails.json |
| Alt-text descriptiveness | > 4.0/5.0 | config/guardrails.json |
| Fix accuracy | > 85% | config/guardrails.json |
| WCAG criterion accuracy | > 90% | config/guardrails.json |
