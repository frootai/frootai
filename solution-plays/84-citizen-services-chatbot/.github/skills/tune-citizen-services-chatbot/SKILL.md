---
name: "tune-citizen-services-chatbot"
description: "Tune Citizen Services Chatbot — language clarity, translation quality, department routing, escalation rules, accessibility settings, cost optimization."
---

# Tune Citizen Services Chatbot

## Prerequisites

- Deployed citizen chatbot with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Language & Reading Level

```json
// config/guardrails.json — language settings
{
  "language": {
    "target_reading_grade": 8,
    "max_sentence_words": 20,
    "avoid_jargon": true,
    "jargon_replacements": {
      "adjudicate": "decide",
      "pursuant to": "according to",
      "remittance": "payment",
      "domicile": "home address",
      "affidavit": "sworn statement"
    },
    "plain_language_enforcement": true,
    "sentence_structure": "active_voice_preferred",
    "response_max_words": 200
  }
}
```

Language tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `target_reading_grade` | 8 | Lower = simpler language, may lose nuance |
| `max_sentence_words` | 20 | Shorter = easier to read, may need more sentences |
| `response_max_words` | 200 | Shorter = focused, longer = more complete |
| `avoid_jargon` | true | false = use official terms (harder for citizens) |

### Reading Level by Audience
| Audience | Target Grade | Example |
|----------|-------------|---------|
| General public | 6-8 | "You can renew your license online." |
| Business services | 8-10 | "Submit the application with supporting documentation." |
| Legal/regulatory | 10-12 | "Pursuant to Section 42, applicants must..." |

## Step 2: Tune Multi-Lingual Support

```json
// config/agents.json — translation settings
{
  "multilingual": {
    "primary_language": "en",
    "supported_languages": ["en", "es", "zh", "vi", "ko", "ar", "tl", "fr", "ht", "ru"],
    "auto_detect": true,
    "custom_glossaries": {
      "es": "data/glossaries/es-government-terms.json",
      "zh": "data/glossaries/zh-government-terms.json"
    },
    "fallback_to_english": true,
    "language_selector_visible": true,
    "translation_provider": "azure_translator",
    "cache_translations": true,
    "cache_ttl_hours": 24
  }
}
```

Translation tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `supported_languages` | 10 | More = wider access, more translation cost |
| `custom_glossaries` | es, zh | Add for each high-volume language |
| `cache_translations` | true | Reduces cost for repeated phrases |
| `auto_detect` | true | false = require citizen to select language |

## Step 3: Tune Department Routing

```json
// config/agents.json — routing settings
{
  "routing": {
    "classification_model": "gpt-4o-mini",
    "confidence_threshold": 0.80,
    "low_confidence_action": "ask_clarification",
    "department_mapping": {
      "dmv": {"keywords": ["license", "registration", "title", "driving"], "phone": "555-DMV-HELP"},
      "permits": {"keywords": ["building", "permit", "zoning", "construction"], "phone": "555-PERMITS"},
      "utilities": {"keywords": ["water", "sewer", "electric", "gas", "bill"], "phone": "555-UTILITY"},
      "public_works": {"keywords": ["road", "pothole", "streetlight", "sidewalk"], "phone": "555-ROADS"},
      "parks_rec": {"keywords": ["park", "playground", "trail", "recreation"], "phone": "555-PARKS"}
    },
    "escalation": {
      "after_failed_attempts": 2,
      "complex_topics": ["legal", "tax_dispute", "appeal", "discrimination"],
      "always_offer_human": true
    }
  }
}
```

Routing tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `confidence_threshold` | 0.80 | Lower = route more aggressively (risk misrouting) |
| `after_failed_attempts` | 2 | Lower = faster human escalation |
| `always_offer_human` | true | false = AI-only first (not recommended for gov) |

## Step 4: Tune Privacy & Compliance

```json
// config/guardrails.json — privacy settings
{
  "privacy": {
    "pii_fields_blocked_in_chat": ["ssn", "date_of_birth", "bank_account", "credit_card"],
    "pii_redirect_message": "For your security, please submit sensitive information through our secure form at [URL].",
    "conversation_retention_days": 30,
    "anonymize_in_logs": true,
    "no_behavioral_tracking": true,
    "cookie_policy": "essential_only",
    "gdpr_compliant": true,
    "ccpa_compliant": true,
    "right_to_deletion": true
  },
  "transparency": {
    "ai_disclosure": "I'm an AI assistant for [jurisdiction]. For official decisions, please contact the relevant department.",
    "show_on_first_message": true,
    "confidence_display": false
  }
}
```

| Setting | Value | Rationale |
|---------|-------|-----------|
| PII blocked in chat | SSN, DOB, bank, CC | Government must protect citizen data |
| Retention | 30 days | Minimum for complaint tracking |
| No behavioral tracking | true | Government can't track citizens |
| AI disclosure | First message | Transparency requirement |

## Step 5: Tune Model Configuration

```json
// config/openai.json
{
  "citizen_conversation": {
    "model": "gpt-4o",
    "temperature": 0,
    "max_tokens": 500,
    "top_p": 1.0
  },
  "complaint_classification": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 50
  },
  "form_guidance": {
    "model": "gpt-4o-mini",
    "temperature": 0.1,
    "max_tokens": 300
  }
}
```

| Task | Model | Temperature | Why |
|------|-------|-------------|-----|
| Citizen conversation | gpt-4o | 0 | Maximum factual accuracy — government trust |
| Complaint classification | gpt-4o-mini | 0 | Simple categorization |
| Form guidance | gpt-4o-mini | 0.1 | Helpful but factual |

## Step 6: Cost Optimization

```python
# Citizen Services Chatbot cost per month:
# LLM:
#   - Citizen conversations (gpt-4o, ~5000 turns × $0.02): ~$100
#   - Complaint classification (gpt-4o-mini, ~500 × $0.001): ~$0.50
#   - Form guidance (gpt-4o-mini, ~200 × $0.002): ~$0.40
# Translation:
#   - Azure Translator (~200K chars/month): ~$10
# Infrastructure:
#   - AI Search S1: ~$250/month
#   - Bot Service S1: ~$50/month
#   - Container Apps: ~$15/month
#   - Cosmos DB Serverless: ~$10/month
#   - Content Safety: ~$5/month
# Total: ~$441/month (for ~5000 conversations)

# Cost reduction:
# 1. gpt-4o-mini for citizen conversations: save ~$90/month (lower quality)
# 2. Cache FAQ responses (top 50 questions): save 40% LLM
# 3. AI Search Basic (if <10K documents): save ~$200/month
# 4. Translation caching: save ~30% translation cost
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| gpt-4o-mini conversations | ~$90/month | Lower response quality |
| Cache FAQs | ~$40/month | May serve stale info |
| Search Basic | ~$200/month | 15M document limit |
| Translation cache | ~$3/month | May miss term updates |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_accuracy.py --test-data evaluation/data/conversations/
python evaluation/eval_accessibility.py --test-data evaluation/data/accessibility/
python evaluation/eval_multilingual.py --test-data evaluation/data/translations/
python evaluation/eval_routing.py --test-data evaluation/data/complaints/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Factual accuracy | baseline | > 95% | > 95% |
| WCAG compliance | baseline | 100% | 100% |
| Translation quality | baseline | > 4.0/5.0 | > 4.0/5.0 |
| Complaint routing | baseline | > 95% | > 95% |
| Cost per conversation | ~$0.09 | ~$0.05 | < $0.10 |
