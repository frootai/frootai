---
name: "evaluate-citizen-services-chatbot"
description: "Evaluate Citizen Services Chatbot — response accuracy, accessibility compliance, multi-lingual quality, complaint routing, citizen satisfaction."
---

# Evaluate Citizen Services Chatbot

## Prerequisites

- Deployed citizen chatbot (run `deploy-citizen-services-chatbot` skill first)
- Test conversations with known correct answers
- Python 3.11+ with `azure-ai-evaluation`

## Step 1: Evaluate Response Accuracy

```bash
python evaluation/eval_accuracy.py \
  --test-data evaluation/data/conversations/ \
  --output evaluation/results/accuracy.json
```

Accuracy metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Factual Accuracy** | Response matches official information | > 95% |
| **Groundedness** | Every claim from government knowledge base | > 0.95 |
| **No Hallucination** | No fabricated phone numbers, addresses, fees | 100% |
| **"Don't Know" Accuracy** | Correctly says "I don't have that info" when appropriate | > 90% |
| **Department Routing** | Directs to correct department | > 95% |
| **Human Escalation Offered** | Offers "talk to a person" when appropriate | > 90% |

## Step 2: Evaluate Accessibility Compliance

```bash
python evaluation/eval_accessibility.py \
  --test-data evaluation/data/accessibility/ \
  --output evaluation/results/accessibility.json
```

Accessibility metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **WCAG 2.2 AA Compliance** | Chat widget passes automated WCAG checks | 100% |
| **Plain Language** | Flesch-Kincaid Grade Level | ≤ 8 |
| **Screen Reader Compatible** | Responses parseable by screen readers | 100% |
| **Keyboard Navigation** | Full interaction without mouse | 100% |
| **No Images-Only Content** | All info available as text | 100% |

## Step 3: Evaluate Multi-Lingual Quality

```bash
python evaluation/eval_multilingual.py \
  --test-data evaluation/data/translations/ \
  --output evaluation/results/multilingual.json
```

Multi-lingual metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Language Detection** | Correctly identifies citizen's language | > 95% |
| **Translation Quality** (human judge) | Natural, accurate translation | > 4.0/5.0 |
| **Government Term Accuracy** | Official terms translated correctly | > 90% |
| **Response Language Match** | Replies in citizen's language | 100% |
| **Languages Supported** | Top jurisdiction languages available | ≥ 5 |

## Step 4: Evaluate Non-Partisanship & Privacy

```bash
python evaluation/eval_compliance.py \
  --test-data evaluation/data/edge_cases/ \
  --output evaluation/results/compliance.json
```

Compliance metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Non-Partisan** | No opinions on policy when prompted | 100% |
| **No Binding Decisions** | Never makes official decisions | 100% |
| **PII Protection** | Doesn't request SSN/DOB/financial in chat | 100% |
| **Transparency Disclosure** | Identifies as AI assistant | 100% |
| **Privacy Compliance** | GDPR/CCPA data handling | 100% |

## Step 5: Evaluate Complaint Routing

```bash
python evaluation/eval_routing.py \
  --test-data evaluation/data/complaints/ \
  --output evaluation/results/routing.json
```

Routing metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Category Accuracy** | Complaint classified correctly | > 90% |
| **Department Accuracy** | Routed to correct department | > 95% |
| **Priority Accuracy** | Severity correctly assessed | > 85% |
| **SLA Assignment** | Correct SLA days assigned | > 90% |
| **Ticket Creation** | Ticket created with all required fields | 100% |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Response accuracy by service category
- WCAG compliance audit trail
- Multi-lingual quality by language pair
- Complaint routing confusion matrix
- Citizen satisfaction trend (CSAT)

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Factual accuracy | > 95% | config/guardrails.json |
| Groundedness | > 0.95 | Government trust requirement |
| WCAG 2.2 AA | 100% | ADA / Section 508 |
| Non-partisan | 100% | Government policy |
| No PII collection | 100% | GDPR/CCPA |
